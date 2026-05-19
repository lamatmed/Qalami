import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { ClassDetails } from '@/components/teacher/class-details'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface PageProps {
    params: Promise<{ classId: string }>
}

export default async function ClassDetailsPage({ params }: PageProps) {
    const supabase = await createClient()
    
    // Ensure authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const resolvedParams = await params
    const classId = resolvedParams.classId

    const adminClient = createAdminClient()

    // Parallel fetch via adminClient: Bypasses RLS to allow viewing cross-school classes
    const [
        { data: classInfo, error: classError },
        { data: enrollments, error: enrollmentError }
    ] = await Promise.all([
        adminClient.from('classes').select('name').eq('id', classId).single(),
        adminClient.from('enrollments')
            .select(`
                id,
                student_id,
                profiles!enrollments_student_id_fkey (
                    id,
                    full_name,
                    avatar_url,
                    national_id
                )
            `)
            .eq('class_id', classId)
            .eq('status', 'active')
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
        national_id: e.profiles?.national_id || null,
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
