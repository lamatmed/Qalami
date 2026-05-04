'use client'

import { useState, useEffect } from 'react'
import { Plus, User, MapPin, Trash2, AlertTriangle, School } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AddCourseDialog } from './add-course-dialog'
import { createClient } from '@/utils/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'
import { useLanguage } from '@/i18n'
import { toast } from 'sonner'
import { getMySchoolContext } from '@/app/admin/actions'

// ─── Constants ─────────────────────────────────────────────────────────────────

const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17]

const SESSION_TYPE_CONFIG: Record<string, { label: string; accent: string; border: string }> = {
    course:   { label: 'Cours',    accent: 'bg-blue-500',    border: 'border-blue-500/30' },
    exam:     { label: 'Examen',   accent: 'bg-red-500',     border: 'border-red-500/30' },
    homework: { label: 'Devoir',   accent: 'bg-amber-500',   border: 'border-amber-500/30' },
    revision: { label: 'Révision', accent: 'bg-purple-500',  border: 'border-purple-500/30' },
    lab:      { label: 'TP',       accent: 'bg-emerald-500', border: 'border-emerald-500/30' },
    activity: { label: 'Activité', accent: 'bg-cyan-500',    border: 'border-cyan-500/30' },
}

const subjectColors: Record<string, string> = {
    'mathématiques': 'bg-blue-500',
    'français':      'bg-purple-500',
    'physique':      'bg-red-500',
    'anglais':       'bg-yellow-500',
    'svt':           'bg-emerald-500',
    'arabe':         'bg-amber-500',
    'histoire':      'bg-pink-500',
    'géographie':    'bg-cyan-500',
    'education islamique': 'bg-teal-500',
    'default':       'bg-gray-500',
}

