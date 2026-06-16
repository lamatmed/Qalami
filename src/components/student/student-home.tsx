'use client'

import { Bell, BookOpen, ChevronRight, FileText, Trophy, Loader2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { GamificationStats } from '@/components/student/gamification-stats'
import { useStudent } from '@/context/student-context'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useLanguage } from '@/i18n'

interface ScheduleItem {
    time: string
    title: string
    info: string
    type: 'course' | 'break'
}

interface CurrentClass {
    subject: string
    room: string
    teacher: string
    timeRemaining: number
    progress: number
}

export function StudentHome() {
    const { student, loading } = useStudent()
    const [schedule, setSchedule] = useState<ScheduleItem[]>([])
    const [currentClass, setCurrentClass] = useState<CurrentClass | null>(null)
    const [loadingSchedule, setLoadingSchedule] = useState(true)
    const { t } = useLanguage()

    useEffect(() => {
        async function fetchSchedule() {
            if (!student?.class) return

            const supabase = createClient()
            const now = new Date()
            const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay() // Convert to 1-7 format
            const currentTime = now.toTimeString().substring(0, 5) // HH:MM format

            // Get today's schedule for this class
            const { data: scheduleData } = await supabase
                .from('schedule')
                .select(`
                    id,
                    start_time,
                    end_time,
                    room,
                    day_of_week,
                    subjects (name),
                    profiles!schedule_teacher_id_fkey (full_name)
                `)
                .eq('class_id', student.class)
                .eq('day_of_week', dayOfWeek)
                .order('start_time', { ascending: true })

            if (scheduleData && scheduleData.length > 0) {
                // Find current class
                const currentClassData = scheduleData.find(s => {
                    const start = s.start_time?.substring(0, 5)
                    const end = s.end_time?.substring(0, 5)
                    return start && end && currentTime >= start && currentTime <= end
                })

                if (currentClassData) {
                    const endTime = currentClassData.end_time?.substring(0, 5) || '00:00'
                    const [endH, endM] = endTime.split(':').map(Number)
                    const [nowH, nowM] = currentTime.split(':').map(Number)
                    const remaining = (endH * 60 + endM) - (nowH * 60 + nowM)

                    const startTime = currentClassData.start_time?.substring(0, 5) || '00:00'
                    const [startH, startM] = startTime.split(':').map(Number)
                    const totalDuration = (endH * 60 + endM) - (startH * 60 + startM)
                    const elapsed = (nowH * 60 + nowM) - (startH * 60 + startM)
                    const progress = totalDuration > 0 ? Math.round((elapsed / totalDuration) * 100) : 0

                    const subjItem = Array.isArray(currentClassData.subjects) ? currentClassData.subjects[0] : currentClassData.subjects
                    const profItem = Array.isArray(currentClassData.profiles) ? currentClassData.profiles[0] : currentClassData.profiles
                    setCurrentClass({
                        subject: (subjItem as any)?.name || 'Cours',
                        room: currentClassData.room || 'Salle',
                        teacher: (profItem as any)?.full_name || 'Professeur',
                        timeRemaining: remaining,
                        progress: progress
                    })
                }

                // Filter for upcoming classes only
                const upcomingSchedule: ScheduleItem[] = scheduleData
                    .filter(s => (s.start_time?.substring(0, 5) || '') > currentTime)
                    .slice(0, 3)
                    .map(s => {
                        const sSubj = Array.isArray(s.subjects) ? s.subjects[0] : s.subjects
                        const sProf = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles
                        return {
                            time: s.start_time?.substring(0, 5) || '',
                            title: (sSubj as any)?.name || 'Cours',
                            info: `${s.room || 'Salle'} • ${(sProf as any)?.full_name || 'Professeur'}`,
                            type: 'course' as const
                        }
                    })

                setSchedule(upcomingSchedule)
            }

            setLoadingSchedule(false)
        }

        fetchSchedule()
    }, [student?.class])

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }


    return (
        <div className="max-w-md mx-auto lg:max-w-3xl lg:ms-12 lg:me-auto pb-24 space-y-6 p-4 pt-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h1 className="text-2xl font-bold mb-1">{t('student.home.welcome')}, {student?.name || t('common.student')}!</h1>
                    <p className="text-xs text-muted-foreground italic">{t('student.home.quote')}</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="rounded-full bg-card/50 border border-white/5 relative">
                        <Bell className="w-5 h-5 text-gray-400" />
                        <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-cyan-500 rounded-full border-2 border-card" />
                    </Button>
                    <Avatar className="h-10 w-10 border border-white/10">
                        <AvatarImage src={student?.avatar || "https://github.com/shadcn.png"} />
                        <AvatarFallback>{student?.name?.substring(0, 2).toUpperCase() || 'EL'}</AvatarFallback>
                    </Avatar>
                </div>
            </div>

            {/* Hero Card - Active Class */}
            <div className="w-full rounded-[2rem] bg-[#0F1720] border border-white/5 p-6 relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-3xl rounded-full translate-x-10 -translate-y-10" />

                <div className="relative z-10">
                    {currentClass ? (
                        <>
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <span className="inline-block px-3 py-1 rounded-lg bg-[#1A2530] text-cyan-500 text-[10px] font-bold uppercase tracking-wider mb-2 border border-white/5">{t('student.home.now')}</span>
                                    <h2 className="text-2xl font-bold text-white mb-1">{currentClass.subject}</h2>
                                    <p className="text-sm text-gray-400">{currentClass.room} • {currentClass.teacher}</p>
                                </div>
                                <div className="h-12 w-12 rounded-2xl bg-[#1A2530] flex items-center justify-center border border-white/5 text-cyan-500 shadow-lg shadow-black/20">
                                    <BookOpen className="w-6 h-6" />
                                </div>
                            </div>

                            <div className="flex items-end justify-between mb-3">
                                <div>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">{t('student.home.timeRemaining')}</p>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-4xl font-bold text-white tracking-tighter">{currentClass.timeRemaining}</span>
                                        <span className="text-sm font-medium text-gray-400">min</span>
                                    </div>
                                </div>
                            </div>

                            <Progress value={currentClass.progress} className="h-1.5 bg-[#1A2530]" indicatorClassName="bg-cyan-500" />
                        </>
                    ) : (
                        <div className="text-center py-4">
                            <p className="text-gray-400">{t('student.home.noCurrentClass')}</p>
                            <p className="text-xs text-gray-500 mt-1">{student?.className}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Gamification Stats */}
            <GamificationStats />

            {/* Menu Grid */}
            <div className="grid grid-cols-4 gap-3">
                <Link href="/student/courses" className="flex flex-col items-center gap-2 group">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-[#0F1720] border border-white/5 flex items-center justify-center text-blue-500 group-hover:bg-[#1A2530] group-hover:scale-105 transition-all shadow-lg">
                        <BookOpen className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-medium text-gray-400 group-hover:text-gray-200">{t('student.sidebar.courses')}</span>
                </Link>
                <Link href="/student/homework" className="flex flex-col items-center gap-2 group">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-[#0F1720] border border-white/5 flex items-center justify-center text-purple-500 group-hover:bg-[#1A2530] group-hover:scale-105 transition-all shadow-lg">
                        <FileText className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-medium text-gray-400 group-hover:text-gray-200">{t('common.homework')}</span>
                </Link>
                <Link href="/student/grades" className="flex flex-col items-center gap-2 group">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-[#0F1720] border border-white/5 flex items-center justify-center text-amber-500 group-hover:bg-[#1A2530] group-hover:scale-105 transition-all shadow-lg">
                        <Trophy className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-medium text-gray-400 group-hover:text-gray-200">{t('student.home.medals')}</span>
                </Link>
            </div>

            {/* Timeline - Suite du programme */}
            <div className="relative">
                <div className="flex items-center justify-between mb-4 px-1">
                    <h2 className="font-bold text-lg">{t('student.home.upNext')}</h2>
                    <Link href="/student/schedule" className="text-xs text-cyan-500 flex items-center gap-1 group">
                        {t('student.home.viewAll')}
                        <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                </div>

                <div className="space-y-4 pl-2 relative">
                    {/* Vertical Line */}
                    <div className="absolute left-[3px] top-2 bottom-4 w-px bg-white/10" />

                    {schedule.length > 0 ? (
                        schedule.map((item, i) => (
                            <div key={i} className="flex gap-6 relative group">
                                <div className="flex flex-col items-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-600 mt-2 z-10 ring-4 ring-background" />
                                </div>

                                <div className="w-10 pt-0.5 text-xs font-medium text-gray-500">{item.time}</div>

                                <div className={cn(
                                    "flex-1 p-4 rounded-2xl border border-white/5 flex flex-col justify-center transition-colors",
                                    item.type === 'break' ? "bg-white/[0.02]" : "bg-[#0F1720] hover:bg-[#1A2530]"
                                )}>
                                    <h3 className="font-bold text-sm mb-0.5">{item.title}</h3>
                                    <p className="text-[10px] text-muted-foreground">{item.info}</p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-4 text-gray-500 text-sm">
                            {loadingSchedule ? t('common.loading') : t('student.home.noMoreClasses')}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
