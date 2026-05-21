'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

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
    console.log('[deleteStaff] START profileId:', profileId)

    if (!profileId) return { error: 'ID profil manquant' }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    console.log('[deleteStaff] auth user:', user?.id, 'authError:', authError?.message)
    if (!user) return { error: 'Non authentifié' }

    const { data: callerProfile, error: callerError } = await supabase
        .from('profiles')
        .select('school_id, role')
        .eq('id', user.id)
        .single()
    console.log('[deleteStaff] callerProfile:', callerProfile, 'callerError:', callerError?.message)

    if (!callerProfile?.school_id) return { error: 'École introuvable' }

    const admin = createAdminClient()

    const { data: staffProfile, error: staffError } = await admin
        .from('profiles')
        .select('id, school_id, role, full_name')
        .eq('id', profileId)
        .single()
    console.log('[deleteStaff] staffProfile:', staffProfile, 'staffError:', staffError?.message)

    if (!staffProfile) return { error: `Staff introuvable: ${staffError?.message}` }

    if (staffProfile.school_id !== callerProfile.school_id) {
        console.log('[deleteStaff] school mismatch:', staffProfile.school_id, '!=', callerProfile.school_id)
        return { error: 'Permission refusée (école différente)' }
    }

    const { error: deleteError, count } = await admin
        .from('profiles')
        .delete({ count: 'exact' })
        .eq('id', profileId)

    console.log('[deleteStaff] delete result: error=', deleteError?.message, 'code=', deleteError?.code, 'count=', count)

    if (deleteError) return { error: `${deleteError.message} (${deleteError.code})` }
    if (count === 0) return { error: `Aucune ligne supprimée (id=${profileId})` }

    return { error: null }
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

    return { staff, error: null }
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

    return { success: true }
}

export async function updateCurrentUserPassword(newPassword: string) {
    if (!newPassword || newPassword.length < 4) {
        return { error: 'Le mot de passe doit comporter au moins 4 caractères.' }
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

    return { success: true }
}
