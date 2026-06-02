/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSchoolContext } from '@/lib/use-school-context'
import { useLanguage } from '@/i18n'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
    Megaphone, Plus, Search, Trash2, Pencil, X,
    Loader2, AlertTriangle, Bell, ChevronDown,
    GraduationCap, Users, BookOpen, Globe, School,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { notifyAdminSelf } from '@/app/admin/actions'

interface Announcement {
    id: string
    title: string
    content: string
    target_audience: string[]
    target_scope: string
    target_class_id: string | null
    priority: string
    published_at: string | null
    expires_at: string | null
    created_at: string
}
interface ClassOption { id: string; name: string }

const PRIORITIES = [
    { value: 'normal',  labelKey: 'adminAnnouncements.priorityNormal',  cls: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
    { value: 'high',    labelKey: 'adminAnnouncements.priorityHigh',    cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    { value: 'urgent',  labelKey: 'adminAnnouncements.priorityUrgent',  cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
    { value: 'low',     labelKey: 'adminAnnouncements.priorityLow',     cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
]
const ROLES = [
    { value: 'eleves',       labelKey: 'adminAnnouncements.audienceStudents',      icon: GraduationCap },
    { value: 'parents',      labelKey: 'adminAnnouncements.audienceParents',     icon: Users },
    { value: 'enseignants',  labelKey: 'adminAnnouncements.audienceTeachers', icon: BookOpen },
]

const pInfo = (p: string) => PRIORITIES.find(x => x.value === p) ?? PRIORITIES[0]

function relDate(d: string, t: any, language: string) {
    const diff = (Date.now() - new Date(d).getTime()) / 1000
    if (diff < 60) return t('adminAnnouncements.justNow')
    if (diff < 3600) return t('adminAnnouncements.minsAgo', { mins: Math.floor(diff / 60) })
    if (diff < 86400) return t('adminAnnouncements.hoursAgo', { hours: Math.floor(diff / 3600) })
    return new Date(d).toLocaleDateString(language === 'ar' ? 'ar-MA' : 'fr-FR', { day: 'numeric', month: 'short' })
}

// ── helpers to read/write audience encoding ──────────────────────────────────
// target_audience stores roles like 'eleves','parents','enseignants' (or 'all')
// AND class IDs prefixed with 'cls:' for class-level targeting.
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
    editing: Announcement | null; classes: ClassOption[]; schoolId: string; userId: string
}) {
    const supabase = createClient()
    const { t } = useLanguage()
    const [title, setTitle] = useState('')
    const [content, setContent] = useState('')
    const [priority, setPriority] = useState('normal')
    const [expiresAt, setExpiresAt] = useState('')
    const [saving, setSaving] = useState(false)

    // Targeting
    const [roles, setRoles] = useState<string[]>(['all'])          // 'all' | combo of eleves/parents/enseignants
    const [scopeAll, setScopeAll] = useState(true)                 // true=whole school, false=selected classes
    const [selClasses, setSelClasses] = useState<string[]>([])     // selected class IDs

    useEffect(() => {
        if (!open) return
        if (editing) {
            setTitle(editing.title); setContent(editing.content)
            setPriority(editing.priority || 'normal')
            setExpiresAt(editing.expires_at ? editing.expires_at.slice(0, 16) : '')
            const { roles: r, classIds } = decodeAudience(editing.target_audience || [])
            setRoles(r.length ? r : ['all'])
            setSelClasses(classIds)
            setScopeAll(classIds.length === 0)
        } else {
            setTitle(''); setContent(''); setPriority('normal'); setExpiresAt('')
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
    const toggleClass = (id: string) =>
        setSelClasses(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

    const handleSave = async () => {
        if (!title.trim()) { toast.error(t('adminAnnouncements.titleRequiredToast')); return }
        if (!content.trim()) { toast.error(t('adminAnnouncements.contentRequiredToast')); return }
        if (!scopeAll && selClasses.length === 0) { toast.error(t('adminAnnouncements.selectClassToast')); return }
        setSaving(true)
        const audience = encodeAudience(roles, scopeAll ? [] : selClasses)
        const payload: any = {
            school_id: schoolId, title: title.trim(), content: content.trim(), priority,
            target_scope: scopeAll ? 'school' : 'class',
            target_audience: audience,
            target_class_id: scopeAll ? null : (selClasses[0] ?? null),
            expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
            published_at: new Date().toISOString(),
            created_by: userId, updated_at: new Date().toISOString(),
        }
        const { error } = editing
            ? await supabase.from('announcements').update(payload).eq('id', editing.id)
            : await supabase.from('announcements').insert(payload)
        setSaving(false)
        if (error) { toast.error(error.message); return }
        if (!editing) {
            await notifyAdminSelf({
                title: title.trim(),
                message: 'Annonce publiée pour l\'école.',
                type: 'success',
                actionUrl: '/admin/announcements',
                eventType: 'admin_announcement',
            })
        }
        toast.success(editing ? t('adminAnnouncements.updated') : t('adminAnnouncements.created'))
        onSaved(); onClose()
    }

    if (!open) return null
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#1A2530] border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                            <Megaphone className="w-4 h-4 text-emerald-400" />
                        </div>
                        <h2 className="text-sm font-bold text-white">{editing ? t('adminAnnouncements.edit') : t('adminAnnouncements.new')}</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-6 space-y-5 max-h-[72vh] overflow-y-auto">
                    {/* Title */}
                    <div>
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">{t('adminAnnouncements.titleLabel')} *</label>
                        <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('adminAnnouncements.titlePlaceholder')}
                            className="w-full bg-[#0D1117] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
                    </div>

                    {/* Content */}
                    <div>
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">{t('adminAnnouncements.contentLabel')} *</label>
                        <textarea value={content} onChange={e => setContent(e.target.value)} placeholder={t('adminAnnouncements.contentPlaceholder')} rows={4}
                            className="w-full bg-[#0D1117] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 resize-none" />
                    </div>

                    {/* Priority */}
                    <div>
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">{t('adminAnnouncements.priority')}</label>
                        <div className="flex flex-wrap gap-2">
                            {PRIORITIES.map(p => (
                                <button key={p.value} onClick={() => setPriority(p.value)}
                                    className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all', priority === p.value ? p.cls : 'bg-white/5 text-gray-500 border-white/10 hover:bg-white/10')}>
                                    {t(p.labelKey)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── TARGETING ── */}
                    <div className="rounded-xl border border-white/10 bg-[#0D1117] p-4 space-y-4">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('adminAnnouncements.audience')}</p>

                        {/* Role selector */}
                        <div>
                            <p className="text-[11px] text-gray-500 mb-2">{t('adminAnnouncements.forWho')}</p>
                            <div className="flex flex-wrap gap-2">
                                <button onClick={() => toggleRole('all')}
                                    className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all', roles.includes('all') ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-white/5 text-gray-500 border-white/10 hover:bg-white/10')}>
                                    <Globe className="w-3 h-3" />{t('adminAnnouncements.audienceAll')}
                                </button>
                                {ROLES.map(r => (
                                    <button key={r.value} onClick={() => toggleRole(r.value)}
                                        className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                                            roles.includes(r.value) && !roles.includes('all')
                                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                                : 'bg-white/5 text-gray-500 border-white/10 hover:bg-white/10')}>
                                        <r.icon className="w-3 h-3" />{t(r.labelKey)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Scope */}
                        <div>
                            <p className="text-[11px] text-gray-500 mb-2">{t('adminAnnouncements.inWhichClasses')}</p>
                            <div className="flex gap-2 mb-3">
                                <button onClick={() => { setScopeAll(true); setSelClasses([]) }}
                                    className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all', scopeAll ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-white/5 text-gray-500 border-white/10 hover:bg-white/10')}>
                                    <School className="w-3 h-3" />{t('adminAnnouncements.scopeSchool')}
                                </button>
                                <button onClick={() => setScopeAll(false)}
                                    className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all', !scopeAll ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-white/5 text-gray-500 border-white/10 hover:bg-white/10')}>
                                    <GraduationCap className="w-3 h-3" />{t('adminAnnouncements.specificClasses')}
                                </button>
                            </div>

                            {!scopeAll && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto pr-1">
                                    {classes.map(cls => {
                                        const checked = selClasses.includes(cls.id)
                                        return (
                                            <button key={cls.id} onClick={() => toggleClass(cls.id)}
                                                className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all text-left', checked ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-white/5 text-gray-400 border-white/10 hover:border-white/20')}>
                                                <div className={cn('w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0', checked ? 'bg-emerald-500 border-emerald-500' : 'border-gray-600')}>
                                                    {checked && <svg className="w-2.5 h-2.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                                </div>
                                                <span className="truncate">{cls.name}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                            {!scopeAll && selClasses.length > 0 && (
                                <p className="text-[10px] text-emerald-500 mt-2 font-medium">{t('adminAnnouncements.classesSelectedCount', { count: selClasses.length })}</p>
                            )}
                        </div>
                    </div>

                    {/* Expires */}
                    <div>
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">{t('adminAnnouncements.expiresAtOptional')}</label>
                        <input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
                            className="w-full bg-[#0D1117] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 [color-scheme:dark]" />
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">{t('common.cancel')}</button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm rounded-xl transition-all disabled:opacity-60">
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Megaphone className="w-3.5 h-3.5" />}
                        {saving ? t('adminAnnouncements.creating') : editing ? t('adminAnnouncements.updateBtn') : t('adminAnnouncements.publishBtn')}
                    </button>
                </div>
            </motion.div>
        </div>
    )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminAnnouncementsPage() {
    const { context, loading: ctxLoading } = useSchoolContext()
    const supabase = createClient()
    const { t, language } = useLanguage()
    const [announcements, setAnnouncements] = useState<Announcement[]>([])
    const [classes, setClasses] = useState<ClassOption[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filterPriority, setFilterPriority] = useState('all')
    const [modalOpen, setModalOpen] = useState(false)
    const [editing, setEditing] = useState<Announcement | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [expandedId, setExpandedId] = useState<string | null>(null)

    const fetchAll = useCallback(async () => {
        if (!context) return
        setLoading(true)
        const [{ data: ann }, { data: cls }] = await Promise.all([
            supabase.from('announcements').select('*').eq('school_id', context.school_id).order('created_at', { ascending: false }),
            supabase.from('classes').select('id, name').eq('school_id', context.school_id).order('name'),
        ])
        setAnnouncements(ann || [])
        setClasses(cls || [])
        setLoading(false)
    }, [context])

    useEffect(() => { fetchAll() }, [fetchAll])

    const handleDelete = async (id: string) => {
        setDeletingId(id)
        const { error } = await supabase.from('announcements').delete().eq('id', id)
        setDeletingId(null)
        if (error) { toast.error(t('adminAnnouncements.errorDelete')); return }
        toast.success(t('adminAnnouncements.deleted'))
        setAnnouncements(prev => prev.filter(a => a.id !== id))
    }

    const filtered = announcements.filter(a => {
        if (filterPriority !== 'all' && a.priority !== filterPriority) return false
        if (search && !a.title.toLowerCase().includes(search.toLowerCase()) && !a.content.toLowerCase().includes(search.toLowerCase())) return false
        return true
    })

    const c = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }
    const it = { hidden: { y: 10, opacity: 0 }, show: { y: 0, opacity: 1 } }

    if (ctxLoading || loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-7 h-7 animate-spin text-emerald-500" /></div>

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-24">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 flex items-center justify-center"><Megaphone className="w-5 h-5 text-emerald-400" /></div>
                    <div>
                        <h1 className="text-xl font-black text-foreground">{t('adminAnnouncements.title')}</h1>
                        <p className="text-xs text-muted-foreground">
                            {announcements.length === 1
                                ? t('adminAnnouncements.countSingular', { count: 1 })
                                : t('adminAnnouncements.countPlural', { count: announcements.length })}
                        </p>
                    </div>
                </div>
                <button onClick={() => { setEditing(null); setModalOpen(true) }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/20">
                    <Plus className="w-4 h-4" />{t('adminAnnouncements.new')}
                </button>
            </motion.div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('adminAnnouncements.searchPlaceholder')}
                        className="w-full pl-9 pr-4 h-10 bg-card border border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-emerald-500/50" />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                    {[{ value: 'all', labelKey: 'adminAnnouncements.allFilter', cls: '' }, ...PRIORITIES].map(p => (
                        <button key={p.value} onClick={() => setFilterPriority(p.value)}
                            className={cn('px-3 py-2 rounded-xl text-xs font-semibold border transition-all',
                                filterPriority === p.value && p.value !== 'all' ? (p as any).cls :
                                filterPriority === p.value ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                'bg-card text-muted-foreground border-border/50 hover:border-border')}>
                            {t(p.labelKey)}
                        </button>
                    ))}
                </div>
            </div>

            {/* List */}
            {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4 bg-card rounded-2xl border border-border/50 text-center">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center"><Bell className="w-7 h-7 text-emerald-400/40" /></div>
                    <p className="font-bold text-foreground">{search || filterPriority !== 'all' ? t('common.noResults') : t('adminAnnouncements.noAnnouncements')}</p>
                    {!search && filterPriority === 'all' && (
                        <button onClick={() => { setEditing(null); setModalOpen(true) }}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm rounded-xl">
                            <Plus className="w-4 h-4" />{t('adminAnnouncements.createBtn')}
                        </button>
                    )}
                </div>
            ) : (
                <motion.div variants={c} initial="hidden" animate="show" className="space-y-3">
                    {filtered.map(ann => {
                        const pi = pInfo(ann.priority)
                        const isExpanded = expandedId === ann.id
                        const isExpired = ann.expires_at ? new Date(ann.expires_at) < new Date() : false
                        const summary = audienceSummary(ann.target_audience || [], classes, t, language)
                        return (
                            <motion.div key={ann.id} variants={it}
                                className="bg-card rounded-2xl border border-border/50 hover:border-emerald-500/30 transition-all cursor-pointer group"
                                onClick={() => setExpandedId(isExpanded ? null : ann.id)}>
                                <div className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3 min-w-0 flex-1">
                                            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border', pi.cls)}>
                                                {ann.priority === 'urgent' ? <AlertTriangle className="w-4 h-4" /> : <Megaphone className="w-4 h-4" />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <h3 className="font-bold text-sm text-foreground">{ann.title}</h3>
                                                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border', pi.cls)}>{t(pi.labelKey)}</span>
                                                    {isExpired && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-500/20 text-gray-400 border border-gray-500/30">{t('adminAnnouncements.expired')}</span>}
                                                </div>
                                                <p className={cn('text-sm text-muted-foreground', !isExpanded && 'line-clamp-2')}>{ann.content}</p>
                                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                    <span className="text-[10px] text-muted-foreground/50">{relDate(ann.created_at, t, language)}</span>
                                                    <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">{summary}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button onClick={e => { e.stopPropagation(); setEditing(ann); setModalOpen(true) }}
                                                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-all">
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={e => { e.stopPropagation(); handleDelete(ann.id) }} disabled={deletingId === ann.id}
                                                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all">
                                                {deletingId === ann.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
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
                        onSaved={fetchAll} editing={editing} classes={classes}
                        schoolId={context.school_id} userId={context.user_id} />
                )}
            </AnimatePresence>
        </div>
    )
}
