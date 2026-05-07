/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSchoolContext } from '@/lib/use-school-context'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
    GraduationCap, DollarSign, AlertTriangle, ArrowRight,
    Megaphone, BookOpen, Clock, RefreshCw, UserPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClassStat {
    id: string
    name: string
    studentCount: number
    avgGrade: number | null
}

interface DashboardData {
    studentCount: number
    teacherCount: number
    attendanceRate: number | null
    recoveryRate: number | null
    unassignedStudents: number
    noCurrentTerm: boolean
    classes: ClassStat[]
    recentGrades: { id: string; student_name: string; subject_name: string; value: number; max_value: number }[]
    announcements: { id: string; title: string; content: string; target_audience: any; priority: string | null; created_at: string }[]
    schoolId: string
    userId: string
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
    const { context, loading: ctxLoading } = useSchoolContext()
    const [data, setData] = useState<DashboardData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchAll = useCallback(async () => {
        if (!context) return
        setLoading(true)
        setError(null)
        const supabase = createClient()

        const sid = context.school_id
        const now = new Date()
        const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

        const [
            { data: termData },
            { count: studentCount },
            { count: teacherCount },
            { data: classData },
            { data: allStudents },
            { data: enrolled },
            { data: monthPayments },
            { data: announcements },
        ] = await Promise.all([
            supabase.from('terms').select('name').eq('school_id', sid).eq('is_current', true).single(),
            supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', sid).eq('role', 'student').eq('status', 'active'),
            supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', sid).eq('role', 'teacher').eq('status', 'active'),
            supabase.from('classes').select('id, name').eq('school_id', sid),
            supabase.from('profiles').select('id').eq('school_id', sid).eq('role', 'student').eq('status', 'active'),
            supabase.from('enrollments').select('student_id, class_id').eq('school_id', sid).eq('status', 'active'),
            supabase.from('payments').select('amount, amount_paid').eq('school_id', sid).gte('due_date', startMonth).lte('due_date', endMonth),
            supabase.from('announcements').select('id, title, content, target_audience, priority, created_at').eq('school_id', sid).order('created_at', { ascending: false }).limit(4),
        ])

        // Attendance
        const classIds = (classData || []).map((c: any) => c.id)
        let attendanceRate: number | null = null
        if (classIds.length > 0) {
            const { data: attData } = await supabase.from('attendance').select('status').in('class_id', classIds)
            if (attData && attData.length > 0) {
                const present = attData.filter((a: any) => a.status === 'present').length
                attendanceRate = Math.round((present / attData.length) * 100)
            }
        }

        // Grades
        const studentIds = (allStudents || []).map((s: any) => s.id)
        let recentGrades: DashboardData['recentGrades'] = []
        if (studentIds.length > 0) {
            const { data: gradesData } = await supabase
                .from('grades')
                .select('id, value, max_value, profiles!grades_student_id_fkey(full_name), subjects(name)')
                .in('student_id', studentIds)
                .order('created_at', { ascending: false })
                .limit(5)
            recentGrades = (gradesData || []).map((g: any) => ({
                id: g.id,
                student_name: g.profiles?.full_name ?? '—',
                subject_name: g.subjects?.name ?? '—',
                value: Number(g.value),
                max_value: Number(g.max_value) || 20,
            }))
        }

        // Class enrollment counts
        const enrolledList = enrolled || []
        const classCounts: Record<string, number> = {}
        enrolledList.forEach((e: any) => {
            if (e.class_id) classCounts[e.class_id] = (classCounts[e.class_id] || 0) + 1
        })

        // Average grade per class
        const studentToClass: Record<string, string> = {}
        enrolledList.forEach((e: any) => {
            if (e.student_id && e.class_id) studentToClass[e.student_id] = e.class_id
        })
        const classGradeMap: Record<string, { sum: number; count: number }> = {}
        if (studentIds.length > 0 && classIds.length > 0) {
            const { data: allGrades } = await supabase
                .from('grades').select('value, max_value, student_id').in('student_id', studentIds)
            ;(allGrades || []).forEach((g: any) => {
                const cid = studentToClass[g.student_id]
                if (!cid) return
                if (!classGradeMap[cid]) classGradeMap[cid] = { sum: 0, count: 0 }
                classGradeMap[cid].sum += (Number(g.value) / (Number(g.max_value) || 20)) * 20
                classGradeMap[cid].count += 1
            })
        }

        const classes: ClassStat[] = (classData || [])
            .map((c: any) => ({
                id: c.id,
                name: c.name,
                studentCount: classCounts[c.id] || 0,
                avgGrade: classGradeMap[c.id]
                    ? Math.round((classGradeMap[c.id].sum / classGradeMap[c.id].count) * 10) / 10
                    : null,
            }))
            .sort((a: ClassStat, b: ClassStat) => b.studentCount - a.studentCount)

        // Finance
        const monthData = monthPayments || []
        const monthlyExpected = monthData.reduce((s: number, p: any) => s + Number(p.amount), 0)
        const monthlyReceived = monthData.reduce((s: number, p: any) => s + Number(p.amount_paid), 0)
        const recoveryRate = monthlyExpected > 0 ? Math.round((monthlyReceived / monthlyExpected) * 100) : null

        // Unassigned students
        const enrolledSet = new Set(enrolledList.map((e: any) => e.student_id))
        const unassignedStudents = (allStudents || []).filter((s: any) => !enrolledSet.has(s.id)).length

        setData({
            studentCount: studentCount ?? 0,
            teacherCount: teacherCount ?? 0,
            attendanceRate,
            recoveryRate,
            unassignedStudents,
            noCurrentTerm: !termData,
            classes,
            recentGrades,
            announcements: announcements || [],
            schoolId: sid,
            userId: context.user_id,
        })
        setLoading(false)
    }, [context])

