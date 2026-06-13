'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { logActivity } from '@/lib/activity-log'
import { getActionContext } from '@/lib/auth-action'

export async function getFeeStructuresAction() {
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
    const schoolId = profile.school_id

    const { data: year } = await admin
        .from('academic_years')
        .select('id, name')
        .eq('school_id', schoolId)
        .eq('is_current', true)
        .maybeSingle()

    if (!year) return { schoolId, year: null, cycleFees: [], feeStructures: [] }

    const { data: cycleFees } = await admin
        .from('cycle_fees_config')
        .select('cycle, default_registration_fee, default_monthly_tuition')
        .eq('school_id', schoolId)
        .eq('academic_year_id', year.id)

    const { data: feeStructures } = await admin
        .from('fee_structures')
        .select('fee_type, amount, frequency, due_day')
        .eq('school_id', schoolId)
        .eq('academic_year_id', year.id)
        .eq('is_active', true)

    return {
        schoolId,
        year,
        cycleFees: cycleFees ?? [],
        feeStructures: feeStructures ?? [],
    }
}

export async function deleteStaffMember(profileId: string) {
    if (!profileId) return { error: 'ID profil manquant' }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Non authentifié' }

    const { data: callerProfile } = await supabase
        .from('profiles')
        .select('school_id, role')
        .eq('id', user.id)
        .single()

    if (!callerProfile?.school_id) return { error: 'École introuvable' }

    const admin = createAdminClient()

    const { data: staffProfile } = await admin
        .from('profiles')
        .select('id, school_id, full_name')
        .eq('id', profileId)
        .single()

    if (!staffProfile) return { error: 'Staff introuvable' }
    if (staffProfile.school_id !== callerProfile.school_id) return { error: 'Permission refusée' }

    // 1. Nullify FK on transactions to avoid constraint error
    await admin.from('transactions').update({ related_profile_id: null }).eq('related_profile_id', profileId)

    // 2. Delete payroll records
    await admin.from('payroll').delete().eq('employee_id', profileId)

    // 3. Delete contracts
    await admin.from('contracts').delete().eq('employee_id', profileId)

    // 4. Delete profile_schools links
    await admin.from('profile_schools').delete().eq('profile_id', profileId)

    // 5. Delete teacher_attendance records
    await (admin.from as any)('teacher_attendance').delete().eq('teacher_id', profileId)

    // 6. Delete auth user (cascades to profile row)
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(profileId)
    if (authDeleteError) {
        // Fallback: delete profile directly
        await admin.from('profiles').delete().eq('id', profileId)
    }

    logActivity({
        actorId: user.id,
        schoolId: callerProfile.school_id,
        action: 'delete_personnel',
        entityType: 'profile',
        entityId: profileId,
        details: `Suppression du personnel: ${staffProfile.full_name}`,
    })

    return { error: null }
}

export async function updateStaffMemberAction(profileId: string, payload: {
    name: string
    role: string
    phone: string
    nni: string
    salary: number
    contractType: 'CDI' | 'CDD' | 'hourly'
}) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const admin = createAdminClient()

    // Verify this staff belongs to the caller's school
    const { data: staffProfile } = await admin.from('profiles').select('school_id').eq('id', profileId).single()
    if (!staffProfile || staffProfile.school_id !== ctx.schoolId) return { error: 'Permission refusée' }

    // Update profile
    const { error: profileError } = await admin.from('profiles').update({
        full_name: payload.name.trim(),
        phone: payload.phone.trim() || null,
        national_id: payload.nni.trim() || null,
        updated_at: new Date().toISOString(),
    }).eq('id', profileId)
    if (profileError) return { error: profileError.message }

    // Upsert active contract — create if missing, update if exists
    const { data: contract } = await admin
        .from('contracts')
        .select('id')
        .eq('employee_id', profileId)
        .eq('status', 'active')
        .maybeSingle()

    if (contract) {
        const { error: contractError } = await admin.from('contracts').update({
            position: payload.role,
            monthly_salary: payload.salary,
            contract_type: payload.contractType,
        }).eq('id', contract.id)
        if (contractError) return { error: contractError.message }
    } else {
        // No contract yet — create one so salary and role are persisted
        const { error: contractError } = await admin.from('contracts').insert({
            school_id: ctx.schoolId,
            employee_id: profileId,
            position: payload.role,
            monthly_salary: payload.salary,
            contract_type: payload.contractType,
            start_date: new Date().toISOString().split('T')[0],
            status: 'active',
        })
        if (contractError) return { error: contractError.message }
    }

    return { success: true }
}

