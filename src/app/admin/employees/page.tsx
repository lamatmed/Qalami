'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Briefcase, Phone, ChevronRight, Loader2, UserCircle, Search, BadgeCheck } from 'lucide-react'
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
            <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
        </div>
    )

    if (error) return (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Briefcase className="w-10 h-10 text-gray-600" />
            <p className="text-gray-400">{error}</p>
        </div>
    )

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
                        <Briefcase className="w-6 h-6 text-pink-500" />
                        {t('admin.employees.title')}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {employees.length !== 1
                            ? t('admin.employees.membersCountPlural').replace('{count}', String(employees.length))
                            : t('admin.employees.membersCount').replace('{count}', String(employees.length))}
                    </p>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={t('admin.employees.searchPlaceholder')}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/30"
                />
            </div>

            {/* List */}
            {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                    <UserCircle className="w-12 h-12 text-gray-600" />
                    <p className="text-gray-400 font-medium">
                        {search ? t('admin.employees.noResults') : t('admin.employees.noEmployee')}
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(emp => (
                        <button
                            key={emp.id}
                            type="button"
                            onClick={() => router.push(`/admin/employees/${emp.id}`)}
                            className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-accent transition-colors text-left group"
                        >
                            {/* Avatar */}
                            <div className="w-11 h-11 rounded-full bg-pink-500/10 border border-pink-500/20 flex items-center justify-center shrink-0 text-pink-500 font-bold text-base">
                                {emp.full_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-sm text-foreground truncate">{emp.full_name}</span>
                                    {emp.status === 'active' && (
                                        <BadgeCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                    )}
                                </div>
                                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                    {emp.contract?.position && (
                                        <span className="text-xs text-muted-foreground truncate">{emp.contract.position}</span>
                                    )}
                                    {emp.contract?.contract_type && (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-500 font-semibold shrink-0">
                                            {getContractTypeLabel(emp.contract.contract_type)}
                                        </span>
                                    )}
                                </div>
                                {emp.phone && (
                                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                        <Phone className="w-3 h-3" />
                                        {emp.phone}
                                    </div>
                                )}
                            </div>

                            {/* Salary badge */}
                            {emp.contract?.monthly_salary && (
                                <div className="text-right shrink-0 hidden sm:block">
                                    <p className="text-xs font-bold text-foreground">
                                        {Math.round(emp.contract.monthly_salary).toLocaleString('fr-FR')} MRU
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">{t('admin.employees.perMonth')}</p>
                                </div>
                            )}

                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
