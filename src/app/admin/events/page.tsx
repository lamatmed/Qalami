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
    BookOpen, ChevronDown, School,
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
    visibility: string[] // This is target_audience equivalents (roles + classes)
    created_at: string
}
interface ClassOption { id: string; name: string }

const EVENT_TYPES = [
    { value: 'meeting',   labelKey: 'adminEvents.typeMeeting',    color: '#6366f1' },
    { value: 'exam',      labelKey: 'adminEvents.typeExam',     color: '#f59e0b' },
    { value: 'holiday',   labelKey: 'adminEvents.typeHoliday',      color: '#10b981' },
    { value: 'activity',  labelKey: 'adminEvents.typeActivity',   color: '#8b5cf6' },
    { value: 'sport',     labelKey: 'adminEvents.typeSport',      color: '#3b82f6' },
    { value: 'cultural',  labelKey: 'adminEvents.typeCultural',   color: '#ec4899' },
    { value: 'other',     labelKey: 'adminEvents.typeOther',      color: '#6b7280' },
]

const ROLES = [
    { value: 'eleves',       labelKey: 'adminAnnouncements.audienceStudents',      icon: GraduationCap },
    { value: 'parents',      labelKey: 'adminAnnouncements.audienceParents',     icon: Users },
    { value: 'enseignants',  labelKey: 'adminAnnouncements.audienceTeachers', icon: BookOpen },
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

// ── helpers to read/write audience encoding ──────────────────────────────────
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
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [type, setType] = useState('meeting')
    const [startDate, setStartDate] = useState('')   // "YYYY-MM-DD"
    const [startTime, setStartTime] = useState('')   // "HH:MM" optional
    const [endDate, setEndDate] = useState('')       // "YYYY-MM-DD" optional
    const [endTime, setEndTime] = useState('')       // "HH:MM" optional
    const [allDay, setAllDay] = useState(false)
    const [location, setLocation] = useState('')
    const [saving, setSaving] = useState(false)

    // Targeting
    const [roles, setRoles] = useState<string[]>(['all'])
    const [scopeAll, setScopeAll] = useState(true)
    const [selClasses, setSelClasses] = useState<string[]>([])

    useEffect(() => {
        if (!open) return
        if (editing) {
            setTitle(editing.title); setDescription(editing.description || '')
            setType(editing.event_type)
            setStartDate(editing.start_date.slice(0, 10))
            // Don't restore time if event was saved as all_day (no time chosen)
            setStartTime(!editing.all_day && editing.start_date.length > 10 ? editing.start_date.slice(11, 16) : '')
            setEndDate(editing.end_date ? editing.end_date.slice(0, 10) : '')
            setEndTime(!editing.all_day && editing.end_date && editing.end_date.length > 10 ? editing.end_date.slice(11, 16) : '')
            setAllDay(editing.all_day); setLocation(editing.location || '')
            const { roles: r, classIds } = decodeAudience(editing.visibility || [])
            setRoles(r.length ? r : ['all'])
            setSelClasses(classIds)
            setScopeAll(classIds.length === 0)
        } else {
            setTitle(''); setDescription(''); setType('meeting')
            setStartDate(''); setStartTime(''); setEndDate(''); setEndTime(''); setAllDay(false); setLocation('')
            setRoles(['all']); setSelClasses([]); setScopeAll(true)
        }
    }, [editing, open])

    const toggleRole = (v: string) => {
        if (v === 'all') { setRoles(['all']); return }
        setRoles(prev => {
            const without = prev.filter(x => x !== 'all')
            return without.includes(v) ? (without.filter(x => x !== v).length === 0 ? ['all'] : without.filter(x => x !== v)) : [...without, v]
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
        // If no time was entered, treat as all-day (no hour displayed)
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
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#1A2530] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center"><CalendarDays className="w-4 h-4 text-blue-400" /></div>
                        <h2 className="text-sm font-bold text-white">{editing ? t('adminEvents.edit') : t('adminEvents.new')}</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-5 max-h-[72vh] overflow-y-auto">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">{t('adminEvents.titleLabel')} *</label>
                            <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('adminEvents.titlePlaceholder')}
                                className="w-full bg-[#0D1117] border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50" />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">{t('adminEvents.descriptionLabel')}</label>
                            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={t('adminEvents.descriptionPlaceholder')} rows={2}
                                className="w-full bg-[#0D1117] border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 resize-none" />
                        </div>
                    </div>

                    {/* Type & Dates */}
                    <div className="rounded-xl border border-white/10 bg-[#0D1117] p-4 space-y-4">
                        <div>
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">{t('adminEvents.typeLabel')}</label>
                            <div className="flex flex-wrap gap-1.5">
                                {EVENT_TYPES.map(et => (
                                    <button key={et.value} onClick={() => setType(et.value)}
                                        className={cn('px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all', type === et.value ? 'text-white border-white/20' : 'bg-white/5 text-gray-500 border-white/10 hover:bg-white/10')}
                                        style={type === et.value ? { backgroundColor: et.color + '33', borderColor: et.color + '66', color: et.color } : {}}>{t(et.labelKey)}</button>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">{t('adminEvents.startDate')} *</label>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                                    className="w-full bg-[#1A2530] border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 [color-scheme:dark]" />
                                {!allDay && (
                                    <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                                        placeholder={t('adminEvents.timePlaceholder')}
                                        className="w-full bg-[#1A2530] border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 [color-scheme:dark] placeholder:text-gray-600" />
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">{t('adminEvents.endDate')}</label>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                                    className="w-full bg-[#1A2530] border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 [color-scheme:dark]" />
                                {!allDay && (
                                    <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                                        placeholder={t('adminEvents.timePlaceholder')}
                                        className="w-full bg-[#1A2530] border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 [color-scheme:dark] placeholder:text-gray-600" />
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                                <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} className="w-4 h-4 rounded border-white/20 bg-[#1A2530] accent-blue-500" />
                                {t('adminEvents.allDay')}
                            </label>
                            <div className="flex-1">
                                <input value={location} onChange={e => setLocation(e.target.value)} placeholder={t('adminEvents.locationPlaceholder')}
                                    className="w-full bg-[#1A2530] border border-white/10 rounded-xl px-4 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500/50" />
                            </div>
                        </div>
                    </div>

                    {/* TARGETING */}
                    <div className="rounded-xl border border-white/10 bg-[#0D1117] p-4 space-y-4">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('adminEvents.visibility')}</p>
                        <div>
                            <p className="text-[11px] text-gray-500 mb-2">{t('adminAnnouncements.forWho')}</p>
                            <div className="flex flex-wrap gap-2">
                                <button onClick={() => toggleRole('all')}
                                    className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all', roles.includes('all') ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-white/5 text-gray-500 border-white/10 hover:bg-white/10')}>
                                    <Globe className="w-3 h-3" />{t('adminAnnouncements.audienceAll')}
                                </button>
                                {ROLES.map(r => (
                                    <button key={r.value} onClick={() => toggleRole(r.value)}
                                        className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all', roles.includes(r.value) && !roles.includes('all') ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-white/5 text-gray-500 border-white/10 hover:bg-white/10')}>
                                        <r.icon className="w-3 h-3" />{t(r.labelKey)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="text-[11px] text-gray-500 mb-2">{t('adminAnnouncements.inWhichClasses')}</p>
                            <div className="flex gap-2 mb-3">
                                <button onClick={() => { setScopeAll(true); setSelClasses([]) }}
                                    className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all', scopeAll ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-white/5 text-gray-500 border-white/10 hover:bg-white/10')}>
                                    <School className="w-3 h-3" />{t('adminAnnouncements.scopeSchool')}
                                </button>
                                <button onClick={() => setScopeAll(false)}
                                    className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all', !scopeAll ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-white/5 text-gray-500 border-white/10 hover:bg-white/10')}>
                                    <GraduationCap className="w-3 h-3" />{t('adminAnnouncements.specificClasses')}
                                </button>
                            </div>
                            {!scopeAll && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto pr-1">
                                    {classes.map(cls => {
                                        const checked = selClasses.includes(cls.id)
                                        return (
                                            <button key={cls.id} onClick={() => toggleClass(cls.id)}
                                                className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all text-left', checked ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' : 'bg-white/5 text-gray-400 border-white/10 hover:border-white/20')}>
                                                <div className={cn('w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0', checked ? 'bg-blue-500 border-blue-500' : 'border-gray-600')}>
                                                    {checked && <svg className="w-2.5 h-2.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                                </div>
                                                <span className="truncate">{cls.name}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                            {!scopeAll && selClasses.length > 0 && <p className="text-[10px] text-blue-500 mt-2 font-medium">{t('adminAnnouncements.classesSelectedCount', { count: selClasses.length })}</p>}
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">{t('common.cancel')}</button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2 bg-blue-500 hover:bg-blue-400 text-white font-bold text-sm rounded-xl transition-all disabled:opacity-60">
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
    const [events, setEvents] = useState<SchoolEvent[]>([])
    const [classes, setClasses] = useState<ClassOption[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filterType, setFilterType] = useState('all')
    const [filterTime, setFilterTime] = useState<'upcoming' | 'past' | 'all'>('upcoming')
    const [modalOpen, setModalOpen] = useState(false)
    const [editing, setEditing] = useState<SchoolEvent | null>(null)
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

    if (ctxLoading || loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-7 h-7 animate-spin text-blue-500" /></div>

    const c = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }
    const it = { hidden: { y: 10, opacity: 0 }, show: { y: 0, opacity: 1 } }

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-24">
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-500/15 flex items-center justify-center"><CalendarDays className="w-5 h-5 text-blue-400" /></div>
                    <div>
                        <h1 className="text-xl font-black text-foreground">{t('adminEvents.title')}</h1>
                        <p className="text-xs text-muted-foreground">{t('adminEvents.upcomingCount', { count: upcomingCount })}</p>
                    </div>
                </div>
                <button onClick={() => { setEditing(null); setModalOpen(true) }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-400 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/20">
                    <Plus className="w-4 h-4" />{t('adminEvents.new')}
                </button>
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-1 bg-card border border-border/50 rounded-xl p-1 w-fit">
                {[{ k: 'upcoming', labelKey: 'adminEvents.upcoming' }, { k: 'all', labelKey: 'adminAnnouncements.allFilter' }, { k: 'past', labelKey: 'adminEvents.past' }].map(item => (
                    <button key={item.k} onClick={() => setFilterTime(item.k as any)}
                        className={cn('px-4 py-1.5 rounded-lg text-xs font-semibold', filterTime === item.k ? 'bg-blue-500 text-white' : 'text-muted-foreground')}>
                        {t(item.labelKey)}
                    </button>
                ))}
            </motion.div>

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('adminEvents.searchPlaceholder')}
                        className="w-full pl-9 pr-4 h-10 bg-card border border-border/50 rounded-xl text-sm text-foreground focus:outline-none focus:border-blue-500/50" />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                    <button onClick={() => setFilterType('all')}
                        className={cn('px-3 py-2 rounded-xl text-xs font-semibold border', filterType === 'all' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-card text-muted-foreground border-border/50')}>
                        {t('adminAnnouncements.allFilter')}
                    </button>
                    {EVENT_TYPES.map(et => (
                        <button key={et.value} onClick={() => setFilterType(et.value)}
                            className={cn('px-3 py-2 rounded-xl text-xs font-semibold border', filterType === et.value ? 'text-white border-white/20' : 'bg-card text-muted-foreground border-border/50')}
                            style={filterType === et.value ? { backgroundColor: et.color + '33', borderColor: et.color + '66', color: et.color } : {}}>
                            {t(et.labelKey)}
                        </button>
                    ))}
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="py-24 text-center bg-card rounded-2xl border border-border/50">
                    <CalendarDays className="w-12 h-12 mx-auto text-blue-400/40 mb-4" />
                    <p className="font-bold">{t('common.noResults')}</p>
                </div>
            ) : (
                <motion.div variants={c} initial="hidden" animate="show" className="space-y-3">
                    {filtered.map(ev => {
                        const ti = typeInfo(ev.event_type)
                        const isPast = new Date(ev.start_date) < startOfToday
                        const isExpanded = expandedId === ev.id
                        const summary = audienceSummary(ev.visibility || [], classes, t, language)
                        return (
                            <motion.div key={ev.id} variants={it}
                                className={cn('bg-card rounded-2xl border cursor-pointer group', isPast ? 'opacity-60 border-border/50' : 'border-border/50 hover:border-blue-500/30')}
                                style={{ borderColor: isExpanded ? ti.color + '66' : undefined }}
                                onClick={() => setExpandedId(isExpanded ? null : ev.id)}>
                                <div className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: ti.color + '33', border: `1px solid ${ti.color}66` }}>
                                                <CalendarDays className="w-4 h-4" style={{ color: ti.color }} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <h3 className="font-bold text-sm truncate">{ev.title}</h3>
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: ti.color + '22', color: ti.color }}>{t(ti.labelKey)}</span>
                                                    {isPast && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-500/20 text-gray-400">{t('adminEvents.past')}</span>}
                                                </div>
                                                <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatEventDate(ev.start_date, ev.end_date, ev.all_day, language)}</span>
                                                    {ev.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{ev.location}</span>}
                                                    <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{summary}</span>
                                                </div>
                                                {isExpanded && ev.description && <p className="text-sm text-muted-foreground mt-2">{ev.description}</p>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button onClick={e => { e.stopPropagation(); setEditing(ev); setModalOpen(true) }}
                                                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 opacity-0 group-hover:opacity-100">
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={e => { e.stopPropagation(); handleDelete(ev.id) }} disabled={deletingId === ev.id}
                                                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100">
                                                {deletingId === ev.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                            </button>
                                            <ChevronDown className={cn('w-4 h-4 text-muted-foreground/40 transition-transform', isExpanded && 'rotate-180')} />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )
                    })}
                </motion.div>
            )}

            <AnimatePresence>
                {modalOpen && context && (
                    <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null) }}
                        onSaved={fetchAll} editing={editing} classes={classes} schoolId={context.school_id} userId={context.user_id} />
                )}
            </AnimatePresence>
        </div>
    )
}
