'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    getClasses,
    getEnrolledStudents,
    getClassPeriods,
    getSubjectStatsForClass,
    getClassAttendanceStats,
    getAttendanceForPeriod,
} from '@/app/admin/attendance/actions'
import {
    Loader2, ChevronDown, ChevronUp,
    BookOpen, Users, BarChart3, Calendar,
    TrendingUp, TrendingDown,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClassPeriod {
    id: string
    date: string
    status: string
    subjectId: string | null
    subjectName: string | null
    stats: { present: number; absent: number; late: number; excused: number }
}

interface SubjectStat {
    subjectId: string | null
    subjectName: string
    sessions: number
    present: number
    absent: number
    late: number
    excused: number
    total: number
    rate: number | null
}

interface StudentStat {
    id: string
    name: string
    present: number
    absent: number
    late: number
    excused: number
    total: number
}

interface EnrolledStudent {
    id: string
    full_name: string
    avatar_url: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
        weekday: 'short', day: 'numeric', month: 'short',
    })
}

const STATUS_LABELS: Record<string, string> = {
    present: 'Présent', absent: 'Absent', late: 'Retard', excused: 'Excusé',
}
const STATUS_COLORS: Record<string, string> = {
    present: 'bg-emerald-500/15 text-emerald-500',
    absent:  'bg-red-500/15 text-red-500',
    late:    'bg-amber-500/15 text-amber-500',
    excused: 'bg-blue-500/15 text-blue-500',
}
const STATUS_DOT: Record<string, string> = {
    present: 'bg-emerald-500',
    absent:  'bg-red-500',
    late:    'bg-amber-500',
    excused: 'bg-blue-500',
}

function rateColor(rate: number | null) {
    if (rate === null) return 'text-muted-foreground'
    if (rate >= 90)    return 'text-emerald-500'
    if (rate >= 70)    return 'text-amber-500'
    return 'text-red-500'
}
function rateBar(rate: number | null) {
    if (rate === null) return 'bg-border'
    if (rate >= 90)    return 'bg-emerald-500'
    if (rate >= 70)    return 'bg-amber-500'
    return 'bg-red-500'
}

// ─── Motion presets ───────────────────────────────────────────────────────────

const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.07 } },
}
const item = {
    hidden: { y: 16, opacity: 0 },
    show:  { y: 0,  opacity: 1  },
}

// ─── Period row — expandable student list ─────────────────────────────────────

