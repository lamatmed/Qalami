'use client'

import { useState, useEffect, useMemo } from 'react'
import { XCircle, Clock, CheckCircle2, AlertCircle, Loader2, FileText, StickyNote, Eye, Download, Paperclip, CalendarClock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/i18n'
import type { AttendanceWithFile, JustificationFile } from '@/app/admin/students/actions'

type AttendanceRecord = AttendanceWithFile

const STATUS_CONFIG_KEYS = {
    absent:    { labelKey: 'admin.students.profile.attendanceAbsent',    icon: XCircle,      color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20',     dot: 'bg-red-500'    },
    justified: { labelKey: 'admin.students.profile.attendanceJustified', icon: CheckCircle2, color: 'text-emerald-400',  bg: 'bg-emerald-500/10 border-emerald-500/20',  dot: 'bg-emerald-500'  },
    late:      { labelKey: 'admin.students.profile.attendanceLate',      icon: Clock,        color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',    dot: 'bg-blue-500'   },
    excused:   { labelKey: 'admin.students.profile.attendanceExcused',   icon: AlertCircle,  color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', dot: 'bg-purple-500' },
}

type FilterType = 'all' | 'absent' | 'justified' | 'late'

function getFileMs(f: JustificationFile): number {
    if (f.createdAt) return new Date(f.createdAt).getTime()
    const m = f.name.match(/^(\d{13})_/)
    if (m) return parseInt(m[1], 10)
    return 0
}

export function StudentAttendance({ studentId, schoolId }: { studentId: string; schoolId: string }) {
    const { t, language } = useLanguage()
    const STATUS_CONFIG = Object.fromEntries(
        Object.entries(STATUS_CONFIG_KEYS).map(([k, v]) => [k, { ...v, label: t(v.labelKey) }])
    ) as Record<string, { label: string; icon: any; color: string; bg: string; dot: string }>
    const [records, setRecords] = useState<AttendanceRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<FilterType>('all')
    const [justifFiles, setJustifFiles] = useState<JustificationFile[]>([])
    const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})
    const [submittingReview, setSubmittingReview] = useState<string | null>(null)

    async function load() {
        const res = await fetch(`/api/admin/students/${studentId}/attendance`)
        if (!res.ok) { setLoading(false); return }
        const json = await res.json()
        setRecords(json.records || [])
        setJustifFiles(json.files || [])
        setLoading(false)
    }

    async function handleReview(id: string, decision: 'approved' | 'rejected') {
        setSubmittingReview(id)
        const res = await fetch(`/api/admin/students/${studentId}/attendance/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ attendanceId: id, decision, note: reviewNotes[id] }),
        })
        if (res.ok) {
            setReviewNotes(prev => { const n = { ...prev }; delete n[id]; return n })
            await load()
        }
        setSubmittingReview(null)
    }

    useEffect(() => { load() }, [studentId, schoolId])

    // Match bucket files to justified records that have no DB file URL
    const { autoMatchMap, remainingFiles } = useMemo(() => {
        const linkedUrls = new Set(records.filter(r => r.justification_file_url).map(r => r.justification_file_url!))
        // Exclude bucket files that are already referenced via justification_attachment_url (parent uploads)
        const attachmentFilenames = new Set(
            records.filter(r => r.justification_attachment_filename).map(r => r.justification_attachment_filename!)
        )
        const unlinked = justifFiles.filter(f => !linkedUrls.has(f.publicUrl) && !attachmentFilenames.has(f.name))

        // Records with a DB-linked attachment don't need bucket auto-matching
        const needsFile = records
            .filter(r => (r.justified || r.status === 'excused') && !r.justification_file_url && !r.justification_attachment_signed_url)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

        const sortedUnlinked = [...unlinked].sort((a, b) => getFileMs(b) - getFileMs(a))
        const matchMap = new Map<string, JustificationFile>()
        const used = new Set<number>()

        for (const rec of needsFile) {
            const recDate = new Date(rec.date).getTime()
            let bestIdx = -1
            let bestDiff = Infinity

            // First pass: prefer files uploaded AFTER the absence date
            for (let i = 0; i < sortedUnlinked.length; i++) {
                if (used.has(i)) continue
                const fMs = getFileMs(sortedUnlinked[i])
                if (fMs === 0 || fMs < recDate) continue
                const diff = fMs - recDate
                if (diff < bestDiff) { bestDiff = diff; bestIdx = i }
            }
            // Fallback: any unmatched file closest in time (e.g. retroactive upload)
            if (bestIdx < 0) {
                for (let i = 0; i < sortedUnlinked.length; i++) {
                    if (used.has(i)) continue
                    const fMs = getFileMs(sortedUnlinked[i])
                    if (fMs === 0) continue
                    const diff = Math.abs(fMs - recDate)
                    if (diff < bestDiff) { bestDiff = diff; bestIdx = i }
                }
            }
            if (bestIdx >= 0) {
                matchMap.set(rec.id, sortedUnlinked[bestIdx])
                used.add(bestIdx)
            }
        }

        const remaining = sortedUnlinked.filter((_, i) => !used.has(i))
        return { autoMatchMap: matchMap, remainingFiles: remaining }
    }, [records, justifFiles])

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
                <div className="bg-[#1A2530] rounded-2xl border border-emerald-500/20 p-4 text-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
                    <p className="text-2xl font-black text-emerald-400">{stats.justified}</p>
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

                                        {/* Justification file — from DB URL or auto-matched bucket file */}
                                        {(() => {
                                            const fileUrl = record.justification_file_url
                                            const autoFile = autoMatchMap.get(record.id)
                                            const url = fileUrl || autoFile?.publicUrl
                                            if (!url) return null
                                            const fileName = autoFile && !fileUrl
                                                ? decodeURIComponent(autoFile.name.replace(/^\d{13}_/, ''))
                                                : null
                                            const fileMs = autoFile && !fileUrl ? getFileMs(autoFile) : 0
                                            const uploadedAt = fileMs ? new Date(fileMs) : null
                                            const locale = language === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR'
                                            return (
                                                <div className="mt-2 space-y-1">
                                                    {fileName && (
                                                        <div className="flex items-center gap-1.5 px-1">
                                                            <Paperclip className="w-3 h-3 text-amber-400/70 shrink-0" />
                                                            <span className="text-[11px] text-amber-300/80 truncate">{fileName}</span>
                                                            {uploadedAt && (
                                                                <span className="text-[10px] text-gray-600 shrink-0">
                                                                    · {uploadedAt.toLocaleDateString(locale, { day: '2-digit', month: 'short', timeZone: 'Africa/Nouakchott' })} {uploadedAt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nouakchott' })}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-2">
                                                        <a
                                                            href={url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg px-2.5 py-1 transition-colors"
                                                        >
                                                            <Eye className="w-3 h-3" />
                                                            {t('admin.students.profile.viewJustification')}
                                                        </a>
                                                        <a
                                                            href={url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-2.5 py-1 transition-colors"
                                                        >
                                                            <Download className="w-3 h-3" />
                                                            {t('admin.students.profile.downloadJustification')}
                                                        </a>
                                                    </div>
                                                </div>
                                            )
                                        })()}

                                        {/* Admin review panel — for parent-uploaded justification docs */}
                                        {record.justification_attachment_signed_url && (
                                            <div className="mt-2 rounded-xl border border-white/10 overflow-hidden">
                                                {/* Status header */}
                                                {record.justification_status === 'pending' && (
                                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/20">
                                                        <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                                                        <span className="text-xs font-bold text-amber-400">Justificatif en attente de révision</span>
                                                    </div>
                                                )}
                                                {record.justification_status === 'approved' && (
                                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border-b border-emerald-500/20">
                                                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                                        <span className="text-xs font-bold text-emerald-400">Justificatif approuvé</span>
                                                    </div>
                                                )}
                                                {record.justification_status === 'rejected' && (
                                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border-b border-red-500/20">
                                                        <XCircle className="w-3 h-3 text-red-400 shrink-0" />
                                                        <span className="text-xs font-bold text-red-400">Justificatif rejeté</span>
                                                    </div>
                                                )}

                                                <div className="p-3 space-y-2">
                                                    {/* View / Download the parent document */}
                                                    <div className="flex items-center gap-2">
                                                        <a href={record.justification_attachment_signed_url} target="_blank" rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg px-2.5 py-1 transition-colors">
                                                            <Eye className="w-3 h-3" /> Voir le justificatif
                                                        </a>
                                                        <a href={record.justification_attachment_signed_url} target="_blank" rel="noopener noreferrer" download
                                                            className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-2.5 py-1 transition-colors">
                                                            <Download className="w-3 h-3" /> Télécharger
                                                        </a>
                                                    </div>

                                                    {/* Review note (shown after decision) */}
                                                    {record.justification_review_note && (
                                                        <div className="flex items-start gap-1.5 bg-white/5 rounded-lg px-3 py-2">
                                                            <StickyNote className="w-3 h-3 text-gray-500 shrink-0 mt-0.5" />
                                                            <p className="text-xs text-gray-400 italic">{record.justification_review_note}</p>
                                                        </div>
                                                    )}

                                                    {/* Approve / Reject form — only while pending */}
                                                    {record.justification_status === 'pending' && (
                                                        <div className="space-y-2 pt-1">
                                                            <textarea
                                                                rows={2}
                                                                value={reviewNotes[record.id] || ''}
                                                                onChange={e => setReviewNotes(prev => ({ ...prev, [record.id]: e.target.value }))}
                                                                placeholder="Note de révision (optionnel)"
                                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-gray-600 resize-none focus:outline-none focus:border-white/20"
                                                            />
                                                            <div className="flex gap-2">
                                                                <button
                                                                    type="button"
                                                                    disabled={submittingReview === record.id}
                                                                    onClick={() => handleReview(record.id, 'approved')}
                                                                    className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
                                                                >
                                                                    {submittingReview === record.id
                                                                        ? <Loader2 className="w-3 h-3 animate-spin" />
                                                                        : <CheckCircle2 className="w-3 h-3" />
                                                                    }
                                                                    Approuver
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    disabled={submittingReview === record.id}
                                                                    onClick={() => handleReview(record.id, 'rejected')}
                                                                    className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold text-red-400 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
                                                                >
                                                                    {submittingReview === record.id
                                                                        ? <Loader2 className="w-3 h-3 animate-spin" />
                                                                        : <XCircle className="w-3 h-3" />
                                                                    }
                                                                    Rejeter
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
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

            {/* Unmatched justification files (not linked to any absence record) */}
            {remainingFiles.length > 0 && (
                <div className="bg-[#1A2530] rounded-3xl border border-white/5 overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5">
                        <Paperclip className="w-4 h-4 text-amber-400" />
                        <p className="text-sm font-bold text-white">{t('admin.students.profile.justificationFiles')}</p>
                        <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{remainingFiles.length}</span>
                    </div>
                    <div className="divide-y divide-white/5">
                        {remainingFiles.map((f, i) => {
                            const fMs = getFileMs(f)
                            const uploadedAt = fMs ? new Date(fMs) : null
                            const locale = language === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR'
                            return (
                                <div key={i} className="flex items-start justify-between gap-3 px-5 py-3 hover:bg-[#0F1720] transition-colors">
                                    <div className="flex items-start gap-3 min-w-0">
                                        <FileText className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                        <div className="min-w-0">
                                            <p className="text-sm text-white truncate">{decodeURIComponent(f.name.replace(/^\d{13}_/, ''))}</p>
                                            {uploadedAt && (
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <CalendarClock className="w-3 h-3 text-gray-500 shrink-0" />
                                                    <p className="text-[11px] text-gray-500">
                                                        {uploadedAt.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Nouakchott' })} · {uploadedAt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nouakchott' })}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 shrink-0 mt-0.5">
                                        <a href={f.publicUrl} target="_blank" rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg px-2.5 py-1 transition-colors">
                                            <Eye className="w-3 h-3" /> {t('common.view')}
                                        </a>
                                        <a href={f.publicUrl} target="_blank" rel="noopener noreferrer" download
                                            className="inline-flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-2.5 py-1 transition-colors">
                                            <Download className="w-3 h-3" /> {t('common.download')}
                                        </a>
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
