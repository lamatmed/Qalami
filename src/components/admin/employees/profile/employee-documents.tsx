'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { FileText, Loader2, Download, Eye, Upload, Trash2, Pencil, Check, X, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
    saveAdminDocumentAction,
    fetchAdminDocumentsAction,
    updateTeacherDocumentAction,
    deleteTeacherDocumentAction,
} from '@/app/admin/teachers/actions'
import { useLanguage } from '@/i18n'

type Slot = {
    type: string
    labelKey: string
    color: string
    docId: string | null
    fileName: string | null
    fileUrl: string | null
    sizeBytes: number | null
    uploadedAt: string | null
}

function formatSize(bytes: number | null) {
    if (!bytes) return null
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function formatDate(iso: string | null) {
    if (!iso) return null
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const COLOR_MAP: Record<string, string> = {
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    blue:    'bg-blue-500/10 border-blue-500/20 text-blue-400',
    purple:  'bg-purple-500/10 border-purple-500/20 text-purple-400',
    amber:   'bg-amber-500/10 border-amber-500/20 text-amber-400',
}

const DOC_SLOTS_BASE = [
    { type: 'cv',       labelKey: 'cv',       color: 'emerald' },
    { type: 'contract', labelKey: 'contract',  color: 'blue'    },
    { type: 'diploma',  labelKey: 'diploma',   color: 'purple'  },
    { type: 'medical',  labelKey: 'medical',   color: 'amber'   },
]

export function EmployeeDocuments({ employeeId }: { employeeId: string }) {
    const { t } = useLanguage()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [slots, setSlots] = useState<Slot[]>(
        DOC_SLOTS_BASE.map(d => ({ ...d, docId: null, fileName: null, fileUrl: null, sizeBytes: null, uploadedAt: null }))
    )
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [uploadTarget, setUploadTarget] = useState<string>('')
    const [viewingUrl, setViewingUrl] = useState<string | null>(null)
    const [deletingType, setDeletingType] = useState<string | null>(null)
    const [confirmDeleteType, setConfirmDeleteType] = useState<string | null>(null)
    const [editingType, setEditingType] = useState<string | null>(null)
    const [editName, setEditName] = useState('')
    const [savingEdit, setSavingEdit] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        const { data } = await fetchAdminDocumentsAction(employeeId)
        setSlots(DOC_SLOTS_BASE.map(slot => {
            const found = (data as any[]).find((d: any) => d.category === slot.type)
            return {
                ...slot,
                docId:      found?.id        ?? null,
                fileName:   found?.name       ?? null,
                fileUrl:    found?.file_url   ?? null,
                sizeBytes:  found?.file_size_bytes ?? null,
                uploadedAt: found?.created_at ?? null,
            }
        }))
        setLoading(false)
    }, [employeeId])

    useEffect(() => { load() }, [load])

    const triggerUpload = (type: string) => {
        setUploadTarget(type)
        fileInputRef.current?.click()
    }

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !uploadTarget) return
        setUploading(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('employeeId', employeeId)
            formData.append('category', uploadTarget)

            const res = await fetch('/api/admin/upload-employee-document', { method: 'POST', body: formData })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || t('common.error'))

            const slot = DOC_SLOTS_BASE.find(d => d.type === uploadTarget)
            const slotLabel = slot ? t(`admin.employees.documents.${slot.labelKey}`) : uploadTarget
            await saveAdminDocumentAction(employeeId, uploadTarget, json.publicUrl, slotLabel, file.size)
            toast.success(t('admin.employees.documents.uploaded'))
            await load()
        } catch (err: any) {
            toast.error(err.message || t('common.error'))
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleDelete = async (slot: Slot) => {
        if (!slot.docId) return
        setDeletingType(slot.type)
        const res = await deleteTeacherDocumentAction(slot.docId)
        if (res.error) toast.error(res.error)
        else {
            toast.success(t('admin.employees.documents.deleted'))
            await load()
        }
        setDeletingType(null)
        setConfirmDeleteType(null)
    }

    const startEdit = (slot: Slot) => {
        setEditingType(slot.type)
        setEditName(slot.fileName || '')
    }

    const handleSaveEdit = async (slot: Slot) => {
        if (!slot.docId || !editName.trim()) return
        setSavingEdit(true)
        const res = await updateTeacherDocumentAction(slot.docId, editName.trim(), 'general', undefined)
        if (res.error) toast.error(res.error)
        else {
            toast.success(t('admin.employees.documents.renamed'))
            await load()
            setEditingType(null)
        }
        setSavingEdit(false)
    }

    const isUploading = (type: string) => uploading && uploadTarget === type

    if (loading) return (
        <div className="flex justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-pink-500" />
        </div>
    )

    const filled = slots.filter(s => s.docId).length

    return (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden" title="upload" onChange={handleFileSelected} />

            {/* Preview modal */}
            {viewingUrl && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setViewingUrl(null)}>
                    <div className="relative max-w-4xl w-full max-h-[90vh] bg-[#1A2530] rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-white/5">
                            <h3 className="font-bold text-white">{t('admin.employees.documents.preview')}</h3>
                            <button type="button" title={t('common.close')} onClick={() => setViewingUrl(null)} className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-4 flex items-center justify-center min-h-[400px]">
                            {viewingUrl.match(/\.(jpg|jpeg|png|webp|gif)$/i)
                                ? <img src={viewingUrl} alt={t('admin.employees.documents.preview')} className="max-w-full max-h-[70vh] object-contain rounded-lg" />
                                : <iframe src={viewingUrl} title={t('admin.employees.documents.preview')} className="w-full h-[70vh] rounded-lg" />
                            }
                        </div>
                    </div>
                </div>
            )}

            {/* Progress bar */}
            <div className="bg-[#1A2530] rounded-2xl border border-white/5 p-4">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-gray-400">{t('admin.employees.documents.title')}</p>
                    <p className="text-xs font-bold text-white">{filled}/{slots.length}</p>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                        style={{ '--bar-w': `${(filled / slots.length) * 100}%` } as React.CSSProperties}
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500 w-[var(--bar-w)]"
                    />
                </div>
            </div>

            {/* Document cards */}
            <div className="space-y-3">
                {slots.map(slot => {
                    const colorClass = COLOR_MAP[slot.color] || COLOR_MAP.blue
                    const isPresent = !!slot.docId
                    const isDeleting = deletingType === slot.type
                    const isEditing = editingType === slot.type
                    const isThisUploading = isUploading(slot.type)
                    const confirmDelete = confirmDeleteType === slot.type
                    const slotLabel = t(`admin.employees.documents.${slot.labelKey}`)

                    return (
                        <div key={slot.type} className={cn(
                            "bg-[#1A2530] rounded-2xl border transition-all overflow-hidden",
                            isPresent ? "border-white/10" : "border-dashed border-white/10"
                        )}>
                            <div className="p-4 flex items-start gap-4">
                                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border", colorClass)}>
                                    <FileText className="w-4 h-4" />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-gray-500 uppercase mb-0.5">{slotLabel}</p>
                                            {isEditing ? (
                                                <div className="flex items-center gap-2 mt-1">
                                                    <input
                                                        value={editName}
                                                        onChange={e => setEditName(e.target.value)}
                                                        onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(slot); if (e.key === 'Escape') setEditingType(null) }}
                                                        autoFocus
                                                        title={t('admin.documents.docNamePlaceholder')}
                                                        placeholder={t('admin.documents.docNamePlaceholder')}
                                                        className="bg-[#0F1720] border border-white/10 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-pink-500/50 min-w-0 flex-1"
                                                    />
                                                    <button type="button" title={t('common.save')} onClick={() => handleSaveEdit(slot)} disabled={savingEdit}
                                                        className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors">
                                                        {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                                    </button>
                                                    <button type="button" title={t('common.cancel')} onClick={() => setEditingType(null)}
                                                        className="p-1.5 text-gray-500 hover:bg-white/5 rounded-lg transition-colors">
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ) : isPresent ? (
                                                <p className="text-sm font-bold text-white truncate">{slot.fileName}</p>
                                            ) : (
                                                <p className="text-sm text-gray-600 italic">{t('admin.employees.documents.noFile')}</p>
                                            )}
                                            {isPresent && !isEditing && (
                                                <p className="text-[10px] text-gray-600 mt-0.5">
                                                    {formatDate(slot.uploadedAt)}{slot.sizeBytes ? ` · ${formatSize(slot.sizeBytes)}` : ''}
                                                </p>
                                            )}
                                        </div>

                                        <span className={cn(
                                            "text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0",
                                            isPresent ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-white/5 text-gray-600 border-white/10"
                                        )}>
                                            {isPresent ? t('admin.employees.documents.present') : t('admin.employees.documents.missing')}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Action bar */}
                            <div className="px-4 pb-3 flex items-center gap-2">
                                <button type="button" onClick={() => triggerUpload(slot.type)} disabled={isThisUploading || uploading}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50",
                                        isPresent
                                            ? "text-gray-400 hover:text-white hover:bg-white/5 border border-white/10"
                                            : "bg-pink-600 hover:bg-pink-500 text-white"
                                    )}>
                                    {isThisUploading
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        : <Upload className="w-3.5 h-3.5" />
                                    }
                                    {isPresent ? t('admin.employees.documents.replace') : t('admin.employees.documents.add')}
                                </button>

                                {isPresent && !isEditing && (
                                    <>
                                        <button type="button" onClick={() => setViewingUrl(slot.fileUrl)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 border border-white/10 transition-all">
                                            <Eye className="w-3.5 h-3.5" /> {t('admin.employees.documents.preview')}
                                        </button>
                                        <a href={slot.fileUrl || '#'} download target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 border border-white/10 transition-all">
                                            <Download className="w-3.5 h-3.5" /> {t('admin.employees.documents.download')}
                                        </a>
                                        <button type="button" title={t('admin.employees.info.edit')} onClick={() => startEdit(slot)}
                                            className="p-1.5 rounded-xl text-gray-500 hover:text-white hover:bg-white/5 border border-white/10 transition-all">
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>

                                        {confirmDelete ? (
                                            <div className="flex items-center gap-2 ml-auto">
                                                <span className="text-[10px] text-red-400 font-bold">{t('admin.employees.documents.deleteConfirm')}</span>
                                                <button type="button" onClick={() => handleDelete(slot)} disabled={isDeleting}
                                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-500 text-white">
                                                    {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                                    {t('admin.employees.documents.yes')}
                                                </button>
                                                <button type="button" onClick={() => setConfirmDeleteType(null)}
                                                    className="px-2.5 py-1 rounded-lg text-xs font-bold text-gray-400 hover:text-white border border-white/10">
                                                    {t('admin.employees.documents.no')}
                                                </button>
                                            </div>
                                        ) : (
                                            <button type="button" title={t('common.delete')} onClick={() => setConfirmDeleteType(slot.type)}
                                                className="ml-auto p-1.5 rounded-xl text-gray-600 hover:text-red-400 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 transition-all">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
