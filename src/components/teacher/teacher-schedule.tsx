'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Calendar, ChevronLeft, ChevronRight, Clock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useTeacher } from '@/context/teacher-context'
import { createClient } from '@/utils/supabase/client'
import { useLanguage } from '@/i18n'
import { getSessionConfig } from '@/lib/schedule-constants'

interface ScheduleItem {
    id: string
    time: string
    endTime: string
    subject: string
    subjectIcon: string | null
    className: string
    classId: string
    room: string
    status: 'done' | 'current' | 'upcoming'
    sessionType: string
}

interface DayInfo {
    date: number
    day: string
    dayOfWeek: number
    active: boolean
    fullDate: Date
}

export function TeacherSchedule() {
    const { teacherId, loading } = useTeacher()
    const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([])
    const [loadingSchedule, setLoadingSchedule] = useState(true)
    const { t } = useLanguage()
    const [days, setDays] = useState<DayInfo[]>([])
    const [selectedDay, setSelectedDay] = useState<number>(0)
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(new Date())

    // Initialize week days
    useEffect(() => {
        const now = new Date()
        // Get Monday of current week
        const day = now.getDay()
        const diff = now.getDate() - day + (day === 0 ? -6 : 1)
        const monday = new Date(now.setDate(diff))
        monday.setHours(0, 0, 0, 0)
        setCurrentWeekStart(new Date(monday))

        updateDays(monday)

        // Set today as selected if it's a weekday
        const todayDayOfWeek = new Date().getDay()
        if (todayDayOfWeek >= 1 && todayDayOfWeek <= 5) {
            setSelectedDay(todayDayOfWeek - 1) // 0-indexed for Mon-Fri
        }
    }, [])

    const updateDays = (weekStart: Date) => {
        const dayNames = [t('common.mon'), t('common.tue'), t('common.wed'), t('common.thu'), t('common.fri')]
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const newDays: DayInfo[] = []
        for (let i = 0; i < 5; i++) {
            const date = new Date(weekStart)
            date.setDate(weekStart.getDate() + i)
            newDays.push({
                date: date.getDate(),
                day: dayNames[i],
                dayOfWeek: i + 1, // 1-5 for Mon-Fri
                active: date.getTime() === today.getTime(),
                fullDate: date
            })
        }
        setDays(newDays)
    }

    const navigateWeek = (direction: 'prev' | 'next') => {
        const newStart = new Date(currentWeekStart)
        newStart.setDate(newStart.getDate() + (direction === 'next' ? 7 : -7))
        setCurrentWeekStart(newStart)
        updateDays(newStart)
    }

    // Fetch schedule when day changes
    useEffect(() => {
        async function fetchSchedule() {
            if (!teacherId || days.length === 0) return

            setLoadingSchedule(true)
            const supabase = createClient()

            try {
                const targetDay = days[selectedDay]
                if (!targetDay) return

                const { data: schedules, error } = await supabase
                    .from('schedule')
                    .select(`
                        id,
                        class_id,
                        start_time,
                        end_time,
                        room,
                        session_type,
                        subjects (name, icon),
                        classes (name)
                    `)
                    .eq('teacher_id', teacherId)
                    .eq('day_of_week', targetDay.dayOfWeek)
                    .order('start_time', { ascending: true })

                if (error) {
                    console.error('Error fetching schedule:', error)
                    setScheduleItems([])
                    return
                }

                if (schedules && schedules.length > 0) {
                    const now = new Date()
                    const currentTimeStr = now.toTimeString().slice(0, 5)
                    const isToday = targetDay.fullDate.toDateString() === now.toDateString()

                    const items: ScheduleItem[] = schedules.map(s => {
                        let status: 'done' | 'current' | 'upcoming' = 'upcoming'

                        if (isToday) {
                            const startTime = s.start_time?.slice(0, 5) || '00:00'
                            const endTime = s.end_time?.slice(0, 5) || '00:00'

                            if (endTime <= currentTimeStr) {
                                status = 'done'
                            } else if (startTime <= currentTimeStr && endTime > currentTimeStr) {
                                status = 'current'
                            }
                        } else if (targetDay.fullDate < now) {
                            status = 'done'
                        }

                        return {
                            id: s.id,
                            time: s.start_time?.slice(0, 5) || '',
                            endTime: s.end_time?.slice(0, 5) || '',
                            subject: (s.subjects as { name?: string })?.name || 'Cours',
                            subjectIcon: (s.subjects as { icon?: string | null })?.icon || null,
                            className: (s.classes as { name?: string })?.name || 'Classe',
                            classId: s.class_id,
                            room: s.room || '',
                            status,
                            sessionType: (s as any).session_type || 'course'
                        }
                    })

                    setScheduleItems(items)
                } else {
                    setScheduleItems([])
                }
            } catch (err) {
                console.error('Error:', err)
                setScheduleItems([])
            }

            setLoadingSchedule(false)
        }

        if (!loading && days.length > 0) {
            fetchSchedule()
        }
    }, [teacherId, loading, days, selectedDay])

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="max-w-md mx-auto lg:max-w-3xl space-y-6 pb-24">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold">{t('common.schedule')}</h1>
                <Button variant="ghost" size="icon">
                    <Calendar className="w-5 h-5" />
                </Button>
            </div>

            {/* Date Strip */}
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigateWeek('prev')}>
                    <ChevronLeft className="w-5 h-5" />
                </Button>
                <div className="flex justify-between flex-1 items-center bg-card p-4 rounded-3xl border border-white/5">
                    {days.map((d, i) => (
                        <div
                            key={i}
                            onClick={() => setSelectedDay(i)}
                            className={cn(
                                "flex flex-col items-center justify-center w-12 h-16 rounded-2xl transition-all cursor-pointer",
                                selectedDay === i ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30 scale-110" :
                                    d.active ? "bg-emerald-500/20 text-emerald-400" : "text-muted-foreground hover:bg-white/5"
                            )}
                        >
                            <span className="text-xs font-medium mb-1">{d.day}</span>
                            <span className="text-lg font-bold">{d.date}</span>
                        </div>
                    ))}
                </div>
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigateWeek('next')}>
                    <ChevronRight className="w-5 h-5" />
                </Button>
            </div>

            {/* Timeline */}
            {loadingSchedule ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : scheduleItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>{t('teacher.schedule.noClasses')}</p>
                </div>
            ) : (
                <div className="space-y-6 relative pl-4">
                    {/* Vertical Line */}
                    <div className="absolute left-[23px] top-4 bottom-0 w-0.5 bg-border/50" />

                    {scheduleItems.map((item) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="relative pl-8"
                        >
                            {/* Dot */}
                            <div className={cn(
                                "absolute left-2.5 top-6 w-3 h-3 -translate-x-1/2 rounded-full border-2 border-background z-10",
                                item.status === 'current' ? "bg-purple-500 shadow-[0_0_10px_#a855f7]" :
                                    item.status === 'done' ? "bg-emerald-500" : "bg-gray-600"
                            )} />

                            <div className="mb-2 text-xs font-mono text-muted-foreground pl-1">{item.time} - {item.endTime}</div>

                            <div className={cn(
                                "p-5 rounded-3xl border transition-all",
                                item.status === 'current'
                                    ? "bg-black border-purple-500/50 shadow-2xl relative overflow-hidden"
                                    : "bg-card border-white/5"
                            )}>
                                {/* Glow for current item */}
                                {item.status === 'current' && (
                                    <div className="absolute -right-10 -top-10 w-32 h-32 bg-purple-600/20 blur-3xl rounded-full pointer-events-none" />
                                )}

                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                {item.status === 'current' && (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 text-[10px] font-bold tracking-wider border border-purple-500/20">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                                                        {t('teacher.schedule.inProgress').toUpperCase()}
                                                    </span>
                                                )}
                                                {item.status === 'done' && <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">{t('student.schedule.completed')}</span>}
                                                {item.status === 'upcoming' && <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">{t('student.schedule.upcoming')}</span>}
                                                {item.sessionType !== 'course' && (
                                                    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/5", getSessionConfig(item.sessionType).text)}>
                                                        {getSessionConfig(item.sessionType).label}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {item.subjectIcon && (
                                                    <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-purple-500/10 border border-purple-500/20 font-bold text-xs text-purple-300">
                                                        {item.subjectIcon}
                                                    </span>
                                                )}
                                                <h3 className={cn("text-lg font-bold", item.status === 'current' ? "text-white" : "text-foreground")}>
                                                    {item.subject}
                                                </h3>
                                            </div>
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                                            {item.status === 'done' ? <div className="text-emerald-500">✓</div> : <Clock className="w-4 h-4 text-muted-foreground" />}
                                        </div>
                                    </div>

                                    <div className={cn("flex gap-4 text-sm", item.status === 'current' ? "text-gray-300" : "text-muted-foreground")}>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] uppercase opacity-50">{t('common.classes')}</span>
                                            <span className="font-medium">{item.className}</span>
                                        </div>
                                        {item.room && (
                                            <div className="flex flex-col">
                                                <span className="text-[10px] uppercase opacity-50">{t('admin.schedule.room')}</span>
                                                <span className="font-medium">{item.room}</span>
                                            </div>
                                        )}
                                    </div>

                                    {item.status === 'current' && (
                                        <Link href={`/teacher/classes/${item.classId}`} className="w-full mt-5 block">
                                            <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-12 font-medium shadow-lg shadow-purple-600/20">
                                                {t('teacher.schedule.takeAttendance')}
                                            </Button>
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    )
}
