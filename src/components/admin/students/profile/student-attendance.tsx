'use client'

import { useState, useEffect, useMemo } from 'react'
import { XCircle, Clock, CheckCircle2, AlertCircle, Loader2, FileText, StickyNote, Eye, Download, Paperclip } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/i18n'
import { getStudentAttendanceWithFiles, getAllJustificationFiles, type AttendanceWithFile, type JustificationFile } from '@/app/admin/students/actions'

type AttendanceRecord = AttendanceWithFile

const STATUS_CONFIG = {
    absent: {
        label: 'Absence injustifiée',
        icon: XCircle,
        color: 'text-red-400',
        bg: 'bg-red-500/10 border-red-500/20',
        dot: 'bg-red-500',
    },
    justified: {
        label: 'Absence justifiée',
        icon: CheckCircle2,
        color: 'text-amber-400',
        bg: 'bg-amber-500/10 border-amber-500/20',
        dot: 'bg-amber-500',
    },
    late: {
        label: 'Retard',
        icon: Clock,
        color: 'text-blue-400',
        bg: 'bg-blue-500/10 border-blue-500/20',
        dot: 'bg-blue-500',
    },
    excused: {
        label: 'Dispensé',
        icon: AlertCircle,
        color: 'text-purple-400',
        bg: 'bg-purple-500/10 border-purple-500/20',
        dot: 'bg-purple-500',
    },
}

type FilterType = 'all' | 'absent' | 'justified' | 'late'

