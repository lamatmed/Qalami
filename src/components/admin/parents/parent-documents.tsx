'use client'

import { useState, useEffect, useRef } from 'react'
import {
    FileText, Upload, Download, Eye, X, Loader2, Plus,
    CheckCircle2, Clock, FileQuestion, Inbox,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n'

interface ParentDoc {
    id: string
    name: string
    description: string | null
    file_url: string | null
    file_type: string | null
    uploaded_by: 'admin' | 'parent'
    is_request: boolean
    request_status: 'pending' | 'fulfilled' | null
    created_at: string
}

interface ParentDocumentsProps {
    parentId: string
    parentName: string
    schoolId: string
}

export function ParentDocuments({ parentId, parentName, schoolId }: ParentDocumentsProps) {
    const { t } = useLanguage()
    const [docs, setDocs]       = useState<ParentDoc[]>([])
    const [loading, setLoading] = useState(true)
    const [tab, setTab]         = useState<'files' | 'requests'>('files')
    const [viewingUrl, setViewingUrl] = useState<string | null>(null)

    // Upload form
    const [showUploadForm, setShowUploadForm] = useState(false)
    const [uploadName, setUploadName]         = useState('')
    const [uploadDesc, setUploadDesc]         = useState('')
    const [selectedFile, setSelectedFile]     = useState<File | null>(null)
    const [uploading, setUploading]           = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Request form
    const [showRequestForm, setShowRequestForm] = useState(false)
    const [requestName, setRequestName]         = useState('')
    const [requestDesc, setRequestDesc]         = useState('')
    const [creatingRequest, setCreatingRequest] = useState(false)

    // Fulfill
    const [fulfillingId, setFulfillingId]   = useState<string | null>(null)
    const [fulfillFile, setFulfillFile]     = useState<File | null>(null)
    const [fulfillUploading, setFulfillUploading] = useState(false)
    const fulfillInputRef = useRef<HTMLInputElement>(null)

    /* ── Fetch ── */

    async function fetchDocs() {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('parent_documents')
            .select('*')
            .eq('parent_id', parentId)
            .eq('school_id', schoolId)
            .order('created_at', { ascending: false })

        if (error) {
            console.warn('[ParentDocuments]', error.message)
            setDocs([])
        } else {
            setDocs(data || [])
        }
        setLoading(false)
    }

    useEffect(() => { fetchDocs() }, [parentId, schoolId])

    /* ── Upload document to parent ── */

    async function handleUpload() {
        if (!selectedFile || !uploadName.trim()) return
        setUploading(true)
        try {
            const supabase = createClient()
            const ext  = selectedFile.name.split('.').pop()
            const path = `parents/${parentId}/${uploadName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.${ext}`

            const { error: storageErr } = await supabase.storage
                .from('documents')
                .upload(path, selectedFile, { upsert: true })
            if (storageErr) throw storageErr

            const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path)

            const { error: dbErr } = await supabase.from('parent_documents').insert({
                school_id:      schoolId,
                parent_id:      parentId,
                name:           uploadName.trim(),
                description:    uploadDesc.trim() || null,
                file_url:       urlData.publicUrl,
                file_type:      ext?.toUpperCase() || 'FILE',
                file_size:      selectedFile.size,
                uploaded_by:    'admin',
                is_request:     false,
                request_status: null,
            })
            if (dbErr) throw dbErr

            toast.success(t('admin.parents.documents.uploadSuccess'))
            setShowUploadForm(false)
            setUploadName('')
            setUploadDesc('')
            setSelectedFile(null)
            fetchDocs()
        } catch (err: any) {
            console.error(err)
            toast.error(t('admin.parents.documents.uploadError'))
        } finally {
            setUploading(false)
        }
    }

    /* ── Create document request (admin asks parent) ── */

    async function handleCreateRequest() {
        if (!requestName.trim()) return
        setCreatingRequest(true)
        try {
            const supabase = createClient()
            const { error } = await supabase.from('parent_documents').insert({
                school_id:      schoolId,
                parent_id:      parentId,
                name:           requestName.trim(),
                description:    requestDesc.trim() || null,
                file_url:       null,
                file_type:      null,
                uploaded_by:    'admin',
                is_request:     true,
                request_status: 'pending',
            })
            if (error) throw error
            toast.success(t('admin.parents.documents.requestCreated'))
            setShowRequestForm(false)
            setRequestName('')
            setRequestDesc('')
            fetchDocs()
        } catch (err: any) {
            console.error(err)
            toast.error(t('admin.parents.documents.requestError'))
        } finally {
            setCreatingRequest(false)
        }
    }

    /* ── Fulfill parent request (upload response) ── */

    async function handleFulfillRequest(doc: ParentDoc, file: File) {
        setFulfillUploading(true)
        try {
            const supabase = createClient()
            const ext  = file.name.split('.').pop()
            const path = `parents/${parentId}/${doc.name.replace(/[^a-zA-Z0-9]/g, '_')}_response_${Date.now()}.${ext}`

            const { error: storageErr } = await supabase.storage
                .from('documents')
                .upload(path, file, { upsert: true })
            if (storageErr) throw storageErr

            const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path)

            const { error: dbErr } = await supabase
                .from('parent_documents')
                .update({
                    file_url:       urlData.publicUrl,
                    file_type:      ext?.toUpperCase() || 'FILE',
                    file_size:      file.size,
                    request_status: 'fulfilled',
                })
                .eq('id', doc.id)
            if (dbErr) throw dbErr

            toast.success(t('admin.parents.documents.requestFulfilled'))
            setFulfillingId(null)
            setFulfillFile(null)
            fetchDocs()
        } catch (err: any) {
            console.error(err)
            toast.error(t('admin.parents.documents.fulfillError'))
        } finally {
            setFulfillUploading(false)
        }
    }

    /* ── Derived ── */

    const files    = docs.filter(d => !d.is_request)
    const requests = docs.filter(d => d.is_request)
    const pendingCount = requests.filter(r => r.request_status === 'pending').length

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

    /* ── Render ── */

    return (
        <div className="space-y-4 animate-in fade-in duration-300">

            {/* Document viewer modal */}
            {viewingUrl && (
                <div
                    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                    onClick={() => setViewingUrl(null)}
                >
                    <div
                        className="relative max-w-4xl w-full max-h-[90vh] bg-[#1A2530] rounded-2xl overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-4 border-b border-white/5">
                            <h3 className="font-bold text-white text-sm">Document</h3>
                            <div className="flex gap-1">
                                <button type="button" onClick={() => window.open(viewingUrl, '_blank')}
                                    className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                                    <Download className="w-4 h-4" />
                                </button>
                                <button type="button" onClick={() => setViewingUrl(null)}
                                    className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <div className="p-4 flex items-center justify-center min-h-[400px]">
                            {viewingUrl.match(/\.(jpg|jpeg|png|webp|gif)$/i)
                                ? <img src={viewingUrl} alt="Document" className="max-w-full max-h-[70vh] object-contain rounded-lg" />
                                : <iframe src={viewingUrl} className="w-full h-[70vh] rounded-lg" />
                            }
                        </div>
                    </div>
                </div>
            )}

            {/* Tab bar */}
            <div className="flex p-1 bg-[#0D1117] rounded-xl border border-white/5">
                <button
                    type="button"
                    onClick={() => setTab('files')}
                    className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all',
                        tab === 'files'
                            ? 'bg-[#1A2530] text-white shadow-sm border border-white/5'
                            : 'text-gray-500 hover:text-gray-300'
                    )}
                >
                    <FileText className="w-3.5 h-3.5" />
                    {t('admin.parents.documents.tabFiles')}
                    {files.length > 0 && (
                        <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full">{files.length}</span>
                    )}
                </button>
                <button
                    type="button"
                    onClick={() => setTab('requests')}
                    className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all',
                        tab === 'requests'
                            ? 'bg-[#1A2530] text-white shadow-sm border border-white/5'
                            : 'text-gray-500 hover:text-gray-300'
                    )}
                >
                    <FileQuestion className="w-3.5 h-3.5" />
                    {t('admin.parents.documents.tabRequests')}
                    {pendingCount > 0 && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">{pendingCount}</span>
                    )}
                </button>
            </div>

            {/* ── Files tab ── */}
            {tab === 'files' && (
                <div className="space-y-3">

                    {/* Upload form */}
                    {showUploadForm && (
                        <div className="bg-[#0D1117] rounded-xl border border-emerald-500/20 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                            <p className="text-xs font-bold text-emerald-400">{t('admin.parents.documents.sendDocTitle')}</p>

                            <input
                                type="text"
                                value={uploadName}
                                onChange={e => setUploadName(e.target.value)}
                                placeholder={t('admin.parents.documents.docNamePlaceholder')}
                                className="w-full bg-[#1A2530] border border-white/10 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 placeholder:text-gray-600"
                            />
                            <input
                                type="text"
                                value={uploadDesc}
                                onChange={e => setUploadDesc(e.target.value)}
                                placeholder={t('admin.parents.documents.docDescPlaceholder')}
                                className="w-full bg-[#1A2530] border border-white/10 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 placeholder:text-gray-600"
                            />

                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className={cn(
                                    'flex items-center gap-3 p-3 rounded-lg border border-dashed cursor-pointer transition-colors',
                                    selectedFile
                                        ? 'border-emerald-500/40 bg-emerald-500/5'
                                        : 'border-white/10 hover:border-emerald-500/30 hover:bg-white/5'
                                )}
                            >
                                <Upload className={cn('w-4 h-4', selectedFile ? 'text-emerald-400' : 'text-gray-500')} />
                                <span className={cn('text-xs truncate', selectedFile ? 'text-emerald-400' : 'text-gray-500')}>
                                    {selectedFile ? selectedFile.name : t('admin.parents.documents.selectFile')}
                                </span>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                                className="hidden"
                                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                            />

                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => { setShowUploadForm(false); setSelectedFile(null); setUploadName(''); setUploadDesc('') }}
                                    disabled={uploading}
                                    className="px-3 py-1.5 text-xs font-bold rounded-lg border border-white/10 text-gray-400 hover:text-white transition-colors"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleUpload}
                                    disabled={uploading || !selectedFile || !uploadName.trim()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-black text-xs font-bold rounded-lg transition-colors"
                                >
                                    {uploading
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        : <Upload className="w-3.5 h-3.5" />}
                                    {t('admin.parents.documents.send')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Send button */}
                    {!showUploadForm && (
                        <button
                            type="button"
                            onClick={() => setShowUploadForm(true)}
                            className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed border-emerald-500/30 text-emerald-400 text-xs font-bold hover:bg-emerald-500/5 transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            {t('admin.parents.documents.sendDoc')}
                        </button>
                    )}

                    {/* Files list */}
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                        </div>
                    ) : files.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">
                            <Inbox className="w-10 h-10 mx-auto mb-3 opacity-20" />
                            <p className="text-sm">{t('admin.parents.documents.noFiles')}</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {files.map(doc => (
                                <div key={doc.id} className="group flex items-center gap-3 p-3 bg-[#0D1117] rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                    <div className={cn(
                                        'h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
                                        doc.uploaded_by === 'admin' ? 'bg-emerald-500/10' : 'bg-blue-500/10'
                                    )}>
                                        <FileText className={cn('w-5 h-5', doc.uploaded_by === 'admin' ? 'text-emerald-400' : 'text-blue-400')} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-white truncate">{doc.name}</p>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                            <span className={cn(
                                                'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                                                doc.uploaded_by === 'admin'
                                                    ? 'bg-emerald-500/10 text-emerald-400'
                                                    : 'bg-blue-500/10 text-blue-400'
                                            )}>
                                                {doc.uploaded_by === 'admin'
                                                    ? t('admin.parents.documents.sentByAdmin')
                                                    : t('admin.parents.documents.sentByParent')}
                                            </span>
                                            <span className="text-[10px] text-gray-500">{formatDate(doc.created_at)}</span>
                                        </div>
                                        {doc.description && (
                                            <p className="text-[11px] text-gray-500 mt-0.5 truncate">{doc.description}</p>
                                        )}
                                    </div>
                                    {doc.file_url && (
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => setViewingUrl(doc.file_url)}
                                                title={t('admin.parents.documents.view')}
                                                className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <a
                                                href={doc.file_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title={t('admin.parents.documents.download')}
                                                className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-400 hover:bg-white/5 transition-colors"
                                            >
                                                <Download className="w-4 h-4" />
                                            </a>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Requests tab ── */}
            {tab === 'requests' && (
                <div className="space-y-3">

                    {/* Create request form */}
                    {showRequestForm && (
                        <div className="bg-[#0D1117] rounded-xl border border-amber-500/20 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                            <p className="text-xs font-bold text-amber-400">{t('admin.parents.documents.newRequestTitle')}</p>
                            <input
                                type="text"
                                value={requestName}
                                onChange={e => setRequestName(e.target.value)}
                                placeholder={t('admin.parents.documents.requestNamePlaceholder')}
                                className="w-full bg-[#1A2530] border border-white/10 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500/50 placeholder:text-gray-600"
                            />
                            <input
                                type="text"
                                value={requestDesc}
                                onChange={e => setRequestDesc(e.target.value)}
                                placeholder={t('admin.parents.documents.requestDescPlaceholder')}
                                className="w-full bg-[#1A2530] border border-white/10 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500/50 placeholder:text-gray-600"
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => { setShowRequestForm(false); setRequestName(''); setRequestDesc('') }}
                                    disabled={creatingRequest}
                                    className="px-3 py-1.5 text-xs font-bold rounded-lg border border-white/10 text-gray-400 hover:text-white transition-colors"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCreateRequest}
                                    disabled={creatingRequest || !requestName.trim()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black text-xs font-bold rounded-lg transition-colors"
                                >
                                    {creatingRequest
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        : <Plus className="w-3.5 h-3.5" />}
                                    {t('admin.parents.documents.createRequest')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Request button */}
                    {!showRequestForm && (
                        <button
                            type="button"
                            onClick={() => setShowRequestForm(true)}
                            className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed border-amber-500/30 text-amber-400 text-xs font-bold hover:bg-amber-500/5 transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            {t('admin.parents.documents.requestDoc')}
                        </button>
                    )}

                    {/* Requests list */}
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                        </div>
                    ) : requests.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">
                            <FileQuestion className="w-10 h-10 mx-auto mb-3 opacity-20" />
                            <p className="text-sm">{t('admin.parents.documents.noRequests')}</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {requests.map(req => (
                                <div key={req.id} className="p-3 bg-[#0D1117] rounded-xl border border-white/5 space-y-2">
                                    <div className="flex items-start gap-3">
                                        <div className={cn(
                                            'h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                                            req.request_status === 'fulfilled' ? 'bg-emerald-500/10' : 'bg-amber-500/10'
                                        )}>
                                            {req.request_status === 'fulfilled'
                                                ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                                : <Clock className="w-4 h-4 text-amber-400" />
                                            }
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-white">{req.name}</p>
                                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                                <span className={cn(
                                                    'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                                                    req.request_status === 'fulfilled'
                                                        ? 'bg-emerald-500/10 text-emerald-400'
                                                        : 'bg-amber-500/10 text-amber-400'
                                                )}>
                                                    {req.request_status === 'fulfilled'
                                                        ? t('admin.parents.documents.statusFulfilled')
                                                        : t('admin.parents.documents.statusPending')}
                                                </span>
                                                <span className={cn(
                                                    'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                                                    req.uploaded_by === 'admin'
                                                        ? 'bg-emerald-500/10 text-emerald-400'
                                                        : 'bg-blue-500/10 text-blue-400'
                                                )}>
                                                    {req.uploaded_by === 'admin'
                                                        ? t('admin.parents.documents.requestedByAdmin')
                                                        : t('admin.parents.documents.requestedByParent')}
                                                </span>
                                            </div>
                                            {req.description && (
                                                <p className="text-[11px] text-gray-500 mt-1">{req.description}</p>
                                            )}
                                        </div>
                                        {req.file_url && (
                                            <a
                                                href={req.file_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title={t('admin.parents.documents.download')}
                                                className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-400 hover:bg-white/5 transition-colors shrink-0"
                                            >
                                                <Download className="w-4 h-4" />
                                            </a>
                                        )}
                                    </div>

                                    {/* Respond to parent's pending request */}
                                    {req.request_status === 'pending' && req.uploaded_by === 'parent' && (
                                        fulfillingId === req.id ? (
                                            <div className="flex items-center gap-2 pt-1">
                                                <div
                                                    onClick={() => fulfillInputRef.current?.click()}
                                                    className={cn(
                                                        'flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed cursor-pointer transition-colors text-xs truncate',
                                                        fulfillFile
                                                            ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-400'
                                                            : 'border-white/10 text-gray-500 hover:border-emerald-500/30'
                                                    )}
                                                >
                                                    <Upload className="w-3.5 h-3.5 shrink-0" />
                                                    <span className="truncate">{fulfillFile ? fulfillFile.name : t('admin.parents.documents.selectFile')}</span>
                                                </div>
                                                <input
                                                    ref={fulfillInputRef}
                                                    type="file"
                                                    accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                                                    className="hidden"
                                                    onChange={e => setFulfillFile(e.target.files?.[0] || null)}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => fulfillFile && handleFulfillRequest(req, fulfillFile)}
                                                    disabled={!fulfillFile || fulfillUploading}
                                                    className="flex items-center gap-1 px-3 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-xs font-bold rounded-lg transition-colors shrink-0"
                                                >
                                                    {fulfillUploading
                                                        ? <Loader2 className="w-3 h-3 animate-spin" />
                                                        : <CheckCircle2 className="w-3 h-3" />}
                                                    {t('admin.parents.documents.fulfill')}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { setFulfillingId(null); setFulfillFile(null) }}
                                                    className="p-2 text-gray-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors shrink-0"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => setFulfillingId(req.id)}
                                                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-emerald-400 text-xs font-bold hover:bg-emerald-500/10 transition-colors"
                                            >
                                                <Upload className="w-3 h-3" />
                                                {t('admin.parents.documents.respondToRequest')}
                                            </button>
                                        )
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
