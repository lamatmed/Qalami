'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Download, FileText, Loader2, FolderOpen, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import { useLanguage } from '@/i18n'
import { UploadDocumentDialog } from '@/components/admin/documents/upload-document-dialog'

interface TeacherDoc {
    id: string
    name: string
    file_url: string | null
    file_type: string | null
    document_type: string
    class_name: string | null
    subject_name: string | null
    subject_icon: string | null
    academic_year: string | null
    created_at: string
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
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
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

    const loadDocs = useCallback(async (uid: string) => {
        setLoading(true)
        const supabase = createClient()
        const { data } = await supabase
            .from('documents')
            .select(`
                id, name, file_url, file_type, document_type, academic_year, created_at,
                classes:class_id ( name ),
                subjects:subject_id ( name, icon )
            `)
            .or(`teacher_id.eq.${uid},uploaded_by.eq.${uid}`)
            .order('created_at', { ascending: false })

        setDocs((data ?? []).map((d: any) => ({
            id: d.id,
            name: d.name,
            file_url: d.file_url,
            file_type: d.file_type,
            document_type: d.document_type ?? 'general',
            class_name: d.classes?.name ?? null,
            subject_name: d.subjects?.name ?? null,
            subject_icon: d.subjects?.icon ?? null,
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

            // Fetch only the classes and subjects this teacher is assigned to
            const { data: assignments } = await supabase
                .from('teacher_assignments')
                .select('class_id, subject_id')
                .eq('teacher_id', user.id)

            const classIds = [...new Set((assignments ?? []).map((a: any) => a.class_id).filter(Boolean))]
            const subjectIds = [...new Set((assignments ?? []).map((a: any) => a.subject_id).filter(Boolean))]
            setAllowedClassIds(classIds)
            setAllowedSubjectIds(subjectIds)

            loadDocs(user.id)
        }
        init()
    }, [loadDocs])

    const filtered = docs.filter(d => {
        if (typeFilter !== 'all' && d.document_type !== typeFilter) return false
        if (search.trim()) {
            const q = search.toLowerCase()
            if (!d.name.toLowerCase().includes(q) && !(d.subject_name ?? '').toLowerCase().includes(q) && !(d.class_name ?? '').toLowerCase().includes(q)) return false
        }
        return true
    })

    const typeLabel = (type: string) => t(`teacher.documents.${type}`) || type

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
                                            <span className="text-muted-foreground text-[10px]">· {formatDate(doc.created_at)}</span>
                                        </div>
                                    </div>
                                </div>
                                {doc.file_url && (
                                    <a href={doc.file_url} title={doc.name} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-indigo-500 bg-indigo-500/10 hover:bg-indigo-500/20 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Download className="w-4 h-4" />
                                        </Button>
                                    </a>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

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
        </div>
    )
}
