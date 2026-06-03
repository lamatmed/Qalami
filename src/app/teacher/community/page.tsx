'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useTeacher } from '@/context/teacher-context'
import { useLanguage } from '@/i18n'
import { useReadNotifications } from '@/hooks/use-read-notifications'
import { motion } from 'framer-motion'
import { Megaphone, CalendarDays, Loader2, Pin, Clock, MapPin, ChevronRight, AlertTriangle, GraduationCap, Users, BookOpen, Globe } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface Announcement {
    id: string
    title: string
    content: string
    priority: string
    target_audience: string[]
    expires_at: string | null
    created_at: string
}

interface SchoolEvent {
    id: string
    title: string
    description: string | null
    event_type: string
    start_date: string
    end_date: string | null
    all_day: boolean
    location: string | null
    color: string | null
    visibility: string[]
    created_at: string
}
interface ClassOption { id: string; name: string }

function relDate(d: string, t: any, language: string) {
    const diff = (Date.now() - new Date(d).getTime()) / 1000
    if (diff < 60) return t('teacher.community.relDate.justNow') || 'À l\'instant'
    if (diff < 3600) return (t('teacher.community.relDate.minutesAgo') || 'Il y a {mins}min').replace('{mins}', Math.floor(diff / 60).toString())
    if (diff < 86400) return (t('teacher.community.relDate.hoursAgo') || 'Il y a {hours}h').replace('{hours}', Math.floor(diff / 3600).toString())
    return new Date(d).toLocaleDateString(language === 'ar' ? 'ar-MR' : 'fr-FR', { day: 'numeric', month: 'short' })
}

function decodeAudience(raw: string[]) {
    const roles = raw.filter(x => !x.startsWith('cls:'))
    const classIds = raw.filter(x => x.startsWith('cls:')).map(x => x.slice(4))
    return { roles, classIds }
}

export function audienceSummary(raw: string[], classes: ClassOption[], t: any) {
    const { roles, classIds } = decodeAudience(raw)
    const rLabel = roles.includes('all') || roles.length === 0 ? (t('teacher.community.audience.all') || 'Tous')
        : roles.map(r => r === 'eleves' ? (t('teacher.community.roles.students') || 'Élèves') : r === 'parents' ? (t('teacher.community.roles.parents') || 'Parents') : (t('teacher.community.roles.teachers') || 'Enseignants')).join(', ')
    if (classIds.length === 0) return `${rLabel} · ${t('teacher.community.audience.wholeSchool') || "Toute l'école"}`
    const cNames = classIds.map(id => classes.find(c => c.id === id)?.name ?? id).join(', ')
    return `${rLabel} · ${cNames}`
}

