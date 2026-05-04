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

const REMARK_CATEGORIES = [
    { value: 'comportement', label: 'Comportement', color: 'text-red-400',     bg: 'bg-red-500/10' },
    { value: 'scolaire',     label: 'Scolaire',     color: 'text-blue-400',    bg: 'bg-blue-500/10' },
    { value: 'assiduite',    label: 'Assiduité',    color: 'text-amber-400',   bg: 'bg-amber-500/10' },
    { value: 'participation',label: 'Participation', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { value: 'devoirs',      label: 'Devoirs',      color: 'text-purple-400',  bg: 'bg-purple-500/10' },
    { value: 'general',      label: 'Général',      color: 'text-gray-400',    bg: 'bg-gray-500/10' },
]

interface Student {
    id: string
    name: string
    avatar?: string
}

interface SubjectOption {
    id: string
    name: string
}

interface FeedbackType {
    type: 'positive' | 'warning' | 'concern' | 'participation' | 'improvement' | 'other'
    label: string
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
    { type: 'positive', label: 'Encouragement', icon: Star, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { type: 'warning', label: 'Avertissement', icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10' },
    { type: 'participation', label: 'Participation', icon: Hand, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { type: 'improvement', label: 'Amélioration', icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { type: 'concern', label: 'Préoccupation', icon: MessageCircle, color: 'text-purple-500', bg: 'bg-purple-500/10' },
]

export function TeacherRemarks() {
    const { teacherId, loading, classes, schoolId } = useTeacher()
    const [isPending, startTransition] = useTransition()

    const [selectedClass, setSelectedClass] = useState<string | null>(null)
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

    // Fetch subjects for this teacher
    useEffect(() => {
        async function fetchSubjects() {
            if (!teacherId || !schoolId) return
            const supabase = createClient()
            const { data } = await supabase
                .from('teacher_assignments')
                .select('subjects!teacher_assignments_subject_id_fkey(id, name)')
                .eq('teacher_id', teacherId)
            const seen = new Set<string>()
            const list: SubjectOption[] = []
            for (const a of data || []) {
                const s = (a.subjects as any)
                if (s?.id && !seen.has(s.id)) { seen.add(s.id); list.push({ id: s.id, name: s.name }) }
            }
            setSubjects(list)
        }
        if (!loading) fetchSubjects()
    }, [teacherId, schoolId, loading])

    // Fetch students when class is selected
    useEffect(() => {
        async function fetchStudents() {
            if (!selectedClass) {
                setStudents([])
                return
            }

            setLoadingStudents(true)
            const supabase = createClient()

            try {
                const { data: enrollments, error } = await supabase
                    .from('enrollments')
                    .select(`
                        student_id,
                        profiles!enrollments_student_id_fkey (
                            id,
                            full_name,
                            avatar_url
                        )
                    `)
                    .eq('class_id', selectedClass)

                if (error) {
                    console.error('Error fetching students:', error)
                    setStudents([])
                    return
                }

                if (enrollments && enrollments.length > 0) {
                    const studentList: Student[] = enrollments.map(e => {
                        const profile = e.profiles as { id?: string, full_name?: string, avatar_url?: string }
                        return {
                            id: profile?.id || e.student_id,
                            name: profile?.full_name || 'Élève',
                            avatar: profile?.avatar_url || undefined
                        }
                    })
                    setStudents(studentList)
                } else {
                    setStudents([])
                }
            } catch (err) {
                console.error('Error:', err)
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
                        category,
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
        if (!selectedStudent || !selectedType || !message.trim() || !teacherId || !selectedClass || !schoolId) {
            toast.error('Veuillez remplir tous les champs')
            return
        }

        startTransition(async () => {
            const supabase = createClient()

            const { error } = await supabase
                .from('remarks')
                .insert({
                    school_id: schoolId,
                    teacher_id: teacherId,
                    student_id: selectedStudent.id,
                    class_id: selectedClass,
                    type: selectedType.type,
                    category: selectedCategory,
                    subject_id: selectedSubject || null,
                    message: message.trim(),
                    sender_type: 'teacher',
                    is_visible_to_parent: true
                })

            if (error) {
                console.error('Error inserting remark:', error)
                toast.error('Erreur lors de l\'envoi de la remarque')
                return
            }

            toast.success('Remarque envoyée avec succès!')

            // Reset form
            setMessage('')
            setSelectedType(null)
            setSelectedStudent(null)
            setSelectedCategory('general')
            setSelectedSubject('')

            // Refresh recent remarks
            const { data: remarks } = await supabase
                .from('remarks')
                .select(`
                    id,
                    type,
                    category,
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
        })
    }

    const filteredStudents = searchQuery
        ? students.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : students

    const formatTimeAgo = (dateStr: string) => {
        const date = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMins / 60)
        const diffDays = Math.floor(diffHours / 24)

        if (diffMins < 60) return `Il y a ${diffMins} min`
        if (diffHours < 24) return `Il y a ${diffHours}h`
        if (diffDays === 1) return 'Hier'
        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
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
        <div className="max-w-xl mx-auto pb-24 relative min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Link href="/teacher">
                        <Button variant="ghost" size="icon" className="rounded-full">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold">Remarques</h1>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full">
                    <History className="w-5 h-5" />
                </Button>
            </div>

            {/* Step 1: Select Class */}
            <div className="mb-6">
                <h2 className="text-sm font-bold text-muted-foreground mb-3">1. Sélectionner une classe</h2>
                <div className="flex flex-wrap gap-2">
                    {classes.map(c => (
                        <Button
                            key={c.id}
                            variant={selectedClass === c.id ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                                setSelectedClass(c.id)
                                setSelectedStudent(null)
                            }}
                            className="rounded-full"
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
                    <h2 className="text-sm font-bold text-muted-foreground mb-3">2. Sélectionner un élève</h2>

                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Rechercher un élève..."
                            className="pl-10 rounded-xl"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {loadingStudents ? (
                        <div className="flex justify-center py-6">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : filteredStudents.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Aucun élève trouvé</p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {filteredStudents.map(student => (
                                <Button
                                    key={student.id}
                                    variant={selectedStudent?.id === student.id ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setSelectedStudent(student)}
                                    className="rounded-full gap-2"
                                >
                                    <Avatar className="h-5 w-5">
                                        <AvatarImage src={student.avatar} />
                                        <AvatarFallback className="text-[10px]">{student.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    {student.name.split(' ')[0]}
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
                    <h2 className="text-sm font-bold text-muted-foreground mb-3">3. Type de remarque</h2>
                    <div className="grid grid-cols-3 gap-2">
                        {feedbackTypes.map(type => (
                            <Button
                                key={type.type}
                                variant="outline"
                                onClick={() => setSelectedType(type)}
                                className={cn(
                                    "flex flex-col h-auto py-4 rounded-2xl transition-all",
                                    selectedType?.type === type.type && `border-2 ${type.bg} border-current`
                                )}
                            >
                                <div className={cn("p-2 rounded-full mb-2", type.bg)}>
                                    <type.icon className={cn("w-5 h-5", type.color)} />
                                </div>
                                <span className="text-xs">{type.label}</span>
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
                    <h2 className="text-sm font-bold text-muted-foreground mb-3">4. Catégorie</h2>
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
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Step 3c: Subject (optional) */}
            {selectedType && subjects.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6"
                >
                    <h2 className="text-sm font-bold text-muted-foreground mb-3">5. Matière <span className="font-normal">(optionnel)</span></h2>
                    <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                        <SelectTrigger className="rounded-xl bg-card border-border">
                            <SelectValue placeholder="Aucune matière liée" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                            <SelectItem value="">Aucune matière</SelectItem>
                            {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
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
                    <h2 className="text-sm font-bold text-muted-foreground mb-3">{subjects.length > 0 ? '6' : '4'}. Message</h2>
                    <div className="bg-card border rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={selectedStudent.avatar} />
                                <AvatarFallback>{selectedStudent.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="text-sm font-bold">{selectedStudent.name}</p>
                                <p className={cn("text-[10px]", selectedType.color)}>{selectedType.label}</p>
                            </div>
                        </div>
                        <Textarea
                            placeholder="Écrivez votre remarque..."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="min-h-[100px] resize-none border-0 focus-visible:ring-0 p-0"
                        />
                        <div className="flex justify-end mt-4">
                            <Button
                                onClick={handleSubmit}
                                disabled={!message.trim() || isPending}
                                className="gap-2 rounded-xl"
                            >
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                Envoyer
                            </Button>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Recent Remarks */}
            <div className="mt-8">
                <h2 className="text-sm font-bold text-muted-foreground mb-3 flex items-center gap-2">
                    <History className="w-4 h-4" />
                    Remarques récentes
                </h2>

                {/* Filters */}
                <div className="flex flex-wrap gap-2 mb-4">
                    <button
                        onClick={() => setCategoryFilter('')}
                        className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold border transition-all",
                            categoryFilter === '' ? "bg-primary/20 text-primary border-primary/50" : "bg-card border-border text-muted-foreground"
                        )}
                    >
                        Tout
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
                            {cat.label}
                        </button>
                    ))}
                </div>

                {subjects.length > 0 && (
                    <div className="mb-4">
                        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                            <SelectTrigger className="h-8 text-xs rounded-xl bg-card border-border w-48">
                                <SelectValue placeholder="Filtrer par matière" />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border">
                                <SelectItem value="">Toutes les matières</SelectItem>
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
                        Aucune remarque récente
                    </p>
                ) : (
                    <div className="space-y-2">
                        {recentRemarks
                            .filter(r => !categoryFilter || r.category === categoryFilter)
                            .filter(r => !subjectFilter || r.subjectName === subjects.find(s => s.id === subjectFilter)?.name)
                            .map(remark => {
                            const typeInfo = getTypeInfo(remark.type)
                            const catInfo = REMARK_CATEGORIES.find(c => c.value === remark.category)
                            return (
                                <div key={remark.id} className="bg-card/50 p-3 rounded-2xl flex items-start gap-3">
                                    <div className={cn("p-2 rounded-full shrink-0", typeInfo.bg)}>
                                        <typeInfo.icon className={cn("w-4 h-4", typeInfo.color)} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-baseline">
                                            <p className="font-medium text-sm">{remark.studentName}</p>
                                            <span className="text-[10px] text-muted-foreground">{formatTimeAgo(remark.createdAt)}</span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {catInfo && (
                                                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-md", catInfo.bg, catInfo.color)}>
                                                    {catInfo.label}
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
