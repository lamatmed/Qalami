'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { LoginSchema, InvitationSchema, CompleteRegistrationSchema } from './schemas'
import { z } from 'zod'

export async function login(formData: z.infer<typeof LoginSchema>) {
    const supabase = await createClient()

    // Normalize phone number (strip spaces, dashes, etc.)
    const normalizedPhone = formData.phone.replace(/[\s\-()]/g, '')
    // Ensure phone starts with +
    const phone = normalizedPhone.startsWith('+') ? normalizedPhone : `+${normalizedPhone}`

    const { error } = await supabase.auth.signInWithPassword({
        phone,
        password: formData.password,
    })

    if (error) {
        console.error('[Login] Error:', error.message)
        if (error.message.includes('Invalid login credentials')) {
            return { error: 'Numéro de téléphone ou code PIN incorrect' }
        }
        return { error: 'Code PIN incorrect' }
    }

    revalidatePath('/', 'layout')
    redirect('/')
}

export async function signout() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    revalidatePath('/', 'layout')
    redirect('/login')
}

export async function createInvitation(formData: z.infer<typeof InvitationSchema>) {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // Get current user and verify they are admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { error: 'Non authentifié' }
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, school_id')
        .eq('id', user.id)
        .single()

    if (!profile || !['admin', 'super_admin', 'school_staff'].includes(profile.role)) {
        return { error: 'Accès non autorisé' }
    }

    if (!profile.school_id) {
        return { error: 'Aucune école associée' }
    }

    // Normalize phone number for auth
    const normalizedPhone = formData.phone
        ? (formData.phone.startsWith('+') ? formData.phone : `+${formData.phone.replace(/[^0-9]/g, '')}`)
        : null

    // Generate a temporary random password (user will set their PIN later)
    const tempPassword = crypto.randomUUID().slice(0, 12)

    // Create the auth user via admin API with phone as primary identifier
    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
        phone: normalizedPhone || undefined,
        password: tempPassword,
        phone_confirm: true,
        user_metadata: {
            full_name: formData.fullName,
            role: formData.role,
        },
    })

    if (authError) {
        if (authError.message.includes('already been registered')) {
            return { error: 'Ce numéro est déjà utilisé' }
        }
        return { error: authError.message }
    }

    // Create the profile for the new user
    const { error: profileError } = await adminClient
        .from('profiles')
        .upsert({
            id: authUser.user.id,
            email: formData.email || null,
            full_name: formData.fullName,
            role: formData.role,
            school_id: profile.school_id,
            phone: normalizedPhone,
        })

    if (profileError) {
        console.error('Profile creation error:', profileError)
    }

    // Create the invitation record
    const { data: invitation, error: inviteError } = await adminClient
        .from('invitations')
        .insert({
            school_id: profile.school_id,
            email: formData.email || null,
            full_name: formData.fullName,
            role: formData.role,
            phone: normalizedPhone,
            created_by: user.id,
            auth_user_id: authUser.user.id,
        })
        .select('token')
        .single()

    if (inviteError) {
        return { error: 'Erreur lors de la création de l\'invitation: ' + inviteError.message }
    }

    return { success: true, token: invitation.token }
}

export async function getInvitationByToken(token: string) {
    const adminClient = createAdminClient()

    const { data: invitation, error } = await adminClient
        .from('invitations')
        .select('*, schools(name)')
        .eq('token', token)
        .single()

    if (error || !invitation) {
        return { error: 'Invitation introuvable' }
    }

    if (invitation.status === 'completed') {
        return { error: 'Cette invitation a déjà été utilisée' }
    }

    if (invitation.status === 'expired' || new Date(invitation.expires_at) < new Date()) {
        return { error: 'Cette invitation a expiré' }
    }

    return {
        invitation: {
            fullName: invitation.full_name,
            email: invitation.email,
            role: invitation.role,
            schoolName: (invitation.schools as any)?.name || 'École',
        }
    }
}

