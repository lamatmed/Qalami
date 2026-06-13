'use client'

import { Banknote, TrendingUp, Calendar, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StaffAdjustments } from '@/components/admin/teachers/profile/staff-adjustments'

const MONTH_NAMES: Record<number, string> = {
    1: 'Janvier', 2: 'Février', 3: 'Mars', 4: 'Avril', 5: 'Mai', 6: 'Juin',
    7: 'Juillet', 8: 'Août', 9: 'Septembre', 10: 'Octobre', 11: 'Novembre', 12: 'Décembre',
}

interface Props {
    employeeId: string
    contract: any | null
    payrollHistory: any[]
}

export function EmployeeFinances({ employeeId, contract, payrollHistory }: Props) {
    const totalPaid = payrollHistory
        .filter(p => p.status === 'paid')
        .reduce((sum, p) => sum + Number(p.net_salary || 0), 0)

    return (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Contract summary */}
            {contract ? (
                <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 bg-[#1A2530] rounded-2xl border border-emerald-500/20 p-5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <Banknote className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Salaire mensuel</p>
                            <p className="text-2xl font-black text-white">
                                {Number(contract.monthly_salary || 0).toLocaleString('fr-FR')}
                                <span className="text-sm text-gray-400 ml-1.5">MRU</span>
                            </p>
                            {contract.position && <p className="text-xs text-gray-500 mt-0.5">{contract.position}</p>}
                        </div>
                    </div>
                    <div className="bg-[#1A2530] rounded-2xl border border-white/5 p-5 flex flex-col items-center justify-center text-center">
                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">Type de contrat</p>
                        <p className="text-sm font-bold text-white">{contract.contract_type || 'CDI'}</p>
                    </div>
                </div>
            ) : (
                <div className="bg-[#1A2530] rounded-3xl border border-amber-500/20 p-8 text-center">
                    <Banknote className="w-10 h-10 text-amber-500/30 mx-auto mb-3" />
                    <p className="text-amber-400 font-bold">Aucun contrat actif</p>
                    <p className="text-gray-500 text-sm mt-1">Ajoutez un contrat depuis la gestion du personnel</p>
                </div>
            )}

            {/* Total paid */}
            {totalPaid > 0 && (
                <div className="bg-[#1A2530] rounded-2xl border border-white/5 px-5 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-gray-400" />
                        <p className="text-sm text-gray-400">Total versé (historique)</p>
                    </div>
                    <p className="text-lg font-black text-emerald-400">{totalPaid.toLocaleString('fr-FR')} MRU</p>
                </div>
            )}

            {/* Journal ajustements */}
            <div className="bg-[#1A2530] rounded-3xl border border-white/5 p-5">
                <StaffAdjustments profileId={employeeId} />
            </div>

            {/* Payroll history */}
            <div>
                <h4 className="text-sm font-bold text-white mb-3">Historique de paie</h4>
                {payrollHistory.length === 0 ? (
                    <div className="bg-[#1A2530] rounded-3xl border border-white/5 p-12 text-center">
                        <Calendar className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">Aucun paiement enregistré</p>
                    </div>
                ) : (
                    <div className="bg-[#1A2530] rounded-3xl border border-white/5 overflow-hidden">
                        <div className="divide-y divide-white/5">
                            {payrollHistory.map(p => {
                                const isPaid = p.status === 'paid'
                                const isCancelled = p.status === 'cancelled'
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
                                            <p className="text-sm font-bold text-white">
                                                {MONTH_NAMES[p.month] || `Mois ${p.month}`} {p.year}
                                            </p>
                                            <div className="flex items-center gap-3 mt-0.5">
                                                <span className="text-[10px] text-gray-500">
                                                    Base: {Number(p.base_salary || 0).toLocaleString('fr-FR')} MRU
                                                </span>
                                                {Number(p.bonuses) > 0 && (
                                                    <span className="text-[10px] text-emerald-400">
                                                        +{Number(p.bonuses).toLocaleString('fr-FR')}
                                                    </span>
                                                )}
                                                {Number(p.deductions) > 0 && (
                                                    <span className="text-[10px] text-red-400">
                                                        -{Number(p.deductions).toLocaleString('fr-FR')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className={cn("text-base font-black",
                                                isPaid ? "text-emerald-400"
                                                    : isCancelled ? "text-red-400/60 line-through"
                                                    : "text-amber-400"
                                            )}>
                                                {Number(p.net_salary || 0).toLocaleString('fr-FR')} MRU
                                            </p>
                                            <p className={cn("text-[10px] font-bold uppercase",
                                                isPaid ? "text-emerald-500/70"
                                                    : isCancelled ? "text-red-500/70"
                                                    : "text-amber-500/70"
                                            )}>
                                                {isPaid ? 'Payé' : isCancelled ? 'Annulé' : 'En attente'}
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
