'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Clock, Loader2, BookOpen, FlaskConical, ClipboardList, RotateCcw, Dumbbell, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

const SESSION_TYPES = [
    { value: 'course',   label: 'Cours',    icon: BookOpen },
    { value: 'exam',     label: 'Examen',   icon: ClipboardList },
    { value: 'homework', label: 'Devoir',   icon: Zap },
    { value: 'revision', label: 'Révision', icon: RotateCcw },
    { value: 'lab',      label: 'TP',       icon: FlaskConical },
    { value: 'activity', label: 'Activité', icon: Dumbbell },
]
import { useLanguage } from '@/i18n'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'

interface SubjectOption {
    id: string
    name: string
}

interface TeacherOption {
    id: string
    full_name: string
}

interface Assignment {
    teacher_id: string
    subject_id: string
    profiles: { full_name: string | null } | null
}

export function AddCourseDialog({
    isOpen,
    onClose,
    onAdd,
    selectedSlot,
    classId
}: {
    isOpen: boolean,
    onClose: () => void,
    onAdd: () => void,
    selectedSlot: { day: string, hour: number, dayIndex: number } | null,
    classId?: string
}) {
    const { t } = useLanguage()
    const [subjects, setSubjects] = useState<SubjectOption[]>([])
    const [assignments, setAssignments] = useState<Assignment[]>([])
    const [selectedSubject, setSelectedSubject] = useState('')
    const [selectedTeacher, setSelectedTeacher] = useState('')
    const [sessionType, setSessionType] = useState('course')
    const [room, setRoom] = useState('')
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(true)

    // Filter teachers — use teacher_id directly (it's already the profile UUID)
    const filteredTeachers: TeacherOption[] = selectedSubject
        ? assignments
            .filter(a => a.subject_id === selectedSubject)
            .map(a => ({ id: a.teacher_id, full_name: a.profiles?.full_name || 'Enseignant' }))
            .filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i)
        : []

    // Fetch subjects, teachers, and assignments from DB
    useEffect(() => {
        if (!isOpen) return

        async function fetchData() {
            setLoading(true)
            const supabase = createClient()

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setLoading(false); return }

            const { data: profile } = await supabase
                .from('profiles')
                .select('school_id')
                .eq('id', user.id)
                .single()

            if (!profile?.school_id) { setLoading(false); return }

            // Fetch subjects for the school
            const { data: subjectsData } = await supabase
                .from('subjects')
                .select('id, name')
                .eq('school_id', profile.school_id)
                .order('name')

            // Fetch assignments — exact same syntax as assignments page
            let assignmentsQuery = supabase
                .from('teacher_assignments')
                .select('teacher_id, subject_id, profiles:teacher_id(full_name)')
            if (classId) assignmentsQuery = assignmentsQuery.eq('class_id', classId)
            const { data: assignmentsData, error: assignmentsError } = await assignmentsQuery

            if (assignmentsError) console.error('Assignments error:', assignmentsError.message)

            setSubjects(subjectsData || [])
            setAssignments((assignmentsData || []) as unknown as Assignment[])
            setLoading(false)
        }

        fetchData()
    }, [isOpen, classId])

    // Reset form when dialog opens
    useEffect(() => {
        if (isOpen) {
            setSelectedSubject('')
            setSelectedTeacher('')
            setSessionType('course')
            setRoom('')
        }
    }, [isOpen])

    const handleSave = async () => {
        if (!selectedSubject) {
            toast.error('Veuillez sélectionner une matière')
            return
        }
        if (!selectedTeacher) {
            toast.error('Veuillez sélectionner un enseignant')
            return
        }
        if (!classId) {
            toast.error('Veuillez sélectionner une classe')
            return
        }
        if (!selectedSlot) return

        setSaving(true)
        const supabase = createClient()

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            const { data: profile } = await supabase
                .from('profiles')
                .select('school_id')
                .eq('id', user.id)
                .single()

            if (!profile?.school_id) throw new Error('No school')

            const startHour = selectedSlot.hour
            const startTime = `${String(startHour).padStart(2, '0')}:00:00`
            const endTime = `${String(startHour + 1).padStart(2, '0')}:00:00`

            const { error } = await supabase.from('schedule').insert({
                school_id: profile.school_id,
                class_id: classId,
                subject_id: selectedSubject || null,
                teacher_id: selectedTeacher || null,
                day_of_week: selectedSlot.dayIndex,
                start_time: startTime,
                end_time: endTime,
                room: room || null,
                session_type: sessionType,
            })

            if (error) throw error

            toast.success('Cours ajouté avec succès')
            onAdd()
            onClose()
        } catch (err: any) {
            console.error('Error adding course:', err)
            toast.error(err.message || 'Erreur lors de l\'ajout')
        }

        setSaving(false)
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px] bg-card border-border text-foreground">
                <DialogHeader>
                    <DialogTitle>{t('admin.schedule.addCourse')}</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        {selectedSlot && (
                            <span className="flex items-center gap-2 mt-1 font-mono text-primary">
                                <Clock className="w-3 h-3" />
                                {selectedSlot.day} • {selectedSlot.hour}h00 - {selectedSlot.hour + 1}h00
                            </span>
                        )}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label className="text-muted-foreground text-xs uppercase font-bold">{t('common.subjects')}</Label>
                        {loading ? (
                            <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                                <Loader2 className="w-4 h-4 animate-spin" /> Chargement...
                            </div>
                        ) : (
                            <Select value={selectedSubject} onValueChange={(val) => { setSelectedSubject(val); setSelectedTeacher('') }}>
                                <SelectTrigger className="bg-muted border-border">
                                    <SelectValue placeholder={t('admin.schedule.selectSubject')} />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                    {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    <div className="grid gap-2">
                        <Label className={cn("text-xs uppercase font-bold", selectedSubject ? "text-muted-foreground" : "text-muted-foreground/40")}>
                            {t('common.teacher')}
                        </Label>
                        {loading ? (
                            <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                                <Loader2 className="w-4 h-4 animate-spin" /> Chargement...
                            </div>
                        ) : (
                            <Select
                                value={selectedTeacher}
                                onValueChange={setSelectedTeacher}
                                disabled={!selectedSubject}
                            >
                                <SelectTrigger className="bg-muted border-border disabled:opacity-40">
                                    <SelectValue placeholder={selectedSubject ? t('admin.schedule.selectTeacher') : 'Sélectionnez d\'abord une matière'} />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                    {filteredTeachers.length === 0 ? (
                                        <div className="px-2 py-3 text-sm text-muted-foreground text-center">Aucun enseignant assigné à cette matière pour cette classe</div>
                                    ) : (
                                        filteredTeachers.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)
                                    )}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    <div className="grid gap-2">
                        <Label className="text-muted-foreground text-xs uppercase font-bold">Type de séance</Label>
                        <div className="grid grid-cols-3 gap-2">
                            {SESSION_TYPES.map(st => {
                                const Icon = st.icon
                                return (
                                    <button
                                        key={st.value}
                                        type="button"
                                        onClick={() => setSessionType(st.value)}
                                        className={cn(
                                            "flex flex-col items-center gap-1 p-2 rounded-lg border text-xs font-bold transition-all",
                                            sessionType === st.value
                                                ? "bg-primary/20 border-primary/50 text-primary"
                                                : "bg-muted border-border text-muted-foreground hover:border-border/80"
                                        )}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {st.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label className="text-muted-foreground text-xs uppercase font-bold">{t('admin.schedule.room')}</Label>
                        <Input
                            placeholder="Ex: Salle 101, Labo 1..."
                            className="bg-muted border-border"
                            value={room}
                            onChange={e => setRoom(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        {t('common.cancel')}
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving || !selectedSubject || !selectedTeacher}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                    >
                        {saving && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                        {t('common.save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
