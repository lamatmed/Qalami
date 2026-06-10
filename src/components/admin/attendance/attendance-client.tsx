/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Clock, BookOpen, ChevronRight, User } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/i18n'
import { getTodayOverview, getTodayPeriods } from '@/app/admin/attendance/actions'

function formatDate(dateStr: string, lang: string) {
    return new Date(dateStr).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR', {
        weekday: 'short', day: 'numeric', month: 'short',
    })
}

function formatTime(t: string | null) {
    if (!t) return null
    return t.slice(0, 5) // "08:00:00" → "08:00"
}

function rateColor(rate: number | null) {
    if (rate === null) return 'text-muted-foreground'
    if (rate >= 90) return 'text-emerald-500'
    if (rate >= 70) return 'text-amber-500'
    return 'text-red-500'
}
function rateBar(rate: number | null) {
    if (rate === null) return 'bg-border'
    if (rate >= 90) return 'bg-emerald-500'
    if (rate >= 70) return 'bg-amber-500'
    return 'bg-red-500'
}

const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.07 } },
}
const item = {
    hidden: { y: 16, opacity: 0 },
    show: { y: 0, opacity: 1 },
}

interface Period {
    id: string
    classId: string
    className: string
    subjectName: string | null
    startTime: string | null
    endTime: string | null
    teacherName: string | null
    teacherPhone: string | null
    status: string
    stats: { present: number; absent: number; late: number; excused: number }
    synthetic?: boolean
}

