'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
    Inbox, Clock, CheckCircle2, XCircle, Loader2, Search,
    ChevronDown, ChevronUp, User, GraduationCap,
    FileText, RefreshCw, Download, Paperclip, Trash2, IdCard,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n'
import { formatDateTime, formatDateTimeShort } from '@/utils/locale'
import {
    getDocumentRequests, updateDocRequestStatus, getMySchoolId,
    removeFileFromRequest,
    type DocumentRequest, type DocRequestStatus,
} from './actions'
import { DOC_TYPE_LABELS } from './constants'

type FilterTab = 'all' | DocRequestStatus

export default function RequestsPage() {
    const { t, language } = useLanguage()

    const STATUS_CONFIG: Record<DocRequestStatus, { label: string; color: string; bg: string; dot: string }> = {
        pending:     { label: t('adminRequests.pending'),     color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20',    dot: 'bg-amber-400'   },
        in_progress: { label: t('adminRequests.in_progress'), color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20',      dot: 'bg-blue-400'    },
        ready:       { label: t('adminRequests.ready'),       color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400' },
        rejected:    { label: t('adminRequests.rejected'),    color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20',        dot: 'bg-red-400'     },
        cancelled:   { label: t('adminRequests.cancelled'),   color: 'text-gray-500',    bg: 'bg-white/5 border-white/5',              dot: 'bg-gray-600'    },
    }

    const [requests, setRequests]         = useState<DocumentRequest[]>([])
    const [loading, setLoading]           = useState(true)
    const [tab, setTab]                   = useState<FilterTab>('all')
    const [search, setSearch]             = useState('')
    const [expanded, setExpanded]         = useState<string | null>(null)
    const [responseText, setResponseText] = useState<Record<string, string>>({})
    const [submitting, setSubmitting]     = useState<string | null>(null)
    const [uploading, setUploading]       = useState<string | null>(null)
    const [removingFile, setRemovingFile] = useState<string | null>(null)
    const [schoolId, setSchoolId]         = useState('')

    const fileInputRef   = useRef<HTMLInputElement>(null)
    const uploadTargetId = useRef('')

    const load = useCallback(async () => {
        setLoading(true)
        const [{ data }, sid] = await Promise.all([
            getDocumentRequests(),
            getMySchoolId(),
        ])
        setRequests(data)
        if (sid) setSchoolId(sid)
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    const triggerUpload = (requestId: string) => {
        uploadTargetId.current = requestId
        fileInputRef.current?.click()
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        const requestId = uploadTargetId.current
        if (fileInputRef.current) fileInputRef.current.value = ''
        if (!file || !requestId || !schoolId) return
        setUploading(requestId)
        try {
            const fd = new FormData()
            fd.append('file', file)
            fd.append('requestId', requestId)
            fd.append('schoolId', schoolId)
            const res  = await fetch('/api/admin/upload-request-file', { method: 'POST', body: fd })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || t('adminRequests.uploadError'))
            toast.success(t('adminRequests.sentNotified'))
            load()
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setUploading(null)
            uploadTargetId.current = ''
        }
    }

    const handle = async (id: string, status: DocRequestStatus) => {
        setSubmitting(id)
        const res = await updateDocRequestStatus(id, status, responseText[id])
        setSubmitting(null)
        if (res.error) { toast.error(res.error); return }
        toast.success(
            status === 'ready'       ? t('adminRequests.markedReady')    :
            status === 'in_progress' ? t('adminRequests.takenCharge')    :
            status === 'rejected'    ? t('adminRequests.markedRejected') : ''
        )
        setExpanded(null)
        load()
    }

    const handleRemoveFile = async (id: string) => {
        if (!confirm(t('adminRequests.confirmDeleteFile'))) return
        setRemovingFile(id)
        const res = await removeFileFromRequest(id)
        setRemovingFile(null)
        if (res.error) { toast.error(res.error); return }
        toast.success(t('adminRequests.fileDeleted'))
        load()
    }

    const filtered = requests.filter(r => {
        if (tab !== 'all' && r.status !== tab) return false
        if (search.trim()) {
            const q = search.toLowerCase()
            return (
                (r.parent?.full_name    ?? '').toLowerCase().includes(q) ||
                (r.student?.full_name   ?? '').toLowerCase().includes(q) ||
                (r.student?.national_id ?? '').toLowerCase().includes(q) ||
                DOC_TYPE_LABELS[r.doc_type].toLowerCase().includes(q)    ||
                (r.custom_title ?? '').toLowerCase().includes(q)         ||
                (r.notes ?? '').toLowerCase().includes(q)
            )
        }
        return true
    })

    const counts = {
        all:         requests.length,
        pending:     requests.filter(r => r.status === 'pending').length,
        in_progress: requests.filter(r => r.status === 'in_progress').length,
        ready:       requests.filter(r => r.status === 'ready').length,
        rejected:    requests.filter(r => r.status === 'rejected').length,
        cancelled:   requests.filter(r => r.status === 'cancelled').length,
    }

    const tabs: { key: FilterTab; label: string }[] = [
        { key: 'all',         label: t('adminRequests.all')         },
        { key: 'pending',     label: t('adminRequests.pending')     },
        { key: 'in_progress', label: t('adminRequests.in_progress') },
        { key: 'ready',       label: t('adminRequests.ready')       },
        { key: 'rejected',    label: t('adminRequests.rejected')    },
    ]

    return (
        <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">

            <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                aria-label={t('adminRequests.sendFile')}
                className="hidden"
                onChange={handleFileChange}
            />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">{t('adminRequests.title')}</h1>
                    <p className="text-base text-gray-500 mt-0.5">
                        {counts.pending > 0
                            ? (counts.pending === 1
                                ? t('adminRequests.pendingCount', { count: counts.pending })
                                : t('adminRequests.pendingCountPlural', { count: counts.pending }))
                            : t('adminRequests.noPending')}
                    </p>
                </div>
                <button type="button" onClick={load} title={t('common.refresh')}
                    className="p-2 rounded-xl text-gray-600 hover:text-white hover:bg-white/5 transition-colors">
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={t('adminRequests.searchPlaceholder')}
                    className="w-full ps-10 pe-4 py-3 bg-[#161B22] border border-white/5 text-base text-white rounded-xl focus:outline-none focus:border-white/15 placeholder:text-gray-600 transition-colors"
                />
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/5">
                {tabs.map(tb => {
                    const count = counts[tb.key]
                    return (
                        <button key={tb.key} type="button" onClick={() => setTab(tb.key)}
                            className={cn(
                                'flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-all whitespace-nowrap',
                                tab === tb.key
                                    ? 'text-white border-emerald-500'
                                    : 'text-gray-600 border-transparent hover:text-gray-400'
                            )}>
                            {tb.label}
                            {count > 0 && (
                                <span className={cn(
                                    "text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                                    tab === tb.key ? "bg-white/10 text-white" : "bg-white/5 text-gray-600"
                                )}>
                                    {count}
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* List */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-600" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center py-20 gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#161B22] border border-white/5 flex items-center justify-center">
                        <Inbox className="w-5 h-5 text-white/15" />
                    </div>
                    <p className="text-gray-600 text-sm">{t('adminRequests.noRequests')}</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(req => {
                        const statusCfg  = STATUS_CONFIG[req.status]
                        const isExpanded = expanded === req.id
                        const docLabel   = t(`adminRequests.${req.doc_type}`) || DOC_TYPE_LABELS[req.doc_type]
                        const title      = req.custom_title || docLabel
                        const busy       = submitting === req.id || uploading === req.id || removingFile === req.id
                        const canAct     = req.status === 'pending' || req.status === 'in_progress'

                        return (
                            <div key={req.id} className={cn(
                                'bg-[#161B22] rounded-2xl border transition-all',
                                isExpanded ? 'border-white/10' : 'border-white/5',
                                req.status === 'pending' && !isExpanded && 'border-s-2 border-s-amber-500/50'
                            )}>

                                {/* Row */}
                                <div className="flex items-center gap-3 p-5">

                                    {/* Status dot + icon */}
                                    <div className="relative shrink-0">
                                        <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center">
                                            <FileText className="w-5 h-5 text-gray-400" />
                                        </div>
                                        <span className={cn(
                                            "absolute -top-0.5 -end-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#161B22]",
                                            statusCfg.dot
                                        )} />
                                    </div>

                                    {/* Info */}
                                    <button type="button"
                                        onClick={() => setExpanded(isExpanded ? null : req.id)}
                                        className="flex-1 min-w-0 text-start">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-base font-semibold text-white truncate">{title}</p>
                                            <span className={cn(
                                                'shrink-0 text-xs font-semibold px-2.5 py-0.5 rounded-full border',
                                                statusCfg.bg, statusCfg.color
                                            )}>
                                                {statusCfg.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-600 flex-wrap">
                                            <User className="w-3.5 h-3.5" />
                                            <span className="text-gray-400">{req.parent?.full_name ?? '—'}</span>
                                            {req.student?.full_name && <>
                                                <span className="text-gray-700">→</span>
                                                <GraduationCap className="w-3.5 h-3.5" />
                                                <span className="text-gray-400">{req.student.full_name}</span>
                                            </>}
                                            {req.student?.national_id && <>
                                                <IdCard className="w-3.5 h-3.5" />
                                                <span className="font-mono text-xs text-gray-500">{req.student.national_id}</span>
                                            </>}
                                            <span className="ms-auto font-mono text-xs text-gray-600">
                                                {formatDateTimeShort(req.created_at, language)}
                                            </span>
                                        </div>
                                    </button>

                                    {/* Upload button */}
                                    {canAct && (
                                        uploading === req.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin text-gray-500 shrink-0" />
                                        ) : (
                                            <button type="button"
                                                onClick={() => triggerUpload(req.id)}
                                                title={t('adminRequests.sendFile')}
                                                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 transition-colors">
                                                <Paperclip className="w-3.5 h-3.5" />
                                                <span className="hidden sm:inline">
                                                    {req.file_name ? t('adminRequests.replaceFile') : t('adminRequests.sendFile')}
                                                </span>
                                            </button>
                                        )
                                    )}

                                    <button type="button"
                                        onClick={() => setExpanded(isExpanded ? null : req.id)}
                                        className="shrink-0 text-gray-600 hover:text-gray-400 transition-colors p-1">
                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>
                                </div>

                                {/* Expanded */}
                                {isExpanded && (
                                    <div className="px-5 pb-5 space-y-3 border-t border-white/5 pt-4">

                                        {/* Details */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="bg-[#0F1720] rounded-xl p-3.5 border border-white/5">
                                                <p className="text-xs text-gray-600 mb-1.5">{t('adminRequests.docType')}</p>
                                                <p className="text-sm text-white font-semibold">{docLabel}</p>
                                            </div>
                                            <div className="bg-[#0F1720] rounded-xl p-3.5 border border-white/5">
                                                <p className="text-xs text-gray-600 mb-1.5">{t('adminRequests.requestDate')}</p>
                                                <p className="text-sm text-white font-semibold">
                                                    {formatDateTime(req.created_at, language)}
                                                </p>
                                            </div>
                                            {req.student?.national_id && (
                                                <div className="bg-[#0F1720] rounded-xl p-3.5 border border-white/5 col-span-2">
                                                    <p className="text-xs text-gray-600 mb-1.5">{t('adminRequests.nni')}</p>
                                                    <p className="text-sm text-white font-semibold font-mono">{req.student.national_id}</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Parent notes */}
                                        {req.notes && (
                                            <div className="bg-[#0F1720] rounded-xl p-3 border border-white/5">
                                                <p className="text-xs text-gray-600 uppercase tracking-widest mb-2">{t('adminRequests.parentNotes')}</p>
                                                <p className="text-base text-gray-300 leading-relaxed">{req.notes}</p>
                                            </div>
                                        )}

                                        {/* File */}
                                        {req.file_name && req.file_path ? (
                                            <div>
                                                <p className="text-xs text-gray-600 uppercase tracking-widest mb-2">{t('adminRequests.fileAttached')}</p>
                                                <div className="flex items-center gap-3 bg-[#0F1720] border border-white/5 rounded-xl p-3.5">
                                                    <FileText className="w-5 h-5 text-gray-400 shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-white truncate">{req.file_name}</p>
                                                        {req.file_size_bytes && (
                                                            <p className="text-xs text-gray-600">{(req.file_size_bytes / 1024).toFixed(0)} KB</p>
                                                        )}
                                                    </div>
                                                    <a href={req.file_path} target="_blank" rel="noopener noreferrer"
                                                        title={t('common.download')}
                                                        className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors">
                                                        <Download className="w-3.5 h-3.5" />
                                                    </a>
                                                    <button type="button" onClick={() => triggerUpload(req.id)} disabled={busy}
                                                        title={t('adminRequests.replaceFile')}
                                                        className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-30">
                                                        <Paperclip className="w-3.5 h-3.5" />
                                                    </button>
                                                    {removingFile === req.id ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500 shrink-0" />
                                                    ) : (
                                                        <button type="button" onClick={() => handleRemoveFile(req.id)} disabled={busy}
                                                            title={t('adminRequests.deleteFile')}
                                                            className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ) : canAct ? (
                                            <button type="button" onClick={() => triggerUpload(req.id)} disabled={busy}
                                                className="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl border border-dashed border-white/10 text-gray-600 text-sm hover:text-gray-400 hover:border-white/20 transition-colors disabled:opacity-50">
                                                <Paperclip className="w-3.5 h-3.5" />
                                                {t('adminRequests.sendFile')}
                                            </button>
                                        ) : null}

                                        {/* Admin response (existing) */}
                                        {req.response_note && (
                                            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                                                <p className="text-xs text-emerald-500/60 uppercase tracking-widest mb-1.5">{t('adminRequests.adminResponse')}</p>
                                                <p className="text-base text-gray-300 leading-relaxed">{req.response_note}</p>
                                            </div>
                                        )}

                                        {/* Action form */}
                                        {canAct && (
                                            <div className="space-y-2.5">
                                                <textarea
                                                    value={responseText[req.id] ?? ''}
                                                    onChange={e => setResponseText(p => ({ ...p, [req.id]: e.target.value }))}
                                                    placeholder={t('adminRequests.responsePlaceholder')}
                                                    rows={3}
                                                    className="w-full bg-[#0F1720] border border-white/5 text-base text-white rounded-xl px-4 py-3 resize-none focus:outline-none focus:border-white/15 placeholder:text-gray-600 transition-colors"
                                                />
                                                <div className="flex gap-2 flex-wrap">
                                                    {req.status === 'pending' && (
                                                        <button type="button" disabled={busy}
                                                            onClick={() => handle(req.id, 'in_progress')}
                                                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 disabled:opacity-50 transition-colors">
                                                            <Clock className="w-3 h-3" /> {t('adminRequests.takeCharge')}
                                                        </button>
                                                    )}
                                                    <button type="button" disabled={busy}
                                                        onClick={() => handle(req.id, 'rejected')}
                                                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 disabled:opacity-50 transition-colors">
                                                        <XCircle className="w-3 h-3" /> {t('adminRequests.reject')}
                                                    </button>
                                                    <button type="button" disabled={busy}
                                                        onClick={() => handle(req.id, 'ready')}
                                                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-colors">
                                                        {submitting === req.id
                                                            ? <Loader2 className="w-3 h-3 animate-spin" />
                                                            : <CheckCircle2 className="w-3 h-3" />}
                                                        {t('adminRequests.markReady')}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {req.fulfilled_at && (
                                            <p className="text-xs text-gray-700">
                                                {t('adminRequests.treatedOn', {
                                                    date: formatDateTime(req.fulfilled_at, language)
                                                })}
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
    )
}