export function StudentAttendance({ studentId, schoolId }: { studentId: string; schoolId: string }) {
    const { t, language } = useLanguage()
    const [records, setRecords] = useState<AttendanceRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<FilterType>('all')
    const [justifFiles, setJustifFiles] = useState<JustificationFile[]>([])

    async function load() {
        const [data, files] = await Promise.all([
            getStudentAttendanceWithFiles(studentId, schoolId),
            getAllJustificationFiles(studentId),
        ])
        setRecords(data)
        setJustifFiles(files)
        setLoading(false)
    }

    useEffect(() => { load() }, [studentId, schoolId])

    const stats = useMemo(() => {
        const absent    = records.filter(r => r.status === 'absent' && !r.justified)
        const justified = records.filter(r => (r.status === 'absent' && r.justified) || r.status === 'excused')
        const late      = records.filter(r => r.status === 'late')
        return { absent: absent.length, justified: justified.length, late: late.length, total: records.length }
    }, [records])

    const filtered = useMemo(() => {
        if (filter === 'absent')    return records.filter(r => r.status === 'absent' && !r.justified)
        if (filter === 'justified') return records.filter(r => (r.status === 'absent' && r.justified) || r.status === 'excused')
        if (filter === 'late')      return records.filter(r => r.status === 'late')
        return records
    }, [records, filter])

    const getConfig = (r: AttendanceRecord) => {
        if (r.status === 'late') return STATUS_CONFIG.late
        if (r.status === 'excused' || (r.status === 'absent' && r.justified)) return STATUS_CONFIG.justified
        return STATUS_CONFIG.absent
    }

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
        </div>
    )

    return (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#1A2530] rounded-2xl border border-red-500/20 p-4 text-center">
                    <XCircle className="w-5 h-5 text-red-400 mx-auto mb-2" />
                    <p className="text-2xl font-black text-red-400">{stats.absent}</p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">{t('admin.students.profile.unjustified')}</p>
                </div>
                <div className="bg-[#1A2530] rounded-2xl border border-amber-500/20 p-4 text-center">
                    <CheckCircle2 className="w-5 h-5 text-amber-400 mx-auto mb-2" />
                    <p className="text-2xl font-black text-amber-400">{stats.justified}</p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">{t('admin.students.profile.justified')}</p>
                </div>
                <div className="bg-[#1A2530] rounded-2xl border border-blue-500/20 p-4 text-center">
                    <Clock className="w-5 h-5 text-blue-400 mx-auto mb-2" />
                    <p className="text-2xl font-black text-blue-400">{stats.late}</p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">{t('admin.students.profile.latePlural')}</p>
                </div>
            </div>

            {/* Total banner */}
            <div className="bg-[#1A2530] rounded-2xl border border-white/5 px-5 py-3 flex items-center justify-between">
                <p className="text-sm text-gray-400">{t('admin.students.profile.totalAbsencesLate')}</p>
                <p className="text-lg font-black text-white">{stats.total} <span className="text-xs text-gray-500 font-normal">{t('admin.students.profile.events')}</span></p>
            </div>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
                {([
                    { key: 'all',       label: t('common.all'), count: stats.total },
                    { key: 'absent',    label: t('admin.students.profile.unjustified'), count: stats.absent },
                    { key: 'justified', label: t('admin.students.profile.justified'),   count: stats.justified },
                    { key: 'late',      label: t('admin.students.profile.latePlural'),  count: stats.late },
                ] as { key: FilterType; label: string; count: number }[]).map(f => (
                    <button
                        type="button"
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
            {filtered.length === 0 ? (
                <div className="text-center py-16 bg-[#1A2530] rounded-3xl border border-white/5">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500/30 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">{t('admin.students.profile.noEventForFilter')}</p>
                </div>
            ) : (
                <div className="bg-[#1A2530] rounded-3xl border border-white/5 overflow-hidden">
                    <div className="divide-y divide-white/5">
                        {filtered.map(record => {
                            const cfg = getConfig(record)
                            const Icon = cfg.icon
                            return (
                                <div key={record.id} className="flex items-start gap-4 p-4 hover:bg-[#0F1720] transition-colors">
                                    {/* Icon */}
                                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border mt-0.5", cfg.bg)}>
                                        <Icon className={cn("w-4 h-4", cfg.color)} />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className={cn("text-sm font-bold", cfg.color)}>{cfg.label}</p>
                                            <p className="text-xs text-gray-600 shrink-0">
                                                {new Date(record.date).toLocaleDateString(language === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}
                                            </p>
                                        </div>
                                        {record.subjects?.name && (
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {t('common.subjects')} : <span className="text-gray-400">{record.subjects.name}</span>
                                            </p>
                                        )}
                                        {record.recorder?.full_name && (
                                            <p className="text-xs text-gray-600 mt-0.5">
                                                {t('admin.students.profile.recordedBy')} : {record.recorder.full_name}
                                            </p>
                                        )}
                                        {record.justification_note && (
                                            <div className="mt-2 flex items-start gap-1.5 bg-white/5 rounded-lg px-3 py-2">
                                                <StickyNote className="w-3 h-3 text-gray-500 shrink-0 mt-0.5" />
                                                <p className="text-xs text-gray-400 italic">{record.justification_note}</p>
                                            </div>
                                        )}

                                        {/* Justification file */}
                                        {record.justification_file_url && (
                                            <div className="mt-2 flex items-center gap-2">
                                                <a
                                                    href={record.justification_file_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg px-2.5 py-1 transition-colors"
                                                >
                                                    <Eye className="w-3 h-3" />
                                                    Voir le justificatif
                                                </a>
                                                <a
                                                    href={record.justification_file_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-2.5 py-1 transition-colors"
                                                >
                                                    <Download className="w-3 h-3" />
                                                    Télécharger
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {records.length === 0 && (
                <div className="text-center py-16 bg-[#1A2530] rounded-3xl border border-white/5">
                    <FileText className="w-10 h-10 text-emerald-500/20 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">{t('admin.students.profile.noAbsence')}</p>
                    <p className="text-xs text-gray-600 mt-1">{t('admin.students.profile.perfectAttendance')}</p>
                </div>
            )}

            {/* All justification files from bucket */}
            {justifFiles.length > 0 && (
                <div className="bg-[#1A2530] rounded-3xl border border-white/5 overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5">
                        <Paperclip className="w-4 h-4 text-amber-400" />
                        <p className="text-sm font-bold text-white">Fichiers de justification</p>
                        <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{justifFiles.length}</span>
                    </div>
                    <div className="divide-y divide-white/5">
                        {justifFiles.map((f, i) => (
                            <div key={i} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-[#0F1720] transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                    <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                                    <p className="text-sm text-white truncate">{decodeURIComponent(f.name)}</p>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <a
                                        href={f.publicUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg px-2.5 py-1 transition-colors"
                                    >
                                        <Eye className="w-3 h-3" /> Voir
                                    </a>
                                    <a
                                        href={f.publicUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-2.5 py-1 transition-colors"
                                    >
                                        <Download className="w-3 h-3" /> Télécharger
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
