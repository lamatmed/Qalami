'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Loader2, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'

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
    'bg-indigo-500/20 border-indigo-500/30 text-indigo-300',
    'bg-emerald-500/20 border-emerald-500/30 text-emerald-300',
    'bg-blue-500/20 border-blue-500/30 text-blue-300',
    'bg-purple-500/20 border-purple-500/30 text-purple-300',
    'bg-amber-500/20 border-amber-500/30 text-amber-300',
    'bg-rose-500/20 border-rose-500/30 text-rose-300',
    'bg-cyan-500/20 border-cyan-500/30 text-cyan-300',
    'bg-orange-500/20 border-orange-500/30 text-orange-300',
]

function formatTime(t: string) {
    return t?.slice(0, 5) ?? '—'
}

export function StudentSchedule({ studentId }: { studentId: string }) {
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
        <div className="text-center py-20 bg-[#1A2530] rounded-3xl border border-white/5">
            <CalendarDays className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Aucun emploi du temps disponible</p>
            <p className="text-xs text-gray-600 mt-1">L'élève n'a pas de classe active assignée.</p>
        </div>
    )

    return (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Week summary */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#1A2530] rounded-2xl border border-white/5 p-4 text-center">
                    <p className="text-2xl font-black text-white">{schedule.length}</p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">Séances / semaine</p>
                </div>
                <div className="bg-[#1A2530] rounded-2xl border border-white/5 p-4 text-center">
                    <p className="text-2xl font-black text-white">{activeDays.length}</p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">Jours de cours</p>
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
                                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                                    : "bg-[#1A2530] border-white/5 text-gray-500 hover:text-white hover:border-white/20"
                            )}
                        >
                            <p className="text-xs font-bold">{day.short}</p>
                            <p className={cn("text-[10px] mt-0.5", selectedDay === day.index ? "text-emerald-600" : "text-gray-600")}>
                                {count} cours
                            </p>
                        </button>
                    )
                })}
            </div>

            {/* Day detail */}
            <div className="bg-[#1A2530] rounded-3xl border border-white/5 overflow-hidden">
                <div className="px-5 py-3 border-b border-white/5">
                    <p className="text-sm font-bold text-white">
                        {DAYS.find(d => d.index === selectedDay)?.label}
                    </p>
                    <p className="text-xs text-gray-500">{daySchedule.length} séance{daySchedule.length !== 1 ? 's' : ''}</p>
                </div>

                {daySchedule.length === 0 ? (
                    <div className="text-center py-10 text-gray-600 text-sm">Pas de cours ce jour</div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {daySchedule.map(entry => {
                            const subjectName = entry.subjects?.name ?? 'Matière'
                            const color = subjectColors.get(subjectName) ?? SUBJECT_COLORS[0]
                            return (
                                <div key={entry.id} className="flex items-center gap-4 px-5 py-4 hover:bg-[#0F1720] transition-colors">
                                    {/* Time */}
                                    <div className="text-center shrink-0 w-14">
                                        <p className="text-xs font-bold text-white">{formatTime(entry.start_time)}</p>
                                        <div className="w-px h-4 bg-white/10 mx-auto my-1" />
                                        <p className="text-xs text-gray-600">{formatTime(entry.end_time)}</p>
                                    </div>

                                    {/* Subject pill */}
                                    <div className={cn("flex-1 min-w-0 px-4 py-3 rounded-xl border", color)}>
                                        <p className="font-bold text-sm">{subjectName}</p>
                                        <div className="flex items-center gap-3 mt-1">
                                            {entry.teacher?.full_name && (
                                                <p className="text-[11px] opacity-70">{entry.teacher.full_name}</p>
                                            )}
                                            {entry.room && (
                                                <p className="text-[11px] opacity-60">Salle {entry.room}</p>
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
            <div className="bg-[#1A2530] rounded-2xl border border-white/5 p-4">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">Matières</p>
                <div className="flex flex-wrap gap-2">
                    {Array.from(subjectColors.entries()).map(([name, color]) => (
                        <span key={name} className={cn("text-xs font-medium px-2.5 py-1 rounded-lg border", color)}>
                            {name}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    )
}
