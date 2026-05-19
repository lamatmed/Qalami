'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bell, BookOpen, CheckSquare, Clock, MessageSquare, User, Users, ArrowRight, Loader2, BrainCircuit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useTeacher } from '@/context/teacher-context'
import { createClient } from '@/utils/supabase/client'
import { useLanguage } from '@/i18n'
import { getTeacherScheduleAction } from '@/app/teacher/actions'

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
    const { t } = useLanguage()
    const { teacherId, teacherName, loading, classes, schoolId } = useTeacher()
    const [nextClass, setNextClass] = useState<NextClass | null>(null)
    const [stats, setStats] = useState<TeacherStats>({ remainingClasses: 0, pendingAttendance: 0, remarksCount: 0 })
    const [loadingData, setLoadingData] = useState(true)
    const [currentTime, setCurrentTime] = useState(new Date())

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
 
                    // Calculate pending attendance (classes that have started but not marked)
                    const startedClasses = todaySchedule.filter((s: any) =>
                        s.start_time <= currentTimeStr && s.end_time > currentTimeStr
                    )
                    // For now, assume all current classes need attendance
                    const pendingCount = startedClasses.length
 
                    setStats({
                        remainingClasses: remaining,
                        pendingAttendance: pendingCount,
                        remarksCount: 0 // Will be updated when remarks table exists
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

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    }

    const item = {
        hidden: { y: 20, opacity: 0 },
        show: { y: 0, opacity: 1 }
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
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    const timeUntil = getTimeUntilClass()

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-6 pb-24 max-w-md mx-auto lg:max-w-none"
        >
            {/* Header */}
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 p-0.5">
                        <div className="w-full h-full rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center overflow-hidden">
                            <User className="w-6 h-6 text-white" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">{t('teacher.home.welcome').replace('{name}', teacherName)}</h1>
                        <p className="text-xs text-muted-foreground capitalize">{formatDate()}</p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full bg-card/50 hover:bg-card">
                    <Bell className="w-5 h-5 text-emerald-500" />
                </Button>
            </header>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-3">
                {loadingData ? (
                    <div className="col-span-3 flex justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : (
                    [
                        { count: stats.remainingClasses, label: t('teacher.home.remainingClasses'), icon: BookOpen, color: "text-emerald-400" },
                        { count: stats.pendingAttendance, label: t('teacher.home.attendanceToDo'), icon: CheckSquare, color: "text-sky-400" },
                        { count: classes.length, label: t('teacher.home.classesCount'), icon: Users, color: "text-amber-400" }
                    ].map((stat, idx) => (
                        <motion.div
                            key={idx}
                            variants={item}
                            className="bg-card/80 backdrop-blur-md rounded-2xl p-3 flex flex-col items-center justify-center text-center border border-white/15 relative overflow-hidden group shadow-lg"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <span className={`text-3xl font-extrabold ${stat.color} drop-shadow-sm`}>{stat.count}</span>
                            <span className="text-[10px] font-semibold text-gray-200 mt-1.5 leading-tight tracking-wide">{stat.label}</span>
                        </motion.div>
                    ))
                )}
            </div>

            {/* Prochain Cours Card */}
            <motion.div variants={item} className="relative w-full">
                <div className="flex justify-between items-end mb-2 px-1">
                    <h3 className="font-bold text-lg">{t('teacher.home.nextClass')}</h3>
                    <Link href="/teacher/schedule" className="text-xs text-emerald-500 hover:text-emerald-400">{t('teacher.home.viewAll')}</Link>
                </div>

                {loadingData ? (
                    <div className="h-[220px] rounded-3xl bg-card border border-white/10 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : nextClass ? (
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950/50 via-slate-900 to-black border border-emerald-500/40 shadow-[0_8px_32px_rgba(16,185,129,0.15)] h-[220px]">
                        {/* Luminous top glow */}
                        <div className="absolute -top-20 -left-20 w-64 h-64 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none" />
 
                        {/* Content */}
                        <div className="relative z-10 p-6 flex flex-col h-full justify-between">
                            {/* Tags */}
                            <div className="flex justify-between items-start">
                                <div className="flex gap-2 flex-wrap">
                                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-[10px] font-bold tracking-wider border border-emerald-500/30 text-emerald-300 backdrop-blur-sm">
                                        {nextClass.subject.toUpperCase()}
                                    </span>
                                    {nextClass.schoolName && (
                                        <span className="px-3 py-1 rounded-full bg-cyan-500/25 text-[10px] font-black tracking-wider border border-cyan-400/40 text-cyan-300 backdrop-blur-md shadow-sm">
                                            {nextClass.schoolName}
                                        </span>
                                    )}
                                </div>
                                <div className={`w-2.5 h-2.5 rounded-full ${timeUntil?.ongoing ? 'bg-emerald-400 shadow-[0_0_12px_#34d399] animate-pulse' : 'bg-gray-400'}`} />
                            </div>
 
                            {/* Title & Info */}
                            <div className="space-y-1.5 mt-2">
                                {/* Waveform SVG */}
                                <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 opacity-30 pointer-events-none">
                                    <svg viewBox="0 0 400 100" className="w-full h-24 fill-none stroke-emerald-400/50 stroke-[2.5]">
                                        <path d="M0,50 Q20,40 40,50 T80,50 T120,50 T160,50 T200,20 T240,80 T280,50 T320,50 T360,50 T400,50" />
                                    </svg>
                                </div>
 
                                <h2 className="text-2xl font-bold text-white relative z-10 tracking-tight drop-shadow">{nextClass.className} - {nextClass.subject}</h2>
                                <div className="flex items-center text-xs font-bold text-white relative z-10 gap-3">
                                    <span className="flex items-center gap-1.5 bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-400/30 text-white shadow-sm">
                                        <Clock className="w-3.5 h-3.5 text-emerald-300" /> {nextClass.startTime} - {nextClass.endTime}
                                    </span>
                                    {nextClass.room && (
                                        <span className="bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-400/30 text-white font-bold shadow-sm">
                                            Salle {nextClass.room}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Timer & CTA */}
                            <div className="flex items-center justify-between mt-auto pt-4">
                                {timeUntil ? (
                                    <div className="flex gap-3 text-center">
                                        <div className="flex flex-col">
                                            <span className="text-lg font-mono font-bold text-white tabular-nums">
                                                {String(timeUntil.hours).padStart(2, '0')}
                                            </span>
                                            <span className="text-[9px] text-gray-500 uppercase">{t('teacher.home.hoursAbbr')}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-lg font-mono font-bold text-white tabular-nums">
                                                {String(timeUntil.minutes).padStart(2, '0')}
                                            </span>
                                            <span className="text-[9px] text-gray-500 uppercase">{t('teacher.home.minsAbbr')}</span>
                                        </div>
                                        <span className="text-[9px] text-emerald-400 self-center ml-2">
                                            {timeUntil.ongoing ? t('teacher.home.remainingTimeLabel') : t('teacher.home.beforeTimeLabel')}
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-sm text-gray-400">{t('teacher.home.classEnded')}</span>
                                )}

                                <Link href={`/teacher/classes/${nextClass.classId}`}>
                                    <Button className="rounded-xl px-4 py-6 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold shadow-[0_0_20px_rgba(16,185,129,0.3)] gap-2">
                                        {t('teacher.home.takeAttendance')} <ArrowRight className="w-4 h-4" />
                                    </Button>
                                </Link>
                            </div>

                            {/* Progress Bar */}
                            {timeUntil?.ongoing && (
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                                    <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: '50%' }} />
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="h-[220px] rounded-3xl bg-card border border-white/10 flex items-center justify-center">
                        <p className="text-muted-foreground">{t('teacher.home.noClassToday')}</p>
                    </div>
                )}
            </motion.div>

            {/* Actions Rapides */}
            <motion.div variants={item}>
                <h3 className="font-bold text-lg mb-4 px-1">{t('teacher.home.quickActions')}</h3>
                <div className="grid grid-cols-2 gap-4">
                    {[
                        { label: t('teacher.home.actionTakeAttendance'), icon: User, color: "text-emerald-400", bg: "bg-emerald-400/10", href: "/teacher/classes" },
                        { label: t('teacher.home.actionAddRemark'), icon: MessageSquare, color: "text-amber-400", bg: "bg-amber-400/10", href: "/teacher/remarks" },
                        { label: t('teacher.home.actionAddGrade'), icon: CheckSquare, color: "text-blue-400", bg: "bg-blue-400/10", href: "/teacher/classes" },
                        { label: t('teacher.home.actionQuizzes'), icon: BrainCircuit, color: "text-purple-400", bg: "bg-purple-400/10", href: "/teacher/quizzes" }
                    ].map((action, idx) => (
                        <Link key={idx} href={action.href} className="block">
                            <Button
                                variant="outline"
                                className="w-full h-auto py-6 flex flex-col gap-3 border-border/50 bg-card/30 hover:bg-card hover:border-primary/50 transition-all rounded-2xl group"
                            >
                                <div className={`p-3 rounded-full ${action.bg} mb-1 group-hover:scale-110 transition-transform`}>
                                    <action.icon className={`w-6 h-6 ${action.color}`} />
                                </div>
                                <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground">{action.label}</span>
                            </Button>
                        </Link>
                    ))}
                </div>
            </motion.div>
        </motion.div>
    )
}
