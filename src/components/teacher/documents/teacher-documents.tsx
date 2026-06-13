'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Search, Download, FileText, Loader2, FolderOpen, X, Building2, MoreHorizontal, Pencil, Trash2, Upload, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import { useLanguage } from '@/i18n'
import { UploadDocumentDialog } from '@/components/admin/documents/upload-document-dialog'
import { toast } from 'sonner'

interface TeacherDoc {
    id: string
    name: string
    file_url: string | null
    file_type: string | null
    document_type: string
    class_name: string | null
    subject_name: string | null
    subject_icon: string | null
    school_name: string | null
    academic_year: string | null
    created_at: string
    // IDs needed for edit form
    class_id: string | null
    subject_id: string | null
}

const DOC_TYPES = ['course', 'exercise', 'exam', 'devoirs', 'correction', 'resource', 'general'] as const

const TYPE_COLORS: Record<string, { text: string; bg: string }> = {
    course:     { text: 'text-cyan-400',    bg: 'bg-cyan-500/10' },
    exercise:   { text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    exam:       { text: 'text-red-400',     bg: 'bg-red-500/10' },
    devoirs:    { text: 'text-amber-400',   bg: 'bg-amber-500/10' },
    correction: { text: 'text-purple-400',  bg: 'bg-purple-500/10' },
    resource:   { text: 'text-blue-400',    bg: 'bg-blue-500/10' },
    general:    { text: 'text-gray-400',    bg: 'bg-gray-500/10' },
}

function formatDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
        + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function TeacherDocumentsPage() {
    const { t } = useLanguage()
    const [teacherId, setTeacherId] = useState<string | null>(null)
    const [docs, setDocs] = useState<TeacherDoc[]>([])
    const [loading, setLoading] = useState(true)
    const [showUpload, setShowUpload] = useState(false)
    const [typeFilter, setTypeFilter] = useState<string>('all')
    const [search, setSearch] = useState('')
    const [allowedClassIds, setAllowedClassIds] = useState<string[]>([])
    const [allowedSubjectIds, setAllowedSubjectIds] = useState<string[]>([])

    // For edit/delete
    const [classes, setClasses] = useState<{ id: string; name: string; school_name?: string }[]>([])
    const [subjects, setSubjects] = useState<{ id: string; name: string; icon: string | null }[]>([])
    const [editDoc, setEditDoc] = useState<TeacherDoc | null>(null)
    const [editDocType, setEditDocType] = useState('general')
    const [editSubjectId, setEditSubjectId] = useState('none')
    const [editClassId, setEditClassId] = useState('none')
    const [editFile, setEditFile] = useState<File | null>(null)
    const [editSaving, setEditSaving] = useState(false)
    const editFileRef = useRef<HTMLInputElement>(null)
    const [deleteDocId, setDeleteDocId] = useState<string | null>(null)
    const [deleting, setDeleting] = useState(false)

    const loadDocs = useCallback(async (uid: string) => {
        setLoading(true)
        const supabase = createClient()
        const { data } = await supabase
            .from('documents')
            .select(`
                id, name, file_url, file_type, document_type, academic_year, created_at,
                class_id, subject_id,
                classes:class_id ( name ),
                subjects:subject_id ( name, icon ),
                schools:school_id ( name )
            `)
            .or(`teacher_id.eq.${uid},uploaded_by.eq.${uid}`)
            .order('created_at', { ascending: false })

        setDocs((data ?? []).map((d: any) => ({
            id: d.id,
            name: d.name,
            file_url: d.file_url,
            file_type: d.file_type,
            document_type: d.document_type ?? 'general',
            class_id: d.class_id ?? null,
            subject_id: d.subject_id ?? null,
            class_name: d.classes?.name ?? null,
            subject_name: d.subjects?.name ?? null,
            subject_icon: d.subjects?.icon ?? null,
            school_name: d.schools?.name ?? null,
            academic_year: d.academic_year,
            created_at: d.created_at,
        })))
        setLoading(false)
    }, [])

    useEffect(() => {
        async function init() {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            setTeacherId(user.id)

            const { data: assignments } = await supabase
                .from('teacher_assignments')
                .select('class_id, subject_id')
                .eq('teacher_id', user.id)

            const classIds = [...new Set((assignments ?? []).map((a: any) => a.class_id).filter(Boolean))]
            const subjectIds = [...new Set((assignments ?? []).map((a: any) => a.subject_id).filter(Boolean))]
            setAllowedClassIds(classIds)
            setAllowedSubjectIds(subjectIds)

            if (classIds.length > 0) {
                const { data: clsData } = await supabase
                    .from('classes')
                    .select('id, name, schools:school_id(name)')
                    .in('id', classIds)
                    .order('name')
                setClasses((clsData || []).map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    school_name: c.schools?.name ?? undefined,
                })))
            }
            if (subjectIds.length > 0) {
                const { data: subjData } = await supabase
                    .from('subjects')
                    .select('id, name, icon')
                    .in('id', subjectIds)
                    .order('name')
                setSubjects(subjData || [])
            }

            loadDocs(user.id)
        }
        init()
    }, [loadDocs])

    const openEdit = (doc: TeacherDoc) => {
        setEditDoc(doc)
        setEditDocType(doc.document_type)
        setEditSubjectId(doc.subject_id ?? 'none')
        setEditClassId(doc.class_id ?? 'none')
        setEditFile(null)
    }

    const handleEditSave = async () => {
        if (!editDoc) return
        setEditSaving(true)

        const formData = new FormData()
        formData.append('docId', editDoc.id)
        formData.append('documentType', editDocType)
        formData.append('classId',   editClassId)
        formData.append('subjectId', editSubjectId)
        if (editFile) formData.append('file', editFile)

        const res = await fetch('/api/teacher/update-document', { method: 'PUT', body: formData })
        const json = await res.json()

        if (!res.ok) {
            toast.error('Erreur lors de la modification', { description: json.error })
        } else {
            const newSubject = subjects.find(s => s.id === editSubjectId)
            const newClass   = classes.find(c => c.id === editClassId)
            setDocs(prev => prev.map(d => d.id === editDoc.id ? {
                ...d,
                name:         json.newName  ?? d.name,
                file_url:     json.newUrl   ?? d.file_url,
                document_type: editDocType,
                subject_id:   editSubjectId !== 'none' ? editSubjectId : null,
                subject_name: newSubject?.name ?? null,
                subject_icon: newSubject?.icon ?? null,
                class_id:     editClassId !== 'none' ? editClassId : null,
                class_name:   newClass?.name ?? null,
                school_name:  newClass?.school_name ?? d.school_name,
            } : d))
            toast.success('Document modifié')
            setEditDoc(null)
        }
        setEditSaving(false)
    }

    const handleDelete = async () => {
        if (!deleteDocId) return
        setDeleting(true)

        const res = await fetch('/api/teacher/update-document', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ docId: deleteDocId }),
        })
        const json = await res.json()

        if (!res.ok) {
            toast.error('Erreur lors de la suppression', { description: json.error })
        } else {
            setDocs(prev => prev.filter(d => d.id !== deleteDocId))
            toast.success('Document supprimé')
        }
        setDeleteDocId(null)
        setDeleting(false)
    }

    const filtered = docs.filter(d => {
        if (typeFilter !== 'all' && d.document_type !== typeFilter) return false
        if (search.trim()) {
            const q = search.toLowerCase()
            if (!d.name.toLowerCase().includes(q) && !(d.subject_name ?? '').toLowerCase().includes(q) && !(d.class_name ?? '').toLowerCase().includes(q)) return false
        }
        return true
    })

    const typeLabel = (type: string) => t(`teacher.documents.${type}`) || type

    const classLabel = (c: { name: string; school_name?: string }) =>
        c.school_name ? `${c.school_name} — ${c.name}` : c.name

    return (
        <div className="p-4 sm:p-6 max-w-3xl mx-auto pb-24 space-y-5">

            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold">{t('teacher.documents.title')}</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('teacher.documents.subtitle')}</p>
                </div>
                <Button
                    onClick={() => setShowUpload(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl gap-2 shrink-0"
                >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('teacher.documents.addDocument')}</span>
                </Button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    placeholder={t('teacher.documents.searchPlaceholder')}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9 rtl:pl-3 rtl:pr-9 h-10 bg-card border-border/50"
                />
                {search && (
                    <button type="button" title="Effacer" onClick={() => setSearch('')} className="absolute right-3 rtl:right-auto rtl:left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* Type filter pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {(['all', ...DOC_TYPES] as const).map(f => (
                    <button
                        key={f}
                        type="button"
                        onClick={() => setTypeFilter(f)}
                        className={cn(
                            'shrink-0 px-3 py-1 rounded-lg text-xs font-bold border transition-colors',
                            typeFilter === f
                                ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                                : 'bg-card border-border/50 text-muted-foreground hover:text-foreground'
                        )}
                    >
                        {f === 'all' ? t('teacher.documents.all') : typeLabel(f)}
                    </button>
                ))}
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-card border border-border/50 rounded-3xl p-10 text-center">
                    <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
                    <p className="text-sm font-medium text-muted-foreground">{t('teacher.documents.noDocuments')}</p>
                    {docs.length === 0 && (
                        <p className="text-xs text-muted-foreground mt-2 max-w-xs mx-auto">{t('teacher.documents.noDocumentsDesc')}</p>
                    )}
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(doc => {
                        const style = TYPE_COLORS[doc.document_type] ?? TYPE_COLORS.general
                        return (
                            <div key={doc.id} className="bg-card border border-border/50 rounded-2xl p-4 flex items-center justify-between gap-3 hover:border-indigo-500/30 transition-colors group">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', style.bg)}>
                                        <FileText className={cn('w-5 h-5', style.text)} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-sm truncate">{doc.name}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                            <span className={cn('text-[10px] font-bold', style.text)}>{typeLabel(doc.document_type)}</span>
                                            {doc.subject_name && (
                                                <>
                                                    <span className="text-muted-foreground text-[10px]">·</span>
                                                    <span className="text-[10px] text-muted-foreground">{doc.subject_icon} {doc.subject_name}</span>
                                                </>
                                            )}
                                            {doc.class_name && (
                                                <>
                                                    <span className="text-muted-foreground text-[10px]">·</span>
                                                    <span className="text-[10px] text-muted-foreground">{t('teacher.documents.forClass')}: {doc.class_name}</span>
                                                </>
                                            )}
                                            {doc.school_name && (
                                                <>
                                                    <span className="text-muted-foreground text-[10px]">·</span>
                                                    <Building2 className="w-2.5 h-2.5 text-muted-foreground inline-block" />
                                                    <span className="text-[10px] text-muted-foreground">{doc.school_name}</span>
                                                </>
                                            )}
                                            <span className="text-muted-foreground text-[10px]">· {formatDate(doc.created_at)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                    {doc.file_url && (
                                        <a href={doc.file_url} title={doc.name} target="_blank" rel="noopener noreferrer">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-indigo-500 bg-indigo-500/10 hover:bg-indigo-500/20 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Download className="w-4 h-4" />
                                            </Button>
                                        </a>
                                    )}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                                <MoreHorizontal className="w-4 h-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-36">
                                            <DropdownMenuItem onClick={() => openEdit(doc)} className="gap-2 cursor-pointer">
                                                <Pencil className="w-3.5 h-3.5" />
                                                Modifier
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => setDeleteDocId(doc.id)}
                                                className="gap-2 cursor-pointer text-red-500 focus:text-red-500"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                Supprimer
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Upload dialog */}
            {teacherId && (
                <UploadDocumentDialog
                    isOpen={showUpload}
                    onClose={() => setShowUpload(false)}
                    allowedClassIds={allowedClassIds.length > 0 ? allowedClassIds : undefined}
                    allowedSubjectIds={allowedSubjectIds.length > 0 ? allowedSubjectIds : undefined}
                    defaultTeacherId={teacherId}
                    onSuccess={() => teacherId && loadDocs(teacherId)}
                />
            )}

            {/* Edit dialog */}
            <Dialog open={!!editDoc} onOpenChange={open => { if (!open) { setEditDoc(null); setEditFile(null) } }}>
                <DialogContent className="max-w-sm">
                    <DialogTitle className="flex items-center gap-2 text-base font-bold">
                        <Pencil className="w-4 h-4 text-indigo-400" />
                        Modifier le document
                    </DialogTitle>
                    {editDoc && (
                        <div className="space-y-4 mt-1">

                            {/* File replacement zone */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Fichier</Label>
                                <input
                                    ref={editFileRef}
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png"
                                    onChange={e => setEditFile(e.target.files?.[0] ?? null)}
                                />
                                {editFile ? (
                                    <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-3 py-2">
                                        <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                                        <p className="text-xs font-medium truncate flex-1">{editFile.name}</p>
                                        <span className="text-[10px] text-muted-foreground shrink-0">{(editFile.size / 1024).toFixed(0)} KB</span>
                                        <button type="button" onClick={() => { setEditFile(null); if (editFileRef.current) editFileRef.current.value = '' }}>
                                            <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                                        </button>
                                    </div>
                                ) : (
                                    <div
                                        onClick={() => editFileRef.current?.click()}
                                        className="flex items-center gap-2.5 border border-dashed border-border/70 hover:border-indigo-500/40 rounded-xl px-3 py-2.5 cursor-pointer transition-colors group"
                                    >
                                        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                                        <p className="text-xs text-muted-foreground truncate flex-1">{editDoc.name}</p>
                                        <div className="flex items-center gap-1 text-[10px] text-indigo-400 font-bold shrink-0 group-hover:text-indigo-300">
                                            <RefreshCw className="w-3 h-3" />
                                            Changer
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Type</Label>
                                <Select value={editDocType} onValueChange={setEditDocType}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DOC_TYPES.map(v => (
                                            <SelectItem key={v} value={v}>{typeLabel(v)}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Matière</Label>
                                <Select value={editSubjectId} onValueChange={setEditSubjectId}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="—" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">—</SelectItem>
                                        {subjects.map(s => (
                                            <SelectItem key={s.id} value={s.id}>
                                                {s.icon ? `${s.icon} ` : ''}{s.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Classe</Label>
                                <Select value={editClassId} onValueChange={setEditClassId}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="—" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">—</SelectItem>
                                        {classes.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{classLabel(c)}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="mt-2">
                        <Button variant="outline" size="sm" onClick={() => { setEditDoc(null); setEditFile(null) }} disabled={editSaving}>
                            Annuler
                        </Button>
                        <Button size="sm" onClick={handleEditSave} disabled={editSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                            {editSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Enregistrer'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirmation */}
            <AlertDialog open={!!deleteDocId} onOpenChange={open => { if (!open) setDeleteDocId(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Cette action est irréversible. Le fichier sera définitivement supprimé.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deleting}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                            Supprimer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