    useEffect(() => {
        fetchAll().catch(() => { setError('Erreur de chargement'); setLoading(false) })
    }, [fetchAll])

    if (ctxLoading || loading) return <DashboardSkeleton />
    if (error) return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400" />
            <p className="text-sm text-gray-400">{error}</p>
            <Button variant="outline" onClick={fetchAll} className="gap-2">
                <RefreshCw className="w-4 h-4" /> Réessayer
            </Button>
        </div>
    )
    if (!data) return null

    const maxClassStudents = Math.max(...data.classes.map(c => c.studentCount), 1)

    // Sparkline bar data — deterministic from value
    const sparkBars = (v: number | null, len = 7): number[] => {
        const seed = v ?? 0
        return Array.from({ length: len }, (_, i) => {
            const x = Math.sin(seed * 9301 + i * 49297 + 233) * 10000
            return Math.round(Math.abs(x % 8) + 2)
        })
    }

    return (
        <div className="space-y-5 max-w-[1400px] mx-auto">

            {/* ── Alert banner ── */}
            {data.unassignedStudents > 0 && (
                <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-2xl bg-amber-500/8 border border-amber-500/20">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                        </div>
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                            <span className="font-semibold">{data.unassignedStudents} élève{data.unassignedStudents > 1 ? 's' : ''}</span> sans classe assignée
                        </p>
                    </div>
                    <Link href="/admin/students" className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors shrink-0">
                        Gérer les élèves <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                </div>
            )}

            {/* ── 4 Stat cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Élèves actifs"
                    value={data.studentCount}
                    accent="emerald"
                    href="/admin/students"
                    bars={sparkBars(data.studentCount)}
                />
                <StatCard
                    label="Enseignants"
                    value={data.teacherCount}
                    accent="blue"
                    href="/admin/teachers"
                    bars={sparkBars(data.teacherCount + 17)}
                />
                <StatCard
                    label="Taux de présence"
                    value={data.attendanceRate != null ? `${data.attendanceRate}%` : '—'}
                    accent={data.attendanceRate == null ? 'gray' : data.attendanceRate >= 80 ? 'emerald' : data.attendanceRate >= 60 ? 'amber' : 'red'}
                    bars={sparkBars(data.attendanceRate)}
                />
                <StatCard
                    label="Recouvrement"
                    value={data.recoveryRate != null ? `${data.recoveryRate}%` : '—'}
                    accent={data.recoveryRate == null ? 'gray' : data.recoveryRate >= 80 ? 'emerald' : data.recoveryRate >= 50 ? 'amber' : 'red'}
                    href="/admin/finance/tuition"
                    bars={sparkBars(data.recoveryRate ? data.recoveryRate + 33 : null)}
                />
            </div>

            {/* ── Row 2: Actions rapides + Répartition par classe ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Actions rapides */}
                <div className="bg-[#161B22] rounded-2xl border border-white/5 p-5">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-4">Actions rapides</p>
                    <div className="grid grid-cols-2 gap-2.5">
                        {[
                            { icon: UserPlus,    label: 'Inscrire un élève',   href: '/admin/students/register', iconCls: 'text-emerald-400 bg-emerald-500/10' },
                            { icon: DollarSign,  label: 'Ajouter transaction', href: '/admin/finance',           iconCls: 'text-amber-400 bg-amber-500/10' },
                            { icon: Clock,       label: 'Emploi du temps',     href: '/admin/schedule',          iconCls: 'text-blue-400 bg-blue-500/10' },
                        ].map(a => (
                            <Link
                                key={a.href}
                                href={a.href}
                                className="flex items-center gap-3 p-3.5 rounded-xl border border-white/5 bg-white/2 hover:bg-white/5 hover:border-white/10 transition-colors"
                            >
                                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', a.iconCls)}>
                                    <a.icon className="w-4 h-4" />
                                </div>
                                <span className="text-sm text-gray-300 font-medium leading-tight">{a.label}</span>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Répartition par classe */}
                <div className="bg-[#161B22] rounded-2xl border border-white/5 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Répartition par classe</p>
                        <Link href="/admin/classes" className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors">
                            Voir tout →
                        </Link>
                    </div>
                    {data.classes.length === 0 ? (
                        <div className="text-center py-8">
                            <GraduationCap className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                            <p className="text-xs text-gray-600">Aucune classe créée</p>
                        </div>
                    ) : (
                        <div className="space-y-3.5">
                            {data.classes.slice(0, 5).map(c => (
                                <div key={c.id} className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-gray-300">{c.name}</span>
                                        <div className="flex items-center gap-3">
                                            {c.avgGrade != null && (
                                                <span className={cn('text-[11px] font-semibold',
                                                    c.avgGrade >= 14 ? 'text-emerald-400' :
                                                    c.avgGrade >= 10 ? 'text-amber-400' : 'text-red-400'
                                                )}>
                                                    moy. {c.avgGrade}/20
                                                </span>
                                            )}
                                            <span className="text-[11px] text-gray-500">{c.studentCount} élèves</span>
                                        </div>
                                    </div>
                                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-500/50 rounded-full transition-all duration-700"
                                            style={{ width: `${Math.round((c.studentCount / maxClassStudents) * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Row 3: Dernières notes + Annonces récentes ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Dernières notes */}
                <div className="bg-[#161B22] rounded-2xl border border-white/5 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Dernières notes</p>
                        <Link href="/admin/grades" className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors">
                            Voir tout →
                        </Link>
                    </div>
                    {data.recentGrades.length === 0 ? (
                        <div className="text-center py-8">
                            <BookOpen className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                            <p className="text-xs text-gray-600">Aucune note saisie</p>
                        </div>
                    ) : (
                        <div className="space-y-3.5">
                            {data.recentGrades.map((g, i) => {
                                const pct = Math.round((g.value / g.max_value) * 100)
                                const barColor = pct >= 70 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
                                const textColor = pct >= 70 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400'
                                const avatarPalette = [
                                    'bg-emerald-500/20 text-emerald-400',
                                    'bg-blue-500/20 text-blue-400',
                                    'bg-purple-500/20 text-purple-400',
                                    'bg-amber-500/20 text-amber-400',
                                    'bg-rose-500/20 text-rose-400',
                                ]
                                const initials = g.student_name.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()
                                return (
                                    <div key={g.id} className="flex items-center gap-3">
                                        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0', avatarPalette[i % 5])}>
                                            {initials}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-medium text-gray-300 truncate">{g.student_name}</p>
                                                    <p className="text-[10px] text-gray-600">{g.subject_name}</p>
                                                </div>
                                                <span className={cn('text-xs font-bold ml-3 shrink-0', textColor)}>
                                                    {g.value}/{g.max_value}
                                                </span>
                                            </div>
                                            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                                <div className={cn('h-full rounded-full transition-all duration-700', barColor)} style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Annonces récentes */}
                <div className="bg-[#161B22] rounded-2xl border border-white/5 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Annonces récentes</p>
                    </div>
                    {data.announcements.length === 0 ? (
                        <div className="text-center py-8">
                            <Megaphone className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                            <p className="text-xs text-gray-600">Aucune annonce publiée</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {data.announcements.map(ann => {
                                const audiences: string[] = Array.isArray(ann.target_audience)
                                    ? ann.target_audience.filter(Boolean)
                                    : ann.target_audience ? [ann.target_audience] : []
                                const LABEL: Record<string, string> = {
                                    all: 'Tous', parents: 'Parents', eleves: 'Élèves', enseignants: 'Enseignants',
                                    parent: 'Parents', student: 'Élèves', teacher: 'Enseignants',
                                }
                                const COLOR: Record<string, string> = {
                                    all: 'bg-gray-500/15 text-gray-400',
                                    parents: 'bg-blue-500/15 text-blue-400', parent: 'bg-blue-500/15 text-blue-400',
                                    eleves: 'bg-emerald-500/15 text-emerald-400', student: 'bg-emerald-500/15 text-emerald-400',
                                    enseignants: 'bg-purple-500/15 text-purple-400', teacher: 'bg-purple-500/15 text-purple-400',
                                }
                                return (
                                    <div key={ann.id} className="p-3 rounded-xl bg-white/2 border border-white/5 hover:bg-white/4 transition-colors">
                                        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                                            {audiences.slice(0, 3).map(a => (
                                                <span key={a} className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold', COLOR[a] ?? 'bg-gray-500/15 text-gray-400')}>
                                                    {LABEL[a] ?? a}
                                                </span>
                                            ))}
                                            {ann.priority === 'high' && (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/15 text-red-400">Urgent</span>
                                            )}
                                        </div>
                                        <p className="text-xs font-semibold text-white/85 line-clamp-1">{ann.title}</p>
                                        <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5 leading-relaxed">{ann.content}</p>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, accent, href, bars }: {
    label: string
    value: number | string
    accent: 'emerald' | 'blue' | 'amber' | 'red' | 'gray'
    href?: string
    bars: number[]
}) {
    const palette = {
        emerald: { text: 'text-emerald-400', bar: 'bg-emerald-500' },
        blue:    { text: 'text-blue-400',    bar: 'bg-blue-500' },
        amber:   { text: 'text-amber-400',   bar: 'bg-amber-500' },
        red:     { text: 'text-red-400',     bar: 'bg-red-500' },
        gray:    { text: 'text-gray-400',    bar: 'bg-gray-500' },
    }
    const { text, bar } = palette[accent]
    const maxH = Math.max(...bars, 1)

    const inner = (
        <div className="bg-[#161B22] rounded-2xl border border-white/5 p-5 flex flex-col gap-4 hover:border-white/10 transition-colors h-full">
            <p className="text-[11px] font-medium text-gray-500">{label}</p>
            <div className="flex items-end justify-between gap-3">
                <p className={cn('text-3xl font-black leading-none tabular-nums', text)}>{value}</p>
                {/* Mini bar chart */}
                <div className="flex items-end gap-[3px] h-8 shrink-0">
                    {bars.map((h, i) => (
                        <div
                            key={i}
                            className={cn('w-[5px] rounded-[2px] transition-all', bar, i === bars.length - 1 ? 'opacity-100' : 'opacity-40')}
                            style={{ height: `${Math.round((h / maxH) * 100)}%` }}
                        />
                    ))}
                </div>
            </div>
        </div>
    )

    return href ? <Link href={href} className="block">{inner}</Link> : inner
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
    return (
        <div className="space-y-5 max-w-[1400px] mx-auto animate-pulse">
            <div className="h-14 bg-white/4 rounded-2xl" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-white/4 rounded-2xl" />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="h-52 bg-white/4 rounded-2xl" />
                <div className="h-52 bg-white/4 rounded-2xl" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="h-64 bg-white/4 rounded-2xl" />
                <div className="h-64 bg-white/4 rounded-2xl" />
            </div>
        </div>
    )
}
