'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'

export interface SchoolCreateData {
    name: string
    slug: string
    email: string
    phone: string
    address: string
    subscriptionPlan: string
    maxStudents: number
    adminPassword?: string
}

/**
 * Secure server action for Super Admins to create a school AND its root administrator account.
 */
export async function createSchoolWithAdmin(data: SchoolCreateData) {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // 1. Authenticate and authorize Super Admin
    const { data: { user }, error: authCheckError } = await supabase.auth.getUser()
    if (authCheckError || !user) {
        return { error: 'Non authentifié' }
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile || profile.role !== 'super_admin') {
        return { error: 'Accès non autorisé. Vous devez être Super Admin.' }
    }

    // 1.5. Normalize and check for existing Phone constraint violation early
    const phoneDigits = data.phone ? data.phone.replace(/[^0-9]/g, '') : ''
    const normalizedPhone = phoneDigits.length > 4 ? `+${phoneDigits}` : null

    if (phoneDigits.length >= 8) {
        const phoneSuffix = phoneDigits.length >= 9 ? phoneDigits.slice(-9) : phoneDigits.slice(-8)

        // A. Check existing school by phone
        const { data: existingSchool } = await adminClient
            .from('schools')
            .select('name')
            .like('phone', `%${phoneSuffix}`)
            .maybeSingle()
        
        if (existingSchool) {
            return { error: `Ce numéro de téléphone est déjà associé à l'école "${existingSchool.name}".` }
        }

        // B. Check existing profile by phone
        const { data: existingProfile } = await adminClient
            .from('profiles')
            .select('role, full_name')
            .like('phone', `%${phoneSuffix}`)
            .maybeSingle()
        
        if (existingProfile) {
            const roleLabels: Record<string, string> = {
                admin: 'Administrateur',
                super_admin: 'Super Admin',
                teacher: 'Enseignant',
                parent: 'Parent',
                student: 'Élève',
                school_staff: 'Personnel administratif'
            }
            const userRole = roleLabels[existingProfile.role] || existingProfile.role
            return { 
                error: `Impossible d'utiliser ce numéro : il appartient déjà à un utilisateur existant de type "${userRole}" nommé "${existingProfile.full_name}".` 
            }
        }
    }

    // 2. Create the School record
    const { data: school, error: schoolError } = await adminClient
        .from('schools')
        .insert({
            name: data.name,
            slug: data.slug,
            email: data.email || null,
            phone: normalizedPhone, // Store fully normalized phone
            address: data.address || null,
            subscription_plan: data.subscriptionPlan,
            max_students: data.maxStudents,
            is_active: true,
        })
        .select('id')
        .single()

    if (schoolError) {
        console.error('School insertion failed:', schoolError)
        return { error: `Échec de création de l'école: ${schoolError.message}` }
    }

    const schoolId = school.id

    // 3. Determine account credentials (using school phone/email by default)

    const password = (data.adminPassword && data.adminPassword.trim()) || '000000'

    // We MUST provide a unique primary identifier (phone OR email) for Auth.
    // Prioritize phone as it's common, fallback to email.
    if (!normalizedPhone && !data.email) {
        // Wait, if no identifiers provided, we created school but can't create admin account!
        // Let's return success but inform that user creation skipped.
        return {
            success: true,
            schoolId,
            warning: 'École créée sans compte administrateur car ni téléphone ni email n\'ont été fournis.'
        }
    }

    // 4. Create Auth user for Admin
    const { data: authUser, error: adminAuthError } = await adminClient.auth.admin.createUser({
        phone: normalizedPhone || undefined,
        email: data.email || undefined,
        password: password,
        phone_confirm: true,
        email_confirm: true,
        user_metadata: {
            full_name: `Admin ${data.name}`,
            role: 'admin',
        }
    })

    if (adminAuthError) {
        console.error('Admin auth account creation failed:', adminAuthError)
        // Note: The school is created, but user creation failed.
        // To be atomic, we COULD roll back (delete school), but usually not necessary.
        // Let's return the schoolId anyway so Super Admin knows school IS created.
        return {
            success: true,
            schoolId,
            warning: `École créée, mais impossible de créer le compte administrateur: ${adminAuthError.message}`
        }
    }

    // 5. Setup user profile linked to the school
    const { error: profileError } = await adminClient
        .from('profiles')
        .upsert({
            id: authUser.user.id,
            full_name: `Admin ${data.name}`,
            phone: normalizedPhone,
            email: data.email || null,
            role: 'admin',
            school_id: schoolId,
            status: 'active',
            first_login: true,
        }, { onConflict: 'id' })

    if (profileError) {
        console.error('Profile setup failed:', profileError)
        // Cleanup partial account creation if desired
        await adminClient.auth.admin.deleteUser(authUser.user.id)
        return {
            success: true,
            schoolId,
            warning: `Erreur lors de la liaison du profil admin: ${profileError.message}`
        }
    }

    revalidatePath('/super-admin/schools')
    revalidatePath('/super-admin/users')

    return { success: true, schoolId }
}

