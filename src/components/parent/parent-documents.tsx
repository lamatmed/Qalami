'use client'

import { useState, useEffect } from 'react'
import { Search, Download, FileText, Loader2, Folder, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useParent } from '@/context/parent-context'
import { createClient } from '@/utils/supabase/client'
import { useLanguage } from '@/i18n'

interface ClassDocument {
    id: string
    name: string
    file_url: string | null
    file_type: string | null
    document_type: string
    subjectName: string | null
    subjectIcon: string | null
    academic_year: string | null
    created_at: string
}

const TYPE_COLORS: Record<string, { text: string; bg: string }> = {
    course: { text: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    exercise: { text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    exam: { text: 'text-red-400', bg: 'bg-red-500/10' },
    devoirs: { text: 'text-amber-400', bg: 'bg-amber-500/10' },
    correction: { text: 'text-purple-400', bg: 'bg-purple-500/10' },
    resource: { text: 'text-blue-400', bg: 'bg-blue-500/10' },
    general: { text: 'text-gray-400', bg: 'bg-gray-500/10' },
}

export function ParentDocuments() {
    const { selectedChild, loading } = useParent()
    const { t } = useLanguage()
    const [documents, setDocuments] = useState<ClassDocument[]>([])
    const [loadingDocs, setLoadingDocs] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [typeFilter, setTypeFilter] = useState<string>('all')

    useEffect(() => {
        async function fetchDocuments() {
            if (!selectedChild) return
            setLoadingDocs(true)

            const supabase = createClient()
            // Find the child's active enrollment to get class_id
            const { data: enrollment } = await supabase
                .from('enrollments')
                .select('class_id')
                .eq('student_id', selectedChild.id)
                .eq('status', 'active')
                .maybeSingle()

            if (!enrollment?.class_id) {
                setLoadingDocs(false)
                return
            }

            const { data } = await supabase
                .from('documents')
                .select('id, name, file_url, file_type, document_type, academic_year, created_at, subjects(name, icon)')
                .eq('class_id', enrollment.class_id)
                .in('document_type', ['course', 'exercise', 'exam', 'devoirs', 'correction', 'resource', 'general'])
                .order('created_at', { ascending: false })

            const mapped: ClassDocument[] = (data || []).map((d: any) => ({
                id: d.id,
                name: d.name,
                file_url: d.file_url,
                file_type: d.file_type,
                document_type: d.document_type,
                subjectName: d.subjects?.name || null,
                subjectIcon: d.subjects?.icon || null,
                academic_year: d.academic_year,
                created_at: d.created_at,
            }))

            setDocuments(mapped)
            setLoadingDocs(false)
        }

        fetchDocuments()
    }, [selectedChild])

    const getDocTypeLabel = (type: string) => {
        return t(`parent.documents.${type}`) || type
    }

    const filtered = documents.filter(d => {
        if (typeFilter !== 'all' && d.document_type !== typeFilter) return false
        if (searchQuery && !d.name.toLowerCase().includes(searchQuery.toLowerCase()) && !(d.subjectName || '').toLowerCase().includes(searchQuery.toLowerCase())) return false
        return true
    })

    // Group by subject
    const grouped = filtered.reduce((acc, doc) => {
        const key = doc.subjectName || t('parent.documents.general')
        if (!acc[key]) acc[key] = { icon: doc.subjectIcon, docs: [] }
        acc[key].docs.push(doc)
        return acc
    }, {} as Record<string, { icon: string | null; docs: ClassDocument[] }>)

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!selectedChild) {
        return (
            <div className="max-w-md mx-auto lg:max-w-3xl lg:ms-12 lg:me-auto p-4">
                <div className="bg-card border border-border rounded-3xl p-6 text-center">
                    <p className="text-muted-foreground">{t('parent.documents.noChild')}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-md mx-auto lg:max-w-3xl lg:ms-12 lg:me-auto pb-24 space-y-6 p-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-bold text-xl">{t('parent.documents.title')}</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">{selectedChild.name} · {selectedChild.class}</p>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                    placeholder={t('parent.documents.searchPlaceholder')}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 rtl:pl-3 rtl:pr-9 h-10 bg-card border-border/50"
                />
            </div>

            {/* Type filter pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {(['all', 'course', 'exercise', 'exam', 'devoirs', 'correction', 'resource'] as const).map(tFilter => (
                    <button
                        key={tFilter}
                        onClick={() => setTypeFilter(tFilter)}
                        className={cn(
                            "shrink-0 px-3 py-1 rounded-lg text-xs font-bold border transition-colors",
                            typeFilter === tFilter
                                ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                                : "bg-card border-border/50 text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {tFilter === 'all' ? t('parent.documents.all') : getDocTypeLabel(tFilter)}
                    </button>
                ))}
            </div>

            {loadingDocs ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
            ) : Object.keys(grouped).length === 0 ? (
                <div className="bg-card border border-border/50 rounded-3xl p-8 text-center">
                    <Folder className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
                    <p className="text-muted-foreground text-sm">
                        {documents.length === 0
                            ? t('parent.documents.emptyClass')
                            : t('parent.documents.emptySearch')}
                    </p>
                    {documents.length === 0 && (
                        <p className="text-xs text-muted-foreground mt-2">{t('parent.documents.teacherNotice')}</p>
                    )}
                </div>
            ) : (
                Object.entries(grouped).map(([subject, { icon, docs }]) => (
                    <div key={subject} className="space-y-3">
                        <div className="flex items-center gap-2 px-1">
                            {icon ? (
                                <span className="text-base">{icon}</span>
                            ) : (
                                <BookOpen className="w-4 h-4 text-muted-foreground" />
                            )}
                            <h2 className="font-bold text-sm">{subject}</h2>
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {docs.length}
                            </span>
                        </div>

                        <div className="space-y-2">
                            {docs.map(doc => {
                                const typeStyle = TYPE_COLORS[doc.document_type] || TYPE_COLORS.general
                                return (
                                    <div key={doc.id} className="bg-card border border-border/50 p-4 rounded-2xl flex items-center justify-between group hover:border-cyan-500/30 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", typeStyle.bg)}>
                                                <FileText className={cn("w-5 h-5", typeStyle.text)} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-sm text-foreground truncate max-w-[180px]">{doc.name}</h3>
                                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                                    <span className={cn("font-bold", typeStyle.text)}>{getDocTypeLabel(doc.document_type)}</span>
                                                    {doc.academic_year && ` · ${doc.academic_year}`}
                                                </p>
                                            </div>
                                        </div>
                                        {doc.file_url && (
                                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                                                <Button variant="ghost" size="icon" className="h-10 w-10 text-cyan-500 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20">
                                                    <Download className="w-5 h-5" />
                                                </Button>
                                            </a>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))
            )}
        </div>
    )
}
