'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { getActionContext } from '@/lib/auth-action'

export async function getEmployeeProfileAction(employeeId: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié', profile: null, contract: null, payroll: [] }
    const { schoolId } = ctx
    const admin = createAdminClient()

    const [profileRes, contractRes, payrollRes] = await Promise.all([
        admin
            .from('profiles')
            .select('id, full_name, email, phone, national_id, address, role, avatar_url, status')
            .eq('id', employeeId)
            .eq('school_id', schoolId)
            .single(),
        admin
            .from('contracts')
            .select('id, contract_type, position, monthly_salary, payment_method, bank_name, account_number, wallet_app, wallet_phone, status')
            .eq('employee_id', employeeId)
            .eq('school_id', schoolId)
            .eq('status', 'active')
            .maybeSingle(),
        admin
            .from('payroll')
            .select('id, month, year, base_salary, bonuses, deductions, net_salary, status, paid_at')
            .eq('employee_id', employeeId)
            .eq('school_id', schoolId)
            .order('year', { ascending: false })
            .order('month', { ascending: false })
            .limit(24),
    ])

    if (profileRes.error) return { error: profileRes.error.message, profile: null, contract: null, payroll: [] }

    return {
        profile: profileRes.data,
        contract: contractRes.data ?? null,
        payroll: payrollRes.data ?? [],
        error: null,
    }
}

export async function updateEmployeeInfoAction(employeeId: string, data: {
    full_name: string
    phone?: string | null
    national_id?: string | null
    address?: string | null
}) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    if (!data.full_name?.trim()) return { error: 'Le nom est obligatoire' }
    const { schoolId } = ctx
    const admin = createAdminClient()
    const { error } = await admin
        .from('profiles')
        .update({
            full_name: data.full_name.trim(),
            phone: data.phone?.trim() || null,
            national_id: data.national_id?.trim() || null,
            address: data.address?.trim() || null,
        })
        .eq('id', employeeId)
        .eq('school_id', schoolId)
    if (error) return { error: error.message }
    return { success: true }
}
