'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { FileText, Loader2, Download, Eye, Upload, Trash2, Pencil, Check, X, FolderOpen } from 'lucide-react'
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

const DOC_SLOTS_BASE = [
    { type: 'cv',       labelKey: 'cv'      },
    { type: 'contract', labelKey: 'contract' },
    { type: 'diploma',  labelKey: 'diploma'  },
    { type: 'medical',  labelKey: 'medical'  },
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
                docId:      found?.id              ?? null,
                fileName:   found?.name            ?? null,
                fileUrl:    found?.file_url        ?? null,
                sizeBytes:  found?.file_size_bytes ?? null,
                uploadedAt: found?.created_at      ?? null,
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
        else { toast.success(t('admin.employees.documents.deleted')); await load() }
        setDeletingType(null)
        setConfirmDeleteType(null)
    }

    const handleSaveEdit = async (slot: Slot) => {
        if (!slot.docId || !editName.trim()) return
        setSavingEdit(true)
        const res = await updateTeacherDocumentAction(slot.docId, editName.trim(), 'general', undefined)
        if (res.error) toast.error(res.error)
        else { toast.success(t('admin.employees.documents.renamed')); await load(); setEditingType(null) }
        setSavingEdit(false)
    }

    if (loading) return (
        <div className="flex justify-center py-14">
            <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
        </div>
    )

    const filled = slots.filter(s => s.docId).length

    return (
        <div className="space-y-3">
            <input
                ref={fileInputRef}
                type="file"
                title={t('admin.employees.documents.title')}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="hidden"
                onChange={handleFileSelected}
            />

            {/* Preview modal */}
            {viewingUrl && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setViewingUrl(null)}>
                    <div className="relative max-w-4xl w-full max-h-[90vh] bg-[#161B22] rounded-2xl border border-white/5 overflow-hidden shadow-2xl"
                        onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                            <p className="text-sm text-white">{t('admin.employees.documents.preview')}</p>
                            <button type="button" title={t('common.close')} onClick={() => setViewingUrl(null)}
                                className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-4 flex items-center justify-center min-h-100">
                            {viewingUrl.match(/\.(jpg|jpeg|png|webp|gif)$/i)
                                ? <img src={viewingUrl} alt={t('admin.employees.documents.preview')} className="max-w-full max-h-[70vh] object-contain rounded-lg" />
                                : <iframe src={viewingUrl} title={t('admin.employees.documents.preview')} className="w-full h-[70vh] rounded-lg" />
                            }
                        </div>
                    </div>
                </div>
            )}

            {/* Progress */}
            <div className="bg-[#161B22] rounded-2xl border border-white/5 p-4">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-500">{t('admin.employees.documents.title')}</p>
                    <p className="text-xs text-gray-500">{filled}/{slots.length}</p>
                </div>
                <div className="flex gap-1">
                    {slots.map(s => (
                        <div key={s.type} className={cn(
                            "flex-1 h-1 rounded-full transition-colors duration-500",
                            s.docId ? "bg-emerald-500/50" : "bg-white/5"
                        )} />
                    ))}
                </div>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {slots.map(slot => {
                    const isPresent = !!slot.docId
                    const isDeleting = deletingType === slot.type
                    const isEditing = editingType === slot.type
                    const isThisUploading = uploading && uploadTarget === slot.type
                    const confirmDelete = confirmDeleteType === slot.type
                    const slotLabel = t(`admin.employees.documents.${slot.labelKey}`)

                    return (
                        <div key={slot.type} className="bg-[#161B22] rounded-2xl border border-white/5 p-4">
                            {/* Header */}
                            <div className="flex items-center gap-3 mb-3">
                                <div className={cn(
                                    "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border",
                                    isPresent
                                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                        : "bg-white/5 border-white/5 text-gray-600"
                                )}>
                                    <FileText className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] text-gray-600 uppercase tracking-widest">{slotLabel}</p>
                                    {isEditing ? (
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <input
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(slot); if (e.key === 'Escape') setEditingType(null) }}
                                                autoFocus
                                                title={t('admin.documents.docNamePlaceholder')}
                                                placeholder={t('admin.documents.docNamePlaceholder')}
                                                className="flex-1 bg-[#0F1720] border border-white/5 rounded px-2 py-0.5 text-xs text-white focus:outline-none min-w-0"
                                            />
                                            <button type="button" title={t('common.save')} onClick={() => handleSaveEdit(slot)} disabled={savingEdit}
                                                className="p-1 text-emerald-400 rounded transition-colors">
                                                {savingEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                            </button>
                                            <button type="button" title={t('common.cancel')} onClick={() => setEditingType(null)}
                                                className="p-1 text-gray-500 rounded transition-colors">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ) : isPresent ? (
                                        <p className="text-xs text-white truncate mt-0.5">{slot.fileName}</p>
                                    ) : (
                                        <p className="text-xs text-white/15 mt-0.5">{t('admin.employees.documents.noFile')}</p>
                                    )}
                                </div>
                                <span className={cn(
                                    "text-xs shrink-0 font-medium",
                                    isPresent ? "text-emerald-400" : "text-gray-700"
                                )}>
                                    {isPresent ? '✓' : '—'}
                                </span>
                            </div>

                            {isPresent && !isEditing && slot.uploadedAt && (
                                <p className="text-[10px] text-gray-700 mb-3">
                                    {formatDate(slot.uploadedAt)}{slot.sizeBytes ? ` · ${formatSize(slot.sizeBytes)}` : ''}
                                </p>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-1 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => triggerUpload(slot.type)}
                                    disabled={isThisUploading || uploading}
                                    className={cn(
                                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50",
                                        isPresent
                                            ? "text-gray-500 hover:text-white hover:bg-white/5 border border-white/5"
                                            : "bg-emerald-600 hover:bg-emerald-500 text-white"
                                    )}
                                >
                                    {isThisUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                                    {isPresent ? t('admin.employees.documents.replace') : t('admin.employees.documents.add')}
                                </button>

                                {isPresent && !isEditing && (
                                    <>
                                        <button type="button"
                                            title={t('admin.employees.documents.preview')}
                                            onClick={() => setViewingUrl(slot.fileUrl)}
                                            className="p-1.5 rounded-lg text-gray-600 hover:text-white hover:bg-white/5 transition-all">
                                            <Eye className="w-3.5 h-3.5" />
                                        </button>
                                        <a href={slot.fileUrl || '#'}
                                            title={t('admin.employees.documents.download')}
                                            download target="_blank" rel="noopener noreferrer"
                                            className="p-1.5 rounded-lg text-gray-600 hover:text-white hover:bg-white/5 transition-all">
                                            <Download className="w-3.5 h-3.5" />
                                        </a>
                                        <button type="button"
                                            title={t('admin.employees.info.edit')}
                                            onClick={() => { setEditingType(slot.type); setEditName(slot.fileName || '') }}
                                            className="p-1.5 rounded-lg text-gray-600 hover:text-white hover:bg-white/5 transition-all">
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>

                                        {confirmDelete ? (
                                            <div className="flex items-center gap-1 ms-auto">
                                                <button type="button" onClick={() => handleDelete(slot)} disabled={isDeleting}
                                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all">
                                                    {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                                    {t('admin.employees.documents.yes')}
                                                </button>
                                                <button type="button" onClick={() => setConfirmDeleteType(null)}
                                                    className="px-2 py-1 rounded-lg text-xs text-gray-500 hover:text-white border border-white/5 transition-all">
                                                    {t('admin.employees.documents.no')}
                                                </button>
                                            </div>
                                        ) : (
                                            <button type="button"
                                                title={t('common.delete')}
                                                onClick={() => setConfirmDeleteType(slot.type)}
                                                className="ms-auto p-1.5 rounded-lg text-gray-700 hover:text-red-400 hover:bg-white/5 transition-all">
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

            {filled === 0 && (
                <div className="flex flex-col items-center py-6 gap-2">
                    <FolderOpen className="w-7 h-7 text-white/10" />
                    <p className="text-xs text-gray-700">Ajoutez les documents de l&apos;employé</p>
                </div>
            )}
        </div>
    )
}
