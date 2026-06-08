/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/i18n'
import {
    ArrowLeft, Loader2, Users, CheckCircle2,
    XCircle, Clock, AlertCircle, Calendar, ChevronDown, ChevronUp,
} from 'lucide-react'
import { getTodayClassAttendance, getClassAttendanceDetails } from '@/app/admin/attendance/actions'
import { createClient } from '@/utils/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Student {
    id: string
    name: string
    status: string | null
}

interface ClassPeriod {
    id: string
    date: string
    subjectName: string | null
    stats: { present: number; absent: number; late: number; excused: number }
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { color: string; dot: string; icon: React.ElementType; order: number }> = {
    absent:  { color: 'bg-red-500/10 text-red-500',     dot: 'bg-red-500',     icon: XCircle,      order: 0 },
    late:    { color: 'bg-amber-500/10 text-amber-500', dot: 'bg-amber-500',   icon: Clock,        order: 1 },
    excused: { color: 'bg-blue-500/10 text-blue-500',   dot: 'bg-blue-500',    icon: AlertCircle,  order: 2 },
    present: { color: 'bg-emerald-500/10 text-emerald-500', dot: 'bg-emerald-500', icon: CheckCircle2, order: 3 },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string, lang: string) {
    return new Date(dateStr).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
}
function formatDateShort(dateStr: string, lang: string) {
    return new Date(dateStr).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR', {
        weekday: 'short', day: 'numeric', month: 'short',
    })
}

// ─── Period row (expandable) ──────────────────────────────────────────────────

