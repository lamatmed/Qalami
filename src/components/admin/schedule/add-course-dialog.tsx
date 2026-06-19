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
import { Clock, Loader2, BookOpen, FlaskConical, ClipboardList, RotateCcw, Dumbbell, Zap, Repeat, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'

const SESSION_TYPE_VALUES = ['course', 'exam', 'homework', 'revision', 'lab', 'activity'] as const
const SESSION_TYPE_ICONS: Record<string, React.ElementType> = {
    course:   BookOpen,
    exam:     ClipboardList,
    homework: Zap,
    revision: RotateCcw,
    lab:      FlaskConical,
    activity: Dumbbell,
}

import { fetchTeachersForSchedule, fetchOccupiedTeachersForSlot, type ScheduleTeacherOption, type OccupiedTeacherInfo } from '@/app/admin/schedule/actions'
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
    selectedSlot: { day: string, hour: number, dayIndex: number, date: Date } | null,
    classId?: string
}) {
    const { t } = useLanguage()
    const [subjects, setSubjects] = useState<SubjectOption[]>([])
    const [assignments, setAssignments] = useState<Assignment[]>([])
    const [allTeachers, setAllTeachers] = useState<ScheduleTeacherOption[]>([])
    const [selectedSubject, setSelectedSubject] = useState('')
    const [selectedTeacher, setSelectedTeacher] = useState('')
    const [sessionType, setSessionType] = useState('course')
    const [room, setRoom] = useState('')
    const [isRecurring, setIsRecurring] = useState(false)
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(true)
    const [occupiedTeachers, setOccupiedTeachers] = useState<OccupiedTeacherInfo[]>([])

    // Teachers who teach the selected subject in this specific class (exact subject_id match)
    const teacherIdsForSubject = selectedSubject
        ? [...new Set(assignments.filter(a => a.subject_id === selectedSubject).map(a => a.teacher_id))]
        : []
    const filteredTeachers = allTeachers.filter(t => teacherIdsForSubject.includes(t.id))

    const yr = selectedSlot?.date.getFullYear()
    const mo = String((selectedSlot?.date.getMonth() ?? 0) + 1).padStart(2, '0')
    const da = String(selectedSlot?.date.getDate() ?? 0).padStart(2, '0')
    const eventDateStr = `${yr}-${mo}-${da}`

    const getTeacherConflict = (teacherId: string) => {
        if (!selectedSlot) return null
        const conflicts = occupiedTeachers.filter(o => o.teacherId === teacherId)
        if (conflicts.length === 0) return null

        if (isRecurring) {
            return conflicts[0]
        }

        return conflicts.find(o => o.isRecurring || o.eventDate === eventDateStr) || null
    }

    const selectedTeacherConflict = selectedTeacher ? getTeacherConflict(selectedTeacher) : null

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

            // Only show subjects assigned to this specific class via teacher_assignments
            let subjectsData: SubjectOption[] = []
            if (classId) {
                const { data: assignedSubjects } = await supabase
                    .from('teacher_assignments')
                    .select('subject_id, subjects:subject_id(id, name)')
                    .eq('class_id', classId)
                const seen = new Set<string>()
                subjectsData = ((assignedSubjects || []) as any[])
                    .map(a => a.subjects)
                    .filter((s): s is SubjectOption => Boolean(s?.id))
                    .filter(s => {
                        if (seen.has(s.id)) return false
                        seen.add(s.id)
                        return true
                    })
                    .sort((a, b) => a.name.localeCompare(b.name))
            } else {
                const { data } = await supabase
                    .from('subjects')
                    .select('id, name')
                    .eq('school_id', profile.school_id)
                    .order('name')
                subjectsData = data || []
            }

            // Assignments for this class: teacher_id + subject_id (for filtering teachers by subject)
            const { data: assignmentsData } = await supabase
                .from('teacher_assignments')
                .select('teacher_id, subject_id, profiles:teacher_id(full_name)')
                .eq('class_id', classId || '')

            const [{ teachers: teachersList }, occupiedRes] = await Promise.all([
                fetchTeachersForSchedule(),
                selectedSlot ? fetchOccupiedTeachersForSlot({
                    dayIndex: selectedSlot.dayIndex,
                    startTime: `${String(selectedSlot.hour).padStart(2, '0')}:00:00`,
                    endTime: `${String(selectedSlot.hour + 2).padStart(2, '0')}:00:00`
                }) : Promise.resolve({ occupied: [] })
            ])

            setSubjects(subjectsData || [])
            setAssignments((assignmentsData || []) as unknown as Assignment[])
            setAllTeachers(teachersList || [])
            setOccupiedTeachers(occupiedRes?.occupied || [])
            setLoading(false)
        }

        fetchData()
    }, [isOpen, classId, selectedSlot])

    useEffect(() => {
        if (isOpen) {
            setSelectedSubject('')
            setSelectedTeacher('')
            setSessionType('course')
            setRoom('')
            setIsRecurring(false)
        }
    }, [isOpen])

    const handleSave = async () => {
        if (!selectedSubject) {
            toast.error(t('admin.schedule.selectSubjectRequired'))
            return
        }
        if (!selectedTeacher) {
            toast.error(t('admin.schedule.selectTeacherRequired'))
            return
        }
        if (!classId) {
            toast.error(t('admin.schedule.selectClassRequired'))
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
            const endTime = `${String(startHour + 2).padStart(2, '0')}:00:00`

            const yr = selectedSlot.date.getFullYear()
            const mo = String(selectedSlot.date.getMonth() + 1).padStart(2, '0')
            const da = String(selectedSlot.date.getDate()).padStart(2, '0')
            const eventDateStr = `${yr}-${mo}-${da}`

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
                is_recurring: isRecurring,
                event_date: isRecurring ? null : eventDateStr
            })

            if (error) throw error

            toast.success(t('admin.schedule.courseAdded'))
            onAdd()
            onClose()
        } catch (err: any) {
            console.error('Error adding course:', err)
            toast.error(err.message || t('admin.schedule.addError'))
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
                                {selectedSlot.day} • {selectedSlot.hour}h00 - {selectedSlot.hour + 2}h00
                            </span>
                        )}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label className="text-muted-foreground text-xs uppercase font-bold">{t('common.subjects')}</Label>
                        {loading ? (
                            <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                                <Loader2 className="w-4 h-4 animate-spin" /> {t('common.loading')}
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
                                <Loader2 className="w-4 h-4 animate-spin" /> {t('common.loading')}
                            </div>
                        ) : (
                            <Select
                                value={selectedTeacher}
                                onValueChange={setSelectedTeacher}
                                disabled={!selectedSubject}
                            >
                                <SelectTrigger className="bg-muted border-border disabled:opacity-40">
                                    <SelectValue placeholder={selectedSubject ? t('admin.schedule.selectTeacher') : t('admin.schedule.selectSubjectFirst')} />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                    {filteredTeachers.length === 0 ? (
                                        <div className="px-2 py-3 text-sm text-muted-foreground text-center">{t('admin.schedule.noTeachers')}</div>
                                    ) : (
                                        filteredTeachers.map(emp => {
                                            const conflict = getTeacherConflict(emp.id)
                                            return (
                                                <SelectItem key={emp.id} value={emp.id} disabled={!!conflict}>
                                                    <div className="flex flex-col text-left py-0.5">
                                                        <div className="flex items-center gap-2">
                                                            <span className={cn("font-medium", conflict && "text-muted-foreground line-through")}>
                                                                {emp.full_name}
                                                            </span>
                                                            {conflict && (
                                                                <span className="text-[9px] font-bold text-red-400 border border-red-500/30 px-1.5 py-0.2 bg-red-500/10 rounded uppercase tracking-wider">
                                                                    {t('admin.schedule.unavailable')}
                                                                </span>
                                                            )}
                                                            {!conflict && emp.phone && (
                                                                <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded font-mono">
                                                                    {emp.phone}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {conflict ? (
                                                            <span className="text-[10px] text-red-400/70 mt-0.5 font-semibold">
                                                                {t('admin.schedule.teacherBusy')
                                                                    .replace('{schoolName}', conflict.schoolName)
                                                                    .replace('{className}', conflict.className)}
                                                            </span>
                                                        ) : (
                                                            emp.subjects.length > 0 && (
                                                                <span className="text-[10px] text-muted-foreground mt-0.5">
                                                                    {emp.subjects.slice(0, 2).join(', ')}{emp.subjects.length > 2 ? '…' : ''}
                                                                </span>
                                                            )
                                                        )}
                                                    </div>
                                                </SelectItem>
                                            )
                                        })
                                    )}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {selectedTeacherConflict && (
                        <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 animate-in fade-in slide-in-from-top-1">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            <div>
                                <span className="font-semibold">{t('admin.schedule.teacherUnavailable')}</span>{' : '}
                                <span className="font-semibold text-red-300">{selectedTeacherConflict.schoolName}</span>{' '}
                                ({selectedTeacherConflict.className})
                            </div>
                        </div>
                    )}

                    <div className="grid gap-2">
                        <Label className="text-muted-foreground text-xs uppercase font-bold">{t('admin.schedule.sessionTypeLabel')}</Label>
                        <div className="grid grid-cols-3 gap-2">
                            {SESSION_TYPE_VALUES.map(value => {
                                const Icon = SESSION_TYPE_ICONS[value]
                                return (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setSessionType(value)}
                                        className={cn(
                                            "flex flex-col items-center gap-1 p-2 rounded-lg border text-xs font-bold transition-all",
                                            sessionType === value
                                                ? "bg-primary/20 border-primary/50 text-primary"
                                                : "bg-muted border-border text-muted-foreground hover:border-border/80"
                                        )}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {t(`admin.schedule.sessionType.${value}`)}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label className="text-muted-foreground text-xs uppercase font-bold">{t('admin.schedule.room')}</Label>
                        <Input
                            placeholder={t('admin.schedule.roomPlaceholder')}
                            className="bg-muted border-border"
                            value={room}
                            onChange={e => setRoom(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border/50 mt-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                <Repeat className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col">
                                <Label className="text-sm font-bold text-foreground cursor-pointer" htmlFor="recurring-switch">
                                    {t('admin.schedule.recurringLabel')}
                                </Label>
                                <span className="text-[10px] text-muted-foreground">
                                    {isRecurring ? t('admin.schedule.recurringAllWeeks') : t('admin.schedule.recurringOnlyDate')}
                                </span>
                            </div>
                        </div>
                        <Switch id="recurring-switch" checked={isRecurring} onCheckedChange={setIsRecurring} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        {t('common.cancel')}
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving || !selectedSubject || !selectedTeacher || !!selectedTeacherConflict}
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
