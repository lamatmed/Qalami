'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    Trophy,
    BookOpen,
    Loader2,
    ChevronDown,
    BarChart2,
    Star
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n'
import {
    getTermsForSchool, getClassPerformance,
    type StudentPerf, type TermOption,
} from '@/app/admin/classes/grades-actions'

interface Props {
    resolvedClassId: string
}

const AVG_COLOR = (avg: number | null) => {
    if (avg === null) return 'text-gray-600'
    if (avg >= 16) return 'text-emerald-400'
    if (avg >= 12) return 'text-blue-400'
    if (avg >= 10) return 'text-amber-400'
    return 'text-red-400'
}

const AVG_BAR = (avg: number | null) => {
    if (avg === null) return 'bg-gray-700'
    if (avg >= 16) return 'bg-emerald-500'
    if (avg >= 12) return 'bg-blue-500'
    if (avg >= 10) return 'bg-amber-500'
    return 'bg-red-500'
}

const fmt = (n: number | null) => n !== null ? n.toFixed(1) : '—'

export function ClassPerformance({ resolvedClassId }: Props) {
    const { t } = useLanguage()
    const [terms, setTerms] = useState<TermOption[]>([])
    const [termId, setTermId] = useState('')
    const [activeSubjectId, setActiveSubjectId] = useState<string>('all')
    const [loading, setLoading] = useState(false)
    const [perfData, setPerfData] = useState<{
        students: StudentPerf[]
        classAverage: number | null
        topStudent: StudentPerf | null
        totalGrades: number
        subjectMap: Record<string, string>
        classSubjects: { id: string; name: string; icon: string | null }[]
    } | null>(null)

    // Expanded student row
    const [expandedId, setExpandedId] = useState<string | null>(null)

    // Load terms on mount — déclenche immédiatement loadPerf (termId vide = toutes les notes)
    useEffect(() => {
        getTermsForSchool().then(t => {
            setTerms(t)
            // Ne pas forcer le premier terme : laisser l'utilisateur choisir
            // On charge d'abord toutes les notes (termId=''), puis on filtre si besoin
        })
    }, [])

    // Load performance data when term or subject filter changes
    // termId peut être vide → l'action retourne toutes les notes sans filtre terme
    const loadPerf = useCallback(async () => {
        if (!resolvedClassId) return
        setLoading(true)
        const sid = activeSubjectId !== 'all' ? activeSubjectId : undefined
        const result = await getClassPerformance(resolvedClassId, termId, sid)
        if ('error' in result && result.error) {
            toast.error(result.error)
        } else {
            setPerfData(result as any)
        }
        setLoading(false)
    }, [resolvedClassId, termId, activeSubjectId])

    useEffect(() => { loadPerf() }, [loadPerf])

    const classSubjects = perfData?.classSubjects ?? []
    const currentSubject = classSubjects.find(s => s.id === activeSubjectId)

    return (
        <div className="flex-1 flex flex-col gap-5">

            {/* ── Term selector ── */}
            <div className="relative w-fit">
                <select
                    value={termId}
                    onChange={e => { setTermId(e.target.value); setExpandedId(null) }}
                    className="appearance-none bg-[#161B22] border border-white/8 text-white text-sm rounded-xl h-9 pl-3 pr-8 focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                >
                    <option value="">{t('admin.structure.allPeriods')}</option>
                    {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
            </div>

            {/* ── Subject Filter Tabs ── */}
            {classSubjects.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
                    <button
                        onClick={() => { setActiveSubjectId('all'); setExpandedId(null) }}
                        className={cn(
                            'shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all',
                            activeSubjectId === 'all'
                                ? 'bg-white/10 border-white/20 text-white'
                                : 'bg-[#161B22] border-white/5 text-gray-600 hover:text-gray-400'
                        )}
                    >
                        {t('admin.structure.allSubjectsFilter')}
                    </button>
                    {classSubjects.map(s => (
                        <button
                            key={s.id}
                            onClick={() => { setActiveSubjectId(s.id); setExpandedId(null) }}
                            className={cn(
                                'shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5',
                                activeSubjectId === s.id
                                    ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-300'
                                    : 'bg-[#161B22] border-white/5 text-gray-600 hover:text-gray-400'
                            )}
                        >
                            {s.icon && <span>{s.icon}</span>}
                            {s.name}
                        </button>
                    ))}
                </div>
            )}

            {/* ── Stats Cards ── */}
            {!loading && perfData && (
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-[#161B22] rounded-xl border border-white/5 px-4 py-3">
                        <div className="flex items-center gap-2 mb-1">
                            <BarChart2 className="w-3.5 h-3.5 text-blue-400" />
                            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                                {currentSubject
                                    ? `${t('admin.structure.avgSubjectPrefix')} ${currentSubject.name}`
                                    : t('admin.structure.avgClassLabel')
                                }
                            </p>
                        </div>
                        <p className={cn('text-xl font-black', AVG_COLOR(perfData.classAverage))}>
                            {fmt(perfData.classAverage)}<span className="text-xs font-normal text-gray-600">/20</span>
                        </p>
                    </div>

                    <div className="bg-[#161B22] rounded-xl border border-white/5 px-4 py-3">
                        <div className="flex items-center gap-2 mb-1">
                            <Trophy className="w-3.5 h-3.5 text-amber-400" />
                            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">{t('admin.structure.bestStudentLabel')}</p>
                        </div>
                        {perfData.topStudent ? (
                            <>
                                <p className="text-sm font-bold text-white truncate">{perfData.topStudent.studentName.split(' ')[0]}</p>
                                <p className={cn('text-xs font-semibold', AVG_COLOR(perfData.topStudent.generalAverage))}>
                                    {fmt(perfData.topStudent.generalAverage)}/20
                                </p>
                            </>
                        ) : (
                            <p className="text-sm text-gray-600">—</p>
                        )}
                    </div>

                    <div className="bg-[#161B22] rounded-xl border border-white/5 px-4 py-3">
                        <div className="flex items-center gap-2 mb-1">
                            <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">{t('admin.structure.evaluationsLabel')}</p>
                        </div>
                        <p className="text-xl font-black text-white">{perfData.totalGrades}</p>
                    </div>
                </div>
            )}

            {/* ── Student List ── */}
            <div className="flex-1 bg-[#161B22] rounded-2xl border border-white/5 overflow-hidden">
                <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                    <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                        {activeSubjectId === 'all'
                            ? t('admin.structure.generalRankingLabel').replace('{count}', String(perfData?.students.length ?? 0))
                            : t('admin.structure.subjectGradesLabel').replace('{name}', currentSubject?.name ?? '').replace('{count}', String(perfData?.students.length ?? 0))
                        }
                    </p>
                    {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-600" />}
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16 text-gray-600">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        <span className="text-sm">{t('admin.structure.loadingLabel')}</span>
                    </div>
                ) : !perfData || perfData.students.every(s => s.grades.length === 0) ? (
                    <div className="text-center py-16 text-gray-600 text-sm">
                        <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        {t('admin.structure.noGradesForTerm')}
                        {activeSubjectId !== 'all' && (
                            <p className="text-[11px] mt-1 text-gray-700">
                                {t('admin.structure.inSubject').replace('{name}', currentSubject?.name ?? '')}
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {perfData.students.map(student => {
                            const isExpanded = expandedId === student.studentId
                            const subjectAvg = activeSubjectId !== 'all'
                                ? student.avgBySubject[activeSubjectId] ?? null
                                : student.generalAverage
                            const subjectGrades = student.grades.filter(g =>
                                activeSubjectId === 'all' || g.subjectId === activeSubjectId
                            )
                            const hasGrades = subjectGrades.length > 0

                            return (
                                <div key={student.studentId}>
                                    <button
                                        onClick={() => hasGrades && setExpandedId(isExpanded ? null : student.studentId)}
                                        className={cn(
                                            'w-full flex items-center gap-3 px-5 py-3.5 transition-colors text-left',
                                            hasGrades ? 'hover:bg-white/3 cursor-pointer' : 'cursor-default opacity-60'
                                        )}
                                    >
                                        {/* Rank */}
                                        <span className="w-5 text-center shrink-0">
                                            {student.rank === 1 && hasGrades
                                                ? <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 mx-auto" />
                                                : <span className="text-[11px] font-black text-gray-700">#{student.rank}</span>
                                            }
                                        </span>

                                        {/* Avatar */}
                                        <div className="w-8 h-8 rounded-full bg-white/5 border border-white/8 flex items-center justify-center text-gray-400 text-[11px] font-bold shrink-0">
                                            {student.avatar}
                                        </div>

                                        {/* Name */}
                                        <p className="text-sm font-semibold text-gray-200 flex-1 truncate min-w-0">{student.studentName}</p>

                                        {/* Per-subject mini averages (all mode only) */}
                                        {activeSubjectId === 'all' && (
                                            <div className="hidden sm:flex items-center gap-3 shrink-0">
                                                {classSubjects.slice(0, 4).map(s => {
                                                    const a = student.avgBySubject[s.id] ?? null
                                                    return (
                                                        <div key={s.id} className="text-center min-w-[36px]">
                                                            <p className="text-[9px] text-gray-700 font-medium truncate">{s.name.slice(0, 5)}</p>
                                                            <p className={cn('text-[11px] font-bold', AVG_COLOR(a))}>{fmt(a)}</p>
                                                        </div>
                                                    )
                                                })}
                                                {classSubjects.length > 4 && (
                                                    <span className="text-[10px] text-gray-700">+{classSubjects.length - 4}</span>
                                                )}
                                            </div>
                                        )}

                                        {/* Average + bar */}
                                        <div className="flex items-center gap-3 shrink-0">
                                            <div className="text-right">
                                                <p className={cn('text-base font-black leading-none tabular-nums', AVG_COLOR(subjectAvg))}>
                                                    {fmt(subjectAvg)}
                                                </p>
                                                <p className="text-[10px] text-gray-700">/20</p>
                                            </div>
                                            <div className="w-14 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                <div
                                                    className={cn('h-full rounded-full transition-all', AVG_BAR(subjectAvg))}
                                                    style={{ width: subjectAvg !== null ? `${(subjectAvg / 20) * 100}%` : '0%' }}
                                                />
                                            </div>
                                        </div>
                                    </button>

                                    {/* Expanded grade detail */}
                                    {isExpanded && (
                                        <div className="px-5 pb-4 bg-[#0D1117] border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-150">
                                            <div className="pt-3 space-y-3">
                                                {activeSubjectId === 'all'
                                                    ? classSubjects.map(subj => {
                                                        const sg = student.grades.filter(g => g.subjectId === subj.id)
                                                        if (!sg.length) return null
                                                        return (
                                                            <div key={subj.id}>
                                                                <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                                                    {subj.icon && <span>{subj.icon}</span>}
                                                                    {subj.name}
                                                                </p>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {sg.map(g => <GradePill key={g.id} grade={g} />)}
                                                                </div>
                                                            </div>
                                                        )
                                                    })
                                                    : (
                                                        <div className="flex flex-wrap gap-2">
                                                            {subjectGrades.map(g => <GradePill key={g.id} grade={g} />)}
                                                        </div>
                                                    )
                                                }
                                            </div>
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

const ASSESSMENT_LABELS: Record<string, string> = { devoir: 'Devoir', examen: 'Examen' }

function GradePill({ grade }: { grade: { assessmentType: string; comment: string | null; value: number; maxValue: number; coefficient: number } }) {
    const avg20 = grade.maxValue > 0 ? (grade.value / grade.maxValue) * 20 : 0
    const label = grade.comment || ASSESSMENT_LABELS[grade.assessmentType] || grade.assessmentType
    return (
        <div className="flex items-center gap-1.5 bg-white/4 border border-white/8 rounded-lg px-2.5 py-1.5">
            <span className="text-[11px] text-gray-500">{label}</span>
            <span className={cn('text-[11px] font-bold', AVG_COLOR(avg20))}>
                {grade.value}/{grade.maxValue}
            </span>
            {grade.coefficient !== 1 && (
                <span className="text-[10px] text-gray-700">×{grade.coefficient}</span>
            )}
        </div>
    )
}
