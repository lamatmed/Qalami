'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Clock, MapPin, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'
import { useLanguage } from '@/i18n'
import { getMySchoolContext } from '@/app/admin/actions'

const SESSION_TYPE_CONFIG: Record<string, { label: string; text: string }> = {
    course:   { label: 'Cours',    text: 'text-blue-400' },
    exam:     { label: 'Examen',   text: 'text-red-400' },
    homework: { label: 'Devoir',   text: 'text-amber-400' },
    revision: { label: 'Révision', text: 'text-purple-400' },
    lab:      { label: 'TP',       text: 'text-emerald-400' },
    activity: { label: 'Activité', text: 'text-cyan-400' },
}

interface ScheduleEvent {
    id: string
    subject: string
    className: string
    time: string
    room: string | null
    color: string
    sessionType: string
}

interface ScheduleDay {
    label: string
    dayOfWeek: number
    isToday: boolean
    events: ScheduleEvent[]
}

const colors = ['purple', 'blue', 'emerald', 'orange', 'pink', 'cyan']

export function TeacherSchedule({ teacherId }: { teacherId: string }) {
    const { t } = useLanguage()
    const [days, setDays] = useState<ScheduleDay[]>([])
    const [loading, setLoading] = useState(true)
 
    useEffect(() => {
        async function fetchSchedule() {
            setLoading(true)
            const supabase = createClient()
 
            const ctx = await getMySchoolContext()
            const currentSchoolId = ctx?.school_id

            const { data, error } = await supabase
                .from('schedule')
                .select(`
                    id,
                    day_of_week,
                    start_time,
                    end_time,
                    room,
                    session_type,
                    subjects (name),
                    classes!inner (name, school_id)
                `)
                .eq('teacher_id', teacherId)
                .eq('classes.school_id', currentSchoolId)
                .order('start_time')
 
            if (error) {
                console.error('Error fetching teacher schedule:', error)
                setLoading(false)
                return
            }
 
            const dayNames = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
            const todayDow = new Date().getDay() // 0=Sun, 1=Mon, ...
            // Convert JS day to our day_of_week (1=Mon, ..., 7=Sun)
            const todayMapped = todayDow === 0 ? 7 : todayDow
 
            // Group by day — deduplicate by (day, start, end, subject, class)
            const dayMap: Record<number, ScheduleEvent[]> = {}
            const seen = new Set<string>()
            for (const item of data || []) {
                const subjectName = (item.subjects as any)?.name || 'Matière'
                const className = (item.classes as any)?.name || ''
                const start = item.start_time.substring(0, 5)
                const end = item.end_time.substring(0, 5)
                const key = `${item.day_of_week}::${start}::${end}::${subjectName}::${className}`
                if (seen.has(key)) continue
                seen.add(key)

                if (!dayMap[item.day_of_week]) dayMap[item.day_of_week] = []
                dayMap[item.day_of_week].push({
                    id: item.id,
                    subject: `${subjectName}${className ? ' - ' + className : ''}`,
                    className,
                    time: `${start} - ${end}`,
                    room: item.room,
                    color: colors[dayMap[item.day_of_week].length % colors.length],
                    sessionType: (item as any).session_type || 'course'
                })
            }
 
            const result: ScheduleDay[] = Object.entries(dayMap)
                .map(([dow, events]) => ({
                    label: dayNames[parseInt(dow)] || `Jour ${dow}`,
                    dayOfWeek: parseInt(dow),
                    isToday: parseInt(dow) === todayMapped,
                    events
                }))
                .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
 
            setDays(result)
            setLoading(false)
        }
 
        fetchSchedule()
    }, [teacherId])
 
    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-64 rounded-3xl" />
                <Skeleton className="h-48 rounded-3xl" />
            </div>
        )
    }
 
    if (days.length === 0) {
        return (
            <div className="space-y-6">
                <h2 className="text-xl font-bold text-foreground">{t('admin.teachers.schedule.title')}</h2>
                <div className="bg-card rounded-3xl border border-border p-12 text-center text-muted-foreground">
                    <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>{t('admin.teachers.schedule.noCourses')}</p>
                </div>
            </div>
        )
    }
 
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground">{t('admin.teachers.schedule.title')}</h2>
            </div>

            <div className="space-y-4">
                {days.map((day) => (
                    <div key={day.dayOfWeek} className="bg-card rounded-3xl border border-border overflow-hidden">
                        <div className="p-4 bg-muted/50 border-b border-border flex justify-between items-center">
                            <h3 className="font-bold text-foreground flex items-center gap-2">
                                <CalendarDays className="w-4 h-4 text-muted-foreground" /> {t(`admin.teachers.schedule.days.${day.dayOfWeek}`)}
                            </h3>
                            {day.isToday && <Badge className="bg-primary text-primary-foreground font-bold text-[10px]">{t('admin.teachers.schedule.today')}</Badge>}
                        </div>

                        <div className="p-4 space-y-6 relative">
                            {/* Timeline Line */}
                            <div className="absolute left-9 top-8 bottom-8 w-0.5 bg-border" />

                            {day.events.map((event) => (
                                <div key={event.id} className="relative flex gap-6">
                                    {/* Timeline Dot */}
                                    <div className="flex flex-col items-center">
                                        <div className={cn(
                                            "w-10 h-10 rounded-full flex items-center justify-center z-10 border-2 shadow-lg",
                                            event.color === 'purple' ? "bg-purple-500/20 border-purple-500 text-purple-500" :
                                                event.color === 'blue' ? "bg-blue-500/20 border-blue-500 text-blue-500" :
                                                    event.color === 'emerald' ? "bg-emerald-500/20 border-emerald-500 text-emerald-500" :
                                                        event.color === 'orange' ? "bg-orange-500/20 border-orange-500 text-orange-500" :
                                                            event.color === 'pink' ? "bg-pink-500/20 border-pink-500 text-pink-500" :
                                                                "bg-cyan-500/20 border-cyan-500 text-cyan-500"
                                        )}>
                                            <Clock className="w-4 h-4" />
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 mt-1">
                                        <div className="group cursor-pointer">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-bold text-foreground text-lg group-hover:text-primary transition-colors">{event.subject}</h4>
                                                {event.sessionType !== 'course' && (
                                                    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/5 shrink-0", (SESSION_TYPE_CONFIG[event.sessionType] || SESSION_TYPE_CONFIG.course).text)}>
                                                        {t(`admin.teachers.schedule.sessionType.${event.sessionType}`) || (SESSION_TYPE_CONFIG[event.sessionType] || SESSION_TYPE_CONFIG.course).label}
                                                    </span>
                                                )}
                                            </div>
                                            {event.room && (
                                                <p className="text-muted-foreground text-xs flex items-center gap-2 mt-1">
                                                    <MapPin className="w-3 h-3" /> {event.room}
                                                </p>
                                            )}
                                            <p className={cn("text-xs font-bold mt-2",
                                                event.color === 'purple' ? "text-purple-400" :
                                                    event.color === 'blue' ? "text-blue-400" :
                                                        event.color === 'emerald' ? "text-emerald-400" :
                                                            event.color === 'orange' ? "text-orange-400" :
                                                                event.color === 'pink' ? "text-pink-400" :
                                                                    "text-cyan-400"
                                            )}>{event.time}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