function getSubjectColor(subject: string): string {
    const lower = subject.toLowerCase()
    for (const [key, color] of Object.entries(subjectColors)) {
        if (lower.includes(key)) return color
    }
    return subjectColors.default
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Course {
    id: string
    day: string
    hour: number
    subject: string
    label: string       // teacher name (class view) OR class name (teacher view)
    teacherName: string // always teacher name (for conflict banner)
    room: string
    color: string
    sessionType: string
    teacherId: string
    conflict: boolean
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function ScheduleView({
    classId,
    teacherId,
    viewMode = 'class',
    refreshKey: externalRefreshKey,
}: {
    classId?: string
    teacherId?: string
    viewMode?: 'class' | 'teacher'
    refreshKey?: number
}) {
    const { t } = useLanguage()
    const days = [
        t('admin.schedule.monday'),
        t('admin.schedule.tuesday'),
        t('admin.schedule.wednesday'),
        t('admin.schedule.thursday'),
        t('admin.schedule.friday'),
    ]
    const dayIndexMap: Record<string, number> = {
        [days[0]]: 1, [days[1]]: 2, [days[2]]: 3, [days[3]]: 4, [days[4]]: 5,
    }

    const [courses, setCourses]           = useState<Course[]>([])
    const [loading, setLoading]           = useState(true)
    const [selectedDay, setSelectedDay]   = useState(days[0])
    const [internalRefresh, setInternalRefresh] = useState(0)
    const [isAddModalOpen, setIsAddModalOpen]   = useState(false)
    const [selectedSlot, setSelectedSlot] = useState<{ day: string; hour: number; dayIndex: number } | null>(null)

    const refreshKey = (externalRefreshKey ?? 0) + internalRefresh

    useEffect(() => {
        const activeId = viewMode === 'class' ? classId : teacherId
        if (!activeId) { setCourses([]); setLoading(false); return }

        async function fetchSchedule() {
            setLoading(true)
            const supabase = createClient()

            try {
                const ctx = await getMySchoolContext()
                if (!ctx) return
                const profile = { school_id: ctx.school_id }

                const dayMapping: Record<number, string> = {
                    1: t('admin.schedule.monday'),
                    2: t('admin.schedule.tuesday'),
                    3: t('admin.schedule.wednesday'),
                    4: t('admin.schedule.thursday'),
                    5: t('admin.schedule.friday'),
                }

                // Main query — fetch for the selected class or teacher
                let query = supabase
                    .from('schedule')
                    .select(`
                        id, day_of_week, start_time, end_time, room, session_type,
                        teacher_id, class_id,
                        subjects!schedule_subject_id_fkey(name),
                        profiles!schedule_teacher_id_fkey(full_name),
                        classes!schedule_class_id_fkey(name)
                    `)
                    .eq('school_id', profile.school_id)

                if (viewMode === 'class' && classId) {
                    query = query.eq('class_id', classId)
                } else if (viewMode === 'teacher' && teacherId) {
                    query = query.eq('teacher_id', teacherId)
                }

                // Secondary query — all teacher-time pairs for conflict detection
                const [{ data }, { data: allSlots }] = await Promise.all([
                    query.order('day_of_week', { ascending: true }),
                    supabase
                        .from('schedule')
                        .select('teacher_id, day_of_week, start_time')
                        .eq('school_id', profile.school_id),
                ])

                // Build conflict set: teacher+day+hour combos that appear more than once
                const slotCounts = new Map<string, number>()
                ;(allSlots || []).forEach(s => {
                    const hour = parseInt(s.start_time.split(':')[0])
                    const key = `${s.teacher_id}:${s.day_of_week}:${hour}`
                    slotCounts.set(key, (slotCounts.get(key) || 0) + 1)
                })
                const conflictKeys = new Set<string>()
                slotCounts.forEach((count, key) => { if (count > 1) conflictKeys.add(key) })

                const processedCourses: Course[] = (data || []).map(slot => {
                    const hour        = parseInt(slot.start_time.split(':')[0])
                    const subjectName = (slot.subjects as { name?: string })?.name    || 'Matière'
                    const teacherName = (slot.profiles as { full_name?: string })?.full_name || 'Enseignant'
                    const className   = (slot.classes  as { name?: string })?.name     || 'Classe'
                    const conflict    = conflictKeys.has(`${slot.teacher_id}:${slot.day_of_week}:${hour}`)

                    return {
                        id:          slot.id,
                        day:         dayMapping[slot.day_of_week] || days[0],
                        hour,
                        subject:     subjectName,
                        label:       viewMode === 'class' ? teacherName : className,
                        teacherName,
                        room:        slot.room || t('admin.planning.noLocation'),
                        color:       getSubjectColor(subjectName),
                        sessionType: slot.session_type || 'course',
                        teacherId:   slot.teacher_id,
                        conflict,
                    }
                })

                setCourses(processedCourses)
            } catch (err) {
                console.error('Error fetching schedule:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchSchedule()
    }, [classId, teacherId, viewMode, refreshKey])

    const getCourse = (day: string, hour: number) => courses.find(c => c.day === day && c.hour === hour)

    const handleSlotClick = (day: string, hour: number) => {
        if (viewMode === 'teacher') return // can't add course in teacher view (no class context)
        setSelectedSlot({ day, hour, dayIndex: dayIndexMap[day] || 1 })
        setIsAddModalOpen(true)
    }

    const handleDeleteCourse = async (courseId: string) => {
        const supabase = createClient()
        const { error } = await supabase.from('schedule').delete().eq('id', courseId)
        if (error) {
            toast.error('Erreur lors de la suppression')
        } else {
            toast.success('Cours supprimé')
            setInternalRefresh(k => k + 1)
        }
    }

    // Conflict summary for banner
    const conflictingCourses = courses.filter(c => c.conflict)
    const conflictingTeachers = [...new Set(conflictingCourses.map(c => c.teacherName))]

    const activeId = viewMode === 'class' ? classId : teacherId

    if (!activeId) {
        return (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                {viewMode === 'class' ? 'Sélectionnez une classe' : 'Sélectionnez un enseignant'}
            </div>
        )
    }

    if (loading) {
        return (
            <div className="flex flex-col h-[calc(100vh-280px)] min-h-[500px] gap-4">
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {days.map(day => <Skeleton key={day} className="h-10 w-24 rounded-full" />)}
                </div>
                <Skeleton className="flex-1 rounded-3xl" />
            </div>
        )
    }

    return (
        <div className="flex flex-col h-[calc(100vh-280px)] min-h-[500px] gap-4">
            {/* Conflict banner */}
            {conflictingCourses.length > 0 && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 text-red-400 text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                        <strong>{conflictingCourses.length} conflit{conflictingCourses.length > 1 ? 's' : ''} détecté{conflictingCourses.length > 1 ? 's' : ''}</strong>
                        {conflictingTeachers.length > 0 && (
                            <> — {conflictingTeachers.join(', ')} a{conflictingTeachers.length > 1 ? 'ont' : ''} deux cours simultanés</>
                        )}
                    </span>
                </div>
            )}

            {/* Mobile Day Selector */}
            <div className="lg:hidden flex overflow-x-auto pb-2 gap-2 no-scrollbar">
                {days.map(day => (
                    <button
                        key={day}
                        onClick={() => setSelectedDay(day)}
                        className={cn(
                            "px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all",
                            selectedDay === day
                                ? "bg-emerald-500 text-black"
                                : "bg-[#161B22] text-gray-400 border border-white/5 hover:bg-white/5"
                        )}
                    >
                        {day}
                    </button>
                ))}
            </div>

            <div className="bg-[#161B22] rounded-3xl border border-white/5 overflow-hidden flex flex-col flex-1">
                {/* Header / Days */}
                <div className="flex border-b border-white/5 bg-[#0D1117]">
                    <div className="w-16 sm:w-20 p-4 border-r border-white/5 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-gray-500 uppercase">{t('admin.schedule.hour')}</span>
                    </div>
                    <div className="hidden lg:grid grid-cols-5 flex-1">
                        {days.map(day => (
                            <div key={day} className="p-4 border-r border-white/5 last:border-r-0 text-center">
                                <span className="text-sm font-bold text-white uppercase tracking-wider">{day}</span>
                            </div>
                        ))}
                    </div>
                    <div className="lg:hidden flex-1 p-4 flex items-center justify-center">
                        <span className="text-sm font-bold text-white uppercase tracking-wider">{selectedDay}</span>
                    </div>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto no-scrollbar">
                    <div className="flex">
                        {/* Time Column */}
                        <div className="w-16 sm:w-20 flex flex-col border-r border-white/5 bg-[#0D1117]/50 shrink-0">
                            {hours.map(hour => (
                                <div key={hour} className="h-32 border-b border-white/5 flex items-center justify-center">
                                    <span className="text-xs font-mono text-gray-500">{hour}:00</span>
                                </div>
                            ))}
                        </div>

                        {/* Desktop: all days */}
                        <div className="hidden lg:grid grid-cols-5 flex-1">
                            {days.map(day => (
                                <div key={day} className="flex flex-col border-r border-white/5 last:border-r-0">
                                    {hours.map(hour => {
                                        const course = getCourse(day, hour)
                                        return (
                                            <Slot
                                                key={`${day}-${hour}`}
                                                course={course}
                                                viewMode={viewMode}
                                                onClick={() => !course && handleSlotClick(day, hour)}
                                                onDelete={handleDeleteCourse}
                                            />
                                        )
                                    })}
                                </div>
                            ))}
                        </div>

                        {/* Mobile: selected day */}
                        <div className="lg:hidden flex-1 flex flex-col">
                            {hours.map(hour => {
                                const course = getCourse(selectedDay, hour)
                                return (
                                    <Slot
                                        key={`${selectedDay}-${hour}`}
                                        course={course}
                                        viewMode={viewMode}
                                        onClick={() => !course && handleSlotClick(selectedDay, hour)}
                                        onDelete={handleDeleteCourse}
                                    />
                                )
                            })}
                        </div>
                    </div>
                </div>

                <AddCourseDialog
                    isOpen={isAddModalOpen}
                    onClose={() => setIsAddModalOpen(false)}
                    onAdd={() => { setIsAddModalOpen(false); setInternalRefresh(k => k + 1) }}
                    selectedSlot={selectedSlot}
                    classId={classId}
                />
            </div>
        </div>
    )
}

// ─── Slot ──────────────────────────────────────────────────────────────────────

function Slot({
    course,
    viewMode,
    onClick,
    onDelete,
}: {
    course: Course | undefined
    viewMode: 'class' | 'teacher'
    onClick: () => void
    onDelete: (id: string) => void
}) {
    const sessionConfig = course
        ? (SESSION_TYPE_CONFIG[course.sessionType] || SESSION_TYPE_CONFIG.course)
        : null

    return (
        <div
            className="h-32 border-b border-white/5 p-1 sm:p-2 transition-colors hover:bg-white/[0.02]"
            onClick={onClick}
        >
            {course ? (
                <div
                    className={cn(
                        "h-full w-full rounded-xl bg-[#0D1117] border p-2 sm:p-3 relative group overflow-hidden transition-all cursor-default",
                        course.conflict
                            ? "border-red-500/40 bg-red-500/5"
                            : (sessionConfig?.border || 'border-white/5'),
                        "hover:border-white/10"
                    )}
                >
                    {/* Left accent bar */}
                    <div className={cn(
                        "absolute top-0 left-0 w-1 h-full",
                        course.conflict ? "bg-red-500" : (sessionConfig?.accent || course.color)
                    )} />

                    {/* Conflict indicator */}
                    {course.conflict && (
                        <div className="absolute top-1 right-7 text-red-400" title="Conflit de planning">
                            <AlertTriangle className="w-3 h-3" />
                        </div>
                    )}

                    <div className="flex justify-between items-start mb-1">
                        <div className="flex flex-col gap-0.5 min-w-0 max-w-[80%]">
                            <span className={cn(
                                "text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded-md bg-white/5 truncate",
                                course.color.replace('bg-', 'text-')
                            )}>
                                {course.subject}
                            </span>
                            {course.sessionType !== 'course' && (
                                <span className={cn(
                                    "text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-white/5 truncate",
                                    sessionConfig?.accent.replace('bg-', 'text-')
                                )}>
                                    {sessionConfig?.label}
                                </span>
                            )}
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                if (confirm('Supprimer ce cours ?')) onDelete(course.id)
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400"
                            title="Supprimer"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="mt-1 sm:mt-2 space-y-0.5 sm:space-y-1">
                        {/* Label: teacher name in class view, class name in teacher view */}
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-400">
                            {viewMode === 'teacher'
                                ? <School className="w-3 h-3 shrink-0" />
                                : <User className="w-3 h-3 shrink-0" />
                            }
                            <span className="truncate">{course.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-500">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{course.room}</span>
                        </div>
                    </div>
                </div>
            ) : (
                viewMode === 'class' ? (
                    <div
                        className="h-full w-full rounded-xl border border-dashed border-white/5 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer group"
                        onClick={onClick}
                    >
                        <div className="bg-emerald-500/10 p-2 rounded-full text-emerald-500 group-hover:scale-110 transition-transform">
                            <Plus className="w-4 h-4" />
                        </div>
                    </div>
                ) : (
                    <div className="h-full" />
                )
            )}
        </div>
    )
}
