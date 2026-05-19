'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Calendar, ChevronLeft, ChevronRight, Clock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useTeacher } from '@/context/teacher-context'
import { useLanguage } from '@/i18n'
import { getSessionConfig } from '@/lib/schedule-constants'
import { getTeacherScheduleAction } from '@/app/teacher/actions'

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
    schoolName: string
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
    const { t, direction } = useLanguage()
    const [days, setDays] = useState<DayInfo[]>([])
    const [selectedDay, setSelectedDay] = useState<number>(0)
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(new Date())

    // Initialize week days with 7-day support
    useEffect(() => {
        const now = new Date()
        // Get Monday of current week
        const day = now.getDay()
        const diff = now.getDate() - day + (day === 0 ? -6 : 1)
        const monday = new Date(now.setDate(diff))
        monday.setHours(0, 0, 0, 0)
        setCurrentWeekStart(new Date(monday))

        updateDays(monday)

        // Set today as selected automatically
        const todayDayOfWeek = new Date().getDay() // 0=Sun, 1=Mon...6=Sat
        // Map Sun(0)->6, Mon(1)->0, Tue(2)->1, etc.
        const relativeIndex = todayDayOfWeek === 0 ? 6 : todayDayOfWeek - 1
        setSelectedDay(relativeIndex)
    }, [])

    const updateDays = (weekStart: Date) => {
        const dayNames = [
            t('common.mon'), 
            t('common.tue'), 
            t('common.wed'), 
            t('common.thu'), 
            t('common.fri'), 
            t('common.sat'), 
            t('common.sun')
        ]
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const newDays: DayInfo[] = []
        // Loop across all 7 days
        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart)
            date.setDate(weekStart.getDate() + i)
            
            // Convert JS date.getDay() [0=Sun, 1=Mon...] into DB standard [1=Mon, 7=Sun]
            const rawDay = date.getDay()
            const dbDayOfWeek = rawDay === 0 ? 7 : rawDay

            newDays.push({
                date: date.getDate(),
                day: dayNames[i] || 'Day',
                dayOfWeek: dbDayOfWeek,
                active: date.getTime() === today.getTime(),
                fullDate: date
            })
        }
        setDays(newDays)
    }

    const navigateWeek = (dir: 'prev' | 'next') => {
        const newStart = new Date(currentWeekStart)
        newStart.setDate(newStart.getDate() + (dir === 'next' ? 7 : -7))
        setCurrentWeekStart(newStart)
        updateDays(newStart)
    }

    // Fetch schedule items dynamically when days update or selection changes
    useEffect(() => {
        async function fetchSchedule() {
            if (!teacherId || days.length === 0) return

            setLoadingSchedule(true)

            try {
                const targetDay = days[selectedDay]
                if (!targetDay) return

                // Fetch from server action
                const schedules = await getTeacherScheduleAction(teacherId, targetDay.dayOfWeek)

                if (schedules && schedules.length > 0) {
                    const now = new Date()
                    const currentTimeStr = now.toTimeString().slice(0, 5)
                    const isToday = targetDay.fullDate.toDateString() === now.toDateString()

                    const items: ScheduleItem[] = schedules.map((s: any) => {
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
                            sessionType: (s as any).session_type || 'course',
                            schoolName: (s.schools as { name?: string })?.name || ''
                        }
                    })

                    setScheduleItems(items)
                } else {
                    setScheduleItems([])
                }
            } catch (err) {
                console.error('Error loading schedule:', err)
                setScheduleItems([])
            }

            setLoadingSchedule(false)
        }

        if (!loading && days.length > 0 && teacherId) {
            fetchSchedule()
        }
    }, [teacherId, loading, days, selectedDay])

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        )
    }

    return (
        <div className="max-w-md mx-auto lg:max-w-3xl space-y-8 pb-24 select-none">
            {/* Layout Title */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 shadow-sm">
                        <Calendar className="w-5 h-5" />
                    </div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-850">{t('common.schedule')}</h1>
                </div>
            </div>

            {/* Date Strip (Light Classic Theme) */}
            <div className={cn("flex items-center gap-3", direction === 'rtl' && "flex-row-reverse")}>
                <Button 
                    variant="outline" 
                    size="icon" 
                    className="shrink-0 border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-2xl w-12 h-16 shadow-sm transition-all active:scale-95" 
                    onClick={() => navigateWeek('prev')}
                >
                    <ChevronLeft className="w-5 h-5" />
                </Button>
                
                <div className="flex justify-between flex-1 items-center bg-white p-2.5 py-3.5 rounded-3xl border border-slate-150 shadow-sm overflow-x-auto gap-2 scrollbar-hide">
                    {days.map((d, i) => (
                        <div
                            key={i}
                            onClick={() => setSelectedDay(i)}
                            className={cn(
                                "flex flex-col items-center justify-center min-w-[3.5rem] flex-1 h-16 rounded-2xl transition-all duration-250 cursor-pointer",
                                selectedDay === i 
                                    ? "bg-gradient-to-b from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-500/25 scale-105 border border-indigo-500/20" 
                                    : d.active 
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold shadow-[0_1px_4px_rgba(16,185,129,0.05)]" 
                                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent"
                            )}
                        >
                            <span className={cn(
                                "text-[10px] font-extrabold uppercase tracking-wider mb-1 opacity-80",
                                selectedDay === i ? "text-indigo-100" : ""
                            )}>{d.day}</span>
                            <span className="text-base font-black">{d.date}</span>
                        </div>
                    ))}
                </div>

                <Button 
                    variant="outline" 
                    size="icon" 
                    className="shrink-0 border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-2xl w-12 h-16 shadow-sm transition-all active:scale-95" 
                    onClick={() => navigateWeek('next')}
                >
                    <ChevronRight className="w-5 h-5" />
                </Button>
            </div>

            {/* Timeline Blocks */}
            {loadingSchedule ? (
                <div className="flex justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                </div>
            ) : scheduleItems.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 shadow-sm max-w-md mx-auto">
                    <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400 shadow-inner">
                        <Calendar className="w-8 h-8 opacity-60" />
                    </div>
                    <p className="font-bold text-slate-500">{t('teacher.schedule.noClasses')}</p>
                </div>
            ) : (
                <div className="space-y-6 relative pl-4 pr-2">
                    {/* Clean Gradient Guideline Track */}
                    <div className="absolute left-[23px] top-4 bottom-0 w-0.5 bg-gradient-to-b from-indigo-500/40 via-sky-400/20 to-slate-100" />

                    {scheduleItems.map((item) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="relative pl-9 pb-2"
                        >
                            {/* High-Contrast Bullet Connector */}
                            <div className={cn(
                                "absolute left-2.5 top-6 w-3.5 h-3.5 -translate-x-1/2 rounded-full border-2 border-white z-20 transition-all shadow-md",
                                item.status === 'current' 
                                    ? "bg-indigo-500 ring-4 ring-indigo-100 scale-110 shadow-indigo-500/20" 
                                    : item.status === 'done' 
                                        ? "bg-emerald-500 shadow-emerald-500/10" 
                                        : "bg-sky-500 shadow-sky-500/10"
                            )} />

                            {/* Classic Floating Time Badge */}
                            <div className="mb-3 pl-0.5">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-extrabold text-slate-700 font-mono shadow-[0_1px_2px_rgba(0,0,0,0.02)] tracking-wide">
                                    <Clock className="w-3.5 h-3.5 text-indigo-500" /> {item.time} — {item.endTime}
                                </span>
                            </div>

                            {/* Main Card Structure */}
                            <div className={cn(
                                "p-6 rounded-3xl border transition-all duration-300",
                                item.status === 'current'
                                    ? "bg-white border-indigo-200 shadow-[0_12px_30px_rgba(99,102,241,0.08)] relative overflow-hidden group hover:border-indigo-300"
                                    : "bg-white border-slate-150 hover:border-slate-200 shadow-sm hover:shadow-md"
                            )}>
                                {/* Elegant Subtle Background Radial Gradient for Active Class */}
                                {item.status === 'current' && (
                                    <div className="absolute -right-20 -top-20 w-48 h-48 bg-indigo-500/5 blur-3xl rounded-full pointer-events-none" />
                                )}

                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-4 gap-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                {item.status === 'current' && (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-extrabold tracking-wider border border-indigo-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)] uppercase">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_4px_rgba(99,102,241,0.5)]" />
                                                        {t('teacher.schedule.inProgress')}
                                                    </span>
                                                )}
                                                {item.status === 'done' && (
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold tracking-wider border border-emerald-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)] uppercase">
                                                        {t('teacher.schedule.completed')}
                                                    </span>
                                                )}
                                                {item.status === 'upcoming' && (
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 text-[10px] font-extrabold tracking-wider border border-sky-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)] uppercase">
                                                        {t('teacher.schedule.upcoming')}
                                                    </span>
                                                )}
                                                {item.sessionType !== 'course' && (
                                                    <span className={cn(
                                                        "text-[10px] font-extrabold px-2 py-1 rounded-full bg-slate-50 border border-slate-150 text-slate-600 uppercase tracking-wider",
                                                        getSessionConfig(item.sessionType).text
                                                    )}>
                                                        {getSessionConfig(item.sessionType).label}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2.5">
                                                {item.subjectIcon && (
                                                    <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 font-bold text-xs text-indigo-600 shadow-inner">
                                                        {item.subjectIcon}
                                                    </span>
                                                )}
                                                <h3 className="text-xl font-black tracking-tight text-slate-800">
                                                    {item.subject}
                                                </h3>
                                            </div>
                                        </div>
                                        
                                        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 shrink-0 shadow-inner">
                                            {item.status === 'done' 
                                                ? <span className="text-emerald-600 font-black text-sm">✓</span> 
                                                : <Clock className="w-4 h-4 text-slate-400" />
                                            }
                                        </div>
                                    </div>

                                    {/* Card Metadata Details Container */}
                                    <div className="flex flex-wrap gap-x-6 gap-y-4 text-sm mt-4 pt-4 border-t border-slate-100 text-slate-700">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[10px] uppercase tracking-widest font-extrabold text-slate-400">{t('common.classes')}</span>
                                            <span className="font-black text-lg text-slate-800 tracking-wide">{item.className}</span>
                                        </div>
                                        
                                        {item.schoolName && (
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] uppercase tracking-widest font-extrabold text-slate-400">{t('common.school') || 'École'}</span>
                                                <span className={cn(
                                                    "font-black text-xs px-2.5 py-1 rounded-lg inline-block border tracking-wide shadow-[0_1px_3px_rgba(0,0,0,0.02)] whitespace-nowrap transition-colors",
                                                    item.status === 'current'
                                                        ? "bg-amber-50 text-amber-700 border-amber-200"
                                                        : "bg-slate-50 text-slate-700 border-slate-200"
                                                )}>
                                                    {item.schoolName}
                                                </span>
                                            </div>
                                        )}
                                        
                                        {item.room && (
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-[10px] uppercase tracking-widest font-extrabold text-slate-400">{t('admin.schedule.room')}</span>
                                                <span className="font-bold text-slate-700 text-sm mt-0.5 tracking-wide">{t('teacher.classes.details.room')?.replace('{room}', item.room) || `Salle ${item.room}`}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Quick Action Action Link */}
                                    {item.status === 'current' && (
                                        <Link href={`/teacher/classes/${item.classId}`} className="w-full mt-5 block">
                                            <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11 font-black text-sm tracking-wide shadow-md shadow-indigo-600/15 active:scale-[0.98] transition-all border border-indigo-500/10">
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