export function AttendanceClient() {
    const { language } = useLanguage()
    const router = useRouter()
    const [todayOverview, setTodayOverview] = useState<any>(null)
    const [periodsByClass, setPeriodsByClass] = useState<Map<string, Period[]>>(new Map())
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let active = true
        const now = new Date()
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

        // Current time string "HH:MM:SS" for filtering past pending sessions
        const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`

        Promise.all([
            getTodayOverview(todayStr),
            getTodayPeriods(todayStr),
        ])
            .then(([overview, periods]) => {
                if (!active) return
                setTodayOverview(overview)
                const map = new Map<string, Period[]>()
                ;(periods as Period[]).forEach(p => {
                    // Hide pending sessions whose start time has already passed
                    if (p.status === 'pending' && p.startTime && p.startTime < currentTimeStr) return
                    if (!map.has(p.classId)) map.set(p.classId, [])
                    map.get(p.classId)!.push(p)
                })
                setPeriodsByClass(map)
            })
            .catch(err => console.error('Attendance init failed:', err))
            .finally(() => { if (active) setLoading(false) })

        return () => { active = false }
    }, [])

    if (loading) return (
        <div className="flex items-center justify-center py-40">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
        </div>
    )

    return (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-5 pb-24">

            {/* ── Global stats ──────────────────────────────────────────────── */}
            {todayOverview && (
                <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm relative overflow-hidden">
                        <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                            {language === 'ar' ? 'إجمالي الحضور اليوم' : "Total Présents Aujourd'hui"}
                        </span>
                        <p className="text-2xl font-black mt-1 text-emerald-500">{todayOverview.totalPresent}</p>
                        <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-emerald-500/5 rounded-full" />
                    </div>
                    <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm relative overflow-hidden">
                        <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                            {language === 'ar' ? 'إجمالي الغياب اليوم' : "Total Absents Aujourd'hui"}
                        </span>
                        <p className="text-2xl font-black mt-1 text-red-500">{todayOverview.totalAbsent}</p>
                        <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-red-500/5 rounded-full" />
                    </div>
                    <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm relative overflow-hidden">
                        <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                            {language === 'ar' ? 'معدل الحضور العام' : "Taux de Présence Global"}
                        </span>
                        <p className="text-2xl font-black mt-1 text-indigo-500">
                            {todayOverview.schoolGlobalRate !== null ? `${todayOverview.schoolGlobalRate}%` : '—'}
                        </p>
                        <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-indigo-500/5 rounded-full" />
                    </div>
                </motion.div>
            )}

            {/* ── Classes grid ──────────────────────────────────────────────── */}
            <motion.div variants={item}>
                <div className="bg-card rounded-3xl border border-border/50 p-6 space-y-4">
                    <div className="border-b border-border/50 pb-4">
                        <h3 className="font-bold text-lg text-foreground">
                            {language === 'ar' ? 'إحصائيات الحضور حسب الأقسام' : "Appels du Jour par Classe"}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {language === 'ar' ? 'انقر على قسم لعرض تفاصيل الحضور' : "Chaque appel par matière avec ses horaires"}
                        </p>
                    </div>

                    {!todayOverview?.classes?.length ? (
                        <div className="text-center py-12 text-muted-foreground text-sm">
                            {language === 'ar' ? 'لا توجد أقسام مضافة.' : 'Aucune classe configurée.'}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {todayOverview.classes.map((c: any) => {
                                const stats = c.stats
                                const total = stats ? (stats.present + stats.absent + stats.late + stats.excused) : 0
                                const rate = total > 0 ? Math.round(((stats.present + stats.late) / total) * 100) : null
                                const periods = periodsByClass.get(c.id) ?? []

                                return (
                                    <div
                                        key={c.id}
                                        className="bg-accent/10 border border-border/30 rounded-2xl overflow-hidden hover:border-indigo-500/30 transition-all group/card"
                                    >
                                        {/* Class header — clickable */}
                                        <button
                                            type="button"
                                            onClick={() => router.push(`/admin/attendance/${c.id}`)}
                                            className="w-full flex items-center justify-between p-4 text-left"
                                        >
                                            <div>
                                                <h4 className="font-extrabold text-foreground text-sm group-hover/card:text-indigo-500 transition-colors">
                                                    {c.name}
                                                </h4>
                                                <span className={cn(
                                                    "text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-1",
                                                    c.hasDoneAttendance
                                                        ? "bg-emerald-500/10 text-emerald-500"
                                                        : c.lastAttendanceDate
                                                            ? "bg-indigo-500/10 text-indigo-500"
                                                            : "bg-amber-500/10 text-amber-500"
                                                )}>
                                                    {c.hasDoneAttendance
                                                        ? (language === 'ar' ? 'تم تسجيل حضور اليوم' : "Appel fait aujourd'hui")
                                                        : c.lastAttendanceDate
                                                            ? (language === 'ar'
                                                                ? `آخر تسجيل: ${formatDate(c.lastAttendanceDate, language)}`
                                                                : `Dernier appel : ${formatDate(c.lastAttendanceDate, language)}`)
                                                            : (language === 'ar' ? 'لم يتم تسجيل أي حضور' : "Aucun appel enregistré")}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {stats && (
                                                    <div className="flex items-center gap-1">
                                                        {stats.present > 0 && (
                                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                                                                {stats.present}✓
                                                            </span>
                                                        )}
                                                        {stats.absent > 0 && (
                                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg bg-red-500/10 text-red-500">
                                                                {stats.absent}✗
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover/card:text-indigo-500 transition-colors" />
                                            </div>
                                        </button>

                                        {/* Rate bar */}
                                        {rate !== null && (
                                            <div className="px-4 pb-3 space-y-1">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-muted-foreground">Taux de présence</span>
                                                    <span className={cn("font-bold", rateColor(rate))}>{rate}%</span>
                                                </div>
                                                <div className="h-1.5 bg-border/30 rounded-full overflow-hidden">
                                                    <div
                                                        className={cn('h-full rounded-full transition-all duration-500', rateBar(rate))}
                                                        style={{ width: `${rate}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* Periods (appels) list */}
                                        {(periods.length > 0 || c.hasDoneAttendance) && (
                                            <div className="border-t border-border/30 divide-y divide-border/20">
                                                {periods.length > 0 ? periods.map(period => {
                                                    const t = period.stats
                                                    const pTotal = t.present + t.absent + t.late + t.excused
                                                    const pRate = pTotal > 0 ? Math.round(((t.present + t.late) / pTotal) * 100) : null
                                                    const start = formatTime(period.startTime)
                                                    const end = formatTime(period.endTime)
                                                    const isOpen = period.status === 'open'
                                                    const isPending = period.status === 'pending'

                                                    return (
                                                        <div key={period.id} className={cn(
                                                            "px-4 py-2.5 flex items-center gap-3",
                                                            isPending && "opacity-60"
                                                        )}>
                                                            <div className={cn(
                                                                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                                                                isPending ? "bg-orange-500/10" : "bg-indigo-500/10"
                                                            )}>
                                                                <BookOpen className={cn("w-3.5 h-3.5", isPending ? "text-orange-400" : "text-indigo-400")} />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs font-semibold text-foreground truncate">
                                                                    {period.subjectName ?? 'Appel général'}
                                                                </p>
                                                                {(start || end) && (
                                                                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                                                        <Clock className="w-2.5 h-2.5" />
                                                                        {start && end ? `${start} – ${end}` : start ?? end}
                                                                    </p>
                                                                )}
                                                                {period.teacherName && (
                                                                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                                                        <User className="w-2.5 h-2.5" />
                                                                        {period.teacherName}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                {!isPending && t.present > 0 && (
                                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                                                                        {t.present}✓
                                                                    </span>
                                                                )}
                                                                {!isPending && t.absent > 0 && (
                                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">
                                                                        {t.absent}✗
                                                                    </span>
                                                                )}
                                                                {!isPending && t.late > 0 && (
                                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">
                                                                        {t.late}~
                                                                    </span>
                                                                )}
                                                                {!isPending && pRate !== null && (
                                                                    <span className={cn("text-[10px] font-bold", rateColor(pRate))}>
                                                                        {pRate}%
                                                                    </span>
                                                                )}
                                                                <span className={cn(
                                                                    "text-[9px] font-bold px-1.5 py-0.5 rounded-full border",
                                                                    isPending
                                                                        ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                                                                        : isOpen
                                                                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                                                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                                )}>
                                                                    {isPending ? 'À faire' : isOpen ? 'Ouvert' : 'Fermé'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )
                                                }) : null
                                                }
                                            </div>
                                        )}

                                        {/* No attendance at all today */}
                                        {periods.length === 0 && !c.hasDoneAttendance && (
                                            <div className="border-t border-border/20 px-4 py-2.5">
                                                <p className="text-[10px] text-muted-foreground italic">Aucun appel enregistré aujourd'hui</p>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    )
}
