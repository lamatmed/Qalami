'use client'

import { useState, useEffect } from 'react'
import { FileText, Download, MoreVertical, Folder, Search, Plus, Filter, Loader2, Book, Calendar, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useTeacher } from '@/context/teacher-context'
import { createClient } from '@/utils/supabase/client'
import { UploadDocumentDialog } from '@/components/admin/documents/upload-document-dialog'
import { useLanguage } from '@/i18n'

interface TeacherFile {
    id: string
    name: string
    file_url: string | null
    document_type: string
    subjectName: string | null
    subjectIcon: string | null
    className: string | null
    academic_year: string | null
    file_size_bytes: number | null
    created_at: string
}

const TYPE_COLORS: Record<string, { text: string; bg: string }> = {
    course: { text: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-500/10' },
    exercise: { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    exam: { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10' },
    devoirs: { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
    correction: { text: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10' },
    resource: { text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
    general: { text: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-500/10' },
}

interface Homework {
    id: string
    title: string
    description: string
    className: string
    subjectName: string
    dueDate: string
    maxPoints: number
    isPublished: boolean
    createdAt: string
    submissionCount: number
}

export function TeacherResources() {
    const { t, direction } = useLanguage()
    const { teacherId, loading } = useTeacher()
    const [homework, setHomework] = useState<Homework[]>([])
    const [loadingData, setLoadingData] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [showSearch, setShowSearch] = useState(false)

    useEffect(() => {
        async function fetchHomework() {
            if (!teacherId) return

            setLoadingData(true)
            const supabase = createClient()

            try {
                // Fetch homework created by this teacher
                const { data: homeworkData, error } = await supabase
                    .from('homework')
                    .select(`
                        id,
                        title,
                        description,
                        due_date,
                        max_points,
                        is_published,
                        created_at,
                        classes (name),
                        subjects (name)
                    `)
                    .eq('teacher_id', teacherId)
                    .order('created_at', { ascending: false })

                if (error) {
                    console.error('Error fetching homework:', error)
                    setHomework([])
                    return
                }

                if (homeworkData && homeworkData.length > 0) {
                    // Get submission counts for each homework
                    const homeworkWithCounts = await Promise.all(
                        homeworkData.map(async (hw) => {
                            const { count } = await supabase
                                .from('homework_submissions')
                                .select('*', { count: 'exact', head: true })
                                .eq('homework_id', hw.id)

                            return {
                                id: hw.id,
                                title: hw.title || t('teacher.quizzes.unassigned'),
                                description: hw.description || '',
                                className: (hw.classes as { name?: string })?.name || t('teacher.quizzes.unassigned'),
                                subjectName: (hw.subjects as { name?: string })?.name || t('teacher.quizzes.general'),
                                dueDate: hw.due_date || '',
                                maxPoints: hw.max_points || 0,
                                isPublished: hw.is_published || false,
                                createdAt: hw.created_at || '',
                                submissionCount: count || 0
                            }
                        })
                    )

                    setHomework(homeworkWithCounts)
                } else {
                    setHomework([])
                }
            } catch (err) {
                console.error('Error:', err)
                setHomework([])
            }

            setLoadingData(false)
        }

        if (!loading) {
            fetchHomework()
        }
    }, [teacherId, loading])

    // Resources (fiches tab)
    const [teacherFiles, setTeacherFiles] = useState<TeacherFile[]>([])
    const [filesLoading, setFilesLoading] = useState(false)
    const [uploadOpen, setUploadOpen] = useState(false)

    const fetchTeacherFiles = async () => {
        if (!teacherId) return
        setFilesLoading(true)
        const supabase = createClient()
        const { data } = await supabase
            .from('documents')
            .select('id, name, file_url, file_size_bytes, document_type, academic_year, created_at, subjects(name, icon), classes(name)')
            .eq('teacher_id', teacherId)
            .order('created_at', { ascending: false })
        setTeacherFiles((data || []).map((d: any) => ({
            id: d.id, name: d.name, file_url: d.file_url,
            document_type: d.document_type,
            subjectName: d.subjects?.name || null,
            subjectIcon: d.subjects?.icon || null,
            className: d.classes?.name || null,
            academic_year: d.academic_year,
            file_size_bytes: d.file_size_bytes,
            created_at: d.created_at,
        })))
        setFilesLoading(false)
    }

    useEffect(() => {
        if (!loading && teacherId) fetchTeacherFiles()
    }, [teacherId, loading])

    const filteredHomework = searchQuery
        ? homework.filter(h =>
            h.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            h.className.toLowerCase().includes(searchQuery.toLowerCase()) ||
            h.subjectName.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : homework

    const publishedHomework = filteredHomework.filter(h => h.isPublished)
    const draftHomework = filteredHomework.filter(h => !h.isPublished)

    const formatDueDate = (dateStr: string) => {
        if (!dateStr) return ''
        const date = new Date(dateStr)
        const now = new Date()
        const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

        if (diffDays < 0) return t('teacher.resources.dueDateLate')
        if (diffDays === 0) return t('teacher.resources.dueDateToday')
        if (diffDays === 1) return t('teacher.resources.dueDateTomorrow')
        if (diffDays < 7) return t('teacher.resources.dueDateDays', { count: diffDays })
        return date.toLocaleDateString(t('common.locale') || 'fr-FR', { day: 'numeric', month: 'short', timeZone: 'Africa/Nouakchott' })
    }

    const docTypeLabels: Record<string, string> = {
        course: t('teacher.resources.types.course'),
        exercise: t('teacher.resources.types.exercise'),
        exam: t('teacher.resources.types.exam'),
        devoirs: t('teacher.resources.types.devoirs'),
        correction: t('teacher.resources.types.correction'),
        resource: t('teacher.resources.types.resource'),
        general: t('teacher.resources.types.general'),
    }

    const getSubjectColor = (subject: string) => {
        const colors: Record<string, { text: string, bg: string }> = {
            'Mathématiques': { text: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
            'Français': { text: 'text-red-600', bg: 'bg-red-50 dark:bg-red-500/10' },
            'Arabe': { text: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
            'Physique-Chimie': { text: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-500/10' },
            'Histoire-Géo': { text: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10' },
        }
        return colors[subject] || { text: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-500/10' }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
        )
    }

    return (
        <div className="max-w-xl mx-auto space-y-6 pb-24 relative min-h-screen" dir={direction}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-black text-gray-900 dark:text-white">{t('teacher.resources.title')}</h1>
                <div className="flex gap-2">
                    <Button variant="ghost" size="icon" className="rounded-xl border border-gray-100 hover:bg-gray-50 h-10 w-10 text-gray-500" onClick={() => setShowSearch(!showSearch)}>
                        <Search className="w-5 h-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-xl border border-gray-100 hover:bg-gray-50 h-10 w-10 text-gray-500">
                        <Filter className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            {/* Search Bar */}
            {showSearch && (
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder={t('teacher.resources.searchPlaceholder')}
                        className="pl-11 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 focus-visible:ring-purple-600 focus-visible:border-purple-600"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                    />
                </div>
            )}

            {/* Tabs */}
            <Tabs defaultValue="contenus" className="w-full">
                <TabsList className="bg-gray-100/80 dark:bg-card/50 p-1 rounded-2xl w-full grid grid-cols-3 mb-6">
                    <TabsTrigger value="contenus" className="rounded-xl font-bold text-xs data-[state=active]:bg-purple-600 data-[state=active]:text-white transition-all">
                        {t('teacher.resources.tabHomework', { count: publishedHomework.length })}
                    </TabsTrigger>
                    <TabsTrigger value="brouillons" className="rounded-xl font-bold text-xs data-[state=active]:bg-purple-600 data-[state=active]:text-white transition-all">
                        {t('teacher.resources.tabDrafts', { count: draftHomework.length })}
                    </TabsTrigger>
                    <TabsTrigger value="fiches" className="rounded-xl font-bold text-xs data-[state=active]:bg-purple-600 data-[state=active]:text-white transition-all">
                        {t('teacher.resources.tabResources')}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="contenus" className="space-y-4">
                    {loadingData ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                        </div>
                    ) : publishedHomework.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground border border-gray-100 dark:border-white/5 bg-white dark:bg-slate-900 p-12 rounded-3xl">
                            <Book className="w-12 h-12 mx-auto mb-4 text-purple-600/30" />
                            <p className="font-bold text-gray-900 dark:text-white mb-1">{t('teacher.resources.noHomework')}</p>
                            <p className="text-xs">{t('teacher.resources.createFirstHomework')}</p>
                        </div>
                    ) : (
                        publishedHomework.map((hw, i) => {
                            const colors = getSubjectColor(hw.subjectName)
                            return (
                                <motion.div
                                    key={hw.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 p-4 rounded-3xl flex items-center justify-between group relative shadow-sm"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={cn("p-3 rounded-2xl shrink-0", colors.bg)}>
                                            <FileText className={cn("w-6 h-6", colors.text)} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-sm text-gray-900 dark:text-white line-clamp-1">{hw.title}</h3>
                                            <div className="flex flex-col mt-0.5">
                                                <span className="text-[11px] text-gray-400 font-bold flex items-center gap-1.5 flex-wrap">
                                                    {hw.className} • {hw.subjectName}
                                                </span>
                                                <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold mt-1 flex items-center gap-1">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    {formatDueDate(hw.dueDate)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-2 shrink-0">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg">
                                            <MoreVertical className="w-4 h-4" />
                                        </Button>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[9px] px-2 py-0.5 rounded-full font-bold border bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20">
                                                {t('teacher.resources.submissionsCount', { count: hw.submissionCount })}
                                            </span>
                                            <span className="text-[9px] px-2 py-0.5 rounded-full font-bold border bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20">
                                                {t('teacher.resources.points', { count: hw.maxPoints })}
                                            </span>
                                        </div>
                                    </div>
                                </motion.div>
                            )
                        })
                    )}
                </TabsContent>

                <TabsContent value="brouillons" className="space-y-4">
                    {loadingData ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                        </div>
                    ) : draftHomework.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground border border-gray-100 dark:border-white/5 bg-white dark:bg-slate-900 p-12 rounded-3xl">
                            <Folder className="w-12 h-12 mx-auto mb-4 text-purple-600/30" />
                            <p className="font-bold text-gray-900 dark:text-white">{t('teacher.resources.noDrafts')}</p>
                        </div>
                    ) : (
                        draftHomework.map((hw, i) => {
                            const colors = getSubjectColor(hw.subjectName)
                            return (
                                <motion.div
                                    key={hw.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 p-4 rounded-3xl flex items-center justify-between group shadow-sm opacity-80 hover:opacity-100 transition-opacity"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={cn("p-3 rounded-2xl shrink-0", colors.bg)}>
                                            <FileText className={cn("w-6 h-6", colors.text)} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-sm text-gray-900 dark:text-white line-clamp-1">{hw.title}</h3>
                                            <span className="text-[11px] text-gray-400 font-bold">
                                                {hw.className} • {t('teacher.resources.draft')}
                                            </span>
                                        </div>
                                    </div>
                                    <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold px-4 shrink-0 shadow-sm">
                                        {t('teacher.resources.publishBtn')}
                                    </Button>
                                </motion.div>
                            )
                        })
                    )}
                </TabsContent>

                <TabsContent value="fiches" className="space-y-4">
                    <UploadDocumentDialog
                        isOpen={uploadOpen}
                        onClose={() => setUploadOpen(false)}
                        onSuccess={fetchTeacherFiles}
                        defaultTeacherId={teacherId || undefined}
                    />

                    <div className="flex justify-end">
                        <Button onClick={() => setUploadOpen(true)} size="sm" className="bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs gap-1 shadow-sm">
                            <Plus className="w-3.5 h-3.5" /> {t('teacher.resources.publishFileBtn')}
                        </Button>
                    </div>

                    {filesLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                        </div>
                    ) : teacherFiles.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground border border-gray-100 dark:border-white/5 bg-white dark:bg-slate-900 p-12 rounded-3xl">
                            <BookOpen className="w-12 h-12 mx-auto mb-4 text-purple-600/30" />
                            <p className="font-bold text-gray-900 dark:text-white mb-1">{t('teacher.resources.noResources')}</p>
                            <p className="text-xs">{t('teacher.resources.noResourcesDesc')}</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {teacherFiles.map(doc => {
                                const typeStyle = TYPE_COLORS[doc.document_type] || TYPE_COLORS.general
                                return (
                                    <div key={doc.id} className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-2xl p-4 flex items-center gap-3 group hover:border-purple-200 dark:hover:border-purple-500/20 transition-all duration-300 shadow-sm">
                                        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", typeStyle.bg)}>
                                            {doc.subjectIcon ? <span className="text-base">{doc.subjectIcon}</span> : <FileText className={cn("w-5 h-5", typeStyle.text)} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{doc.name}</p>
                                            <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                                                <span className={cn("font-bold", typeStyle.text)}>{docTypeLabels[doc.document_type] || doc.document_type}</span>
                                                {doc.subjectName && ` · ${doc.subjectName}`}
                                                {doc.className && ` · ${doc.className}`}
                                            </p>
                                        </div>
                                        {doc.file_url && (
                                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-950 dark:hover:text-white rounded-lg">
                                                    <Download className="w-4 h-4" />
                                                </Button>
                                            </a>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Floating Action Button */}
            <div className="fixed bottom-24 right-6 lg:right-1/4 z-50">
                <Button size="icon" className="h-14 w-14 rounded-full bg-purple-600 hover:bg-purple-700 text-white shadow-xl shadow-purple-500/30 transition-all duration-300 hover:scale-105 active:scale-95">
                    <Plus className="w-6 h-6" />
                </Button>
            </div>
        </div>
    )
}
