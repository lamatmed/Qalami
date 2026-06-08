/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/i18n'
import { getTodayOverview } from '@/app/admin/attendance/actions'

function formatDate(dateStr: string, lang: string) {
    return new Date(dateStr).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR', {
        weekday: 'short', day: 'numeric', month: 'short',
    })
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

export function AttendanceClient() {
    const { language } = useLanguage()
    const router = useRouter()
    const [todayOverview, setTodayOverview] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let active = true
        const now = new Date()
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

        getTodayOverview(todayStr)
            .then(data => {
                if (!active) return
                setTodayOverview(data)
            })
            .catch(err => console.error('Attendance init failed:', err))
            .finally(() => setLoading(false))

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
                            {language === 'ar' ? 'إحصائيات الحضور حسب الأقسام' : "Statistiques de Présence par Classe"}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {language === 'ar' ? 'انقر على قسم لعرض تفاصيل الحضور' : "Cliquez sur une classe pour voir le détail des présences"}
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

                                return (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => router.push(`/admin/attendance/${c.id}`)}
                                        className="bg-accent/10 border border-border/30 rounded-2xl p-4 hover:border-indigo-500/30 hover:bg-accent/20 transition-all flex flex-col justify-between gap-3 text-left w-full select-none cursor-pointer group/card"
                                    >
                                        <div className="flex items-center justify-between w-full">
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
                                                        ? (language === 'ar' ? 'تم تسجيل حضور اليوم' : "Appel Fait Aujourd'hui")
                                                        : c.lastAttendanceDate
                                                            ? (language === 'ar'
                                                                ? `آخر تسجيل: ${formatDate(c.lastAttendanceDate, language)}`
                                                                : `Dernier appel : ${formatDate(c.lastAttendanceDate, language)}`)
                                                            : (language === 'ar' ? 'لم يتم تسجيل أي حضور' : "Aucun appel enregistré")}
                                                </span>
                                            </div>
                                            {stats && (
                                                <div className="flex items-center gap-1.5 shrink-0">
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
                                        </div>

                                        {rate !== null && (
                                            <div className="space-y-1 w-full">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-muted-foreground">
                                                        {language === 'ar' ? 'معدل الحضور :' : "Taux de présence :"}
                                                    </span>
                                                    <span className={cn("font-bold", rateColor(rate))}>{rate}%</span>
                                                </div>
                                                <div className="h-1.5 bg-border/30 rounded-full overflow-hidden w-full">
                                                    <div
                                                        className={cn('h-full rounded-full transition-all duration-500', rateBar(rate))}
                                                        style={({ '--w': `${rate}%`, width: 'var(--w)' }) as React.CSSProperties}
                                                    />
                                                </div>
                                                {stats && (
                                                    <p className="text-[10px] text-muted-foreground">
                                                        {stats.present} {language === 'ar' ? 'حاضر' : 'Présents'} ·{' '}
                                                        {stats.absent} {language === 'ar' ? 'غائب' : 'Absents'} ·{' '}
                                                        {stats.late} {language === 'ar' ? 'متأخر' : 'Retards'}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    )
}
