import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { InvitationsPageClient } from './invitations-client'

export default async function InvitationsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile || !['admin', 'super_admin', 'school_staff'].includes(profile.role)) {
        redirect('/admin')
    }

    const { data: invitations } = await supabase
        .from('invitations')
        .select('*')
        .order('created_at', { ascending: false })

    return <InvitationsPageClient invitations={invitations || []} />
}