export async function completeRegistration(formData: z.infer<typeof CompleteRegistrationSchema>) {
    const adminClient = createAdminClient()

    // Fetch the invitation
    const { data: invitation, error: fetchError } = await adminClient
        .from('invitations')
        .select('*')
        .eq('token', formData.token)
        .single()

    if (fetchError || !invitation) {
        return { error: 'Invitation introuvable' }
    }

    if (invitation.status === 'completed') {
        return { error: 'Cette invitation a déjà été utilisée' }
    }

    if (invitation.status === 'expired' || new Date(invitation.expires_at) < new Date()) {
        return { error: 'Cette invitation a expiré' }
    }

    if (!invitation.auth_user_id) {
        return { error: 'Erreur d\'invitation: utilisateur non trouvé' }
    }

    // Update the user's password
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
        invitation.auth_user_id,
        { password: formData.pin }
    )

    if (updateError) {
        return { error: 'Erreur lors de la mise à jour du mot de passe: ' + updateError.message }
    }

    // Mark invitation as completed
    await adminClient
        .from('invitations')
        .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
        })
        .eq('id', invitation.id)

    return { success: true }
}

export async function getInvitations() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Non authentifié' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('school_id, role')
        .eq('id', user.id)
        .single()

    if (!profile) return { error: 'Profil introuvable' }

    let query = supabase
        .from('invitations')
        .select('*')
        .order('created_at', { ascending: false })

    // Super admins see all invitations; regular admins see only their school's
    if (profile.role !== 'super_admin' && profile.school_id) {
        query = query.eq('school_id', profile.school_id)
    }

    const { data: invitations, error } = await query

    if (error) {
        return { error: error.message }
    }

    return { invitations }
}

export async function createParent(formData: {
    firstName: string
    lastName: string
    phone?: string
    email?: string
    password?: string
}) {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // Verify current user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { error: 'Non authentifié' }
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, school_id')
        .eq('id', user.id)
        .single()

    if (!profile || !['admin', 'super_admin', 'school_staff'].includes(profile.role)) {
        return { error: 'Accès non autorisé' }
    }

    if (!profile.school_id) {
        return { error: 'Aucune école associée' }
    }

    const fullName = `${formData.firstName} ${formData.lastName}`

    // Normalize phone number
    const normalizedPhone = formData.phone
        ? (formData.phone.startsWith('+') ? formData.phone : `+${formData.phone.replace(/[^0-9]/g, '')}`)
        : null

    if (!formData.password?.trim()) {
        return { error: 'Le mot de passe instantané est obligatoire' }
    }
    const plainPassword = formData.password.trim()

    // Create auth user via admin API — does NOT affect current session
    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
        phone: normalizedPhone || undefined,
        email: formData.email || undefined,
        password: plainPassword,
        phone_confirm: true,
        email_confirm: true,
        user_metadata: {
            full_name: fullName,
            role: 'parent',
        },
    })

    if (authError) {
        if (authError.message.includes('already been registered')) {
            return { error: 'Ce numéro ou email est déjà utilisé' }
        }
        return { error: authError.message }
    }

    // Create/update the profile
    const { error: profileError } = await adminClient
        .from('profiles')
        .upsert({
            id: authUser.user.id,
            email: formData.email || null,
            full_name: fullName,
            role: 'parent',
            school_id: profile.school_id,
            phone: normalizedPhone,
        })

    if (profileError) {
        console.error('Profile creation error:', profileError)
        return { error: 'Erreur lors de la création du profil: ' + profileError.message }
    }

    return {
        success: true,
        credentials: {
            phone: normalizedPhone,
            email: formData.email,
            password: plainPassword,
            fullName
        }
    }
}

