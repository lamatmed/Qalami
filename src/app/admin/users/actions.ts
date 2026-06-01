'use server'

import { getActionContext } from '@/lib/auth-action'
import { createAdminClient } from '@/utils/supabase/admin'
import { logActivity } from '@/lib/activity-log'

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

    logActivity({ actorId: userId, schoolId, action: 'create_staff', entityType: 'user', entityId: authUser.user.id, details: `Création du compte staff: ${formData.fullName}` })

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

    logActivity({ actorId, schoolId, action: 'update_permissions', entityType: 'user', entityId: userId, details: `Permissions mises à jour: ${permissions.join(', ')}` })

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
    await adminClient.from('profiles').delete().eq('id', userId)
    await adminClient.auth.admin.deleteUser(userId)

    logActivity({ actorId, schoolId, action: 'delete_staff', entityType: 'user', entityId: userId, details: `Suppression du compte staff: ${targetProfile.full_name}` })

    return { success: true }
}

export async function getActivityLogs(limit = 50) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non autorisé' }
    const { schoolId } = ctx
    const adminClient = createAdminClient()

    const { data, error } = await adminClient
        .from('activity_logs')
        .select('id, actor_id, action, entity_type, entity_id, details, created_at')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) return { error: error.message }

    const logs = (data ?? []) as any[]

    // Manual join: fetch actor profiles for all unique actor_ids
    const actorIds = [...new Set(logs.map(l => l.actor_id).filter(Boolean))]
    if (actorIds.length > 0) {
        const { data: actorProfiles } = await adminClient
            .from('profiles')
            .select('id, full_name, phone, role')
            .in('id', actorIds)
        const profileMap = new Map((actorProfiles || []).map(p => [p.id, p]))
        for (const log of logs) {
            log.profiles = profileMap.get(log.actor_id) ?? null
        }
    }

    // Replace any UUID in details with its human-readable name (class or term)
    const uuidRe = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
    const allIds = new Set<string>()
    for (const log of logs) {
        for (const m of (log.details ?? '').match(uuidRe) ?? []) allIds.add(m.toLowerCase())
    }
    if (allIds.size > 0) {
        const ids = Array.from(allIds)
        const [{ data: classes }, { data: terms }] = await Promise.all([
            adminClient.from('classes').select('id, name').in('id', ids),
            adminClient.from('terms').select('id, name').in('id', ids),
        ])
        const nameMap = new Map<string, string>()
        for (const c of classes ?? []) nameMap.set((c as any).id.toLowerCase(), (c as any).name)
        for (const t of terms ?? []) nameMap.set((t as any).id.toLowerCase(), (t as any).name)
        if (nameMap.size > 0) {
            for (const log of logs) {
                log.details = (log.details ?? '').replace(uuidRe, (u: string) => nameMap.get(u.toLowerCase()) ?? u)
            }
        }
    }

    return { data: logs }
}

export async function adminUpdateUserPassword(targetUserId: string, newPassword: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non autorisé' }
    const { supabase, userId: actorId, schoolId } = ctx
    const adminClient = createAdminClient()

    if (!newPassword || !/^\d{6}$/.test(newPassword.trim())) {
        return { error: 'Le mot de passe doit être exactement 6 chiffres' }
    }

    const { data: targetProfile, error: profileError } = await adminClient
        .from('profiles')
        .select('school_id, role, full_name, phone')
        .eq('id', targetUserId)
        .single()

    if (profileError || !targetProfile) {
        return { error: 'Utilisateur non trouvé' }
    }

    let isAuthorized = false

    if (ctx.role === 'super_admin') {
        isAuthorized = true
    } else if (['admin', 'school_staff'].includes(ctx.role)) {
        if (targetProfile.school_id === schoolId) {
            isAuthorized = true
        } else {
            const { data: schoolLink } = await adminClient
                .from('profile_schools')
                .select('id')
                .eq('profile_id', targetUserId)
                .eq('school_id', schoolId)
                .maybeSingle()
            
            if (schoolLink) {
                isAuthorized = true
            } else if (targetProfile.role === 'parent') {
                const { data: parentLink } = await adminClient
                    .from('parent_student_links')
                    .select('student_id, students:profiles!parent_student_links_student_id_fkey!inner(school_id)')
                    .eq('parent_id', targetUserId)
                    .eq('students.school_id', schoolId)
                    .limit(1)
                
                if (parentLink && parentLink.length > 0) {
                    isAuthorized = true
                }
            } else if (targetProfile.role === 'teacher') {
                const { data: teacherAssignment } = await adminClient
                    .from('teacher_assignments')
                    .select('class_id, classes!inner(school_id)')
                    .eq('teacher_id', targetUserId)
                    .eq('classes.school_id', schoolId)
                    .limit(1)
                
                if (teacherAssignment && teacherAssignment.length > 0) {
                    isAuthorized = true
                }
            }
        }
    }

    if (!isAuthorized) {
        return { error: 'Accès non autorisé' }
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(targetUserId, {
        password: newPassword.trim()
    })

    if (updateError) {
        console.error('Password update failed:', updateError)
        return { error: `Échec de la mise à jour: ${updateError.message}` }
    }

    logActivity({ actorId, schoolId, action: 'update_password', entityType: 'user', entityId: targetUserId, details: `Mise à jour du mot de passe pour: ${targetProfile.full_name}` })

    return { success: true }
}

