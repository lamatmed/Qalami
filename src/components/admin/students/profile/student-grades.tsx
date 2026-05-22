'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Download, FileText, Loader2, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Grade {
    id: string
    value: number
    max_value: number
    assessment_type: string
    coefficient: number
    term_id: string
    terms: { id: string; name: string } | null
    created_at: string
    subjects: { id: string; name: string; icon?: string | null } | null
}

interface SubjectSummary {
    subjectId: string
    subjectName: string
    coefficient: number
    average: number
    grades: Grade[]
}

interface TermSummary {
    term: string
    label: string
    average: number | null
    subjects: SubjectSummary[]
}

const TERM_ORDER = ['T1', 'T2', 'T3']
const TERM_LABELS: Record<string, string> = { T1: '1er Trimestre', T2: '2ème Trimestre', T3: '3ème Trimestre' }

// ─── Main component ────────────────────────────────────────────────────────────

export function StudentGrades({ studentId, schoolId }: { studentId: string; schoolId: string }) {
    const { t, language } = useLanguage()
    const [grades, setGrades] = useState<Grade[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedTerm, setSelectedTerm] = useState('T1')
    const [expandedSubject, setExpandedSubject] = useState<string | null>(null)
    const [showTermDropdown, setShowTermDropdown] = useState(false)

    useEffect(() => {
        async function fetch() {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('grades')
                .select('id, value, max_value, assessment_type, coefficient, term_id, terms!inner(id, name, school_id), created_at, subjects(id, name, icon)')
                .eq('student_id', studentId)
                .eq('terms.school_id', schoolId)
                .order('created_at', { ascending: true })

            if (!error) setGrades((data as unknown as Grade[]) || [])
            setLoading(false)
        }
        fetch()
    }, [studentId, schoolId])

    // Build term summaries
    const terms: TermSummary[] = useMemo(() => {
        return TERM_ORDER.map(term => {
            const termGrades = grades.filter(g => g.terms?.name === term)

            // Group by subject
            const bySubject = new Map<string, { name: string; coef: number; grades: Grade[] }>()
            termGrades.forEach(g => {
                const sid = g.subjects?.id ?? 'unknown'
                if (!bySubject.has(sid)) {
                    bySubject.set(sid, { name: g.subjects?.name ?? '—', coef: g.coefficient || 1, grades: [] })
                }
                bySubject.get(sid)!.grades.push(g)
            })

            // Compute subject averages (mean of grades normalized to /20)
            const subjects: SubjectSummary[] = []
            let totalWeight = 0, weightedSum = 0

            bySubject.forEach((data, subjectId) => {
                const subjectAvg = data.grades.reduce((sum, g) => sum + (g.value / g.max_value) * 20, 0) / data.grades.length
                subjects.push({
                    subjectId,
                    subjectName: data.name,
                    coefficient: data.coef,
                    average: Math.round(subjectAvg * 100) / 100,
                    grades: data.grades,
                })
                totalWeight += data.coef
                weightedSum += subjectAvg * data.coef
            })

            const average = subjects.length > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : null

            return {
                term,
                label: TERM_LABELS[term],
                average,
                subjects,
            }
        })
    }, [grades])

    const currentTerm = terms.find(t => t.term === selectedTerm)!
    const overallAvg = useMemo(() => {
        const withGrades = terms.filter(t => t.average !== null)
        if (withGrades.length === 0) return null
        return Math.round((withGrades.reduce((s, t) => s + t.average!, 0) / withGrades.length) * 100) / 100
    }, [terms])

    const handleDownload = () => {
        const t = currentTerm
        let txt = `BULLETIN SCOLAIRE — ${t.label}\n`
        txt += `Moyenne générale : ${t.average?.toFixed(2) ?? '—'}/20\n\n`
        t.subjects.forEach(s => {
            txt += `${s.subjectName} (Coef ${s.coefficient}) — ${s.average.toFixed(2)}/20\n`
            s.grades.forEach(g => {
                txt += `  · ${g.assessment_type || 'Évaluation'} : ${g.value}/${g.max_value}\n`
            })
        })
        txt += `\n${t('admin.students.register.confirmation.generatedBy')} — ${new Date().toLocaleDateString(language === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR')}`
        const blob = new Blob([txt], { type: 'text/plain;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `bulletin-${t.term.toLowerCase()}.txt`
        a.click()
        URL.revokeObjectURL(url)
        toast.success(t('common.download'))
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
            </div>
        )
    }

    if (grades.length === 0) {
        return (
            <div className="text-center py-16 text-gray-500">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="font-medium">{t('admin.students.profile.noGrades')}</p>
                <p className="text-sm mt-1 text-gray-600">{t('admin.students.profile.gradesAppearHint')}</p>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Term cards */}
            <div className="grid grid-cols-3 gap-3">
                {terms.map(t => (
                    <button
                        key={t.term}
                        onClick={() => { if (t.average !== null) setSelectedTerm(t.term) }}
                        disabled={t.average === null}
                        className={cn(
                            "rounded-2xl p-4 border text-left transition-all",
                            selectedTerm === t.term
                                ? "bg-emerald-500/10 border-emerald-500/30 ring-1 ring-emerald-500/20"
                                : t.average !== null
                                    ? "bg-[#1A2530] border-white/5 hover:border-white/20"
                                    : "bg-[#1A2530] border-white/5 opacity-40 cursor-not-allowed"
                        )}
                    >
                        <p className={cn("text-xs font-bold mb-2", selectedTerm === t.term ? "text-emerald-400" : "text-gray-500")}>
                            {t.label}
                        </p>
                        <p className="text-2xl font-black text-white">
                            {t.average !== null ? t.average.toFixed(1) : '—'}
                            <span className="text-sm text-gray-500 font-normal">/20</span>
                        </p>
                    </button>
                ))}
            </div>

            {/* Overall average + download */}
            <div className="bg-[#1A2530] rounded-3xl border border-white/5 p-5 flex items-center justify-between gap-4">
                <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t('admin.students.profile.yearlyAverage')}</p>
                    <p className="text-sm text-gray-400 mt-0.5">{t('admin.students.profile.validatedTerms')}</p>
                </div>
                <div className="flex items-center gap-4">
                    {overallAvg !== null ? (
                        <p className="text-4xl font-black text-emerald-500 tabular-nums">
                            {overallAvg.toFixed(1)}<span className="text-lg text-gray-500 font-normal">/20</span>
                        </p>
                    ) : (
                        <p className="text-2xl font-black text-gray-600">—</p>
                    )}
                    <Button
                        className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold gap-2"
                        onClick={handleDownload}
                        disabled={currentTerm.subjects.length === 0}
                    >
                        <Download className="w-4 h-4" /> {t('admin.students.profile.reportCard')}
                    </Button>
                </div>
            </div>

            {/* Subject details */}
            <div className="bg-[#1A2530] rounded-3xl border border-white/5 overflow-hidden">
                <div className="p-5 border-b border-white/5 flex justify-between items-center">
                    <h3 className="font-bold text-white">{t('admin.students.profile.bySubjectDetails')}</h3>
                    <div className="relative">
                        <button
                            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                            onClick={() => setShowTermDropdown(!showTermDropdown)}
                        >
                            {TERM_LABELS[selectedTerm]} <ChevronDown className="w-3 h-3" />
                        </button>
                        {showTermDropdown && (
                            <div className="absolute right-0 top-full mt-1 w-44 bg-[#0F1720] border border-white/10 rounded-xl shadow-xl z-20 py-1">
                                {terms.filter(t => t.average !== null).map(t => (
                                    <button
                                        key={t.term}
                                        className={cn("w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors", selectedTerm === t.term ? "text-emerald-400 font-bold" : "text-gray-300")}
                                        onClick={() => { setSelectedTerm(t.term); setShowTermDropdown(false) }}
                                    >
                                        {t.label} — {t.average?.toFixed(1)}/20
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {currentTerm.subjects.length === 0 ? (
                    <div className="text-center py-12 text-gray-600">
                        <p>{t('admin.students.profile.noGradesFor')} {TERM_LABELS[selectedTerm]}</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {currentTerm.subjects.map(subject => {
                            const pct = (subject.average / 20) * 100
                            const color = subject.average >= 15 ? "text-emerald-500" : subject.average >= 10 ? "text-blue-400" : "text-orange-500"
                            return (
                                <div key={subject.subjectId}>
                                    <div
                                        className="p-5 flex items-center justify-between hover:bg-[#0F1720] transition-colors cursor-pointer"
                                        onClick={() => setExpandedSubject(expandedSubject === subject.subjectId ? null : subject.subjectId)}
                                    >
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-white text-sm">{subject.subjectName}</h4>
                                                <Badge variant="outline" className="text-[10px] text-gray-500 border-white/10 bg-white/5">Coef {subject.coefficient}</Badge>
                                            </div>
                                            <p className="text-xs text-gray-600 mt-0.5">{subject.grades.length} évaluation{subject.grades.length !== 1 ? 's' : ''}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className={cn("font-bold text-lg tabular-nums", color)}>{subject.average.toFixed(1)}</p>
                                            <Progress value={pct} className="h-1 w-20 bg-black/40 mt-1" />
                                        </div>
                                    </div>

                                    {expandedSubject === subject.subjectId && (
                                        <div className="bg-[#0F1720] px-5 py-4 border-t border-white/5 space-y-2 animate-in fade-in duration-150">
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">{t('admin.students.profile.assessments')}</p>
                                            {subject.grades.map((g, i) => (
                                                <div key={i} className="flex items-center justify-between py-1.5">
                                                    <span className="text-sm text-gray-400">{g.assessment_type || 'Évaluation'}</span>
                                                    <div className="flex items-center gap-3">
                                                        <Progress value={(g.value / g.max_value) * 100} className="h-1.5 w-20 bg-black/40" />
                                                        <span className={cn(
                                                            "text-sm font-bold tabular-nums min-w-[48px] text-right",
                                                            g.value / g.max_value >= 0.75 ? "text-emerald-400" :
                                                            g.value / g.max_value >= 0.5 ? "text-blue-400" : "text-orange-400"
                                                        )}>
                                                            {g.value}/{g.max_value}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