export async function createStudent(formData: {
    personal: {
        firstName: string
        lastName: string
        dateOfBirth: string
        gender: string
        placeOfBirth: string
        nationalId?: string
        address?: string
    }
    hasPhone: boolean
    phone?: string
    password?: string
    parentIds: string[]
    academic: {
        level: string
        className: string
        academicYear?: string
        registrationFee: number
        tuitionFee: number
        isPaid: boolean
    }
}) {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // Verify current user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Non authentifié' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, school_id')
        .eq('id', user.id)
        .single()

    if (!profile || !['admin', 'super_admin', 'school_staff'].includes(profile.role)) {
        return { error: 'Accès non autorisé' }
    }
    if (!profile.school_id) return { error: 'Aucune école associée' }

    const fullName = `${formData.personal.firstName} ${formData.personal.lastName}`

    // Validate phone & password only if student has phone
    if (formData.hasPhone) {
        if (!formData.phone?.trim()) return { error: 'Le numéro de téléphone est obligatoire' }
        if (!formData.password?.trim()) return { error: 'Le mot de passe instantané est obligatoire' }
    }

    const plainPassword = formData.hasPhone ? formData.password!.trim() : crypto.randomUUID()
    const normalizedPhone = formData.hasPhone && formData.phone
        ? (formData.phone.startsWith('+') ? formData.phone : `+${formData.phone.replace(/[^0-9]/g, '')}`)
        : null

    // 1. Create the student auth user
    const studentEmail = `student_${Date.now()}@qalami.local`
    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
        email: studentEmail,
        ...(normalizedPhone ? { phone: normalizedPhone, phone_confirm: true } : {}),
        password: plainPassword,
        email_confirm: true,
        user_metadata: {
            full_name: fullName,
            role: 'student',
        },
    })

    if (authError) return { error: authError.message }

    // 2. Upsert the student profile
    const { error: profileError } = await adminClient
        .from('profiles')
        .upsert({
            id: authUser.user.id,
            email: studentEmail,
            full_name: fullName,
            role: 'student',
            school_id: profile.school_id,
            phone: normalizedPhone,
            date_of_birth: formData.personal.dateOfBirth || null,
            gender: formData.personal.gender || null,
            place_of_birth: formData.personal.placeOfBirth || null,
            national_id: formData.personal.nationalId || null,
            address: formData.personal.address || null,
        })

    if (profileError) {
        console.error('Profile error:', profileError)
        return { error: 'Erreur profil: ' + profileError.message }
    }

    // Resolve academic year name → UUID (shared for enrollment + payment)
    let academicYearId: string | null = null
    if (formData.academic.academicYear) {
        const { data: yearData } = await adminClient
            .from('academic_years')
            .select('id')
            .eq('school_id', profile.school_id)
            .eq('name', formData.academic.academicYear)
            .single()
        academicYearId = yearData?.id ?? null
    }

    // 3. Find the class and create enrollment
    if (formData.academic.className) {
        const { data: classData } = await adminClient
            .from('classes')
            .select('id')
            .eq('school_id', profile.school_id)
            .eq('name', formData.academic.className)
            .single()

        if (classData) {
            await adminClient.from('enrollments').insert({
                student_id: authUser.user.id,
                class_id: classData.id,
                academic_year_id: academicYearId,
                school_id: profile.school_id,
                status: 'active',
            })
        }
    }

    // 4. Link existing parents to the student
    for (let i = 0; i < formData.parentIds.length; i++) {
        const parentId = formData.parentIds[i]
        const { error: linkError } = await adminClient.from('parent_student_links').insert({
            parent_id: parentId,
            student_id: authUser.user.id,
            relationship: 'parent',
            is_primary: i === 0,
        })
        if (linkError) {
            console.error('Parent link error:', linkError)
        }
    }

    // 5. Record payment if marked as paid
    if (formData.academic.isPaid && formData.academic.registrationFee > 0) {
        await adminClient.from('payments').insert({
            student_id: authUser.user.id,
            school_id: profile.school_id,
            amount: formData.academic.registrationFee,
            amount_paid: formData.academic.registrationFee,
            payment_type: 'inscription',
            status: 'paid',
            paid_at: new Date().toISOString(),
            academic_year_id: academicYearId,
        })
    }

    return {
        success: true,
        studentId: authUser.user.id,
        credentials: {
            fullName,
            hasPhone: formData.hasPhone,
            password: formData.hasPhone ? plainPassword : null,
            className: formData.academic.className
        }
    }
}

