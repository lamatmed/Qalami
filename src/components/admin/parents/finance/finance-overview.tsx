'use client'

import { Wallet, School, Bus, Utensils } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/i18n'

interface FinanceOverviewProps {
    summary: {
        totalOutstanding: number
        totalPaid: number
        totalDue: number
        byCategory: {
            tuition: number
            transport: number
            canteen: number
        }
    }
}

export function FinanceOverview({ summary }: FinanceOverviewProps) {
    const { t } = useLanguage()
    const paymentProgress = (summary.totalPaid / summary.totalDue) * 100

    return (
        <div className="space-y-4">
            {/* Main Balance Card */}
            <div className="rounded-2xl bg-gradient-to-br from-[#0D1117] to-[#161B22] border border-white/5 p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                <div className="relative z-10 flex flex-col items-center text-center space-y-4">
                    <div className="w-20 h-20 rounded-full bg-[#0D1117] border-[6px] border-[#161B22] flex items-center justify-center relative shadow-2xl">
                        <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20" />
                        <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin-slow duration-[3s]" style={{ transform: `rotate(${paymentProgress * 3.6}deg)` }} />
                        <Wallet className="w-8 h-8 text-indigo-400" />
                    </div>

                    <div className="space-y-1">
                        <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">{t('admin.parentFinance.totalRemaining')}</p>
                        <h2 className="text-3xl font-black text-white tracking-tight">
                            {summary.totalOutstanding.toLocaleString()} <span className="text-lg font-bold text-indigo-400">MRU</span>
                        </h2>
                    </div>

                    <div className="w-full grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                        <div className="text-center">
                            <p className="text-[10px] text-gray-500 uppercase font-bold">{t('admin.parentFinance.paid')}</p>
                            <p className="text-emerald-400 font-bold">{summary.totalPaid.toLocaleString()} MRU</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] text-gray-500 uppercase font-bold">{t('admin.parentFinance.toPay')}</p>
                            <p className="text-red-400 font-bold">{summary.totalOutstanding.toLocaleString()} MRU</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Category Breakdown */}
            <h3 className="text-sm font-bold text-gray-400 pl-1 uppercase tracking-wider">{t('admin.parentFinance.feeBreakdown')}</h3>
            <div className="grid grid-cols-3 gap-3">
                <CategoryCard
                    icon={School}
                    label={t('admin.parentFinance.tuition')}
                    amount={summary.byCategory.tuition}
                    color="text-purple-400"
                    bg="bg-purple-500/10"
                    border="border-purple-500/20"
                />
                <CategoryCard
                    icon={Bus}
                    label={t('admin.parentFinance.transport')}
                    amount={summary.byCategory.transport}
                    color="text-blue-400"
                    bg="bg-blue-500/10"
                    border="border-blue-500/20"
                />
                <CategoryCard
                    icon={Utensils}
                    label={t('admin.parentFinance.canteen')}
                    amount={summary.byCategory.canteen}
                    color="text-amber-400"
                    bg="bg-amber-500/10"
                    border="border-amber-500/20"
                />
            </div>
        </div>
    )
}

function CategoryCard({ icon: Icon, label, amount, color, bg, border }: any) {
    return (
        <div className={cn("flex flex-col items-center justify-center p-3 rounded-xl border bg-[#161B22] space-y-2 group hover:scale-[1.02] transition-transform duration-200", border)}>
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", bg)}>
                <Icon className={cn("w-4 h-4", color)} />
            </div>
            <div className="text-center">
                <p className="text-[10px] text-gray-500 font-bold uppercase">{label}</p>
                <p className="text-xs font-bold text-white">{amount > 1000 ? (amount / 1000).toFixed(1) + 'k' : amount}</p>
            </div>
        </div>
    )
}