export default function TeacherCommunityPage() {
    const { t, language } = useLanguage()
    const { teacherId, schoolId, classes, loading: ctxLoading } = useTeacher()
    const { readIds } = useReadNotifications(teacherId)
    const supabase = createClient()
    const [announcements, setAnnouncements] = useState<Announcement[]>([])
    const [events, setEvents] = useState<SchoolEvent[]>([])
    const [allClasses, setAllClasses] = useState<ClassOption[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'announcements' | 'events'>('announcements')

    const PRIORITIES = [
        { value: 'normal',  label: t('teacher.community.priorities.normal') || 'Normale',  cls: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
        { value: 'high',    label: t('teacher.community.priorities.high') || 'Haute',    cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
        { value: 'urgent',  label: t('teacher.community.priorities.urgent') || 'Urgente',  cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
        { value: 'low',     label: t('teacher.community.priorities.low') || 'Basse',    cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    ]
    const EVENT_TYPES = [
        { value: 'meeting',   label: t('teacher.community.eventTypes.meeting') || 'Réunion',    color: '#6366f1' },
        { value: 'exam',      label: t('teacher.community.eventTypes.exam') || 'Examen',     color: '#f59e0b' },
        { value: 'holiday',   label: t('teacher.community.eventTypes.holiday') || 'Congé',      color: '#10b981' },
        { value: 'activity',  label: t('teacher.community.eventTypes.activity') || 'Activité',   color: '#8b5cf6' },
        { value: 'sport',     label: t('teacher.community.eventTypes.sport') || 'Sport',      color: '#3b82f6' },
        { value: 'cultural',  label: t('teacher.community.eventTypes.cultural') || 'Culturel',   color: '#ec4899' },
        { value: 'other',     label: t('teacher.community.eventTypes.other') || 'Autre',      color: '#6b7280' },
    ]

    const pInfo = (p: string) => PRIORITIES.find(x => x.value === p) ?? PRIORITIES[0]
    const typeInfo = (tVal: string) => EVENT_TYPES.find(e => e.value === tVal) ?? EVENT_TYPES[EVENT_TYPES.length - 1]

    useEffect(() => {
        async function fetchData() {
            if (!schoolId) return
            setLoading(true)
            
            const targetKeys = ['all', 'enseignants', ...classes.map(c => `cls:${c.id}`)]

            const [ { data: allAnn }, { data: ev }, { data: cls } ] = await Promise.all([
                supabase.from('announcements')
                    .select('*')
                    .eq('school_id', schoolId)
                    .order('created_at', { ascending: false })
                    .limit(50),
                supabase.from('events')
                    .select('*')
                    .eq('school_id', schoolId)
                    .overlaps('visibility', targetKeys)
                    .order('start_date', { ascending: true }),
                supabase.from('classes')
                    .select('id, name')
                    .eq('school_id', schoolId)
            ])

            const filteredAnn = (allAnn || []).filter((a: any) => {
                if (a.target_audience) {
                    let audArray: string[] = []
                    if (Array.isArray(a.target_audience)) {
                        audArray = a.target_audience
                    } else if (typeof a.target_audience === 'string') {
                        try {
                            audArray = JSON.parse(a.target_audience)
                        } catch {
                            audArray = a.target_audience.split(',').map((s: string) => s.trim())
                        }
                    }
                    if (audArray.length > 0) {
                        return audArray.some(t => targetKeys.includes(t))
                    }
                }
                if (a.target_scope === 'school') return true
                if (a.target_scope === 'class' && a.target_class_id) return classes.some(c => c.id === a.target_class_id)
                return false
            })

            setAnnouncements(filteredAnn)
            setEvents(ev || [])
            setAllClasses(cls || [])
            setLoading(false)
        }

        if (!ctxLoading && schoolId) {
            fetchData()
        }
    }, [schoolId, classes, ctxLoading])

    if (ctxLoading || loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
            </div>
        )
    }

    const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }
    const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }
    const now = new Date()

    return (
        <div className="max-w-4xl mx-auto pb-24 space-y-6">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 flex items-center justify-center">
                    <Megaphone className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                    <h1 className="text-2xl font-black tracking-tight">{t('teacher.community.title')}</h1>
                    <p className="text-sm text-slate-500 font-medium">{t('teacher.community.subtitle')}</p>
                </div>
            </motion.div>

            {/* TABS */}
            <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('announcements')}
                    className={cn('flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all', activeTab === 'announcements' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300')}
                >
                    <Megaphone className="w-4 h-4" />
                    {t('teacher.community.announcements').replace('{count}', announcements.length.toString())}
                </button>
                <button
                    onClick={() => setActiveTab('events')}
                    className={cn('flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all', activeTab === 'events' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300')}
                >
                    <CalendarDays className="w-4 h-4" />
                    {t('teacher.community.events').replace('{count}', events.length.toString())}
                </button>
            </div>

            {/* CONTENT */}
            {activeTab === 'announcements' && (
                <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
                    {announcements.length === 0 ? (
                        <div className="py-20 text-center bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-150 dark:border-white/5">
                            <Megaphone className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                            <p className="font-bold text-slate-500">{t('teacher.community.noAnnouncements')}</p>
                        </div>
                    ) : (
                        announcements.map((ann) => {
                            const isUnread = !readIds.includes(ann.id)
                            const pi = pInfo(ann.priority)
                            const isExpired = ann.expires_at ? new Date(ann.expires_at) < new Date() : false
                            const summary = audienceSummary(ann.target_audience || [], allClasses, t)

                            return (
                                <Link key={ann.id} href={`/teacher/community/announcements/${ann.id}`} className="block">
                                    <motion.div variants={item} className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-150 dark:border-white/5 p-5 shadow-sm hover:border-indigo-500/30 transition-all group relative">
                                        {isUnread && <div className="absolute top-5 right-5 w-2 h-2 rounded-full bg-red-500" />}
                                        <div className="flex justify-between items-start mb-2 pr-4">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className={cn("font-bold text-lg", isUnread ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300")}>
                                                    {ann.title}
                                                </h3>
                                                <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border', pi.cls)}>{pi.label}</span>
                                                {isExpired && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-500/20 text-gray-400 border border-gray-500/30">{t('teacher.community.expired')}</span>}
                                            </div>
                                        </div>
                                        <p className="text-slate-600 dark:text-slate-400 text-sm line-clamp-2">{ann.content}</p>
                                        <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-slate-400">{relDate(ann.created_at, t, language)}</span>
                                                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                                    <Globe className="w-3 h-3" /> {summary}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 text-[11px] font-bold text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {t('teacher.community.viewDetails')} <ChevronRight className="w-3 h-3" />
                                            </div>
                                        </div>
                                    </motion.div>
                                </Link>
                            )
                        })
                    )}
                </motion.div>
            )}

            {activeTab === 'events' && (
                <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
                    {events.length === 0 ? (
                        <div className="py-20 text-center bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-150 dark:border-white/5">
                            <CalendarDays className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                            <p className="font-bold text-slate-500">{t('teacher.community.noEvents')}</p>
                        </div>
                    ) : (
                        events.map((ev) => {
                            const isPast = new Date(ev.start_date) < now
                            const isUnread = !readIds.includes(ev.id)
                            const ti = typeInfo(ev.event_type)
                            const summary = audienceSummary(ev.visibility || [], allClasses, t)

                            return (
                                <Link key={ev.id} href={`/teacher/community/events/${ev.id}`} className="block">
                                    <motion.div variants={item} className={cn("relative bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-150 dark:border-white/5 p-5 shadow-sm flex gap-4 hover:border-indigo-500/30 transition-all group", isPast && "opacity-60")}>
                                        {isUnread && <div className="absolute top-5 right-5 w-2 h-2 rounded-full bg-red-500" />}
                                        <div className="w-14 h-14 shrink-0 rounded-2xl flex flex-col items-center justify-center overflow-hidden border" style={{ backgroundColor: ti.color + '15', borderColor: ti.color + '30', color: ti.color }}>
                                            <span className="text-[10px] font-black uppercase">{new Date(ev.start_date).toLocaleDateString(language === 'ar' ? 'ar-MR' : 'fr-FR', { month: 'short' })}</span>
                                            <span className="text-xl font-black leading-none">{new Date(ev.start_date).getDate()}</span>
                                        </div>
                                        <div className="flex-1 min-w-0 pr-4">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <h3 className={cn("font-bold text-lg truncate", isUnread ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300")}>{ev.title}</h3>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: ti.color + '22', color: ti.color }}>{ti.label}</span>
                                                {isPast && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/20 text-slate-500">{t('teacher.community.past')}</span>}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-3 text-xs font-bold mt-1 text-slate-500 dark:text-slate-400">
                                                <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> 
                                                    {ev.all_day ? t('teacher.community.allDay') : new Date(ev.start_date).toLocaleTimeString(language === 'ar' ? 'ar-MR' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                {ev.location && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {ev.location}</span>}
                                            </div>
                                            {ev.description && <p className="text-slate-600 dark:text-slate-400 text-sm mt-3 line-clamp-2">{ev.description}</p>}
                                            
                                            <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
                                                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                                    <Globe className="w-3 h-3" /> {summary}
                                                </span>
                                                <div className="flex items-center gap-1 text-[11px] font-bold text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {t('teacher.community.viewDetails')} <ChevronRight className="w-3 h-3" />
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                </Link>
                            )
                        })
                    )}
                </motion.div>
            )}
        </div>
    )
}
