'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

export async function saveTeacherContractAction(payload: {
    teacherId: string
    contractId: string | null
    contractType: 'fixed' | 'hourly'
    salary: number
    position: string
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

    const row = {
        school_id: me.school_id,
        employee_id: payload.teacherId,
        contract_type: payload.contractType === 'fixed' ? 'CDI' : 'hourly',
        position: payload.position || 'Enseignant',
        monthly_salary: payload.salary,
        start_date: new Date().toISOString().split('T')[0],
        status: 'active',
    }

    if (payload.contractId) {
        const { error } = await admin
            .from('contracts')
            .update(row)
            .eq('id', payload.contractId)
            .eq('school_id', me.school_id)
        if (error) return { error: error.message }
        return { success: true, contractId: payload.contractId }
    } else {
        const { data: inserted, error } = await admin
            .from('contracts')
            .insert(row)
            .select('id')
            .single()
        if (error) return { error: error.message }
        return { success: true, contractId: inserted.id }
    }
}

export async function loadTeacherContractAction(teacherId: string) {
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

    const { data: contract, error } = await admin
        .from('contracts')
        .select('id, contract_type, position, monthly_salary')
        .eq('employee_id', teacherId)
        .eq('school_id', me.school_id)
        .eq('status', 'active')
        .maybeSingle()

    if (error) return { error: error.message }
    return { contract: contract ?? null }
}
