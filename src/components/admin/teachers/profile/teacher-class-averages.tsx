'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Loader2, GraduationCap, TrendingUp, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/i18n'
import { getMySchoolContext } from '@/app/admin/actions'

interface GradeRow {
    value: number
    student: { id: string; full_name: string | null } | null
    subject: { name: string } | null
    class: { id: string; name: string } | null
}

interface ClassStat {
    classId: string
    className: string
    grades: GradeRow[]
    average: number
    best: { name: string; avg: number } | null
}

function avg(nums: number[]) {
    if (!nums.length) return 0
    return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100
}

function colorForAvg(a: number) {
    if (a >= 16) return 'text-emerald-400'
    if (a >= 12) return 'text-blue-400'
    if (a >= 10) return 'text-amber-400'
    return 'text-red-400'
}

function bgForAvg(a: number) {
    if (a >= 16) return 'bg-emerald-500/10 border-emerald-500/20'
    if (a >= 12) return 'bg-blue-500/10 border-blue-500/20'
    if (a >= 10) return 'bg-amber-500/10 border-amber-500/20'
    return 'bg-red-500/10 border-red-500/20'
}

export function TeacherClassAverages({ teacherId }: { teacherId: string }) {
    const { t } = useLanguage()
    const [grades, setGrades] = useState<GradeRow[]>([])
    const [loading, setLoading] = useState(true)
 
    useEffect(() => {
        async function load() {
            const supabase = createClient()
            const ctx = await getMySchoolContext()
            const currentSchoolId = ctx?.school_id

            const { data } = await supabase
                .from('grades')
                .select(`
                    value,
                    student:profiles!grades_student_id_fkey ( id, full_name ),
                    subject:subjects ( name ),
                    class:classes ( id, name )
                `)
                .eq('teacher_id', teacherId)
                .eq('school_id', currentSchoolId)
 
            if (data) setGrades(data as unknown as GradeRow[])
            setLoading(false)
        }
        load()
    }, [teacherId])
 
    const classStats = useMemo<ClassStat[]>(() => {
        const map = new Map<string, GradeRow[]>()
 
        for (const g of grades) {
            if (!g.class?.id) continue
            const key = g.class.id
            if (!map.has(key)) map.set(key, [])
            map.get(key)!.push(g)
        }
 
        return Array.from(map.entries()).map(([classId, rows]) => {
            const className = rows[0].class?.name ?? classId
 
            // Per-student averages
            const studentMap = new Map<string, { name: string; values: number[] }>()
            for (const r of rows) {
                if (!r.student?.id) continue
                const sid = r.student.id
                if (!studentMap.has(sid)) studentMap.set(sid, { name: r.student.full_name ?? t('admin.teachers.averages.studentFallback'), values: [] })
                studentMap.get(sid)!.values.push(r.value)
            }
 
            const studentAvgs = Array.from(studentMap.values()).map(s => ({
                name: s.name,
                avg: avg(s.values),
            }))
 
            studentAvgs.sort((a, b) => b.avg - a.avg)
 
            return {
                classId,
                className,
                grades: rows,
                average: avg(rows.map(r => r.value)),
                best: studentAvgs[0] ?? null,
            }
        }).sort((a, b) => b.average - a.average)
    }, [grades, t])
 
    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
        </div>
    )
 
    if (grades.length === 0) return (
        <div className="text-center py-20 bg-[#1A2530] rounded-3xl border border-white/5">
            <GraduationCap className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">{t('admin.teachers.averages.noGrades')}</p>
            <p className="text-xs text-gray-600 mt-1">{t('admin.teachers.averages.noGradesDesc')}</p>
        </div>
    )

    return (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#1A2530] rounded-2xl border border-white/5 p-4 text-center">
                    <p className="text-2xl font-black text-white">{classStats.length}</p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">{t('admin.teachers.averages.classes')}</p>
                </div>
                <div className="bg-[#1A2530] rounded-2xl border border-white/5 p-4 text-center">
                    <p className={cn('text-2xl font-black', colorForAvg(avg(grades.map(g => g.value))))}>
                        {avg(grades.map(g => g.value)).toFixed(2)}
                    </p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">{t('admin.teachers.averages.generalAverage')}</p>
                </div>
            </div>

            {/* Per-class cards */}
            <div className="space-y-4">
                {classStats.map(cls => (
                    <div key={cls.classId} className="bg-[#1A2530] rounded-3xl border border-white/5 overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center">
                                    <Users className="w-4 h-4 text-emerald-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white">{cls.className}</p>
                                    <p className="text-[10px] text-gray-500">{t('admin.teachers.averages.gradesCount').replace('{count}', cls.grades.length.toString()).replace('{plural}', cls.grades.length !== 1 ? 's' : '')}</p>
                                </div>
                            </div>
                            <div className={cn('px-4 py-1.5 rounded-full border text-sm font-black', bgForAvg(cls.average), colorForAvg(cls.average))}>
                                {cls.average.toFixed(2)} / 20
                            </div>
                        </div>

                        {/* Best */}
                        <div className="grid grid-cols-1">
                            <div className="p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                                    <p className="text-[10px] font-bold text-gray-500 uppercase">{t('admin.teachers.averages.bestStudent')}</p>
                                </div>
                                {cls.best ? (
                                    <>
                                        <p className="text-sm font-bold text-white truncate">{cls.best.name}</p>
                                        <p className="text-xs text-emerald-400 font-bold mt-0.5">{cls.best.avg.toFixed(2)} / 20</p>
                                    </>
                                ) : (
                                    <p className="text-xs text-gray-600">—</p>
                                )}
                            </div>
                        </div>

                        {/* Grade distribution bar */}
                        <div className="px-5 pb-4">
                            <div className="flex rounded-full overflow-hidden h-2 gap-px">
                                {(() => {
                                    const excellent = cls.grades.filter(g => g.value >= 16).length
                                    const good      = cls.grades.filter(g => g.value >= 12 && g.value < 16).length
                                    const pass      = cls.grades.filter(g => g.value >= 10 && g.value < 12).length
                                    const fail      = cls.grades.filter(g => g.value < 10).length
                                    const total     = cls.grades.length
                                    const pct = (n: number) => `${Math.round((n / total) * 100)}%`
                                    return (
                                        <>
                                            {excellent > 0 && <div className="bg-emerald-500 rounded-l-full" style={{ width: pct(excellent) }} title={`Excellent: ${excellent}`} />}
                                            {good      > 0 && <div className="bg-blue-500"                style={{ width: pct(good) }}      title={`Bien: ${good}`} />}
                                            {pass      > 0 && <div className="bg-amber-500"               style={{ width: pct(pass) }}      title={`Passable: ${pass}`} />}
                                            {fail      > 0 && <div className="bg-red-500 rounded-r-full"  style={{ width: pct(fail) }}      title={`Insuffisant: ${fail}`} />}
                                        </>
                                    )
                                })()}
                            </div>
                            <div className="flex gap-4 mt-2">
                                {[
                                    { label: '≥16', color: 'text-emerald-400', count: cls.grades.filter(g => g.value >= 16).length },
                                    { label: '12–16', color: 'text-blue-400',   count: cls.grades.filter(g => g.value >= 12 && g.value < 16).length },
                                    { label: '10–12', color: 'text-amber-400',  count: cls.grades.filter(g => g.value >= 10 && g.value < 12).length },
                                    { label: '<10', color: 'text-red-400',      count: cls.grades.filter(g => g.value < 10).length },
                                ].map(seg => (
                                    <div key={seg.label} className="flex items-center gap-1">
                                        <p className={cn('text-[10px] font-bold', seg.color)}>{seg.label}</p>
                                        <p className="text-[10px] text-gray-600">({seg.count})</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
