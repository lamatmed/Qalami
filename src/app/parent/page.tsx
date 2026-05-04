import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { ParentHome } from '@/components/parent/parent-home'

export default async function ParentDashboard() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    return <ParentHome />
}
