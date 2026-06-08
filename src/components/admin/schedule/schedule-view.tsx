'use client'

import { useState, useEffect } from 'react'
import { Plus, User, MapPin, Trash2, AlertTriangle, School, ChevronLeft, ChevronRight, Calendar, Phone, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AddCourseDialog } from './add-course-dialog'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useLanguage } from '@/i18n'
import { toast } from 'sonner'
import { getMySchoolContext } from '@/app/admin/actions'
import { fetchScheduleForAdmin } from '@/app/admin/schedule/actions'

// ─── Constants ─────────────────────────────────────────────────────────────────

const hours = [8, 10, 12, 14, 16, 18]

const SESSION_TYPE_CONFIG: Record<string, { accent: string; border: string }> = {
    course:   { accent: 'bg-blue-500',    border: 'border-blue-500/30' },
    exam:     { accent: 'bg-red-500',     border: 'border-red-500/30' },
    homework: { accent: 'bg-amber-500',   border: 'border-amber-500/30' },
    revision: { accent: 'bg-purple-500',  border: 'border-purple-500/30' },
    lab:      { accent: 'bg-emerald-500', border: 'border-emerald-500/30' },
    activity: { accent: 'bg-cyan-500',    border: 'border-cyan-500/30' },
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

function teacherDisplayName(fullName: string | null | undefined, email: string | null | undefined, fallback: string): string {
    const n = (fullName ?? '').trim()
    if (n) return n
    const e = (email ?? '').trim()
    if (e) return e.includes('@') ? e.split('@')[0]! : e
    return fallback
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
    teacherPhone: string | null
    color: string
    sessionType: string
    teacherId: string
    conflict: boolean
    isOtherSchool?: boolean
    schoolName?: string
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
        t('admin.schedule.saturday'),
        t('admin.schedule.sunday'),
    ]
    const dayIndexMap: Record<string, number> = {
        [days[0]]: 1, [days[1]]: 2, [days[2]]: 3, [days[3]]: 4, [days[4]]: 5, [days[5]]: 6, [days[6]]: 0,
    }

    const [courses, setCourses]           = useState<Course[]>([])
    const [loading, setLoading]           = useState(true)
    const [selectedDay, setSelectedDay]   = useState(days[0])
    const [internalRefresh, setInternalRefresh] = useState(0)
    const [isAddModalOpen, setIsAddModalOpen]   = useState(false)
    const [selectedSlot, setSelectedSlot] = useState<{ day: string; hour: number; dayIndex: number; date: Date } | null>(null)
    const [weekOffset, setWeekOffset]     = useState(0)

    const refreshKey = (externalRefreshKey ?? 0) + internalRefresh

    useEffect(() => {
        const activeId = viewMode === 'class' ? classId : teacherId
        if (!activeId) { setCourses([]); setLoading(false); return }

        async function fetchSchedule() {
            setLoading(true)
            try {
                const today = new Date()
                const currentDay = today.getDay()
                const diffToMon = today.getDate() - (currentDay === 0 ? 6 : currentDay - 1) + (weekOffset * 7)
                const weekStart = new Date(new Date().setDate(diffToMon))
                weekStart.setHours(0, 0, 0, 0)
                const weekEnd = new Date(weekStart)
                weekEnd.setDate(weekStart.getDate() + 7)

                const startStr = weekStart.toISOString().split('T')[0]
                const endStr   = weekEnd.toISOString().split('T')[0]

                const dayMapping: Record<number, string> = {
                    1: t('admin.schedule.monday'),
                    2: t('admin.schedule.tuesday'),
                    3: t('admin.schedule.wednesday'),
                    4: t('admin.schedule.thursday'),
                    5: t('admin.schedule.friday'),
                    6: t('admin.schedule.saturday'),
                    0: t('admin.schedule.sunday'),
                }

                const res = await fetchScheduleForAdmin({
                    classId: viewMode === 'class' ? classId : undefined,
                    teacherId: viewMode === 'teacher' ? teacherId : undefined,
                    startStr,
                    endStr
                })

                if ('error' in res) {
                    throw new Error(res.error)
                }

                const { schedule: data, allSlots, currentSchoolId } = res

                const slotCounts = new Map<string, number>()
                ;(allSlots || []).forEach(s => {
                    const hour = parseInt(s.start_time.split(':')[0])
                    const key = `${s.teacher_id}:${s.day_of_week}:${hour}`
                    slotCounts.set(key, (slotCounts.get(key) || 0) + 1)
                })
                const conflictKeys = new Set<string>()
                slotCounts.forEach((count, key) => { if (count > 1) conflictKeys.add(key) })

                const processedCourses: Course[] = (data || []).map(slot => {
                    const isOtherSchool = slot.school_id !== currentSchoolId
                    const hour        = parseInt(slot.start_time.split(':')[0])

                    const sObj        = slot.schools as { name?: string } | null
                    const schoolName  = sObj?.name || t('admin.schedule.otherSchoolTitle')

                    const subjectName = isOtherSchool ? t('admin.schedule.unavailable') : ((slot.subjects as { name?: string })?.name || t('common.subjects'))
                    const tObj = slot.profiles as { full_name?: string; email?: string; phone?: string | null } | null
                    const teacherName = teacherDisplayName(tObj?.full_name, tObj?.email, t('common.teacher'))
                    const className   = isOtherSchool ? schoolName : ((slot.classes  as { name?: string })?.name || t('common.class'))
                    const conflict    = conflictKeys.has(`${slot.teacher_id}:${slot.day_of_week}:${hour}`)

                    return {
                        id:          slot.id,
                        day:         dayMapping[slot.day_of_week] || days[0],
                        hour,
                        subject:     subjectName,
                        label:       viewMode === 'class' ? teacherName : className,
                        teacherName,
                        room:        isOtherSchool ? '' : (slot.room || ''),
                        teacherPhone: isOtherSchool ? null : (tObj?.phone || null),
                        color:       isOtherSchool ? 'bg-zinc-700/40' : getSubjectColor(subjectName),
                        sessionType: isOtherSchool ? 'course' : (slot.session_type || 'course'),
                        teacherId:   slot.teacher_id,
                        conflict:    !isOtherSchool && conflict,
                        isOtherSchool,
                        schoolName
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
    }, [classId, teacherId, viewMode, refreshKey, weekOffset])

    const getCourse = (day: string, startHour: number) => courses.find(c => c.day === day && c.hour >= startHour && c.hour < startHour + 2)

    const handleSlotClick = (day: string, hour: number, dayIndex: number, relativeDayIdx: number) => {
        if (viewMode === 'teacher') return

        const slotDate = new Date(monday)
        slotDate.setDate(monday.getDate() + relativeDayIdx)

        setSelectedSlot({ day, hour, dayIndex, date: slotDate })
        setIsAddModalOpen(true)
    }

    const handleDeleteCourse = async (courseId: string) => {
        const supabase = createClient()
        const { error } = await supabase.from('schedule').delete().eq('id', courseId)
        if (error) {
            toast.error(t('admin.schedule.deleteError'))
        } else {
            toast.success(t('admin.schedule.courseDeleted'))
            setInternalRefresh(k => k + 1)
        }
    }

    const conflictingCourses = courses.filter(c => c.conflict)
    const conflictingTeachers = [...new Set(conflictingCourses.map(c => c.teacherName))]

    const activeId = viewMode === 'class' ? classId : teacherId

    if (!activeId) {
        return (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                {viewMode === 'class' ? t('admin.schedule.selectClassPrompt') : t('admin.schedule.selectTeacherPrompt')}
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

    const today = new Date()
    const currentDay = today.getDay()
    const diffToMon = today.getDate() - (currentDay === 0 ? 6 : currentDay - 1) + (weekOffset * 7)
    const monday = new Date(new Date().setDate(diffToMon))
    const weekDates = days.map((_, i) => {
        const d = new Date(monday)
        d.setDate(monday.getDate() + i)
        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`
    })

    return (
        <div className="flex flex-col h-[calc(100vh-280px)] min-h-[500px] gap-4">
            {/* Conflict banner */}
            {conflictingCourses.length > 0 && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 text-red-400 text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                        <strong>{conflictingCourses.length} {t('admin.schedule.conflictDetected')}</strong>
                        {conflictingTeachers.length > 0 && (
                            <> — {conflictingTeachers.join(', ')} {t('admin.schedule.conflictSimultaneous')}</>
                        )}
                    </span>
                </div>
            )}

            {/* Week Navigation */}
            <div className="flex items-center justify-between bg-[#161B22] p-2 rounded-2xl border border-white/5 gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-white h-9 rounded-xl"
                    onClick={() => setWeekOffset(prev => prev - 1)}
                >
                    <ChevronLeft className="w-4 h-4 me-1" />
                    <span className="hidden sm:inline">{t('admin.schedule.previousWeek')}</span>
                </Button>

                <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-emerald-500 hidden sm:block" />
                    <span className="text-sm font-bold text-white whitespace-nowrap bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                        {weekDates[0]} - {weekDates[6]}
                    </span>
                    {weekOffset !== 0 && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px] px-2 rounded-md border-white/10 bg-white/5 text-gray-400 hover:text-white"
                            onClick={() => setWeekOffset(0)}
                        >
                            {t('common.today')}
                        </Button>
                    )}
                </div>

                <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-white h-9 rounded-xl"
                    onClick={() => setWeekOffset(prev => prev + 1)}
                >
                    <span className="hidden sm:inline">{t('admin.schedule.nextWeek')}</span>
                    <ChevronRight className="w-4 h-4 ms-1" />
                </Button>
            </div>

            {/* Mobile Day Selector */}
            <div className="lg:hidden flex overflow-x-auto pb-2 gap-2 no-scrollbar">
                {days.map((day, idx) => (
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
                        {day} ({weekDates[idx]})
                    </button>
                ))}
            </div>

            <div className="bg-[#161B22] rounded-3xl border border-white/5 overflow-hidden flex flex-col flex-1">
                {/* Header / Days */}
                <div className="flex border-b border-white/5 bg-[#0D1117]">
                    <div className="w-16 sm:w-20 p-4 border-r border-white/5 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-gray-500 uppercase">{t('admin.schedule.hour')}</span>
                    </div>
                    <div className="hidden lg:grid grid-cols-7 flex-1">
                        {days.map((day, idx) => (
                            <div key={day} className="p-4 border-r border-white/5 last:border-r-0 text-center flex flex-col">
                                <span className="text-sm font-bold text-white uppercase tracking-wider">{day}</span>
                                <span className="text-[10px] text-gray-500 font-medium mt-0.5">{weekDates[idx]}</span>
                            </div>
                        ))}
                    </div>
                    <div className="lg:hidden flex-1 p-4 flex flex-col items-center justify-center">
                        <span className="text-sm font-bold text-white uppercase tracking-wider">{selectedDay}</span>
                        <span className="text-[10px] text-gray-500 font-medium mt-0.5">{weekDates[days.indexOf(selectedDay)]}</span>
                    </div>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto no-scrollbar">
                    <div className="flex">
                        {/* Time Column */}
                        <div className="w-16 sm:w-20 flex flex-col border-r border-white/5 bg-[#0D1117]/50 shrink-0">
                            {hours.map(hour => (
                                <div key={hour} className="h-32 border-b border-white/5 flex flex-col items-center justify-center gap-1">
                                    <span className="text-xs font-mono text-gray-300 font-bold">{hour}h</span>
                                    <span className="text-[10px] font-mono text-gray-600">{hour + 2}h</span>
                                </div>
                            ))}
                        </div>

                        {/* Desktop: all days */}
                        <div className="hidden lg:grid grid-cols-7 flex-1">
                            {days.map((day, dayIdx) => (
                                <div key={day} className="flex flex-col border-r border-white/5 last:border-r-0">
                                    {hours.map(hour => {
                                        const course = getCourse(day, hour)
                                        return (
                                            <Slot
                                                key={`${day}-${hour}`}
                                                course={course}
                                                viewMode={viewMode}
                                                onClick={() => !course && handleSlotClick(day, hour, dayIndexMap[day] || 1, dayIdx)}
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
                                const selectedDayIdx = days.indexOf(selectedDay)
                                return (
                                    <Slot
                                        key={`${selectedDay}-${hour}`}
                                        course={course}
                                        viewMode={viewMode}
                                        onClick={() => !course && handleSlotClick(selectedDay, hour, dayIndexMap[selectedDay] || 1, selectedDayIdx)}
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
    const { t } = useLanguage()
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
                        "h-full w-full rounded-xl p-2 sm:p-3 relative group overflow-hidden transition-all cursor-default border",
                        course.isOtherSchool
                            ? "border-zinc-800 bg-zinc-900/40 opacity-75"
                            : (course.conflict
                                ? "border-red-500/40 bg-red-500/5 bg-[#0D1117]"
                                : (sessionConfig?.border || 'border-white/5') + " bg-[#0D1117]"),
                        !course.isOtherSchool && "hover:border-white/10"
                    )}
                >
                    {/* Left accent bar */}
                    <div className={cn(
                        "absolute top-0 left-0 w-1 h-full",
                        course.isOtherSchool ? "bg-zinc-600" : (course.conflict ? "bg-red-500" : (sessionConfig?.accent || course.color))
                    )} />

                    {/* Conflict indicator */}
                    {course.conflict && (
                        <div className="absolute top-1 right-7 text-red-400" title={t('admin.schedule.conflictPlanningTitle')}>
                            <AlertTriangle className="w-3 h-3" />
                        </div>
                    )}

                    {/* Other school indicator */}
                    {course.isOtherSchool && (
                        <div className="absolute top-2 right-2 text-zinc-500" title={t('admin.schedule.otherSchoolTitle')}>
                            <Lock className="w-3 h-3" />
                        </div>
                    )}

                    <div className="flex justify-between items-start mb-1">
                        <div className="flex flex-col gap-0.5 min-w-0 max-w-[80%]">
                            <span className={cn(
                                "text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded-md bg-white/5 truncate",
                                course.isOtherSchool ? "text-zinc-400" : course.color.replace('bg-', 'text-')
                            )}>
                                {course.subject}
                            </span>
                            {!course.isOtherSchool && sessionConfig && (
                                <span className={cn(
                                    "text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-white/5 truncate",
                                    sessionConfig?.accent.replace('bg-', 'text-')
                                )}>
                                    {t(`admin.schedule.sessionType.${course.sessionType}`) || course.sessionType}
                                </span>
                            )}
                        </div>
                        {!course.isOtherSchool && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    if (confirm(t('admin.schedule.deleteConfirm'))) onDelete(course.id)
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400"
                                title={t('common.delete')}
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    <div className="mt-1 sm:mt-2 space-y-0.5 sm:space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-400">
                            {viewMode === 'teacher'
                                ? <School className="w-3 h-3 shrink-0" />
                                : <User className="w-3 h-3 shrink-0" />
                            }
                            <span className="truncate">{course.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-500">
                            {course.room ? (
                                <>
                                    <MapPin className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{course.room}</span>
                                </>
                            ) : (
                                course.teacherPhone && (
                                    <>
                                        <Phone className="w-3 h-3 shrink-0 text-emerald-500/70" />
                                        <span className="truncate font-mono text-gray-400">{course.teacherPhone}</span>
                                    </>
                                )
                            )}
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
