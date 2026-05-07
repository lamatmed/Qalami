/* eslint-disable react-hooks/immutability */
'use client'

import { useState, useEffect } from 'react'
import {
    Bell,
    FileText,
    CreditCard,
    Calendar,
    Clock,
    MapPin,
    BookOpen,
    ShieldCheck,
    Star,
    Loader2,
    AlertCircle,
    ChevronRight,
    GraduationCap,
    HeartHandshake
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useParent } from '@/context/parent-context'
import { createClient } from '@/utils/supabase/client'
import { useLanguage } from '@/i18n'

interface ChildStats {
    average: number | null
    attendanceRate: number
    conductPoints: number
}

interface NextClass {
    subject: string
    startTime: string
    endTime: string
    room: string
    teacher: string | null
}

interface RecentActivity {
    id: string
    type: 'grade' | 'attendance' | 'payment' | 'homework'
    title: string
    subject: string
    time: string
}

export function ParentHome() {
    const { t, language, direction } = useLanguage()
    const { selectedChild, setSelectedChild, childrenList, loading, parentName } = useParent()
    const [stats, setStats] = useState<ChildStats>({ average: null, attendanceRate: 0, conductPoints: 0 })
    const [loadingStats, setLoadingStats] = useState(false)
    const [nextClass, setNextClass] = useState<NextClass | null>(null)
    const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
    const [loadingExtra, setLoadingExtra] = useState(false)

    // Fetch stats when selected child changes
    useEffect(() => {
        async function fetchStats() {
            if (!selectedChild?.id) return

            setLoadingStats(true)
            const supabase = createClient()

            try {
                // Fetch grades for the selected child
                const { data: grades } = await supabase
                    .from('grades')
                    .select('value, max_value, coefficient')
                    .eq('student_id', selectedChild.id)
                    .eq('term', 'T1')

                if (grades && grades.length > 0) {
                    // Calculate weighted average
                    let totalWeighted = 0
                    let totalCoeff = 0
                    grades.forEach(g => {
                        const coeff = g.coefficient || 1
                        const normalized = (g.value / (g.max_value || 20)) * 20
                        totalWeighted += normalized * coeff
                        totalCoeff += coeff
                    })
                    const avg = totalCoeff > 0 ? totalWeighted / totalCoeff : null

                    setStats(prev => ({ ...prev, average: avg }))
                } else {
                    setStats(prev => ({ ...prev, average: null }))
                }

                // Fetch attendance rate (if we have attendance data)
                const { data: attendance } = await supabase
                    .from('attendance')
                    .select('status')
                    .eq('student_id', selectedChild.id)

                if (attendance && attendance.length > 0) {
                    const present = attendance.filter(a => a.status === 'present').length
                    const rate = (present / attendance.length) * 100
                    setStats(prev => ({ ...prev, attendanceRate: Math.round(rate) }))
                } else {
                    // Default to 100% if no attendance records
                    setStats(prev => ({ ...prev, attendanceRate: 100 }))
                }
            } catch (err) {
                console.error('Error fetching stats:', err)
            }

            setLoadingStats(false)
        }

        fetchStats()
    }, [selectedChild?.id])

    // Fetch next class and recent activity
    useEffect(() => {
        async function fetchExtraData() {
            if (!selectedChild?.id) return

            setLoadingExtra(true)
            const supabase = createClient()

            try {
                // Get student's class ID from enrollments
                const { data: enrollment } = await supabase
                    .from('enrollments')
                    .select('class_id')
                    .eq('student_id', selectedChild.id)
                    .single()

                if (enrollment?.class_id) {
                    // Get today's day of week (1=Mon, 7=Sun)
                    const now = new Date()
                    let dayOfWeek = now.getDay()
                    dayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek

                    const currentTime = now.toTimeString().slice(0, 5) // HH:MM format

                    // Fetch today's schedule
                    const { data: schedules } = await supabase
                        .from('schedule')
                        .select(`
                            start_time,
                            end_time,
                            room,
                            subjects (name),
                            profiles!schedule_teacher_id_fkey (full_name)
                        `)
                        .eq('class_id', enrollment.class_id)
                        .eq('day_of_week', dayOfWeek)
                        .gt('start_time', currentTime)
                        .order('start_time', { ascending: true })
                        .limit(1)

                    if (schedules && schedules.length > 0) {
                        const s = schedules[0]
                        setNextClass({
                            subject: (s.subjects as { name?: string })?.name || 'Cours',
                            startTime: s.start_time?.slice(0, 5) || '',
                            endTime: s.end_time?.slice(0, 5) || '',
                            room: s.room || '',
                            teacher: (s.profiles as { full_name?: string })?.full_name || null
                        })
                    } else {
                        setNextClass(null)
                    }
                }

                // Fetch recent activity (grades, attendance issues)
                const activities: RecentActivity[] = []

                // Recent grades
                const { data: recentGrades } = await supabase
                    .from('grades')
                    .select(`
                        id,
                        created_at,
                        subjects (name)
                    `)
                    .eq('student_id', selectedChild.id)
                    .order('created_at', { ascending: false })
                    .limit(2)

                if (recentGrades) {
                    recentGrades.forEach(g => {
                        activities.push({
                            id: g.id,
                            type: 'grade',
                            title: t('parent.home.newGrade'),
                            subject: (g.subjects as { name?: string })?.name || t('common.subject') || 'Matière',
                            time: formatRelativeTime(g.created_at)
                        })
                    })
                }

                // Recent attendance issues
                const { data: recentAttendance } = await supabase
                    .from('attendance')
                    .select('id, date, status')
                    .eq('student_id', selectedChild.id)
                    .neq('status', 'present')
                    .order('date', { ascending: false })
                    .limit(1)

                if (recentAttendance && recentAttendance.length > 0) {
                    const a = recentAttendance[0]
                    activities.push({
                        id: a.id,
                        type: 'attendance',
                        title: a.status === 'absent' ? t('parent.home.absenceReported') : t('parent.home.lateReported'),
                        subject: t('common.attendance') || 'Présence',
                        time: formatRelativeTime(a.date)
                    })
                }

                setRecentActivity(activities.slice(0, 3))
            } catch (err) {
                console.error('Error fetching extra data:', err)
            }

            setLoadingExtra(false)
        }

        fetchExtraData()
    }, [selectedChild?.id])

    function formatRelativeTime(dateStr: string): string {
        const date = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

        if (diffHours < 1) return t('parent.home.justNow')
        if (diffHours < 24) return t('parent.home.hoursAgo', { hours: diffHours })
        if (diffDays === 1) return t('common.yesterday') || 'Hier'
        if (diffDays < 7) return t('parent.home.daysAgo', { days: diffDays })
        return date.toLocaleDateString(language === 'ar' ? 'ar-MR' : 'fr-FR', { day: 'numeric', month: 'short' })
    }

    const getActivityIcon = (type: string) => {
        const icons: Record<string, { icon: any, color: string, bg: string }> = {
            'grade': { icon: FileText, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
            'attendance': { icon: AlertCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10' },
            'payment': { icon: CreditCard, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
            'homework': { icon: BookOpen, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10' },
        }
        return icons[type] || { icon: BookOpen, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-500/10' }
    }

    const quickActions = [
        { icon: FileText, label: t('parent.sidebar.grades') || 'Notes', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', href: '/parent/grades' },
        { icon: CreditCard, label: t('parent.sidebar.finances') || 'Paiements', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10', href: '/parent/finances' },
        { icon: Calendar, label: t('parent.home.absences') || 'Absences', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10', href: '/parent/attendance' },
    ]

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24 bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-3xl shadow-sm animate-pulse max-w-3xl mx-auto">
                <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
            </div>
        )
    }

    return (
        <div className="max-w-4xl space-y-8 pb-12 animate-in fade-in duration-500 p-6 md:p-8" dir={direction}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="h-13 w-13 rounded-2xl bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 border border-purple-100 dark:border-purple-500/20 flex items-center justify-center shrink-0">
                        <HeartHandshake className="w-7 h-7" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest font-black leading-none">{t('common.parent') || 'Parent'}</p>
                        <h1 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white tracking-tight mt-1 leading-none">{t('parent.home.hello', { name: parentName })}</h1>
                    </div>
                </div>
                <Button variant="ghost" size="icon" className="h-11 w-11 rounded-2xl text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-100 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 shadow-sm transition-all duration-300 relative">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />
                </Button>
            </div>

            {/* Children Selector */}
            {childrenList.length > 0 && (
                <div className="flex gap-6 items-center px-2 py-4 bg-gray-50/50 dark:bg-slate-950/20 border border-gray-100 dark:border-white/5 rounded-3xl overflow-x-auto custom-scrollbar">
                    {childrenList.map((child) => (
                        <div
                            key={child.id}
                            onClick={() => setSelectedChild(child)}
                            className="flex flex-col items-center gap-2 cursor-pointer transition-all group shrink-0"
                        >
                            <div className={cn(
                                "p-1 rounded-full border-2 transition-all",
                                selectedChild?.id === child.id 
                                    ? "border-purple-600 scale-105 shadow-md shadow-purple-600/10" 
                                    : "border-transparent opacity-50 group-hover:opacity-100"
                            )}>
                                <Avatar className="h-14 w-14 border border-gray-100 dark:border-white/10">
                                    <AvatarFallback className="bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 font-black text-sm">{child.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                            </div>
                            <span className={cn(
                                "text-xs font-black transition-colors uppercase tracking-wider",
                                selectedChild?.id === child.id ? "text-purple-600 dark:text-purple-400" : "text-gray-400"
                            )}>
                                {child.name}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* No children message */}
            {childrenList.length === 0 && (
                <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-3xl p-8 text-center shadow-sm">
                    <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30 text-purple-600 animate-bounce" />
                    <p className="font-bold text-gray-500">{t('parent.home.noChildren')}</p>
                    <p className="text-xs font-semibold text-gray-400 mt-2">{t('parent.home.contactAdminDesc')}</p>
                </div>
            )}

            {/* Main Stats Card */}
            {selectedChild && (
                <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-purple-800 to-indigo-950 border border-purple-700 p-8 shadow-xl shadow-purple-950/10">
                    {/* Background Decor */}
                    <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/10 blur-3xl rounded-full" />
                    <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-500/10 blur-3xl rounded-full" />

                    <div className="relative z-10 space-y-8">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-purple-200/80 text-xs font-bold uppercase tracking-wider mb-1.5">{t('parent.home.generalAverage', { name: selectedChild.name })}</p>
                                <div className="flex items-baseline gap-1">
                                    {loadingStats ? (
                                        <Loader2 className="h-8 w-8 animate-spin text-white" />
                                    ) : stats.average !== null ? (
                                        <>
                                            <span className="text-5xl font-black text-white leading-none">{stats.average.toFixed(2)}</span>
                                            <span className="text-lg font-bold text-purple-200/60">/20</span>
                                        </>
                                    ) : (
                                        <span className="text-4xl font-black text-purple-200/50">--</span>
                                    )}
                                </div>
                            </div>
                            <span className="px-3 py-1 rounded-full bg-white/10 text-white text-[10px] font-black border border-white/20 uppercase tracking-wider">
                                {t('parent.home.term1')}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-3.5 bg-white/10 px-4.5 py-3.5 rounded-2xl border border-white/10 flex-1">
                                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                                <div>
                                    <p className="text-[9px] text-purple-200/70 font-black uppercase tracking-wider leading-none">{t('common.attendance') || 'Présence'}</p>
                                    <p className="text-base font-black text-white mt-1 leading-none">{stats.attendanceRate}%</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3.5 bg-white/10 px-4.5 py-3.5 rounded-2xl border border-white/10 flex-1">
                                <Star className="w-6 h-6 text-amber-400" />
                                <div>
                                    <p className="text-[9px] text-purple-200/70 font-black uppercase tracking-wider leading-none">{t('parent.home.conduct')}</p>
                                    <p className="text-base font-black text-white mt-1 leading-none">+{stats.conductPoints} pts</p>
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions Inside Card */}
                        <div className="grid grid-cols-3 gap-3 pt-2">
                            {quickActions.map((action, i) => (
                                <Link key={i} href={action.href} className="flex flex-col items-center gap-2 group">
                                    <div className="h-11 w-11 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center transition-all group-hover:scale-105">
                                        <action.icon className="w-5 h-5 text-white" />
                                    </div>
                                    <span className="text-[10px] font-black text-purple-200/80 group-hover:text-white transition-colors uppercase tracking-wider">{action.label}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Prochain Cours */}
            {selectedChild && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <h2 className="font-bold text-gray-900 dark:text-white text-lg">{t('parent.home.nextClassTitle', { class: selectedChild.class })}</h2>
                        <Link href="/parent/schedule" className="text-xs text-purple-600 dark:text-purple-400 font-bold hover:underline">{t('common.viewAll') || 'Voir tout'}</Link>
                    </div>
                    {loadingExtra ? (
                        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 p-8 rounded-3xl flex items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                        </div>
                    ) : nextClass ? (
                        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 p-5 rounded-3xl flex items-center justify-between relative overflow-hidden group hover:border-purple-200 dark:hover:border-purple-500/20 shadow-sm transition-all duration-300">
                            <div className={cn("absolute top-0 bottom-0 w-1 bg-purple-600", direction === 'rtl' ? 'right-0' : 'left-0')} />
                            <div className="flex items-center gap-4.5">
                                <div className="h-12 w-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20 flex items-center justify-center font-black text-xl shadow-sm shrink-0">
                                    {nextClass.subject.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-black text-base text-gray-900 dark:text-white truncate">{nextClass.subject}</h3>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 dark:text-gray-500 font-semibold">
                                        <span className="flex items-center gap-1 shrink-0"><Clock className="w-3.5 h-3.5" /> {nextClass.startTime} - {nextClass.endTime}</span>
                                        {nextClass.room && <span className="flex items-center gap-1 truncate"><MapPin className="w-3.5 h-3.5" /> {nextClass.room}</span>}
                                    </div>
                                </div>
                            </div>
                            <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 px-3 py-1 rounded-full border border-purple-100 dark:border-purple-500/20 shrink-0 uppercase tracking-wider">
                                {t('parent.home.upcoming')}
                            </span>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 p-6 rounded-3xl text-center shadow-sm">
                            <p className="text-gray-400 font-bold text-sm">{t('parent.home.noClassesToday')}</p>
                        </div>
                    )}
                </div>
            )}

            {/* Activités Récentes */}
            <div className="space-y-4">
                <h2 className="font-bold text-gray-900 dark:text-white text-lg px-1">{t('parent.home.recentActivities')}</h2>
                {loadingExtra ? (
                    <div className="flex items-center justify-center py-12 bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-3xl shadow-sm">
                        <Loader2 className="h-7 w-7 animate-spin text-purple-600" />
                    </div>
                ) : recentActivity.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 p-6 rounded-3xl text-center shadow-sm">
                        <p className="text-gray-400 font-bold text-sm">{t('parent.home.noRecentActivity')}</p>
                    </div>
                ) : (
                    <div className="space-y-3.5">
                        {recentActivity.map((item) => {
                            const iconData = getActivityIcon(item.type)
                            const IconComponent = iconData.icon
                            return (
                                <div key={item.id} className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 p-5 rounded-3xl flex items-center gap-4.5 hover:bg-gray-50/50 dark:hover:bg-white/[0.02] hover:border-purple-200 dark:hover:border-purple-500/20 shadow-sm transition-all duration-300 group">
                                    <div className={cn("h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 border transition-all duration-300 group-hover:scale-105", iconData.bg, iconData.color.includes('dark:') ? iconData.color.split(' ')[0].replace('text-', 'border-').replace('600', '100') : 'border-transparent')}>
                                        <IconComponent className={cn("w-5.5 h-5.5", iconData.color)} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-sm text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors leading-snug">{item.title}</h4>
                                        <p className="text-xs text-gray-400 dark:text-gray-500 font-semibold mt-0.5 leading-none">{item.subject} • {item.time}</p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
