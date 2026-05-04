import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { TeacherHome } from '@/components/teacher/teacher-home'

export default async function TeacherDashboard() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            <TeacherHome />
        </div>
    )
}
