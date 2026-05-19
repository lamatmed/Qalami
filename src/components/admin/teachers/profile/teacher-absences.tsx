'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { XCircle, Clock, CheckCircle2, RefreshCw, Loader2, CalendarDays, StickyNote } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/i18n'
import { getMySchoolContext } from '@/app/admin/actions'

interface AbsenceRecord {
    id: string
    date: string
    status: 'absent' | 'late'
    justified: boolean
    justification_note: string | null
    made_up: boolean
    made_up_date: string | null
    recorder: { full_name: string | null } | null
}

type FilterType = 'all' | 'unjustified' | 'justified' | 'late' | 'made_up'

export function TeacherAbsences({ teacherId }: { teacherId: string }) {
    const { t } = useLanguage()
    const [records, setRecords] = useState<AbsenceRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [tableExists, setTableExists] = useState(true)
    const [filter, setFilter] = useState<FilterType>('all')

    useEffect(() => {
        async function load() {
            const supabase = createClient()
            const ctx = await getMySchoolContext()
            const currentSchoolId = ctx?.school_id

            const { data, error } = await supabase
                .from('teacher_attendance' as any)
                .select(`
                    id, date, status, justified, justification_note,
                    made_up, made_up_date,
                    recorder:profiles!teacher_attendance_recorded_by_fkey ( full_name )
                `)
                .eq('teacher_id', teacherId)
                .eq('school_id', currentSchoolId)
                .neq('status', 'present')
                .order('date', { ascending: false })

            if (error) {
                if (error.code === '42P01') setTableExists(false)
                setLoading(false)
                return
            }
            if (data) setRecords(data as unknown as AbsenceRecord[])
            setLoading(false)
        }
        load()
    }, [teacherId])

    const stats = useMemo(() => {
        const unjustified = records.filter(r => r.status === 'absent' && !r.justified)
        const justified   = records.filter(r => r.status === 'absent' && r.justified)
        const late        = records.filter(r => r.status === 'late')
        const made_up     = records.filter(r => r.made_up)
        return {
            total: records.length,
            unjustified: unjustified.length,
            justified: justified.length,
            late: late.length,
            made_up: made_up.length,
        }
    }, [records])

    const filtered = useMemo(() => {
        if (filter === 'unjustified') return records.filter(r => r.status === 'absent' && !r.justified)
        if (filter === 'justified')   return records.filter(r => r.status === 'absent' && r.justified)
        if (filter === 'late')        return records.filter(r => r.status === 'late')
        if (filter === 'made_up')     return records.filter(r => r.made_up)
        return records
    }, [records, filter])

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
        </div>
    )

    if (!tableExists) return (
        <div className="text-center py-16 bg-[#1A2530] rounded-3xl border border-amber-500/20 p-8">
            <CalendarDays className="w-10 h-10 text-amber-500/40 mx-auto mb-3" />
            <p className="text-amber-400 font-bold">{t('admin.teachers.absences.tableError')}</p>
            <p className="text-gray-500 text-sm mt-2 max-w-xs mx-auto">
                {t('admin.teachers.absences.tableErrorDesc')}
            </p>
        </div>
    )

    return (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
                <div className="bg-[#1A2530] rounded-2xl border border-red-500/20 p-4 text-center">
                    <XCircle className="w-4 h-4 text-red-400 mx-auto mb-1.5" />
                    <p className="text-2xl font-black text-red-400">{stats.unjustified}</p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">{t('admin.teachers.absences.unjustified')}</p>
                </div>
                <div className="bg-[#1A2530] rounded-2xl border border-amber-500/20 p-4 text-center">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 mx-auto mb-1.5" />
                    <p className="text-2xl font-black text-amber-400">{stats.justified}</p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">{t('admin.teachers.absences.justified')}</p>
                </div>
                <div className="bg-[#1A2530] rounded-2xl border border-blue-500/20 p-4 text-center">
                    <Clock className="w-4 h-4 text-blue-400 mx-auto mb-1.5" />
                    <p className="text-2xl font-black text-blue-400">{stats.late}</p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">{t('admin.teachers.absences.lates')}</p>
                </div>
                <div className="bg-[#1A2530] rounded-2xl border border-emerald-500/20 p-4 text-center">
                    <RefreshCw className="w-4 h-4 text-emerald-400 mx-auto mb-1.5" />
                    <p className="text-2xl font-black text-emerald-400">{stats.made_up}</p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">{t('admin.teachers.absences.madeUp')}</p>
                </div>
            </div>

            {/* Total */}
            <div className="bg-[#1A2530] rounded-2xl border border-white/5 px-5 py-3 flex justify-between items-center">
                <p className="text-sm text-gray-400">{t('admin.teachers.absences.totalLabel')}</p>
                <p className="text-lg font-black text-white">
                    {t('admin.teachers.absences.eventCount').replace('{count}', stats.total.toString()).replace('{plural}', stats.total !== 1 ? 's' : '')}
                </p>
            </div>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
                {([
                    { key: 'all',         label: t('admin.teachers.absences.all'),          count: stats.total },
                    { key: 'unjustified', label: t('admin.teachers.absences.unjustified'),  count: stats.unjustified },
                    { key: 'justified',   label: t('admin.teachers.absences.justified'),    count: stats.justified },
                    { key: 'late',        label: t('admin.teachers.absences.lates'),       count: stats.late },
                    { key: 'made_up',     label: t('admin.teachers.absences.madeUp'),    count: stats.made_up },
                ] as { key: FilterType; label: string; count: number }[]).map(f => (
                    <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                            filter === f.key
                                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                                : "bg-white/5 border-white/10 text-gray-500 hover:text-gray-300"
                        )}
                    >
                        {f.label} <span className="opacity-60">({f.count})</span>
                    </button>
                ))}
            </div>

            {/* Timeline */}
            {records.length === 0 ? (
                <div className="text-center py-16 bg-[#1A2530] rounded-3xl border border-white/5">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500/30 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">{t('admin.teachers.absences.noAbsences')}</p>
                    <p className="text-xs text-gray-600 mt-1">{t('admin.teachers.absences.perfectAttendance')}</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-12 bg-[#1A2530] rounded-3xl border border-white/5">
                    <p className="text-gray-500 text-sm">{t('admin.teachers.absences.noFilterResults')}</p>
                </div>
            ) : (
                <div className="bg-[#1A2530] rounded-3xl border border-white/5 overflow-hidden">
                    <div className="divide-y divide-white/5">
                        {filtered.map(r => {
                            const isLate = r.status === 'late'
                            const isJustified = r.status === 'absent' && r.justified
                            const cfg = isLate
                                ? { icon: Clock,        color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',     label: t('admin.teachers.absences.lateSingle') }
                                : isJustified
                                ? { icon: CheckCircle2, color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20',   label: t('admin.teachers.absences.justifiedSingle') }
                                : { icon: XCircle,      color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20',       label: t('admin.teachers.absences.unjustifiedSingle') }
                            const Icon = cfg.icon
                            return (
                                <div key={r.id} className="flex items-start gap-4 p-4 hover:bg-[#0F1720] transition-colors">
                                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border mt-0.5", cfg.bg)}>
                                        <Icon className={cn("w-4 h-4", cfg.color)} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className={cn("text-sm font-bold", cfg.color)}>{cfg.label}</p>
                                                {r.made_up && (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                                        <RefreshCw className="w-2.5 h-2.5" /> {t('admin.teachers.absences.madeUpLabel')}
                                                        {r.made_up_date && ` ${t('admin.teachers.absences.madeUpOn')} ${new Date(r.made_up_date).toLocaleDateString(t('common.locale') || 'fr-FR', { day: '2-digit', month: 'short' })}`}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-600 shrink-0">
                                                {new Date(r.date).toLocaleDateString(t('common.locale') || 'fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                                            </p>
                                        </div>
                                        {r.recorder?.full_name && (
                                            <p className="text-xs text-gray-600 mt-0.5">{t('admin.teachers.absences.recordedBy')} {r.recorder.full_name}</p>
                                        )}
                                        {r.justification_note && (
                                            <div className="mt-2 flex items-start gap-1.5 bg-white/5 rounded-lg px-3 py-2">
                                                <StickyNote className="w-3 h-3 text-gray-500 shrink-0 mt-0.5" />
                                                <p className="text-xs text-gray-400 italic">{r.justification_note}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