export async function getStaffAction() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Non authentifié', staff: [] }

    const { data: me } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('id', user.id)
        .single()

    if (!me?.school_id) return { error: 'École introuvable', staff: [] }

    const admin = createAdminClient()

    const { data, error } = await admin
        .from('profiles')
        .select('id, full_name, phone, status, national_id, contracts(position, monthly_salary, contract_type, status)')
        .eq('school_id', me.school_id)
        .eq('role', 'school_staff')
        .order('full_name', { ascending: true })

    if (error) return { error: error.message, staff: [] }

    const staff = (data || []).map(p => {
        const contract = Array.isArray(p.contracts) && p.contracts.length > 0
            ? p.contracts.find((c: any) => c.status === 'active') || p.contracts[0]
            : null
        return {
            id: p.id,
            name: p.full_name || 'Non défini',
            role: (contract as any)?.position || 'Staff',
            phone: p.phone || null,
            nni: p.national_id || null,
            salary: Number((contract as any)?.monthly_salary) || 0,
            contractType: (contract as any)?.contract_type || 'CDI',
            status: p.status === 'active' ? 'Active' : (p.status || 'Active'),
        }
    })

    // Preload current-month unjustified absence counts for all staff
    const staffIds = staff.map(s => s.id)
    const unjustifiedCountMap: Record<string, number> = {}
    if (staffIds.length > 0) {
        const now = new Date()
        const month = now.getMonth() + 1
        const year = now.getFullYear()
        const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
        const monthEnd = new Date(year, month, 0).toISOString().split('T')[0]

        const { data: absRows } = await admin
            .from('teacher_attendance')
            .select('teacher_id')
            .in('teacher_id', staffIds)
            .eq('justified', false)
            .eq('status', 'absent')
            .gte('date', monthStart)
            .lte('date', monthEnd)

        for (const row of absRows ?? []) {
            unjustifiedCountMap[(row as any).teacher_id] = (unjustifiedCountMap[(row as any).teacher_id] || 0) + 1
        }
    }

    return { staff, unjustifiedCountMap, error: null }
}

export async function addStaffMemberAction(payload: {
    name: string
    role: string
    phone: string
    nni: string
    salary: number
    contractType: 'CDI' | 'CDD' | 'hourly'
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Non authentifié' }

    const { data: me } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('id', user.id)
        .single()

    if (!me?.school_id) return { error: 'École introuvable' }

    const admin = createAdminClient()

    // profiles.id is a FK to auth.users.id — must create an auth user first
    const tempEmail = `staff-${Date.now()}@noreply.${me.school_id.slice(0, 8)}.internal`
    const tempPassword = crypto.randomUUID()

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email: tempEmail,
        password: tempPassword,
        email_confirm: true,
    })

    if (authError || !authData?.user) {
        return { error: `Erreur création compte: ${authError?.message}` }
    }

    // Supabase trigger auto-creates a profile row on auth user creation — update it
    const { data: newProfile, error: profileError } = await admin
        .from('profiles')
        .update({
            full_name: payload.name,
            phone: payload.phone || null,
            national_id: payload.nni || null,
            role: 'school_staff',
            school_id: me.school_id,
            status: 'active',
        })
        .eq('id', authData.user.id)
        .select('id')
        .single()

    if (profileError) {
        await admin.auth.admin.deleteUser(authData.user.id)
        return { error: profileError.message }
    }

    const { error: contractError } = await admin
        .from('contracts')
        .insert({
            school_id: me.school_id,
            employee_id: newProfile.id,
            contract_type: payload.contractType,
            position: payload.role,
            monthly_salary: payload.salary,
            start_date: new Date().toISOString().split('T')[0],
            status: 'active',
        })

    if (contractError) return { error: contractError.message }

    logActivity({
        actorId: user.id,
        schoolId: me.school_id,
        action: 'add_personnel',
        entityType: 'profile',
        entityId: newProfile.id,
        details: `Ajout du personnel: ${payload.name} — ${payload.role} (${payload.contractType})`,
    })

    return {
        error: null,
        member: {
            id: newProfile.id,
            name: payload.name,
            role: payload.role,
            phone: payload.phone || null,
            nni: payload.nni || null,
            salary: payload.salary,
            contractType: payload.contractType,
            status: 'Active',
        }
    }
}

