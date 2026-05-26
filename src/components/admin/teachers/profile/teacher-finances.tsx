'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Loader2, Banknote, TrendingUp, Calendar, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/i18n'
import { getMySchoolContext } from '@/app/admin/actions'

interface ContractData {
    monthly_salary: number
    contract_type: 'fixed' | 'hourly'
    position: string | null
}

interface PayrollRecord {
    id: string
    month: number
    year: number
    base_salary: number
    bonuses: number
    deductions: number
    net_salary: number
    status: 'pending' | 'paid' | 'cancelled'
    paid_at: string | null
}

const MONTH_KEYS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

export function TeacherFinances({ teacherId }: { teacherId: string }) {
    const { t } = useLanguage()
    const [loading, setLoading] = useState(true)
    const [contract, setContract] = useState<ContractData | null>(null)
    const [payments, setPayments] = useState<PayrollRecord[]>([])

    useEffect(() => {
        async function load() {
            const supabase = createClient()
            const ctx = await getMySchoolContext()
            const schoolId = ctx?.school_id
            if (!schoolId) { setLoading(false); return }

            const [contractRes, payrollRes] = await Promise.all([
                supabase
                    .from('contracts')
                    .select('monthly_salary, contract_type, position')
                    .eq('employee_id', teacherId)
                    .eq('school_id', schoolId)
                    .eq('status', 'active')
                    .maybeSingle(),
                supabase
                    .from('payroll')
                    .select('id, month, year, base_salary, bonuses, deductions, net_salary, status, paid_at')
                    .eq('employee_id', teacherId)
                    .eq('school_id', schoolId)
                    .order('year', { ascending: false })
                    .order('month', { ascending: false })
                    .limit(24)
            ])

            if (contractRes.data) setContract(contractRes.data as ContractData)
            if (payrollRes.data) setPayments(payrollRes.data as PayrollRecord[])
            setLoading(false)
        }
        load()
    }, [teacherId])

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
        </div>
    )

    const totalPaid = payments
        .filter(p => p.status === 'paid')
        .reduce((sum, p) => sum + (p.net_salary || 0), 0)

    return (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header */}
            <div>
                <h3 className="text-xl font-bold text-white">{t('admin.teachers.finances.title')}</h3>
                <p className="text-gray-400 text-sm">{t('admin.teachers.finances.subtitle')}</p>
            </div>

            {/* Contract / salary summary */}
            {!contract ? (
                <div className="bg-[#1A2530] rounded-3xl border border-amber-500/20 p-10 text-center">
                    <Banknote className="w-10 h-10 text-amber-500/30 mx-auto mb-3" />
                    <p className="text-amber-400 font-bold">{t('admin.teachers.finances.noContract')}</p>
                    <p className="text-gray-500 text-sm mt-2 max-w-xs mx-auto">{t('admin.teachers.finances.noContractDesc')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 bg-[#1A2530] rounded-2xl border border-emerald-500/20 p-5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <Banknote className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">
                                {contract.contract_type === 'hourly'
                                    ? t('admin.teachers.finances.hourlyRateLabel')
                                    : t('admin.teachers.finances.baseSalaryLabel')}
                            </p>
                            <p className="text-2xl font-black text-white">
                                {(contract.monthly_salary || 0).toLocaleString('fr-FR')}
                                <span className="text-sm text-gray-400 ml-1.5">
                                    {contract.contract_type === 'hourly' ? 'MRU/h' : 'MRU'}
                                </span>
                            </p>
                            {contract.position && (
                                <p className="text-xs text-gray-500 mt-0.5">{contract.position}</p>
                            )}
                        </div>
                    </div>
                    <div className="bg-[#1A2530] rounded-2xl border border-white/5 p-5 flex flex-col items-center justify-center text-center">
                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">{t('admin.teachers.finances.contractType')}</p>
                        <p className="text-sm font-bold text-white">
                            {contract.contract_type === 'hourly'
                                ? t('admin.teachers.finances.hourlyLabel')
                                : t('admin.teachers.finances.fixedLabel')}
                        </p>
                    </div>
                </div>
            )}

            {/* Total paid bar */}
            {payments.filter(p => p.status === 'paid').length > 0 && (
                <div className="bg-[#1A2530] rounded-2xl border border-white/5 px-5 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-gray-400" />
                        <p className="text-sm text-gray-400">{t('admin.teachers.finances.totalPaid')}</p>
                    </div>
                    <p className="text-lg font-black text-emerald-400">{totalPaid.toLocaleString('fr-FR')} MRU</p>
                </div>
            )}

            {/* Payment history */}
            <div>
                <h4 className="text-sm font-bold text-white mb-3">{t('admin.teachers.finances.paymentHistory')}</h4>
                {payments.length === 0 ? (
                    <div className="bg-[#1A2530] rounded-3xl border border-white/5 p-12 text-center">
                        <Calendar className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">{t('admin.teachers.finances.noPayments')}</p>
                        <p className="text-xs text-gray-600 mt-1">{t('admin.teachers.finances.noPaymentsDesc')}</p>
                    </div>
                ) : (
                    <div className="bg-[#1A2530] rounded-3xl border border-white/5 overflow-hidden">
                        <div className="divide-y divide-white/5">
                            {payments.map(p => {
                                const isPaid = p.status === 'paid'
                                const isCancelled = p.status === 'cancelled'
                                const monthKey = MONTH_KEYS[(p.month || 1) - 1]
                                const monthName = t(`admin.payroll.months.${monthKey}`) || `Mois ${p.month}`

                                return (
                                    <div key={p.id} className="flex items-center gap-4 p-4 hover:bg-[#0F1720] transition-colors">
                                        <div className={cn(
                                            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border",
                                            isPaid ? "bg-emerald-500/10 border-emerald-500/20"
                                                : isCancelled ? "bg-red-500/10 border-red-500/20"
                                                : "bg-amber-500/10 border-amber-500/20"
                                        )}>
                                            {isPaid
                                                ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                                : isCancelled
                                                ? <XCircle className="w-4 h-4 text-red-400" />
                                                : <Clock className="w-4 h-4 text-amber-400" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-white capitalize">{monthName} {p.year}</p>
                                            <div className="flex items-center gap-3 mt-0.5">
                                                <span className="text-[10px] text-gray-500">
                                                    {t('admin.teachers.finances.base')}: {(p.base_salary || 0).toLocaleString('fr-FR')} MRU
                                                </span>
                                                {(p.bonuses || 0) > 0 && (
                                                    <span className="text-[10px] text-emerald-400">
                                                        +{(p.bonuses).toLocaleString('fr-FR')} {t('admin.teachers.finances.bonuses')}
                                                    </span>
                                                )}
                                                {(p.deductions || 0) > 0 && (
                                                    <span className="text-[10px] text-red-400">
                                                        -{(p.deductions).toLocaleString('fr-FR')} {t('admin.teachers.finances.deductions')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className={cn(
                                                "text-base font-black",
                                                isPaid ? "text-emerald-400"
                                                    : isCancelled ? "text-red-400/60 line-through"
                                                    : "text-amber-400"
                                            )}>
                                                {(p.net_salary || 0).toLocaleString('fr-FR')} MRU
                                            </p>
                                            <p className={cn(
                                                "text-[10px] font-bold uppercase",
                                                isPaid ? "text-emerald-500/70"
                                                    : isCancelled ? "text-red-500/70"
                                                    : "text-amber-500/70"
                                            )}>
                                                {t(`admin.teachers.finances.status_${p.status}`)}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
