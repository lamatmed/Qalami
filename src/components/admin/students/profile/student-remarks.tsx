'use client'

import { useState, useEffect } from 'react'
import { MessageCircle, Star, AlertTriangle, TrendingUp, Hand, Loader2, School, UserRound, PlusCircle, X, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n'

/* ─── Config ─── */

const CATEGORY_CONFIG: Record<string, { labelKey: string; color: string; bg: string }> = {
    comportement:  { labelKey: 'admin.students.profile.remarksCategoryComportement',  color: 'text-red-400',     bg: 'bg-red-500/10' },
    scolaire:      { labelKey: 'admin.students.profile.remarksCategoryScolaire',      color: 'text-blue-400',    bg: 'bg-blue-500/10' },
    assiduite:     { labelKey: 'admin.students.profile.remarksCategoryAssiduite',     color: 'text-amber-400',   bg: 'bg-amber-500/10' },
    participation: { labelKey: 'admin.students.profile.remarksCategoryParticipation', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    devoirs:       { labelKey: 'admin.students.profile.remarksCategoryDevoirs',       color: 'text-purple-400',  bg: 'bg-purple-500/10' },
    general:       { labelKey: 'admin.students.profile.remarksCategoryGeneral',       color: 'text-gray-400',    bg: 'bg-gray-500/10' },
}

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
    positive:      { icon: Star,          color: 'text-amber-500',   bg: 'bg-amber-500/10',  label: 'Positif' },
    warning:       { icon: AlertTriangle, color: 'text-red-500',     bg: 'bg-red-500/10',    label: 'Avertissement' },
    participation: { icon: Hand,          color: 'text-blue-500',    bg: 'bg-blue-500/10',   label: 'Participation' },
    improvement:   { icon: TrendingUp,    color: 'text-emerald-500', bg: 'bg-emerald-500/10',label: 'Amélioration' },
    concern:       { icon: MessageCircle, color: 'text-purple-500',  bg: 'bg-purple-500/10', label: 'Inquiétude' },
    default:       { icon: MessageCircle, color: 'text-gray-400',    bg: 'bg-gray-500/10',   label: 'Remarque' },
}

/* ─── Types ─── */

interface Remark {
    id: string
    type: string
    category: string | null
    message: string
    created_at: string
    is_visible_to_parent: boolean
    is_visible_to_student: boolean
    sender_type: 'teacher' | 'school' | null
    teacherName: string | null
    subjectName: string | null
}

/* ─── Sender Badge ─── */

function SenderBadge({ senderType, teacherName }: { senderType: 'teacher' | 'school' | null; teacherName: string | null }) {
    const { t } = useLanguage()
    if (senderType === 'school' || !teacherName) {
        return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                <School className="w-2.5 h-2.5" /> {t('admin.students.profile.remarksSchool')}
            </span>
        )
    }
    return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <UserRound className="w-2.5 h-2.5" /> {teacherName}
        </span>
    )
}

/* ─── Main Component ─── */

