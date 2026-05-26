'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { getActionContext } from '@/lib/auth-action'

export async function getActivityLogsAction(params: {
    limit?: number
    offset?: number
    dateFrom?: string
    dateTo?: string
    actorId?: string
    action?: string
} = {}) {
    const ctx = await getActionContext(['admin', 'super_admin'])
    if (!ctx) return { error: 'Accès réservé au directeur', data: [], total: 0 }

    const admin = createAdminClient()
    const limit = params.limit ?? 50
    const offset = params.offset ?? 0

    let query = admin
        .from('activity_logs')
        .select('id, actor_id, action, entity_type, entity_id, details, created_at', { count: 'exact' })
        .eq('school_id', ctx.schoolId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

    if (params.dateFrom) query = query.gte('created_at', params.dateFrom)
    if (params.dateTo)   query = query.lte('created_at', params.dateTo + 'T23:59:59')
    if (params.actorId)  query = query.eq('actor_id', params.actorId)
    if (params.action)   query = query.eq('action', params.action)

    const { data, error, count } = await query
    if (error) return { error: error.message, data: [], total: 0 }

    // Enrich with actor names
    const actorIds = [...new Set((data ?? []).map((r: any) => r.actor_id))]
    const { data: profiles } = await admin
        .from('profiles')
        .select('id, full_name, role')
        .in('id', actorIds)

    const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]))

    const enriched = (data ?? []).map((row: any) => ({
        ...row,
        actor_name: profileMap[row.actor_id]?.full_name ?? 'Utilisateur',
        actor_role: profileMap[row.actor_id]?.role ?? 'unknown',
    }))

    return { data: enriched, error: null, total: count ?? 0 }
}

export async function getActivityActorsAction() {
    const ctx = await getActionContext(['admin', 'super_admin'])
    if (!ctx) return { data: [] }

    const admin = createAdminClient()

    // Distinct actors who have entries in activity_logs for this school
    const { data } = await admin
        .from('activity_logs')
        .select('actor_id')
        .eq('school_id', ctx.schoolId)

    const ids = [...new Set((data ?? []).map((r: any) => r.actor_id))]
    if (ids.length === 0) return { data: [] }

    const { data: profiles } = await admin
        .from('profiles')
        .select('id, full_name, role')
        .in('id', ids)

    return { data: profiles ?? [] }
}
