import { createClient } from '@/utils/supabase/server'
import { StudentCoursesView } from '@/components/student/student-courses-view'
import { redirect } from 'next/navigation'

export default async function StudentCoursesPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    // Get user's profile to find their school and class
    const { data: profile } = await supabase
        .from('profiles')
        .select('id, school_id')
        .eq('id', user.id)
        .single()

    if (!profile?.school_id) redirect('/login')

    // Find student's active class
    const { data: enrollment } = await supabase
        .from('enrollments')
        .select('class_id')
        .eq('student_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

    // Fetch subjects for this school
    const { data: subjects } = await supabase
        .from('subjects')
        .select('id, name, icon')
        .eq('school_id', profile.school_id)
        .order('name')

    // Fetch documents for the student's class (course/exercise/resource types)
    const docsQuery = supabase
        .from('documents')
        .select('id, name, description, file_url, file_type, file_size_bytes, document_type, academic_year, created_at, subjects(name, icon)')
        .eq('school_id', profile.school_id)
        .in('document_type', ['course', 'exercise', 'resource', 'correction', 'exam'])
        .order('created_at', { ascending: false })
        .limit(30)

    if (enrollment?.class_id) {
        docsQuery.eq('class_id', enrollment.class_id)
    }

    const { data: documents } = await docsQuery

    return (
        <StudentCoursesView
            subjects={(subjects as any) ?? []}
            documents={(documents as any) ?? []}
        />
    )
}
