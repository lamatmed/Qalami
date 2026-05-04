'use client'

import { useEffect, useState } from 'react'
import { ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, TrendingDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import { useLanguage } from '@/i18n'

interface Stats {
    totalIncome: number
    totalExpenses: number
    netBalance: number
    pendingAmount: number
}

export function AccountingStats() {
    const supabase = createClient()
    const { t } = useLanguage()
    const [stats, setStats] = useState<Stats>({ totalIncome: 0, totalExpenses: 0, netBalance: 0, pendingAmount: 0 })
    const [loading, setLoading] = useState(true)
    const [monthlyData, setMonthlyData] = useState<{ income: number, expense: number }[]>([])

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('school_id')
                    .eq('id', user.id)
                    .single()

                if (!profile?.school_id) return

                // Fetch all transactions for aggregation
                const { data: transactions } = await supabase
                    .from('transactions')
                    .select('type, amount, status, transaction_date')
                    .eq('school_id', profile.school_id)

                if (transactions) {
                    let totalIncome = 0
                    let totalExpenses = 0
                    let pendingAmount = 0

                    transactions.forEach(tx => {
                        const amount = Number(tx.amount)
                        if (tx.type === 'income' || tx.type === 'tuition') {
                            totalIncome += amount
                        } else if (tx.type === 'expense' || tx.type === 'salary') {
                            totalExpenses += amount
                        }
                        if (tx.status === 'pending') {
                            pendingAmount += amount
                        }
                    })

                    setStats({
                        totalIncome,
                        totalExpenses,
                        netBalance: totalIncome - totalExpenses,
                        pendingAmount
                    })

                    // Calculate monthly data for chart
                    const monthlyMap = new Map<string, { income: number, expense: number }>()
                    const last6Months = getLast6Months()
                    last6Months.forEach(m => monthlyMap.set(m, { income: 0, expense: 0 }))

                    transactions.forEach(tx => {
                        const month = tx.transaction_date?.slice(0, 7) // YYYY-MM
                        if (monthlyMap.has(month)) {
                            const current = monthlyMap.get(month)!
                            const amount = Number(tx.amount)
                            if (tx.type === 'income' || tx.type === 'tuition') {
                                current.income += amount
                            } else {
                                current.expense += amount
                            }
                        }
                    })

                    setMonthlyData(Array.from(monthlyMap.values()))
                }
            } catch (error) {
                console.error('Error fetching stats:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchStats()
    }, [])

    const getLast6Months = () => {
        const months = []
        for (let i = 5; i >= 0; i--) {
            const d = new Date()
            d.setMonth(d.getMonth() - i)
            months.push(d.toISOString().slice(0, 7))
        }
        return months
    }

    const formatAmount = (amount: number) => {
        if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`
        if (amount >= 1000) return `${(amount / 1000).toFixed(0)}k`
        return amount.toLocaleString()
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
            </div>
        )
    }

    const maxMonthly = Math.max(...monthlyData.map(d => Math.max(d.income, d.expense)), 1)

    return (
        <div className="space-y-6">
            {/* Top KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label={t('admin.finance.totalRevenue')}
                    value={formatAmount(stats.totalIncome)}
                    currency="MRU"
                    trend="+12.5%"
                    trendUp={true}
                    icon={ArrowUpRight}
                    color="text-emerald-500"
                    bg="bg-emerald-500/10"
                />
                <StatCard
                    label={t('admin.finance.totalExpenses')}
                    value={formatAmount(stats.totalExpenses)}
                    currency="MRU"
                    trend="+5.2%"
                    trendUp={false}
                    icon={ArrowDownRight}
                    color="text-red-500"
                    bg="bg-red-500/10"
                />
                <StatCard
                    label={t('admin.finance.netBalance')}
                    value={formatAmount(stats.netBalance)}
                    currency="MRU"
                    trend={stats.netBalance >= 0 ? "+8.1%" : "-2.3%"}
                    trendUp={stats.netBalance >= 0}
                    icon={Wallet}
                    color="text-indigo-500"
                    bg="bg-indigo-500/10"
                />
                <StatCard
                    label={t('admin.finance.pendingAmount')}
                    value={formatAmount(stats.pendingAmount)}
                    currency="MRU"
                    trend="-2.5%"
                    trendUp={true}
                    icon={TrendingUp}
                    color="text-amber-500"
                    bg="bg-amber-500/10"
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Cashflow Chart */}
                <div className="lg:col-span-2 bg-[#161B22] border border-white/5 rounded-3xl p-6 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-white">{t('admin.finance.cashflow')}</h3>
                            <p className="text-sm text-gray-500">{t('admin.finance.incomeVsExpense')}</p>
                        </div>
                        <div className="flex gap-2">
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                                <div className="w-2 h-2 rounded-full bg-emerald-500"></div> {t('admin.finance.income')}
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                                <div className="w-2 h-2 rounded-full bg-red-500"></div> {t('admin.finance.expenses')}
                            </div>
                        </div>
                    </div>

                    <div className="h-64 flex items-end justify-between gap-4 px-4">
                        {monthlyData.map((data, i) => {
                            const incomeHeight = (data.income / maxMonthly) * 100
                            const expenseHeight = (data.expense / maxMonthly) * 100
                            const months = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Fev']
                            return (
                                <div key={i} className="flex-1 flex flex-col justify-end gap-1 h-full group">
                                    <div
                                        className="w-full bg-emerald-500/20 rounded-t-sm relative overflow-hidden transition-all duration-300 group-hover:bg-emerald-500/30"
                                        style={{ height: `${incomeHeight || 5}%` }}
                                    >
                                        <div className="absolute bottom-0 w-full bg-emerald-500 h-1"></div>
                                    </div>
                                    <div
                                        className="w-full bg-red-500/20 rounded-t-sm relative overflow-hidden transition-all duration-300 group-hover:bg-red-500/30"
                                        style={{ height: `${expenseHeight || 5}%` }}
                                    >
                                        <div className="absolute bottom-0 w-full bg-red-500 h-1"></div>
                                    </div>
                                    <span className="text-[10px] text-gray-500 text-center mt-2 uppercase font-mono">
                                        {months[i]}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Expense Breakdown */}
                <div className="bg-[#161B22] border border-white/5 rounded-3xl p-6 flex flex-col">
                    <h3 className="text-lg font-bold text-white mb-6">{t('admin.finance.expenseBreakdown')}</h3>
                    <div className="flex-1 flex items-center justify-center relative">
                        <div className="w-48 h-48 rounded-full border-[16px] border-[#0D1117] relative flex items-center justify-center">
                            <svg className="absolute inset-0 w-full h-full -rotate-90">
                                <circle cx="50%" cy="50%" r="40%" fill="none" stroke="#6366f1" strokeWidth="16" strokeDasharray="100 100" strokeDashoffset="25" />
                                <circle cx="50%" cy="50%" r="40%" fill="none" stroke="#eab308" strokeWidth="16" strokeDasharray="60 100" strokeDashoffset="-75" />
                                <circle cx="50%" cy="50%" r="40%" fill="none" stroke="#ef4444" strokeWidth="16" strokeDasharray="40 100" strokeDashoffset="-135" />
                            </svg>
                            <div className="text-center">
                                <span className="block text-2xl font-bold text-white">{formatAmount(stats.totalExpenses)}</span>
                                <span className="text-xs text-gray-500 uppercase">{t('common.total')}</span>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-3 mt-6">
                        <LegendItem color="bg-indigo-500" label={t('admin.finance.salaries')} value="65%" amount={formatAmount(stats.totalExpenses * 0.65)} />
                        <LegendItem color="bg-amber-500" label={t('admin.finance.maintenance')} value="20%" amount={formatAmount(stats.totalExpenses * 0.20)} />
                        <LegendItem color="bg-red-500" label={t('admin.finance.others')} value="15%" amount={formatAmount(stats.totalExpenses * 0.15)} />
                    </div>
                </div>
            </div>
        </div>
    )
}

function StatCard({ label, value, currency, trend, trendUp, icon: Icon, color, bg }: any) {
    return (
        <div className="bg-[#161B22] border border-white/5 p-6 rounded-3xl flex flex-col justify-between h-full group hover:border-white/10 transition-colors">
            <div className="flex justify-between items-start mb-4">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-colors", bg, color)}>
                    <Icon className="w-6 h-6" />
                </div>
                <div className={cn("flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full border",
                    trendUp ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/5" : "text-red-400 border-red-500/20 bg-red-500/5"
                )}>
                    {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {trend}
                </div>
            </div>
            <div>
                <p className="text-sm text-gray-400 font-medium mb-1">{label}</p>
                <div className="flex items-baseline gap-1">
                    <h3 className="text-2xl font-black text-white tracking-tight">{value}</h3>
                    <span className="text-xs font-bold text-gray-500">{currency}</span>
                </div>
            </div>
        </div>
    )
}

function LegendItem({ color, label, value, amount }: any) {
    return (
        <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
                <div className={cn("w-3 h-3 rounded-full", color)} />
                <span className="text-gray-300 font-medium">{label}</span>
            </div>
            <div className="flex items-center gap-3">
                <span className="text-gray-500">{value}</span>
                <span className="text-white font-bold">{amount}</span>
            </div>
        </div>
    )
}
