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
    Plus
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

interface Student {
    id: string
    full_name: string
    avatar_url?: string
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

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const EXAM_TYPES = [
    { value: 'control', label: 'Contrôle' },
    { value: 'homework', label: 'Devoir' },
    { value: 'exam', label: 'Examen' },
    { value: 'oral', label: 'Oral' },
]

export function ClassDetails({ classId, className, students }: ClassDetailsProps) {
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
    const [editingGrade, setEditingGrade] = useState<{ studentId: string; value: string } | null>(null)
    const [addingGrade, setAddingGrade] = useState(false)
    const [newGrade, setNewGrade] = useState({ examType: 'control', subjectId: '', grades: {} as Record<string, string> })

    // State for teacher's subjects in this class
    const [teacherSubjects, setTeacherSubjects] = useState<{ id: string; name: string }[]>([])
    const [currentTermId, setCurrentTermId] = useState<string | null>(null)

    // State for Planning tab
    const [schedule, setSchedule] = useState<ScheduleSlot[]>([])
    const [loadingSchedule, setLoadingSchedule] = useState(false)

    // State for Stats
    const [attendanceHistory, setAttendanceHistory] = useState<any[]>([])
    const [loadingStats, setLoadingStats] = useState(false)

    const filteredStudents = students.filter(s =>
        s.full_name.toLowerCase().includes(searchQuery.toLowerCase())
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
            const { data, error } = await supabase
                .from('grades')
                .select('*')
                .eq('class_id', classId)
                .order('created_at', { ascending: false })

            if (error) throw error
            setGrades(data || [])
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
            const { data, error } = await supabase
                .from('schedule')
                .select(`
                    id,
                    day_of_week,
                    start_time,
                    end_time,
                    room,
                    subjects:subject_id(name)
                `)
                .eq('class_id', classId)
                .order('day_of_week')
                .order('start_time')

            if (error) throw error
            setSchedule((data || []).map((s: any) => ({
                ...s,
                subject: s.subjects
            })))
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
            const { data, error } = await supabase
                .from('attendance')
                .select('*')
                .eq('class_id', classId)
                .order('date', { ascending: false })
                .limit(100)

            if (error) throw error
            setAttendanceHistory(data || [])
        } catch (error) {
            console.error('Error loading attendance history:', error)
        } finally {
            setLoadingStats(false)
        }
    }

    // Load teacher's subjects for this class + current term
    const loadTeacherSubjects = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Fetch current term and teacher subjects in parallel
            const [assignResult, termResult] = await Promise.all([
                supabase
                    .from('teacher_assignments')
                    .select('subject_id')
                    .eq('teacher_id', user.id)
                    .eq('class_id', classId),
                supabase
                    .from('terms')
                    .select('id')
                    .eq('is_current', true)
                    .single(),
            ])

            if (assignResult.error) throw assignResult.error

            // Store current term ID (null if none set)
            setCurrentTermId(termResult.data?.id ?? null)

            const subjectIds = (assignResult.data || []).map(a => a.subject_id).filter(Boolean)

            if (subjectIds.length === 0) {
                setTeacherSubjects([])
                return
            }

            const { data: subjectsData, error: subjectsError } = await supabase
                .from('subjects')
                .select('id, name')
                .in('id', subjectIds)

            if (subjectsError) throw subjectsError

