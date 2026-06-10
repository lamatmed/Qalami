'use client'

import { useState, useTransition, useEffect } from 'react'
import {
    Search,
    MessageSquare,
    Info,
    ArrowLeft,
    CheckCircle2,
    Check,
    Clock,
    X,
    Loader2,
    Calendar,
    Award,
    BarChart3,
    Users,
    GraduationCap,
    Edit3,
    Save,
    Plus,
    Edit2,
    Trash2,
    Paperclip,
    FileText,
    Send,
    BookOpen,
    Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from '@/components/ui/progress'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n'
import {
    loadGradesAction,
    loadScheduleAction,
    loadAttendanceHistoryAction,
    loadTeacherSubjectsAction,
    saveAttendanceAction,
    saveGradesAction,
    loadActiveSessionAttendanceAction,
    updateGradeAction,
    deleteGradeAction,
    loadPostsAction,
    createPostAction,
    deletePostAction,
    type SubjectPost,
} from '@/app/teacher/classes/[classId]/actions'

interface Student {
    id: string
    full_name: string
    avatar_url?: string
    national_id?: string | null
}

interface Grade {
    id: string
    student_id: string
    class_id: string
    value: number
    max_value: number | null
    assessment_type: string
    subject_id: string
    teacher_id: string | null
    term_id: string | null
    created_at: string | null
    subject_name?: string
}

interface ScheduleSlot {
    id: string
    day_of_week: number
    start_time: string
    end_time: string
    subject: { name: string } | null
    room: string | null
}

interface ClassDetailsProps {
    classId: string
    className: string
    students: Student[]
}

type AttendanceStatus = 'present' | 'late' | 'absent'

export function ClassDetails({ classId, className, students }: ClassDetailsProps) {
    const { t, direction } = useLanguage()
    const DAYS = [
        t('teacher.classes.details.days.0') || 'Dimanche',
        t('teacher.classes.details.days.1') || 'Lundi',
        t('teacher.classes.details.days.2') || 'Mardi',
        t('teacher.classes.details.days.3') || 'Mercredi',
        t('teacher.classes.details.days.4') || 'Jeudi',
        t('teacher.classes.details.days.5') || 'Vendredi',
        t('teacher.classes.details.days.6') || 'Samedi',
    ]
    const EXAM_TYPES = [
        { value: 'devoir', label: t('teacher.classes.details.devoir') || 'Devoir' },
        { value: 'examen', label: t('teacher.classes.details.examen') || 'Examen' },
    ]

    const supabase = createClient()
    const [isPending, startTransition] = useTransition()
    const [searchQuery, setSearchQuery] = useState('')
    const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>(
        students.reduce((acc, student) => ({ ...acc, [student.id]: 'present' }), {})
    )

    // State for Notes tab
    const [grades, setGrades] = useState<Grade[]>([])
    const [loadingGrades, setLoadingGrades] = useState(false)
    const [selectedExamType, setSelectedExamType] = useState<string>('all')
    const [editingGradeId, setEditingGradeId] = useState<string | null>(null)
    const [editValue, setEditValue] = useState<string>('')
    const [addingGrade, setAddingGrade] = useState(false)
    const [newGrade, setNewGrade] = useState({ 
        examType: 'devoir', 
        subjectId: '', 
        grades: {} as Record<string, string>, 
        bonuses: {} as Record<string, string> 
    })

    // State for teacher's subjects in this class
    const [teacherSubjects, setTeacherSubjects] = useState<{ id: string; name: string }[]>([])
    const [currentTermId, setCurrentTermId] = useState<string | null>(null)
    const [currentTerm, setCurrentTerm] = useState<{ id: string; name: string; label_fr: string } | null>(null)

    // State for Planning tab
    const [schedule, setSchedule] = useState<ScheduleSlot[]>([])
    const [loadingSchedule, setLoadingSchedule] = useState(false)

    // State for Stats
    const [attendanceHistory, setAttendanceHistory] = useState<any[]>([])
    const [loadingStats, setLoadingStats] = useState(false)

    // State for Publications tab
    const [posts, setPosts] = useState<SubjectPost[]>([])
    const [loadingPosts, setLoadingPosts] = useState(false)
    const [showPostForm, setShowPostForm] = useState(false)
    const [postForm, setPostForm] = useState({ title: '', content: '', post_type: 'cours', subject_id: '' })
    const [postFile, setPostFile] = useState<File | null>(null)
    const [submittingPost, setSubmittingPost] = useState(false)
    const [deletingPostId, setDeletingPostId] = useState<string | null>(null)
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)

    const filteredStudents = students.filter(s =>
        s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.national_id && s.national_id.toLowerCase().includes(searchQuery.toLowerCase()))
    )

    const stats = {
        present: Object.values(attendance).filter(s => s === 'present').length,
        late: Object.values(attendance).filter(s => s === 'late').length,
        absent: Object.values(attendance).filter(s => s === 'absent').length,
        total: students.length
    }

    const attendancePercentage = Math.round((stats.present / stats.total) * 100) || 0

    // Load grades for the class
    const loadGrades = async () => {
        setLoadingGrades(true)
        try {
            const data = await loadGradesAction(classId)
            setGrades(data)
        } catch (error) {
            console.error('Error loading grades:', error)
        } finally {
            setLoadingGrades(false)
        }
    }

    // Load schedule for the class
    const loadSchedule = async () => {
        setLoadingSchedule(true)
        try {
            const data = await loadScheduleAction(classId)
            setSchedule(data)
        } catch (error) {
            console.error('Error loading schedule:', error)
        } finally {
            setLoadingSchedule(false)
        }
    }

    // Load attendance history for stats
    const loadAttendanceHistory = async () => {
        setLoadingStats(true)
        try {
            const data = await loadAttendanceHistoryAction(classId)
            setAttendanceHistory(data)
        } catch (error) {
            console.error('Error loading attendance history:', error)
        } finally {
            setLoadingStats(false)
        }
    }

    // Load publications for this class
    const loadPosts = async () => {
        setLoadingPosts(true)
        try {
            const data = await loadPostsAction(classId)
            setPosts(data)
        } catch (error) {
            console.error('Error loading posts:', error)
        } finally {
            setLoadingPosts(false)
        }
    }

    const handleCreatePost = async () => {
        if (!postForm.content.trim()) return
        setSubmittingPost(true)
        try {
            let attachments: { file_url: string; file_name: string; file_type: string }[] = []
            if (postFile) {
                const fd = new FormData()
                fd.append('file', postFile)
                fd.append('classId', classId)
                const res = await fetch('/api/teacher/upload-post-attachment', { method: 'POST', body: fd })
                const json = await res.json()
                if (json.publicUrl) {
                    attachments = [{ file_url: json.publicUrl, file_name: json.fileName, file_type: json.fileType }]
                }
            }
            await createPostAction(classId, {
                title: postForm.title || undefined,
                content: postForm.content,
                post_type: postForm.post_type,
                subject_id: postForm.subject_id || null,
            }, attachments)
            setPostForm({ title: '', content: '', post_type: 'cours', subject_id: '' })
            setPostFile(null)
            setShowPostForm(false)
            await loadPosts()
        } catch (error) {
            console.error('Error creating post:', error)
        } finally {
            setSubmittingPost(false)
        }
    }

    const handleDeletePost = async (postId: string) => {
        setDeletingPostId(postId)
        try {
            await deletePostAction(postId, classId)
            setPosts(prev => prev.filter(p => p.id !== postId))
        } catch (error) {
            console.error('Error deleting post:', error)
        } finally {
            setDeletingPostId(null)
        }
    }

    // Load teacher's subjects for this class + current term
    const loadTeacherSubjects = async () => {
        try {
            const result = await loadTeacherSubjectsAction(classId)
            
            setCurrentTermId(result.termId)
            setCurrentTerm((result as any).currentTerm || null)
            setTeacherSubjects(result.subjects || [])
            
            if (result.subjects && result.subjects.length > 0) {
                setNewGrade(prev => ({ ...prev, subjectId: result.subjects[0].id }))
                setPostForm(prev => prev.subject_id ? prev : ({ ...prev, subject_id: result.subjects[0].id }))
            }
        } catch (error) {
            console.error('Error loading teacher subjects:', error)
        }
    }

    // Fetch and hydrate already stored attendance for today's active session
    const loadActiveAttendance = async () => {
        try {
            const activeRecords = await loadActiveSessionAttendanceAction(classId)
            if (activeRecords && activeRecords.length > 0) {
                setAttendance(prev => {
                    const next = { ...prev }
                    activeRecords.forEach((r: any) => {
                        next[r.student_id] = r.status as AttendanceStatus
                    })
                    return next
                })
            }
        } catch (error) {
            console.error('Error loading active session attendance:', error)
        }
    }

    useEffect(() => {
        loadGrades()
        loadSchedule()
        loadAttendanceHistory()
        loadTeacherSubjects()
        loadActiveAttendance()
        loadPosts()
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) setCurrentUserId(user.id)
        })
    }, [classId])

    // Synchronize the grade insertion form with the top filter selection
    useEffect(() => {
        if (selectedExamType !== 'all') {
            setNewGrade(prev => ({ ...prev, examType: selectedExamType }))
        }
    }, [selectedExamType])

    const toggleStatus = (studentId: string, status: AttendanceStatus) => {
        setAttendance(prev => ({ ...prev, [studentId]: status }))
    }

    const handleSaveAttendance = () => {
        startTransition(async () => {
            try {
                const today = new Date().toISOString().split('T')[0]

                const records = Object.entries(attendance).map(([studentId, status]) => ({
                    student_id: studentId,
                    class_id: classId,
                    date: today,
                    status: status,
                }))

                const res = await saveAttendanceAction(records)

                if (res && !res.success) {
                    let errMsg = (res as any).error || t('teacher.classes.details.saveError') || 'Erreur lors de l\'enregistrement'
                    
                    if ((res as any).errorType === 'no_schedule_for_day') {
                        const params = (res as any).errorParams
                        const dayTranslation = t(`teacher.classes.details.days.${params.dayOfWeek}`) || params.day
                        errMsg = t('teacher.classes.details.noScheduleForDayError')
                            ?.replace('{day}', dayTranslation)
                            || `Action bloquée : Aucun cours n'est planifié pour vous le ${dayTranslation} dans cette classe. Veuillez configurer l'emploi du temps.`
                    } else if ((res as any).errorType === 'out_of_schedule_hours') {
                        const params = (res as any).errorParams
                        const dayTranslation = t(`teacher.classes.details.days.${params.dayOfWeek}`) || params.day
                        errMsg = t('teacher.classes.details.outOfScheduleHoursError')
                            ?.replace('{hour}', params.hour)
                            ?.replace('{day}', dayTranslation)
                            ?.replace('{slots}', params.slots)
                            || `Hors planning : Il est ${params.hour} (${dayTranslation}). Vos séances aujourd'hui sont prévues à : ${params.slots}. (Marge acceptée : 15 min avant / 30 min après).`
                    }
                    
                    toast.error(errMsg, { duration: 6000 })
                    return
                }

                toast.success(t('teacher.classes.details.attendanceSaved')?.replace('{count}', records.length.toString()) || `Présences enregistrées pour ${records.length} élèves`)
                loadAttendanceHistory()
            } catch (error) {
                console.error('Error saving attendance:', error)
                const msg = error instanceof Error ? error.message : (t('teacher.classes.details.saveError') || 'Erreur lors de l\'enregistrement')
                toast.error(msg, { duration: 5000 }) // Extra visibility for validation failures
            }
        })
    }

    // Save new grades
    const handleSaveNewGrades = async () => {
        try {
            const gradesToInsert: any[] = []
            
            for (const [studentId, baseStr] of Object.entries(newGrade.grades)) {
                if (!baseStr || isNaN(parseFloat(baseStr))) continue
                
                const baseVal = parseFloat(baseStr)
                const bonusStr = (newGrade.bonuses as Record<string, string>)?.[studentId] || '0'
                const bonusVal = isNaN(parseFloat(bonusStr)) ? 0 : parseFloat(bonusStr)
                
                const totalVal = baseVal + bonusVal
                
                if (totalVal > 20) {
                    const studentName = students.find(s => s.id === studentId)?.full_name || 'L\'élève'
                    toast.error(t('teacher.classes.details.maxGradeError')?.replace('{name}', studentName).replace('{val}', totalVal.toFixed(1)) || `Attention : La note totale de ${studentName} ne peut pas dépasser 20/20 (Actuellement : ${totalVal.toFixed(1)})`, { duration: 5000 })
                    return
                }
                
                gradesToInsert.push({
                    student_id: studentId,
                    class_id: classId,
                    subject_id: newGrade.subjectId,
                    value: totalVal,
                    max_value: 20,
                    assessment_type: newGrade.examType,
                    term_id: currentTermId,
                })
            }

            if (!newGrade.subjectId) {
                toast.error(t('teacher.classes.details.selectSubjectError') || 'Veuillez sélectionner une matière')
                return
            }

            // Real-time UI Validation: Max 1 Exam ('examen') per student/subject/term
            if (newGrade.examType === 'examen') {
                const existingExamStudentIds = grades
                    .filter(g => g.term_id === currentTermId && g.subject_id === newGrade.subjectId && g.assessment_type === 'examen')
                    .map(g => g.student_id)

                const studentIdsWithViolations = gradesToInsert
                    .filter(g => existingExamStudentIds.includes(g.student_id))
                    .map(g => g.student_id)

                if (studentIdsWithViolations.length > 0) {
                    const violatedNames = studentIdsWithViolations
                        .map(id => students.find(s => s.id === id)?.full_name)
                        .filter(Boolean)
                        .join(', ')
                    toast.error((t('teacher.classes.details.examDuplicatePolicyError') || "Politique scolaire : L'examen a déjà été saisi pour ce trimestre dans cette matière pour : {names}").replace('{names}', violatedNames), { duration: 7000 })
                    return
                }
            }

            if (gradesToInsert.length === 0) {
                toast.error(t('teacher.classes.details.emptyGradesError') || 'Veuillez saisir au moins une note')
                return
            }

            const res = await saveGradesAction(gradesToInsert)

            if (res && !res.success) {
                toast.error(res.error || t('teacher.classes.details.saveError') || 'Erreur lors de l\'enregistrement', { duration: 5000 })
                return
            }

            toast.success(t('teacher.classes.details.gradesSavedSuccess')?.replace('{count}', gradesToInsert.length.toString()) || `${gradesToInsert.length} notes enregistrées`)
            setAddingGrade(false)
            setNewGrade({ examType: 'devoir', subjectId: teacherSubjects[0]?.id || '', grades: {}, bonuses: {} })
            loadGrades()
        } catch (error) {
            console.error('Error saving grades:', error)
            const msg = error instanceof Error ? error.message : (t('teacher.classes.details.saveError') || 'Erreur lors de l\'enregistrement')
            toast.error(msg)
        }
    }

    // Handle updating an existing grade value
    const handleUpdateGrade = async (gradeId: string) => {
        const newVal = parseFloat(editValue)
        if (isNaN(newVal) || newVal < 0 || newVal > 20) {
            toast.error(t('teacher.classes.details.invalidGradeRangeError') || "La note doit être un nombre valide compris entre 0 et 20")
            return
        }

        try {
            const res = await updateGradeAction(gradeId, newVal)
            if (res && !res.success) {
                toast.error(res.error || t('teacher.classes.details.editError') || "Erreur lors de la modification")
                return
            }
            toast.success(t('teacher.classes.details.gradeUpdatedSuccess') || "Note modifiée avec succès")
            setEditingGradeId(null)
            loadGrades()
        } catch (error) {
            console.error('Error updating grade:', error)
            toast.error(t('teacher.classes.details.techEditError') || "Erreur technique lors de la modification")
        }
    }

    // Handle deleting a grade
    const handleDeleteGrade = async (gradeId: string) => {
        if (!confirm(t('teacher.classes.details.confirmDeleteGrade') || "Voulez-vous vraiment supprimer cette note ? Cette action est irréversible.")) {
            return
        }

        try {
            const res = await deleteGradeAction(gradeId)
            if (res && !res.success) {
                toast.error(res.error || t('teacher.classes.details.deleteError') || "Erreur lors de la suppression")
                return
            }
            toast.success(t('teacher.classes.details.gradeDeletedSuccess') || "Note supprimée définitivement")
            loadGrades()
        } catch (error) {
            console.error('Error deleting grade:', error)
            toast.error(t('teacher.classes.details.techDeleteError') || "Erreur technique lors de la suppression")
        }
    }

    // Calculate student averages filtered by current active term
    const getStudentAverage = (studentId: string) => {
        const termGrades = currentTermId 
            ? grades.filter(g => g.student_id === studentId && g.term_id === currentTermId)
            : grades.filter(g => g.student_id === studentId)

        if (termGrades.length === 0) return null
        const sum = termGrades.reduce((acc, g) => acc + g.value, 0)
        return (sum / termGrades.length).toFixed(1)
    }

    // Get class average filtered by current active term
    const getClassAverage = () => {
        const termGrades = currentTermId 
            ? grades.filter(g => g.term_id === currentTermId)
            : grades

        if (termGrades.length === 0) return null
        const sum = termGrades.reduce((acc, g) => acc + g.value, 0)
        return (sum / termGrades.length).toFixed(1)
    }

    // Group schedule by day
    const scheduleByDay = DAYS.map((day, idx) => ({
        day,
        slots: schedule.filter(s => s.day_of_week === idx)
    })).filter(d => d.slots.length > 0)

    // Format time
    const formatTime = (time: string) => {
        return time.substring(0, 5)
    }

    return (
        <div className="max-w-md mx-auto lg:max-w-3xl pb-24 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <Link href="/teacher/classes">
                    <Button variant="ghost" size="icon" className="rounded-full">
                        <ArrowLeft className={cn("w-6 h-6", direction === 'rtl' && "rotate-180")} />
                    </Button>
                </Link>
                <div className="text-center">
                    <h1 className="text-xl font-bold">{className}</h1>
                    <p className="text-xs text-muted-foreground">2025-2026</p>
                </div>
                <Button variant="ghost" className="text-primary text-sm font-medium">
                    {t('common.edit') || 'Modifier'}
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-card border border-border/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
                    <span className="text-3xl font-bold text-white">{students.length}</span>
                    <span className="text-[10px] uppercase text-muted-foreground mt-1 tracking-wider">{t('common.students') || 'Élèves'}</span>
                </div>
                <div className="bg-card border border-border/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
                    <span className="text-3xl font-bold text-emerald-500">{attendancePercentage}%</span>
                    <span className="text-[10px] uppercase text-muted-foreground mt-1 tracking-wider">{t('common.attendance') || 'Présence'}</span>
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="eleves" className="w-full">
                <TabsList className="w-full bg-transparent border-b border-white/10 p-0 justify-between h-auto rounded-none">
                    {[
                        { value: 'eleves', label: t('common.students') || 'Élèves' },
                        { value: 'notes', label: t('teacher.classes.details.notes') || 'Notes' },
                        { value: 'stats', label: t('teacher.classes.details.stats') || 'Stats' },
                        { value: 'presences', label: t('common.attendance') || 'Présences' },
                        { value: 'planning', label: t('common.schedule') || 'Planning' },
                        { value: 'publications', label: 'Publications' }
                    ].map((tab) => (
                        <TabsTrigger
                            key={tab.value}
                            value={tab.value}
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary pb-3 px-1 text-xs uppercase bg-transparent"
                        >
                            {tab.label}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {/* Content: Élèves */}
                <TabsContent value="eleves" className="space-y-4 mt-6">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder={t('teacher.classes.details.searchPlaceholder') || "Rechercher un élève..."}
                            className="pl-10 h-12 rounded-xl bg-card border-border/50"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="space-y-3">
                        {filteredStudents.map((student, idx) => (
                            <div
                                key={student.id}
                                className="bg-card p-3 rounded-2xl flex items-center justify-between group border border-border/50 hover:border-primary/30 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <Avatar className="h-10 w-10 border border-border/50">
                                            <AvatarImage src={student.avatar_url} />
                                            <AvatarFallback>{student.full_name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-sm text-gray-200">
                                            {student.full_name}
                                            {student.national_id && <span className="text-[10px] ml-2 text-slate-950 dark:text-white font-black font-mono bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded">({student.national_id})</span>}
                                        </h3>
                                        <p className="text-[10px] text-muted-foreground">
                                            {t('teacher.classes.details.average') || 'Moyenne'}: {getStudentAverage(student.id) || 'N/A'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-white rounded-xl bg-white/5 hover:bg-white/10">
                                        <MessageSquare className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-white rounded-xl bg-white/5 hover:bg-white/10">
                                        <Info className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </TabsContent>

                {/* Content: Notes */}
                <TabsContent value="notes" className="space-y-4 mt-6">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder={t('teacher.classes.details.searchPlaceholder') || "Rechercher un élève..."}
                            className="pl-10 h-12 rounded-xl bg-card border-border/50"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Header with actions */}
                    <div className="flex items-center justify-between">
                        <Select value={selectedExamType} onValueChange={setSelectedExamType}>
                            <SelectTrigger className="w-40 bg-card border-border/50">
                                <SelectValue placeholder={t('common.type') || "Type"} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('teacher.classes.details.allTypes') || "Tous les types"}</SelectItem>
                                {EXAM_TYPES.map(type => (
                                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            onClick={() => setAddingGrade(!addingGrade)}
                            size="sm"
                            className="gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            {t('teacher.classes.details.newGrade') || "Nouvelle Note"}
                        </Button>
                    </div>

                    {/* Current Term Badge */}
                    {currentTerm && (
                        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 rounded-xl text-amber-500 text-xs sm:text-sm font-medium">
                            <Award className="w-4 h-4 shrink-0 animate-pulse" />
                            <span>{t('teacher.classes.details.activePeriod') || "Période Active"} : <strong className="font-bold">{direction === 'rtl' ? (currentTerm.label_ar || currentTerm.name) : (currentTerm.label_fr || currentTerm.name)}</strong></span>
                        </div>
                    )}

                    {/* Class average card */}
                    <div className="bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/20 rounded-lg">
                                    <GraduationCap className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">{t('teacher.classes.details.classAverage') || "Moyenne de classe"}</p>
                                    <p className="text-2xl font-bold">{getClassAverage() || 'N/A'}/20</p>
                                </div>
                            </div>
                            <div className="text-right text-sm text-muted-foreground">
                                <p>{t('teacher.classes.details.notesCount')?.replace('{count}', grades.length.toString()) || `${grades.length} notes`}</p>
                                 <p>{t('teacher.classes.details.studentsCount')?.replace('{count}', students.length.toString()) || `${students.length} élèves`}</p>
                            </div>
                        </div>
                    </div>

                    {/* Add new grades form */}
                    {addingGrade && (
                        <Card className="bg-card border-primary/30">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Edit3 className="w-4 h-4" />
                                    {t('teacher.classes.details.gradeEntry') || "Saisie des notes"}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className={selectedExamType === 'all' ? 'col-span-1' : 'col-span-2'}>
                                        <Select
                                            value={newGrade.subjectId}
                                            onValueChange={(v) => setNewGrade(prev => ({ ...prev, subjectId: v }))}
                                        >
                                            <SelectTrigger className="bg-background w-full">
                                                <SelectValue placeholder={t('teacher.classes.details.subject') || "Matière"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {teacherSubjects.map(subject => (
                                                    <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    
                                    {selectedExamType === 'all' && (
                                        <div className="col-span-1">
                                            <Select
                                                value={newGrade.examType}
                                                onValueChange={(v) => setNewGrade(prev => ({ ...prev, examType: v }))}
                                            >
                                                <SelectTrigger className="bg-background w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {EXAM_TYPES.map(type => (
                                                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                    {filteredStudents.map(student => (
                                        <div key={student.id} className="flex items-center gap-2 border-b border-border/20 pb-1 last:border-0">
                                            <span className="text-xs sm:text-sm flex-1 truncate text-muted-foreground font-medium">
                                                {student.full_name} {student.national_id && <span className="text-[10px] text-slate-950 dark:text-white font-bold font-mono bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded ml-1.5">({student.national_id})</span>}
                                            </span>
                                            <Input
                                                type="number"
                                                min="0"
                                                max="20"
                                                step="0.5"
                                                placeholder={t('teacher.classes.details.grade') || "Note"}
                                                className="w-[70px] h-8 text-center text-xs sm:text-sm"
                                                value={newGrade.grades[student.id] || ''}
                                                onChange={(e) => setNewGrade(prev => ({
                                                    ...prev,
                                                    grades: { ...prev.grades, [student.id]: e.target.value }
                                                }))}
                                            />
                                            <span className="text-muted-foreground text-xs">+</span>
                                            <Input
                                                type="number"
                                                min="0"
                                                max="20"
                                                step="0.5"
                                                placeholder={t('teacher.classes.details.bonus') || "Bonus"}
                                                className="w-[70px] h-8 text-center text-xs sm:text-sm bg-amber-500/5 border-amber-500/20 placeholder:text-amber-500/40 text-amber-500 focus-visible:ring-amber-500"
                                                value={(newGrade.bonuses as Record<string, string>)?.[student.id] || ''}
                                                onChange={(e) => setNewGrade(prev => ({
                                                    ...prev,
                                                    bonuses: { ...prev.bonuses as Record<string, string>, [student.id]: e.target.value }
                                                }))}
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-2">
                                    <Button variant="outline" className="flex-1" onClick={() => setAddingGrade(false)}>
                                        {t('common.cancel')}
                                    </Button>
                                    <Button className="flex-1 gap-2" onClick={handleSaveNewGrades}>
                                        <Save className="w-4 h-4" />
                                        {t('common.save')}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Student grades list */}
                    {loadingGrades ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredStudents.map(student => {
                                const studentGrades = grades
                                    .filter(g => g.student_id === student.id)
                                    .filter(g => !currentTermId || g.term_id === currentTermId)
                                    .filter(g => selectedExamType === 'all' || g.assessment_type === selectedExamType)
                                const avg = getStudentAverage(student.id)

                                return (
                                    <div key={student.id} className="bg-card p-4 rounded-xl border border-border/50">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarFallback>{student.full_name.substring(0, 2)}</AvatarFallback>
                                                </Avatar>
                                                <span className="font-medium text-sm">
                                                    {student.full_name} {student.national_id && <span className="text-[10px] text-slate-950 dark:text-white font-bold font-mono bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded ml-1.5">({student.national_id})</span>}
                                                </span>
                                            </div>
                                            <div className={cn(
                                                "px-2 py-1 rounded-lg text-sm font-bold",
                                                avg && parseFloat(avg) >= 10 ? "bg-emerald-500/20 text-emerald-500" :
                                                    avg ? "bg-red-500/20 text-red-500" : "bg-muted text-muted-foreground"
                                            )}>
                                                {avg || 'N/A'}/20
                                            </div>
                                        </div>
                                        {studentGrades.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {studentGrades.map(g => (
                                                    editingGradeId === g.id ? (
                                                        <div key={g.id} className="flex items-center gap-1 bg-muted border border-border pl-2 pr-1 py-0.5 rounded-lg animate-in zoom-in-95 duration-100">
                                                            <span className="text-xs font-semibold shrink-0 capitalize text-muted-foreground">
                                                                {g.subject_name ? `${g.subject_name} (${g.assessment_type}):` : `${g.assessment_type}:`}
                                                            </span>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                max="20"
                                                                step="0.5"
                                                                className="w-[60px] h-6 text-xs px-1 text-center bg-background border-border/60 font-bold"
                                                                value={editValue}
                                                                onChange={(e) => setEditValue(e.target.value)}
                                                                autoFocus
                                                            />
                                                            <Button 
                                                                size="icon" 
                                                                variant="ghost" 
                                                                className="h-6 w-6 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                                                                onClick={() => handleUpdateGrade(g.id)}
                                                            >
                                                                <Check className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button 
                                                                size="icon" 
                                                                variant="ghost" 
                                                                className="h-6 w-6 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                                                                onClick={() => handleDeleteGrade(g.id)}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button 
                                                                size="icon" 
                                                                variant="ghost" 
                                                                className="h-6 w-6 text-muted-foreground hover:bg-muted-foreground/10"
                                                                onClick={() => setEditingGradeId(null)}
                                                            >
                                                                <X className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <div
                                                            key={g.id}
                                                            className={cn(
                                                                "group flex items-center gap-1.5 text-xs pl-2.5 pr-1.5 py-1 rounded-lg border transition-all duration-150 cursor-default shadow-sm",
                                                                g.value >= 10 
                                                                    ? "bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10 hover:border-emerald-500/40" 
                                                                    : "bg-red-500/5 text-red-600 dark:text-red-400 border-red-500/20 hover:bg-red-500/10 hover:border-red-500/40"
                                                            )}
                                                        >
                                                            <span className="font-medium capitalize flex items-center flex-wrap gap-x-1.5">
                                                                {g.subject_name && (
                                                                    <span className="text-primary dark:text-primary/90 font-bold border-r border-border/30 pr-1.5 text-[10px] sm:text-xs uppercase tracking-wider shrink-0">
                                                                        {g.subject_name}
                                                                    </span>
                                                                )}
                                                                <span className="opacity-90 shrink-0">{g.assessment_type === 'devoir' ? (t('teacher.classes.details.devoir')?.toLowerCase() || 'devoir') : (t('teacher.classes.details.examen')?.toLowerCase() || 'examen')} :</span>
                                                                <strong className="font-extrabold text-foreground shrink-0">{g.value}/20</strong>
                                                            </span>
                                                            <button
                                                                className="opacity-0 group-hover:opacity-100 hover:scale-110 transition-all p-0.5 rounded text-muted-foreground hover:text-primary ml-1 hover:bg-primary/10"
                                                                title={t('teacher.classes.details.editOrDeleteGrade') || "Modifier ou Supprimer la note"}
                                                                onClick={() => {
                                                                    setEditingGradeId(g.id)
                                                                    setEditValue(g.value.toString())
                                                                }}
                                                            >
                                                                <Edit2 className="h-2.5 w-2.5" />
                                                            </button>
                                                        </div>
                                                    )
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-muted-foreground">{t('teacher.classes.details.noGrades') || "Aucune note"}</p>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </TabsContent>

                {/* Content: Stats */}
                <TabsContent value="stats" className="space-y-4 mt-6">
                    {loadingStats ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <>
                            {/* Overview Cards */}
                            <div className="grid grid-cols-2 gap-3">
                                <Card className="bg-card border-border/50">
                                    <CardContent className="pt-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-emerald-500/20 rounded-lg">
                                                <Users className="w-4 h-4 text-emerald-500" />
                                            </div>
                                            <div>
                                                <p className="text-2xl font-bold">{students.length}</p>
                                                <p className="text-xs text-muted-foreground">{t('common.students') || 'Élèves'}</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="bg-card border-border/50">
                                    <CardContent className="pt-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-primary/20 rounded-lg">
                                                <Award className="w-4 h-4 text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-2xl font-bold">{getClassAverage() || 'N/A'}</p>
                                                <p className="text-xs text-muted-foreground">{t('teacher.classes.details.averageClass') || 'Moyenne'}</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="bg-card border-border/50">
                                    <CardContent className="pt-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-amber-500/20 rounded-lg">
                                                <BarChart3 className="w-4 h-4 text-amber-500" />
                                            </div>
                                            <div>
                                                <p className="text-2xl font-bold">{grades.length}</p>
                                                <p className="text-xs text-muted-foreground">{t('teacher.classes.details.notes') || 'Notes'}</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="bg-card border-border/50">
                                    <CardContent className="pt-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-500/20 rounded-lg">
                                                <Calendar className="w-4 h-4 text-blue-500" />
                                            </div>
                                            <div>
                                                <p className="text-2xl font-bold">{attendanceHistory.length}</p>
                                                <p className="text-xs text-muted-foreground">{t('common.attendance') || 'Présences'}</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Attendance Stats */}
                            <Card className="bg-card border-border/50">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">{t('teacher.classes.details.attendanceRate') || 'Taux de présence'}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {(() => {
                                        const presentCount = attendanceHistory.filter(a => a.status === 'present').length
                                        const lateCount = attendanceHistory.filter(a => a.status === 'late').length
                                        const absentCount = attendanceHistory.filter(a => a.status === 'absent').length
                                        const total = attendanceHistory.length || 1

                                        return (
                                            <>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-emerald-500">{t('teacher.classes.details.presentCount') || 'Présents'}</span>
                                                        <span>{Math.round((presentCount / total) * 100)}%</span>
                                                    </div>
                                                    <Progress value={(presentCount / total) * 100} className="h-2 bg-muted" />
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-amber-500">{t('teacher.classes.details.lateCount') || 'Retards'}</span>
                                                        <span>{Math.round((lateCount / total) * 100)}%</span>
                                                    </div>
                                                    <Progress value={(lateCount / total) * 100} className="h-2 bg-muted [&>div]:bg-amber-500" />
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-red-500">{t('teacher.classes.details.absentCount') || 'Absents'}</span>
                                                        <span>{Math.round((absentCount / total) * 100)}%</span>
                                                    </div>
                                                    <Progress value={(absentCount / total) * 100} className="h-2 bg-muted [&>div]:bg-red-500" />
                                                </div>
                                            </>
                                        )
                                    })()}
                                </CardContent>
                            </Card>

                            {/* Grade Distribution */}
                            <Card className="bg-card border-border/50">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">{t('teacher.classes.details.gradeDistribution') || 'Répartition des notes'}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {(() => {
                                        const excellent = grades.filter(g => g.value >= 16).length
                                        const good = grades.filter(g => g.value >= 12 && g.value < 16).length
                                        const average = grades.filter(g => g.value >= 10 && g.value < 12).length
                                        const insufficient = grades.filter(g => g.value < 10).length
                                        const total = grades.length || 1

                                        return (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs w-24 text-muted-foreground">{t('teacher.classes.details.gradeExcellent') || 'Excellent (16+)'}</span>
                                                    <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                                                        <div
                                                            className="h-full bg-emerald-500 rounded-full transition-all"
                                                            style={{ width: `${(excellent / total) * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-medium w-8">{excellent}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs w-24 text-muted-foreground">{t('teacher.classes.details.gradeGood') || 'Bien (12-16)'}</span>
                                                    <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                                                        <div
                                                            className="h-full bg-blue-500 rounded-full transition-all"
                                                            style={{ width: `${(good / total) * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-medium w-8">{good}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs w-24 text-muted-foreground">{t('teacher.classes.details.gradeAverage') || 'Passable (10-12)'}</span>
                                                    <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                                                        <div
                                                            className="h-full bg-amber-500 rounded-full transition-all"
                                                            style={{ width: `${(average / total) * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-medium w-8">{average}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs w-24 text-muted-foreground">{t('teacher.classes.details.gradeInsufficient') || 'Insuffisant (<10)'}</span>
                                                    <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                                                        <div
                                                            className="h-full bg-red-500 rounded-full transition-all"
                                                            style={{ width: `${(insufficient / total) * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-medium w-8">{insufficient}</span>
                                                </div>
                                            </div>
                                        )
                                    })()}
                                </CardContent>
                            </Card>
                        </>
                    )}
                </TabsContent>

                {/* Content: Présences */}
                <TabsContent value="presences" className="space-y-4 mt-6">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder={t('teacher.classes.details.searchPlaceholder') || "Rechercher un élève..."}
                            className="pl-10 h-12 rounded-xl bg-card border-border/50"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-500">
                            <CheckCircle2 className="w-5 h-5" />
                            <div>
                                <span className="font-medium">{t('teacher.classes.details.dailyAttendance') || 'Appel du jour'}</span>
                                <span className="text-xs ml-2 text-emerald-400">
                                    {stats.present} {t('teacher.classes.details.presentCount')?.toLowerCase() || 'présents'} • {stats.late} {t('teacher.classes.details.lateCount')?.toLowerCase() || 'retards'} • {stats.absent} {t('teacher.classes.details.absentCount')?.toLowerCase() || 'absents'}
                                </span>
                            </div>
                        </div>
                        <Button
                            size="sm"
                            onClick={handleSaveAttendance}
                            disabled={isPending}
                            className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold rounded-lg gap-2"
                        >
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            {t('teacher.classes.details.validate') || 'Valider'}
                        </Button>
                    </div>

                    <div className="space-y-3">
                        {filteredStudents.map((student) => {
                            const status = attendance[student.id]
                            return (
                                <div key={student.id} className="bg-card p-3 rounded-2xl flex items-center justify-between border border-border/50">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-9 w-9">
                                            <AvatarFallback>{student.full_name.substring(0, 2)}</AvatarFallback>
                                        </Avatar>
                                        <span className="text-sm font-medium">
                                            {student.full_name} {student.national_id && <span className="text-[10px] text-slate-950 dark:text-white font-bold font-mono bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded ml-1.5">({student.national_id})</span>}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg">
                                        {[
                                            { s: 'present', icon: Check, color: 'text-emerald-500', bg: 'bg-emerald-500/20' },
                                            { s: 'late', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/20' },
                                            { s: 'absent', icon: X, color: 'text-red-500', bg: 'bg-red-500/20' }
                                        ].map((opt) => (
                                            <button
                                                key={opt.s}
                                                onClick={() => toggleStatus(student.id, opt.s as AttendanceStatus)}
                                                className={cn(
                                                    "w-7 h-7 rounded-md flex items-center justify-center transition-all",
                                                    status === opt.s ? `${opt.bg} ${opt.color} shadow-sm` : "text-muted-foreground hover:bg-white/5"
                                                )}
                                            >
                                                <opt.icon className="w-3.5 h-3.5" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </TabsContent>

                {/* Content: Planning */}
                <TabsContent value="planning" className="space-y-4 mt-6">
                    {loadingSchedule ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : scheduleByDay.length === 0 ? (
                        <Card className="p-8 text-center border-dashed">
                            <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">{t('teacher.classes.details.noSchedule') || 'Aucun cours programmé pour cette classe'}</p>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            {scheduleByDay.map(({ day, slots }) => (
                                <Card key={day} className="bg-card border-border/50 overflow-hidden">
                                    <CardHeader className="pb-2 bg-primary/5">
                                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-primary" />
                                            {day}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-3 space-y-2">
                                        {slots.map(slot => (
                                            <div
                                                key={slot.id}
                                                className="flex items-center gap-4 p-3 bg-background/50 rounded-lg"
                                            >
                                                <div className="text-center min-w-16">
                                                    <p className="text-sm font-bold text-primary">{formatTime(slot.start_time)}</p>
                                                    <p className="text-xs text-muted-foreground">{formatTime(slot.end_time)}</p>
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-medium text-sm">{slot.subject?.name || t('teacher.classes.details.subject') || 'Matière'}</p>
                                                    {slot.room && (
                                                        <p className="text-xs text-muted-foreground">{t('teacher.classes.details.room')?.replace('{room}', slot.room) || `Salle ${slot.room}`}</p>
                                                    )}
                                                </div>
                                                <div className="px-2 py-1 bg-primary/10 rounded text-xs text-primary">
                                                    {(() => {
                                                        const start = slot.start_time.split(':').map(Number)
                                                        const end = slot.end_time.split(':').map(Number)
                                                        const duration = (end[0] * 60 + end[1]) - (start[0] * 60 + start[1])
                                                        return t('teacher.classes.details.minutes')?.replace('{count}', duration.toString()) || `${duration}min`
                                                    })()}
                                                </div>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* Content: Publications */}
                <TabsContent value="publications" className="space-y-4 mt-6">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Publications</h3>
                        <Button
                            size="sm"
                            onClick={() => setShowPostForm(!showPostForm)}
                            className="rounded-xl gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Nouvelle publication
                        </Button>
                    </div>

                    {showPostForm && (
                        <Card className="bg-card border-border/50 p-4 space-y-3">
                            <Select value={postForm.post_type} onValueChange={(v) => setPostForm(prev => ({ ...prev, post_type: v }))}>
                                <SelectTrigger className="h-10 rounded-xl">
                                    <SelectValue placeholder="Type de publication" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cours">Cours</SelectItem>
                                    <SelectItem value="tp">TP</SelectItem>
                                    <SelectItem value="td">TD</SelectItem>
                                    <SelectItem value="devoir">Devoir</SelectItem>
                                    <SelectItem value="correction">Correction</SelectItem>
                                    <SelectItem value="ressource">Ressource</SelectItem>
                                    <SelectItem value="annonce">Annonce</SelectItem>
                                </SelectContent>
                            </Select>

                            <Input
                                placeholder="Titre (optionnel)"
                                value={postForm.title}
                                onChange={(e) => setPostForm(prev => ({ ...prev, title: e.target.value }))}
                                className="h-10 rounded-xl bg-background/50 border-border/50"
                            />

                            <Select value={postForm.subject_id} onValueChange={(v) => setPostForm(prev => ({ ...prev, subject_id: v }))}>
                                <SelectTrigger className="h-10 rounded-xl">
                                    <SelectValue placeholder="Matière *" />
                                </SelectTrigger>
                                <SelectContent>
                                    {teacherSubjects.map(s => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <textarea
                                placeholder="Contenu de la publication..."
                                value={postForm.content}
                                onChange={(e) => setPostForm(prev => ({ ...prev, content: e.target.value }))}
                                rows={4}
                                className="w-full px-3 py-2 text-sm bg-background/50 border border-border/50 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />

                            <div className="flex items-center gap-2">
                                <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                                    <Paperclip className="w-4 h-4" />
                                    {postFile ? postFile.name : 'Joindre un fichier'}
                                    <input
                                        type="file"
                                        className="hidden"
                                        onChange={(e) => setPostFile(e.target.files?.[0] || null)}
                                        accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png"
                                    />
                                </label>
                                {postFile && (
                                    <button onClick={() => setPostFile(null)} className="text-xs text-red-400 hover:text-red-500">
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>

                            <div className="flex gap-2 justify-end">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setShowPostForm(false)
                                        setPostForm({ title: '', content: '', post_type: 'cours', subject_id: '' })
                                        setPostFile(null)
                                    }}
                                    disabled={submittingPost}
                                    className="rounded-xl"
                                >
                                    Annuler
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleCreatePost}
                                    disabled={submittingPost || !postForm.content.trim() || !postForm.subject_id}
                                    className="rounded-xl gap-2"
                                >
                                    {submittingPost ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    Publier
                                </Button>
                            </div>
                        </Card>
                    )}

                    {loadingPosts ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : posts.length === 0 ? (
                        <Card className="p-8 text-center border-dashed">
                            <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground text-sm">Aucune publication pour cette classe</p>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {posts.map(post => {
                                const typeColors: Record<string, string> = {
                                    cours: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                                    tp: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
                                    td: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
                                    devoir: 'bg-red-500/10 text-red-400 border-red-500/20',
                                    correction: 'bg-green-500/10 text-green-400 border-green-500/20',
                                    ressource: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
                                    annonce: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                                }
                                const typeLabels: Record<string, string> = {
                                    cours: 'Cours', tp: 'TP', td: 'TD', devoir: 'Devoir',
                                    correction: 'Correction', ressource: 'Ressource', annonce: 'Annonce',
                                }
                                return (
                                    <Card key={post.id} className="bg-card border-border/50 p-4 space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${typeColors[post.post_type] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                                                    {typeLabels[post.post_type] || post.post_type}
                                                </span>
                                                {post.subject_name && (
                                                    <span className="text-[10px] text-muted-foreground bg-white/5 px-2 py-0.5 rounded border border-border/30">
                                                        {post.subject_name}
                                                    </span>
                                                )}
                                            </div>
                                            {currentUserId === post.teacher_id && (
                                                <button
                                                    onClick={() => handleDeletePost(post.id)}
                                                    disabled={deletingPostId === post.id}
                                                    className="text-muted-foreground hover:text-red-400 transition-colors shrink-0"
                                                >
                                                    {deletingPostId === post.id
                                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                                        : <Trash2 className="w-4 h-4" />}
                                                </button>
                                            )}
                                        </div>
                                        {post.title && <p className="font-semibold text-sm">{post.title}</p>}
                                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{post.content}</p>
                                        {post.attachments.length > 0 && (
                                            <div className="space-y-1 pt-1">
                                                {post.attachments.map(att => (
                                                    <a
                                                        key={att.id}
                                                        href={att.file_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-2 text-xs text-primary hover:underline"
                                                    >
                                                        <FileText className="w-3.5 h-3.5 shrink-0" />
                                                        <span className="truncate">{att.file_name}</span>
                                                        <Download className="w-3.5 h-3.5 shrink-0" />
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between pt-1">
                                            <span className="text-[10px] text-muted-foreground">{post.teacher_name || 'Enseignant'}</span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {new Date(post.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </span>
                                        </div>
                                    </Card>
                                )
                            })}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}

