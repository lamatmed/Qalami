'use client'

import { useState } from 'react'
import { Check, Clock, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/i18n'

interface Fee {
    id: number
    type: string
    amount: number
    paidAmount?: number
    dueDate: string
    status: 'paid' | 'partial' | 'pending' | 'overdue'
}

interface ChildFees {
    studentId: number
    name: string
    class: string
    fees: Fee[]
    avatar?: string | null
}

interface FeeBreakdownProps {
    data: ChildFees[]
    onStatementGenerate: () => void
}

export function FeeBreakdown({ data, onStatementGenerate }: FeeBreakdownProps) {
    const { t } = useLanguage()

    // Find the first child with unpaid/overdue/pending fees to expand by default
    const firstUnpaidChild = data.find(child => 
        child.fees.some(f => f.status !== 'paid')
    )?.studentId || data[0]?.studentId || null

    const [expandedChild, setExpandedChild] = useState<number | null>(firstUnpaidChild)

    const toggleExpand = (id: number) => {
        setExpandedChild(expandedChild === id ? null : id)
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-400 pl-1 uppercase tracking-wider">{t('admin.parentFinance.childDetails')}</h3>
                <Badge variant="outline" className="text-[10px] border-white/10">{data.length} {t('admin.parentFinance.children')}</Badge>
            </div>

            <div className="space-y-3">
                {data.map((child) => {
                    const unpaidFees = child.fees.filter(f => f.status !== 'paid')
                    const hasUnpaid = unpaidFees.length > 0

                    return (
                        <div
                            key={child.studentId}
                            className={cn(
                                "rounded-2xl border transition-all duration-300 overflow-hidden",
                                hasUnpaid && expandedChild === child.studentId
                                    ? "bg-[#161B22] border-indigo-500/30 shadow-lg shadow-black/20"
                                    : "bg-[#0D1117] border-white/5 hover:border-white/10"
                            )}
                        >
                            {/* Header */}
                            <div
                                onClick={() => hasUnpaid && toggleExpand(child.studentId)}
                                className={cn(
                                    "p-4 flex items-center justify-between",
                                    hasUnpaid ? "cursor-pointer" : "cursor-default"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <Avatar className="w-10 h-10 border border-white/5 bg-[#0D1117]">
                                        <AvatarImage src={child.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${child.name}`} />
                                        <AvatarFallback>{child.name[0]}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h4 className="text-sm font-bold text-white">{child.name}</h4>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="text-[10px] h-4 bg-white/5 text-gray-400 hover:bg-white/10">{child.class}</Badge>
                                            {hasUnpaid ? (
                                                <span className="text-[10px] text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full">
                                                    {t('admin.parentFinance.unpaid')}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                                    {t('admin.parentFinance.paidUp')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {hasUnpaid && (
                                    expandedChild === child.studentId ? (
                                        <ChevronUp className="w-5 h-5 text-gray-500" />
                                    ) : (
                                        <ChevronDown className="w-5 h-5 text-gray-500" />
                                    )
                                )}
                            </div>

                            {/* Expanded Content */}
                            {hasUnpaid && expandedChild === child.studentId && (
                                <div className="bg-[#0D1117]/50 border-t border-white/5 p-3 space-y-2 animate-in slide-in-from-top-2">
                                    {unpaidFees.map((fee) => (
                                        <div key={fee.id} className="flex items-center justify-between p-3 rounded-xl bg-[#161B22] border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border",
                                                    fee.status === 'partial' ? "bg-amber-500/10 border-amber-500/20 text-amber-500" :
                                                        fee.status === 'overdue' ? "bg-red-500/10 border-red-500/20 text-red-500" :
                                                            "bg-gray-500/10 border-gray-500/20 text-gray-400"
                                                )}>
                                                    {fee.status === 'overdue' ? <AlertCircle className="w-4 h-4" /> :
                                                        <Clock className="w-4 h-4" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-200">{fee.type}</p>
                                                    <p className="text-[10px] text-gray-500">
                                                        {t('admin.parentFinance.dueDate')}: {fee.dueDate}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-white">{fee.amount.toLocaleString()} <span className="text-[10px] text-gray-500">MRU</span></p>
                                                {fee.status === 'partial' && (
                                                    <p className="text-[10px] text-amber-500">{t('admin.parentFinance.remaining')}: {((fee.amount || 0) - (fee.paidAmount || 0)).toLocaleString()}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            <Button
                variant="outline"
                className="w-full border-dashed border-white/20 hover:bg-white/5 hover:border-white/40 h-10 text-xs uppercase font-bold tracking-wider text-gray-400"
                onClick={onStatementGenerate}
            >
                {t('admin.parentFinance.generateStatement')}
            </Button>
        </div>
    )
}
