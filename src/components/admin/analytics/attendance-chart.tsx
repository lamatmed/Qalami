'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSchoolContext } from '@/lib/use-school-context'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/i18n'

interface AttendanceDay {
    day: string
    present: number
    absent: number
    rate: number
}

interface SubjectOption {
    id: string
    name: string
    icon: string | null
}

export function AttendanceChart() {
    const supabase = createClient()
    const { context } = useSchoolContext()
    const schoolId = context?.school_id ?? null
    const [data, setData] = useState<AttendanceDay[]>([])
    const [loading, setLoading] = useState(true)
    const [subjects, setSubjects] = useState<SubjectOption[]>([])
    const [selectedSubject, setSelectedSubject] = useState<string>('all')
    const { t, language } = useLanguage()

    useEffect(() => {
        if (!schoolId) return
        async function loadSubjects() {
            const { data: subjectData } = await supabase.from('subjects').select('id, name, icon').eq('school_id', schoolId).order('name')
            setSubjects(subjectData || [])
        }
        loadSubjects()
    }, [schoolId, supabase])

    useEffect(() => {
        if (!schoolId) return
        const fetchData = async () => {
            setLoading(true)
            try {
                const days = []
                for (let i = 6; i >= 0; i--) {
                    const date = new Date()
                    date.setDate(date.getDate() - i)
                    days.push(date)
                }

                const attendanceData: AttendanceDay[] = []
                for (const day of days) {
                    const startOfDay = new Date(day); startOfDay.setHours(0, 0, 0, 0)
                    const endOfDay = new Date(day); endOfDay.setHours(23, 59, 59, 999)

                    let query = supabase.from('attendance').select('status, classes!inner(school_id)')
                        .eq('classes.school_id', schoolId)
                        .gte('date', startOfDay.toISOString().split('T')[0])
                        .lte('date', endOfDay.toISOString().split('T')[0])

                    if (selectedSubject !== 'all') query = query.eq('subject_id', selectedSubject)

                    const { data: dayData } = await query
                    const records = dayData || []
                    const present = records.filter(r => r.status === 'present').length
                    const absent = records.filter(r => r.status === 'absent').length
                    const total = present + absent
                    const rate = total > 0 ? Math.round((present / total) * 100) : 0

                    attendanceData.push({
                        day: day.toLocaleDateString(language === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR', { weekday: 'short' }),
                        present, absent, rate,
                    })
                }
                setData(attendanceData)
            } catch (error) {
                console.error('Error fetching attendance:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [schoolId, selectedSubject, language])

    const avgRate = data.length > 0
        ? Math.round(data.reduce((sum, d) => sum + d.rate, 0) / data.length)
        : 0

    if (loading) {
        return (
            <div className="bg-[#161B22] border border-white/5 rounded-2xl p-5">
                <div className="h-4 w-32 bg-white/5 rounded mb-6 animate-pulse" />
                <div className="h-32 bg-white/3 rounded animate-pulse" />
            </div>
        )
    }

    return (
        <div className="bg-[#161B22] border border-white/5 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{t('admin.analytics.attendanceWeek')}</p>
                <span className={cn(
                    'text-2xl font-black',
                    avgRate >= 90 ? 'text-emerald-400' : avgRate >= 75 ? 'text-amber-400' : 'text-red-400'
                )}>
                    {avgRate}%
                </span>
            </div>

            {/* Subject filter */}
            {subjects.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-hide">
                    <button
                        onClick={() => setSelectedSubject('all')}
                        className={cn(
                            'shrink-0 px-3 py-1 rounded-lg text-xs font-semibold border transition-colors',
                            selectedSubject === 'all'
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                                : 'bg-white/3 border-white/8 text-gray-500 hover:text-gray-300'
                        )}
                    >
                        Toutes
                    </button>
                    {subjects.map(s => (
                        <button
                            key={s.id}
                            onClick={() => setSelectedSubject(s.id)}
                            className={cn(
                                'shrink-0 px-3 py-1 rounded-lg text-xs font-semibold border transition-colors',
                                selectedSubject === s.id
                                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                                    : 'bg-white/3 border-white/8 text-gray-500 hover:text-gray-300'
                            )}
                        >
                            {s.icon ? `${s.icon} ` : ''}{s.name}
                        </button>
                    ))}
                </div>
            )}

            {/* Heatmap grid */}
            <div className="flex gap-2">
                {data.map((d, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                        <div className={cn(
                            'h-16 w-full rounded-xl flex items-center justify-center text-xs font-bold transition-colors',
                            d.rate >= 90 ? 'bg-emerald-500/15 text-emerald-400' :
                            d.rate >= 75 ? 'bg-amber-500/15 text-amber-400' :
                            d.rate > 0  ? 'bg-red-500/15 text-red-400' :
                                          'bg-white/3 text-gray-600'
                        )}>
                            {d.rate > 0 ? `${d.rate}%` : '—'}
                        </div>
                        <span className="text-[10px] text-gray-600 uppercase capitalize">{d.day}</span>
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div className="flex justify-center gap-4 mt-4 text-[11px] text-gray-600">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded bg-emerald-500/50" /> ≥90%</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded bg-amber-500/50" /> 75–89%</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded bg-red-500/50" /> &lt;75%</span>
            </div>
        </div>
    )
}