            setTeacherSubjects(subjectsData || [])
            if (subjectsData && subjectsData.length > 0) {
                setNewGrade(prev => ({ ...prev, subjectId: subjectsData[0].id }))
            }
        } catch (error) {
            console.error('Error loading teacher subjects:', error)
        }
    }

    useEffect(() => {
        loadGrades()
        loadSchedule()
        loadAttendanceHistory()
        loadTeacherSubjects()
    }, [classId])

    const toggleStatus = (studentId: string, status: AttendanceStatus) => {
        setAttendance(prev => ({ ...prev, [studentId]: status }))
    }

    const handleSaveAttendance = () => {
        startTransition(async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) throw new Error('Not authenticated')

                const today = new Date().toISOString().split('T')[0]

                const records = Object.entries(attendance).map(([studentId, status]) => ({
                    student_id: studentId,
                    class_id: classId,
                    recorded_by: user.id,
                    date: today,
                    status: status,
                }))

                const { error } = await supabase
                    .from('attendance')
                    .upsert(records, {
                        onConflict: 'student_id,class_id,date'
                    })

                if (error) throw error

                toast.success(`Présences enregistrées pour ${records.length} élèves`)
                loadAttendanceHistory()
            } catch (error) {
                console.error('Error saving attendance:', error)
                toast.error('Erreur lors de l\'enregistrement')
            }
        })
    }

    // Save new grades
    const handleSaveNewGrades = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            const gradesToInsert = Object.entries(newGrade.grades)
                .filter(([_, val]) => val && !isNaN(parseFloat(val)))
                .map(([studentId, val]) => ({
                    student_id: studentId,
                    class_id: classId,
                    subject_id: newGrade.subjectId,
                    value: parseFloat(val),
                    max_value: 20,
                    assessment_type: newGrade.examType,
                    teacher_id: user.id,
                    term_id: currentTermId,
                }))

            if (!newGrade.subjectId) {
                toast.error('Veuillez sélectionner une matière')
                return
            }

            if (gradesToInsert.length === 0) {
                toast.error('Veuillez saisir au moins une note')
                return
            }

            const { error } = await supabase.from('grades').insert(gradesToInsert)
            if (error) throw error

            toast.success(`${gradesToInsert.length} notes enregistrées`)
            setAddingGrade(false)
            setNewGrade({ examType: 'control', subjectId: teacherSubjects[0]?.id || '', grades: {} })
            loadGrades()
        } catch (error) {
            console.error('Error saving grades:', error)
            toast.error('Erreur lors de l\'enregistrement')
        }
    }

    // Calculate student averages
    const getStudentAverage = (studentId: string) => {
        const studentGrades = grades.filter(g => g.student_id === studentId)
        if (studentGrades.length === 0) return null
        const sum = studentGrades.reduce((acc, g) => acc + g.value, 0)
        return (sum / studentGrades.length).toFixed(1)
    }

    // Get class average
    const getClassAverage = () => {
        if (grades.length === 0) return null
        const sum = grades.reduce((acc, g) => acc + g.value, 0)
        return (sum / grades.length).toFixed(1)
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
                        <ArrowLeft className="w-6 h-6" />
                    </Button>
                </Link>
                <div className="text-center">
                    <h1 className="text-xl font-bold">{className}</h1>
                    <p className="text-xs text-muted-foreground">2025-2026</p>
                </div>
                <Button variant="ghost" className="text-primary text-sm font-medium">
                    Modifier
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-card border border-border/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
                    <span className="text-3xl font-bold text-white">{students.length}</span>
                    <span className="text-[10px] uppercase text-muted-foreground mt-1 tracking-wider">Élèves</span>
                </div>
                <div className="bg-card border border-border/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
                    <span className="text-3xl font-bold text-emerald-500">{attendancePercentage}%</span>
                    <span className="text-[10px] uppercase text-muted-foreground mt-1 tracking-wider">Présence</span>
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="eleves" className="w-full">
                <TabsList className="w-full bg-transparent border-b border-white/10 p-0 justify-between h-auto rounded-none">
                    {['Élèves', 'Notes', 'Stats', 'Présences', 'Planning'].map((tab) => (
                        <TabsTrigger
                            key={tab}
                            value={tab.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary pb-3 px-1 text-xs uppercase bg-transparent"
                        >
                            {tab}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {/* Content: Élèves */}
                <TabsContent value="eleves" className="space-y-4 mt-6">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Rechercher un élève..."
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
                                        <h3 className="font-semibold text-sm text-gray-200">{student.full_name}</h3>
                                        <p className="text-[10px] text-muted-foreground">
                                            Moyenne: {getStudentAverage(student.id) || 'N/A'}
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
                    {/* Header with actions */}
                    <div className="flex items-center justify-between">
                        <Select value={selectedExamType} onValueChange={setSelectedExamType}>
                            <SelectTrigger className="w-40 bg-card border-border/50">
                                <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tous les types</SelectItem>
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
                            Nouvelle Note
                        </Button>
                    </div>

                    {/* Class average card */}
                    <div className="bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/20 rounded-lg">
                                    <GraduationCap className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Moyenne de classe</p>
                                    <p className="text-2xl font-bold">{getClassAverage() || 'N/A'}/20</p>
                                </div>
                            </div>
                            <div className="text-right text-sm text-muted-foreground">
                                <p>{grades.length} notes</p>
                                <p>{students.length} élèves</p>
                            </div>
                        </div>
                    </div>

                    {/* Add new grades form */}
                    {addingGrade && (
                        <Card className="bg-card border-primary/30">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Edit3 className="w-4 h-4" />
                                    Saisie des notes
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-2">
                                    <Select
                                        value={newGrade.subjectId}
                                        onValueChange={(v) => setNewGrade(prev => ({ ...prev, subjectId: v }))}
                                    >
                                        <SelectTrigger className="bg-background">
                                            <SelectValue placeholder="Matière" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {teacherSubjects.map(subject => (
                                                <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Select
                                        value={newGrade.examType}
                                        onValueChange={(v) => setNewGrade(prev => ({ ...prev, examType: v }))}
                                    >
                                        <SelectTrigger className="bg-background">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {EXAM_TYPES.map(type => (
                                                <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {students.map(student => (
                                        <div key={student.id} className="flex items-center gap-3">
                                            <span className="text-sm flex-1 truncate">{student.full_name}</span>
                                            <Input
                                                type="number"
                                                min="0"
                                                max="20"
                                                step="0.5"
                                                placeholder="/20"
                                                className="w-20 h-8 text-center"
                                                value={newGrade.grades[student.id] || ''}
                                                onChange={(e) => setNewGrade(prev => ({
                                                    ...prev,
                                                    grades: { ...prev.grades, [student.id]: e.target.value }
                                                }))}
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-2">
                                    <Button variant="outline" className="flex-1" onClick={() => setAddingGrade(false)}>
                                        Annuler
                                    </Button>
                                    <Button className="flex-1 gap-2" onClick={handleSaveNewGrades}>
                                        <Save className="w-4 h-4" />
                                        Enregistrer
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
                            {students.map(student => {
                                const studentGrades = grades
                                    .filter(g => g.student_id === student.id)
                                    .filter(g => selectedExamType === 'all' || g.assessment_type === selectedExamType)
                                const avg = getStudentAverage(student.id)

                                return (
                                    <div key={student.id} className="bg-card p-4 rounded-xl border border-border/50">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarFallback>{student.full_name.substring(0, 2)}</AvatarFallback>
                                                </Avatar>
                                                <span className="font-medium text-sm">{student.full_name}</span>
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
                                                    <span
                                                        key={g.id}
                                                        className={cn(
                                                            "text-xs px-2 py-1 rounded-md",
                                                            g.value >= 10 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                                                        )}
                                                    >
                                                        {g.assessment_type}: {g.value}/20
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-muted-foreground">Aucune note</p>
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
                                                <p className="text-xs text-muted-foreground">Élèves</p>
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
                                                <p className="text-xs text-muted-foreground">Moyenne</p>
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
                                                <p className="text-xs text-muted-foreground">Notes</p>
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
                                                <p className="text-xs text-muted-foreground">Présences</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Attendance Stats */}
                            <Card className="bg-card border-border/50">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Taux de présence</CardTitle>
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
                                                        <span className="text-emerald-500">Présents</span>
                                                        <span>{Math.round((presentCount / total) * 100)}%</span>
                                                    </div>
                                                    <Progress value={(presentCount / total) * 100} className="h-2 bg-muted" />
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-amber-500">Retards</span>
                                                        <span>{Math.round((lateCount / total) * 100)}%</span>
                                                    </div>
                                                    <Progress value={(lateCount / total) * 100} className="h-2 bg-muted [&>div]:bg-amber-500" />
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-red-500">Absents</span>
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
                                    <CardTitle className="text-sm">Répartition des notes</CardTitle>
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
                                                    <span className="text-xs w-24 text-muted-foreground">Excellent (16+)</span>
                                                    <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                                                        <div
                                                            className="h-full bg-emerald-500 rounded-full transition-all"
                                                            style={{ width: `${(excellent / total) * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-medium w-8">{excellent}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs w-24 text-muted-foreground">Bien (12-16)</span>
                                                    <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                                                        <div
                                                            className="h-full bg-blue-500 rounded-full transition-all"
                                                            style={{ width: `${(good / total) * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-medium w-8">{good}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs w-24 text-muted-foreground">Passable (10-12)</span>
                                                    <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                                                        <div
                                                            className="h-full bg-amber-500 rounded-full transition-all"
                                                            style={{ width: `${(average / total) * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-medium w-8">{average}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs w-24 text-muted-foreground">Insuffisant (&lt;10)</span>
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
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-500">
                            <CheckCircle2 className="w-5 h-5" />
                            <div>
                                <span className="font-medium">Appel du jour</span>
                                <span className="text-xs ml-2 text-emerald-400">
                                    {stats.present} présents • {stats.late} retards • {stats.absent} absents
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
                            Valider
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
                                        <span className="text-sm font-medium">{student.full_name}</span>
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
                            <p className="text-muted-foreground">Aucun cours programmé pour cette classe</p>
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
                                                    <p className="font-medium text-sm">{slot.subject?.name || 'Matière'}</p>
                                                    {slot.room && (
                                                        <p className="text-xs text-muted-foreground">Salle {slot.room}</p>
                                                    )}
                                                </div>
                                                <div className="px-2 py-1 bg-primary/10 rounded text-xs text-primary">
                                                    {(() => {
                                                        const start = slot.start_time.split(':').map(Number)
                                                        const end = slot.end_time.split(':').map(Number)
                                                        const duration = (end[0] * 60 + end[1]) - (start[0] * 60 + start[1])
                                                        return `${duration}min`
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
            </Tabs>
        </div>
    )
}