export async function updateProfileStatus(formData: {
    userId: string
    status: 'active' | 'suspended' | 'inactive' | 'archived'
    reason: string
}) {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // Vérifier que l'utilisateur actuel est admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Non authentifié' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, school_id')
        .eq('id', user.id)
        .single()

    if (!profile || !['admin', 'super_admin', 'school_staff'].includes(profile.role)) {
        return { error: 'Accès non autorisé' }
    }

    // Vérifier que le profil cible appartient à la même école (sauf super_admin)
    if (profile.role === 'admin' || profile.role === 'school_staff') {
        const { data: target } = await adminClient
            .from('profiles')
            .select('school_id')
            .eq('id', formData.userId)
            .single()

        if (!target || target.school_id !== profile.school_id) {
            return { error: 'Accès non autorisé' }
        }
    }

    // Utiliser adminClient pour bypasser RLS
    const { error } = await adminClient
        .from('profiles')
        .update({
            status: formData.status,
            status_reason: formData.reason,
            status_changed_at: new Date().toISOString(),
        })
        .eq('id', formData.userId)

    if (error) return { error: error.message }

    revalidatePath('/admin/students')
    revalidatePath('/admin/teachers')
    revalidatePath('/admin/parents')
    return { success: true }
}

export async function updateEnrollmentStatus(formData: {
    enrollmentId: string
    status: 'active' | 'transferred' | 'withdrawn' | 'completed' | 'suspended'
    reason?: string
}) {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Non authentifié' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, school_id')
        .eq('id', user.id)
        .single()

    if (!profile || !['admin', 'super_admin', 'school_staff'].includes(profile.role)) {
        return { error: 'Accès non autorisé' }
    }

    let query = adminClient
        .from('enrollments')
        .update({ status: formData.status })
        .eq('id', formData.enrollmentId)

    // Regular admins and staff can only update enrollments in their school
    if ((profile.role === 'admin' || profile.role === 'school_staff') && profile.school_id) {
        query = query.eq('school_id', profile.school_id)
    }

    const { error } = await query

    if (error) return { error: error.message }

    revalidatePath('/admin/students')
    return { success: true }
}

export async function createTeacher(formData: {
    fullName: string
    phone?: string
    email?: string
    nni?: string
    password?: string
}) {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Non authentifié' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, school_id')
        .eq('id', user.id)
        .single()

    if (!profile || !['admin', 'super_admin', 'school_staff'].includes(profile.role)) {
        return { error: 'Accès non autorisé' }
    }

    if (!profile.school_id) return { error: 'Aucune école associée' }

    const normalizedPhone = formData.phone
        ? (formData.phone.startsWith('+') ? formData.phone : `+${formData.phone.replace(/[^0-9]/g, '')}`)
        : null

    if (!formData.password?.trim()) {
        return { error: 'Le mot de passe instantané est obligatoire' }
    }
    const plainPassword = formData.password.trim()

    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
        phone: normalizedPhone || undefined,
        email: formData.email || undefined,
        password: plainPassword,
        phone_confirm: true,
        email_confirm: true,
        user_metadata: {
            full_name: formData.fullName,
            role: 'teacher',
        },
    })

    if (authError) {
        if (authError.message.includes('already been registered')) {
            return { error: 'Ce numéro ou email est déjà utilisé' }
        }
        return { error: authError.message }
    }

    const { error: profileError } = await adminClient
        .from('profiles')
        .upsert({
            id: authUser.user.id,
            email: formData.email || null,
            full_name: formData.fullName,
            role: 'teacher',
            school_id: profile.school_id,
            phone: normalizedPhone,
            national_id: formData.nni || null,
        })

    if (profileError) {
        return { error: 'Erreur lors de la création du profil: ' + profileError.message }
    }

    revalidatePath('/admin/teachers')
    return {
        success: true,
        credentials: {
            fullName: formData.fullName,
            phone: normalizedPhone,
            email: formData.email,
            password: plainPassword,
        }
    }
}
