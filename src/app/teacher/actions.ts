'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

/**
 * Fetches the schedule for a teacher on a given day, bypassing RLS,
 * aggregating data across ALL assigned schools.
 */
export async function getTeacherScheduleAction(teacherId: string, dayOfWeek: number) {
    if (!teacherId) throw new Error("teacherId is required")

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Non authentifié")

    const admin = createAdminClient()
    const { data: profile } = await admin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile) throw new Error("Profil introuvable")

    if (profile.role === 'teacher' && user.id !== teacherId) {
        throw new Error("Non autorisé")
    }
    if (profile.role !== 'teacher' && profile.role !== 'admin' && profile.role !== 'super_admin' && profile.role !== 'school_staff') {
        throw new Error("Non autorisé")
    }

    // Aggregates the schedule including icons, session type, and school name across all schools
    const { data, error } = await admin
        .from('schedule')
        .select(`
            id,
            class_id,
            start_time,
            end_time,
            room,
            session_type,
            subjects (name, icon),
            classes (name),
            schools (name)
        `)
        .eq('teacher_id', teacherId)
        .eq('day_of_week', dayOfWeek)
        .order('start_time', { ascending: true })

    if (error) {
        console.error("Error in getTeacherScheduleAction:", error)
        throw new Error(error.message)
    }

    // Deduplicate — same (class, subject, start, end) can appear multiple times
    // when PostgREST resolves ambiguous FK paths (school_id direct vs via classes)
    const seen = new Set<string>()
    return (data || []).filter((s: any) => {
        const key = `${s.class_id}-${s.subject_id ?? ''}-${s.start_time}-${s.end_time}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
}

/**
 * Fetches all assignments (classes and subjects) for a teacher,
 * bypassing RLS to aggregate data including school names across all assigned schools.
 */
export async function getTeacherAssignmentsAction(teacherId: string) {
    if (!teacherId) throw new Error("teacherId is required")

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Non authentifié")

    const admin = createAdminClient()
    const { data: profile } = await admin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile) throw new Error("Profil introuvable")

    if (profile.role === 'teacher' && user.id !== teacherId) {
        throw new Error("Non autorisé")
    }
    if (profile.role !== 'teacher' && profile.role !== 'admin' && profile.role !== 'super_admin' && profile.role !== 'school_staff') {
        throw new Error("Non autorisé")
    }

    const { data, error } = await admin
        .from('teacher_assignments')
        .select(`
            class_id,
            classes:class_id (
                id,
                name,
                school_id,
                schools (
                    name
                )
            ),
            subjects:subject_id (
                id,
                name
            )
        `)
        .eq('teacher_id', teacherId)

    if (error) {
        console.error("Error in getTeacherAssignmentsAction:", error)
        throw new Error(error.message)
    }

    return data || []
}

/**
 * Fetches all active student profiles for a class,
 * bypassing RLS to ensure consistent reading cross-school.
 */
export async function getClassStudentsAction(classId: string) {
    if (!classId) throw new Error("classId is required")

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Non authentifié")

    const admin = createAdminClient()
    const { data: profile } = await admin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile) throw new Error("Profil introuvable")

    if (profile.role === 'teacher') {
        // Check teacher_assignments OR schedule — either grants access
        const [{ data: assignment }, { data: scheduleEntry }] = await Promise.all([
            admin
                .from('teacher_assignments')
                .select('id')
                .eq('teacher_id', user.id)
                .eq('class_id', classId)
                .limit(1)
                .maybeSingle(),
            admin
                .from('schedule')
                .select('id')
                .eq('teacher_id', user.id)
                .eq('class_id', classId)
                .limit(1)
                .maybeSingle(),
        ])
        if (!assignment && !scheduleEntry) {
            throw new Error("Non autorisé à voir les élèves de cette classe")
        }
    } else if (profile.role !== 'admin' && profile.role !== 'super_admin' && profile.role !== 'school_staff') {
        throw new Error("Non autorisé")
    }

    const { data, error } = await admin
        .from('enrollments')
        .select(`
            student_id,
            profiles!enrollments_student_id_fkey (
                id,
                full_name,
                avatar_url,
                national_id
            )
        `)
        .eq('class_id', classId)
        .eq('status', 'active')

    if (error) {
        console.error("Error in getClassStudentsAction:", error)
        throw new Error(error.message)
    }

    return data || []
}

/**
 * Creates a new remark, bypassing RLS to allow cross-school creations.
 */
export async function createRemarkAction(payload: any) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Non authentifié")

    const admin = createAdminClient()
    const { data: profile } = await admin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile) throw new Error("Profil introuvable")

    if (profile.role === 'teacher') {
        if (payload.teacher_id !== user.id) {
            throw new Error("Non autorisé à insérer au nom d'un autre enseignant")
        }
    } else if (profile.role !== 'admin' && profile.role !== 'super_admin' && profile.role !== 'school_staff') {
        throw new Error("Non autorisé")
    }

    const { error } = await admin
        .from('remarks')
        .insert(payload)

    if (error) {
        console.error("Error in createRemarkAction detailed error:", error)
        throw new Error(error.message || "Failed to insert remark")
    }

    return { success: true }
}

/**
 * Fetches the current logged-in teacher's personal profile.
 */
export async function getTeacherProfileAction() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const admin = createAdminClient()
    const { data: profile } = await admin
        .from('profiles')
        .select('id, full_name, avatar_url, phone')
        .eq('id', user.id)
        .single()

    return profile
}

/**
 * Updates a teacher's profile name, avatar, and optionally changes password.
 */
export async function updateTeacherProfile(formData: {
    fullName?: string
    avatarUrl?: string
    newPassword?: string
    phone?: string
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Non authentifié' }

    const adminClient = createAdminClient()

    // 1. Check if phone is being changed, normalize it, and verify it's not already in use
    let normalizedPhone: string | undefined = undefined
    if (formData.phone && formData.phone.trim()) {
        const phoneInput = formData.phone.trim()
        normalizedPhone = phoneInput.startsWith('+') ? phoneInput : `+${phoneInput.replace(/[^0-9]/g, '')}`
        
        if (normalizedPhone !== user.phone) {
            const { data: phoneInUse } = await adminClient
                .from('profiles')
                .select('id')
                .eq('phone', normalizedPhone)
                .neq('id', user.id)
                .maybeSingle()

            if (phoneInUse) {
                return { error: 'Ce numéro de téléphone est déjà utilisé par un autre compte.' }
            }
        }
    }

    // 2. Update profiles table
    const updateData: any = {}
    if (formData.fullName) updateData.full_name = formData.fullName
    if (formData.avatarUrl !== undefined) updateData.avatar_url = formData.avatarUrl
    if (normalizedPhone) updateData.phone = normalizedPhone

    if (Object.keys(updateData).length > 0) {
        const { error: profileError } = await adminClient
            .from('profiles')
            .update(updateData)
            .eq('id', user.id)

        if (profileError) {
            console.error('Error updating profile:', profileError)
            return { error: 'Erreur lors de la mise à jour du profil.' }
        }
    }

    // 3. Update password and/or phone via Admin API
    const authUpdateData: any = {}
    if (formData.newPassword && formData.newPassword.trim()) {
        authUpdateData.password = formData.newPassword.trim()
    }
    if (normalizedPhone && normalizedPhone !== user.phone) {
        authUpdateData.phone = normalizedPhone
        authUpdateData.phone_confirm = true
    }

    if (Object.keys(authUpdateData).length > 0) {
        const { error: authError } = await adminClient.auth.admin.updateUserById(
            user.id,
            authUpdateData
        )

        if (authError) {
            console.error('Error updating auth:', authError)
            return { error: 'Erreur lors de la mise à jour des informations de connexion.' }
        }
    }

    return { success: true }
}

// ─── Teacher notifications (announcements + events + real notifications) ───────

export async function getTeacherNotifications(teacherId: string, schoolId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const admin = createAdminClient()

    // Get teacher's class IDs for audience matching
    const { data: schedule } = await admin
        .from('schedule')
        .select('class_id')
        .eq('teacher_id', teacherId)
    const classIds = [...new Set((schedule || []).map((s: any) => s.class_id).filter(Boolean))]
    const targetKeys = ['all', 'enseignants', ...classIds.map((id: string) => `cls:${id}`)]

    const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    const since7d  = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000).toISOString()

    const [{ data: realNotifs }, { data: announcements }, { data: events }] = await Promise.all([
        admin
            .from('notifications')
            .select('*')
            .eq('user_id', teacherId)
            .order('created_at', { ascending: false })
            .limit(15),
        admin
            .from('announcements')
            .select('id, title, content, priority, target_audience, created_at')
            .eq('school_id', schoolId)
            .gte('created_at', since14d)
            .order('created_at', { ascending: false })
            .limit(20),
        admin
            .from('events')
            .select('id, title, event_type, start_date, location')
            .eq('school_id', schoolId)
            .overlaps('visibility', ['enseignants', 'all'])
            .gte('start_date', since7d)
            .order('start_date', { ascending: true })
            .limit(10),
    ])

    const annNotifs = (announcements || [])
        .filter((a: any) => {
            let aud: string[] = []
            if (Array.isArray(a.target_audience)) aud = a.target_audience
            else if (typeof a.target_audience === 'string') {
                try { aud = JSON.parse(a.target_audience) } catch { aud = [] }
            }
            return aud.length > 0 ? aud.some((k: string) => targetKeys.includes(k)) : false
        })
        .map((a: any) => ({
            id: `ann_${a.id}`,
            user_id: teacherId,
            title: a.title,
            message: (a.content || '').slice(0, 100),
            type: (a.priority === 'urgent' || a.priority === 'high' ? 'warning' : 'info') as any,
            action_url: `/teacher/community/announcements/${a.id}`,
            is_read: false,
            created_at: a.created_at,
            school_id: schoolId,
            event_type: 'announcement',
        }))

    const evtNotifs = (events || []).map((e: any) => ({
        id: `evt_${e.id}`,
        user_id: teacherId,
        title: e.title,
        message: e.location ? `📍 ${e.location}` : '',
        type: 'action' as any,
        action_url: `/teacher/community`,
        is_read: false,
        created_at: e.start_date,
        school_id: schoolId,
        event_type: 'school_event',
    }))

    // Skip announcements already present as real notifications (avoid duplicates)
    const realEntityIds = new Set((realNotifs || []).map((n: any) => n.entity_id).filter(Boolean))
    const dedupedAnn = annNotifs.filter((n: any) => !realEntityIds.has(n.id.replace('ann_', '')))

    const combined = [...dedupedAnn, ...evtNotifs, ...(realNotifs || [])]
    combined.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return combined.slice(0, 30)
}
