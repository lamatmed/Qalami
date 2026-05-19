'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import {
    Loader2, ChevronDown, ChevronUp,
    BookOpen, Users, BarChart3, Calendar,
    TrendingUp, TrendingDown, ArrowLeft,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/i18n'
import {
    getClassAttendanceDetails,
} from '@/app/admin/attendance/actions'

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

function formatDate(dateStr: string, lang: 'fr' | 'ar') {
    return new Date(dateStr).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR', {
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
    classId,
}: {
    period: ClassPeriod
    enrolledStudents: EnrolledStudent[]
    classId?: string
}) {
    const { t, language } = useLanguage()
    const [open,    setOpen]    = useState(false)
    const [loading, setLoading] = useState(false)
    const [rows,    setRows]    = useState<{ student_id: string; status: string }[]>([])

    const toggle = async () => {
        if (open) { setOpen(false); return }
        if (rows.length === 0) {
            setLoading(true)
            try {
                const supabase = createClient()
                // Virtual period ids are "virtual-DATE-N" — extract date
                const date = period.id.startsWith('virtual-') ? period.date : null
                let query = supabase
                    .from('attendance')
                    .select('student_id, status')
                if (date) {
                    query = query.eq('date', date) as any
                    if (classId) {
                        query = query.eq('class_id', classId) as any
                    }
                } else {
                    query = query.eq('period_id', period.id) as any
                }
                const { data } = await query
                setRows(data ?? [])
            } catch { /* silent */ } finally {
                setLoading(false)
            }
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
                        {period.subjectName ?? t('admin.attendance.generalRollCall')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(period.date, language)}</p>
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
                            {t('admin.attendance.noEnrolledStudents')}
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
                                                {t(`admin.attendance.status.${status}`)}
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

export function AttendanceClient({ classId }: { classId?: string }) {
    const { t, language } = useLanguage()
    const router = useRouter()
    const [classOptions,    setClassOptions]    = useState<{ id: string; name: string }[]>([])
    const [selectedClassId, setSelectedClassId] = useState(classId ?? '')
    const [loadingInit,     setLoadingInit]     = useState(true)
    const [loadingClass,    setLoadingClass]    = useState(false)
    const [todayOverview,   setTodayOverview]   = useState<any>(null)

    const [periods,          setPeriods]          = useState<ClassPeriod[]>([])
    const [subjectStats,     setSubjectStats]     = useState<SubjectStat[]>([])
    const [studentStats,     setStudentStats]     = useState<StudentStat[]>([])
    const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([])

    // Load class list and today's overview in parallel
    useEffect(() => {
        const supabase = createClient()
        async function init() {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) { setLoadingInit(false); return }

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('school_id')
                    .eq('id', user.id)
                    .single()

                const schoolId = profile?.school_id
                if (!schoolId) { setLoadingInit(false); return }

                const today = new Date().toISOString().split('T')[0]

                const classesRes = await supabase.from('classes').select('id, name').eq('school_id', schoolId).order('name')
                const classIds = (classesRes.data ?? []).map((c: any) => c.id)

                const [todayRes, latestRes] = classIds.length > 0 ? await Promise.all([
                    supabase.from('attendance').select('student_id, status, class_id').in('class_id', classIds).eq('date', today),
                    supabase.from('attendance').select('class_id, date').in('class_id', classIds).order('date', { ascending: false }),
                ]) : [{ data: [] }, { data: [] }]

                const classes = classesRes.data ?? []
                const todayRows = todayRes.data ?? []
                const latestRows = latestRes.data ?? []

                // Latest date per class
                const latestDateByClass = new Map<string, string>()
                latestRows.forEach((r: any) => {
                    if (!latestDateByClass.has(r.class_id)) latestDateByClass.set(r.class_id, r.date)
                })

                // Stats per class today
                const statsByClass = new Map<string, any>()
                todayRows.forEach((r: any) => {
                    if (!statsByClass.has(r.class_id)) statsByClass.set(r.class_id, { present: 0, absent: 0, late: 0, excused: 0 })
                    const s = statsByClass.get(r.class_id)
                    s[r.status] = (s[r.status] ?? 0) + 1
                })

                const classesWithStatus = classes.map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    level: null,
                    hasDoneAttendance: statsByClass.has(c.id),
                    lastAttendanceDate: latestDateByClass.get(c.id) ?? null,
                    periodStatus: statsByClass.has(c.id) ? 'closed' : null,
                    stats: statsByClass.get(c.id) ?? null,
                }))

                const totalPresent = todayRows.filter((r: any) => r.status === 'present' || r.status === 'late').length
                const totalAbsent  = todayRows.filter((r: any) => r.status === 'absent').length

                setClassOptions(classes as { id: string; name: string }[])
                setTodayOverview({ classes: classesWithStatus, totalPresent, totalAbsent, absentees: [] })
            } catch (err) {
                console.error('Attendance init failed:', err)
            } finally {
                setLoadingInit(false)
            }
        }
        init()
    }, [])

    // Load class data when selection changes
    const loadClass = useCallback(async (classId: string) => {
        if (!classId) return
        setLoadingClass(true)
        setPeriods([])
        setSubjectStats([])
        setStudentStats([])
        setEnrolledStudents([])
        try {
            const result = await getClassAttendanceDetails(classId)
            setPeriods((result?.periods ?? []) as ClassPeriod[])
            setSubjectStats((result?.subjectStats ?? []) as SubjectStat[])
            setEnrolledStudents((result?.enrolled ?? []) as EnrolledStudent[])
            setStudentStats((result?.stats ?? []) as StudentStat[])
        } catch (err) {
            console.error('loadClass failed:', err)
        } finally {
            setLoadingClass(false)
        }
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

            {/* ── Header / Class Selector ────────────────────────────────────── */}
            <motion.div variants={item} className="flex items-center gap-3">
                {classId ? (
                    <button
                        onClick={() => router.push('/admin/attendance')}
                        className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground bg-card border border-border/50 rounded-2xl px-4 py-2.5 transition-colors shadow-sm cursor-pointer"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        {language === 'ar' ? 'الرجوع' : 'Retour'}
                    </button>
                ) : (
                    <select
                        value={selectedClassId}
                        onChange={e => {
                            if (e.target.value) {
                                router.push(`/admin/attendance/${e.target.value}`)
                            }
                        }}
                        className="w-full sm:w-72 bg-card border border-border/50 rounded-2xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors shadow-sm"
                    >
                        <option value="">{t('admin.attendance.selectClassPlaceholder')}</option>
                        {classOptions.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                )}
                {classId && (
                    <h2 className="text-xl font-black text-foreground">
                        {classOptions.find(c => c.id === classId)?.name || ''}
                    </h2>
                )}
            </motion.div>

            {/* ── Empty state ────────────────────────────────────────────────── */}
            {!selectedClassId ? (
                <motion.div variants={item} className="space-y-6">
                    {/* Today's Overview Metrics */}
                    {todayOverview && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm relative overflow-hidden group">
                                <div className="flex flex-col">
                                    <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                                        {language === 'ar' ? 'إجمالي الحضور اليوم' : "Total Présents Aujourd'hui"}
                                    </span>
                                    <span className="text-2xl font-black mt-1 text-emerald-500">
                                        {todayOverview.totalPresent}
                                    </span>
                                </div>
                                <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-emerald-500/5 rounded-full" />
                            </div>
                            <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm relative overflow-hidden group">
                                <div className="flex flex-col">
                                    <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                                        {language === 'ar' ? 'إجمالي الغياب اليوم' : "Total Absents Aujourd'hui"}
                                    </span>
                                    <span className="text-2xl font-black mt-1 text-red-500">
                                        {todayOverview.totalAbsent}
                                    </span>
                                </div>
                                <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-red-500/5 rounded-full" />
                            </div>
                            <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm relative overflow-hidden group">
                                <div className="flex flex-col">
                                    <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                                        {language === 'ar' ? 'معدل الحضور العام' : "Taux de Présence Global"}
                                    </span>
                                    <span className="text-2xl font-black mt-1 text-indigo-500">
                                        {todayOverview.totalPresent + todayOverview.totalAbsent > 0
                                            ? `${Math.round((todayOverview.totalPresent / (todayOverview.totalPresent + todayOverview.totalAbsent)) * 100)}%`
                                            : '—'}
                                    </span>
                                </div>
                                <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-indigo-500/5 rounded-full" />
                            </div>
                        </div>
                    )}

                    {/* Classes Attendance Status Grid */}
                    <div className="bg-card rounded-3xl border border-border/50 p-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/50 pb-4 gap-2">
                            <div>
                                <h3 className="font-bold text-lg text-foreground">
                                    {language === 'ar' ? 'إحصائيات الحضور حسب الأقسام' : "Statistiques de Présence par Classe"}
                                </h3>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {language === 'ar' ? 'متابعة يومية فورية لدفتر الحضور' : "Suivi en temps réel de l'appel journalier"}
                                </p>
                            </div>
                        </div>

                        {todayOverview?.classes?.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground text-sm">
                                {language === 'ar' ? 'لا توجد أقسام مضافة.' : 'Aucune classe configurée.'}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {todayOverview?.classes?.map((c: any) => {
                                    const stats = c.stats
                                    const total = stats ? (stats.present + stats.absent + stats.late + stats.excused) : 0
                                    const rate = total > 0 ? Math.round(((stats.present + stats.late) / total) * 100) : null

                                    return (
                                        <div key={c.id} className="bg-accent/10 border border-border/30 rounded-2xl p-4 hover:border-indigo-500/30 hover:bg-accent/20 transition-all flex flex-col justify-between gap-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h4 className="font-extrabold text-foreground text-sm">{c.name}</h4>
                                                    <span className={cn(
                                                        "text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-1",
                                                        c.hasDoneAttendance 
                                                            ? "bg-emerald-500/10 text-emerald-500" 
                                                            : c.lastAttendanceDate 
                                                                ? "bg-indigo-500/10 text-indigo-500" 
                                                                : "bg-amber-500/10 text-amber-500"
                                                    )}>
                                                        {c.hasDoneAttendance 
                                                            ? (language === 'ar' ? 'تم تسجيل حضور اليوم' : "Appel Fait Aujourd'hui") 
                                                            : c.lastAttendanceDate 
                                                                ? (language === 'ar' ? `آخر تسجيل: ${formatDate(c.lastAttendanceDate, language)}` : `Dernier appel : ${formatDate(c.lastAttendanceDate, language)}`)
                                                                : (language === 'ar' ? 'لم يتم تسجيل أي حضور' : "Aucun appel enregistré")}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => setSelectedClassId(c.id)}
                                                    className="text-xs font-bold text-indigo-500 hover:text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 rounded-xl transition-all"
                                                >
                                                    {language === 'ar' ? 'التفاصيل ←' : "Détails →"}
                                                </button>
                                            </div>

                                            {rate !== null && (
                                                <div className="space-y-1">
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-muted-foreground">
                                                            {language === 'ar' ? 'معدل الحضور :' : "Taux de présence :"}
                                                        </span>
                                                        <span className={cn("font-bold", rateColor(rate))}>{rate}%</span>
                                                    </div>
                                                    <div className="h-1.5 bg-border/30 rounded-full overflow-hidden">
                                                        <div
                                                            className={cn('h-full rounded-full transition-all duration-500', rateBar(rate))}
                                                            style={{ width: `${rate}%` }}
                                                        />
                                                    </div>
                                                    {stats && (
                                                        <p className="text-[10px] text-muted-foreground">
                                                            {stats.present} {language === 'ar' ? 'حاضر' : 'Présents'} · {stats.absent} {language === 'ar' ? 'غائب' : 'Absents'} · {stats.late} {language === 'ar' ? 'متأخر' : 'Retards'}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
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
                                label: t('admin.attendance.sessions'),
                                value: String(totalSessions),
                                icon: Calendar,
                                iconColor: 'text-blue-500/10 group-hover:text-blue-500/20',
                            },
                            {
                                label: t('admin.attendance.globalAttendance'),
                                value: globalRate !== null ? `${globalRate}%` : '—',
                                icon: BarChart3,
                                iconColor: globalRate !== null && globalRate >= 80
                                    ? 'text-emerald-500/10 group-hover:text-emerald-500/20'
                                    : 'text-amber-500/10 group-hover:text-amber-500/20',
                                warn: globalRate !== null && globalRate < 80,
                            },
                            {
                                label: t('admin.attendance.bestSubject'),
                                value: bestSubject?.subjectName ?? '—',
                                sub:   bestSubject ? `${bestSubject.rate}%` : undefined,
                                icon:  TrendingUp,
                                iconColor: 'text-emerald-500/10 group-hover:text-emerald-500/20',
                            },
                            {
                                label: t('admin.attendance.worstSubject'),
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
                                <h3 className="font-bold text-lg text-foreground">{t('admin.attendance.sessionsHeader')}</h3>
                                <span className="text-xs text-muted-foreground">
                                    {t('admin.attendance.sessionsCount', { count: periods.length })}
                                </span>
                            </div>
                            {periods.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 gap-3 bg-card rounded-2xl border border-border/50">
                                    <Calendar className="w-8 h-8 text-muted-foreground opacity-30" />
                                    <p className="text-sm text-muted-foreground">
                                        {t('admin.attendance.noSessions30Days')}
                                    </p>
                                </div>
                            ) : (
                                <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
                                    {periods.map(period => (
                                        <PeriodRow
                                            key={period.id}
                                            period={period}
                                            enrolledStudents={enrolledStudents}
                                            classId={selectedClassId}
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
                                    <h3 className="font-bold text-lg text-foreground">{t('admin.attendance.bySubject')}</h3>
                                    <span className="text-xs text-muted-foreground">{t('admin.attendance.30Days')}</span>
                                </div>
                                {subjectStats.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 gap-2 bg-card rounded-2xl border border-border/50">
                                        <BookOpen className="w-6 h-6 text-muted-foreground opacity-30" />
                                        <p className="text-xs text-muted-foreground">{t('admin.attendance.noSubjectData')}</p>
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
                                                        t('admin.attendance.sessionsCountShort', { count: s.sessions }),
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
                                    <h3 className="font-bold text-lg text-foreground">{t('admin.attendance.byStudent')}</h3>
                                    <span className="text-xs text-muted-foreground">{t('admin.attendance.30Days')}</span>
                                </div>
                                {studentStats.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 gap-2 bg-card rounded-2xl border border-border/50">
                                        <Users className="w-6 h-6 text-muted-foreground opacity-30" />
                                        <p className="text-xs text-muted-foreground">{t('admin.attendance.noStudentData')}</p>
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
                                                            t('admin.attendance.sessionsCountShort', { count: student.total }),
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
