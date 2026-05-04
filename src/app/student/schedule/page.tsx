import { createClient } from '@/utils/supabase/server'
import { StudentScheduleView } from '@/components/student/student-schedule-view'

export default async function StudentSchedulePage() {
    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return <div>Not authenticated</div>

    // Get user's enrollment to find their class
    const { data: profile } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('id', user.id)
        .single()

    const { data: enrollment } = await supabase
        .from('enrollments')
        .select('class_id')
        .eq('student_id', user.id)
        .single()

    // Fetch schedule for the student's class
    const { data: scheduleData } = await supabase
        .from('schedule')
        .select(`
            id,
            day_of_week,
            start_time,
            end_time,
            room,
            subject:subject_id(id, name),
            teacher:teacher_id(id, full_name)
        `)
        .eq('class_id', enrollment?.class_id ?? '')
        .order('day_of_week')
        .order('start_time')

    // Transform to component-friendly format
    const schedule = (scheduleData ?? []).map((item: any) => ({
        id: item.id,
        day_of_week: item.day_of_week,
        subject: item.subject?.name ?? 'Unknown',
        teacher: item.teacher?.full_name ?? 'TBD',
        room: item.room ?? 'TBD',
        start_time: item.start_time,
        end_time: item.end_time,
    }))

    return <StudentScheduleView schedule={schedule} />
}