export function StudentRemarks({ studentId, schoolId, isArchived }: { studentId: string; schoolId: string; isArchived?: boolean }) {
    const { t } = useLanguage()
    const [remarks, setRemarks]           = useState<Remark[]>([])
    const [loading, setLoading]           = useState(true)
    const [categoryFilter, setCategoryFilter] = useState('')
    const [showForm, setShowForm]         = useState(false)
    const [sending, setSending]           = useState(false)

    // Form state
    const [formType, setFormType]         = useState('positive')
    const [formCategory, setFormCategory] = useState('general')
    const [formMessage, setFormMessage]   = useState('')
    const [visibleToParent, setVisibleToParent] = useState(true)
    const [visibleToStudent, setVisibleToStudent] = useState(true)

    /* ─── Fetch ─── */

    async function fetchRemarks() {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('remarks')
            .select(`
                id, type, category, message, created_at,
                is_visible_to_parent, is_visible_to_student, sender_type,
                profiles!remarks_teacher_id_fkey ( full_name ),
                subjects!remarks_subject_id_fkey ( name )
            `)
            .eq('student_id', studentId)
            .eq('school_id', schoolId)
            .order('created_at', { ascending: false })

        if (!error && data) {
            setRemarks(data.map(r => ({
                id: r.id,
                type: r.type,
                category: (r as any).category || null,
                message: r.message,
                created_at: r.created_at,
                is_visible_to_parent: (r as any).is_visible_to_parent ?? true,
                is_visible_to_student: (r as any).is_visible_to_student ?? true,
                sender_type: (r as any).sender_type || null,
                teacherName: (r.profiles as any)?.full_name || null,
                subjectName: (r.subjects as any)?.name || null,
            })))
        }
        setLoading(false)
    }

    useEffect(() => { fetchRemarks() }, [studentId, schoolId])

    /* ─── Send remark as school ─── */

    async function handleSend() {
        if (!formMessage.trim()) return
        setSending(true)

        const supabase = createClient()

        // Get student's active class
        const { data: enrollment } = await supabase
            .from('enrollments')
            .select('class_id')
            .eq('student_id', studentId)
            .eq('school_id', schoolId)
            .eq('status', 'active')
            .maybeSingle()

        const { error } = await supabase
            .from('remarks')
            .insert({
                school_id: schoolId,
                student_id: studentId,
                class_id: enrollment?.class_id || null,
                teacher_id: null,
                sender_type: 'school',
                type: formType,
                category: formCategory,
                message: formMessage.trim(),
                is_visible_to_parent: visibleToParent,
                is_visible_to_student: visibleToStudent,
            })

        if (error) {
            toast.error('Erreur lors de l\'envoi de la remarque')
            console.error('Remark insertion error details:', error.message || error)
        } else {
            toast.success('Remarque envoyée avec succès')
            setFormMessage('')
            setFormType('positive')
            setFormCategory('general')
            setVisibleToParent(true)
            setVisibleToStudent(true)
            setShowForm(false)
            setLoading(true)
            await fetchRemarks()
        }
        setSending(false)
    }

    /* ─── Derived ─── */

    const filteredRemarks = categoryFilter
        ? remarks.filter(r => r.category === categoryFilter)
        : remarks

    const getTypeInfo = (type: string) => TYPE_CONFIG[type] || TYPE_CONFIG.default

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

    /* ─── Render ─── */

    return (
        <div className="bg-[#1A2530] rounded-3xl border border-white/5 p-6 h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-700">

            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-gray-400" />
                    {t('admin.students.profile.remarks')}
                    <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded border border-white/5 font-normal">
                        {remarks.length}
                    </span>
                </h3>
                {!isArchived && (
                    <button
                        onClick={() => setShowForm(v => !v)}
                        className={cn(
                            'flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all',
                            showForm
                                ? 'bg-white/5 border-white/10 text-gray-400'
                                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25'
                        )}
                    >
                        {showForm
                            ? <><X className="w-3.5 h-3.5" /> {t('admin.students.profile.remarksCancel')}</>
                            : <><PlusCircle className="w-3.5 h-3.5" /> {t('admin.students.profile.newRemark')}</>}
                    </button>
                )}
            </div>

            {/* ── Send form (school) ── */}
            {showForm && !isArchived && (
                <div className="mb-4 bg-[#0F1720] rounded-2xl border border-emerald-500/20 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center gap-2 mb-1">
                        <School className="w-4 h-4 text-emerald-400" />
                        <p className="text-xs font-bold text-emerald-400">{t('admin.students.profile.remarksSchoolFormTitle')}</p>
                    </div>

                    {/* Type + Category */}
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">{t('admin.students.profile.remarksTypeLabel')}</label>
                            <select
                                value={formType}
                                onChange={e => setFormType(e.target.value)}
                                className="w-full bg-[#1A2530] border border-white/10 text-xs text-white rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            >
                                {Object.entries(TYPE_CONFIG).filter(([k]) => k !== 'default').map(([k, v]) => (
                                    <option key={k} value={k}>{v.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">{t('admin.students.profile.remarksCategoryLabel')}</label>
                            <select
                                value={formCategory}
                                onChange={e => setFormCategory(e.target.value)}
                                className="w-full bg-[#1A2530] border border-white/10 text-xs text-white rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            >
                                {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                                    <option key={k} value={k}>{t(v.labelKey)}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Message */}
                    <div>
                        <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">{t('admin.students.profile.remarksMessageLabel')}</label>
                        <textarea
                            value={formMessage}
                            onChange={e => setFormMessage(e.target.value)}
                            placeholder={t('admin.students.profile.remarksMessagePlaceholder')}
                            rows={3}
                            className="w-full bg-[#1A2530] border border-white/10 text-sm text-white rounded-xl px-3 py-2 resize-none placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        />
                    </div>

                    {/* Visible to parent/student toggles + send button */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                        <div className="flex flex-wrap gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <div
                                    onClick={() => setVisibleToParent(v => !v)}
                                    className={cn(
                                        'w-8 h-4 rounded-full transition-colors relative',
                                        visibleToParent ? 'bg-emerald-500' : 'bg-white/10'
                                    )}
                                >
                                    <div className={cn(
                                        'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform',
                                        visibleToParent ? 'translate-x-4' : 'translate-x-0.5'
                                    )} />
                                </div>
                                <span className="text-[10px] text-gray-400">{t('admin.students.profile.remarksVisibleToParents')}</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer">
                                <div
                                    onClick={() => setVisibleToStudent(v => !v)}
                                    className={cn(
                                        'w-8 h-4 rounded-full transition-colors relative',
                                        visibleToStudent ? 'bg-emerald-500' : 'bg-white/10'
                                    )}
                                >
                                    <div className={cn(
                                        'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform',
                                        visibleToStudent ? 'translate-x-4' : 'translate-x-0.5'
                                    )} />
                                </div>
                                <span className="text-[10px] text-gray-400">{t('admin.students.profile.remarksVisibleToStudent')}</span>
                            </label>
                        </div>

                        <button
                            onClick={handleSend}
                            disabled={sending || !formMessage.trim()}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-black text-xs font-bold rounded-lg transition-colors self-end sm:self-auto"
                        >
                            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            {t('admin.students.profile.remarksSend')}
                        </button>
                    </div>
                </div>
            )}

            {/* Category Filters */}
            <div className="flex flex-wrap gap-1.5 mb-4">
                <button
                    onClick={() => setCategoryFilter('')}
                    className={cn(
                        'px-3 py-1 rounded-full text-xs font-bold border transition-all',
                        categoryFilter === ''
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                    )}
                >{t('admin.students.profile.remarksFilterAll')}</button>
                {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                    <button
                        key={key}
                        onClick={() => setCategoryFilter(categoryFilter === key ? '' : key)}
                        className={cn(
                            'px-3 py-1 rounded-full text-xs font-bold border transition-all',
                            categoryFilter === key
                                ? `${cfg.bg} ${cfg.color} border-current`
                                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                        )}
                    >{t(cfg.labelKey)}</button>
                ))}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {loading ? (
                    <div className="flex items-center justify-center p-12">
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                    </div>
                ) : filteredRemarks.length === 0 ? (
                    <div className="text-center p-12 text-gray-500 text-sm">
                        {categoryFilter ? t('admin.students.profile.remarksEmptyForCategory') : t('admin.students.profile.remarksEmpty')}
                    </div>
                ) : (
                    filteredRemarks.map(remark => {
                        const typeInfo = getTypeInfo(remark.type)
                        const catInfo  = remark.category ? CATEGORY_CONFIG[remark.category] : null
                        const Icon     = typeInfo.icon

                        return (
                            <div key={remark.id} className="p-4 bg-[#0F1720] rounded-xl border border-white/5 hover:border-white/10 transition-all">
                                <div className="flex gap-3">
                                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', typeInfo.bg)}>
                                        <Icon className={cn('w-5 h-5', typeInfo.color)} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        {/* Top row */}
                                        <div className="flex items-start justify-between gap-2 mb-1.5">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {/* Sender badge */}
                                                <SenderBadge
                                                    senderType={remark.sender_type}
                                                    teacherName={remark.teacherName}
                                                />
                                                {catInfo && (
                                                    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-md', catInfo.bg, catInfo.color)}>
                                                        {t(catInfo.labelKey)}
                                                    </span>
                                                )}
                                                {remark.subjectName && (
                                                    <span className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded-md">
                                                        {remark.subjectName}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-[10px] text-gray-500 shrink-0">{formatDate(remark.created_at)}</span>
                                        </div>

                                        <p className="text-sm text-gray-300">{remark.message}</p>

                                        {/* Visibility indicators */}
                                        <div className="flex flex-col gap-0.5 mt-1.5">
                                            {!remark.is_visible_to_parent && (
                                                <p className="text-[10px] text-gray-600 italic">{t('admin.students.profile.remarksNotVisibleToParents')}</p>
                                            )}
                                            {!remark.is_visible_to_student && (
                                                <p className="text-[10px] text-gray-600 italic">{t('admin.students.profile.remarksNotVisibleToStudent')}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
