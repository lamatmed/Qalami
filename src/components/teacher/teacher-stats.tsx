'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
    BarChart3, Clock, CheckCircle2, AlertCircle, Calendar,
    ChevronRight, GraduationCap, Loader2, Building2, ChevronDown,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { useTeacher } from '@/context/teacher-context'
import { useLanguage } from '@/i18n'
import { getTeacherStatsAction, type TeacherStatsData } from '@/app/teacher/actions'
import { getSessionConfig } from '@/lib/schedule-constants'
import { motion, AnimatePresence } from 'framer-motion'

type SessionStatus = 'done' | 'missed' | 'overdue' | 'upcoming' | 'scheduled'

const STATUS_DOTS: Record<SessionStatus, string> = {
    done:      'bg-emerald-500',
    missed:    'bg-red-500',
    overdue:   'bg-orange-500 animate-pulse',
    upcoming:  'bg-blue-400',
    scheduled: 'bg-slate-600',
}

function sessionStatus(
    done: boolean, isPast: boolean, isToday: boolean,
    startTime: string, nowHHMM: string,
): SessionStatus {
    if (done)                                return 'done'
    if (isPast)                              return 'missed'
    if (isToday && startTime <= nowHHMM)     return 'overdue'
    if (isToday)                             return 'upcoming'
    return 'scheduled'
}

type ClassStat = TeacherStatsData['classStats'][number]

interface SchoolGroup {
    schoolId: string | null
    schoolName: string
    schoolLogoUrl: string | null
    classes: ClassStat[]
}

function groupBySchool(classStats: ClassStat[]): SchoolGroup[] {
    const map = new Map<string, SchoolGroup>()
    for (const cls of classStats) {
        const key = cls.schoolId ?? '__no_school__'
        if (!map.has(key)) {
            map.set(key, {
                schoolId: cls.schoolId,
                schoolName: cls.schoolName,
                schoolLogoUrl: cls.schoolLogoUrl,
                classes: [],
            })
        }
        map.get(key)!.classes.push(cls)
    }
    return Array.from(map.values())
}