export async function saveFeeStructuresAction(payload: {
    schoolId: string
    academicYearId: string
    cycles: {
        cycle: string
        default_registration_fee: number
        default_monthly_tuition: number
    }[]
    activeFees: {
        fee_type: string
        name: string
        amount: number
        frequency: string
        due_day: number
    }[]
    disabledFeeTypes: string[]
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Non authentifié' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('school_id, role')
        .eq('id', user.id)
        .single()

    if (!profile?.school_id || profile.school_id !== payload.schoolId) {
        return { error: 'Accès non autorisé' }
    }

    const admin = createAdminClient()

    // 1. Upsert cycle fees (has unique constraint on school_id, academic_year_id, cycle)
    if (payload.cycles.length > 0) {
        const { error } = await admin
            .from('cycle_fees_config')
            .upsert(
                payload.cycles.map(c => ({
                    school_id: payload.schoolId,
                    academic_year_id: payload.academicYearId,
                    cycle: c.cycle,
                    default_registration_fee: c.default_registration_fee,
                    default_monthly_tuition: c.default_monthly_tuition,
                })),
                { onConflict: 'school_id,academic_year_id,cycle' }
            )
        if (error) {
            console.error('[saveFees] cycle_fees_config error:', error)
            return { error: error.message }
        }
    }

    // 2. fee_structures has no unique constraint on (school_id, academic_year_id, fee_type)
    //    so we delete then insert to avoid upsert conflict issues
    const allFeeTypes = [...payload.activeFees.map(f => f.fee_type), ...payload.disabledFeeTypes]
    if (allFeeTypes.length > 0) {
        await admin
            .from('fee_structures')
            .delete()
            .eq('school_id', payload.schoolId)
            .eq('academic_year_id', payload.academicYearId)
            .in('fee_type', allFeeTypes)
    }

    if (payload.activeFees.length > 0) {
        const { error } = await admin
            .from('fee_structures')
            .insert(
                payload.activeFees.map(f => ({
                    school_id: payload.schoolId,
                    academic_year_id: payload.academicYearId,
                    name: f.name,
                    fee_type: f.fee_type,
                    amount: f.amount,
                    frequency: f.frequency,
                    due_day: f.due_day,
                    is_active: true,
                }))
            )
        if (error) {
            console.error('[saveFees] fee_structures error:', error)
            return { error: error.message }
        }
    }

    logActivity({
        actorId: user.id,
        schoolId: payload.schoolId,
        action: 'save_fees',
        entityType: 'fee_structures',
        entityId: payload.academicYearId,
        details: `Structures tarifaires enregistrées pour l'année ${payload.academicYearId} (${payload.activeFees.length} frais actifs)`,
    })

    return { success: true }
}

export async function updateCurrentUserPassword(newPassword: string) {
    if (!newPassword || !/^\d{6}$/.test(newPassword.trim())) {
        return { error: 'Le mot de passe doit être exactement 6 chiffres' }
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Non authentifié' }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    
    if (error) {
        return { error: error.message }
    }
    
    return { success: true }
}

export async function updateSchoolIdentityAction(data: {
    school_id: string
    name: string
    slogan: string
    address: string
    email: string
    logo_url?: string
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Non authentifié' }

    // Verify ownership of this school
    const { data: profile } = await supabase
        .from('profiles')
        .select('school_id, role')
        .eq('id', user.id)
        .single()

    if (!profile || profile.school_id !== data.school_id) {
        return { error: 'Accès non autorisé pour cette école.' }
    }
    
    // Restrict to admins only
    if (profile.role !== 'admin' && profile.role !== 'super_admin') {
        return { error: 'Permission de modification refusée.' }
    }

    const admin = createAdminClient()

    // 1. Update Core Schools table (Ensures global super-admin views are synced)
    const { error: coreError } = await admin
        .from('schools')
        .update({
            name: data.name,
            email: data.email,
            address: data.address,
            logo_url: data.logo_url || null
        })
        .eq('id', data.school_id)

    if (coreError) {
        console.error('Failed to update core schools:', coreError)
        return { error: `Erreur table schools: ${coreError.message}` }
    }

    // 2. Upsert School Settings overrides table
    const { error: settingsError } = await admin
        .from('school_settings')
        .upsert({
            school_id: data.school_id,
            name: data.name,
            slogan: data.slogan,
            address: data.address,
            email: data.email,
            logo_url: data.logo_url
        }, { onConflict: 'school_id' })

    if (settingsError) {
        console.error('Failed to update school_settings:', settingsError)
        return { error: `Erreur table school_settings: ${settingsError.message}` }
    }

    logActivity({
        actorId: user.id,
        schoolId: data.school_id,
        action: 'update_school',
        entityType: 'school',
        entityId: data.school_id,
        details: `Identité école mise à jour: ${data.name}`,
    })

    return { success: true }
}

export async function updateDefaultGradingScaleAction(scale: number) {
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
        .from('school_settings')
        .update({ default_grading_scale: scale })
        .eq('school_id', profile.school_id)

    if (error) return { error: error.message }
    return { success: true }
}

// ── Staff absences ────────────────────────────────────────────────────────────

export async function getStaffAbsencesAction(staffId: string, month: number, year: number) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié', absences: [] }
    const admin = createAdminClient()

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]

    const { data, error } = await (admin.from as any)('teacher_attendance')
        .select('id, date, justified, justification_note')
        .eq('teacher_id', staffId)
        .eq('school_id', ctx.schoolId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })

    if (error) return { error: error.message, absences: [] }
    return { absences: (data || []) as { id: string; date: string; justified: boolean; justification_note: string | null }[], error: null }
}

export async function addStaffAbsenceAction(data: {
    staffId: string
    date: string
    justified: boolean
    note?: string | null
}) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const admin = createAdminClient()

    const { error } = await (admin.from as any)('teacher_attendance').insert({
        teacher_id: data.staffId,
        school_id: ctx.schoolId,
        date: data.date,
        status: 'absent',
        justified: data.justified,
        justification_note: data.note || null,
        made_up: false,
        recorded_by: ctx.userId,
    })

    if (error) return { error: error.message }
    return { success: true }
}

export async function deleteStaffAbsenceAction(id: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const admin = createAdminClient()
    const { error } = await (admin.from as any)('teacher_attendance').delete().eq('id', id)
    if (error) return { error: error.message }
    return { success: true }
}
