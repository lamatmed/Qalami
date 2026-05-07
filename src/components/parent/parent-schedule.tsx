'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, MapPin, AlertCircle, Clock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { useParent } from '@/context/parent-context'
import { createClient } from '@/utils/supabase/client'
import {
    DAY_NAMES_FR,
    WEEK_DAYS_SHORT,
    getSessionConfig,
    getSubjectBorderColor,
} from '@/lib/schedule-constants'

interface ScheduleItem {
    id: string
    subject_name: string
    subject_icon: string | null
    start_time: string
    end_time: string
    room: string
    teacher_name: string | null
    day_of_week: number
    session_type: string | null
}

interface ParentScheduleProps {
    studentId?: string
}

export function ParentSchedule({ studentId }: ParentScheduleProps = {}) {
    const { selectedChild, loading } = useParent()
    const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([])
    const [loadingData, setLoadingData] = useState(false)

    // Convert JS day (0=Sun, 1=Mon...) to our system (1=Mon, 7=Sun)
    const getConvertedDay = () => {
        const jsDay = new Date().getDay()
        return jsDay === 0 ? 7 : jsDay
    }
    const [selectedDay, setSelectedDay] = useState(getConvertedDay)

    const effectiveStudentId = studentId || selectedChild?.id

    const weekDays = WEEK_DAYS_SHORT
    const dayNames = DAY_NAMES_FR

    useEffect(() => {
        async function fetchSchedule() {
            if (!effectiveStudentId) return

            setLoadingData(true)
            const supabase = createClient()

            try {
                // First get the student's class
                const { data: enrollment } = await supabase
                    .from('enrollments')
                    .select('class_id')
                    .eq('student_id', effectiveStudentId)
                    .single()

                if (enrollment?.class_id) {
                    const { data: schedule } = await supabase
                        .from('schedule')
                        .select(`
                            id,
                            day_of_week,
                            start_time,
                            end_time,
                            room,
                            session_type,
                            subjects (name, icon),
                            profiles!schedule_teacher_id_fkey (full_name)
                        `)
                        .eq('class_id', enrollment.class_id)
                        .order('start_time', { ascending: true })

                    if (schedule) {
                        setScheduleItems(schedule.map((s: {
                            id: string
                            day_of_week: number
                            start_time: string
                            end_time: string
                            room: string
                            subjects: { name: string } | null
                            profiles: { full_name: string } | null
                        }) => ({
                            id: s.id,
                            subject_name: s.subjects?.name || 'Cours',
                            subject_icon: (s.subjects as any)?.icon || null,
                            start_time: s.start_time,
                            end_time: s.end_time,
                            room: s.room || 'Non définie',
                            teacher_name: s.profiles?.full_name || null,
                            day_of_week: s.day_of_week,
                            session_type: (s as any).session_type || null
                        })))
                    }
                }
            } catch (err) {
                console.error('Error fetching schedule:', err)
            }

            setLoadingData(false)
        }

        fetchSchedule()
    }, [effectiveStudentId])

    const formatTime = (time: string) => {
        return time?.substring(0, 5) || ''
    }

    const todaySchedule = scheduleItems.filter(s => s.day_of_week === selectedDay)

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!effectiveStudentId) {
        return (
            <div className="max-w-md mx-auto lg:max-w-3xl lg:ms-12 lg:me-auto p-4">
                <div className="bg-card border border-border rounded-3xl p-6 text-center">
                    <p className="text-muted-foreground">Aucun enfant sélectionné.</p>
                </div>
            </div>
        )
    }

    const isEmbedded = !!studentId

    return (
        <div className={isEmbedded ? "space-y-6" : "max-w-md mx-auto lg:max-w-3xl lg:ms-12 lg:me-auto pb-24 space-y-6 p-4"}>
            {/* Header - only show when not embedded */}
            {!isEmbedded && selectedChild && (
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-border">
                            <AvatarImage src="https://github.com/shadcn.png" />
                            <AvatarFallback>{selectedChild.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                            <span className="font-bold text-lg">Calendrier</span>
                            <span className="text-xs text-muted-foreground">{selectedChild.name} - {selectedChild.class}</span>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" className="rounded-full">
                        <AlertCircle className="w-5 h-5" />
                    </Button>
                </div>
            )}

            {/* Day Selector */}
            <div className="bg-card border border-border/50 rounded-3xl p-4">
                <div className="flex items-center justify-between mb-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => setSelectedDay(d => d > 1 ? d - 1 : 7)}
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="font-bold">{dayNames[selectedDay]}</span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => setSelectedDay(d => d < 7 ? d + 1 : 1)}
                    >
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>

                <div className="grid grid-cols-7 gap-2 text-center">
                    {/* Days: Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6, Sun=7 */}
                    {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                        <div
                            key={day}
                            onClick={() => setSelectedDay(day)}
                            className={cn(
                                "h-10 w-10 flex items-center justify-center rounded-full text-sm cursor-pointer transition-colors",
                                selectedDay === day ? "bg-cyan-500 text-black font-bold shadow-[0_0_10px_rgba(6,182,212,0.5)]" : "hover:bg-white/10"
                            )}
                        >
                            {weekDays[day - 1]}
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold">{dayNames[selectedDay]}</h2>
                    {selectedDay === getConvertedDay() && (
                        <span className="px-2 py-1 rounded-lg bg-cyan-500/20 text-cyan-500 text-[10px] font-bold border border-cyan-500/20">AUJOURD'HUI</span>
                    )}
                </div>

                {loadingData && (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                )}

                {!loadingData && todaySchedule.length === 0 && (
                    <div className="bg-card border border-border/50 rounded-2xl p-6 text-center">
                        <p className="text-muted-foreground">Aucun cours prévu ce jour.</p>
                    </div>
                )}

                <div className="space-y-4 relative">
                    {/* Time line decorative line */}
                    {todaySchedule.length > 0 && (
                        <div className="absolute left-[3.25rem] top-4 bottom-4 w-px bg-white/5" />
                    )}

                    {todaySchedule.map((item) => {
                        const sessionType = item.session_type || 'course'
                        const sessionConfig = getSessionConfig(sessionType)
                        return (
                        <div key={item.id} className="flex gap-4 group">
                            <div className="w-10 text-xs text-muted-foreground font-medium pt-3 flex-shrink-0 text-right">
                                {formatTime(item.start_time)}
                            </div>

                            <div className={cn(
                                "flex-1 bg-card border border-border/50 p-4 rounded-2xl relative overflow-hidden transition-all hover:border-border",
                                getSubjectBorderColor(item.subject_name),
                                "border-l-4"
                            )}>
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        {item.subject_icon && (
                                            <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-white/10 font-bold text-[10px]">
                                                {item.subject_icon}
                                            </span>
                                        )}
                                        <h3 className="font-bold text-sm">{item.subject_name}</h3>
                                        {sessionType !== 'course' && (
                                            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/5", sessionConfig.text)}>
                                                {sessionConfig.label}
                                            </span>
                                        )}
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 -mt-1 -mr-2">
                                        <MapPin className="w-3 h-3" />
                                    </Button>
                                </div>

                                <div className="text-xs text-muted-foreground space-y-1">
                                    <div className="flex items-center gap-1.5">
                                        <Clock className="w-3 h-3 opacity-50" />
                                        <span>{formatTime(item.start_time)} - {formatTime(item.end_time)}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <MapPin className="w-3 h-3 opacity-50" />
                                        <span>{item.room}</span>
                                    </div>
                                    {item.teacher_name && (
                                        <div className="text-cyan-500/80 pt-1">{item.teacher_name}</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                    })}
                </div>
            </div>
        </div>
    )
}
