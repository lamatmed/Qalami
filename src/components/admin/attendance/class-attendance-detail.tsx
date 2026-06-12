/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/i18n'
import {
    ArrowLeft, Loader2, BookOpen, Clock, User,
    ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock3, BadgeCheck,
} from 'lucide-react'
import { getClassAttendanceDetails, getClassSchedule } from '@/app/admin/attendance/actions'
import { createClient } from '@/utils/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClassPeriod {
    id: string
    date: string
    subjectId: string | null
    subjectName: string | null
    startTime: string | null
    endTime: string | null
    teacherName: string | null
    status: string
    stats: { present: number; absent: number; late: number; excused: number }
}

interface StudentRow { id: string; name: string; status: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { pill: string; dot: string; label: string }> = {
    present: { pill: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500', label: 'Présent'  },
    absent:  { pill: 'bg-red-500/15 text-red-600 dark:text-red-400',             dot: 'bg-red-500',     label: 'Absent'   },
    late:    { pill: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',       dot: 'bg-amber-500',   label: 'Retard'   },
    excused: { pill: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',          dot: 'bg-blue-500',    label: 'Excusé'   },
}
const STATUS_ORDER: Record<string, number> = { absent: 0, late: 1, excused: 2, present: 3 }
const WORST: Record<string, number> = { absent: 0, late: 1, excused: 2, present: 3 }

function fmt(t: string | null) { return t ? t.slice(0, 5) : null }

function rateColor(r: number) {
    if (r >= 90) return 'text-emerald-500'
    if (r >= 70) return 'text-amber-500'
    return 'text-red-500'
}
function rateBar(r: number) {
    if (r >= 90) return 'bg-emerald-500'
    if (r >= 70) return 'bg-amber-500'
    return 'bg-red-500'
}
function localToday() {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}
function fmtLong(d: string, lang: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
}
function fmtShort(d: string, lang: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long',
    })
}

// ─── Session card ─────────────────────────────────────────────────────────────

function SessionCard({ period, classId, open: initOpen, router }: {
    period: ClassPeriod
    classId: string
    open: boolean
    router: ReturnType<typeof useRouter>
}) {
    const [expanded, setExpanded] = useState(initOpen)
    const [loading,  setLoading]  = useState(false)
    const [students, setStudents] = useState<StudentRow[] | null>(null)

    const fetchStudents = useCallback(async () => {
        if (students !== null) return
        setLoading(true)
        try {
            const sb = createClient()
            const isSynthetic = period.id.startsWith('virtual-') || period.id.startsWith('grp-')
            // Extract schedule_id from grp- IDs: format is grp-date::subjectId::scheduleId
            // Split on '::' — part[0]=date, part[1]=subjectId or 'null', part[2]=scheduleId or '__nosched__'
            const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            const idParts = period.id.replace(/^grp-/, '').split('::')
            const embeddedSchedId = idParts.length >= 3 && uuidRe.test(idParts[2]) ? idParts[2] : null

            let q = sb.from('attendance')
                .select('student_id, status, profiles!attendance_student_id_fkey(full_name)')
            if (isSynthetic) {
                q = (q.eq('date', period.date) as any).eq('class_id', classId)
                if (period.subjectId) q = (q as any).eq('subject_id', period.subjectId)
                // If this group was built from a specific schedule slot, scope to it
                if (embeddedSchedId) q = (q as any).eq('schedule_id', embeddedSchedId)
            } else {
                q = q.eq('period_id', period.id) as any
            }
            const { data } = await q
            const deduped = new Map<string, StudentRow>()
            ;(data ?? []).forEach((r: any) => {
                const ex = deduped.get(r.student_id)
                if (!ex || (WORST[r.status] ?? 99) < (WORST[ex.status] ?? 99)) {
                    deduped.set(r.student_id, {
                        id: r.student_id,
                        name: (r.profiles as any)?.full_name ?? '—',
                        status: r.status as string,
                    })
                }
            })
            setStudents(
                [...deduped.values()].sort((a, b) =>
                    (STATUS_ORDER[a.status] ?? 4) - (STATUS_ORDER[b.status] ?? 4) ||
                    a.name.localeCompare(b.name)
                )
            )
        } catch { /* silent */ } finally { setLoading(false) }
    }, [period, classId, students])

    useEffect(() => { if (initOpen) fetchStudents() }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const toggle = () => {
        if (!expanded && students === null) fetchStudents()
        setExpanded(v => !v)
    }

    const s     = period.stats
    const total = s.present + s.absent + s.late + s.excused
    const rate  = total > 0 ? Math.round(((s.present + s.late) / total) * 100) : null
    const start = fmt(period.startTime)
    const end   = fmt(period.endTime)

    return (
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">

            {/* Header */}
            <button type="button" onClick={toggle}
                className="w-full text-left px-5 py-4 hover:bg-accent/20 transition-colors">

                <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                        <BookOpen className="w-5 h-5 text-indigo-500" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-0.5">
                        <p className="font-extrabold text-base text-foreground leading-tight">
                            {period.subjectName ?? 'Appel général'}
                        </p>
                        {(start || end) && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3 shrink-0" />
                                {start}{end ? ` – ${end}` : ''}
                            </p>
                        )}
                        {period.teacherName && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <User className="w-3 h-3 shrink-0" />
                                {period.teacherName}
                            </p>
                        )}
                    </div>

                    {/* Right side: stats + badge */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {total > 0 && (
                            <div className="flex items-center gap-1 flex-wrap justify-end">
                                {s.present > 0 && (
                                    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500">
                                        {s.present}✓
                                    </span>
                                )}
                                {s.absent > 0 && (
                                    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-red-500/10 text-red-500">
                                        {s.absent}✗
                                    </span>
                                )}
                                {s.late > 0 && (
                                    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-500">
                                        {s.late}~
                                    </span>
                                )}
                                {rate !== null && (
                                    <span className={cn('text-[11px] font-extrabold', rateColor(rate))}>
                                        {rate}%
                                    </span>
                                )}
                            </div>
                        )}
                        <span className={cn(
                            'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                            period.status === 'open'
                                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        )}>
                            {period.status === 'open' ? 'Ouvert' : 'Fermé'}
                        </span>
                    </div>

                    {/* Chevron */}
                    <div className="shrink-0 self-center ml-1">
                        {loading
                            ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                            : expanded
                                ? <ChevronUp   className="w-4 h-4 text-muted-foreground" />
                                : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        }
                    </div>
                </div>

                {/* Rate bar */}
                {rate !== null && (
                    <div className="mt-3 h-1.5 bg-border/30 rounded-full overflow-hidden">
                        <div
                            className={cn('h-full rounded-full transition-all duration-500', rateBar(rate))}
                            style={{ width: `${rate}%` }}
                        />
                    </div>
                )}
            </button>

            {/* Student list */}
            <AnimatePresence initial={false}>
                {expanded && students !== null && (
                    <motion.div
                        key="students"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t border-border/50"
                    >
                        {students.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-5 italic">
                                Aucun élève enregistré
                            </p>
                        ) : (
                            <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-0.5">
                                {students.map(st => {
                                    const cfg = STATUS_CFG[st.status] ?? STATUS_CFG.present
                                    return (
                                        <button key={st.id} type="button"
                                            onClick={() => router.push(`/admin/students/${st.id}`)}
                                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-accent/30 transition-colors text-left w-full">
                                            <div className={cn('w-2 h-2 rounded-full shrink-0', cfg.dot)} />
                                            <span className="text-sm font-medium text-foreground flex-1 truncate">
                                                {st.name}
                                            </span>
                                            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0', cfg.pill)}>
                                                {cfg.label}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const anim = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }

export function ClassAttendanceDetail({ classId }: { classId: string }) {
    const { language } = useLanguage()
    const router = useRouter()

    const [loading,     setLoading]     = useState(true)
    const [className,   setClassName]   = useState('')
    const [todayPeriods, setToday]      = useState<ClassPeriod[]>([])
    const [histPeriods,  setHist]       = useState<ClassPeriod[]>([])

    const todayStr = localToday()

    useEffect(() => {
        let alive = true
        ;(async () => {
            try {
                const [detRes, schedRes, clsRes] = await Promise.allSettled([
                    getClassAttendanceDetails(classId),
                    getClassSchedule(classId),
                    createClient().from('classes').select('name').eq('id', classId).single(),
                ])

                if (!alive) return

                if (clsRes.status === 'fulfilled') {
                    setClassName((clsRes.value as any).data?.name ?? '')
                }

                if (detRes.status === 'fulfilled') {
                    const slots = schedRes.status === 'fulfilled' ? (schedRes.value ?? []) : []

                    // Sort ASC → latest startTime wins when same subjectId+dayOfWeek
                    const sorted = [...slots].sort((a, b) =>
                        (a.startTime ?? '').localeCompare(b.startTime ?? '')
                    )
                    const bySubDow = new Map<string, typeof slots[0]>()
                    const byDow    = new Map<number,  typeof slots[0]>()
                    sorted.forEach(s => {
                        bySubDow.set(`${s.subjectId ?? 'null'}::${s.dayOfWeek}`, s)
                        if (!byDow.has(s.dayOfWeek)) byDow.set(s.dayOfWeek, s)
                    })

                    const raw = (detRes.value?.periods ?? []) as ClassPeriod[]
                    const enriched = raw.map(p => {
                        const [yr, mo, da] = p.date.split('-').map(Number)
                        const dow  = new Date(yr, mo - 1, da).getDay()
                        const sched = bySubDow.get(`${p.subjectId ?? 'null'}::${dow}`)
                            ?? (!p.subjectId ? byDow.get(dow) : undefined)
                        return {
                            ...p,
                            subjectName: p.subjectName ?? sched?.subjectName ?? null,
                            startTime:   p.startTime   ?? sched?.startTime   ?? null,
                            endTime:     p.endTime     ?? sched?.endTime     ?? null,
                            teacherName: p.teacherName ?? sched?.teacherName ?? null,
                        }
                    })
                    // Sort each group by startTime
                    const sortByTime = (a: ClassPeriod, b: ClassPeriod) =>
                        (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99')

                    // Only show sessions where attendance was actually recorded
                    const hasRecords = (p: ClassPeriod) =>
                        p.stats.present + p.stats.absent + p.stats.late + p.stats.excused > 0

                    setToday(enriched.filter(p => p.date === todayStr && hasRecords(p)).sort(sortByTime))
                    setHist(enriched.filter(p => p.date !== todayStr && hasRecords(p)).sort(sortByTime))
                }
            } catch (e) {
                console.error('ClassAttendanceDetail:', e)
            } finally {
                if (alive) setLoading(false)
            }
        })()
        return () => { alive = false }
    }, [classId]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Totals ────────────────────────────────────────────────────────────────
    const totals = todayPeriods.reduce(
        (a, p) => ({
            present: a.present + p.stats.present,
            absent:  a.absent  + p.stats.absent,
            late:    a.late    + p.stats.late,
            excused: a.excused + p.stats.excused,
        }),
        { present: 0, absent: 0, late: 0, excused: 0 }
    )
    const totalN = totals.present + totals.absent + totals.late + totals.excused
    const globalRate = totalN > 0
        ? Math.round(((totals.present + totals.late) / totalN) * 100)
        : null

    // ── Group history by date ─────────────────────────────────────────────────
    const histMap = new Map<string, ClassPeriod[]>()
    histPeriods.forEach(p => {
        if (!histMap.has(p.date)) histMap.set(p.date, [])
        histMap.get(p.date)!.push(p)
    })
    const histDates = [...histMap.keys()].sort((a, b) => b.localeCompare(a))

    // ── Loading ───────────────────────────────────────────────────────────────
    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    )

    return (
        <motion.div
            initial="hidden" animate="show"
            variants={{ show: { transition: { staggerChildren: 0.06 } } }}
            className="space-y-6 pb-24"
        >
            {/* ── Back + title ──────────────────────────────────────────────── */}
            <motion.div variants={anim} className="flex items-center gap-4">
                <button
                    type="button"
                    title={language === 'ar' ? 'رجوع' : 'Retour'}
                    onClick={() => router.push('/admin/attendance')}
                    className="p-2.5 bg-card hover:bg-accent border border-border/50 rounded-xl transition-colors shadow-sm shrink-0"
                >
                    <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                </button>
                <div>
                    <h1 className="text-2xl font-black text-foreground leading-tight">
                        {className || '—'}
                    </h1>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mt-0.5">
                        {language === 'ar' ? 'تفاصيل الحضور' : 'Détail des présences'}
                    </p>
                </div>
            </motion.div>

            {/* ── TODAY ─────────────────────────────────────────────────────── */}
            <motion.section variants={anim}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-lg text-foreground">
                        {language === 'ar' ? 'اليوم' : "Aujourd'hui"}
                    </h2>
                    <span className="text-xs text-muted-foreground">
                        {fmtLong(todayStr, language)}
                    </span>
                </div>

                {todayPeriods.length === 0 ? (
                    <div className="bg-card border border-border/50 rounded-2xl p-12 flex flex-col items-center gap-3 text-center">
                        <BookOpen className="w-10 h-10 text-muted-foreground/20" />
                        <p className="text-sm text-muted-foreground">
                            {language === 'ar' ? 'لا توجد سجلات حضور اليوم' : "Aucune séance enregistrée aujourd'hui"}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">

                        {/* Global summary card */}
                        {globalRate !== null && (
                            <div className="bg-card border border-border/50 rounded-2xl px-5 py-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        {language === 'ar' ? 'معدل الحضور الكلي' : 'Taux de présence global'}
                                    </span>
                                    <span className={cn('text-2xl font-black', rateColor(globalRate))}>
                                        {globalRate}%
                                    </span>
                                </div>
                                <div className="h-2 bg-border/30 rounded-full overflow-hidden mb-3">
                                    <div
                                        className={cn('h-full rounded-full transition-all duration-700', rateBar(globalRate))}
                                        style={{ width: `${globalRate}%` }}
                                    />
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    {totals.present > 0 && (
                                        <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-500">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            {totals.present} présents
                                        </span>
                                    )}
                                    {totals.absent > 0 && (
                                        <span className="flex items-center gap-1.5 text-xs font-bold text-red-500">
                                            <XCircle className="w-3.5 h-3.5" />
                                            {totals.absent} absents
                                        </span>
                                    )}
                                    {totals.late > 0 && (
                                        <span className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
                                            <Clock3 className="w-3.5 h-3.5" />
                                            {totals.late} retards
                                        </span>
                                    )}
                                    {totals.excused > 0 && (
                                        <span className="flex items-center gap-1.5 text-xs font-bold text-blue-500">
                                            <BadgeCheck className="w-3.5 h-3.5" />
                                            {totals.excused} excusés
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* One card per session — expanded by default */}
                        {todayPeriods.map(p => (
                            <SessionCard key={p.id} period={p} classId={classId} open router={router} />
                        ))}
                    </div>
                )}
            </motion.section>

            {/* ── HISTORY ───────────────────────────────────────────────────── */}
            {histDates.length > 0 && (
                <motion.section variants={anim}>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold text-lg text-foreground">
                            {language === 'ar' ? 'السجل' : 'Historique'}
                        </h2>
                        <span className="text-xs text-muted-foreground">
                            {histDates.length} {histDates.length === 1 ? 'jour' : 'jours'}
                        </span>
                    </div>

                    <div className="space-y-5">
                        {histDates.map(date => (
                            <div key={date}>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2.5 px-1">
                                    {fmtShort(date, language)}
                                </p>
                                <div className="space-y-2">
                                    {histMap.get(date)!.map(p => (
                                        <SessionCard key={p.id} period={p} classId={classId} open={false} router={router} />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.section>
            )}
        </motion.div>
    )
}
