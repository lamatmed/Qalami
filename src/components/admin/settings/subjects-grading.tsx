'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Calculator, BookOpen, X, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import { getMySchoolContext } from '@/app/admin/actions'
import { createSubject, upsertGlobalSubjectCoefficient } from '@/app/admin/subjects/actions'
import { useLanguage } from '@/i18n'
import { toast } from 'sonner'

const SUBJECT_COLORS = [
    'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-orange-500',
    'bg-green-500', 'bg-red-500', 'bg-cyan-500', 'bg-amber-500',
    'bg-indigo-500', 'bg-pink-500'
]

interface SubjectRow {
    id: string
    name: string
    coef: number
    teachers: string
    color: string
}

export function SubjectsGrading() {
    const { t } = useLanguage()
    const [subjects, setSubjects] = useState<SubjectRow[]>([])
    const [loading, setLoading] = useState(true)

    // Add-subject dialog
    const [showAdd, setShowAdd] = useState(false)
    const [newName, setNewName] = useState('')
    const [newIcon, setNewIcon] = useState('')
    const [adding, setAdding] = useState(false)

    // Per-subject coefficient editing
    const [editingCoef, setEditingCoef] = useState<string | null>(null)
    const [coefDraft, setCoefDraft] = useState('')
    const [savingCoef, setSavingCoef] = useState<string | null>(null)
    const coefInputRef = useRef<HTMLInputElement>(null)

    async function load() {
        const ctx = await getMySchoolContext()
        if (!ctx) return
        const supabase = createClient()

        const { data } = await supabase
            .from('subjects')
            .select('id, name')
            .eq('school_id', ctx.school_id)
            .order('name')

        const subjectIds = (data || []).map((s: any) => s.id)

        const [{ data: assignments }, { data: coefData }] = await Promise.all([
            supabase
                .from('teacher_assignments')
                .select('subject_id, profiles!teacher_assignments_teacher_id_fkey(full_name)')
                .in('subject_id', subjectIds),
            supabase
                .from('subject_coefficients')
                .select('subject_id, coefficient')
                .eq('school_id', ctx.school_id)
                .is('class_id', null)
                .in('subject_id', subjectIds),
        ])

        const teacherMap: Record<string, string[]> = {}
        ;(assignments || []).forEach((a: any) => {
            if (!teacherMap[a.subject_id]) teacherMap[a.subject_id] = []
            if (a.profiles?.full_name) teacherMap[a.subject_id].push(a.profiles.full_name)
        })

        const coefMap: Record<string, number> = {}
        ;(coefData || []).forEach((c: any) => { coefMap[c.subject_id] = c.coefficient })

        setSubjects((data || []).map((s: any, i: number) => ({
            id: s.id,
            name: s.name,
            coef: coefMap[s.id] ?? 1,
            teachers: (teacherMap[s.id] || []).join(', ') || t('admin.settings.subjects.unassigned'),
            color: SUBJECT_COLORS[i % SUBJECT_COLORS.length],
        })))
        setLoading(false)
    }

    useEffect(() => { load() }, [])

    // ── Add subject ──────────────────────────────────────────────────────────────
    const handleAdd = async () => {
        if (!newName.trim()) return
        setAdding(true)
        const fd = new FormData()
        fd.append('name', newName.trim())
        if (newIcon.trim()) fd.append('icon', newIcon.trim())
        const result = await createSubject(fd)
        setAdding(false)
        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success(`"${newName.trim()}" ajoutée`)
            setNewName('')
            setNewIcon('')
            setShowAdd(false)
            setLoading(true)
            load()
        }
    }

    // ── Edit coefficient ─────────────────────────────────────────────────────────
    const startEditCoef = (subject: SubjectRow) => {
        setEditingCoef(subject.id)
        setCoefDraft(String(subject.coef))
        setTimeout(() => coefInputRef.current?.select(), 30)
    }

    const saveCoef = async (subjectId: string) => {
        const val = parseFloat(coefDraft)
        if (isNaN(val) || val <= 0) {
            setEditingCoef(null)
            return
        }
        const prev = subjects.find(s => s.id === subjectId)?.coef ?? 1
        if (val === prev) { setEditingCoef(null); return }

        setSavingCoef(subjectId)
        setEditingCoef(null)
        const result = await upsertGlobalSubjectCoefficient(subjectId, val)
        setSavingCoef(null)
        if (result.error) {
            toast.error(result.error)
        } else {
            setSubjects(prev => prev.map(s => s.id === subjectId ? { ...s, coef: val } : s))
            toast.success(t('admin.settings.subjects.coefSaved') || 'Coefficient mis à jour')
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-xl font-bold text-white">{t('admin.settings.subjects.title')}</h3>
                    <p className="text-gray-400 text-sm">{t('admin.settings.subjects.subtitle')}</p>
                </div>
                <Button
                    type="button"
                    size="icon"
                    onClick={() => setShowAdd(true)}
                    className="bg-emerald-500 hover:bg-emerald-600 rounded-full h-10 w-10 shadow-lg shadow-emerald-500/20"
                >
                    <Plus className="w-5 h-5 text-black" />
                </Button>
            </div>

            {/* Add Subject Dialog */}
            {showAdd && (
                <div className="bg-[#1A2530] border border-emerald-500/30 rounded-2xl p-5 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="font-bold text-white text-sm">
                            {t('admin.settings.subjects.addTitle') || 'Nouvelle matière'}
                        </h4>
                        <button type="button" onClick={() => { setShowAdd(false); setNewName(''); setNewIcon('') }} className="text-gray-500 hover:text-white">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex gap-3">
                        <Input
                            autoFocus
                            placeholder={t('admin.settings.subjects.namePlaceholder') || 'Nom de la matière'}
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
                            className="flex-1 bg-[#0F1720] border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-emerald-500/50"
                        />
                        <Input
                            placeholder="🔬"
                            value={newIcon}
                            onChange={e => setNewIcon(e.target.value)}
                            maxLength={4}
                            className="w-16 text-center bg-[#0F1720] border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-emerald-500/50"
                        />
                        <Button
                            type="button"
                            onClick={handleAdd}
                            disabled={adding || !newName.trim()}
                            className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold shrink-0"
                        >
                            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </Button>
                    </div>
                </div>
            )}

            {/* Grading Scale */}
            <div className="bg-[#1A2530] p-5 rounded-2xl border border-white/5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                        <Calculator className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="font-bold text-white">{t('admin.settings.subjects.defaultScale')}</h4>
                        <p className="text-xs text-gray-500">{t('admin.settings.subjects.appliesToAll')}</p>
                    </div>
                </div>
                <div className="flex bg-[#0F1720] p-1 rounded-xl w-full max-w-md">
                    <button type="button" className="flex-1 py-1.5 text-xs font-bold text-gray-400 hover:text-white transition-colors">/10</button>
                    <button type="button" className="flex-1 py-1.5 text-xs font-bold bg-[#1A2530] text-emerald-500 shadow-sm rounded-lg border border-white/5">/20</button>
                    <button type="button" className="flex-1 py-1.5 text-xs font-bold text-gray-400 hover:text-white transition-colors">/100</button>
                </div>
            </div>

            {/* Subjects List */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-white text-sm uppercase tracking-wider">
                        {loading
                            ? t('admin.settings.subjects.loading')
                            : t('admin.settings.subjects.listTitle').replace('{count}', subjects.length.toString())}
                    </h4>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center p-8">
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                    </div>
                ) : subjects.length === 0 ? (
                    <div className="text-center p-8 text-gray-500 text-sm">
                        {t('admin.settings.subjects.noSubjects')}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {subjects.map(subject => (
                            <div key={subject.id} className="group bg-[#1A2530] p-4 rounded-xl border border-white/5 hover:border-emerald-500/30 transition-all flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center text-white shadow-lg', subject.color)}>
                                        <BookOpen className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h5 className="font-bold text-white">{subject.name}</h5>
                                        <p className="text-xs text-gray-500">{subject.teachers}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-gray-400 uppercase">
                                        {t('admin.settings.subjects.coef')}
                                    </span>

                                    {savingCoef === subject.id ? (
                                        <div className="w-16 h-8 flex items-center justify-center">
                                            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                                        </div>
                                    ) : editingCoef === subject.id ? (
                                        <input
                                            ref={coefInputRef}
                                            type="number"
                                            min="0.1"
                                            step="0.5"
                                            value={coefDraft}
                                            onChange={e => setCoefDraft(e.target.value)}
                                            onBlur={() => saveCoef(subject.id)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') saveCoef(subject.id)
                                                if (e.key === 'Escape') setEditingCoef(null)
                                            }}
                                            className="w-16 h-8 bg-[#0F1720] border border-emerald-500/50 rounded-lg text-center text-sm font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                                        />
                                    ) : (
                                        <button
                                            type="button"
                                            title={t('admin.settings.subjects.editCoefTitle') || 'Cliquer pour modifier'}
                                            onClick={() => startEditCoef(subject)}
                                            className="w-16 h-8 px-2 bg-[#0F1720] rounded-lg border border-white/5 hover:border-emerald-500/40 transition-colors text-sm font-bold text-emerald-500 hover:bg-emerald-500/10"
                                        >
                                            {subject.coef}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
