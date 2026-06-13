'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Loader2, Phone, Briefcase } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { getEmployeeProfileAction } from '@/app/admin/employees/actions'
import { EmployeeInfo } from './employee-info'
import { EmployeeFinances } from './employee-finances'
import { EmployeeAbsences } from './employee-absences'
import { EmployeeDocuments } from './employee-documents'

const TABS = [
    { id: 'infos',     label: 'Informations' },
    { id: 'finances',  label: 'Finances' },
    { id: 'absences',  label: 'Absences' },
    { id: 'documents', label: 'Documents' },
]

export function EmployeeProfileLayout({ id }: { id: string }) {
    const router = useRouter()
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

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
        </div>
    )

    if (error || !profile) return (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Briefcase className="w-10 h-10 text-gray-700" />
            <p className="text-gray-500">{error || 'Employé introuvable'}</p>
            <button type="button" onClick={() => router.back()} className="text-sm text-pink-400 hover:text-pink-300">
                ← Retour
            </button>
        </div>
    )

    const initials = profile.full_name
        .split(' ')
        .map((w: string) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)

    const position = contract?.position || 'Employé'

    return (
        <div className="space-y-6">
            {/* Back */}
            <button
                type="button"
                onClick={() => router.back()}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors -ml-1"
            >
                <ArrowLeft className="w-4 h-4" />
                Retour
            </button>

            {/* Header card */}
            <div className="bg-[#1A2530] rounded-3xl border border-white/5 p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                    <div className="w-16 h-16 rounded-2xl bg-pink-500/20 border border-pink-500/20 flex items-center justify-center text-2xl font-black text-pink-400 shrink-0">
                        {initials}
                    </div>

                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl font-black text-white">{profile.full_name}</h1>
                        <div className="flex flex-wrap items-center gap-3 mt-1.5">
                            <span className="text-xs font-bold bg-pink-500/10 text-pink-400 border border-pink-500/20 px-2.5 py-0.5 rounded-full">
                                {position}
                            </span>
                            {contract?.contract_type && (
                                <span className="text-xs text-gray-500 font-medium">{contract.contract_type}</span>
                            )}
                            {profile.phone && (
                                <span className="flex items-center gap-1 text-xs text-gray-500">
                                    <Phone className="w-3 h-3" />
                                    {profile.phone}
                                </span>
                            )}
                        </div>
                    </div>

                    {contract?.monthly_salary && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-3 text-center shrink-0">
                            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Salaire</p>
                            <p className="text-lg font-black text-emerald-400">
                                {Number(contract.monthly_salary).toLocaleString('fr-FR')} MRU
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-[#1A2530] border border-white/5 p-1 rounded-2xl w-fit overflow-x-auto">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            'px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap',
                            activeTab === tab.id
                                ? 'bg-pink-600 text-white shadow-lg shadow-pink-900/30'
                                : 'text-gray-500 hover:text-gray-300'
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div>
                {activeTab === 'infos'     && <EmployeeInfo profileId={id} profile={profile} onUpdated={p => setProfile(p)} />}
                {activeTab === 'finances'  && <EmployeeFinances employeeId={id} contract={contract} payrollHistory={payroll} />}
                {activeTab === 'absences'  && <EmployeeAbsences employeeId={id} salary={Number(contract?.monthly_salary || 0)} />}
                {activeTab === 'documents' && <EmployeeDocuments employeeId={id} />}
            </div>
        </div>
    )
}
