'use client'

import { useState, useEffect, useTransition } from 'react'
import { motion } from 'framer-motion'
import { Search, History, Star, AlertTriangle, Hand, Send, ArrowLeft, Loader2, TrendingUp, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useTeacher } from '@/context/teacher-context'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n'
import { getTeacherAssignmentsAction, getClassStudentsAction, createRemarkAction } from '@/app/teacher/actions'

const REMARK_CATEGORIES = [
    { value: 'comportement', color: 'text-red-400',     bg: 'bg-red-500/10' },
    { value: 'scolaire',     color: 'text-blue-400',    bg: 'bg-blue-500/10' },
    { value: 'assiduite',    color: 'text-amber-400',   bg: 'bg-amber-500/10' },
    { value: 'participation', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { value: 'devoirs',      color: 'text-purple-400',  bg: 'bg-purple-500/10' },
    { value: 'general',      color: 'text-gray-400',    bg: 'bg-gray-500/10' },
]

interface Student {
    id: string
    name: string
    avatar?: string
    nationalId?: string | null
}

interface SubjectOption {
    id: string
    name: string
}

interface FeedbackType {
    type: 'positive' | 'warning' | 'concern' | 'participation' | 'improvement' | 'other'
    icon: React.FC<{ className?: string }>
    color: string
    bg: string
}

interface RecentRemark {
    id: string
    studentName: string
    type: string
    category: string | null
    subjectName: string | null
    message: string
    createdAt: string
}

const feedbackTypes: FeedbackType[] = [
    { type: 'positive', icon: Star, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { type: 'warning', icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10' },
    { type: 'participation', icon: Hand, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { type: 'improvement', icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { type: 'concern', icon: MessageCircle, color: 'text-purple-500', bg: 'bg-purple-500/10' },
]

export function TeacherRemarks() {
    const { t, direction } = useLanguage()
    const { teacherId, loading, classes, schoolId } = useTeacher()
    const [isPending, startTransition] = useTransition()

    const [selectedClass, setSelectedClass] = useState<string | null>(null)
    const [allClasses, setAllClasses] = useState<{ id: string; name: string; schoolId: string }[]>([])
    const [students, setStudents] = useState<Student[]>([])
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
    const [selectedType, setSelectedType] = useState<FeedbackType | null>(null)
    const [selectedCategory, setSelectedCategory] = useState('general')
    const [selectedSubject, setSelectedSubject] = useState('')
    const [subjects, setSubjects] = useState<SubjectOption[]>([])
    const [message, setMessage] = useState('')
    const [recentRemarks, setRecentRemarks] = useState<RecentRemark[]>([])
    const [loadingStudents, setLoadingStudents] = useState(false)
    const [loadingRemarks, setLoadingRemarks] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('')
    const [subjectFilter, setSubjectFilter] = useState('')

    const [classSubjectsMap, setClassSubjectsMap] = useState<Record<string, SubjectOption[]>>({})

    // Fetch assignments (classes with schools, and subjects) for this teacher bypassing RLS
    useEffect(() => {
        async function fetchTeacherAssignments() {
            if (!teacherId) return
            try {
                const assignments = await getTeacherAssignmentsAction(teacherId)
                
                const classMap = new Map<string, { id: string; name: string; schoolId: string }>()
                const classToSubjects: Record<string, Map<string, SubjectOption>> = {}

                assignments?.forEach(a => {
                    const cls = a.classes as any
                    const subj = a.subjects as any
                    
                    if (cls?.id) {
                        const schoolName = cls.schools?.name ? ` (${cls.schools.name})` : ''
                        classMap.set(cls.id, { 
                            id: cls.id, 
                            name: `${cls.name}${schoolName}`,
                            schoolId: cls.school_id
                        })

                        if (!classToSubjects[cls.id]) {
                            classToSubjects[cls.id] = new Map()
                        }

                        if (subj?.id && subj?.name) {
                            // Normalize by removing all spaces and accents to ensure robust deduplication
                            const normalizedName = subj.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "").toLowerCase()
                            if (!classToSubjects[cls.id].has(normalizedName)) {
                                classToSubjects[cls.id].set(normalizedName, { id: subj.id, name: subj.name.trim() })
                            }
                        }
                    }
                })

                setAllClasses(Array.from(classMap.values()))
                
                const finalClassSubjectsMap: Record<string, SubjectOption[]> = {}
                const globalSubjectsMap = new Map<string, SubjectOption>()

                Object.keys(classToSubjects).forEach(classId => {
                    finalClassSubjectsMap[classId] = Array.from(classToSubjects[classId].values())
                    finalClassSubjectsMap[classId].forEach(subj => {
                        const normalizedName = subj.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "").toLowerCase()
                        if (!globalSubjectsMap.has(normalizedName)) {
                            globalSubjectsMap.set(normalizedName, subj)
                        }
                    })
                })
                setClassSubjectsMap(finalClassSubjectsMap)
                setSubjects(Array.from(globalSubjectsMap.values()))
            } catch (err) {
                console.error('Error fetching assignments in remarks:', err)
            }
        }
        if (!loading) fetchTeacherAssignments()
    }, [teacherId, loading])

    // Fetch students when class is selected using Server Action to bypass RLS
    useEffect(() => {
        async function fetchStudents() {
            if (!selectedClass) {
                setStudents([])
                return
            }

            setLoadingStudents(true)

            try {
                const enrollments = await getClassStudentsAction(selectedClass)

                if (enrollments && enrollments.length > 0) {
                    const studentList: Student[] = enrollments.map((e: any) => {
                        const profile = e.profiles as { id?: string, full_name?: string, avatar_url?: string, national_id?: string | null }
                        return {
                            id: profile?.id || e.student_id,
                            name: profile?.full_name || 'Élève',
                            avatar: profile?.avatar_url || undefined,
                            nationalId: profile?.national_id || null
                        }
                    })
                    setStudents(studentList)
                } else {
                    setStudents([])
                }
            } catch (err) {
                console.error('Error fetching students in remarks:', err)
                setStudents([])
            }

            setLoadingStudents(false)
        }

        fetchStudents()
    }, [selectedClass])

    // Fetch recent remarks
    useEffect(() => {
        async function fetchRecentRemarks() {
            if (!teacherId) return

            setLoadingRemarks(true)
            const supabase = createClient()

            try {
                const { data: remarks, error } = await supabase
                    .from('remarks')
                    .select(`
                        id,
                        type,
                        message,
                        created_at,
                        profiles!remarks_student_id_fkey (full_name),
                        subjects!remarks_subject_id_fkey (name)
                    `)
                    .eq('teacher_id', teacherId)
                    .order('created_at', { ascending: false })
                    .limit(20)

                if (error) {
                    console.error('Error fetching remarks:', error)
                    setRecentRemarks([])
                    return
                }

                if (remarks && remarks.length > 0) {
                    const formatted: RecentRemark[] = remarks.map(r => ({
                        id: r.id,
                        studentName: (r.profiles as { full_name?: string })?.full_name || 'Élève',
                        type: r.type,
                        category: (r as any).category || null,
                        subjectName: (r.subjects as any)?.name || null,
                        message: r.message.length > 60 ? r.message.slice(0, 60) + '...' : r.message,
                        createdAt: r.created_at
                    }))
                    setRecentRemarks(formatted)
                } else {
                    setRecentRemarks([])
                }
            } catch (err) {
                console.error('Error:', err)
                setRecentRemarks([])
            }

            setLoadingRemarks(false)
        }

        if (!loading) {
            fetchRecentRemarks()
        }
    }, [teacherId, loading])

    const handleSubmit = async () => {
        const activeClass = allClasses.find(c => c.id === selectedClass)
        const activeSchoolId = activeClass?.schoolId || schoolId

        if (!selectedStudent || !selectedType || !message.trim() || !teacherId || !selectedClass || !activeSchoolId) {
            toast.error(t('teacher.remarks.fillAllFields'))
            return
        }

        startTransition(async () => {
            try {
                await createRemarkAction({
                    school_id: activeSchoolId,
                    teacher_id: teacherId,
                    student_id: selectedStudent.id,
                    class_id: selectedClass,
                    type: selectedType.type,
                    subject_id: (selectedSubject && selectedSubject !== 'none') ? selectedSubject : null,
                    message: message.trim(),
                    sender_type: 'teacher',
                    is_visible_to_parent: true
                })

                toast.success(t('teacher.remarks.sendSuccess'))

                // Reset form
                setMessage('')
                setSelectedType(null)
                setSelectedStudent(null)
                setSelectedCategory('general')
                setSelectedSubject('')

                // Refresh recent remarks
                const supabase = createClient()
                const { data: remarks } = await supabase
                    .from('remarks')
                    .select(`
                        id,
                        type,
                        message,
                        created_at,
                        profiles!remarks_student_id_fkey (full_name),
                        subjects!remarks_subject_id_fkey (name)
                    `)
                    .eq('teacher_id', teacherId)
                    .order('created_at', { ascending: false })
                    .limit(20)

                if (remarks) {
                    const formatted: RecentRemark[] = remarks.map(r => ({
                        id: r.id,
                        studentName: (r.profiles as { full_name?: string })?.full_name || 'Élève',
                        type: r.type,
                        category: (r as any).category || null,
                        subjectName: (r.subjects as any)?.name || null,
                        message: r.message.length > 60 ? r.message.slice(0, 60) + '...' : r.message,
                        createdAt: r.created_at
                    }))
                    setRecentRemarks(formatted)
                }
            } catch (error: any) {
                console.error('Error inserting remark:', error)
                toast.error(`${t('teacher.remarks.sendError')}: ${error.message || ''}`)
            }
        })
    }

    const filteredStudents = searchQuery
        ? students.filter(s => 
            s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (s.nationalId && s.nationalId.toLowerCase().includes(searchQuery.toLowerCase()))
        )
        : students

    const formatTimeAgo = (dateStr: string) => {
        const date = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMins / 60)
        const diffDays = Math.floor(diffHours / 24)

        if (diffMins < 60) return t('teacher.remarks.timeAgoMins').replace('{mins}', diffMins.toString())
        if (diffHours < 24) return t('teacher.remarks.timeAgoHours').replace('{hours}', diffHours.toString())
        if (diffDays === 1) return t('teacher.remarks.yesterday')
        return date.toLocaleDateString(t('common.locale') || 'fr-FR', { day: 'numeric', month: 'short' })
    }

    const getTypeInfo = (type: string) => {
        return feedbackTypes.find(f => f.type === type) || feedbackTypes[0]
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="max-w-xl mx-auto pb-24 relative min-h-screen animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Link href="/teacher">
                        <Button variant="ghost" size="icon" className="rounded-full">
                            <ArrowLeft className={cn("w-5 h-5", direction === 'rtl' && 'rotate-180')} />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">{t('teacher.remarks.title')}</h1>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full">
                    <History className="w-5 h-5" />
                </Button>
            </div>

            {/* Step 1: Select Class */}
            <div className="mb-6">
                <h2 className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">{t('teacher.remarks.selectClass')}</h2>
                <div className="flex flex-wrap gap-2">
                    {allClasses.map(c => (
                        <Button
                            key={c.id}
                            variant={selectedClass === c.id ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                                setSelectedClass(c.id)
                                setSelectedStudent(null)
                            }}
                            className="rounded-full font-semibold"
                        >
                            {c.name}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Step 2: Select Student */}
            {selectedClass && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6"
                >
                    <h2 className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">{t('teacher.remarks.selectStudent')}</h2>

                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder={t('teacher.remarks.searchPlaceholder')}
                            className="pl-10 rounded-xl bg-card"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {loadingStudents ? (
                        <div className="flex justify-center py-6">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : filteredStudents.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">{t('teacher.remarks.noStudentsFound')}</p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {filteredStudents.map(student => (
                                <Button
                                    key={student.id}
                                    variant={selectedStudent?.id === student.id ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setSelectedStudent(student)}
                                    className="rounded-full gap-2 font-medium"
                                >
                                    <Avatar className="h-5 w-5">
                                        <AvatarImage src={student.avatar} />
                                        <AvatarFallback className="text-[10px]">{student.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <span className="truncate max-w-[120px] sm:max-w-none">{student.name}</span>
                                    {student.nationalId && <span className="text-[10px] text-slate-950 dark:text-white font-bold font-mono shrink-0 bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded">({student.nationalId})</span>}
                                </Button>
                            ))}
                        </div>
                    )}
                </motion.div>
            )}

            {/* Step 3: Select Type */}
            {selectedStudent && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6"
                >
                    <h2 className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">{t('teacher.remarks.remarkType')}</h2>
                    <div className="grid grid-cols-3 gap-2">
                        {feedbackTypes.map(type => (
                            <Button
                                key={type.type}
                                variant="outline"
                                onClick={() => setSelectedType(type)}
                                className={cn(
                                    "flex flex-col h-auto py-4 rounded-2xl transition-all bg-card/50",
                                    selectedType?.type === type.type && `border-2 ${type.bg} border-indigo-500`
                                )}
                            >
                                <div className={cn("p-2 rounded-full mb-2", type.bg)}>
                                    <type.icon className={cn("w-5 h-5", type.color)} />
                                </div>
                                <span className="text-xs font-semibold">{t(`teacher.remarks.types.${type.type}`)}</span>
                            </Button>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Step 3b: Category */}
            {selectedType && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6"
                >
                    <h2 className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">{t('teacher.remarks.category')}</h2>
                    <div className="flex flex-wrap gap-2">
                        {REMARK_CATEGORIES.map(cat => (
                            <button
                                key={cat.value}
                                onClick={() => setSelectedCategory(cat.value)}
                                className={cn(
                                    "px-3 py-1.5 rounded-full text-xs font-bold border transition-all",
                                    selectedCategory === cat.value
                                        ? `${cat.bg} ${cat.color} border-current`
                                        : "bg-card border-border text-muted-foreground hover:border-border/80"
                                )}
                            >
                                {t(`teacher.remarks.categories.${cat.value}`)}
                            </button>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Step 3c: Subject (optional) */}
            {selectedType && selectedClass && (classSubjectsMap[selectedClass] || []).length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6"
                >
                    <h2 className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">
                        {t('teacher.remarks.subject')} <span className="font-normal lowercase">{t('teacher.remarks.optional')}</span>
                    </h2>
                    <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                        <SelectTrigger className="rounded-xl bg-card border-border">
                            <SelectValue placeholder={t('teacher.remarks.noSubjectLinked')} />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                            <SelectItem value="none">{t('teacher.remarks.noSubject')}</SelectItem>
                            {(classSubjectsMap[selectedClass] || []).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </motion.div>
            )}

            {/* Step 4: Write Message */}
            {selectedType && selectedStudent && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6"
                >
                    <h2 className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">{t('teacher.remarks.messageLabel')}</h2>
                    <div className="bg-card border rounded-2xl p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={selectedStudent.avatar} />
                                <AvatarFallback>{selectedStudent.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="text-sm font-bold text-gray-900 dark:text-white">
                                    {selectedStudent.name} {selectedStudent.nationalId && <span className="text-[10px] text-slate-950 dark:text-white font-black font-mono bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded ml-2 inline-block">({selectedStudent.nationalId})</span>}
                                </p>
                                <p className={cn("text-[10px] font-semibold", selectedType.color)}>{t(`teacher.remarks.types.${selectedType.type}`)}</p>
                            </div>
                        </div>
                        <Textarea
                            placeholder={t('teacher.remarks.messagePlaceholder')}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="min-h-[100px] resize-none border-0 focus-visible:ring-0 p-0 bg-transparent"
                        />
                        <div className="flex justify-end mt-4">
                            <Button
                                onClick={handleSubmit}
                                disabled={!message.trim() || isPending}
                                className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold px-5"
                            >
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                {t('teacher.remarks.send')}
                            </Button>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Recent Remarks */}
            <div className="mt-8">
                <h2 className="text-sm font-bold text-muted-foreground mb-3 flex items-center gap-2 uppercase tracking-wider">
                    <History className="w-4 h-4" />
                    {t('teacher.remarks.recentRemarks')}
                </h2>

                {/* Filters */}
                <div className="flex flex-wrap gap-2 mb-4">
                    <button
                        onClick={() => setCategoryFilter('')}
                        className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold border transition-all",
                            categoryFilter === '' ? "bg-indigo-500/20 text-indigo-500 border-indigo-500/50" : "bg-card border-border text-muted-foreground"
                        )}
                    >
                        {t('teacher.remarks.all')}
                    </button>
                    {REMARK_CATEGORIES.map(cat => (
                        <button
                            key={cat.value}
                            onClick={() => setCategoryFilter(categoryFilter === cat.value ? '' : cat.value)}
                            className={cn(
                                "px-3 py-1 rounded-full text-xs font-bold border transition-all",
                                categoryFilter === cat.value
                                    ? `${cat.bg} ${cat.color} border-current`
                                    : "bg-card border-border text-muted-foreground"
                            )}
                        >
                            {t(`teacher.remarks.categories.${cat.value}`)}
                        </button>
                    ))}
                </div>

                {subjects.length > 0 && (
                    <div className="mb-4">
                        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                            <SelectTrigger className="h-8 text-xs rounded-xl bg-card border-border w-48">
                                <SelectValue placeholder={t('teacher.remarks.filterBySubject')} />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border">
                                <SelectItem value="all">{t('teacher.remarks.allSubjects')}</SelectItem>
                                {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {loadingRemarks ? (
                    <div className="flex justify-center py-6">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : recentRemarks.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4 bg-card/50 rounded-2xl">
                        {t('teacher.remarks.noRecentRemarks')}
                    </p>
                ) : (
                    <div className="space-y-2">
                        {recentRemarks
                            .filter(r => !categoryFilter || r.category === categoryFilter)
                            .filter(r => !subjectFilter || subjectFilter === 'all' || r.subjectName === subjects.find(s => s.id === subjectFilter)?.name)
                            .map(remark => {
                                const typeInfo = getTypeInfo(remark.type)
                                const catInfo = REMARK_CATEGORIES.find(c => c.value === remark.category)
                                return (
                                    <div key={remark.id} className="bg-card/50 p-3 rounded-2xl flex items-start gap-3 border border-gray-100 dark:border-white/5">
                                        <div className={cn("p-2 rounded-full shrink-0", typeInfo.bg)}>
                                            <typeInfo.icon className={cn("w-4 h-4", typeInfo.color)} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-baseline">
                                                <p className="font-bold text-sm text-gray-900 dark:text-white">{remark.studentName}</p>
                                                <span className="text-[10px] text-muted-foreground">{formatTimeAgo(remark.createdAt)}</span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {catInfo && (
                                                    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-md", catInfo.bg, catInfo.color)}>
                                                        {t(`teacher.remarks.categories.${catInfo.value}`)}
                                                    </span>
                                                )}
                                                {remark.subjectName && (
                                                    <span className="text-[10px] text-muted-foreground">{remark.subjectName}</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground truncate mt-1">{remark.message}</p>
                                        </div>
                                    </div>
                                )
                            })}
                    </div>
                )}
            </div>
        </div>
    )
}
