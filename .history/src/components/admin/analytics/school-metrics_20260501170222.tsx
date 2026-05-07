'use client'

import { useState, useEffect } from 'react'
import { Users, GraduationCap, Calendar, DollarSign, FileText, BookOpen, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import { useSchoolContext } from '@/lib/use-school-context'
import { useLanguage } from '@/i18n'

interface Metric {
    label: string
    value: number | string
    icon: React.ReactNode
    trend?: number
    iconCls: string
}

export function SchoolMetrics() {
    const supabase = createClient()
    const { context, loading: ctxLoading } = useSchoolContext()
    const [loading, setLoading] = useState(true)
    const [metrics, setMetrics] = useState<Metric[]>([])
    const { t } = useLanguage()

    useEffect(() => {
        if (!context) return
        const schoolId = context.school_id
        const fetchMetrics = async () => {
            try {
                const [
                    studentsRes,
                    teachersRes,
                    parentsRes,
                    attendanceRes,
                    revenueRes,
                    quizzesRes,
                    homeworkRes,
                ] = await Promise.all([
                    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('role', 'student'),
                    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('role', 'teacher'),
                    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('role', 'parent'),
                    supabase.from('attendance').select('status', { count: 'exact' }).eq('school_id', schoolId).gte('date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
                    supabase.from('transactions').select('amount').eq('school_id', schoolId).eq('type', 'income').gte('date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
                    supabase.from('quizzes').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('is_published', true),
                    supabase.from('homework').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('is_published', true).gte('due_date', new Date().toISOString()),
                ])

                const attendanceData = attendanceRes.data || []
                const presentCount = attendanceData.filter((a: any) => a.status === 'present').length
                const attendanceRate = attendanceData.length > 0
                    ? Math.round((presentCount / attendanceData.length) * 100)
                    : 0

                const totalRevenue = (revenueRes.data || []).reduce((sum: number, t: any) => sum + (t.amount || 0), 0)

                setMetrics([
                    { label: t('common.students'),              value: studentsRes.count ?? 0,                    icon: <GraduationCap className="w-4 h-4" />, trend: 5,  iconCls: 'text-emerald-400 bg-emerald-500/15' },
                    { label: t('common.teachers'),              value: teachersRes.count ?? 0,                    icon: <Users className="w-4 h-4" />,          iconCls: 'text-blue-400 bg-blue-500/15' },
                    { label: t('common.parents'),               value: parentsRes.count ?? 0,                     icon: <Users className="w-4 h-4" />,          iconCls: 'text-amber-400 bg-amber-500/15' },
                    { label: t('admin.analytics.attendance'),   value: `${attendanceRate}%`,                      icon: <Calendar className="w-4 h-4" />,       trend: attendanceRate > 90 ? 2 : -3, iconCls: attendanceRate > 90 ? 'text-emerald-400 bg-emerald-500/15' : 'text-amber-400 bg-amber-500/15' },
                    { label: t('admin.analytics.revenueMonth'), value: `${(totalRevenue / 1000).toFixed(0)}K MRU`,icon: <DollarSign className="w-4 h-4" />,    trend: 8,  iconCls: 'text-emerald-400 bg-emerald-500/15' },
                    { label: t('admin.analytics.activeQuizzes'),value: quizzesRes.count ?? 0,                     icon: <BookOpen className="w-4 h-4" />,       iconCls: 'text-purple-400 bg-purple-500/15' },
                    { label: t('admin.analytics.pendingHomework'),value: homeworkRes.count ?? 0,                  icon: <FileText className="w-4 h-4" />,       iconCls: 'text-blue-400 bg-blue-500/15' },
                ])
            } catch (error) {
                console.error('Error fetching metrics:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchMetrics()
    }, [context, supabase, t])

    if (ctxLoading || loading) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="bg-[#161B22] border border-white/5 rounded-2xl p-4 animate-pulse">
                        <div className="h-8 w-8 rounded-xl bg-white/5 mb-3" />
                        <div className="h-3 w-16 bg-white/5 rounded mb-2" />
                        <div className="h-6 w-12 bg-white/5 rounded" />
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {metrics.map((metric, idx) => (
                <div key={idx} className="bg-[#161B22] border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-colors">
                    <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center mb-3', metric.iconCls)}>
                        {metric.icon}
                    </div>
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">{metric.label}</p>
                    <div className="flex items-end gap-2">
                        <p className="text-2xl font-black text-white/90">{metric.value}</p>
                        {metric.trend !== undefined && (
                            <span className={cn(
                                'text-[11px] font-bold flex items-center gap-0.5 mb-0.5',
                                metric.trend > 0 ? 'text-emerald-400' : 'text-red-400'
                            )}>
                                {metric.trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {Math.abs(metric.trend)}%
                            </span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}
