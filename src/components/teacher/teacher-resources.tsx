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

const DOC_TYPE_LABELS: Record<string, string> = {
    course: 'Cours', exercise: 'Exercice', exam: 'Examen',
    devoirs: 'Devoirs', correction: 'Correction', resource: 'Ressource', general: 'Général',
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
                                title: hw.title || 'Sans titre',
                                description: hw.description || '',
                                className: (hw.classes as { name?: string })?.name || 'Classe',
                                subjectName: (hw.subjects as { name?: string })?.name || 'Matière',
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

        if (diffDays < 0) return 'En retard'
        if (diffDays === 0) return "Aujourd'hui"
        if (diffDays === 1) return 'Demain'
        if (diffDays < 7) return `Dans ${diffDays} jours`
        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    }

    const getSubjectColor = (subject: string) => {
        const colors: Record<string, { text: string, bg: string }> = {
            'Mathématiques': { text: 'text-indigo-500', bg: 'bg-indigo-500/10' },
            'Français': { text: 'text-red-500', bg: 'bg-red-500/10' },
            'Arabe': { text: 'text-emerald-500', bg: 'bg-emerald-500/10' },
            'Physique-Chimie': { text: 'text-blue-500', bg: 'bg-blue-500/10' },
            'Histoire-Géo': { text: 'text-amber-500', bg: 'bg-amber-500/10' },
        }
        return colors[subject] || { text: 'text-gray-500', bg: 'bg-gray-500/10' }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="max-w-xl mx-auto space-y-6 pb-24 relative min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Devoirs & Ressources</h1>
                <div className="flex gap-2">
                    <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setShowSearch(!showSearch)}>
                        <Search className="w-5 h-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-full">
                        <Filter className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            {/* Search Bar */}
            {showSearch && (
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Rechercher..."
                        className="pl-11 h-12 rounded-2xl bg-card border-none placeholder:text-muted-foreground/70"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                    />
                </div>
            )}

            {/* Tabs */}
            <Tabs defaultValue="contenus" className="w-full">
                <TabsList className="bg-card/50 p-1 rounded-xl w-full grid grid-cols-3 mb-6">
                    <TabsTrigger value="contenus" className="rounded-lg data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
                        Devoirs ({publishedHomework.length})
                    </TabsTrigger>
                    <TabsTrigger value="brouillons" className="rounded-lg data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
                        Brouillons ({draftHomework.length})
                    </TabsTrigger>
                    <TabsTrigger value="fiches" className="rounded-lg data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
                        Ressources
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="contenus" className="space-y-4">
                    {loadingData ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : publishedHomework.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Book className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>Aucun devoir publié</p>
                            <p className="text-sm mt-2">Créez votre premier devoir</p>
                        </div>
                    ) : (
                        publishedHomework.map((hw, i) => {
                            const colors = getSubjectColor(hw.subjectName)
                            return (
                                <motion.div
                                    key={hw.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="bg-card border border-border/50 p-4 rounded-3xl flex items-center justify-between group relative overflow-hidden"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={cn("p-3.5 rounded-2xl", colors.bg)}>
                                            <FileText className={cn("w-6 h-6", colors.text)} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-sm text-gray-100">{hw.title}</h3>
                                            <div className="flex flex-col">
                                                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                    <span className="w-1 h-1 bg-gray-500 rounded-full" />
                                                    {hw.className} • {hw.subjectName}
                                                </span>
                                                <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {formatDueDate(hw.dueDate)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-2">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                                            <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                        </Button>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] px-2 py-0.5 rounded-full font-medium border bg-blue-500/10 text-blue-400 border-blue-500/20">
                                                {hw.submissionCount} rendu(s)
                                            </span>
                                            <span className="text-[9px] px-2 py-0.5 rounded-full font-medium border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                                                /{hw.maxPoints} pts
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
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : draftHomework.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Folder className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>Aucun brouillon</p>
                        </div>
                    ) : (
                        draftHomework.map((hw, i) => {
                            const colors = getSubjectColor(hw.subjectName)
                            return (
                                <motion.div
                                    key={hw.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="bg-card border border-border/50 p-4 rounded-3xl opacity-70 hover:opacity-100 transition-opacity"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={cn("p-3.5 rounded-2xl", colors.bg)}>
                                            <FileText className={cn("w-6 h-6", colors.text)} />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-bold text-sm text-gray-300">{hw.title}</h3>
                                            <span className="text-[11px] text-muted-foreground">
                                                {hw.className} • Brouillon
                                            </span>
                                        </div>
                                        <Button variant="outline" size="sm" className="text-xs">
                                            Publier
                                        </Button>
                                    </div>
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
                        <Button onClick={() => setUploadOpen(true)} size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold gap-1">
                            <Plus className="w-3.5 h-3.5" /> Publier un fichier
                        </Button>
                    </div>

                    {filesLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : teacherFiles.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">
                            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>Aucune ressource publiée</p>
                            <p className="text-sm mt-2">Partagez vos cours, exercices et examens</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {teacherFiles.map(doc => {
                                const typeStyle = TYPE_COLORS[doc.document_type] || TYPE_COLORS.general
                                return (
                                    <div key={doc.id} className="bg-card border border-border/50 rounded-2xl p-4 flex items-center gap-3 group hover:border-white/10 transition-colors">
                                        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", typeStyle.bg)}>
                                            {doc.subjectIcon ? <span className="text-base">{doc.subjectIcon}</span> : <FileText className={cn("w-5 h-5", typeStyle.text)} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm truncate">{doc.name}</p>
                                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                                <span className={cn("font-bold", typeStyle.text)}>{DOC_TYPE_LABELS[doc.document_type] || doc.document_type}</span>
                                                {doc.subjectName && ` · ${doc.subjectName}`}
                                                {doc.className && ` · ${doc.className}`}
                                            </p>
                                        </div>
                                        {doc.file_url && (
                                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
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
            <div className="fixed bottom-24 right-6 lg:right-1/4">
                <Button size="icon" className="h-14 w-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl shadow-emerald-500/30">
                    <Plus className="w-6 h-6" />
                </Button>
            </div>
        </div>
    )
}
