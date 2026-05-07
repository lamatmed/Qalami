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
    AlertCircle
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
    const { t, language } = useLanguage()
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
        const icons: Record<string, { icon: typeof BookOpen, color: string, bg: string }> = {
            'grade': { icon: FileText, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
            'attendance': { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
            'payment': { icon: CreditCard, color: 'text-blue-500', bg: 'bg-blue-500/10' },
            'homework': { icon: BookOpen, color: 'text-purple-500', bg: 'bg-purple-500/10' },
        }
        return icons[type] || { icon: BookOpen, color: 'text-gray-500', bg: 'bg-gray-500/10' }
    }

    const quickActions = [
        { icon: FileText, label: t('parent.sidebar.grades') || 'Notes', color: 'text-emerald-400', bg: 'bg-emerald-400/10', href: '/parent/grades' },
        { icon: CreditCard, label: t('parent.sidebar.finances') || 'Paiements', color: 'text-blue-400', bg: 'bg-blue-400/10', href: '/parent/finances' },
        { icon: Calendar, label: t('parent.home.absences') || 'Absences', color: 'text-red-400', bg: 'bg-red-400/10', href: '/parent/attendance' },
    ]

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="max-w-md mx-auto lg:max-w-3xl lg:ms-12 lg:me-auto pb-24 space-y-8 p-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-border">
                        <AvatarImage src="" />
                        <AvatarFallback>{parentName.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{t('common.parent') || 'Parent'}</p>
                        <h1 className="text-lg font-bold">{t('parent.home.hello', { name: parentName })}</h1>
                    </div>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full relative">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-background" />
                </Button>
            </div>

            {/* Children Selector */}
            {childrenList.length > 0 && (
                <div className="flex justify-between items-center px-2 relative">
                    {childrenList.map((child) => (
                        <div
                            key={child.id}
                            onClick={() => setSelectedChild(child)}
                            className="flex flex-col items-center gap-2 cursor-pointer transition-all group"
                        >
                            <div className={cn(
                                "p-1 rounded-full border-2 transition-all",
                                selectedChild?.id === child.id ? "border-emerald-500 scale-110 shadow-lg shadow-emerald-500/20" : "border-transparent opacity-50 group-hover:opacity-100"
                            )}>
                                <Avatar className="h-14 w-14">
                                    <AvatarFallback className="bg-muted text-foreground font-bold">{child.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                            </div>
                            <span className={cn(
                                "text-xs font-medium transition-colors",
                                selectedChild?.id === child.id ? "text-emerald-500" : "text-muted-foreground"
                            )}>
                                {child.name}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* No children message */}
            {childrenList.length === 0 && (
                <div className="bg-card border border-border rounded-3xl p-6 text-center">
                    <p className="text-muted-foreground">{t('parent.home.noChildren')}</p>
                    <p className="text-sm text-muted-foreground mt-2">{t('parent.home.contactAdminDesc')}</p>
                </div>
            )}

            {/* Main Stats Card */}
            {selectedChild && (
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 to-black border border-white/10 p-6 shadow-2xl">
                    {/* Background Decor */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full" />

                    <div className="relative z-10 space-y-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-muted-foreground text-sm font-medium mb-1">{t('parent.home.generalAverage', { name: selectedChild.name })}</p>
                                <div className="flex items-baseline gap-1">
                                    {loadingStats ? (
                                        <Loader2 className="h-8 w-8 animate-spin text-white" />
                                    ) : stats.average !== null ? (
                                        <>
                                            <span className="text-4xl font-bold text-white">{stats.average.toFixed(1)}</span>
                                            <span className="text-lg text-muted-foreground">/20</span>
                                        </>
                                    ) : (
                                        <span className="text-2xl font-bold text-muted-foreground">--</span>
                                    )}
                                </div>
                            </div>
                            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20 text-uppercase">
                                {t('parent.home.term1')}
                            </span>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex items-center gap-3 bg-white/5 px-4 py-2.5 rounded-xl border border-white/5 flex-1">
                                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('common.attendance') || 'Présence'}</p>
                                    <p className="text-sm font-bold text-white">{stats.attendanceRate}%</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 bg-white/5 px-4 py-2.5 rounded-xl border border-white/5 flex-1">
                                <Star className="w-5 h-5 text-amber-400" />
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('parent.home.conduct')}</p>
                                    <p className="text-sm font-bold text-white">+{stats.conductPoints} pts</p>
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions inside Card */}
                        <div className="grid grid-cols-4 gap-2 pt-2">
                            {quickActions.map((action, i) => (
                                <Link key={i} href={action.href} className="flex flex-col items-center gap-2 group">
                                    <div className={cn("p-3 rounded-2xl transition-all group-hover:scale-105", action.bg)}>
                                        <action.icon className={cn("w-5 h-5", action.color)} />
                                    </div>
                                    <span className="text-[10px] font-medium text-muted-foreground group-hover:text-white transition-colors">{action.label}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Prochain Cours */}
            {selectedChild && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <h2 className="font-bold text-lg">{t('parent.home.nextClassTitle', { class: selectedChild.class })}</h2>
                        <Link href="/parent/schedule" className="text-xs text-primary font-medium hover:underline">{t('common.viewAll') || 'Voir tout'}</Link>
                    </div>
                    {loadingExtra ? (
                        <div className="bg-card border border-border/50 p-8 rounded-3xl flex items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : nextClass ? (
                        <div className="bg-card border border-border/50 p-4 rounded-3xl flex items-center justify-between relative overflow-hidden group">
                            <div className="absolute left-0 rtl:left-auto rtl:right-0 top-0 bottom-0 w-1 bg-cyan-500" />
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-2xl bg-cyan-500 flex items-center justify-center text-black font-bold text-xl shadow-[0_0_15px_rgba(6,182,212,0.5)]">
                                    {nextClass.subject.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-base">{nextClass.subject}</h3>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {nextClass.startTime} - {nextClass.endTime}</span>
                                        {nextClass.room && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {nextClass.room}</span>}
                                    </div>
                                </div>
                            </div>
                            <span className="text-[10px] font-bold text-cyan-400 bg-cyan-950/50 px-2 py-1 rounded-md border border-cyan-500/20">
                                {t('parent.home.upcoming')}
                            </span>
                        </div>
                    ) : (
                        <div className="bg-card border border-border/50 p-4 rounded-3xl text-center">
                            <p className="text-muted-foreground text-sm">{t('parent.home.noClassesToday')}</p>
                        </div>
                    )}
                </div>
            )}

            {/* Activités Récentes */}
            <div className="space-y-3">
                <h2 className="font-bold text-lg px-1">{t('parent.home.recentActivities')}</h2>
                {loadingExtra ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : recentActivity.length === 0 ? (
                    <div className="bg-card/50 p-4 rounded-3xl text-center">
                        <p className="text-muted-foreground text-sm">{t('parent.home.noRecentActivity')}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {recentActivity.map((item) => {
                            const iconData = getActivityIcon(item.type)
                            const IconComponent = iconData.icon
                            return (
                                <div key={item.id} className="bg-card/50 p-4 rounded-3xl flex items-center gap-4 hover:bg-card transition-colors">
                                    <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", iconData.bg)}>
                                        <IconComponent className={cn("w-5 h-5", iconData.color)} />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-sm">{item.title}</h4>
                                        <p className="text-xs text-muted-foreground">{item.subject} • {item.time}</p>
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
