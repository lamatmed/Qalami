/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSchoolContext } from '@/lib/use-school-context'
import { useLanguage } from '@/i18n'

interface ChartData {
    month: string
    students: number
    revenue: number
}

export function EnrollmentChart() {
    const supabase = createClient()
    const { context } = useSchoolContext()
    const [data, setData] = useState<ChartData[]>([])
    const [loading, setLoading] = useState(true)
    const { t, language } = useLanguage()

    useEffect(() => {
        if (!context) return
        const schoolId = context.school_id
        const fetchData = async () => {
            try {
                const months = []
                for (let i = 5; i >= 0; i--) {
                    const date = new Date()
                    date.setMonth(date.getMonth() - i)
                    months.push({
                        month: date.toLocaleDateString(language === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR', { month: 'short' }),
                        start: new Date(date.getFullYear(), date.getMonth(), 1),
                        end: new Date(date.getFullYear(), date.getMonth() + 1, 0),
                    })
                }

                const chartData: ChartData[] = []
                for (const m of months) {
                    const [studentsRes, revenueRes] = await Promise.all([
                        supabase.from('profiles').select('id', { count: 'exact', head: true })
                            .eq('school_id', schoolId).eq('role', 'student')
                            .lte('created_at', m.end.toISOString()),
                        supabase.from('transactions').select('amount')
                            .eq('school_id', schoolId).in('type', ['income', 'tuition'])
                            .gte('transaction_date', m.start.toISOString().split('T')[0]).lte('transaction_date', m.end.toISOString().split('T')[0]),
                    ])
                    chartData.push({
                        month: m.month,
                        students: studentsRes.count ?? 0,
                        revenue: Math.round((revenueRes.data || []).reduce((s: number, r: any) => s + (r.amount || 0), 0) / 1000),
                    })
                }
                setData(chartData)
            } catch (error) {
                console.error('Error fetching chart data:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [context, language, supabase])

    const maxStudents = Math.max(...data.map(d => d.students), 1)
    const maxRevenue = Math.max(...data.map(d => d.revenue), 1)

    if (loading) {
        return (
            <div className="bg-[#161B22] border border-white/5 rounded-2xl p-5">
                <div className="h-4 w-32 bg-white/5 rounded mb-6 animate-pulse" />
                <div className="h-48 bg-white/3 rounded animate-pulse" />
            </div>
        )
    }

    return (
        <div className="bg-[#161B22] border border-white/5 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{t('admin.analytics.evolution')}</p>
                <div className="flex gap-4 text-[11px] text-gray-500">
                    <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500/70" /> {t('common.students')}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-blue-500/70" /> {t('admin.analytics.revenueK')}
                    </span>
                </div>
            </div>

            <div className="h-48 flex items-end gap-2">
                {data.map((d, idx) => {
                    const studentHeight = (d.students / maxStudents) * 80
                    const revenueHeight = (d.revenue / maxRevenue) * 80

                    return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                            <div className="w-full flex gap-1 justify-center items-end" style={{ height: '160px' }}>
                                {/* Students Column */}
                                <div className="relative flex flex-col items-center justify-end w-3" style={{ height: '100%' }}>
                                    {d.students > 0 && (
                                        <span className="text-[9px] text-emerald-400 font-bold mb-1 select-none">
                                            {d.students}
                                        </span>
                                    )}
                                    <div
                                        className="w-full bg-emerald-500/70 rounded-t transition-all duration-500"
                                        style={{ height: `${studentHeight}%`, minHeight: d.students > 0 ? '4px' : '0' }}
                                    />
                                </div>

                                {/* Revenue Column */}
                                <div className="relative flex flex-col items-center justify-end w-3" style={{ height: '100%' }}>
                                    {d.revenue > 0 && (
                                        <span className="text-[9px] text-blue-400 font-bold mb-1 select-none whitespace-nowrap">
                                            {d.revenue}k
                                        </span>
                                    )}
                                    <div
                                        className="w-full bg-blue-500/70 rounded-t transition-all duration-500"
                                        style={{ height: `${revenueHeight}%`, minHeight: d.revenue > 0 ? '4px' : '0' }}
                                    />
                                </div>
                            </div>
                            <span className="text-[10px] text-gray-600 uppercase capitalize">{d.month}</span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
