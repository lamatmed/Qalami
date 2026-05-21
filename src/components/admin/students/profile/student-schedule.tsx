'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Loader2, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/i18n'

interface ScheduleEntry {
    id: string
    day_of_week: number
    start_time: string
    end_time: string
    room: string | null
    subjects: { name: string } | null
    teacher: { full_name: string | null } | null
}

const DAYS = [
    { index: 0, label: 'Dimanche',  short: 'Dim' },
    { index: 1, label: 'Lundi',     short: 'Lun' },
    { index: 2, label: 'Mardi',     short: 'Mar' },
    { index: 3, label: 'Mercredi',  short: 'Mer' },
    { index: 4, label: 'Jeudi',     short: 'Jeu' },
    { index: 5, label: 'Vendredi',  short: 'Ven' },
    { index: 6, label: 'Samedi',    short: 'Sam' },
]

const SUBJECT_COLORS = [
    'bg-indigo-50 border-indigo-200/80 text-indigo-900',
    'bg-emerald-50 border-emerald-200/80 text-emerald-900',
    'bg-sky-50 border-sky-200/80 text-sky-900',
    'bg-purple-50 border-purple-200/80 text-purple-900',
    'bg-amber-50 border-amber-200/80 text-amber-900',
    'bg-rose-50 border-rose-200/80 text-rose-900',
    'bg-cyan-50 border-cyan-200/80 text-cyan-900',
    'bg-orange-50 border-orange-200/80 text-orange-900',
]

function formatTime(t: string) {
    return t?.slice(0, 5) ?? '—'
}

export function StudentSchedule({ studentId }: { studentId: string }) {
    const { t, language } = useLanguage()
    const [schedule, setSchedule] = useState<ScheduleEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedDay, setSelectedDay] = useState<number>(() => {
        const d = new Date().getDay()
        return d
    })

    useEffect(() => {
        async function load() {
            const supabase = createClient()

            // Get active enrollment → class_id
            const { data: enrollment } = await supabase
                .from('enrollments')
                .select('class_id')
                .eq('student_id', studentId)
                .eq('status', 'active')
                .maybeSingle()

            if (!enrollment?.class_id) { setLoading(false); return }

            const { data } = await supabase
                .from('schedule')
                .select(`
                    id, day_of_week, start_time, end_time, room,
                    subjects ( name ),
                    teacher:profiles!schedule_teacher_id_fkey ( full_name )
                `)
                .eq('class_id', enrollment.class_id)
                .eq('session_type', 'course')
                .order('day_of_week')
                .order('start_time')

            if (data) setSchedule(data as unknown as ScheduleEntry[])
            setLoading(false)
        }
        load()
    }, [studentId])

    // Color map per subject name
    const subjectColors = useMemo(() => {
        const map = new Map<string, string>()
        let idx = 0
        schedule.forEach(s => {
            const name = s.subjects?.name ?? ''
            if (name && !map.has(name)) {
                map.set(name, SUBJECT_COLORS[idx % SUBJECT_COLORS.length])
                idx++
            }
        })
        return map
    }, [schedule])

    // Days that have sessions
    const activeDays = useMemo(() => {
        const set = new Set(schedule.map(s => s.day_of_week))
        return DAYS.filter(d => set.has(d.index))
    }, [schedule])

    const daySchedule = schedule.filter(s => s.day_of_week === selectedDay)

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
        </div>
    )

    if (schedule.length === 0) return (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-200/80 shadow-sm">
            <CalendarDays className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">{t('admin.students.profile.noSchedule')}</p>
            <p className="text-xs text-slate-400 mt-1">{t('admin.students.profile.noActiveClass')}</p>
        </div>
    )

    return (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Week summary */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200/50 p-4 text-center shadow-sm">
                    <p className="text-2xl font-black text-emerald-800">{schedule.length}</p>
                    <p className="text-[10px] text-emerald-700/80 font-bold uppercase mt-1">{t('admin.students.profile.sessionsPerWeek')}</p>
                </div>
                <div className="bg-gradient-to-br from-sky-50 to-blue-50 rounded-2xl border border-sky-200/50 p-4 text-center shadow-sm">
                    <p className="text-2xl font-black text-sky-800">{activeDays.length}</p>
                    <p className="text-[10px] text-sky-700/80 font-bold uppercase mt-1">{t('admin.students.profile.classDays')}</p>
                </div>
            </div>

            {/* Day selector */}
            <div className="flex gap-2 overflow-x-auto pb-1">
                {activeDays.map(day => {
                    const count = schedule.filter(s => s.day_of_week === day.index).length
                    return (
                        <button
                            key={day.index}
                            onClick={() => setSelectedDay(day.index)}
                            className={cn(
                                "flex-shrink-0 px-4 py-2.5 rounded-xl border text-center transition-all min-w-[72px]",
                                selectedDay === day.index
                                    ? "bg-emerald-50 border-emerald-500/50 text-emerald-700 font-bold shadow-sm"
                                    : "bg-white border-slate-200/80 text-slate-500 hover:text-slate-800 hover:bg-slate-50 shadow-sm"
                            )}
                        >
                            <p className="text-xs font-bold">{day.short}</p>
                            <p className={cn("text-[10px] mt-0.5", selectedDay === day.index ? "text-emerald-600/90 font-medium" : "text-slate-400")}>
                                {count} {t('admin.students.profile.courses')}
                            </p>
                        </button>
                    )
                })}
            </div>

            {/* Day detail */}
            <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                    <p className="text-sm font-bold text-slate-900">
                        {DAYS.find(d => d.index === selectedDay)?.label}
                    </p>
                    <p className="text-xs text-slate-500">{daySchedule.length} {t('admin.students.profile.sessions')}</p>
                </div>

                {daySchedule.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-sm font-medium">{t('admin.students.profile.noCourseThisDay')}</div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {daySchedule.map(entry => {
                            const subjectName = entry.subjects?.name ?? t('common.subjects')
                            const color = subjectColors.get(subjectName) ?? SUBJECT_COLORS[0]
                            return (
                                <div key={entry.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/30 transition-colors">
                                    {/* Time */}
                                    <div className="text-center shrink-0 w-14">
                                        <p className="text-xs font-bold text-slate-800">{formatTime(entry.start_time)}</p>
                                        <div className="w-px h-4 bg-slate-200 mx-auto my-1" />
                                        <p className="text-xs text-slate-500 font-medium">{formatTime(entry.end_time)}</p>
                                    </div>

                                    {/* Subject pill */}
                                    <div className={cn("flex-1 min-w-0 px-4 py-3 rounded-xl border shadow-sm", color)}>
                                        <p className="font-bold text-sm">{subjectName}</p>
                                        <div className="flex items-center gap-3 mt-1">
                                            {entry.teacher?.full_name && (
                                                <p className="text-[11px] opacity-85 font-medium">{entry.teacher.full_name}</p>
                                            )}
                                            {entry.room && (
                                                <p className="text-[11px] opacity-75">{t('admin.schedule.room')} {entry.room}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* All subjects legend */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">{t('common.subjects')}</p>
                <div className="flex flex-wrap gap-2">
                    {Array.from(subjectColors.entries()).map(([name, color]) => (
                        <span key={name} className={cn("text-xs font-semibold px-2.5 py-1 rounded-lg border shadow-sm", color)}>
                            {name}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    )
}
