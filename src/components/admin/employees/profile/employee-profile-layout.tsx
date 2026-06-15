'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Loader2, Phone, Users, Wallet } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { getEmployeeProfileAction } from '@/app/admin/employees/actions'
import { EmployeeInfo } from './employee-info'
import { EmployeeFinances } from './employee-finances'
import { EmployeeAbsences } from './employee-absences'
import { EmployeeDocuments } from './employee-documents'
import { useLanguage } from '@/i18n'

export function EmployeeProfileLayout({ id }: { id: string }) {
    const router = useRouter()
    const { t } = useLanguage()
    const [activeTab, setActiveTab] = useState('infos')
    const [profile, setProfile] = useState<any>(null)
    const [contract, setContract] = useState<any>(null)
    const [payroll, setPayroll] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        getEmployeeProfileAction(id).then(res => {
            if (res.error) { setError(res.error); setLoading(false); return }
            setProfile(res.profile)
            setContract(res.contract)
            setPayroll(res.payroll)
            setLoading(false)
        })
    }, [id])

    const TABS = [
        { id: 'infos',     label: t('admin.employees.tabs.infos') },
        { id: 'finances',  label: t('admin.employees.tabs.finances') },
        { id: 'absences',  label: t('admin.employees.tabs.absences') },
        { id: 'documents', label: t('admin.employees.tabs.documents') },
    ]

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
        </div>
    )

    if (error || !profile) return (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#161B22] border border-white/5 flex items-center justify-center">
                <Users className="w-6 h-6 text-white/20" />
            </div>
            <p className="text-gray-500 text-sm">{error || t('admin.employees.notFound')}</p>
            <button type="button" onClick={() => router.back()}
                className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
                {t('admin.employees.back')}
            </button>
        </div>
    )

    const initials = profile.full_name
        .split(' ')
        .map((w: string) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)

    const position = contract?.position || t('admin.sidebar.employees')

    return (
        <div className="max-w-2xl mx-auto px-5 py-6 space-y-5">

            {/* Back */}
            <button
                type="button"
                onClick={() => router.back()}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors group"
            >
                <ArrowLeft className="w-4 h-4 rtl:rotate-180 group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5 transition-transform" />
                {t('admin.employees.back')}
            </button>

            {/* Hero */}
            <div className="bg-[#161B22] rounded-2xl border border-white/5 p-5">
                <div className="flex items-start gap-4">

                    {/* Avatar */}
                    <div className="relative shrink-0">
                        <div className="w-14 h-14 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-xl font-bold text-emerald-400">
                            {initials}
                        </div>
                        <span className="absolute -bottom-0.5 -end-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#161B22] rounded-full" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg font-bold text-white mb-2">
                            {profile.full_name}
                        </h1>
                        <div className="flex flex-wrap items-center gap-1.5">
                            {position && (
                                <span className="text-xs text-gray-400 bg-white/5 border border-white/5 px-2.5 py-1 rounded-lg">
                                    {position}
                                </span>
                            )}
                            {contract?.contract_type && (
                                <span className="text-xs text-gray-500 bg-white/5 border border-white/5 px-2.5 py-1 rounded-lg">
                                    {t(`admin.employees.contractTypes.${contract.contract_type}`) || contract.contract_type}
                                </span>
                            )}
                            {profile.phone && (
                                <span className="flex items-center gap-1 text-xs text-gray-600 bg-white/5 border border-white/5 px-2.5 py-1 rounded-lg">
                                    <Phone className="w-3 h-3" />
                                    {profile.phone}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Salary */}
                    {contract?.monthly_salary && (
                        <div className="shrink-0 text-end">
                            <div className="flex items-center justify-end gap-1.5 mb-0.5">
                                <Wallet className="w-3 h-3 text-gray-600" />
                                <p className="text-[10px] text-gray-600 uppercase tracking-widest">
                                    {t('admin.employees.salary')}
                                </p>
                            </div>
                            <p className="text-xl font-bold text-white">
                                {Number(contract.monthly_salary).toLocaleString('fr-FR')}
                            </p>
                            <p className="text-xs text-gray-600 mt-0.5">MRU / mois</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/5">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            'px-4 py-2.5 text-sm font-medium transition-all whitespace-nowrap border-b-2 -mb-px',
                            activeTab === tab.id
                                ? 'text-white border-emerald-500'
                                : 'text-gray-600 border-transparent hover:text-gray-400'
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div>
                {activeTab === 'infos'     && <EmployeeInfo profileId={id} profile={profile} onUpdated={p => setProfile(p)} />}
                {activeTab === 'finances'  && <EmployeeFinances employeeId={id} />}
                {activeTab === 'absences'  && <EmployeeAbsences employeeId={id} salary={Number(contract?.monthly_salary || 0)} />}
                {activeTab === 'documents' && <EmployeeDocuments employeeId={id} />}
            </div>
        </div>
    )
}
