/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSchoolContext } from '@/lib/use-school-context'
import { useLanguage } from '@/i18n'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
    CalendarDays, Plus, Search, Trash2, Pencil, X,
    Loader2, MapPin, Clock, Globe, Users, GraduationCap,
    BookOpen, ChevronDown, ChevronUp, School,
} from 'lucide-react'
import { cn } from '@/lib/utils'

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

const EVENT_TYPES = [
    { value: 'meeting',  labelKey: 'adminEvents.typeMeeting',  color: '#6366f1' },
    { value: 'exam',     labelKey: 'adminEvents.typeExam',     color: '#f59e0b' },
    { value: 'holiday',  labelKey: 'adminEvents.typeHoliday',  color: '#10b981' },
    { value: 'activity', labelKey: 'adminEvents.typeActivity', color: '#8b5cf6' },
    { value: 'sport',    labelKey: 'adminEvents.typeSport',    color: '#3b82f6' },
    { value: 'cultural', labelKey: 'adminEvents.typeCultural', color: '#ec4899' },
    { value: 'other',    labelKey: 'adminEvents.typeOther',    color: '#6b7280' },
]

const ROLES = [
    { value: 'eleves',      labelKey: 'adminAnnouncements.audienceStudents', icon: GraduationCap },
    { value: 'parents',     labelKey: 'adminAnnouncements.audienceParents',  icon: Users         },
    { value: 'enseignants', labelKey: 'adminAnnouncements.audienceTeachers', icon: BookOpen      },
]

function typeInfo(t: string) { return EVENT_TYPES.find(e => e.value === t) ?? EVENT_TYPES[EVENT_TYPES.length - 1] }

function formatEventDate(start: string, end: string | null, allDay: boolean, language: string) {
    const s = new Date(start)
    const locale = language === 'ar' ? 'ar-MA' : 'fr-FR'
    const tz = 'Africa/Nouakchott'
    const opts: Intl.DateTimeFormatOptions = allDay
        ? { day: 'numeric', month: 'short', year: 'numeric', timeZone: tz }
        : { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: tz }
    const startStr = s.toLocaleDateString(locale, opts)
    if (!end) return startStr
    const e = new Date(end)
    if (s.toDateString() === e.toDateString()) {
        return allDay ? startStr : `${startStr} → ${e.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: tz })}`
    }
    return `${startStr} → ${e.toLocaleDateString(locale, opts)}`
}

