import { createAdminClient } from '@/utils/supabase/admin'

/**
 * Write an activity log entry using the admin client (bypasses RLS).
 * Call fire-and-forget — never await in critical path.
 */
export function logActivity(params: {
    actorId: string
    schoolId: string
    action: string
    entityType: string
    entityId: string
    details: string
}): void {
    const admin = createAdminClient()
    admin.from('activity_logs').insert({
        actor_id:    params.actorId,
        school_id:   params.schoolId,
        action:      params.action,
        entity_type: params.entityType,
        entity_id:   params.entityId,
        details:     params.details,
    }).then(({ error }) => {
        if (error) console.error('[logActivity]', error.message)
    })
}
