'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

export async function getTransactionsAction(params: {
    dateFrom?: string
    dateTo?: string
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Non authentifié', data: [] }

    const { data: profile } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('id', user.id)
        .single()

    if (!profile?.school_id) return { error: 'École introuvable', data: [] }

    const admin = createAdminClient()

    let query = admin
        .from('transactions')
        .select('*')
        .eq('school_id', profile.school_id)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })

    if (params.dateFrom) query = query.gte('transaction_date', params.dateFrom)
    if (params.dateTo) query = query.lte('transaction_date', params.dateTo)
    if (!params.dateFrom && !params.dateTo) query = query.limit(100)

    const { data, error } = await query
    if (error) return { error: error.message, data: [] }

    return { data: data ?? [], error: null }
}

export async function updateTransactionAction(id: string, updates: {
    type?: string
    category?: string
    description?: string
    amount?: number
    status?: string
    transaction_date?: string
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Non authentifié' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('id', user.id)
        .single()

    if (!profile?.school_id) return { error: 'École introuvable' }

    const admin = createAdminClient()
    const { error } = await admin
        .from('transactions')
        .update(updates)
        .eq('id', id)
        .eq('school_id', profile.school_id)

    if (error) return { error: error.message }
    return { success: true }
}

export async function deleteTransactionAction(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Non authentifié' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('id', user.id)
        .single()

    if (!profile?.school_id) return { error: 'École introuvable' }

    const admin = createAdminClient()
    const { error } = await admin
        .from('transactions')
        .delete()
        .eq('id', id)
        .eq('school_id', profile.school_id)

    if (error) return { error: error.message }
    return { success: true }
}