export interface SchoolUpdateData {
    id: string
    name: string
    email: string
    phone: string
    address: string
    subscriptionPlan: string
    maxStudents: number
}

export async function updateSchool(data: SchoolUpdateData) {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // 1. Auth Check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Non authentifié' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile || profile.role !== 'super_admin') {
        return { error: 'Accès non autorisé.' }
    }

    // 2. Update Core School Details
    const phoneDigits = data.phone ? data.phone.replace(/[^0-9]/g, '') : ''
    const normalizedPhone = phoneDigits.length > 4 ? `+${phoneDigits}` : null

    const { error: schoolError } = await adminClient
        .from('schools')
        .update({
            name: data.name,
            email: data.email || null,
            phone: normalizedPhone,
            address: data.address || null,
            subscription_plan: data.subscriptionPlan,
            max_students: data.maxStudents,
        })
        .eq('id', data.id)

    if (schoolError) {
        return { error: `Échec de mise à jour (schools): ${schoolError.message}` }
    }

    // 3. Synchronize with overrides (school_settings) to ensure complete consistency
    const { error: settingsError } = await adminClient
        .from('school_settings')
        .upsert({
            school_id: data.id,
            name: data.name,
            email: data.email || null,
            address: data.address || null,
        }, { onConflict: 'school_id' })

    if (settingsError) {
        console.error('Settings sync failed:', settingsError)
        // Note: We still succeeded on the primary table, don't strictly break operation if this soft-fails
    }

    revalidatePath('/super-admin/schools')
    revalidatePath(`/super-admin/schools/${data.id}`)

    return { success: true }
}

/**
 * Highly secure, multi-phase cascade deletion server action for Super Admins.
 * Clears out all school records in the proper relational order to avoid FK constraint violations,
 * protects multi-school users from being orphaned, and cleans up sole-school auth accounts.
 */
