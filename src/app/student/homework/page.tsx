import { createClient } from '@/utils/supabase/server'
import { StudentHomeworkView } from '@/components/student/student-homework-view'
import { redirect } from 'next/navigation'

export default async function StudentHomeworkPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    // Get user's profile with class info
    const { data: profile } = await supabase
        .from('profiles')
        .select('id, school_id')
        .eq('id', user.id)
        .single()

    if (!profile) redirect('/login')

    // Get enrollments to find student's classes
    const { data: enrollments } = await supabase
        .from('enrollments')
        .select('class_id')
        .eq('student_id', user.id)

    const classIds = enrollments?.map(e => e.class_id) ?? []

    // Fetch homework for student's classes
    const { data: homework } = await supabase
        .from('homework')
        .select(`
            id,
            title,
            description,
            instructions,
            due_date,
            max_points,
            attachment_urls,
            is_published,
            subject:subject_id(id, name),
            class:class_id(id, name),
            teacher:teacher_id(id, full_name)
        `)
        .in('class_id', classIds.length > 0 ? classIds : ['00000000-0000-0000-0000-000000000000'])
        .eq('is_published', true)
        .order('due_date', { ascending: true })

    // Get submissions for this student
    const homeworkIds = homework?.map(h => h.id) ?? []
    const { data: submissions } = await supabase
        .from('homework_submissions')
        .select('homework_id, status, grade, submitted_at')
        .eq('student_id', user.id)
        .in('homework_id', homeworkIds.length > 0 ? homeworkIds : ['00000000-0000-0000-0000-000000000000'])

    // Create a map of submissions
    const submissionMap = new Map(submissions?.map(s => [s.homework_id, s]) ?? [])

    // Combine homework with submission status
    const homeworkWithStatus = homework?.map(h => ({
        ...h,
        submission: submissionMap.get(h.id) ?? null
    })) ?? []

    return <StudentHomeworkView homework={homeworkWithStatus} />
}
