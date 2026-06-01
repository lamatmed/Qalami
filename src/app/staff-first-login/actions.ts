'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'

export async function changeFirstLoginPassword(newPassword: string) {
    if (!newPassword?.trim() || !/^\d{6}$/.test(newPassword.trim())) {
        return { error: 'Le mot de passe doit être exactement 6 chiffres' }
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Non authentifié' }

    const adminClient = createAdminClient()

    const { error: pwError } = await adminClient.auth.admin.updateUserById(user.id, {
        password: newPassword.trim(),
    })
    if (pwError) return { error: pwError.message }

    await adminClient
        .from('profiles')
        .update({ first_login: false })
        .eq('id', user.id)

    redirect('/admin')
}