function encodeAudience(roles: string[], classIds: string[]): string[] {
    const r = roles.length === 0 || roles.includes('all') ? ['all'] : roles
    return [...r, ...classIds.map(id => `cls:${id}`)]
}
function decodeAudience(raw: string[]) {
    const roles = raw.filter(x => !x.startsWith('cls:'))
    const classIds = raw.filter(x => x.startsWith('cls:')).map(x => x.slice(4))
    return { roles, classIds }
}
function audienceSummary(raw: string[], classes: ClassOption[], t: any, language: string) {
    const { roles, classIds } = decodeAudience(raw)
    const separator = language === 'ar' ? '، ' : ', '
    const rLabel = roles.includes('all') || roles.length === 0 ? t('adminAnnouncements.audienceAll')
        : roles.map(r => {
            if (r === 'eleves') return t('adminAnnouncements.audienceStudents')
            if (r === 'parents') return t('adminAnnouncements.audienceParents')
            return t('adminAnnouncements.audienceTeachers')
        }).join(separator)
    if (classIds.length === 0) return `${rLabel} · ${t('adminAnnouncements.scopeSchool')}`
    const cNames = classIds.map(id => classes.find(c => c.id === id)?.name ?? id).join(separator)
    return `${rLabel} · ${cNames}`
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function Modal({ open, onClose, onSaved, editing, classes, schoolId, userId }: {
    open: boolean; onClose: () => void; onSaved: () => void
    editing: SchoolEvent | null; classes: ClassOption[]; schoolId: string; userId: string
}) {
    const supabase = createClient()
    const { t } = useLanguage()
    const [title, setTitle]           = useState('')
    const [description, setDescription] = useState('')
    const [type, setType]             = useState('meeting')
    const [startDate, setStartDate]   = useState('')
    const [startTime, setStartTime]   = useState('')
    const [endDate, setEndDate]       = useState('')
    const [endTime, setEndTime]       = useState('')
    const [allDay, setAllDay]         = useState(false)
    const [location, setLocation]     = useState('')
    const [saving, setSaving]         = useState(false)
    const [roles, setRoles]           = useState<string[]>(['all'])
    const [scopeAll, setScopeAll]     = useState(true)
    const [selClasses, setSelClasses] = useState<string[]>([])

    useEffect(() => {
        if (!open) return
        if (editing) {
            setTitle(editing.title); setDescription(editing.description || '')
            setType(editing.event_type)
            setStartDate(editing.start_date.slice(0, 10))
            setStartTime(!editing.all_day && editing.start_date.length > 10 ? editing.start_date.slice(11, 16) : '')
            setEndDate(editing.end_date ? editing.end_date.slice(0, 10) : '')
            setEndTime(!editing.all_day && editing.end_date && editing.end_date.length > 10 ? editing.end_date.slice(11, 16) : '')
            setAllDay(editing.all_day); setLocation(editing.location || '')
            const { roles: r, classIds } = decodeAudience(editing.visibility || [])
            setRoles(r.length ? r : ['all'])
            setSelClasses(classIds); setScopeAll(classIds.length === 0)
        } else {
            setTitle(''); setDescription(''); setType('meeting')
            setStartDate(''); setStartTime(''); setEndDate(''); setEndTime('')
            setAllDay(false); setLocation('')
            setRoles(['all']); setSelClasses([]); setScopeAll(true)
        }
    }, [editing, open])

    const toggleRole = (v: string) => {
        if (v === 'all') { setRoles(['all']); return }
        setRoles(prev => {
            const without = prev.filter(x => x !== 'all')
            return without.includes(v)
                ? (without.filter(x => x !== v).length === 0 ? ['all'] : without.filter(x => x !== v))
                : [...without, v]
        })
    }
    const toggleClass = (id: string) => setSelClasses(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

    const handleSave = async () => {
        if (!title.trim()) { toast.error(t('adminEvents.titleRequiredToast')); return }
        if (!startDate) { toast.error(t('adminEvents.startDateRequiredToast')); return }
        const fullStart = startDate + 'T' + (startTime || '00:00')
        const parsedStart = new Date(fullStart)
        if (isNaN(parsedStart.getTime())) { toast.error(t('adminEvents.startDateInvalidToast')); return }
        let parsedEnd: Date | null = null
        if (endDate && endDate.trim() !== '') {
            const fullEnd = endDate + 'T' + (endTime || '00:00')
            parsedEnd = new Date(fullEnd)
            if (isNaN(parsedEnd.getTime())) { toast.error(t('adminEvents.endDateInvalidToast')); return }
        }
        if (!scopeAll && selClasses.length === 0) { toast.error(t('adminEvents.selectClassToast')); return }
        setSaving(true)
        const audience = encodeAudience(roles, scopeAll ? [] : selClasses)
        const effectiveAllDay = allDay || !startTime.trim()
        const payload: any = {
            school_id: schoolId, title: title.trim(), description: description.trim() || null,
            event_type: type, start_date: parsedStart.toISOString(),
            end_date: parsedEnd ? parsedEnd.toISOString() : null,
            all_day: effectiveAllDay, location: location.trim() || null, color: typeInfo(type).color,
            visibility: audience, created_by: userId,
        }
        const { error } = editing
            ? await supabase.from('events').update(payload).eq('id', editing.id)
            : await supabase.from('events').insert(payload)
        setSaving(false)
        if (error) { toast.error(error.message); return }
        toast.success(editing ? t('adminEvents.updated') : t('adminEvents.created'))
        onSaved(); onClose()
    }

    if (!open) return null

    const inputCls = "w-full bg-[#0F1720] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/15 transition-colors [color-scheme:dark] placeholder:text-gray-600"

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
                className="bg-[#161B22] border border-white/5 rounded-2xl w-full max-w-2xl shadow-2xl shadow-black/50"
                onClick={e => e.stopPropagation()}>

                {/* Modal header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                    <h2 className="text-base font-bold text-white">{editing ? t('adminEvents.edit') : t('adminEvents.new')}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-6 space-y-4 max-h-[72vh] overflow-y-auto">

                    {/* Basic */}
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs text-gray-600 uppercase tracking-widest mb-1.5 block">{t('adminEvents.titleLabel')} *</label>
                            <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('adminEvents.titlePlaceholder')} className={inputCls} />
                        </div>
                        <div>
                            <label className="text-xs text-gray-600 uppercase tracking-widest mb-1.5 block">{t('adminEvents.descriptionLabel')}</label>
                            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={t('adminEvents.descriptionPlaceholder')} rows={2}
                                className={cn(inputCls, "resize-none")} />
                        </div>
                    </div>

                    {/* Type & Dates */}
                    <div className="bg-[#0F1720] rounded-xl border border-white/5 p-4 space-y-4">
                        <div>
                            <label className="text-xs text-gray-600 uppercase tracking-widest mb-2 block">{t('adminEvents.typeLabel')}</label>
                            <div className="flex flex-wrap gap-1.5">
                                {EVENT_TYPES.map(et => (
                                    <button key={et.value} type="button" onClick={() => setType(et.value)}
                                        className={cn('px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all',
                                            type === et.value ? 'text-white border-white/20' : 'bg-white/5 text-gray-500 border-white/5 hover:bg-white/10'
                                        )}
                                        style={type === et.value ? { backgroundColor: et.color + '33', borderColor: et.color + '66', color: et.color } : {}}>
                                        {t(et.labelKey)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <label className="text-xs text-gray-600 uppercase tracking-widest block">{t('adminEvents.startDate')} *</label>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
                                {!allDay && (
                                    <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                                        placeholder={t('adminEvents.timePlaceholder')} className={inputCls} />
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-gray-600 uppercase tracking-widest block">{t('adminEvents.endDate')}</label>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
                                {!allDay && (
                                    <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                                        placeholder={t('adminEvents.timePlaceholder')} className={inputCls} />
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                                <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)}
                                    className="w-4 h-4 rounded border-white/20 bg-[#0F1720] accent-blue-500" />
                                {t('adminEvents.allDay')}
                            </label>
                            <input value={location} onChange={e => setLocation(e.target.value)}
                                placeholder={t('adminEvents.locationPlaceholder')}
                                className={cn(inputCls, "flex-1")} />
                        </div>
                    </div>

                    {/* Targeting */}
                    <div className="bg-[#0F1720] rounded-xl border border-white/5 p-4 space-y-4">
                        <p className="text-xs text-gray-600 uppercase tracking-widest">{t('adminEvents.visibility')}</p>
                        <div>
                            <p className="text-xs text-gray-600 mb-2">{t('adminAnnouncements.forWho')}</p>
                            <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => toggleRole('all')}
                                    className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                                        roles.includes('all') ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-white/5 text-gray-500 border-white/5 hover:bg-white/10')}>
                                    <Globe className="w-3 h-3" />{t('adminAnnouncements.audienceAll')}
                                </button>
                                {ROLES.map(r => (
                                    <button key={r.value} type="button" onClick={() => toggleRole(r.value)}
                                        className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                                            roles.includes(r.value) && !roles.includes('all') ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-white/5 text-gray-500 border-white/5 hover:bg-white/10')}>
                                        <r.icon className="w-3 h-3" />{t(r.labelKey)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="text-xs text-gray-600 mb-2">{t('adminAnnouncements.inWhichClasses')}</p>
                            <div className="flex gap-2 mb-3">
                                <button type="button" onClick={() => { setScopeAll(true); setSelClasses([]) }}
                                    className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                                        scopeAll ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-white/5 text-gray-500 border-white/5 hover:bg-white/10')}>
                                    <School className="w-3 h-3" />{t('adminAnnouncements.scopeSchool')}
                                </button>
                                <button type="button" onClick={() => setScopeAll(false)}
                                    className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                                        !scopeAll ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-white/5 text-gray-500 border-white/5 hover:bg-white/10')}>
                                    <GraduationCap className="w-3 h-3" />{t('adminAnnouncements.specificClasses')}
                                </button>
                            </div>
                            {!scopeAll && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto">
                                    {classes.map(cls => {
                                        const checked = selClasses.includes(cls.id)
                                        return (
                                            <button key={cls.id} type="button" onClick={() => toggleClass(cls.id)}
                                                className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all text-start',
                                                    checked ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' : 'bg-white/5 text-gray-400 border-white/5 hover:border-white/10')}>
                                                <div className={cn('w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0',
                                                    checked ? 'bg-blue-500 border-blue-500' : 'border-gray-600')}>
                                                    {checked && <svg className="w-2.5 h-2.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                                </div>
                                                <span className="truncate">{cls.name}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                            {!scopeAll && selClasses.length > 0 && (
                                <p className="text-xs text-blue-400 mt-2">{t('adminAnnouncements.classesSelectedCount', { count: selClasses.length })}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3">
                    <button type="button" onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-500 hover:text-white transition-colors">
                        {t('common.cancel')}
                    </button>
                    <button type="button" onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2 bg-blue-500 hover:bg-blue-400 text-white font-semibold text-sm rounded-xl transition-all disabled:opacity-60">
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarDays className="w-3.5 h-3.5" />}
                        {saving ? t('adminEvents.creating') : editing ? t('adminEvents.updateBtn') : t('adminEvents.createBtn')}
                    </button>
                </div>
            </motion.div>
        </div>
    )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminEventsPage() {
    const { context, loading: ctxLoading } = useSchoolContext()
    const supabase = createClient()
    const { t, language } = useLanguage()
    const [events, setEvents]         = useState<SchoolEvent[]>([])
    const [classes, setClasses]       = useState<ClassOption[]>([])
    const [loading, setLoading]       = useState(true)
    const [search, setSearch]         = useState('')
    const [filterType, setFilterType] = useState('all')
    const [filterTime, setFilterTime] = useState<'upcoming' | 'past' | 'all'>('upcoming')
    const [modalOpen, setModalOpen]   = useState(false)
    const [editing, setEditing]       = useState<SchoolEvent | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [expandedId, setExpandedId] = useState<string | null>(null)

    const fetchAll = useCallback(async () => {
        if (!context) return
        setLoading(true)
        const [{ data: ev }, { data: cls }] = await Promise.all([
            supabase.from('events').select('*').eq('school_id', context.school_id).order('start_date', { ascending: true }),
            supabase.from('classes').select('id, name').eq('school_id', context.school_id).order('name'),
        ])
        setEvents(ev || [])
        setClasses(cls || [])
        setLoading(false)
    }, [context])

    useEffect(() => { fetchAll() }, [fetchAll])

    const handleDelete = async (id: string) => {
        setDeletingId(id)
        const { error } = await supabase.from('events').delete().eq('id', id)
        setDeletingId(null)
        if (error) { toast.error(t('adminEvents.errorDelete')); return }
        toast.success(t('adminEvents.deleted'))
        setEvents(prev => prev.filter(e => e.id !== id))
    }

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const filtered = events.filter(ev => {
        if (filterType !== 'all' && ev.event_type !== filterType) return false
        if (search && !ev.title.toLowerCase().includes(search.toLowerCase())) return false
        const evDate = new Date(ev.start_date)
        if (filterTime === 'upcoming' && evDate < startOfToday) return false
        if (filterTime === 'past' && evDate >= startOfToday) return false
        return true
    })

    const upcomingCount = events.filter(e => new Date(e.start_date) >= startOfToday).length

    if (ctxLoading || loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="w-5 h-5 animate-spin text-gray-600" />
        </div>
    )

    const pastCount = events.filter(e => new Date(e.start_date) < startOfToday).length

    const timeTabs = [
        { k: 'upcoming' as const, label: t('adminEvents.upcoming'), count: upcomingCount },
        { k: 'all'      as const, label: t('adminAnnouncements.allFilter'), count: events.length },
        { k: 'past'     as const, label: t('adminEvents.past'),     count: pastCount },
    ]

    return (
        <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">{t('adminEvents.title')}</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {t('adminEvents.upcomingCount', { count: upcomingCount })}
                    </p>
                </div>
                <button type="button" onClick={() => { setEditing(null); setModalOpen(true) }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-400 text-white font-semibold text-sm rounded-xl transition-all">
                    <Plus className="w-4 h-4" />{t('adminEvents.new')}
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder={t('adminEvents.searchPlaceholder')}
                    className="w-full ps-10 pe-4 py-3 bg-[#161B22] border border-white/5 text-base text-white rounded-xl focus:outline-none focus:border-white/15 placeholder:text-gray-600 transition-colors" />
            </div>

            {/* Time tabs — underline style identical to requests */}
            <div className="flex border-b border-white/5">
                {timeTabs.map(tb => (
                    <button key={tb.k} type="button" onClick={() => setFilterTime(tb.k)}
                        className={cn(
                            'flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-all whitespace-nowrap',
                            filterTime === tb.k ? 'text-white border-blue-500' : 'text-gray-600 border-transparent hover:text-gray-400'
                        )}>
                        {tb.label}
                        {tb.count > 0 && (
                            <span className={cn(
                                'text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
                                filterTime === tb.k ? 'bg-white/10 text-white' : 'bg-white/5 text-gray-600'
                            )}>{tb.count}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Type filter pills */}
            <div className="flex gap-1.5 flex-wrap">
                <button type="button" onClick={() => setFilterType('all')}
                    className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                        filterType === 'all' ? 'bg-white/10 text-white border-white/10' : 'bg-[#161B22] text-gray-500 border-white/5 hover:text-gray-300')}>
                    {t('adminAnnouncements.allFilter')}
                </button>
                {EVENT_TYPES.map(et => (
                    <button key={et.value} type="button" onClick={() => setFilterType(et.value)}
                        className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                            filterType === et.value ? '' : 'bg-[#161B22] text-gray-500 border-white/5 hover:text-gray-300')}
                        style={filterType === et.value ? { backgroundColor: et.color + '22', borderColor: et.color + '44', color: et.color } : {}}>
                        {t(et.labelKey)}
                    </button>
                ))}
            </div>

            {/* List */}
            {filtered.length === 0 ? (
                <div className="flex flex-col items-center py-20 gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-[#161B22] border border-white/5 flex items-center justify-center">
                        <CalendarDays className="w-6 h-6 text-white/15" />
                    </div>
                    <p className="text-gray-600 text-sm">{t('common.noResults')}</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(ev => {
                        const ti = typeInfo(ev.event_type)
                        const isPast = new Date(ev.start_date) < startOfToday
                        const isExpanded = expandedId === ev.id
                        const summary = audienceSummary(ev.visibility || [], classes, t, language)

                        return (
                            <div key={ev.id} className={cn(
                                'bg-[#161B22] rounded-2xl border transition-all group',
                                isExpanded ? 'border-white/10' : 'border-white/5',
                                isPast && 'opacity-60'
                            )}>

                                {/* Row */}
                                <div className="flex items-center gap-3 p-5">

                                    {/* Type icon */}
                                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: ti.color + '22', border: `1px solid ${ti.color}44` }}>
                                        <CalendarDays className="w-5 h-5" style={{ color: ti.color }} />
                                    </div>

                                    {/* Info — clickable */}
                                    <button type="button"
                                        onClick={() => setExpandedId(isExpanded ? null : ev.id)}
                                        className="flex-1 min-w-0 text-start">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-base font-semibold text-white truncate">{ev.title}</p>
                                            <span className="shrink-0 text-xs font-semibold px-2.5 py-0.5 rounded-full border"
                                                style={{ backgroundColor: ti.color + '22', borderColor: ti.color + '44', color: ti.color }}>
                                                {t(ti.labelKey)}
                                            </span>
                                            {isPast && (
                                                <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-gray-500">
                                                    {t('adminEvents.past')}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-600 flex-wrap">
                                            <Clock className="w-3.5 h-3.5" />
                                            <span className="text-gray-400">{formatEventDate(ev.start_date, ev.end_date, ev.all_day, language)}</span>
                                            {ev.location && <>
                                                <span className="text-gray-700">·</span>
                                                <MapPin className="w-3.5 h-3.5" />
                                                <span className="text-gray-500">{ev.location}</span>
                                            </>}
                                        </div>
                                    </button>

                                    {/* Edit */}
                                    <button type="button"
                                        onClick={() => { setEditing(ev); setModalOpen(true) }}
                                        title={t('adminEvents.edit')}
                                        className="shrink-0 p-2 rounded-lg text-gray-600 hover:text-blue-400 hover:bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-all">
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Delete */}
                                    <button type="button"
                                        onClick={() => handleDelete(ev.id)}
                                        disabled={deletingId === ev.id}
                                        title={t('common.delete')}
                                        className="shrink-0 p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-30">
                                        {deletingId === ev.id
                                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            : <Trash2 className="w-3.5 h-3.5" />}
                                    </button>

                                    {/* Chevron */}
                                    <button type="button"
                                        onClick={() => setExpandedId(isExpanded ? null : ev.id)}
                                        className="shrink-0 text-gray-600 hover:text-gray-400 transition-colors p-1">
                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>
                                </div>

                                {/* Expanded */}
                                {isExpanded && (
                                    <div className="px-5 pb-5 space-y-3 border-t border-white/5 pt-4">

                                        {/* Description */}
                                        {ev.description && (
                                            <div className="bg-[#0F1720] rounded-xl p-3.5 border border-white/5">
                                                <p className="text-xs text-gray-600 uppercase tracking-widest mb-2">{t('adminEvents.descriptionLabel')}</p>
                                                <p className="text-base text-gray-300 leading-relaxed">{ev.description}</p>
                                            </div>
                                        )}

                                        {/* Details grid */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="bg-[#0F1720] rounded-xl p-3.5 border border-white/5">
                                                <p className="text-xs text-gray-600 mb-1.5">{t('adminEvents.startDate')}</p>
                                                <p className="text-sm text-white font-semibold">
                                                    {formatEventDate(ev.start_date, ev.end_date, ev.all_day, language)}
                                                </p>
                                            </div>
                                            <div className="bg-[#0F1720] rounded-xl p-3.5 border border-white/5">
                                                <p className="text-xs text-gray-600 mb-1.5">{t('adminEvents.visibility')}</p>
                                                <p className="text-sm text-white font-semibold">{summary}</p>
                                            </div>
                                            {ev.location && (
                                                <div className="bg-[#0F1720] rounded-xl p-3.5 border border-white/5 col-span-2">
                                                    <p className="text-xs text-gray-600 mb-1.5">{t('adminEvents.locationPlaceholder')}</p>
                                                    <p className="text-sm text-white font-semibold">{ev.location}</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Edit action */}
                                        <button type="button"
                                            onClick={() => { setEditing(ev); setModalOpen(true) }}
                                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition-colors">
                                            <Pencil className="w-3.5 h-3.5" /> {t('adminEvents.edit')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            <AnimatePresence>
                {modalOpen && context && (
                    <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null) }}
                        onSaved={fetchAll} editing={editing} classes={classes}
                        schoolId={context.school_id} userId={context.user_id} />
                )}
            </AnimatePresence>
        </div>
    )
}
