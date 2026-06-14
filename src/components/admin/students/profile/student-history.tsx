'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Star, AlertTriangle, Clock, CheckCircle2, FileText, Download, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { createClient } from '@/utils/supabase/client'
import { useLanguage } from '@/i18n'

type FilterType = 'all' | 'grade' | 'remark'

interface HistoryEvent {
    id: string
    type: string
    category: 'grade' | 'remark'
    title: string
    date: string
    author: string
    content: string
    score: string | null
    icon: any
    color: string
}

export function StudentHistory({ studentId, schoolId }: { studentId: string; schoolId?: string }) {
    const { t } = useLanguage()
    const [filter, setFilter] = useState<FilterType>('all')
    const [events, setEvents] = useState<HistoryEvent[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            if (!studentId) return
            const supabase = createClient()

            let gradesQuery = supabase
                .from('grades')
                .select('id, value, max_value, assessment_type, term, comment, created_at, subjects!grades_subject_id_fkey(name)')
                .eq('student_id', studentId)

            if (schoolId) {
                gradesQuery = supabase
                    .from('grades')
                    .select('id, value, max_value, assessment_type, term, comment, created_at, subjects!grades_subject_id_fkey(name), terms!inner(school_id)')
                    .eq('student_id', studentId)
                    .eq('terms.school_id', schoolId)
            }

            let remarksQuery = supabase
                .from('remarks')
                .select('id, type, message, created_at, profiles!remarks_teacher_id_fkey(full_name)')
                .eq('student_id', studentId)

            if (schoolId) {
                remarksQuery = remarksQuery.eq('school_id', schoolId)
            }

            // Fetch grades and remarks in parallel
            const [gradesRes, remarksRes] = await Promise.all([
                gradesQuery
                    .order('created_at', { ascending: false })
                    .limit(20),
                remarksQuery
                    .order('created_at', { ascending: false })
                    .limit(20)
            ])

            const items: HistoryEvent[] = []

                // Map grades to events
                ; (gradesRes.data || []).forEach((g: any) => {
                    const subjectName = g.subjects?.name || 'Mati\u00e8re'
                    const score = `${g.value}/${g.max_value}`
                    const isGood = g.value >= (g.max_value * 0.7)
                    items.push({
                        id: g.id,
                        type: isGood ? 'grade_good' : 'grade',
                        category: 'grade',
                        title: `${isGood ? 'Bon r\u00e9sultat' : 'Note'} - ${subjectName}`,
                        date: g.created_at || '',
                        author: g.assessment_type || '',
                        content: g.comment || '',
                        score,
                        icon: isGood ? CheckCircle2 : Star,
                        color: isGood ? 'text-blue-500 bg-blue-500/10' : 'text-emerald-500 bg-emerald-500/10'
                    })
                })

                // Map remarks to events
                ; (remarksRes.data || []).forEach((r: any) => {
                    const isDiscipline = r.type === 'discipline' || r.type === 'warning'
                    items.push({
                        id: r.id,
                        type: r.type || 'remark',
                        category: 'remark',
                        title: isDiscipline ? 'Avertissement' : (r.type === 'absence' ? 'Absence' : 'Remarque'),
                        date: r.created_at || '',
                        author: r.profiles?.full_name || '',
                        content: r.message || '',
                        score: null,
                        icon: isDiscipline ? AlertTriangle : Clock,
                        color: isDiscipline ? 'text-red-500 bg-red-500/10' : 'text-gray-400 bg-gray-500/10'
                    })
                })

            // Sort by date (most recent first)
            items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            setEvents(items)
            setLoading(false)
        }
        load()
    }, [studentId, schoolId])

    const filteredEvents = events.filter(event => {
        if (filter === 'all') return true
        return event.category === filter
    })

    const handleGenerateReport = () => {
        const now = new Date()
        let report = `RAPPORT GLOBAL - \u00c9l\u00e8ve\n`
        report += `Date de g\u00e9n\u00e9ration: ${now.toLocaleDateString('fr-FR')}\n`
        report += `Ann\u00e9e scolaire: ${now.getFullYear() - 1}-${now.getFullYear()}\n`
        report += `====================================\n\n`

        const grades = events.filter(e => e.category === 'grade')
        const remarks = events.filter(e => e.category === 'remark')

        report += `NOTES (${grades.length})\n`
        report += `------------------------------------\n`
        grades.forEach(e => {
            const dg = e.date ? new Date(e.date) : null
            const dgStr = dg ? dg.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Nouakchott' }) + ' ' + dg.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nouakchott' }) : ''
            report += `\u2022 ${dgStr} - ${e.title}\n`
            if (e.content) report += `  ${e.content}\n`
            if (e.score) report += `  Score: ${e.score}\n`
            report += `\n`
        })

        report += `\nREMARQUES (${remarks.length})\n`
        report += `------------------------------------\n`
        remarks.forEach(e => {
            const dr = e.date ? new Date(e.date) : null
            const drStr = dr ? dr.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Nouakchott' }) + ' ' + dr.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nouakchott' }) : ''
            report += `\u2022 ${drStr} - ${e.title}\n`
            if (e.author) report += `  ${e.author}\n`
            if (e.content) report += `  ${e.content}\n`
            report += `\n`
        })

        report += `\n====================================\n`
        report += `Rapport g\u00e9n\u00e9r\u00e9 par Qalami - ${now.toLocaleString('fr-FR')}\n`

        const blob = new Blob([report], { type: 'text/plain;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `rapport-eleve-${now.toISOString().split('T')[0]}.txt`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)

        toast.success('Rapport global t\u00e9l\u00e9charg\u00e9', {
            description: `${events.length} \u00e9v\u00e9nements inclus`
        })
    }

    return (
        <div className="bg-[#1A2530] rounded-3xl border border-white/5 p-6 h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-700">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-gray-400" />
                    {t('admin.students.profile.history')}
                </h3>
                <Badge variant="outline" className="text-[10px] border-white/10 text-gray-400">
                    {filteredEvents.length === 0 
                        ? t('admin.students.profile.historyZeroEvents')
                        : filteredEvents.length === 1 
                            ? t('admin.students.profile.historyEventsCount', { count: 1 })
                            : t('admin.students.profile.historyEventsCountPlural', { count: filteredEvents.length })
                    }
                </Badge>
            </div>

            {/* Filters */}
            <div className="flex gap-2 mb-6">
                {(['all', 'grade', 'remark'] as FilterType[]).map((f) => (
                    <Button
                        key={f}
                        variant="ghost"
                        size="sm"
                        onClick={() => setFilter(f)}
                        className={cn(
                            "text-xs rounded-full px-4",
                            filter === f ? "bg-emerald-500/10 text-emerald-500" : "text-gray-500 hover:text-gray-300"
                        )}
                    >
                        {f === 'all' ? t('admin.students.profile.historyFilterAll') : f === 'grade' ? t('admin.students.profile.historyFilterGrades') : t('admin.students.profile.historyFilterRemarks')}
                    </Button>
                ))}
            </div>

            {/* Events List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {loading ? (
                    <div className="flex items-center justify-center p-12">
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                    </div>
                ) : filteredEvents.length === 0 ? (
                    <div className="text-center p-12 text-gray-500 text-sm">
                        {t('admin.students.profile.historyNoEvents')}
                    </div>
                ) : (
                    filteredEvents.map((event) => (
                        <div key={event.id} className="p-4 bg-[#0F1720] rounded-xl border border-white/5 hover:border-white/10 transition-all group">
                            <div className="flex gap-3">
                                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", event.color)}>
                                    <event.icon className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <h4 className="text-sm font-bold text-white">{event.title}</h4>
                                        {event.score && (
                                            <span className="text-sm font-bold text-emerald-500">{event.score}</span>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-gray-500 mt-0.5">
                                        {event.date ? (() => { const d = new Date(event.date); return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Nouakchott' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nouakchott' }) })() : ''}
                                        {event.author && ` \u2022 ${event.author}`}
                                    </p>
                                    {event.content && (
                                        <p className="text-xs text-gray-400 mt-2 line-clamp-2">{event.content}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Export */}
            <div className="pt-4 border-t border-white/5 mt-4">
                <Button
                    onClick={handleGenerateReport}
                    className="w-full bg-[#0F1720] hover:bg-white/5 text-gray-300 border border-white/5 h-10 rounded-xl"
                    disabled={events.length === 0}
                >
                    <Download className="w-4 h-4 mr-2" />
                    T&eacute;l&eacute;charger le rapport ({events.length} &eacute;v&eacute;nements)
                </Button>
            </div>
        </div>
    )
}
