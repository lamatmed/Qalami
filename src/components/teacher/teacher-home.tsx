'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bell, BookOpen, CheckSquare, Clock, MessageSquare, User, Users, ArrowRight, Loader2, BrainCircuit, Sparkles, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useTeacher } from '@/context/teacher-context'
import { createClient } from '@/utils/supabase/client'
import { useLanguage } from '@/i18n'
import { getTeacherScheduleAction } from '@/app/teacher/actions'
import { cn } from '@/lib/utils'

interface NextClass {
    id: string
    subject: string
    className: string
    room: string
    startTime: string
    endTime: string
    classId: string
    schoolName: string
}

interface TeacherStats {
    remainingClasses: number
    pendingAttendance: number
    remarksCount: number
}

export function TeacherHome() {
    const { t, direction } = useLanguage()
    const { teacherId, teacherName, loading, classes, schoolId } = useTeacher()
    const [nextClass, setNextClass] = useState<NextClass | null>(null)
    const [stats, setStats] = useState<TeacherStats>({ remainingClasses: 0, pendingAttendance: 0, remarksCount: 0 })
    const [loadingData, setLoadingData] = useState(true)
    const [currentTime, setCurrentTime] = useState(new Date())

    const isRTL = direction === 'rtl'

    useEffect(() => {
        // Update time every minute
        const timer = setInterval(() => setCurrentTime(new Date()), 60000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        async function fetchTeacherData() {
            if (!teacherId) return
 
            setLoadingData(true)
 
            try {
                // Get today's day of week (1=Mon, 7=Sun)
                const now = new Date()
                let dayOfWeek = now.getDay()
                dayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek
 
                const currentTimeStr = now.toTimeString().slice(0, 5)
 
                // Fetch today's schedule for this teacher across all authorized schools
                const todaySchedule = await getTeacherScheduleAction(teacherId, dayOfWeek)
 
                if (todaySchedule && todaySchedule.length > 0) {
                    // Calculate remaining classes
                    const remaining = todaySchedule.filter((s: any) => s.end_time > currentTimeStr).length
 
                    // Find next class (first one that hasn't ended)
                    const next = todaySchedule.find((s: any) => s.end_time > currentTimeStr)
                    if (next) {
                        setNextClass({
                            id: next.id,
                            subject: (next.subjects as { name?: string })?.name || 'Cours',
                            className: (next.classes as { name?: string })?.name || 'Classe',
                            room: next.room || '',
                            startTime: next.start_time?.slice(0, 5) || '',
                            endTime: next.end_time?.slice(0, 5) || '',
                            classId: next.class_id,
                            schoolName: (next.schools as { name?: string })?.name || ''
                        })
                    } else {
                        setNextClass(null)
                    }
 
                    // Calculate pending attendance
                    const startedClasses = todaySchedule.filter((s: any) =>
                        s.start_time <= currentTimeStr && s.end_time > currentTimeStr
                    )
                    const pendingCount = startedClasses.length
 
                    setStats({
                        remainingClasses: remaining,
                        pendingAttendance: pendingCount,
                        remarksCount: 0
                    })
                } else {
                    setStats({ remainingClasses: 0, pendingAttendance: 0, remarksCount: 0 })
                    setNextClass(null)
                }
            } catch (err) {
                console.error('Error fetching teacher data:', err)
            }
 
            setLoadingData(false)
        }
 
        if (!loading && teacherId) {
            fetchTeacherData()
        }
    }, [teacherId, loading])

    const getGreeting = () => {
        const hour = currentTime.getHours()
        
        if (hour >= 5 && hour < 12) {
            return t('teacher.home.greetingMorning') || 'Bonjour'
        } else if (hour >= 12 && hour < 18) {
            return t('teacher.home.greetingAfternoon') || 'Bon après-midi'
        } else if (hour >= 18 && hour < 22) {
            return t('teacher.home.greetingEvening') || 'Bonsoir'
        } else {
            return t('teacher.home.greetingNight') || 'Bonne nuit'
        }
    }

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.08 }
        }
    }

    const item = {
        hidden: { y: 15, opacity: 0 },
        show: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 25 } }
    }

    const formatDate = () => {
        return currentTime.toLocaleDateString(t('common.locale') || 'fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        })
    }

    const getTimeUntilClass = () => {
        if (!nextClass) return null
        const now = new Date()
        const [hours, minutes] = nextClass.startTime.split(':').map(Number)
        const classTime = new Date()
        classTime.setHours(hours, minutes, 0, 0)

        const diffMs = classTime.getTime() - now.getTime()
        if (diffMs <= 0) {
            // Class is ongoing
            const [endHours, endMinutes] = nextClass.endTime.split(':').map(Number)
            const endTime = new Date()
            endTime.setHours(endHours, endMinutes, 0, 0)
            const remainingMs = endTime.getTime() - now.getTime()
            if (remainingMs > 0) {
                const remainingMins = Math.floor(remainingMs / 60000)
                return { hours: Math.floor(remainingMins / 60), minutes: remainingMins % 60, ongoing: true }
            }
            return null
        }

        const diffMins = Math.floor(diffMs / 60000)
        return { hours: Math.floor(diffMins / 60), minutes: diffMins % 60, ongoing: false }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
            </div>
        )
    }

    const timeUntil = getTimeUntilClass()

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-8 pb-24 max-w-md mx-auto lg:max-w-none select-none font-sans"
            dir={direction}
        >
            {/* Premium Header */}
            <motion.header variants={item} className="flex items-center justify-between bg-white/60 dark:bg-slate-900/30 border border-slate-150 dark:border-white/5 p-4.5 rounded-[28px] backdrop-blur-xl shadow-[0_4px_20px_-8px_rgba(0,0,0,0.03)]">
                <div className="flex items-center gap-4 min-w-0">
                    <div className="relative shrink-0">
                        <div className="absolute -inset-1 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-full opacity-20 blur-sm" />
                        <div className="w-13 h-13 rounded-full bg-white dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-white/10 shadow-sm flex items-center justify-center overflow-hidden relative">
                            <div className="w-full h-full rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center">
                                <User className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                            </div>
                        </div>
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-lg md:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight truncate">
                            {getGreeting()}, <span className="text-emerald-600 dark:text-emerald-400">{teacherName}</span>
                        </h1>
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mt-1 tracking-[0.1em] flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            {formatDate()}
                        </p>
                    </div>
                </div>
                <button className="h-11 w-11 rounded-2xl bg-white dark:bg-slate-950 border border-slate-150 dark:border-white/10 flex items-center justify-center text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:scale-105 active:scale-95 shadow-sm transition-all shrink-0 cursor-pointer">
                    <Bell className="w-5 h-5" />
                </button>
            </motion.header>

            {/* Supercharged Stats Row */}
            <div className="grid grid-cols-3 gap-4">
                {loadingData ? (
                    <div className="col-span-3 flex justify-center py-6 bg-white/50 dark:bg-slate-900/20 border border-slate-150 dark:border-white/5 rounded-3xl">
                        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                    </div>
                ) : (
                    [
                        { count: stats.remainingClasses, label: t('teacher.home.remainingClasses') || 'Cours Restants', color: "from-emerald-500 to-emerald-600", text: "text-emerald-600 dark:text-emerald-400" },
                        { count: stats.pendingAttendance, label: t('teacher.home.attendanceToDo') || 'Appels à Faire', color: "from-cyan-500 to-blue-600", text: "text-cyan-600 dark:text-cyan-400" },
                        { count: classes.length, label: t('teacher.home.classesCount') || 'Mes Classes', color: "from-amber-500 to-orange-600", text: "text-amber-600 dark:text-amber-400" }
                    ].map((stat, idx) => (
                        <motion.div
                            key={idx}
                            variants={item}
                            className="bg-white dark:bg-slate-900/40 border border-slate-150 dark:border-white/5 rounded-[24px] p-4 flex flex-col items-center justify-center text-center relative overflow-hidden group shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1"
                        >
                            <div className={cn("absolute top-0 inset-x-0 h-[3px] opacity-70 group-hover:opacity-100 transition-opacity bg-gradient-to-r", stat.color)} />
                            <span className={cn("text-3xl sm:text-4xl font-black tabular-nums tracking-tight leading-none", stat.text)}>{stat.count}</span>
                            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 mt-2 leading-tight tracking-wider uppercase truncate max-w-full px-1">{stat.label}</span>
                        </motion.div>
                    ))
                )}
            </div>

            {/* Modern Prochain Cours Card */}
            <motion.div variants={item} className="space-y-3 relative">
                <div className="flex justify-between items-center px-1">
                    <h3 className="font-black text-lg tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-500" />
                        {t('teacher.home.nextClass') || 'Prochain Cours'}
                    </h3>
                    <Link href="/teacher/schedule" className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 hover:underline">
                        {t('teacher.home.viewAll') || 'Tout Voir'}
                    </Link>
                </div>

                {loadingData ? (
                    <div className="h-[220px] rounded-[32px] bg-white/50 dark:bg-slate-900/20 border border-slate-150 dark:border-white/5 flex items-center justify-center shadow-sm">
                        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                    </div>
                ) : nextClass ? (
                    <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-slate-900 via-slate-950 to-black border border-emerald-500/20 shadow-xl h-[230px] group">
                        {/* Luxury visual overlays */}
                        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/5 blur-3xl rounded-full pointer-events-none" />
 
                        {/* Content */}
                        <div className="relative z-10 p-6.5 flex flex-col h-full justify-between">
                            {/* Top Badges row */}
                            <div className="flex justify-between items-start gap-3">
                                <div className="flex gap-2 flex-wrap">
                                    <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-[9px] font-black tracking-widest border border-emerald-500/20 text-emerald-400 backdrop-blur-sm uppercase shadow-inner">
                                        {nextClass.subject}
                                    </span>
                                    {nextClass.schoolName && (
                                        <span className="px-3 py-1 rounded-full bg-white/5 text-[9px] font-black tracking-widest border border-white/10 text-slate-300 backdrop-blur-sm uppercase">
                                            {nextClass.schoolName}
                                        </span>
                                    )}
                                </div>
                                <div className={cn(
                                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider backdrop-blur-md border",
                                    timeUntil?.ongoing 
                                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                                        : "bg-white/5 border-white/10 text-slate-400"
                                )}>
                                    <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", timeUntil?.ongoing ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]' : 'bg-slate-500')} />
                                    {timeUntil?.ongoing ? (t('teacher.home.inProgress') || 'En Cours') : (t('teacher.home.upcoming') || 'À venir')}
                                </div>
                            </div>
 
                            {/* Title & Waveform */}
                            <div className="relative my-2">
                                <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity pointer-events-none select-none flex items-center">
                                    <svg viewBox="0 0 400 100" className="w-full h-20 fill-none stroke-emerald-500/50 stroke-[2]">
                                        <path d="M0,50 C50,50 70,20 120,50 C170,80 190,20 240,50 C290,80 310,50 400,50" />
                                    </svg>
                                </div>
 
                                <h2 className="text-2xl font-black text-white tracking-tight relative z-10 leading-tight">
                                    {nextClass.className}
                                </h2>
                                
                                <div className="flex items-center gap-2.5 text-xs mt-2 relative z-10 font-bold">
                                    <span className="flex items-center gap-1.5 bg-white/5 border border-white/10 text-slate-200 px-2.5 py-1 rounded-xl">
                                        <Clock className="w-3.5 h-3.5 text-emerald-400" />
                                        <span className="font-mono">{nextClass.startTime} - {nextClass.endTime}</span>
                                    </span>
                                    {nextClass.room && (
                                        <span className="bg-white/5 border border-white/10 text-slate-200 px-2.5 py-1 rounded-xl uppercase tracking-wider text-[10px] font-black">
                                            Salle {nextClass.room}
                                        </span>
                                    )}
                                </div>
                            </div>
 
                            {/* Lower actions & countdown */}
                            <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5 relative z-10">
                                {timeUntil ? (
                                    <div className="flex items-center gap-3">
                                        <div className="flex gap-1.5 text-white font-mono font-black text-base tabular-nums">
                                            <span className="bg-white/5 px-2 py-1 rounded-lg border border-white/10">{String(timeUntil.hours).padStart(2, '0')}</span>
                                            <span className="text-slate-600 self-center">:</span>
                                            <span className="bg-white/5 px-2 py-1 rounded-lg border border-white/10">{String(timeUntil.minutes).padStart(2, '0')}</span>
                                        </div>
                                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 max-w-[70px] leading-snug">
                                            {timeUntil.ongoing ? (t('teacher.home.remainingTimeLabel') || 'restant') : (t('teacher.home.beforeTimeLabel') || 'avant cours')}
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-xs font-bold text-slate-500">{t('teacher.home.classEnded') || 'Cours terminé'}</span>
                                )}
 
                                <Link href={`/teacher/classes/${nextClass.classId}`}>
                                    <Button className="rounded-2xl px-4 h-11 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all duration-300 shadow-[0_4px_20px_rgba(16,185,129,0.25)] hover:shadow-[0_4px_24px_rgba(16,185,129,0.4)] gap-1.5 hover:scale-[1.02] active:scale-95">
                                        {t('teacher.home.takeAttendance') || "L'Appel"} 
                                        <ArrowRight className={cn("w-3.5 h-3.5 shrink-0 transition-transform", isRTL ? "group-hover:-translate-x-1" : "group-hover:translate-x-1")} />
                                    </Button>
                                </Link>
                            </div>
 
                            {/* Bottom Progress Bar indicator */}
                            {timeUntil?.ongoing && (
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5 overflow-hidden">
                                    <motion.div 
                                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]" 
                                        initial={{ width: '0%' }}
                                        animate={{ width: '65%' }}
                                        transition={{ duration: 1, ease: "easeOut" }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="h-[220px] rounded-[32px] bg-white/80 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-150 dark:border-white/5 flex flex-col items-center justify-center shadow-sm text-slate-400 gap-3">
                        <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-100 dark:border-white/5 shadow-inner">
                            <ShieldCheck className="w-6 h-6 text-slate-400 opacity-70" />
                        </div>
                        <p className="font-black tracking-wide uppercase text-xs text-slate-500">
                            {t('teacher.home.noClassToday') || 'Aucun cours aujourd\'hui'}
                        </p>
                    </div>
                )}
            </motion.div>

            {/* Premium Actions Rapides Grid */}
            <motion.div variants={item} className="space-y-4">
                <h3 className="font-black text-lg tracking-tight text-slate-900 dark:text-white px-1">
                    {t('teacher.home.quickActions') || 'Actions Rapides'}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    {[
                        { label: t('teacher.home.actionTakeAttendance') || 'Faire l\'Appel', icon: User, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-100 dark:border-emerald-900/30", href: "/teacher/classes" },
                        { label: t('teacher.home.actionAddRemark') || 'Remarques', icon: MessageSquare, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/50 border-amber-100 dark:border-amber-900/30", href: "/teacher/remarks" },
                        { label: t('teacher.home.actionAddGrade') || 'Notes', icon: CheckSquare, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/50 border-blue-100 dark:border-blue-900/30", href: "/teacher/classes" },
                        { label: t('teacher.home.actionQuizzes') || 'Mes Quiz', icon: BrainCircuit, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/50 border-purple-100 dark:border-purple-900/30", href: "/teacher/quizzes" }
                    ].map((action, idx) => (
                        <Link key={idx} href={action.href} className="block group/btn">
                            <div className="bg-white/80 dark:bg-slate-900/40 border border-slate-150 dark:border-white/5 rounded-2xl p-5 flex flex-col items-center justify-center text-center shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer hover:-translate-y-0.5 hover:border-emerald-500/20 group/action">
                                <div className={cn("p-3.5 rounded-2xl mb-3 border shadow-sm transition-all duration-300 group-hover/btn:scale-110 group-hover/btn:rotate-3", action.bg)}>
                                    <action.icon className={cn("w-6 h-6", action.color)} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 group-hover/btn:text-slate-900 dark:group-hover/btn:text-white transition-colors">{action.label}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            </motion.div>
        </motion.div>
    )
}
