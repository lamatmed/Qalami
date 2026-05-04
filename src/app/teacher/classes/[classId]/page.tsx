import { createClient } from '@/utils/supabase/server'
import { ClassDetails } from '@/components/teacher/class-details'

interface PageProps {
    params: Promise<{ classId: string }>
}

export default async function ClassDetailsPage({ params }: PageProps) {
    const supabase = await createClient()
    const resolvedParams = await params
    const classId = resolvedParams.classId

    // Parallel fetch: Class Info, Students
    const [
        { data: classInfo, error: classError },
        { data: enrollments, error: enrollmentError }
    ] = await Promise.all([
        supabase.from('classes').select('name').eq('id', classId).single(),
        supabase.from('enrollments')
            .select(`
                id,
                student_id,
                profiles!enrollments_student_id_fkey (
                    id,
                    full_name,
                    avatar_url
                )
            `)
            .eq('class_id', classId)
    ])

    if (classError) {
        console.error('Error fetching class:', classError)
    }
    if (enrollmentError) {
        console.error('Error fetching enrollments:', enrollmentError)
    }

    // Flatten data for component
    const students = (enrollments || []).map((e: any) => ({
        id: e.profiles?.id || e.student_id,
        full_name: e.profiles?.full_name || 'Élève',
        avatar_url: e.profiles?.avatar_url || null,
    }))

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            <ClassDetails
                classId={classId}
                className={classInfo?.name || "Classe Inconnue"}
                students={students}
            />
        </div>
    )
}

