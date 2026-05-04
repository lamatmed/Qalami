'use client'

import { useMemo } from 'react'
import { Bell, ChevronRight, Clock, MapPin } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ScheduleItem {
    id: string
    day_of_week: number
    subject: string
    teacher: string
    room: string
    start_time: string
    end_time: string
}

interface Props {
    schedule: ScheduleItem[]
}

const DAY_NAMES = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM']

export function StudentScheduleView({ schedule }: Props) {
    // Get current day (0 = Monday in our system, JS Date uses 0 = Sunday)
    const today = new Date()
    const currentDayOfWeek = today.getDay() === 0 ? 6 : today.getDay() - 1 // Convert to Monday = 0
    const currentTime = `${today.getHours().toString().padStart(2, '0')}:${today.getMinutes().toString().padStart(2, '0')}`

    // Generate week dates
    const weekDays = useMemo(() => {
        const days = []
        const startOfWeek = new Date()
        startOfWeek.setDate(startOfWeek.getDate() - currentDayOfWeek)

        for (let i = 0; i < 5; i++) {
            const date = new Date(startOfWeek)
            date.setDate(startOfWeek.getDate() + i)
            days.push({
                day: DAY_NAMES[i],
                date: date.getDate().toString(),
                dayOfWeek: i,
                active: i === currentDayOfWeek
            })
        }
        return days
    }, [currentDayOfWeek])

    // Filter schedule for today
    const todaySchedule = useMemo(() => {
        return schedule
            .filter(item => item.day_of_week === currentDayOfWeek)
            .map(item => {
                const isInProgress = item.start_time <= currentTime && item.end_time > currentTime
                const isPast = item.end_time <= currentTime
                return {
                    ...item,
                    status: isInProgress ? 'en-cours' : isPast ? 'passe' : 'a-venir'
                }
            })
    }, [schedule, currentDayOfWeek, currentTime])

    // Add lunch break if applicable
    const scheduleWithBreaks = useMemo(() => {
        const result: any[] = []
        let addedBreak = false

        for (const item of todaySchedule) {
            // Add lunch break between 11:30 and 13:00
            if (!addedBreak && item.start_time >= '13:00') {
                result.push({
                    id: 'break',
                    status: 'break',
                    time: '11:30 - 13:00',
                    label: 'PAUSE DÉJEUNER'
                })
                addedBreak = true
            }
            result.push(item)
        }
        return result
    }, [todaySchedule])

    const formatTime = (start: string, end: string) => {
        return `${start.slice(0, 5)} - ${end.slice(0, 5)}`
    }

    return (
        <div className="max-w-md mx-auto lg:max-w-3xl pb-24 space-y-6 p-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-border">
                        <AvatarImage src="https://github.com/shadcn.png" />
                        <AvatarFallback>AM</AvatarFallback>
                    </Avatar>
                    <span className="font-bold text-lg">Emploi du temps</span>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full relative">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-background" />
                </Button>
            </div>

            {/* Date Selector */}
            <div className="bg-card border border-border/50 p-2 rounded-3xl flex justify-between items-center">
                {weekDays.map((d) => (
                    <div key={d.dayOfWeek} className={cn(
                        "flex flex-col items-center justify-center w-14 h-20 rounded-2xl transition-all cursor-pointer",
                        d.active ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/20 scale-105" : "hover:bg-white/5 text-muted-foreground"
                    )}>
                        <span className="text-[10px] font-bold mb-1">{d.day}</span>
                        <span className="text-xl font-bold">{d.date}</span>
                    </div>
                ))}
            </div>

            <div className="px-1">
                <h2 className="text-sm font-bold text-gray-400">
                    {today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h2>
            </div>

            {/* Timeline View */}
            <div className="relative pl-4 space-y-6">
                {/* Timeline Line */}
                <div className="absolute left-[5px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-cyan-500 via-gray-800 to-transparent opacity-30" />

                {scheduleWithBreaks.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                        Aucun cours prévu pour aujourd'hui
                    </div>
                ) : (
                    scheduleWithBreaks.map((item) => (
                        <div key={item.id} className="relative pl-6">
                            {/* Timeline Dot */}
                            <div className={cn(
                                "absolute left-[-4px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-4 border-background z-10",
                                item.status === 'en-cours' ? "bg-cyan-500 shadow-[0_0_10px_#06b6d4]" :
                                    item.status === 'passe' ? "bg-gray-600" : "bg-gray-800"
                            )} />

                            {item.status === 'break' ? (
                                <div className="flex items-center justify-center py-4 opacity-50">
                                    <span className="text-[10px] font-bold tracking-widest uppercase flex items-center gap-2">
                                        <span className="w-8 h-px bg-white/20" />
                                        ☕ {item.label} • {item.time}
                                        <span className="w-8 h-px bg-white/20" />
                                    </span>
                                </div>
                            ) : (
                                <div className={cn(
                                    "p-5 rounded-3xl border transition-all relative overflow-hidden group",
                                    item.status === 'en-cours' ? "bg-card border-cyan-500 shadow-lg shadow-cyan-500/5" :
                                        item.status === 'passe' ? "bg-card/30 border-border/30 opacity-60" :
                                            "bg-card/50 border-border/50 hover:bg-card hover:border-border"
                                )}>
                                    {item.status === 'en-cours' && (
                                        <div className="absolute top-4 right-4 animate-pulse">
                                            <span className="w-3 h-3 bg-cyan-500 rounded-full block shadow-[0_0_10px_#06b6d4]" />
                                        </div>
                                    )}

                                    {item.status === 'en-cours' && <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-wider mb-2 block">En Cours</span>}

                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-bold text-lg mb-1">{item.subject}</h3>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <Avatar className="w-4 h-4">
                                                    <AvatarFallback className="text-[8px]">PR</AvatarFallback>
                                                </Avatar>
                                                {item.teacher}
                                            </div>
                                        </div>
                                        {item.status === 'en-cours' && (
                                            <div className="w-16 h-16 bg-cyan-500/10 rounded-2xl flex items-center justify-center border border-cyan-500/20">
                                                <Clock className="w-8 h-8 text-cyan-500 opacity-50" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-4 text-xs font-medium text-gray-400 bg-black/20 p-3 rounded-xl border border-white/5">
                                        <span className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-cyan-500" /> {formatTime(item.start_time, item.end_time)}</span>
                                        <span className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-emerald-500" /> {item.room}</span>
                                    </div>

                                    <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