export async function deleteSchoolCascade(schoolId: string) {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // 1. Authenticate and verify Super Admin authority
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Non authentifié' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile || profile.role !== 'super_admin') {
        return { error: 'Accès non autorisé. Vous devez être Super Admin.' }
    }

    try {
        // Phase 0: Aggregate IDs for targeted scoping
        const { data: classesData } = await adminClient.from('classes').select('id').eq('school_id', schoolId)
        const classIds = (classesData || []).map(c => c.id)

        const { data: profilesData } = await adminClient.from('profiles').select('id').eq('school_id', schoolId)
        const profileIds = (profilesData || []).map(p => p.id)

        const { data: postsData } = await adminClient.from('subject_posts').select('id').eq('school_id', schoolId)
        const postIds = (postsData || []).map(p => p.id)

        const { data: schedsData } = await adminClient.from('schedule').select('id').eq('school_id', schoolId)
        const schedIds = (schedsData || []).map(s => s.id)

        const { data: threadsData } = await adminClient.from('message_threads').select('id').eq('school_id', schoolId)
        const threadIds = (threadsData || []).map(t => t.id)

        const { data: hwData } = await adminClient.from('homework').select('id').eq('school_id', schoolId)
        const hwIds = (hwData || []).map(h => h.id)

        const { data: quizData } = await adminClient.from('quizzes').select('id').eq('school_id', schoolId)
        const quizIds = (quizData || []).map(q => q.id)

        // Phase 1: Leaf Sub-Children (Scoped by other child items)
        
        // 1.A. Submissions referencing scoped assignments and target profiles
        if (hwIds.length > 0) {
            await adminClient.from('homework_submissions').delete().in('homework_id', hwIds)
        }
        if (quizIds.length > 0) {
            await adminClient.from('quiz_submissions').delete().in('quiz_id', quizIds)
        }
        if (profileIds.length > 0) {
            // Explicit backups to catch trailing rows referencing student profiles
            await adminClient.from('quiz_submissions').delete().in('student_id', profileIds)
            await adminClient.from('homework_submissions').delete().in('student_id', profileIds)
            
            await adminClient.from('student_documents').delete().in('student_id', profileIds)
            await adminClient.from('student_gamification').delete().in('student_id', profileIds)
            await adminClient.from('parent_student_links').delete().in('student_id', profileIds)
            await adminClient.from('parent_student_links').delete().in('parent_id', profileIds)
        }

        // 1.B. Attachments referencing subject posts
        if (postIds.length > 0) {
            await adminClient.from('subject_post_attachments').delete().in('post_id', postIds)
        }

        // 1.C. Overrides referencing calendar schedules
        if (schedIds.length > 0) {
            await adminClient.from('schedule_overrides').delete().in('schedule_id', schedIds)
        }

        // 1.D. Direct attendance logs
        if (classIds.length > 0) {
            await adminClient.from('attendance').delete().in('class_id', classIds)
        }
        if (profileIds.length > 0) {
            await adminClient.from('attendance').delete().in('student_id', profileIds)
        }

        // 1.E. Messages & Thread participants (links to profiles) within scoped threads
        if (threadIds.length > 0) {
            await adminClient.from('thread_participants').delete().in('thread_id', threadIds)
            await adminClient.from('messages').delete().in('thread_id', threadIds)
        }

        // 1.F. Clean class-specific assignments early as they act as critical linking tables
        // that block subjects and classes from being cleared
        if (classIds.length > 0) {
            await adminClient.from('teacher_assignments').delete().in('class_id', classIds)
        }

        // Phase 2: Deleting tables that directly contain school_id
        // Iterating individually ensures that if a custom or legacy table is missing, the action continues.
        // Subjects and Classes are intentionally positioned at the end to clear all referencing records first.
        const tablesWithSchoolId = [
            'activity_logs',
            'announcements',
            'attendance_periods',
            'audit_logs',
            'bonus_points',
            'class_subjects',
            'contracts',
            'device_tokens',
            'documents',
            'enrollments',
            'events',
            'fee_structures',
            'cycle_fees_config',
            'grades',
            'homework',
            'invitations',
            'levels',
            'message_threads',
            'notifications',
            'payments',
            'payroll',
            'profile_schools', // delete links first to discover user isolation later
            'quizzes',
            'remarks',
            'report_cards',
            'schedule',
            'school_settings',
            'staff_permissions',
            'subject_coefficients',
            'subject_post_comments',
            'subject_posts',
            'teacher_attendance',
            'terms',
            'academic_years',
            'transactions', // Links profiles
            'subjects',     // Contains FKs cleared above
            'classes'       // Contains FKs cleared above
        ]

        for (const tbl of tablesWithSchoolId) {
            try {
                // Note: Supabase returns { error } rather than throwing on SQL violations, 
                // so we log explicitly to diagnose issues
                const { error: deleteErr } = await adminClient.from(tbl).delete().eq('school_id', schoolId)
                if (deleteErr) {
                    console.warn(`Graceful skip on table deletion [${tbl}]: ${deleteErr.message}`)
                }
            } catch (err: any) {
                console.warn(`Unexpected failure trying to clear table [${tbl}]:`, err.message)
            }
        }

        // Phase 3: User Separation and Auth Deletion
        // Distinguish between multi-school users (who we just unlink) and sole-school users (who we delete completely)
        const soleSchoolUserIds: string[] = []
        const multiSchoolUserIds: string[] = []

        for (const pId of profileIds) {
            if (pId === user.id) continue // Never self-delete

            // Check if any remaining links exist in other schools
            const { data: otherLinks } = await adminClient
                .from('profile_schools')
                .select('school_id')
                .eq('profile_id', pId)

            if (otherLinks && otherLinks.length > 0) {
                multiSchoolUserIds.push(pId)
            } else {
                soleSchoolUserIds.push(pId)
            }
        }

        // A. Migrate multi-school users: update their default fallback school
        if (multiSchoolUserIds.length > 0) {
            for (const pId of multiSchoolUserIds) {
                const { data: remaining } = await adminClient
                    .from('profile_schools')
                    .select('school_id')
                    .eq('profile_id', pId)
                    .limit(1)
                
                const nextSchoolId = remaining?.[0]?.school_id || null
                await adminClient.from('profiles').update({ school_id: nextSchoolId }).eq('id', pId)
            }
        }

        // B. Obliterate sole-school users entirely
        if (soleSchoolUserIds.length > 0) {
            // Delete profiles first to avoid blockages
            const { error: profDelErr } = await adminClient.from('profiles').delete().in('id', soleSchoolUserIds)
            if (profDelErr) {
                console.error('Failed to delete sole-school profiles:', profDelErr.message)
                throw new Error(`Impossible de nettoyer les profils utilisateurs : ${profDelErr.message}`)
            }
            
            // Delete Auth core records
            for (const pId of soleSchoolUserIds) {
                try {
                    const { error: authDelErr } = await adminClient.auth.admin.deleteUser(pId)
                    if (authDelErr) {
                        console.error(`Auth deletion failed for user ${pId}:`, authDelErr.message)
                    }
                } catch (err) {
                    console.error(`Could not delete auth user ${pId}:`, err)
                }
            }
        }

        // Phase 4: Delete the parent school row
        const { error: finalDeleteError } = await adminClient
            .from('schools')
            .delete()
            .eq('id', schoolId)

        if (finalDeleteError) {
            throw new Error(`Impossible de supprimer l'entité école : ${finalDeleteError.message}`)
        }

        revalidatePath('/super-admin/schools')
        return { success: true }

    } catch (err: any) {
        console.error('Error executing cascade deletion:', err)
        return { error: err.message || 'Échec de la suppression en cascade' }
    }
}

