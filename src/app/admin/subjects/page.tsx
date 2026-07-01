'use client'

import { AddSubjectDialog } from '@/components/admin/subjects/add-subject-dialog'
import { DeleteSubjectButton } from '@/components/admin/subjects/delete-subject-button'
import { EditSubjectDialog } from '@/components/admin/subjects/edit-subject-dialog'
import { SubjectCoefficientsDialog } from '@/components/admin/subjects/subject-coefficients-dialog'
import { useLanguage } from '@/i18n'
import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, BookOpen, Search, Pencil, Hash } from 'lucide-react'

const SUBJECT_COLORS = [
    { bg: 'bg-emerald-500/20', text: 'text-emerald-500' },
    { bg: 'bg-blue-500/20',    text: 'text-blue-500'    },
    { bg: 'bg-purple-500/20',  text: 'text-purple-500'  },
    { bg: 'bg-amber-500/20',   text: 'text-amber-500'   },
    { bg: 'bg-rose-500/20',    text: 'text-rose-500'    },
    { bg: 'bg-cyan-500/20',    text: 'text-cyan-500'    },
]

const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.07 } },
}
const item = {
    hidden: { y: 16, opacity: 0 },
    show:  { y: 0,  opacity: 1  },
}

export default function SubjectsPage() {
    const { language, t } = useLanguage()
    const [subjects, setSubjects] = useState<any[]>([])
    const [fetchError, setFetchError] = useState(false)
    const [loading, setLoading] = useState(true)
    const [search,   setSearch]   = useState('')
    const [editSubject,  setEditSubject]  = useState<any | null>(null)
    const [coeffSubject, setCoeffSubject] = useState<any | null>(null)

    const fetchData = useCallback(() => {
        setLoading(true)
        setFetchError(false)
        fetch('/api/admin/subjects')
            .then(res => res.ok ? res.json() : Promise.reject(res))
            .then(json => { setSubjects(json.subjects || []) })
            .catch(() => setFetchError(true))
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    const error = fetchError

    const locale   = language === 'ar' ? 'ar-SA' : 'fr-FR'
    const getDisplayName = (s: any) => (language === 'ar' && s.name_ar) ? s.name_ar : s.name
    const filtered = subjects.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.name_ar && s.name_ar.includes(search))
    )

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
        </div>
    )

    if (error) return (
        <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
            {t('admin.subjects.loadError')}
        </div>
    )

    return (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 pb-24">

            {/* Toolbar */}
            <motion.div variants={item} className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={t('admin.subjects.searchPlaceholder')}
                        className="w-full pl-9 pr-3 h-10 bg-card border border-border/50 rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                    />
                </div>
                <AddSubjectDialog onSuccess={fetchData} />
            </motion.div>

            {/* Empty state */}
            {subjects.length === 0 ? (
                <motion.div variants={item}
                    className="flex flex-col items-center justify-center py-20 gap-4 bg-card rounded-3xl border border-border/50"
                >
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                        <BookOpen className="w-6 h-6 text-primary" />
                    </div>
                    <div className="text-center">
                        <p className="font-bold text-foreground">{t('admin.subjects.noSubjects')}</p>
                        <p className="text-sm text-muted-foreground mt-1">{t('admin.subjects.noSubjectsDesc')}</p>
                    </div>
                    <AddSubjectDialog onSuccess={fetchData} />
                </motion.div>
            ) : filtered.length === 0 ? (
                <motion.div variants={item}
                    className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground"
                >
                    <Search className="w-6 h-6 opacity-40" />
                    <p className="text-sm">{t('admin.subjects.noResults', { search })}</p>
                </motion.div>
            ) : (
                /* Subject list — same card pattern as dashboard activity items */
                <div className="space-y-3">
                    {filtered.map((sub, idx) => {
                        const color = SUBJECT_COLORS[idx % SUBJECT_COLORS.length]
                        return (
                            <motion.div
                                key={sub.id}
                                variants={item}
                                className="group flex items-center gap-4 bg-card p-4 rounded-2xl border border-border/50 hover:bg-accent/50 transition-colors cursor-default"
                            >
                                {/* Icon circle */}
                                <div className={`w-12 h-12 rounded-full ${color.bg} flex items-center justify-center shrink-0 text-xl`}>
                                    {sub.icon
                                        ? <span>{sub.icon}</span>
                                        : <BookOpen className={`w-5 h-5 ${color.text}`} />
                                    }
                                </div>

                                {/* Name + date */}
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-sm truncate text-foreground">{getDisplayName(sub)}</h4>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {t('admin.subjects.addedOn', { date: (() => { const _d = new Date(sub.created_at); return _d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Nouakchott' }) + ' ' + _d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nouakchott' }) })() })}
                                    </p>
                                </div>

                                {/* Actions — visible on hover */}
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => setCoeffSubject(sub)}
                                        title={t('admin.subjects.coeffTooltip')}
                                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                    >
                                        <Hash className="w-3.5 h-3.5" />
                                        {t('admin.subjects.coefficients')}
                                    </button>
                                    <button
                                        onClick={() => setEditSubject(sub)}
                                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                        {t('admin.subjects.edit')}
                                    </button>
                                    <DeleteSubjectButton id={sub.id} onSuccess={fetchData} />
                                </div>
                            </motion.div>
                        )
                    })}
                </div>
            )}

            {editSubject && (
                <EditSubjectDialog
                    open={!!editSubject}
                    onOpenChange={(open) => !open && setEditSubject(null)}
                    subject={editSubject}
                    onSuccess={fetchData}
                />
            )}

            {coeffSubject && (
                <SubjectCoefficientsDialog
                    open={!!coeffSubject}
                    onOpenChange={(open) => !open && setCoeffSubject(null)}
                    subject={coeffSubject}
                />
            )}
        </motion.div>
    )
}