export function TeacherStats() {
    const { teacherId, loading: ctxLoading } = useTeacher()
    const { t, language, direction } = useLanguage()
    const [data, setData]       = useState<TeacherStatsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [nowHHMM]             = useState(() => new Date().toTimeString().substring(0, 5))
    const [expandedSchools, setExpandedSchools] = useState<Record<string, boolean>>({})
    const isRTL = direction === 'rtl'

    useEffect(() => {
        if (!teacherId) return
        setLoading(true)
        getTeacherStatsAction(teacherId)
            .then(setData)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [teacherId])

    if (ctxLoading || loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!data) return null

    const { todayStats, pendingSessions, classStats, weekView } = data

    const locale = language === 'ar' ? 'ar-MA' : 'fr-FR'
    const todayLabel = new Date().toLocaleDateString(locale, {
        weekday: 'long', day: 'numeric', month: 'long',
    })

    const statusLabels: Record<SessionStatus, string> = {
        done:      t('teacher.statistique.status.done'),
        missed:    t('teacher.statistique.status.missed'),
        overdue:   t('teacher.statistique.status.overdue'),
        upcoming:  t('teacher.statistique.status.upcoming'),
        scheduled: t('teacher.statistique.status.scheduled'),
    }

    const hasMultipleTypes = (byType: Record<string, number>) =>
        Object.keys(byType).length > 1 || (Object.keys(byType).length === 1 && !byType['course'])

    const typeBreakdown = (byType: Record<string, number>) =>
        Object.entries(byType)
            .map(([type, count]) => `${count} ${getSessionConfig(type).label}`)
            .join(' · ')

    const statCards = [
        {
            label: t('teacher.statistique.cards.todayCourses'),
            value: todayStats.total,
            icon: Calendar,
            color: 'text-indigo-400',
            bg: 'bg-indigo-500/10',
            breakdown: hasMultipleTypes(todayStats.byType) ? typeBreakdown(todayStats.byType) : null,
        },
        {
            label: t('teacher.statistique.cards.remaining'),
            value: todayStats.remaining,
            icon: Clock,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10',
            breakdown: hasMultipleTypes(todayStats.remainingByType) ? typeBreakdown(todayStats.remainingByType) : null,
        },
        {
            label: t('teacher.statistique.cards.callsDone'),
            value: todayStats.done,
            icon: CheckCircle2,
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10',
            breakdown: null,
        },
        {
            label: t('teacher.statistique.cards.callsLate'),
            value: todayStats.overdue,
            icon: AlertCircle,
            color: todayStats.overdue > 0 ? 'text-orange-400' : 'text-slate-500',
            bg:    todayStats.overdue > 0 ? 'bg-orange-500/10' : 'bg-slate-500/10',
            breakdown: null,
        },
    ]

    const schoolGroups = groupBySchool(classStats)

    const toggleSchool = (key: string) =>
        setExpandedSchools(prev => ({ ...prev, [key]: !prev[key] }))

    return (
        <div className="space-y-8 pb-16">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">{t('teacher.statistique.title')}</h1>
                <p className="text-sm text-muted-foreground capitalize mt-0.5">{todayLabel}</p>
            </div>

            {/* Today's 4 stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {statCards.map(({ label, value, icon: Icon, color, bg, breakdown }) => (
                    <Card key={label} className="bg-card border-border/50">
                        <CardContent className="p-4">
                            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-3', bg)}>
                                <Icon className={cn('w-5 h-5', color)} />
                            </div>
                            <p className="text-2xl font-bold">{value}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{label}</p>
                            {breakdown && (
                                <p className="text-[10px] text-muted-foreground/70 mt-1 leading-tight font-medium">
                                    {breakdown}
                                </p>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Pending roll-calls */}
            {pendingSessions.length > 0 && (
                <section className="space-y-3">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-orange-400" />
                        <h2 className="font-semibold text-sm">{t('teacher.statistique.pendingTitle')}</h2>
                    </div>
                    <div className="space-y-2">
                        {pendingSessions.map(s => (
                            <div
                                key={s.id}
                                className="flex items-center justify-between gap-3 bg-orange-500/5 border border-orange-500/20 rounded-2xl px-4 py-3"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse shrink-0" />
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <p className="text-sm font-semibold truncate">{s.subjectName}</p>
                                            {s.sessionType !== 'course' && (
                                                <span className={cn('text-[10px] font-bold shrink-0', getSessionConfig(s.sessionType).text)}>
                                                    {getSessionConfig(s.sessionType).label}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {s.className} · {s.startTime}–{s.endTime}
                                        </p>
                                    </div>
                                </div>
                                <Link href={`/teacher/classes/${s.classId}`} className="shrink-0">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="rounded-xl text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 gap-1 text-xs"
                                    >
                                        {t('teacher.statistique.takeRoll')}
                                        <ChevronRight className="w-3.5 h-3.5" />
                                    </Button>
                                </Link>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Classes grouped by school */}
            {schoolGroups.length > 0 && (
                <section className="space-y-6">
                    <div className="flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-primary" />
                        <h2 className="font-semibold text-sm">{t('teacher.statistique.myClasses')}</h2>
                        <span className="text-xs text-muted-foreground">{t('teacher.statistique.thisWeek')}</span>
                    </div>

                    {schoolGroups.map(group => {
                        const key = group.schoolId ?? '__no_school__'
                        const isExpanded = expandedSchools[key] === true

                        return (
                            <div key={key} className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                                {/* School header — same style as classes-list */}
                                <div
                                    onClick={() => toggleSchool(key)}
                                    className={cn(
                                        'flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 dark:bg-slate-900/40 backdrop-blur-xl p-5 rounded-[28px] border border-slate-150 dark:border-white/5 shadow-[0_4px_25px_-10px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all duration-300 cursor-pointer select-none group/header active:scale-[0.99]',
                                        isExpanded && 'ring-1 ring-indigo-500/20 bg-indigo-50/10 dark:bg-indigo-950/10'
                                    )}
                                >
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="relative shrink-0">
                                            <div className="absolute -inset-1 bg-gradient-to-tr from-indigo-500 to-teal-400 rounded-2xl opacity-10 group-hover/header:opacity-30 transition-opacity blur-sm" />
                                            <Avatar className="h-14 w-14 rounded-2xl border border-slate-150 dark:border-white/10 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] bg-white dark:bg-slate-950 relative flex items-center justify-center overflow-hidden group-hover/header:scale-[1.03] transition-transform duration-300">
                                                <AvatarImage src={group.schoolLogoUrl || undefined} className="object-cover" />
                                                <AvatarFallback className="rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 text-indigo-600 dark:text-indigo-400 font-black">
                                                    <Building2 className="w-5 h-5" />
                                                </AvatarFallback>
                                            </Avatar>
                                        </div>
                                        <div className="min-w-0">
                                            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight group-hover/header:text-indigo-600 dark:group-hover/header:text-indigo-400 transition-colors truncate leading-tight">
                                                {group.schoolName}
                                            </h2>
                                            <div className="flex items-center gap-1.5 mt-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-widest opacity-90">
                                                    {group.classes.length === 1
                                                        ? t('teacher.classes.assignedOne').replace('{count}', '1')
                                                        : t('teacher.classes.assigned').replace('{count}', group.classes.length.toString())}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={cn(
                                        'h-9 w-9 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-white/5 text-slate-400 transition-all duration-300 group-hover/header:text-indigo-600 shadow-inner shrink-0 self-end md:self-auto',
                                        isExpanded ? 'rotate-180 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 border-indigo-100 dark:border-indigo-500/20' : 'rotate-0'
                                    )}>
                                        <ChevronDown className="w-4 h-4" />
                                    </div>
                                </div>

                                {/* Expandable class cards */}
                                <AnimatePresence initial={false}>
                                    {isExpanded && (
                                        <motion.div
                                            key="content"
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                                            className="overflow-hidden"
                                        >
                                            <div className="grid gap-4 sm:grid-cols-2 pt-1 pb-2 px-0.5">
                                                {group.classes.map(cls => (
                                                    <Link key={cls.classId} href={`/teacher/classes/${cls.classId}`} className="block group">
                                                        <div className="h-full bg-white dark:bg-slate-900/40 border border-slate-150 dark:border-white/5 rounded-[24px] hover:border-indigo-500/30 dark:hover:border-indigo-500/30 hover:shadow-[0_10px_30px_-10px_rgba(0,0,0,0.05)] transition-all duration-300 flex flex-col justify-between relative overflow-hidden cursor-pointer hover:-translate-y-1">
                                                            <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-indigo-500 to-teal-400" />
                                                            <div className="absolute -top-20 -right-20 w-40 h-40 bg-indigo-500/5 dark:bg-indigo-500/10 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                                                            <div className="p-5 space-y-3">
                                                                {/* Class name + rate badge */}
                                                                <div className="flex items-start justify-between gap-2">
                                                                    <p className="font-black text-base text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                                        {cls.className}
                                                                    </p>
                                                                    <span className={cn(
                                                                        'text-xs font-bold px-2 py-0.5 rounded-full shrink-0',
                                                                        cls.weekRate === 100 ? 'bg-emerald-500/10 text-emerald-400' :
                                                                        cls.weekRate >= 50   ? 'bg-blue-500/10 text-blue-400'       :
                                                                        cls.weekRate > 0     ? 'bg-orange-500/10 text-orange-400'   :
                                                                                              'bg-slate-500/10 text-slate-400',
                                                                    )}>
                                                                        {cls.weekRate}%
                                                                    </span>
                                                                </div>

                                                                {/* Subjects */}
                                                                {cls.subjects.length > 0 && (
                                                                    <div className="flex flex-wrap gap-1.5">
                                                                        {cls.subjects.map(sub => (
                                                                            <span
                                                                                key={sub.name}
                                                                                className="text-[9px] font-black bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-100/50 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-300 px-2.5 py-1 rounded-full shadow-sm uppercase tracking-wider"
                                                                            >
                                                                                {sub.icon ? `${sub.icon} ` : ''}{sub.name}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {/* Progress */}
                                                                <div>
                                                                    <Progress value={cls.weekRate} className="h-1.5" />
                                                                    <p className="text-[10px] text-muted-foreground mt-1.5">
                                                                        {t('teacher.statistique.callsProgress', { done: cls.weekDone, total: cls.weekTotal })}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <div className="mx-5 mb-5 mt-1 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                                                                <span>{t('teacher.classes.viewClass') || 'Consulter la Classe'}</span>
                                                                <div className={cn('p-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5 opacity-80 group-hover:opacity-100 transition-all', isRTL ? 'group-hover:-translate-x-1' : 'group-hover:translate-x-1')}>
                                                                    <ChevronRight className={cn('w-3 h-3', isRTL ? 'rotate-180' : '')} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </Link>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )
                    })}
                </section>
            )}

            {/* Week planning grid */}
            {weekView.length > 0 && (
                <section className="space-y-3">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-primary" />
                        <h2 className="font-semibold text-sm">{t('teacher.statistique.weekPlanning')}</h2>
                    </div>

                    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                        <div className="flex gap-2.5 min-w-max sm:min-w-0 sm:grid sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-7">
                            {weekView.map(day => (
                                <div
                                    key={day.dateStr}
                                    className={cn(
                                        'rounded-2xl border p-3 min-w-[148px] sm:min-w-0 flex flex-col gap-2',
                                        day.isToday
                                            ? 'bg-primary/5 border-primary/40'
                                            : 'bg-card border-border/50',
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className={cn(
                                            'text-xs font-bold uppercase tracking-wide',
                                            day.isToday ? 'text-primary' : 'text-muted-foreground',
                                        )}>
                                            {t(`teacher.statistique.days.${day.dayOfWeek}`)}
                                        </span>
                                        <span className={cn(
                                            'text-[11px] font-medium tabular-nums w-6 h-6 flex items-center justify-center rounded-full',
                                            day.isToday ? 'bg-primary text-white' : 'text-muted-foreground',
                                        )}>
                                            {new Date(day.dateStr + 'T12:00:00').getDate()}
                                        </span>
                                    </div>

                                    <div className="space-y-2">
                                        {day.sessions.map(s => {
                                            const st = sessionStatus(s.done, day.isPast, day.isToday, s.startTime, nowHHMM)
                                            const sessConf = getSessionConfig(s.sessionType)
                                            const isExam = s.sessionType !== 'course'
                                            return (
                                                <div key={s.id} className="flex items-start gap-2">
                                                    <div className={cn('w-1.5 h-1.5 rounded-full mt-1 shrink-0', STATUS_DOTS[st])} />
                                                    <div className="min-w-0">
                                                        <p className="text-[11px] font-medium leading-tight truncate">{s.subjectName}</p>
                                                        <p className="text-[10px] text-muted-foreground leading-tight truncate flex items-center gap-1">
                                                            {s.startTime} · {s.className}
                                                            {isExam && (
                                                                <span className={cn('font-bold', sessConf.text)}>· {sessConf.label}</span>
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
                        {(Object.keys(STATUS_DOTS) as SessionStatus[]).map(st => (
                            <div key={st} className="flex items-center gap-1.5">
                                <div className={cn('w-2 h-2 rounded-full', STATUS_DOTS[st].replace(' animate-pulse', ''))} />
                                <span className="text-[10px] text-muted-foreground">{statusLabels[st]}</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Empty state */}
            {classStats.length === 0 && weekView.length === 0 && (
                <div className="text-center py-16">
                    <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground text-sm">{t('teacher.statistique.noClassesWeek')}</p>
                </div>
            )}
        </div>
    )
}
