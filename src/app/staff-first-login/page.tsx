import { FirstLoginForm } from '@/components/admin/users/first-login-form'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function StaffFirstLoginPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, first_login')
        .eq('id', user.id)
        .single()

    // Only school_staff with first_login=true can access this page
    if (profile?.role !== 'school_staff' || !profile?.first_login) {
        redirect('/admin')
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#07101A] flex items-center justify-center p-4">
            <FirstLoginForm />
        </div>
    )
}
