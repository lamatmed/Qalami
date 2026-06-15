'use client'

import { useState, useEffect, useTransition } from 'react'
import {
    Megaphone, Plus, X, Loader2, Trash2, ChevronLeft,
    AlertTriangle, Users, GraduationCap, Clock, Send,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n'
import {
    getMyTeacherAnnouncementsAction,
    createTeacherAnnouncementAction,
    deleteTeacherAnnouncementAction,
    getTeacherAssignedClassesAction,
    type TeacherAnnouncement,
} from '@/app/teacher/actions'

const PRIORITY_KEYS = ['low', 'normal', 'high', 'urgent'] as const
const PRIORITY_COLORS: Record<string, string> = {
    low:    'text-slate-400 bg-slate-500/10 border-slate-500/20',
    normal: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    high:   'text-orange-400 bg-orange-500/10 border-orange-500/20',
    urgent: 'text-red-400 bg-red-500/10 border-red-500/20',
}

export function TeacherAnnouncementsPage() {
    const { t, language } = useLanguage()
    const locale = language === 'ar' ? 'ar-MR' : 'fr-FR'

    const AUDIENCE_OPTIONS = [
        { value: 'eleves',      label: t('teacher.announcements.audience_students') || 'Élèves',      icon: GraduationCap },
        { value: 'parents',     label: t('teacher.announcements.audience_parents')  || 'Parents',     icon: Users },
        { value: 'enseignants', label: t('teacher.announcements.audience_teachers') || 'Enseignants', icon: Megaphone },
    ]

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return ''
        const d = new Date(dateStr)
        const diffH = (Date.now() - d.getTime()) / 3600000
        if (diffH < 1) return t('teacher.announcements.now') || 'À l\'instant'
        if (diffH < 24) return (t('teacher.announcements.hours_ago') || 'Il y a {h}h').replace('{h}', String(Math.floor(diffH)))
        if (diffH < 48) return t('teacher.announcements.yesterday') || 'Hier'
        return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Nouakchott' })
    }

    const [announcements, setAnnouncements] = useState<TeacherAnnouncement[]>([])
    const [classes, setClasses] = useState<{ id: string; name: string; school_name: string | null }[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const [form, setForm] = useState({
        title: '',
        content: '',
        target_audience: ['eleves'] as string[],
        target_class_id: '',
        priority: 'normal',
    })

    useEffect(() => {
        load()
        getTeacherAssignedClassesAction().then(setClasses).catch(() => {})
    }, [])

    const load = async () => {
        setLoading(true)
        try {
            const data = await getMyTeacherAnnouncementsAction()
            setAnnouncements(data)
        } catch {
            toast.error(t('teacher.announcements.toast_load_error') || 'Erreur lors du chargement')
        } finally {
            setLoading(false)
        }
    }

    const toggleAudience = (value: string) => {
        setForm(prev => ({
            ...prev,
            target_audience: prev.target_audience.includes(value)
                ? prev.target_audience.filter(v => v !== value)
                : [...prev.target_audience, value],
        }))
    }

    const handleCreate = () => {
        if (!form.title.trim() || !form.content.trim()) {
            toast.error(t('teacher.announcements.toast_required_fields') || 'Titre et contenu sont requis')
            return
        }
        if (form.target_audience.length === 0) {
            toast.error(t('teacher.announcements.toast_required_audience') || 'Sélectionnez au moins un destinataire')
            return
        }
        startTransition(async () => {
            try {
                await createTeacherAnnouncementAction({
                    title: form.title,
                    content: form.content,
                    target_audience: form.target_audience,
                    target_class_id: form.target_class_id || null,
                    priority: form.priority,
                })
                toast.success(t('teacher.announcements.toast_published') || 'Annonce publiée')
                setShowForm(false)
                setForm({ title: '', content: '', target_audience: ['eleves'], target_class_id: '', priority: 'normal' })
                await load()
            } catch (e: any) {
                toast.error(e?.message || t('teacher.announcements.toast_publish_error') || 'Erreur lors de la publication')
            }
        })
    }

    const handleDelete = async (id: string) => {
        setDeletingId(id)
        try {
            await deleteTeacherAnnouncementAction(id)
            setAnnouncements(prev => prev.filter(a => a.id !== id))
            toast.success(t('teacher.announcements.toast_deleted') || 'Annonce supprimée')
        } catch {
            toast.error(t('teacher.announcements.toast_delete_error') || 'Erreur lors de la suppression')
        } finally {
            setDeletingId(null)
        }
    }

    const subtitleText = announcements.length > 0
        ? `${announcements.length} ${announcements.length === 1
            ? t('teacher.announcements.subtitle_count_one') || 'annonce publiée'
            : t('teacher.announcements.subtitle_count_other') || 'annonces publiées'}`
        : t('teacher.announcements.subtitle_empty') || 'Publiez des annonces pour vos élèves'

    return (
        <div className="max-w-2xl mx-auto space-y-5 pb-24">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/teacher">
                        <button type="button" title={t('teacher.announcements.back') || 'Retour'} className="p-2 rounded-xl hover:bg-white/5 transition-colors text-muted-foreground">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                    </Link>
                    <div>
                        <h1 className="text-lg font-extrabold">{t('teacher.announcements.title') || 'Mes annonces'}</h1>
                        <p className="text-[11px] text-muted-foreground">{subtitleText}</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setShowForm(v => !v)}
                    className={cn(
                        'flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-bold transition-colors',
                        showForm
                            ? 'bg-white/10 text-muted-foreground hover:bg-white/15'
                            : 'bg-indigo-500 text-white hover:bg-indigo-600'
                    )}
                >
                    {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {showForm
                        ? t('teacher.announcements.close') || 'Fermer'
                        : t('teacher.announcements.new') || 'Nouvelle'}
                </button>
            </div>

            {/* Create form */}
            {showForm && (
                <div className="bg-card border border-indigo-500/20 rounded-2xl p-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
                    <h3 className="font-bold text-sm text-indigo-300 flex items-center gap-2">
                        <Megaphone className="w-4 h-4" />
                        {t('teacher.announcements.form_title') || 'Nouvelle annonce'}
                    </h3>

                    <input
                        type="text"
                        placeholder={t('teacher.announcements.field_title') || 'Titre *'}
                        value={form.title}
                        onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                        className="w-full h-10 rounded-xl bg-background/60 border border-border/50 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />

                    <textarea
                        placeholder={t('teacher.announcements.field_content') || "Contenu de l'annonce *"}
                        value={form.content}
                        onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                        rows={4}
                        className="w-full rounded-xl bg-background/60 border border-border/50 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />

                    {/* Target audience */}
                    <div className="space-y-2">
                        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                            {t('teacher.announcements.section_audience') || 'Destinataires *'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {AUDIENCE_OPTIONS.map(opt => {
                                const selected = form.target_audience.includes(opt.value)
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => toggleAudience(opt.value)}
                                        className={cn(
                                            'flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-bold border transition-colors',
                                            selected
                                                ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                                                : 'bg-white/5 border-white/10 text-muted-foreground hover:border-white/20'
                                        )}
                                    >
                                        <opt.icon className="w-3.5 h-3.5" />
                                        {opt.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Target class */}
                    {classes.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                                {t('teacher.announcements.section_class') || 'Classe (optionnel)'}
                            </p>
                            <select
                                title={t('teacher.announcements.section_class') || 'Classe cible'}
                                value={form.target_class_id}
                                onChange={e => setForm(p => ({ ...p, target_class_id: e.target.value }))}
                                className="w-full h-10 rounded-xl bg-background/60 border border-border/50 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                            >
                                <option value="">{t('teacher.announcements.all_classes') || 'Toutes mes classes'}</option>
                                {(() => {
                                    const grouped = new Map<string, typeof classes>()
                                    for (const cls of classes) {
                                        const key = cls.school_name || 'École'
                                        if (!grouped.has(key)) grouped.set(key, [])
                                        grouped.get(key)!.push(cls)
                                    }
                                    return Array.from(grouped.entries()).map(([schoolName, schoolClasses]) => (
                                        <optgroup key={schoolName} label={schoolName}>
                                            {schoolClasses.map(cls => (
                                                <option key={cls.id} value={cls.id}>{cls.name}</option>
                                            ))}
                                        </optgroup>
                                    ))
                                })()}
                            </select>
                        </div>
                    )}

                    {/* Priority */}
                    <div className="space-y-2">
                        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                            {t('teacher.announcements.section_priority') || 'Priorité'}
                        </p>
                        <div className="flex gap-2 flex-wrap">
                            {PRIORITY_KEYS.map(val => {
                                const color = PRIORITY_COLORS[val]
                                const label = t(`teacher.announcements.priority_${val}`) || val
                                return (
                                    <button
                                        key={val}
                                        type="button"
                                        onClick={() => setForm(p => ({ ...p, priority: val }))}
                                        className={cn(
                                            'px-3 h-7 rounded-lg text-xs font-bold border transition-colors',
                                            form.priority === val ? color : 'bg-white/5 border-white/10 text-muted-foreground hover:border-white/20'
                                        )}
                                    >
                                        {label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div className="flex gap-2 justify-end pt-1">
                        <button
                            type="button"
                            onClick={() => setShowForm(false)}
                            className="h-9 px-4 rounded-xl border border-border/50 text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                        >
                            {t('teacher.announcements.btn_cancel') || 'Annuler'}
                        </button>
                        <button
                            type="button"
                            disabled={isPending || !form.title.trim() || !form.content.trim()}
                            onClick={handleCreate}
                            className="h-9 px-4 rounded-xl bg-indigo-500 text-white text-sm font-bold hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                        >
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            {t('teacher.announcements.btn_publish') || 'Publier'}
                        </button>
                    </div>
                </div>
            )}

            {/* List */}
            {loading ? (
                <div className="flex justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            ) : announcements.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                    <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
                        <Megaphone className="w-10 h-10 text-muted-foreground" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold">{t('teacher.announcements.empty_title') || 'Aucune annonce publiée'}</p>
                        <p className="text-xs text-muted-foreground mt-1">{t('teacher.announcements.empty_hint') || 'Cliquez sur "Nouvelle" pour créer votre première annonce'}</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    {announcements.map(ann => {
                        const color = PRIORITY_COLORS[ann.priority] || PRIORITY_COLORS.normal
                        const priorityLabel = t(`teacher.announcements.priority_${ann.priority}`) || ann.priority
                        const audienceOpts = AUDIENCE_OPTIONS
                        return (
                            <div key={ann.id} className="bg-card border border-border/50 rounded-2xl p-4 space-y-2.5 hover:border-white/20 transition-colors group">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded border flex items-center gap-1', color)}>
                                            {ann.priority === 'urgent' || ann.priority === 'high'
                                                ? <AlertTriangle className="w-2.5 h-2.5" />
                                                : <Megaphone className="w-2.5 h-2.5" />
                                            }
                                            {priorityLabel}
                                        </span>
                                        {ann.target_audience.map(aud => {
                                            const opt = audienceOpts.find(o => o.value === aud)
                                            if (!opt) return null
                                            return (
                                                <span key={aud} className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white/5 border border-white/10 text-muted-foreground flex items-center gap-1">
                                                    <opt.icon className="w-2.5 h-2.5" />
                                                    {opt.label}
                                                </span>
                                            )
                                        })}
                                        {ann.target_class_name && (
                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center gap-1">
                                                {ann.school_name && <span className="text-indigo-300/70">{ann.school_name}</span>}
                                                {ann.school_name && <span className="text-indigo-400/40">/</span>}
                                                {ann.target_class_name}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {formatDate(ann.published_at)}
                                        </span>
                                        <button
                                            type="button"
                                            title={t('teacher.announcements.delete') || 'Supprimer'}
                                            disabled={deletingId === ann.id}
                                            onClick={() => handleDelete(ann.id)}
                                            className="opacity-0 group-hover:opacity-100 text-muted-foreground/50 hover:text-red-400 transition-all disabled:opacity-50"
                                        >
                                            {deletingId === ann.id
                                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                : <Trash2 className="w-3.5 h-3.5" />
                                            }
                                        </button>
                                    </div>
                                </div>
                                <h3 className="font-bold text-sm">{ann.title}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{ann.content}</p>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
