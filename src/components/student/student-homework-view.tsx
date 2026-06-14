'use client'

import { ChevronLeft, FileText, CheckCircle2, MoreHorizontal, Upload, BookOpen, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useState } from 'react'
import { useLanguage } from '@/i18n'

interface Homework {
    id: string
    title: string
    description: string | null
    due_date: string | null
    max_points: number | null
    subject: { id: string; name: string } | null
    class: { id: string; name: string } | null
    teacher: { id: string; full_name: string } | null
    submission: {
        status: string
        grade: number | null
        submitted_at: string
    } | null
}

interface Props {
    homework: Homework[]
}

export function StudentHomeworkView({ homework }: Props) {
    const [searchQuery, setSearchQuery] = useState('')
    const { t } = useLanguage()

    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(23, 59, 59, 999)

    // Filter by search
    const filtered = homework.filter(h =>
        h.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.subject?.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // Separate urgent (today/tomorrow) from later
    const urgent = filtered.filter(h => {
        if (!h.due_date) return false
        const due = new Date(h.due_date)
        return due <= tomorrow && !h.submission
    })

    const later = filtered.filter(h => {
        if (!h.due_date) return true
        const due = new Date(h.due_date)
        return due > tomorrow || !!h.submission
    })

    const formatDue = (dateStr: string | null) => {
        if (!dateStr) return t('student.homework.noLimit')
        const date = new Date(dateStr)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        const activeLocale = t('common.locale') === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR'

        if (date < today) return t('student.homework.overdue')
        if (date.toDateString() === today.toDateString()) {
            return t('student.homework.todayAt', { time: date.toLocaleTimeString(activeLocale, { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nouakchott' }) })
        }
        if (date.toDateString() === tomorrow.toDateString()) {
            return t('student.homework.tomorrowAt', { time: date.toLocaleTimeString(activeLocale, { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nouakchott' }) })
        }
        return date.toLocaleDateString(activeLocale, { weekday: 'short', day: 'numeric', month: 'short' })
    }

    const getSubjectColor = (name: string | undefined) => {
        if (!name) return 'text-gray-500'
        const lower = name.toLowerCase()
        if (lower.includes('math')) return 'text-cyan-500'
        if (lower.includes('phys')) return 'text-blue-500'
        if (lower.includes('français') || lower.includes('francais')) return 'text-purple-500'
        if (lower.includes('arabe')) return 'text-emerald-500'
        if (lower.includes('anglais')) return 'text-orange-500'
        return 'text-gray-400'
    }

    return (
        <div className="max-w-md mx-auto lg:max-w-3xl lg:ms-12 lg:me-auto pb-24 space-y-6 p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Link href="/student">
                        <Button variant="ghost" size="icon" className="-ml-2 rtl:-mr-2"><ChevronLeft className="rtl:rotate-180" /></Button>
                    </Link>
                    <h1 className="font-bold text-xl">{t('student.homework.title')}</h1>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                    placeholder={t('student.homework.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-[#0D1117] border-white/5 pl-9 rtl:pl-3 rtl:pr-9 h-10 text-sm text-white focus-visible:ring-emerald-500/50"
                />
            </div>

            {homework.length === 0 ? (
                <div className="text-center py-20 text-gray-500">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>{t('student.homework.noHomework')}</p>
                </div>
            ) : (
                <>
                    {/* Urgent Section */}
                    {urgent.length > 0 && (
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="font-bold text-lg">{t('student.homework.urgent')}</h2>
                                <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded border border-red-500/20">{t('student.homework.todayTomorrow')}</span>
                            </div>

                            <div className="space-y-4">
                                {urgent.map(hw => (
                                    <div key={hw.id} className="bg-card border border-border/50 p-5 rounded-3xl relative overflow-hidden group">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <span className={cn("text-[10px] font-bold uppercase tracking-wider mb-1 block", getSubjectColor(hw.subject?.name))}>
                                                    {hw.subject?.name ?? t('student.homework.subject')}
                                                </span>
                                                <h3 className="font-bold text-lg">{hw.title}</h3>
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-6 w-6"><MoreHorizontal className="w-4 h-4 text-muted-foreground" /></Button>
                                        </div>

                                        {hw.description && (
                                            <p className="text-xs text-muted-foreground flex-1 leading-relaxed mb-4 line-clamp-2">
                                                {hw.description}
                                            </p>
                                        )}

                                        <div className="flex items-center gap-3">
                                            <Link href={`/student/homework/${hw.id}`}>
                                                <Button size="sm" className="bg-cyan-500 hover:bg-cyan-600 text-black font-bold h-8 rounded-lg gap-2 text-xs px-4">
                                                    <Upload className="w-3.5 h-3.5" /> {t('student.homework.submit')}
                                                </Button>
                                            </Link>
                                            <span className="text-[10px] text-red-400 font-medium">
                                                {t('student.homework.dueDate')} {formatDue(hw.due_date)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Later/Completed Section */}
                    {later.length > 0 && (
                        <div className="pt-2">
                            <h2 className="font-bold text-lg mb-4">{urgent.length > 0 ? t('student.homework.laterCompleted') : t('student.homework.allHomework')}</h2>
                            <div className="space-y-4">
                                {later.map(hw => {
                                    const isSubmitted = !!hw.submission
                                    const isGraded = hw.submission?.grade !== null

                                    return (
                                        <div key={hw.id} className={cn(
                                            "bg-card border border-border/50 p-4 rounded-3xl flex gap-4",
                                            isSubmitted && "opacity-80"
                                        )}>
                                            <div className="flex-1">
                                                <div className="flex justify-between mb-1">
                                                    <span className={cn("text-[10px] font-bold uppercase", getSubjectColor(hw.subject?.name))}>
                                                        {hw.subject?.name ?? t('student.homework.subject')}
                                                    </span>
                                                    {isGraded && (
                                                        <span className="text-[9px] font-bold bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded">{t('student.homework.graded')}</span>
                                                    )}
                                                    {isSubmitted && !isGraded && (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                    )}
                                                </div>
                                                <h3 className={cn("font-bold text-sm mb-1", isSubmitted && "text-gray-300")}>{hw.title}</h3>
                                                {hw.description && (
                                                    <p className="text-[10px] text-muted-foreground mb-3 line-clamp-2">{hw.description}</p>
                                                )}

                                                {isGraded ? (
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex flex-col">
                                                            <span className="text-[8px] text-muted-foreground uppercase">{t('student.homework.note')}</span>
                                                            <span className="text-sm font-bold text-emerald-400">{hw.submission?.grade}/{hw.max_points ?? 20}</span>
                                                        </div>
                                                        <Button variant="outline" size="sm" className="h-6 text-[10px] border-white/10 bg-white/5">{t('student.homework.viewCorrection')}</Button>
                                                    </div>
                                                ) : isSubmitted ? (
                                                    <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded flex items-center gap-1 w-fit">
                                                        <CheckCircle2 className="w-3 h-3" /> {t('student.homework.submitted')}
                                                    </span>
                                                ) : (
                                                    <div className="flex items-center gap-3">
                                                        <Link href={`/student/homework/${hw.id}`}>
                                                            <Button size="sm" variant="secondary" className="h-7 text-[10px] bg-white/10 hover:bg-white/20 gap-1.5">
                                                                <Upload className="w-3 h-3" /> {t('student.homework.submit')}
                                                            </Button>
                                                        </Link>
                                                        <span className="text-[10px] text-gray-500">{formatDue(hw.due_date)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* FAB */}
            <div className="fixed bottom-24 right-6 lg:right-1/4">
                <Button size="icon" className="h-14 w-14 rounded-2xl bg-cyan-500 hover:bg-cyan-600 text-black shadow-xl shadow-cyan-500/30">
                    <FileText className="w-6 h-6" />
                </Button>
            </div>
        </div>
    )
}
