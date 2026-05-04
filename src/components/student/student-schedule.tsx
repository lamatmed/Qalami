'use client'

import { useState, useEffect, useMemo } from 'react'
import { Bell, Clock, MapPin, ChevronRight } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import { useStudent } from '@/context/student-context'
import { useLanguage } from '@/i18n'

const SESSION_TYPE_CONFIG: Record<string, { label: string; text: string }> = {
    course:   { label: 'Cours',    text: 'text-blue-400' },
    exam:     { label: 'Examen',   text: 'text-red-400' },
    homework: { label: 'Devoir',   text: 'text-amber-400' },
    revision: { label: 'Révision', text: 'text-purple-400' },
    lab:      { label: 'TP',       text: 'text-emerald-400' },
    activity: { label: 'Activité', text: 'text-cyan-400' },
}

interface ScheduleEntry {
    id: string
    day_of_week: number
    start_time: string
    end_time: string
    room: string | null
    session_type: string | null
    subjects: { name: string; icon?: string | null } | null
    profiles: { full_name: string } | null
}

export function StudentSchedule() {
    const { student, loading: studentLoading } = useStudent()
    const [schedule, setSchedule] = useState<ScheduleEntry[]>([])
    const [loading, setLoading] = useState(true)
    const { t } = useLanguage()
    const [selectedDay, setSelectedDay] = useState(() => {
        const jsDay = new Date().getDay()
        // Convert JS day (0=Sun, 1=Mon, ..., 6=Sat) to DB format (1=Mon, ..., 7=Sun)
        return jsDay === 0 ? 7 : jsDay
    })

    // Generate dates for current week
    const weekDays = useMemo(() => {
        const today = new Date()
        const currentJsDay = today.getDay()
        const monday = new Date(today)
        monday.setDate(today.getDate() - (currentJsDay === 0 ? 6 : currentJsDay - 1))

        return [t('common.mon'), t('common.tue'), t('common.wed'), t('common.thu'), t('common.fri')].map((label, index) => {
            const date = new Date(monday)
            date.setDate(monday.getDate() + index)
            return {
                day: label,
                date: date.getDate().toString(),
                dbDay: index + 1, // 1=Mon, 2=Tue, etc.
                isToday: date.toDateString() === today.toDateString(),
                fullDate: date
            }
        })
    }, [])

    // Format date for display
    const selectedDateDisplay = useMemo(() => {
        const selected = weekDays.find(d => d.dbDay === selectedDay)
        if (!selected) return ''
        const date = selected.fullDate
        return date.toLocaleDateString(t('common.locale') === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    }, [selectedDay, weekDays])

    useEffect(() => {
        const fetchSchedule = async () => {
            if (!student?.class) {
                setLoading(false)
                return
            }

            const supabase = createClient()

            const { data, error } = await supabase
                .from('schedule')
                .select(`
                    id,
                    day_of_week,
                    start_time,
                    end_time,
                    room,
                    session_type,
                    subjects (name, icon),
                    profiles!schedule_teacher_id_fkey (full_name)
                `)
                .eq('class_id', student.class)
                .eq('day_of_week', selectedDay)
                .order('start_time')

            if (error) {
                console.error('[StudentSchedule] Error fetching schedule:', error)
            } else {
                setSchedule(data || [])
            }
            setLoading(false)
        }

        fetchSchedule()
    }, [student?.class, selectedDay])

    // Determine current class status
    const getClassStatus = (startTime: string, endTime: string) => {
        const now = new Date()
        const todayDbDay = now.getDay() === 0 ? 7 : now.getDay()

        if (selectedDay !== todayDbDay) return 'a-venir'

        const [startH, startM] = startTime.split(':').map(Number)
        const [endH, endM] = endTime.split(':').map(Number)
        const currentMinutes = now.getHours() * 60 + now.getMinutes()
        const startMinutes = startH * 60 + startM
        const endMinutes = endH * 60 + endM

        if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
            return 'en-cours'
        } else if (currentMinutes < startMinutes) {
            return 'a-venir'
        }
        return 'termine'
    }

    if (studentLoading) {
        return (
            <div className="max-w-md mx-auto lg:max-w-3xl pb-24 space-y-6 p-4">
                <div className="animate-pulse space-y-4">
                    <div className="h-12 bg-card rounded-xl" />
                    <div className="h-24 bg-card rounded-3xl" />
                    <div className="h-32 bg-card rounded-3xl" />
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-md mx-auto lg:max-w-3xl pb-24 space-y-6 p-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-border">
                        <AvatarImage src={student?.avatar} />
                        <AvatarFallback>{student?.name?.slice(0, 2).toUpperCase() || 'EL'}</AvatarFallback>
                    </Avatar>
                    <span className="font-bold text-lg">{t('common.schedule')}</span>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full relative">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-background" />
                </Button>
            </div>

            {/* Date Selector */}
            <div className="bg-card border border-border/50 p-2 rounded-3xl flex justify-between items-center">
                {weekDays.map((d) => (
                    <div
                        key={d.dbDay}
                        onClick={() => setSelectedDay(d.dbDay)}
                        className={cn(
                            "flex flex-col items-center justify-center w-14 h-20 rounded-2xl transition-all cursor-pointer",
                            selectedDay === d.dbDay
                                ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/20 scale-105"
                                : "hover:bg-white/5 text-muted-foreground"
                        )}
                    >
                        <span className="text-[10px] font-bold mb-1">{d.day}</span>
                        <span className="text-xl font-bold">{d.date}</span>
                        {d.isToday && selectedDay !== d.dbDay && (
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1" />
                        )}
                    </div>
                ))}
            </div>

            <div className="px-1 flex justify-between items-center">
                <h2 className="text-sm font-bold text-gray-400">{selectedDateDisplay}</h2>
                {weekDays.find(d => d.dbDay === selectedDay)?.isToday && (
                    <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-2 py-1 rounded-full font-bold">
                        {t('common.today').toUpperCase()}
                    </span>
                )}
            </div>

            {/* Timeline View */}
            <div className="relative pl-4 space-y-6">
                {/* Timeline Line */}
                <div className="absolute left-[5px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-cyan-500 via-gray-800 to-transparent opacity-30" />

                {loading ? (
                    <div className="py-8 text-center text-muted-foreground">
                        {t('common.loading')}
                    </div>
                ) : schedule.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                        {t('student.schedule.noClasses')}
                    </div>
                ) : (
                    schedule.map((item) => {
                        const status = getClassStatus(item.start_time, item.end_time)
                        const timeRange = `${item.start_time.slice(0, 5)} - ${item.end_time.slice(0, 5)}`
                        const sessionType = item.session_type || 'course'
                        const sessionConfig = SESSION_TYPE_CONFIG[sessionType] || SESSION_TYPE_CONFIG.course

                        return (
                            <div key={item.id} className="relative pl-6">
                                {/* Timeline Dot */}
                                <div className={cn(
                                    "absolute left-[-4px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-4 border-background z-10",
                                    status === 'en-cours' ? "bg-cyan-500 shadow-[0_0_10px_#06b6d4]" :
                                        status === 'termine' ? "bg-gray-600" : "bg-gray-800"
                                )} />

                                <div className={cn(
                                    "p-5 rounded-3xl border transition-all relative overflow-hidden group",
                                    status === 'en-cours'
                                        ? "bg-card border-cyan-500 shadow-lg shadow-cyan-500/5"
                                        : status === 'termine'
                                            ? "bg-card/30 border-border/30 opacity-60"
                                            : "bg-card/50 border-border/50 hover:bg-card hover:border-border"
                                )}>
                                    {status === 'en-cours' && (
                                        <div className="absolute top-4 right-4 animate-pulse">
                                            <span className="w-3 h-3 bg-cyan-500 rounded-full block shadow-[0_0_10px_#06b6d4]" />
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2 mb-2">
                                        {status === 'en-cours' && (
                                            <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-wider">
                                                {t('student.schedule.inProgress')}
                                            </span>
                                        )}
                                        {sessionType !== 'course' && (
                                            <span className={cn("text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-white/5", sessionConfig.text)}>
                                                {sessionConfig.label}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            {item.subjects?.icon && (
                                                <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center font-bold text-sm text-cyan-400 shrink-0">
                                                    {item.subjects.icon}
                                                </div>
                                            )}
                                            <div>
                                                <h3 className="font-bold text-lg mb-1">
                                                    {item.subjects?.name || 'Cours'}
                                                </h3>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <Avatar className="w-4 h-4">
                                                        <AvatarFallback className="text-[8px]">
                                                            {item.profiles?.full_name?.split(' ').map(n => n[0]).join('') || 'PR'}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    {item.profiles?.full_name || 'Professeur'}
                                                </div>
                                            </div>
                                        </div>
                                        {status === 'en-cours' && (
                                            <div className="w-16 h-16 bg-cyan-500/10 rounded-2xl flex items-center justify-center border border-cyan-500/20">
                                                <Clock className="w-8 h-8 text-cyan-500 opacity-50" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-4 text-xs font-medium text-gray-400 bg-black/20 p-3 rounded-xl border border-white/5">
                                        <span className="flex items-center gap-2">
                                            <Clock className="w-3.5 h-3.5 text-cyan-500" /> {timeRange}
                                        </span>
                                        <span className="flex items-center gap-2">
                                            <MapPin className="w-3.5 h-3.5 text-emerald-500" /> {item.room || 'Salle TBD'}
                                        </span>
                                    </div>

                                    <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
