'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
    Inbox, Clock, CheckCircle2, XCircle, Loader2, Search,
    ChevronDown, ChevronUp, User, GraduationCap,
    FileText, RefreshCw, Download, Paperclip,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
    getDocumentRequests, updateDocRequestStatus, getMySchoolId,
    type DocumentRequest, type DocRequestStatus,
} from './actions'
import { DOC_TYPE_LABELS } from './constants'

const STATUS_CONFIG: Record<DocRequestStatus, { label: string; color: string; bg: string }> = {
    pending:     { label: 'En attente',  color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20'    },
    in_progress: { label: 'En cours',    color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20'      },
    ready:       { label: 'Prêt',        color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    rejected:    { label: 'Refusé',      color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20'        },
    cancelled:   { label: 'Annulé',      color: 'text-gray-400',    bg: 'bg-gray-500/10 border-gray-500/20'      },
}

type FilterTab = 'all' | DocRequestStatus

export default function RequestsPage() {
    const [requests, setRequests]       = useState<DocumentRequest[]>([])
    const [loading, setLoading]         = useState(true)
    const [tab, setTab]                 = useState<FilterTab>('all')
    const [search, setSearch]           = useState('')
    const [expanded, setExpanded]       = useState<string | null>(null)
    const [responseText, setResponseText] = useState<Record<string, string>>({})
    const [submitting, setSubmitting]   = useState<string | null>(null)
    const [uploading, setUploading]     = useState<string | null>(null)
    const [schoolId, setSchoolId]       = useState<string>('')

    const fileInputRef    = useRef<HTMLInputElement>(null)
    const uploadTargetId  = useRef<string>('')

    /* ── Load ── */

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

    /* ── Upload ── */

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
            if (!res.ok) throw new Error(json.error || 'Upload échoué')

            toast.success('Document envoyé — parent notifié ✓')
            load()
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setUploading(null)
            uploadTargetId.current = ''
        }
    }

    /* ── Status change ── */

    const handle = async (id: string, status: DocRequestStatus) => {
        setSubmitting(id)
        const res = await updateDocRequestStatus(id, status, responseText[id])
        setSubmitting(null)
        if (res.error) { toast.error(res.error); return }
        toast.success(
            status === 'ready'       ? 'Demande marquée prête — parent notifié' :
            status === 'in_progress' ? 'Demande prise en charge' :
            status === 'rejected'    ? 'Demande refusée — parent notifié' : 'Statut mis à jour'
        )
        setExpanded(null)
        load()
    }

    /* ── Derived ── */

    const filtered = requests.filter(r => {
        if (tab !== 'all' && r.status !== tab) return false
        if (search.trim()) {
            const q = search.toLowerCase()
            return (
                (r.parent?.full_name  ?? '').toLowerCase().includes(q) ||
                (r.student?.full_name ?? '').toLowerCase().includes(q) ||
                DOC_TYPE_LABELS[r.doc_type].toLowerCase().includes(q)  ||
                (r.custom_title ?? '').toLowerCase().includes(q)       ||
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
        { key: 'all',         label: `Toutes (${counts.all})`             },
        { key: 'pending',     label: `En attente (${counts.pending})`     },
        { key: 'in_progress', label: `En cours (${counts.in_progress})`   },
        { key: 'ready',       label: `Prêtes (${counts.ready})`           },
        { key: 'rejected',    label: `Refusées (${counts.rejected})`      },
    ]

    /* ── Render ── */

    return (
        <div className="p-6 space-y-6 max-w-4xl mx-auto">

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                aria-label="Fichier à envoyer"
                className="hidden"
                onChange={handleFileChange}
            />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 flex items-center justify-center">
                        <Inbox className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white">Demandes de documents</h1>
                        <p className="text-xs text-gray-500">
                            {counts.pending > 0
                                ? `${counts.pending} demande${counts.pending > 1 ? 's' : ''} en attente`
                                : 'Aucune demande en attente'}
                        </p>
                    </div>
                </div>
                <button type="button" onClick={load}
                    className="p-2 rounded-xl text-gray-500 hover:text-white hover:bg-white/5 transition-colors">
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Rechercher par parent, élève, type..."
                    className="w-full bg-[#0D1117] border border-white/10 text-white text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 placeholder:text-gray-600"
                />
            </div>

            {/* Tabs */}
            <div className="flex gap-2 flex-wrap">
                {tabs.map(t => (
                    <button key={t.key} type="button" onClick={() => setTab(t.key)}
                        className={cn(
                            'px-3 py-1.5 rounded-lg text-xs font-bold border transition-all',
                            tab === t.key
                                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                                : 'bg-white/5 border-white/10 text-gray-500 hover:text-gray-300'
                        )}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* List */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20 bg-[#0D1117] rounded-3xl border border-white/5">
                    <Inbox className="w-10 h-10 mx-auto mb-3 text-gray-600" />
                    <p className="text-gray-500 font-medium">Aucune demande</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(req => {
                        const statusCfg  = STATUS_CONFIG[req.status]
                        const isExpanded = expanded === req.id
                        const docLabel   = DOC_TYPE_LABELS[req.doc_type]
                        const title      = req.custom_title || docLabel
                        const busy       = submitting === req.id || uploading === req.id
                        const canAct     = req.status === 'pending' || req.status === 'in_progress'

                        return (
                            <div key={req.id} className={cn(
                                'bg-[#0D1117] rounded-2xl border transition-all',
                                req.status === 'pending'     ? 'border-amber-500/20' :
                                req.status === 'in_progress' ? 'border-blue-500/20'  : 'border-white/5',
                                isExpanded && 'border-cyan-500/30'
                            )}>

                                {/* ── Row ── */}
                                <div className="flex items-center gap-3 p-4">

                                    {/* Icon */}
                                    <div className="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center shrink-0">
                                        <FileText className="w-4 h-4 text-cyan-400" />
                                    </div>

                                    {/* Info */}
                                    <button type="button"
                                        onClick={() => setExpanded(isExpanded ? null : req.id)}
                                        className="flex-1 min-w-0 text-left">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm font-bold text-white truncate">{title}</p>
                                            <span className={cn(
                                                'shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border',
                                                statusCfg.bg, statusCfg.color
                                            )}>
                                                {statusCfg.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500">
                                            <User className="w-3 h-3" />
                                            <span className="text-gray-400">{req.parent?.full_name ?? '—'}</span>
                                            {req.student?.full_name && <>
                                                <span>→</span>
                                                <GraduationCap className="w-3 h-3" />
                                                <span className="text-gray-400">{req.student.full_name}</span>
                                            </>}
                                            <span className="text-gray-600 ml-auto">
                                                {new Date(req.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                                            </span>
                                        </div>
                                    </button>

                                    {/* Upload button — always visible for active requests */}
                                    {canAct && (
                                        uploading === req.id ? (
                                            <div className="shrink-0 flex items-center gap-1.5 text-xs text-gray-400 px-3">
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                <span className="hidden sm:inline">Envoi…</span>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => triggerUpload(req.id)}
                                                title="Envoyer le fichier au parent"
                                                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 transition-colors"
                                            >
                                                <Paperclip className="w-3.5 h-3.5" />
                                                <span className="hidden sm:inline">
                                                    {req.file_name ? 'Remplacer' : 'Envoyer fichier'}
                                                </span>
                                            </button>
                                        )
                                    )}

                                    <button type="button"
                                        onClick={() => setExpanded(isExpanded ? null : req.id)}
                                        className="shrink-0 text-gray-600 p-1">
                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>
                                </div>

                                {/* ── Expanded ── */}
                                {isExpanded && (
                                    <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-4">

                                        {/* Details grid */}
                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                            <div className="bg-white/5 rounded-xl p-3">
                                                <p className="text-gray-500 mb-1">Type de document</p>
                                                <p className="text-white font-bold">{docLabel}</p>
                                            </div>
                                            <div className="bg-white/5 rounded-xl p-3">
                                                <p className="text-gray-500 mb-1">Date de la demande</p>
                                                <p className="text-white font-bold">
                                                    {new Date(req.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Parent notes */}
                                        {req.notes && (
                                            <div className="bg-white/5 rounded-xl p-4">
                                                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Précisions du parent</p>
                                                <p className="text-sm text-white leading-relaxed">{req.notes}</p>
                                            </div>
                                        )}

                                        {/* File already attached */}
                                        {req.file_name && req.file_path && (
                                            <div className="flex items-center gap-3 bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-3">
                                                <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-white truncate">{req.file_name}</p>
                                                    {req.file_size_bytes && (
                                                        <p className="text-[10px] text-gray-500">
                                                            {(req.file_size_bytes / 1024).toFixed(0)} KB
                                                        </p>
                                                    )}
                                                </div>
                                                <a href={req.file_path} target="_blank" rel="noopener noreferrer"
                                                    className="shrink-0 p-1.5 rounded-lg text-cyan-400 hover:bg-cyan-500/10 transition-colors">
                                                    <Download className="w-3.5 h-3.5" />
                                                </a>
                                            </div>
                                        )}

                                        {/* Admin response */}
                                        {req.response_note && (
                                            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                                                <p className="text-xs font-bold text-emerald-400 uppercase mb-2">Réponse de l'administration</p>
                                                <p className="text-sm text-white leading-relaxed">{req.response_note}</p>
                                            </div>
                                        )}

                                        {/* Action form */}
                                        {canAct && (
                                            <div className="space-y-3">
                                                <textarea
                                                    value={responseText[req.id] ?? ''}
                                                    onChange={e => setResponseText(p => ({ ...p, [req.id]: e.target.value }))}
                                                    placeholder="Note ou réponse pour le parent (optionnel)..."
                                                    rows={3}
                                                    className="w-full bg-[#1A2530] border border-white/10 text-sm text-white rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-1 focus:ring-cyan-500/50 placeholder:text-gray-600"
                                                />
                                                <div className="flex gap-2 flex-wrap">
                                                    {req.status === 'pending' && (
                                                        <button type="button" disabled={busy}
                                                            onClick={() => handle(req.id, 'in_progress')}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 disabled:opacity-50 transition-colors">
                                                            <Clock className="w-3 h-3" /> Prendre en charge
                                                        </button>
                                                    )}
                                                    <button type="button" disabled={busy}
                                                        onClick={() => triggerUpload(req.id)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 disabled:opacity-50 transition-colors">
                                                        <Paperclip className="w-3 h-3" />
                                                        {req.file_name ? 'Remplacer le fichier' : 'Joindre le fichier'}
                                                    </button>
                                                    <button type="button" disabled={busy}
                                                        onClick={() => handle(req.id, 'rejected')}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 disabled:opacity-50 transition-colors">
                                                        <XCircle className="w-3 h-3" /> Refuser
                                                    </button>
                                                    <button type="button" disabled={busy}
                                                        onClick={() => handle(req.id, 'ready')}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-black bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 transition-colors">
                                                        {submitting === req.id
                                                            ? <Loader2 className="w-3 h-3 animate-spin" />
                                                            : <CheckCircle2 className="w-3 h-3" />}
                                                        Marquer prête
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {req.fulfilled_at && (
                                            <p className="text-[10px] text-gray-600">
                                                Traité le {new Date(req.fulfilled_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
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