export async function updateSchoolAdminPassword(schoolId: string, newPassword: string) {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // 1. Authenticate and authorize Super Admin
    const { data: { user }, error: authCheckError } = await supabase.auth.getUser()
    if (authCheckError || !user) {
        return { error: 'Non authentifié' }
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile || profile.role !== 'super_admin') {
        return { error: 'Accès non autorisé. Vous devez être Super Admin.' }
    }

    if (!newPassword || !/^\d{6}$/.test(newPassword.trim())) {
        return { error: 'Le mot de passe doit être exactement 6 chiffres' }
    }

    // 2. Find the admin of this school
    const { data: adminProfile, error: adminProfileError } = await adminClient
        .from('profiles')
        .select('id, full_name, email')
        .eq('school_id', schoolId)
        .eq('role', 'admin')
        .maybeSingle()

    if (adminProfileError || !adminProfile) {
        return { error: 'Impossible de trouver le compte administrateur associé à cette école.' }
    }

    // 3. Update password in auth via admin client
    const { error: updateError } = await adminClient.auth.admin.updateUserById(adminProfile.id, {
        password: newPassword.trim()
    })

    if (updateError) {
        console.error('School Admin Password update failed:', updateError)
        return { error: `Échec de mise à jour du mot de passe de l'admin: ${updateError.message}` }
    }

    return { success: true, adminName: adminProfile.full_name, adminEmail: adminProfile.email }
}

