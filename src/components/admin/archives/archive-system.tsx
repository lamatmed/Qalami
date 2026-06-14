'use client'

import { useState, useEffect, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
    Search,
    Download,
    Archive,
    FileText,
    BookOpen,
    PenLine,
    ClipboardList,
    FolderOpen,
    Briefcase,
    Scale,
    Users,
    GraduationCap,
    Calendar,
    LayoutGrid,
    List,
    X,
    Filter,
    FileImage,
    FileSpreadsheet,
    Presentation,
    Loader2,
    Plus,
    Pencil,
    Trash2,
    Check,
    ChevronDown
} from 'lucide-react'
import { UploadDocumentDialog } from '@/components/admin/documents/upload-document-dialog'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import { useSchoolContext } from '@/lib/use-school-context'
import { useLanguage } from '@/i18n'
import { toast } from 'sonner'

/* ─────────────── Types ─────────────── */

interface ArchiveDoc {
    id: string
    name: string
    file_url: string | null
    file_type: string | null
    file_size_bytes: number | null
    document_type: string | null
    category: string | null
    school_year: string | null
    created_at: string
    teacher_name: string | null
    uploader_name: string | null
    subject_name: string | null
    class_name: string | null
    source: 'document' | 'student_doc'
    student_name: string | null
    doc_status: string | null
    description: string | null
}

type SortKey = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'size_desc'
type ViewMode = 'grid' | 'list'

/* ─────────────── Config ─────────────── */

const CATEGORIES = [
    { id: 'all',      label: 'Tous',            icon: FolderOpen,    color: 'text-gray-400' },
    { id: 'pedago',   label: 'Pédagogie',        icon: BookOpen,      color: 'text-purple-400' },
    { id: 'admin',    label: 'Administration',   icon: Briefcase,     color: 'text-blue-400' },
    { id: 'finance',  label: 'Finance',          icon: ClipboardList, color: 'text-emerald-400' },
    { id: 'hr',       label: 'RH',              icon: Users,         color: 'text-pink-400' },
    { id: 'legal',    label: 'Juridique',        icon: Scale,         color: 'text-amber-400' },
    { id: 'student',  label: 'Élèves',           icon: GraduationCap, color: 'text-cyan-400' },
]

const DOC_TYPES: Record<string, string> = {
    course:     'Cours',
    exercise:   'Exercice',
    exam:       'Examen',
    devoirs:    'Devoirs',
    correction: 'Correction',
    resource:   'Ressource',
    general:    'Général',
}

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
    { id: 'date_desc', label: 'Plus récent' },
    { id: 'date_asc',  label: 'Plus ancien' },
    { id: 'name_asc',  label: 'Nom A→Z' },
    { id: 'name_desc', label: 'Nom Z→A' },
    { id: 'size_desc', label: 'Plus grand' },
]

/* ─────────────── Helpers ─────────────── */

