'use server'

import { getActionContext } from '@/lib/auth-action'
import { createAdminClient } from '@/utils/supabase/admin'

const PERMISSIONS = [
    'students', 'teachers', 'parents', 'finance', 'classes',
    'schedule', 'reports', 'attendance', 'settings', 'users',
] as const

export type Permission = typeof PERMISSIONS[number]

export async function getStaffUsers() {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non autorisé' }
    const { supabase, schoolId } = ctx

    const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone, role, status, first_login, created_at')
        .eq('school_id', schoolId)
        .eq('role', 'school_staff')
        .order('created_at', { ascending: false })

    if (error) return { error: error.message }

    const ids = (data ?? []).map((u: any) => u.id)
    const permissionsMap: Record<string, Permission[]> = {}
    if (ids.length > 0) {
        const { data: permsData } = await supabase
            .from('staff_permissions')
            .select('user_id, permissions')
            .in('user_id', ids)

        for (const row of permsData ?? []) {
            permissionsMap[row.user_id] = row.permissions ?? []
        }
    }

    return {
        data: (data ?? []).map((u: any) => ({
            ...u,
            permissions: permissionsMap[u.id] ?? [],
        })),
    }
}

export async function createStaffUser(formData: {
    fullName: string
    phone: string
    password: string
    permissions: Permission[]
}) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non autorisé' }
    const { supabase, userId, schoolId } = ctx
    const adminClient = createAdminClient()

    if (!formData.fullName.trim()) return { error: 'Le nom est obligatoire' }
    if (!formData.phone.trim())    return { error: 'Le numéro est obligatoire' }
    if (!formData.password.trim()) return { error: 'Le mot de passe est obligatoire' }

    const phone = formData.phone.startsWith('+')
        ? formData.phone
        : `+${formData.phone.replace(/[^0-9]/g, '')}`

    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
        phone,
        password: formData.password.trim(),
        phone_confirm: true,
        user_metadata: { full_name: formData.fullName.trim() },
    })

    if (authError) return { error: authError.message }

    const { error: profileError } = await adminClient.from('profiles').upsert({
        id:          authUser.user.id,
        full_name:   formData.fullName.trim(),
        phone,
        role:        'school_staff',
        school_id:   schoolId,
        status:      'active',
        first_login: true,
    }, { onConflict: 'id' })

    if (profileError) {
        await adminClient.auth.admin.deleteUser(authUser.user.id)
        return { error: profileError.message }
    }

    await adminClient.from('staff_permissions').upsert({
        user_id:     authUser.user.id,
        school_id:   schoolId,
        permissions: formData.permissions,
    }, { onConflict: 'user_id' })

    await logActivity(supabase, userId, schoolId, 'create_staff', 'user', authUser.user.id,
        `Création du compte staff: ${formData.fullName}`)

    return { success: true }
}

export async function updateStaffPermissions(userId: string, permissions: Permission[]) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non autorisé' }
    const { supabase, userId: actorId, schoolId } = ctx
    const adminClient = createAdminClient()

    const { error } = await adminClient.from('staff_permissions').upsert({
        user_id:     userId,
        school_id:   schoolId,
        permissions,
    }, { onConflict: 'user_id' })

    if (error) return { error: error.message }

    await logActivity(supabase, actorId, schoolId, 'update_permissions', 'user', userId,
        `Permissions mises à jour: ${permissions.join(', ')}`)

    return { success: true }
}

export async function deleteStaffUser(userId: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non autorisé' }
    const { supabase, userId: actorId, schoolId } = ctx
    const adminClient = createAdminClient()

    const { data: targetProfile } = await supabase
        .from('profiles')
        .select('school_id, full_name')
        .eq('id', userId)
        .single()

    if (targetProfile?.school_id !== schoolId) return { error: 'Utilisateur non trouvé' }

    await adminClient.from('staff_permissions').delete().eq('user_id', userId)
    await adminClient.auth.admin.deleteUser(userId)

    await logActivity(supabase, actorId, schoolId, 'delete_staff', 'user', userId,
        `Suppression du compte staff: ${targetProfile.full_name}`)

    return { success: true }
}

export async function getActivityLogs(limit = 50) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non autorisé' }
    const { supabase, schoolId } = ctx

    const { data, error } = await supabase
        .from('activity_logs')
        .select('id, actor_id, action, entity_type, entity_id, details, created_at, profiles!actor_id(full_name)')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) return { error: error.message }
    return { data: data ?? [] }
}

async function logActivity(
    supabase: any,
    actorId: string,
    schoolId: string,
    action: string,
    entityType: string,
    entityId: string,
    details: string,
) {
    await supabase.from('activity_logs').insert({
        actor_id:    actorId,
        school_id:   schoolId,
        action,
        entity_type: entityType,
        entity_id:   entityId,
        details,
    })
}
