import { createClient } from '@/utils/supabase/server'
import { HomeworkDetailView } from '@/components/student/homework-detail-view'
import { redirect } from 'next/navigation'

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function HomeworkDetailPage({ params }: PageProps) {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    // Fetch homework details
    const { data: homework, error } = await supabase
        .from('homework')
        .select(`
            id,
            title,
            description,
            instructions,
            due_date,
            max_points,
            attachment_urls,
            subject:subject_id(id, name),
            class:class_id(id, name),
            teacher:teacher_id(id, full_name)
        `)
        .eq('id', id)
        .eq('is_published', true)
        .single()

    if (error || !homework) {
        return (
            <div className="min-h-screen bg-[#080C14] flex items-center justify-center text-white">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-2">Devoir introuvable</h1>
                    <p className="text-gray-400">Ce devoir n'existe pas ou n'est plus disponible.</p>
                </div>
            </div>
        )
    }

    // Check for existing submission
    const { data: submission } = await supabase
        .from('homework_submissions')
        .select('id, status, grade, feedback, submitted_at, attachment_urls')
        .eq('homework_id', id)
        .eq('student_id', user.id)
        .single()

    return (
        <HomeworkDetailView
            homework={{
                id: homework.id,
                title: homework.title,
                description: homework.description,
                instructions: homework.instructions,
                dueDate: homework.due_date,
                maxPoints: homework.max_points,
                attachmentUrls: homework.attachment_urls,
                subjectName: (homework.subject as any)?.name ?? 'Matière',
                className: (homework.class as any)?.name ?? 'Classe',
                teacherName: (homework.teacher as any)?.full_name ?? 'Enseignant'
            }}
            existingSubmission={submission ? {
                id: submission.id,
                status: submission.status,
                grade: submission.grade,
                feedback: submission.feedback,
                submittedAt: submission.submitted_at,
                attachmentUrls: submission.attachment_urls
            } : null}
        />
    )
}
