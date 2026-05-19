'use client'

import { useState, useEffect, useMemo } from 'react'
import { Loader2, FileText, TrendingUp, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import { useLanguage } from '@/i18n'
import { getMySchoolContext } from '@/app/admin/actions'

interface Assignment {
    subjectId: string
    subjectName: string
    classId: string
    className: string
}

interface GradeEntry {
    subjectId: string
    term: string
}

const termColor = (term: string) => {
    if (term === 'T1') return 'text-blue-400'
    if (term === 'T2') return 'text-purple-400'
    return 'text-amber-400'
}

export function TeacherEvaluations({ teacherId }: { teacherId: string }) {
    const { t } = useLanguage()
    const [assignments, setAssignments] = useState<Assignment[]>([])
    const [grades, setGrades] = useState<GradeEntry[]>([])
    const [studentCount, setStudentCount] = useState(0)
    const [loading, setLoading] = useState(true)

    const termLabels: Record<string, string> = {
        T1: t('admin.teachers.evaluations.terms.T1'),
        T2: t('admin.teachers.evaluations.terms.T2'),
        T3: t('admin.teachers.evaluations.terms.T3'),
    }

    useEffect(() => {
        const fetch = async () => {
            const supabase = createClient()

            const ctx = await getMySchoolContext()
            const currentSchoolId = ctx?.school_id

            const { data: assignData } = await supabase
                .from('teacher_assignments')
                .select('subject_id, class_id, subjects(name), classes!inner(name, school_id)')
                .eq('teacher_id', teacherId)
                .eq('classes.school_id', currentSchoolId)

            if (!assignData?.length) { setLoading(false); return }

            const subjectIds = [...new Set(assignData.map(a => a.subject_id))]
            const classIds   = [...new Set(assignData.map(a => a.class_id))]

            // Students enrolled in those classes
            const { data: enrollments } = await supabase
                .from('enrollments')
                .select('student_id, class_id')
                .in('class_id', classIds)
                .eq('status', 'active')

            const studentIds = [...new Set((enrollments || []).map(e => e.student_id))]
            setStudentCount(studentIds.length)

            // Grades entered for those students in those subjects
            const { data: gradesData } = studentIds.length > 0
                ? await supabase
                    .from('grades')
                    .select('subject_id, term')
                    .in('student_id', studentIds)
                    .in('subject_id', subjectIds)
                : { data: [] }

            setAssignments((assignData as any[]).map(a => ({
                subjectId: a.subject_id,
                subjectName: (a.subjects as any)?.name || '—',
                classId: a.class_id,
                className: (a.classes as any)?.name || '—',
            })))
            setGrades((gradesData as any[] || []).map(g => ({ subjectId: g.subject_id, term: g.term })))
            setLoading(false)
        }
        fetch()
    }, [teacherId])

    // Grades count grouped by subject + term
    const countMap = useMemo(() => {
        const m = new Map<string, number>()
        grades.forEach(g => {
            const key = `${g.subjectId}|${g.term}`
            m.set(key, (m.get(key) || 0) + 1)
        })
        return m
    }, [grades])

    // Build per-term summaries (only terms with data)
    const termGroups = useMemo(() => {
        return ['T1', 'T2', 'T3'].map(term => {
            const items = assignments
                .map(a => ({
                    subjectName: a.subjectName,
                    className: a.className,
                    count: countMap.get(`${a.subjectId}|${term}`) || 0,
                }))
                .filter(x => x.count > 0)

            return { term, label: termLabels[term], items, total: items.reduce((s, x) => s + x.count, 0) }
        }).filter(g => g.items.length > 0)
    }, [assignments, countMap, termLabels])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
            </div>
        )
    }

    if (assignments.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500 bg-[#1A2530] rounded-3xl border border-white/5">
                <FileText className="w-10 h-10 mb-3 opacity-20" />
                <p className="font-medium">{t('admin.teachers.evaluations.noAssignments')}</p>
                <p className="text-sm mt-1 text-gray-600 text-center max-w-xs">
                    {t('admin.teachers.evaluations.noAssignmentsDesc')}
                </p>
            </div>
        )
    }

    const totalGrades = grades.length

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Summary row */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#1A2530] rounded-2xl border border-white/5 p-4 text-center">
                    <p className="text-2xl font-black text-emerald-500 tabular-nums">{totalGrades}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1 font-bold">{t('admin.teachers.evaluations.gradesEntered')}</p>
                </div>
                <div className="bg-[#1A2530] rounded-2xl border border-white/5 p-4 text-center">
                    <p className="text-2xl font-black text-white tabular-nums">{studentCount}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1 font-bold">{t('admin.teachers.evaluations.students')}</p>
                </div>
                <div className="bg-[#1A2530] rounded-2xl border border-white/5 p-4 text-center">
                    <p className="text-2xl font-black text-blue-400 tabular-nums">
                        {[...new Set(assignments.map(a => a.subjectId))].length}
                    </p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1 font-bold">{t('admin.teachers.evaluations.subjects')}</p>
                </div>
            </div>

            {totalGrades === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-600 bg-[#1A2530] rounded-3xl border border-white/5">
                    <TrendingUp className="w-8 h-8 mb-2 opacity-20" />
                    <p className="text-sm">{t('admin.teachers.evaluations.noGrades')}</p>
                    <p className="text-xs mt-1 text-gray-700">
                        {t('admin.teachers.evaluations.studentsEnrolled').replace('{count}', studentCount.toString())}
                    </p>
                </div>
            ) : (
                termGroups.map(group => (
                    <div key={group.term} className="bg-[#1A2530] rounded-3xl border border-white/5 overflow-hidden">
                        <div className="px-5 py-4 border-b border-white/5 flex justify-between items-center">
                            <h3 className="font-bold text-white">{group.label}</h3>
                            <span className={cn("text-xs font-bold tabular-nums", termColor(group.term))}>
                                {t('admin.teachers.evaluations.gradesCount').replace('{count}', group.total.toString())}
                            </span>
                        </div>
                        <div className="divide-y divide-white/5">
                            {group.items.map((item, i) => (
                                <div key={i} className="px-5 py-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="h-8 w-8 bg-white/5 rounded-lg flex items-center justify-center shrink-0">
                                            <BookOpen className="w-3.5 h-3.5 text-gray-400" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-white truncate">{item.subjectName}</p>
                                            <p className="text-xs text-gray-500">{item.className}</p>
                                        </div>
                                    </div>
                                    <span className={cn("text-xl font-black tabular-nums ml-4", termColor(group.term))}>
                                        {item.count}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            )}
        </div>
    )
}
