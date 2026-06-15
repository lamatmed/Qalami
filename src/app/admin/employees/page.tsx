'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Search, ChevronRight, Phone, Users } from 'lucide-react'
import { getEmployeesListAction } from './actions'
import { useLanguage } from '@/i18n'

type Employee = {
    id: string
    full_name: string
    phone: string | null
    national_id: string | null
    status: string | null
    contract: {
        position: string | null
        contract_type: string | null
        monthly_salary: number | null
        status: string
    } | null
}

export default function EmployeesPage() {
    const router = useRouter()
    const { t } = useLanguage()
    const [employees, setEmployees] = useState<Employee[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState('')

    useEffect(() => {
        getEmployeesListAction().then(res => {
            if (res.error) { setError(res.error); setLoading(false); return }
            setEmployees(res.employees)
            setLoading(false)
        })
    }, [])

    const filtered = employees.filter(e =>
        e.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        e.contract?.position?.toLowerCase().includes(search.toLowerCase()) ||
        e.phone?.includes(search)
    )

    const getContractTypeLabel = (ct: string) =>
        t(`admin.employees.contractTypes.${ct}`) || ct

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
        </div>
    )

    if (error) return (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Users className="w-10 h-10 text-white/10" />
            <p className="text-gray-500 text-sm">{error}</p>
        </div>
    )

    return (
        <div className="max-w-2xl mx-auto px-5 py-6 space-y-5">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-white">
                        {t('admin.employees.title')}
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {employees.length !== 1
                            ? t('admin.employees.membersCountPlural').replace('{count}', String(employees.length))
                            : t('admin.employees.membersCount').replace('{count}', String(employees.length))}
                    </p>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={t('admin.employees.searchPlaceholder')}
                    className="w-full ps-10 pe-4 py-2.5 bg-[#161B22] border border-white/5 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/15 transition-colors"
                />
            </div>

            {/* Empty state */}
            {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-[#161B22] border border-white/5 flex items-center justify-center">
                        <Users className="w-6 h-6 text-white/15" />
                    </div>
                    <p className="text-gray-600 text-sm">
                        {search ? t('admin.employees.noResults') : t('admin.employees.noEmployee')}
                    </p>
                </div>
            ) : (
                <div className="space-y-1.5">
                    {filtered.map(emp => (
                        <button
                            key={emp.id}
                            type="button"
                            onClick={() => router.push(`/admin/employees/${emp.id}`)}
                            className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl bg-[#161B22] border border-white/5 hover:border-white/10 hover:bg-[#1A2530] transition-all duration-150 text-start group"
                        >
                            {/* Avatar */}
                            <div className="relative shrink-0">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xs">
                                    {emp.full_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                                </div>
                                {emp.status === 'active' && (
                                    <span className="absolute -bottom-0.5 -end-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#161B22] rounded-full" />
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-white truncate">{emp.full_name}</p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    {emp.contract?.position && (
                                        <span className="text-xs text-gray-500 truncate">{emp.contract.position}</span>
                                    )}
                                    {emp.contract?.contract_type && (
                                        <>
                                            <span className="text-gray-700">·</span>
                                            <span className="text-xs text-gray-600">
                                                {getContractTypeLabel(emp.contract.contract_type)}
                                            </span>
                                        </>
                                    )}
                                    {emp.phone && (
                                        <>
                                            <span className="text-gray-700">·</span>
                                            <span className="text-xs text-gray-600 flex items-center gap-1">
                                                <Phone className="w-3 h-3" />
                                                {emp.phone}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Salary */}
                            {emp.contract?.monthly_salary && (
                                <div className="shrink-0 text-end hidden sm:block">
                                    <p className="text-sm font-bold text-white">
                                        {Math.round(emp.contract.monthly_salary).toLocaleString('fr-FR')}
                                        <span className="text-xs text-gray-600 ms-1">MRU</span>
                                    </p>
                                    <p className="text-[10px] text-gray-700">{t('admin.employees.perMonth')}</p>
                                </div>
                            )}

                            <ChevronRight className="w-4 h-4 text-gray-700 group-hover:text-gray-500 rtl:rotate-180 transition-colors shrink-0" />
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