function PeriodRow({
    period,
    enrolledStudents,
}: {
    period: ClassPeriod
    enrolledStudents: EnrolledStudent[]
}) {
    const [open,    setOpen]    = useState(false)
    const [loading, setLoading] = useState(false)
    const [rows,    setRows]    = useState<{ student_id: string; status: string }[]>([])

    const toggle = async () => {
        if (open) { setOpen(false); return }
        if (rows.length === 0) {
            setLoading(true)
            const data = await getAttendanceForPeriod(period.id)
            setRows(data as { student_id: string; status: string }[])
            setLoading(false)
        }
        setOpen(true)
    }

    const total = period.stats.present + period.stats.absent + period.stats.late + period.stats.excused
    const rate  = total > 0 ? Math.round(((period.stats.present + period.stats.late) / total) * 100) : null
    const statusMap = new Map(rows.map(r => [r.student_id, r.status]))

    return (
        <div className="border-b border-border/50 last:border-b-0">
            <button
                className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-accent/50 transition-colors text-left"
                onClick={toggle}
            >
                {/* Subject + date */}
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                        {period.subjectName ?? 'Appel général'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(period.date)}</p>
                </div>

                {/* Mini chips */}
                <div className="hidden sm:flex items-center gap-1 shrink-0">
                    {period.stats.present > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                            {period.stats.present}P
                        </span>
                    )}
                    {period.stats.absent > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-red-500/10 text-red-500">
                            {period.stats.absent}A
                        </span>
                    )}
                    {period.stats.late > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-500">
                            {period.stats.late}R
                        </span>
                    )}
                </div>

                {/* Rate */}
                {rate !== null && (
                    <span className={cn('text-sm font-black w-10 text-right shrink-0', rateColor(rate))}>
                        {rate}%
                    </span>
                )}

                {/* Chevron / spinner */}
                {loading
                    ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
                    : open
                        ? <ChevronUp   className="w-4 h-4 text-muted-foreground shrink-0" />
                        : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                }
            </button>

            {/* Expanded student list */}
            {open && (
                <div className="bg-accent/20 border-t border-border/50 px-4 py-3">
                    {enrolledStudents.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">
                            Aucun élève inscrit
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {enrolledStudents.map(student => {
                                const status = statusMap.get(student.id) ?? null
                                return (
                                    <div key={student.id} className="flex items-center gap-2.5 py-1">
                                        <div className={cn(
                                            'w-2 h-2 rounded-full shrink-0',
                                            status ? STATUS_DOT[status] : 'bg-border'
                                        )} />
                                        <span className="text-xs text-foreground flex-1 truncate">
                                            {student.full_name}
                                        </span>
                                        {status && (
                                            <span className={cn(
                                                'text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0',
                                                STATUS_COLORS[status]
                                            )}>
                                                {STATUS_LABELS[status]}
                                            </span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ─── Progress bar row ─────────────────────────────────────────────────────────

function ProgressRow({
    label, rate, sublabel,
}: { label: string; rate: number | null; sublabel?: string }) {
    return (
        <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-foreground truncate pr-2">{label}</span>
                <span className={cn('text-xs font-black shrink-0', rateColor(rate))}>
                    {rate !== null ? `${rate}%` : '—'}
                </span>
            </div>
            <div className="h-1.5 bg-border/30 rounded-full overflow-hidden">
                <div
                    className={cn('h-full rounded-full transition-all duration-500', rateBar(rate))}
                    style={{ width: rate !== null ? `${rate}%` : '0%' }}
                />
            </div>
            {sublabel && (
                <p className="text-[10px] text-muted-foreground mt-1">{sublabel}</p>
            )}
        </div>
    )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function AttendanceClient() {
    const [classOptions,    setClassOptions]    = useState<{ id: string; name: string }[]>([])
    const [selectedClassId, setSelectedClassId] = useState('')
    const [loadingInit,     setLoadingInit]     = useState(true)
    const [loadingClass,    setLoadingClass]    = useState(false)

    const [periods,          setPeriods]          = useState<ClassPeriod[]>([])
    const [subjectStats,     setSubjectStats]     = useState<SubjectStat[]>([])
    const [studentStats,     setStudentStats]     = useState<StudentStat[]>([])
    const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([])

    // Load class list
    useEffect(() => {
        getClasses().then(data => {
            setClassOptions(data as { id: string; name: string }[])
            setLoadingInit(false)
        })
    }, [])

    // Load class data when selection changes
    const loadClass = useCallback(async (classId: string) => {
        if (!classId) return
        setLoadingClass(true)
        const [p, ss, sts, enrolled] = await Promise.all([
            getClassPeriods(classId, 30),
            getSubjectStatsForClass(classId, 30),
            getClassAttendanceStats(classId, 30),
            getEnrolledStudents(classId),
        ])
        setPeriods(p as ClassPeriod[])
        setSubjectStats(ss as SubjectStat[])
        setStudentStats(sts as StudentStat[])
        setEnrolledStudents(enrolled as EnrolledStudent[])
        setLoadingClass(false)
    }, [])

    useEffect(() => { loadClass(selectedClassId) }, [selectedClassId, loadClass])

    // Derived global stats
    const totalSessions  = periods.length
    const globalTotal    = subjectStats.reduce((s, x) => s + x.total, 0)
    const globalPresent  = subjectStats.reduce((s, x) => s + x.present + x.late, 0)
    const globalRate     = globalTotal > 0 ? Math.round((globalPresent / globalTotal) * 100) : null
    const sortedByRate   = subjectStats.filter(s => s.rate !== null)
    const bestSubject    = [...sortedByRate].sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))[0]
    const worstSubject   = [...sortedByRate].sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0))[0]

    if (loadingInit) return (
        <div className="flex items-center justify-center py-40">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
        </div>
    )

    return (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-5 pb-24">

            {/* ── Class selector ────────────────────────────────────────────── */}
            <motion.div variants={item}>
                <select
                    value={selectedClassId}
                    onChange={e => setSelectedClassId(e.target.value)}
                    className="w-full sm:w-72 bg-card border border-border/50 rounded-2xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                >
                    <option value="">Sélectionner une classe…</option>
                    {classOptions.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </motion.div>

            {/* ── Empty state ────────────────────────────────────────────────── */}
            {!selectedClassId ? (
                <motion.div variants={item}
                    className="flex flex-col items-center justify-center py-24 gap-4 bg-card rounded-3xl border border-border/50"
                >
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="w-6 h-6 text-primary" />
                    </div>
                    <div className="text-center">
                        <p className="font-bold text-foreground">Choisissez une classe</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            Sélectionnez une classe pour voir les présences et les statistiques.
                        </p>
                    </div>
                </motion.div>
            ) : loadingClass ? (
                <div className="flex items-center justify-center py-40">
                    <Loader2 className="w-7 h-7 animate-spin text-primary" />
                </div>
            ) : (
                <>
                    {/* ── KPI cards ────────────────────────────────────────────── */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {([
                            {
                                label: 'Séances',
                                value: String(totalSessions),
                                icon: Calendar,
                                iconColor: 'text-blue-500/10 group-hover:text-blue-500/20',
                            },
                            {
                                label: 'Présence globale',
                                value: globalRate !== null ? `${globalRate}%` : '—',
                                icon: BarChart3,
                                iconColor: globalRate !== null && globalRate >= 80
                                    ? 'text-emerald-500/10 group-hover:text-emerald-500/20'
                                    : 'text-amber-500/10 group-hover:text-amber-500/20',
                                warn: globalRate !== null && globalRate < 80,
                            },
                            {
                                label: 'Meilleure matière',
                                value: bestSubject?.subjectName ?? '—',
                                sub:   bestSubject ? `${bestSubject.rate}%` : undefined,
                                icon:  TrendingUp,
                                iconColor: 'text-emerald-500/10 group-hover:text-emerald-500/20',
                            },
                            {
                                label: 'À surveiller',
                                value: worstSubject?.subjectName ?? '—',
                                sub:   worstSubject ? `${worstSubject.rate}%` : undefined,
                                icon:  TrendingDown,
                                iconColor: 'text-red-500/10 group-hover:text-red-500/20',
                                warn: true,
                            },
                        ] as Array<{
                            label: string
                            value: string
                            icon: React.ElementType
                            iconColor: string
                            sub?: string
                            warn?: boolean
                        }>).map(({ label, value, sub, icon: Icon, iconColor, warn }) => (
                            <motion.div key={label} variants={item}
                                className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm relative overflow-hidden group"
                            >
                                <div className="flex flex-col">
                                    <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                                        {label}
                                    </span>
                                    <span className={cn(
                                        'text-xl font-bold mt-1 truncate',
                                        warn ? 'text-amber-500' : 'text-foreground'
                                    )}>
                                        {value}
                                    </span>
                                    {sub && (
                                        <span className="text-xs text-muted-foreground mt-0.5">{sub}</span>
                                    )}
                                </div>
                                <Icon className={cn(
                                    'absolute -bottom-4 -right-4 w-20 h-20 transition-colors',
                                    iconColor
                                )} />
                            </motion.div>
                        ))}
                    </div>

                    {/* ── Main grid ────────────────────────────────────────────── */}
                    <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">

                        {/* ── Left: sessions list ────────────────────────────── */}
                        <motion.div variants={item}>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-bold text-lg text-foreground">Séances</h3>
                                <span className="text-xs text-muted-foreground">
                                    {periods.length} séance{periods.length !== 1 ? 's' : ''} · 30 jours
                                </span>
                            </div>
                            {periods.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 gap-3 bg-card rounded-2xl border border-border/50">
                                    <Calendar className="w-8 h-8 text-muted-foreground opacity-30" />
                                    <p className="text-sm text-muted-foreground">
                                        Aucune séance enregistrée sur 30 jours
                                    </p>
                                </div>
                            ) : (
                                <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
                                    {periods.map(period => (
                                        <PeriodRow
                                            key={period.id}
                                            period={period}
                                            enrolledStudents={enrolledStudents}
                                        />
                                    ))}
                                </div>
                            )}
                        </motion.div>

                        {/* ── Right: stats ───────────────────────────────────── */}
                        <div className="space-y-5">

                            {/* Per-subject stats */}
                            <motion.div variants={item}>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-bold text-lg text-foreground">Par matière</h3>
                                    <span className="text-xs text-muted-foreground">30 jours</span>
                                </div>
                                {subjectStats.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 gap-2 bg-card rounded-2xl border border-border/50">
                                        <BookOpen className="w-6 h-6 text-muted-foreground opacity-30" />
                                        <p className="text-xs text-muted-foreground">Aucune donnée par matière</p>
                                    </div>
                                ) : (
                                    <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
                                        <div className="divide-y divide-border/50">
                                            {subjectStats.map(s => (
                                                <ProgressRow
                                                    key={s.subjectId ?? '__none__'}
                                                    label={s.subjectName}
                                                    rate={s.rate}
                                                    sublabel={[
                                                        `${s.sessions} séance${s.sessions !== 1 ? 's' : ''}`,
                                                        `${s.present}P`,
                                                        s.absent > 0  ? `${s.absent}A`  : null,
                                                        s.late   > 0  ? `${s.late}R`    : null,
                                                    ].filter(Boolean).join(' · ')}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </motion.div>

                            {/* Per-student stats */}
                            <motion.div variants={item}>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-bold text-lg text-foreground">Par élève</h3>
                                    <span className="text-xs text-muted-foreground">30 jours</span>
                                </div>
                                {studentStats.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 gap-2 bg-card rounded-2xl border border-border/50">
                                        <Users className="w-6 h-6 text-muted-foreground opacity-30" />
                                        <p className="text-xs text-muted-foreground">Aucune donnée sur les élèves</p>
                                    </div>
                                ) : (
                                    <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
                                        <div className="divide-y divide-border/50 max-h-96 overflow-y-auto">
                                            {(studentStats as StudentStat[]).map(student => {
                                                const rate = student.total > 0
                                                    ? Math.round(((student.present + student.late) / student.total) * 100)
                                                    : 100
                                                return (
                                                    <ProgressRow
                                                        key={student.id}
                                                        label={student.name}
                                                        rate={rate}
                                                        sublabel={[
                                                            `${student.present}P`,
                                                            student.absent > 0 ? `${student.absent}A` : null,
                                                            student.late   > 0 ? `${student.late}R`   : null,
                                                            `${student.total} séances`,
                                                        ].filter(Boolean).join(' · ')}
                                                    />
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </motion.div>

                        </div>
                    </div>
                </>
            )}
        </motion.div>
    )
}