function formatSize(bytes: number | null) {
    if (!bytes || bytes === 0) return '—'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function FileIcon({ type, className }: { type: string | null; className?: string }) {
    const t = (type || '').toLowerCase()
    if (t.includes('pdf'))   return <FileText      className={cn('text-red-400', className)} />
    if (t.includes('sheet') || t.includes('xls') || t.includes('csv'))
                             return <FileSpreadsheet className={cn('text-emerald-400', className)} />
    if (t.includes('ppt') || t.includes('pres'))
                             return <Presentation   className={cn('text-orange-400', className)} />
    if (t.includes('doc') || t.includes('word'))
                             return <FileText       className={cn('text-blue-400', className)} />
    if (t.includes('jpg') || t.includes('jpeg') || t.includes('png') || t.includes('image'))
                             return <FileImage      className={cn('text-purple-400', className)} />
    return <FileText className={cn('text-gray-400', className)} />
}

function typeBgColor(type: string | null) {
    const t = (type || '').toLowerCase()
    if (t.includes('pdf'))   return 'bg-red-500/10 border-red-500/20'
    if (t.includes('sheet') || t.includes('xls') || t.includes('csv')) return 'bg-emerald-500/10 border-emerald-500/20'
    if (t.includes('ppt'))   return 'bg-orange-500/10 border-orange-500/20'
    if (t.includes('doc'))   return 'bg-blue-500/10 border-blue-500/20'
    if (t.includes('image') || t.includes('jpg') || t.includes('png')) return 'bg-purple-500/10 border-purple-500/20'
    return 'bg-white/5 border-white/10'
}

/* ─────────────── Main Component ─────────────── */

export function ArchiveSystem() {
    const { t } = useLanguage()
    const { context } = useSchoolContext()
    const [docs, setDocs] = useState<ArchiveDoc[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [category, setCategory] = useState('all')
    const [docType, setDocType] = useState('all')
    const [year, setYear] = useState('all')
    const [sort, setSort] = useState<SortKey>('date_desc')
    const [view, setView] = useState<ViewMode>('grid')
    const [showUpload, setShowUpload] = useState(false)
    const [statusMenuId, setStatusMenuId] = useState<string | null>(null)
    const [editingDoc, setEditingDoc] = useState<{ id: string; name: string; source: 'document' | 'student_doc' } | null>(null)
    const [editName, setEditName] = useState('')
    const [savingEdit, setSavingEdit] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const loadDocs = async (schoolId: string) => {
        setLoading(true)
        const supabase = createClient()

        const { data: mainDocs } = await supabase
            .from('documents')
            .select(`
                id, name, file_url, file_type, file_size_bytes,
                document_type, category, school_year, created_at,
                description,
                teacher:profiles!documents_teacher_id_fkey ( full_name ),
                uploader:profiles!documents_uploaded_by_fkey ( full_name ),
                subject:subjects ( name ),
                class:classes ( name )
            `)
            .eq('school_id', schoolId)
            .order('created_at', { ascending: false })

        const { data: studentDocs } = await supabase
            .from('student_documents')
            .select(`
                id, document_name, file_url, file_type, status, uploaded_at,
                student:profiles!student_documents_student_id_fkey ( full_name, school_id )
            `)
            .order('uploaded_at', { ascending: false })

        const result: ArchiveDoc[] = []

        for (const d of mainDocs ?? []) {
            result.push({
                id: d.id,
                name: d.name,
                file_url: d.file_url,
                file_type: d.file_type,
                file_size_bytes: d.file_size_bytes,
                document_type: d.document_type,
                category: d.category,
                school_year: d.school_year,
                created_at: d.created_at,
                teacher_name: (d.teacher as any)?.full_name ?? null,
                uploader_name: (d.uploader as any)?.full_name ?? null,
                subject_name: (d.subject as any)?.name ?? null,
                class_name: (d.class as any)?.name ?? null,
                source: 'document',
                description: (d as any).description ?? null,
                student_name: null,
                doc_status: null,
            })
        }

        for (const d of studentDocs ?? []) {
            const student = d.student as any
            if (student?.school_id && student.school_id !== schoolId) continue
            result.push({
                id: d.id,
                name: d.document_name,
                file_url: d.file_url,
                file_type: d.file_type,
                file_size_bytes: null,
                document_type: null,
                category: 'student',
                school_year: null,
                created_at: d.uploaded_at,
                teacher_name: null,
                uploader_name: null,
                subject_name: null,
                class_name: null,
                source: 'student_doc',
                student_name: student?.full_name ?? null,
                doc_status: d.status,
                description: null,
            })
        }

        setDocs(result)
        setLoading(false)
    }

    useEffect(() => {
        if (!context) return
        loadDocs(context.school_id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [context])

    const handleChangeDocStatus = async (docId: string, newStatus: 'valid' | 'pending' | 'missing') => {
        const supabase = createClient()
        await supabase.from('student_documents').update({ status: newStatus }).eq('id', docId)
        setStatusMenuId(null)
        setDocs(prev => prev.map(d => d.id === docId ? { ...d, doc_status: newStatus } : d))
    }

    const handleDelete = async (doc: ArchiveDoc) => {
        if (!confirm(t('admin.documents.deleteConfirmMsg').replace('{name}', doc.name))) return
        setDeletingId(doc.id)
        const supabase = createClient()
        const table = doc.source === 'student_doc' ? 'student_documents' : 'documents'
        const { error } = await supabase.from(table as any).delete().eq('id', doc.id)
        setDeletingId(null)
        if (error) { toast.error(t('admin.documents.deleteError') + ': ' + error.message); return }
        setDocs(prev => prev.filter(d => d.id !== doc.id))
    }

    const startEdit = (doc: ArchiveDoc) => {
        setEditingDoc({ id: doc.id, name: doc.name, source: doc.source })
        setEditName(doc.name)
    }

    const handleSaveEdit = async () => {
        if (!editingDoc || !editName.trim()) return
        setSavingEdit(true)
        const supabase = createClient()
        const table = editingDoc.source === 'student_doc' ? 'student_documents' : 'documents'
        const nameField = editingDoc.source === 'student_doc' ? 'document_name' : 'name'
        const { error } = await supabase.from(table as any).update({ [nameField]: editName.trim() }).eq('id', editingDoc.id)
        setSavingEdit(false)
        if (error) { alert('Erreur : ' + error.message); return }
        setDocs(prev => prev.map(d => d.id === editingDoc.id ? { ...d, name: editName.trim() } : d))
        setEditingDoc(null)
    }

    /* Derived values */
    const years = useMemo(() => {
        const s = new Set(docs.map(d => d.school_year).filter(Boolean) as string[])
        return Array.from(s).sort().reverse()
    }, [docs])

    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = {}
        for (const d of docs) {
            const key = d.category ?? 'general'
            counts[key] = (counts[key] || 0) + 1
        }
        return counts
    }, [docs])

    const filtered = useMemo(() => {
        let list = docs

        // Category
        if (category !== 'all') list = list.filter(d => d.category === category)

        // Document type
        if (docType !== 'all') list = list.filter(d => d.document_type === docType)

        // Year
        if (year !== 'all') list = list.filter(d => d.school_year === year)

        // Search — across name, teacher, student, subject, class
        if (search.trim()) {
            const q = search.trim().toLowerCase()
            list = list.filter(d =>
                d.name?.toLowerCase().includes(q) ||
                d.description?.toLowerCase().includes(q) ||

                d.teacher_name?.toLowerCase().includes(q) ||
                d.student_name?.toLowerCase().includes(q) ||
                d.subject_name?.toLowerCase().includes(q) ||
                d.class_name?.toLowerCase().includes(q) ||
                d.uploader_name?.toLowerCase().includes(q)
            )
        }

        // Sort
        list = [...list].sort((a, b) => {
            if (sort === 'date_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            if (sort === 'date_asc')  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            if (sort === 'name_asc')  return a.name.localeCompare(b.name, 'fr')
            if (sort === 'name_desc') return b.name.localeCompare(a.name, 'fr')
            if (sort === 'size_desc') return (b.file_size_bytes ?? 0) - (a.file_size_bytes ?? 0)
            return 0
        })

        return list
    }, [docs, category, docType, year, search, sort])

    const activeFilters = [
        category !== 'all' && t('admin.documents.categories.' + category),
        docType !== 'all' && t('admin.documents.docTypes.' + docType),
        year !== 'all' && year,
    ].filter(Boolean)

    /* ─── Render ─── */

    return (
        <>
        <div className="space-y-5 animate-in fade-in duration-500">

            {/* ── Header ── */}
            <div className="bg-[#1A2530] rounded-3xl border border-white/5 p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                        <Archive className="w-5 h-5 text-emerald-400" />
                        {t('admin.documents.title')}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        {loading ? '…' : t(docs.length === 1 ? 'admin.documents.documentsCount' : 'admin.documents.documentsCountPlural').replace('{count}', docs.length.toLocaleString())}
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    {/* Search */}
                    <div className="relative flex-1 sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <Input
                            placeholder={t('admin.documents.searchPlaceholder')}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9 bg-[#0F1720] border-white/10 text-sm text-white placeholder:text-gray-600 h-10 focus-visible:ring-emerald-500/50 rounded-xl"
                        />
                        {search && (
                            <button type="button" title="Effacer" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Upload button */}
                    <Button
                        onClick={() => setShowUpload(true)}
                        className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-xl shrink-0 gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">{t('admin.documents.addDocument')}</span>
                    </Button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-5">

                {/* ── Left Sidebar ── */}
                <div className="w-full lg:w-56 shrink-0 space-y-5">

                    {/* Categories */}
                    <div className="bg-[#1A2530] rounded-2xl border border-white/5 p-3 space-y-0.5">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-2 pb-2">{t('admin.documents.categoriesLabel')}</p>
                        {CATEGORIES.map(cat => {
                            const Icon = cat.icon
                            const count = cat.id === 'all'
                                ? docs.length
                                : (categoryCounts[cat.id] ?? 0)
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => setCategory(cat.id)}
                                    className={cn(
                                        'w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all',
                                        category === cat.id
                                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                            : 'text-gray-500 hover:bg-white/5 hover:text-white'
                                    )}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <Icon className={cn('w-4 h-4', category === cat.id ? 'text-emerald-400' : cat.color)} />
                                        {t('admin.documents.categories.' + cat.id)}
                                    </div>
                                    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-md',
                                        category === cat.id ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-gray-600'
                                    )}>{count}</span>
                                </button>
                            )
                        })}
                    </div>

                    {/* Document types */}
                    <div className="bg-[#1A2530] rounded-2xl border border-white/5 p-3 space-y-0.5">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-2 pb-2">{t('admin.documents.docTypeLabel')}</p>
                        <button
                            onClick={() => setDocType('all')}
                            className={cn('w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-all',
                                docType === 'all' ? 'bg-white/10 text-white' : 'text-gray-500 hover:bg-white/5 hover:text-white'
                              )}
                        >{t('admin.documents.allTypes')}</button>
                        {Object.entries(DOC_TYPES).map(([key]) => (
                            <button
                                key={key}
                                onClick={() => setDocType(key)}
                                className={cn('w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-all',
                                    docType === key ? 'bg-white/10 text-white' : 'text-gray-500 hover:bg-white/5 hover:text-white'
                                  )}
                            >{t('admin.documents.docTypes.' + key)}</button>
                        ))}
                    </div>

                    {/* Years */}
                    {years.length > 0 && (
                        <div className="bg-[#1A2530] rounded-2xl border border-white/5 p-3 space-y-0.5">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-2 pb-2">{t('admin.documents.schoolYearLabel')}</p>
                            <button
                                onClick={() => setYear('all')}
                                className={cn('w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2',
                                    year === 'all' ? 'bg-white/10 text-white' : 'text-gray-500 hover:bg-white/5 hover:text-white'
                                  )}
                            ><Calendar className="w-3.5 h-3.5" /> {t('admin.documents.allYears')}</button>
                            {years.map(y => (
                                <button
                                    key={y}
                                    onClick={() => setYear(y)}
                                    className={cn('w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2',
                                        year === y ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'text-gray-500 hover:bg-white/5 hover:text-white'
                                      )}
                                ><Calendar className="w-3.5 h-3.5" /> {y}</button>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Main Area ── */}
                <div className="flex-1 min-w-0">

                    {/* Toolbar */}
                    <div className="bg-[#1A2530] rounded-2xl border border-white/5 px-4 py-3 flex items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-gray-400">
                                <span className="text-white font-bold">{filtered.length}</span> {t(filtered.length === 1 ? 'admin.documents.result' : 'admin.documents.results').replace('{count}', '')}
                            </span>
                            {activeFilters.map(f => (
                                <span key={f as string} className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                    <Filter className="w-2.5 h-2.5" /> {f}
                                </span>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Sort */}
                            <select
                                value={sort}
                                onChange={e => setSort(e.target.value as SortKey)}
                                className="bg-[#0F1720] border border-white/10 text-xs text-gray-400 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            >
                                {SORT_OPTIONS.map(o => <option key={o.id} value={o.id}>{t('admin.documents.sortOptions.' + o.id)}</option>)}
                            </select>
                            {/* View toggle */}
                            <div className="flex rounded-lg border border-white/10 overflow-hidden">
                                <button
                                    onClick={() => setView('grid')}
                                    className={cn('p-1.5 transition-colors', view === 'grid' ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-500 hover:text-white')}
                                ><LayoutGrid className="w-4 h-4" /></button>
                                <button
                                    onClick={() => setView('list')}
                                    className={cn('p-1.5 transition-colors', view === 'list' ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-500 hover:text-white')}
                                ><List className="w-4 h-4" /></button>
                            </div>
                        </div>
                    </div>

                    {/* Loading */}
                    {loading && (
                        <div className="flex items-center justify-center py-24">
                            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                        </div>
                    )}

                    {/* Empty */}
                    {!loading && filtered.length === 0 && (
                        <div className="text-center py-24 bg-[#1A2530] rounded-3xl border border-white/5">
                            <FolderOpen className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                            <p className="text-gray-400 font-bold">{t('admin.documents.noDocFound')}</p>
                            <p className="text-xs text-gray-600 mt-1">{t('admin.documents.noDocDesc')}</p>
                            {(search || category !== 'all' || docType !== 'all' || year !== 'all') && (
                                <button
                                    onClick={() => { setSearch(''); setCategory('all'); setDocType('all'); setYear('all') }}
                                    className="mt-4 text-xs text-emerald-400 hover:underline"
                                >{t('admin.documents.resetFilters')}</button>
                            )}
                        </div>
                    )}

                    {/* Grid view */}
                    {!loading && filtered.length > 0 && view === 'grid' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                            {filtered.map(doc => (
                                <DocCard key={doc.id} doc={doc}
                                    deleting={deletingId === doc.id}
                                    onEdit={() => startEdit(doc)}
                                    onDelete={() => handleDelete(doc)}
                                    statusMenuId={statusMenuId}
                                    setStatusMenuId={setStatusMenuId}
                                    onChangeStatus={handleChangeDocStatus}
                                />
                            ))}
                        </div>
                    )}

                    {/* List view */}
                    {!loading && filtered.length > 0 && view === 'list' && (
                        <div className="bg-[#1A2530] rounded-3xl border border-white/5 overflow-hidden">
                            <div className="divide-y divide-white/5">
                                {filtered.map(doc => (
                                    <DocRow key={doc.id} doc={doc}
                                        deleting={deletingId === doc.id}
                                        onEdit={() => startEdit(doc)}
                                        onDelete={() => handleDelete(doc)}
                                        statusMenuId={statusMenuId}
                                        setStatusMenuId={setStatusMenuId}
                                        onChangeStatus={handleChangeDocStatus}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>

        <UploadDocumentDialog
            isOpen={showUpload}
            onClose={() => setShowUpload(false)}
            onSuccess={() => context && loadDocs(context.school_id)}
        />

        {/* Edit dialog */}
        {editingDoc && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !savingEdit && setEditingDoc(null)} />
                <div className="relative w-full max-w-sm bg-[#1A2530] border border-white/10 rounded-2xl shadow-2xl p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
                            <Pencil className="w-4 h-4 text-blue-400" />
                        </div>
                        <h3 className="font-bold text-white">Renommer le document</h3>
                    </div>
                    <input
                        autoFocus
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditingDoc(null) }}
                        className="w-full bg-[#0F1720] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-500/50"
                        placeholder="Nom du document"
                    />
                    <div className="flex gap-3">
                        <button type="button" onClick={() => setEditingDoc(null)} disabled={savingEdit}
                            className="flex-1 py-2 rounded-xl border border-white/10 text-gray-400 hover:text-white text-sm font-bold transition-colors">
                            Annuler
                        </button>
                        <button type="button" onClick={handleSaveEdit} disabled={savingEdit || !editName.trim()}
                            className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                            {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Enregistrer
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    )
}

/* ─────────────── Card (Grid) ─────────────── */

function DocCard({
    doc,
    onEdit,
    onDelete,
    deleting,
    statusMenuId,
    setStatusMenuId,
    onChangeStatus,
}: {
    doc: ArchiveDoc
    onEdit: () => void
    onDelete: () => void
    deleting: boolean
    statusMenuId: string | null
    setStatusMenuId: (id: string | null) => void
    onChangeStatus: (docId: string, newStatus: 'valid' | 'pending' | 'missing') => Promise<void>
}) {
    const { t } = useLanguage()
    return (
        <div className={cn('group bg-[#1A2530] border rounded-2xl p-4 flex items-start gap-3 hover:border-emerald-500/30 transition-all', typeBgColor(doc.file_type))}>
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border', typeBgColor(doc.file_type))}>
                <FileIcon type={doc.file_type} className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors">{doc.name}</p>
                {doc.description && (
                    <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">{doc.description}</p>
                )}

                {/* Meta pills */}
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {doc.document_type && (
                        <span className="text-[10px] bg-white/5 text-gray-400 px-2 py-0.5 rounded-full border border-white/5 font-medium">
                            {t('admin.documents.docTypes.' + doc.document_type)}
                        </span>
                    )}
                    {doc.subject_name && (
                        <span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/20 font-medium">
                            {doc.subject_name}
                        </span>
                    )}
                    {doc.class_name && (
                        <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20 font-medium">
                            {doc.class_name}
                        </span>
                    )}
                    {doc.student_name && (
                        <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-500/20 font-medium flex items-center gap-1">
                            <GraduationCap className="w-2.5 h-2.5" />{doc.student_name}
                        </span>
                    )}
                    {doc.doc_status && (
                        <DropdownMenu
                            open={statusMenuId === doc.id}
                            onOpenChange={(open) => setStatusMenuId(open ? doc.id : null)}
                        >
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    className={cn(
                                        'text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 transition-all hover:brightness-110 active:scale-95 shadow-sm border border-transparent select-none cursor-pointer',
                                        doc.doc_status === 'valid'   ? 'bg-emerald-500 text-white' :
                                        doc.doc_status === 'pending' ? 'bg-amber-400 text-black' :
                                        'bg-red-500 text-white'
                                    )}
                                >
                                    {doc.doc_status === 'valid' ? t('admin.documents.valid') : doc.doc_status === 'pending' ? t('admin.documents.pending') : t('admin.documents.missing')}
                                    <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="bg-[#1A2530] border border-white/10 rounded-xl p-1 min-w-[120px] shadow-xl">
                                <DropdownMenuItem
                                    onClick={() => onChangeStatus(doc.id, 'valid')}
                                    className="cursor-pointer text-xs font-semibold text-white hover:bg-white/5 rounded-lg gap-2 py-1.5"
                                >
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                    {t('admin.documents.valid')}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => onChangeStatus(doc.id, 'pending')}
                                    className="cursor-pointer text-xs font-semibold text-white hover:bg-white/5 rounded-lg gap-2 py-1.5"
                                >
                                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                                    {t('admin.documents.pending')}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => onChangeStatus(doc.id, 'missing')}
                                    className="cursor-pointer text-xs font-semibold text-white hover:bg-white/5 rounded-lg gap-2 py-1.5"
                                >
                                    <span className="w-2 h-2 rounded-full bg-red-500" />
                                    {t('admin.documents.missing')}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-2">
                    <div className="text-[10px] text-gray-600 space-y-0.5">
                        {(doc.teacher_name || doc.uploader_name) && (
                            <p className="flex items-center gap-1">
                                <PenLine className="w-2.5 h-2.5" />
                                {doc.teacher_name ?? doc.uploader_name}
                            </p>
                        )}
                        <p>{formatDate(doc.created_at)} · {formatSize(doc.file_size_bytes)}</p>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                        {doc.file_url && (
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-600 hover:text-emerald-400">
                                    <Download className="w-3.5 h-3.5" />
                                </Button>
                            </a>
                        )}
                        <button type="button" onClick={onEdit}
                            className="h-7 w-7 flex items-center justify-center text-gray-600 hover:text-blue-400 rounded-md hover:bg-white/5 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={onDelete} disabled={deleting}
                            className="h-7 w-7 flex items-center justify-center text-gray-600 hover:text-red-400 rounded-md hover:bg-white/5 transition-colors">
                            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

/* ─────────────── Row (List) ─────────────── */

function DocRow({
    doc,
    onEdit,
    onDelete,
    deleting,
    statusMenuId,
    setStatusMenuId,
    onChangeStatus,
}: {
    doc: ArchiveDoc
    onEdit: () => void
    onDelete: () => void
    deleting: boolean
    statusMenuId: string | null
    setStatusMenuId: (id: string | null) => void
    onChangeStatus: (docId: string, newStatus: 'valid' | 'pending' | 'missing') => Promise<void>
}) {
    const { t } = useLanguage()
    return (
        <div className="group flex items-center gap-4 px-5 py-3.5 hover:bg-[#0F1720] transition-colors">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border', typeBgColor(doc.file_type))}>
                <FileIcon type={doc.file_type} className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors">{doc.name}</p>
                <div className="flex items-center gap-3 text-[10px] text-gray-600 mt-0.5 flex-wrap">
                    {doc.description   && <span className="text-gray-400 truncate max-w-[200px]">{doc.description}</span>}
                    {doc.teacher_name  && <span>{doc.teacher_name}</span>}
                    {doc.student_name  && <span className="text-cyan-500">{doc.student_name}</span>}
                    {doc.subject_name  && <span>· {doc.subject_name}</span>}
                    {doc.class_name    && <span>· {doc.class_name}</span>}
                </div>
            </div>
            <div className="flex items-center gap-4 shrink-0">
                {doc.doc_status && (
                    <DropdownMenu
                        open={statusMenuId === doc.id}
                        onOpenChange={(open) => setStatusMenuId(open ? doc.id : null)}
                    >
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                className={cn(
                                    'text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 transition-all hover:brightness-110 active:scale-95 shadow-sm border border-transparent select-none cursor-pointer',
                                    doc.doc_status === 'valid'   ? 'bg-emerald-500 text-white' :
                                    doc.doc_status === 'pending' ? 'bg-amber-400 text-black' :
                                    'bg-red-500 text-white'
                                )}
                            >
                                {doc.doc_status === 'valid' ? t('admin.documents.valid') : doc.doc_status === 'pending' ? t('admin.documents.pending') : t('admin.documents.missing')}
                                <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-[#1A2530] border border-white/10 rounded-xl p-1 min-w-[120px] shadow-xl">
                            <DropdownMenuItem
                                onClick={() => onChangeStatus(doc.id, 'valid')}
                                className="cursor-pointer text-xs font-semibold text-white hover:bg-white/5 rounded-lg gap-2 py-1.5"
                            >
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                {t('admin.documents.valid')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => onChangeStatus(doc.id, 'pending')}
                                className="cursor-pointer text-xs font-semibold text-white hover:bg-white/5 rounded-lg gap-2 py-1.5"
                            >
                                <span className="w-2 h-2 rounded-full bg-amber-400" />
                                {t('admin.documents.pending')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => onChangeStatus(doc.id, 'missing')}
                                className="cursor-pointer text-xs font-semibold text-white hover:bg-white/5 rounded-lg gap-2 py-1.5"
                            >
                                <span className="w-2 h-2 rounded-full bg-red-500" />
                                {t('admin.documents.missing')}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
                {doc.document_type && (
                    <span className="text-[10px] bg-white/5 text-gray-400 px-2 py-0.5 rounded-full border border-white/5 hidden sm:block">
                        {t('admin.documents.docTypes.' + doc.document_type)}
                    </span>
                )}
                <span className="text-[10px] text-gray-600 hidden md:block">{formatSize(doc.file_size_bytes)}</span>
                <span className="text-[10px] text-gray-600">{formatDate(doc.created_at)}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                    {doc.file_url ? (
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-600 hover:text-emerald-400">
                                <Download className="w-3.5 h-3.5" />
                            </Button>
                        </a>
                    ) : <div className="w-7" />}
                    <button type="button" onClick={onEdit}
                        className="h-7 w-7 flex items-center justify-center text-gray-600 hover:text-blue-400 rounded-md hover:bg-white/5 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={onDelete} disabled={deleting}
                        className="h-7 w-7 flex items-center justify-center text-gray-600 hover:text-red-400 rounded-md hover:bg-white/5 transition-colors">
                        {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                </div>
            </div>
        </div>
    )
}
