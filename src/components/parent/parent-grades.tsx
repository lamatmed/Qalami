'use client'

import { useState, useEffect } from 'react'
import { Bell, Award, TrendingUp, Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { useParent } from '@/context/parent-context'
import { createClient } from '@/utils/supabase/client'

interface SubjectGrade {
    subjectId: string
    subjectName: string
    average: number
    coefficient: number
    icon: string
    color: string
    grades: {
        id: string
        value: number
        maxValue: number
        assessmentType: string
        createdAt: string
        updatedAt: string | null
    }[]
}

interface ParentGradesProps {
    studentId?: string
}

export function ParentGrades({ studentId }: ParentGradesProps = {}) {
    const { selectedChild, loading } = useParent()
    const [subjectGrades, setSubjectGrades] = useState<SubjectGrade[]>([])
    const [loadingGrades, setLoadingGrades] = useState(false)
    const [overallAverage, setOverallAverage] = useState<number | null>(null)
    const [expandedSubject, setExpandedSubject] = useState<string | null>(null)

    // Use provided studentId or fall back to selectedChild from context
    const effectiveStudentId = studentId || selectedChild?.id

    useEffect(() => {
        async function fetchGrades() {
            if (!effectiveStudentId) return

            setLoadingGrades(true)
            const supabase = createClient()

            try {
                // Fetch grades with subject info
                const { data: grades } = await supabase
                    .from('grades')
                    .select(`
                        id,
                        value,
                        max_value,
                        coefficient,
                        assessment_type,
                        term_id,
                        terms (id, name),
                        created_at,
                        updated_at,
                        subjects (
                            id,
                            name,
                            icon,
                            coefficient
                        )
                    `)
                    .eq('student_id', effectiveStudentId)
                    .order('created_at', { ascending: false })

                // Filter client-side for T1 (premier trimestre)
                const t1Grades = (grades || []).filter((g: { terms: { name: string } | null }) => g.terms?.name === 'T1')

                if (t1Grades.length > 0) {
                    // Group grades by subject
                    const subjectMap = new Map<string, SubjectGrade>()
                    const icons = ['Σ', 'Fr', 'Sc', 'Hi', 'En', 'Ar']
                    const colors = [
                        'bg-blue-500/10 text-blue-500',
                        'bg-amber-500/10 text-amber-500',
                        'bg-emerald-500/10 text-emerald-500',
                        'bg-purple-500/10 text-purple-500',
                        'bg-red-500/10 text-red-500',
                        'bg-cyan-500/10 text-cyan-500'
                    ]
                    let iconIndex = 0

                    t1Grades.forEach((g: {
                        id: string
                        value: number
                        max_value: number
                        coefficient: number
                        assessment_type: string
                        created_at: string
                        updated_at: string | null
                        terms: { id: string; name: string } | null
                        subjects: { id: string; name: string; icon?: string | null; coefficient?: number | null } | null
                    }) => {
                        const subjectId = g.subjects?.id || 'unknown'
                        const subjectName = g.subjects?.name || 'Matière'
                        // Use subject-level coefficient from DB, fallback to grade coefficient, then 1
                        const subjectCoeff = g.subjects?.coefficient ?? g.coefficient ?? 1
                        // Use subject icon from DB, fallback to cycling abbreviations
                        const subjectIcon = g.subjects?.icon || icons[iconIndex % icons.length]

                        if (!subjectMap.has(subjectId)) {
                            subjectMap.set(subjectId, {
                                subjectId,
                                subjectName,
                                average: 0,
                                coefficient: subjectCoeff,
                                icon: subjectIcon,
                                color: colors[iconIndex % colors.length],
                                grades: []
                            })
                            iconIndex++
                        }

                        subjectMap.get(subjectId)!.grades.push({
                            id: g.id,
                            value: g.value,
                            maxValue: g.max_value || 20,
                            assessmentType: g.assessment_type,
                            createdAt: g.created_at,
                            updatedAt: g.updated_at || null
                        })
                    })

                    // Calculate averages per subject
                    let totalWeighted = 0
                    let totalCoeff = 0

                    subjectMap.forEach((subject) => {
                        const subjectTotal = subject.grades.reduce((sum, g) => sum + (g.value / g.maxValue * 20), 0)
                        subject.average = subject.grades.length > 0 ? subjectTotal / subject.grades.length : 0
                        totalWeighted += subject.average * subject.coefficient
                        totalCoeff += subject.coefficient
                    })

                    setSubjectGrades(Array.from(subjectMap.values()))
                    setOverallAverage(totalCoeff > 0 ? totalWeighted / totalCoeff : null)

                    // Expand first subject by default
                    if (subjectMap.size > 0) {
                        setExpandedSubject(Array.from(subjectMap.keys())[0])
                    }
                } else {
                    setSubjectGrades([])
                    setOverallAverage(null)
                }

            } catch (err) {
                console.error('Error fetching grades:', err)
            }

            setLoadingGrades(false)
        }

        fetchGrades()
    }, [effectiveStudentId])

    const formatAssessmentType = (type: string) => {
        const types: Record<string, string> = {
            'examen': 'Examen',
            'controle': 'Contrôle',
            'devoir': 'Devoir',
            'participation': 'Participation'
        }
        return types[type] || type
    }

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    // When used as embedded component (studentId prop), skip selectedChild check
    if (!effectiveStudentId) {
        return (
            <div className="max-w-md mx-auto lg:max-w-3xl lg:ms-12 lg:me-auto p-4">
                <div className="bg-card border border-border rounded-3xl p-6 text-center">
                    <p className="text-muted-foreground">Aucun enfant sélectionné.</p>
                </div>
            </div>
        )
    }

    // When used as embedded component (with studentId prop), show simplified version without header
    const isEmbedded = !!studentId

    return (
        <div className={isEmbedded ? "space-y-6" : "max-w-md mx-auto lg:max-w-3xl lg:ms-12 lg:me-auto pb-24 space-y-6 p-4"}>
            {/* Header - only show when not embedded */}
            {!isEmbedded && selectedChild && (
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-border">
                        <AvatarImage src="https://github.com/shadcn.png" />
                        <AvatarFallback>{selectedChild.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="font-bold text-lg">{selectedChild.name}</span>
                        <span className="text-xs text-muted-foreground">{selectedChild.class}</span>
                    </div>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full">
                    <Bell className="w-5 h-5" />
                </Button>
            </div>
            )}

            {/* Main Stats Card */}
            <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border border-indigo-500/20 rounded-3xl p-6 relative overflow-hidden">
                <div className="flex justify-between items-start z-10 relative">
                    <div>
                        <div className="bg-indigo-500/20 text-indigo-300 text-[10px] font-bold px-3 py-1 rounded-full w-fit mb-2 border border-indigo-500/30">
                            Premier Trimestre
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Moyenne Générale</span>
                            <div className="flex items-baseline gap-1">
                                {loadingGrades ? (
                                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                                ) : overallAverage !== null ? (
                                    <>
                                        <span className="text-4xl font-bold text-white">{overallAverage.toFixed(1)}</span>
                                        <span className="text-lg text-indigo-200/70">/20</span>
                                    </>
                                ) : (
                                    <span className="text-2xl font-bold text-muted-foreground">--</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6 z-10 relative">
                    <div className="bg-black/20 rounded-xl p-3 flex items-center gap-3 border border-indigo-500/10">
                        <TrendingUp className="w-5 h-5 text-emerald-400" />
                        <div>
                            <p className="text-emerald-400 font-bold text-sm">{subjectGrades.length} matières</p>
                            <p className="text-[10px] text-muted-foreground">Évaluées ce trimestre</p>
                        </div>
                    </div>
                    <div className="bg-black/20 rounded-xl p-3 flex items-center gap-3 border border-indigo-500/10">
                        <Award className="w-5 h-5 text-purple-400" />
                        <div>
                            <p className="text-purple-400 font-bold text-sm">
                                {subjectGrades.reduce((sum, s) => sum + s.grades.length, 0)} notes
                            </p>
                            {(() => {
                                const allGrades = subjectGrades.flatMap(s => s.grades)
                                if (allGrades.length === 0) return <p className="text-[10px] text-muted-foreground">Total enregistrées</p>
                                const latest = allGrades.reduce((a, b) => {
                                    const aDate = a.updatedAt || a.createdAt
                                    const bDate = b.updatedAt || b.createdAt
                                    return aDate > bDate ? a : b
                                })
                                const latestDate = latest.updatedAt || latest.createdAt
                                return (
                                    <p className="text-[10px] text-muted-foreground">
                                        MàJ: {formatDate(latestDate)}
                                    </p>
                                )
                            })()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Subject Details */}
            <div className="space-y-4">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Détail des matières</h2>

                {loadingGrades && (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                )}

                {!loadingGrades && subjectGrades.length === 0 && (
                    <div className="bg-card border border-border/50 rounded-3xl p-6 text-center">
                        <p className="text-muted-foreground">Aucune note enregistrée pour ce trimestre.</p>
                    </div>
                )}

                {subjectGrades.map((subject) => (
                    <div key={subject.subjectId} className="bg-card border border-border/50 rounded-3xl overflow-hidden">
                        <div
                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                            onClick={() => setExpandedSubject(expandedSubject === subject.subjectId ? null : subject.subjectId)}
                        >
                            <div className="flex items-center gap-4">
                                <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center font-bold border border-white/5", subject.color)}>
                                    {subject.icon}
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm">{subject.subjectName}</h3>
                                    <p className="text-[10px] text-muted-foreground">Coef. {subject.coefficient} • {subject.grades.length} évaluations</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="block font-bold text-lg">{subject.average.toFixed(1)}/20</span>
                            </div>
                        </div>

                        {/* Expanded Content */}
                        {expandedSubject === subject.subjectId && (
                            <div className="bg-black/20 px-4 pb-4 space-y-3 pt-2">
                                {subject.grades.map((grade) => {
                                    const wasUpdated = grade.updatedAt && grade.updatedAt !== grade.createdAt
                                    return (
                                        <div key={grade.id} className="bg-white/5 rounded-xl p-3 border border-white/5">
                                            <div className="flex justify-between items-start mb-1">
                                                <div>
                                                    <span className="text-xs font-bold">
                                                        {formatAssessmentType(grade.assessmentType)}
                                                        <span className="text-muted-foreground font-normal ml-1">{formatDate(grade.createdAt)}</span>
                                                    </span>
                                                    {wasUpdated && (
                                                        <p className="text-[10px] text-amber-500/70 mt-0.5">
                                                            Mis à jour: {formatDate(grade.updatedAt!)}
                                                        </p>
                                                    )}
                                                </div>
                                                <span className="text-sm font-bold">{grade.value}/{grade.maxValue}</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-12 shadow-lg shadow-indigo-600/20 font-semibold gap-2">
                <Download className="w-4 h-4" />
                Télécharger le Bulletin
            </Button>
        </div>
    )
}