function PeriodRow({
    period, classId, enrolledIds, lang,
    statusLabel,
}: {
    period: ClassPeriod
    classId: string
    enrolledIds: string[]
    lang: string
    statusLabel: (s: string) => string
}) {
    const [open, setOpen]     = useState(false)
    const [loading, setLoading] = useState(false)
    const [rows, setRows]     = useState<{ student_id: string; status: string; full_name?: string }[]>([])

    const toggle = async () => {
        if (open) { setOpen(false); return }
        if (rows.length === 0) {
            setLoading(true)
            try {
                const supabase = createClient()
                const isVirtual = period.id.startsWith('virtual-')
                let query = supabase
                    .from('attendance')
                    .select('student_id, status, profiles!attendance_student_id_fkey(full_name)')
                if (isVirtual) {
                    query = (query.eq('date', period.date) as any).eq('class_id', classId)
                } else {
                    query = query.eq('period_id', period.id) as any
                }
                const { data } = await query
                setRows((data ?? []).map((r: any) => ({
                    student_id: r.student_id,
                    status: r.status,
                    full_name: (r.profiles as any)?.full_name ?? '—',
                })))
            } catch { /* silent */ } finally {
                setLoading(false)
            }
        }
        setOpen(true)
    }

    const total = period.stats.present + period.stats.absent + period.stats.late + period.stats.excused

    return (
        <div className="border-b border-border/50 last:border-0">
            <button
                type="button"
                onClick={toggle}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors text-left"
            >
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                        {period.subjectName ?? (lang === 'ar' ? 'نداء عام' : 'Appel général')}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDateShort(period.date, lang)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {period.stats.present > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500">
                            {period.stats.present}✓
                        </span>
                    )}
                    {period.stats.absent > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-red-500/10 text-red-500">
                            {period.stats.absent}✗
                        </span>
                    )}
                    {period.stats.late > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-500">
                            {period.stats.late}↻
                        </span>
                    )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                    {total > 0 ? `${Math.round(((period.stats.present + period.stats.late) / total) * 100)}%` : '—'}
                </span>
                {loading
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />
                    : open
                        ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                }
            </button>

            {open && (
                <div className="bg-accent/20 border-t border-border/50 px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {rows.map(r => {
                        const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.present
                        return (
                            <div key={r.student_id} className="flex items-center gap-2 py-1">
                                <div className={cn('w-2 h-2 rounded-full shrink-0', cfg.dot)} />
                                <span className="text-xs text-foreground flex-1 truncate">{r.full_name}</span>
                                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0', cfg.color)}>
                                    {statusLabel(r.status)}
                                </span>
                            </div>
                        )
                    })}
                    {rows.length === 0 && (
                        <p className="text-xs text-muted-foreground col-span-2 text-center py-2">—</p>
                    )}
                </div>
            )}
        </div>
    )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function ClassAttendanceDetail({ classId }: { classId: string }) {
    const { t, language } = useLanguage()
    const router = useRouter()

    const [className,    setClassName]    = useState('')
    const [todayStudents, setTodayStudents] = useState<Student[]>([])
    const [todayDate,    setTodayDate]    = useState('')
    const [hasToday,     setHasToday]     = useState(false)
    const [periods,      setPeriods]      = useState<ClassPeriod[]>([])
    const [loading,      setLoading]      = useState(true)

    const statusLabel = (s: string) => t(`admin.attendance.status.${s}`) || s

    useEffect(() => {
        let active = true

        ;(async () => {
            try {
                const [todayRes, detailRes] = await Promise.allSettled([
                    getTodayClassAttendance(classId),
                    getClassAttendanceDetails(classId),
                ])

                if (!active) return

                if (todayRes.status === 'fulfilled') {
                    const td = todayRes.value
                    setTodayStudents((td?.students ?? []) as Student[])
                    setTodayDate(td?.date ?? '')
                    setHasToday(td?.hasData ?? false)
                }

                if (detailRes.status === 'fulfilled') {
                    const d = detailRes.value
                    setPeriods((d?.periods ?? []) as ClassPeriod[])
                    // Extract class name from enrolled data or periods
                }
            } catch (err) {
                console.error('ClassAttendanceDetail load failed:', err)
            } finally {
                setLoading(false)
            }
        })()

        // Get class name from Supabase directly
        ;(async () => {
            try {
                const supabase = createClient()
                const { data } = await supabase
                    .from('classes')
                    .select('name')
                    .eq('id', classId)
                    .single()
                if (active && data?.name) setClassName(data.name)
            } catch { /* silent */ }
        })()

        return () => { active = false }
    }, [classId])

    // Sort: absent first, then late, then excused, then present, then unrecorded
    const ORDER: Record<string, number> = { absent: 0, late: 1, excused: 2, present: 3 }
    const sorted = [...todayStudents].sort((a, b) => {
        const oa = a.status ? (ORDER[a.status] ?? 4) : 5
        const ob = b.status ? (ORDER[b.status] ?? 4) : 5
        if (oa !== ob) return oa - ob
        return a.name.localeCompare(b.name)
    })

    const present = todayStudents.filter(s => s.status === 'present').length
    const absent  = todayStudents.filter(s => s.status === 'absent').length
    const late    = todayStudents.filter(s => s.status === 'late').length
    const excused = todayStudents.filter(s => s.status === 'excused').length
    const none    = todayStudents.filter(s => !s.status).length

    const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }
    const item = { hidden: { y: 12, opacity: 0 }, show: { y: 0, opacity: 1 } }

    if (loading) return (
        <div className="flex items-center justify-center py-40">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
        </div>
    )

    return (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 pb-24">

            {/* ── Header ────────────────────────────────────────────────────── */}
            <motion.div variants={item} className="flex items-center gap-4">
                <button
                    type="button"
                    title={t('common.back')}
                    onClick={() => router.push('/admin/attendance')}
                    className="p-2 bg-card hover:bg-accent border border-border/50 rounded-xl transition-colors shrink-0 shadow-sm"
                >
                    <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                </button>
                <div>
                    <h2 className="text-2xl font-black text-foreground leading-tight">
                        {className || '—'}
                    </h2>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mt-0.5">
                        {language === 'ar' ? 'تفاصيل الحضور' : 'Détail des présences'}
                    </p>
                </div>
            </motion.div>

            {/* ── Today's attendance ────────────────────────────────────────── */}
            <motion.div variants={item}>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-lg text-foreground">
                        {t('admin.attendance.todayAttendance')}
                    </h3>
                    {todayDate && (
                        <span className="text-xs text-muted-foreground capitalize">
                            {formatDate(todayDate, language)}
                        </span>
                    )}
                </div>

                {!hasToday ? (
                    <div className="bg-card rounded-2xl border border-border/50 p-10 flex flex-col items-center gap-3">
                        <Users className="w-10 h-10 text-muted-foreground opacity-25" />
                        <p className="text-sm text-muted-foreground">
                            {t('admin.attendance.noAttendanceToday')}
                        </p>
                    </div>
                ) : (
                    <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">

                        {/* Summary chips */}
                        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border/50">
                            {present > 0 && (
                                <span className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-500 text-xs font-bold px-3 py-1.5 rounded-xl">
                                    <CheckCircle2 className="w-3 h-3" /> {present} {t('admin.attendance.status.present')}
                                </span>
                            )}
                            {absent > 0 && (
                                <span className="flex items-center gap-1.5 bg-red-500/10 text-red-500 text-xs font-bold px-3 py-1.5 rounded-xl">
                                    <XCircle className="w-3 h-3" /> {absent} {t('admin.attendance.status.absent')}
                                </span>
                            )}
                            {late > 0 && (
                                <span className="flex items-center gap-1.5 bg-amber-500/10 text-amber-500 text-xs font-bold px-3 py-1.5 rounded-xl">
                                    <Clock className="w-3 h-3" /> {late} {t('admin.attendance.status.late')}
                                </span>
                            )}
                            {excused > 0 && (
                                <span className="flex items-center gap-1.5 bg-blue-500/10 text-blue-500 text-xs font-bold px-3 py-1.5 rounded-xl">
                                    <AlertCircle className="w-3 h-3" /> {excused} {t('admin.attendance.status.excused')}
                                </span>
                            )}
                            {none > 0 && (
                                <span className="bg-muted/60 text-muted-foreground text-xs font-bold px-3 py-1.5 rounded-xl">
                                    {none} {t('admin.attendance.notRecorded')}
                                </span>
                            )}
                        </div>

                        {/* Student grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 p-3 gap-0.5">
                            {sorted.map(student => {
                                const cfg = student.status ? STATUS_CONFIG[student.status] : null
                                const Icon = cfg?.icon
                                return (
                                    <div
                                        key={student.id}
                                        className="flex items-center gap-2.5 py-2 px-3 rounded-xl hover:bg-accent/30 transition-colors"
                                    >
                                        {Icon ? (
                                            <Icon className={cn('w-4 h-4 shrink-0', cfg?.color.split(' ')[1])} />
                                        ) : (
                                            <div className="w-4 h-4 shrink-0 rounded-full border-2 border-border/40" />
                                        )}
                                        <span className="text-sm text-foreground flex-1 truncate font-medium">
                                            {student.name}
                                        </span>
                                        {student.status ? (
                                            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0', cfg?.color)}>
                                                {statusLabel(student.status)}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-muted-foreground/40 shrink-0">—</span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </motion.div>

            {/* ── Historical sessions ───────────────────────────────────────── */}
            {periods.length > 0 && (
                <motion.div variants={item}>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-lg text-foreground">
                            {t('admin.attendance.sessionsHeader')}
                        </h3>
                        <span className="text-xs text-muted-foreground">
                            {t('admin.attendance.sessionsCount', { count: periods.length })}
                        </span>
                    </div>
                    <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
                        {periods.map(period => (
                            <PeriodRow
                                key={period.id}
                                period={period}
                                classId={classId}
                                enrolledIds={todayStudents.map(s => s.id)}
                                lang={language}
                                statusLabel={statusLabel}
                            />
                        ))}
                    </div>
                </motion.div>
            )}

        </motion.div>
    )
}
