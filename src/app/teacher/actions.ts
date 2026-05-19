'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

/**
 * Fetches the schedule for a teacher on a given day, bypassing RLS,
 * aggregating data across ALL assigned schools.
 */
export async function getTeacherScheduleAction(teacherId: string, dayOfWeek: number) {
    if (!teacherId) throw new Error("teacherId is required")

    const admin = createAdminClient()
    
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

    return data || []
}

/**
 * Fetches all assignments (classes and subjects) for a teacher,
 * bypassing RLS to aggregate data including school names across all assigned schools.
 */
export async function getTeacherAssignmentsAction(teacherId: string) {
    if (!teacherId) throw new Error("teacherId is required")

    const admin = createAdminClient()
    
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

    const admin = createAdminClient()

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
    const admin = createAdminClient()

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
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Non authentifié' }

    const adminClient = createAdminClient()

    // 1. Update profiles table
    const updateData: any = {}
    if (formData.fullName) updateData.full_name = formData.fullName
    if (formData.avatarUrl !== undefined) updateData.avatar_url = formData.avatarUrl

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

    // 2. Update password via Admin API if newPassword is provided
    if (formData.newPassword && formData.newPassword.trim()) {
        const { error: passError } = await adminClient.auth.admin.updateUserById(
            user.id,
            { password: formData.newPassword.trim() }
        )

        if (passError) {
            console.error('Error updating password:', passError)
            return { error: 'Erreur lors du changement de mot de passe.' }
        }
    }

    return { success: true }
}
