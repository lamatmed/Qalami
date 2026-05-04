'use client'

import { useState, useEffect, useMemo } from 'react'
import { Bell, ChevronDown, ChevronUp, Award } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createClient } from '@/utils/supabase/client'
import { useStudent } from '@/context/student-context'

interface Grade {
    id: string
    value: number
    max_value: number
    assessment_type: string
    coefficient: number
    term_id: string
    terms: { id: string; name: string } | null
    created_at: string
    updated_at: string | null
    subjects: { id: string; name: string; icon?: string | null } | null
}

interface SubjectGrades {
    subjectId: string
    subjectName: string
    subjectIcon: string | null
    grades: Grade[]
    average: number
    totalCoeff: number
}

export function StudentGrades() {
    const { student, loading: studentLoading } = useStudent()
    const [grades, setGrades] = useState<Grade[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedSubject, setExpandedSubject] = useState<string | null>(null)
    const [selectedTrimester, setSelectedTrimester] = useState('t1')

    useEffect(() => {
        const fetchGrades = async () => {
            if (!student?.id) {
                setLoading(false)
                return
            }

            const supabase = createClient()

            const { data, error } = await supabase
                .from('grades')
                .select(`
                    id,
                    value,
                    max_value,
                    assessment_type,
                    coefficient,
                    term_id,
                    terms (id, name),
                    created_at,
                    updated_at,
                    subjects (id, name, icon)
                `)
                .eq('student_id', student.id)
                .order('created_at', { ascending: false })

            if (error) {
                console.error('[StudentGrades] Error fetching grades:', error)
            } else {
                setGrades((data as unknown as Grade[]) || [])
            }
            setLoading(false)
        }

        fetchGrades()
    }, [student?.id])

    // Map trimester tab to term value
    const termMap: Record<string, string> = { t1: 'T1', t2: 'T2', t3: 'T3' }
    const currentTerm = termMap[selectedTrimester]

    // Filter grades by selected trimester
    const filteredGrades = useMemo(() => {
        return grades.filter(g => g.terms?.name === currentTerm)
    }, [grades, currentTerm])

    // Group grades by subject and calculate averages
    const subjectGrades = useMemo(() => {
        const grouped: Record<string, SubjectGrades> = {}

        filteredGrades.forEach(grade => {
            const subjectId = grade.subjects?.id || 'unknown'
            const subjectName = grade.subjects?.name || 'Matière inconnue'

            if (!grouped[subjectId]) {
                grouped[subjectId] = {
                    subjectId,
                    subjectName,
                    subjectIcon: grade.subjects?.icon || null,
                    grades: [],
                    average: 0,
                    totalCoeff: 0
                }
            }
            grouped[subjectId].grades.push(grade)
        })

        // Calculate weighted averages
        Object.values(grouped).forEach(subject => {
            let totalWeightedScore = 0
            let totalCoeff = 0

            subject.grades.forEach(grade => {
                const normalizedScore = (grade.value / (grade.max_value || 20)) * 20 // Normalize to /20
                totalWeightedScore += normalizedScore * (grade.coefficient || 1)
                totalCoeff += (grade.coefficient || 1)
            })

            subject.average = totalCoeff > 0 ? totalWeightedScore / totalCoeff : 0
            subject.totalCoeff = totalCoeff
        })

        return Object.values(grouped).sort((a, b) => a.subjectName.localeCompare(b.subjectName))
    }, [filteredGrades])

    // Calculate overall average
    const overallStats = useMemo(() => {
        if (subjectGrades.length === 0) {
            return { average: 0, rank: '-', totalGrades: 0 }
        }

        let totalWeightedAvg = 0
        let totalCoeff = 0

        subjectGrades.forEach(subject => {
            totalWeightedAvg += subject.average * subject.totalCoeff
            totalCoeff += subject.totalCoeff
        })

        const average = totalCoeff > 0 ? totalWeightedAvg / totalCoeff : 0

        return {
            average: average.toFixed(2),
            rank: student?.rank || '-',
            totalGrades: filteredGrades.length
        }
    }, [subjectGrades, filteredGrades.length, student?.rank])

    // Get color based on grade
    const getGradeColor = (value: number, maxValue: number) => {
        const percentage = (value / (maxValue || 20)) * 100
        if (percentage >= 70) return 'text-emerald-400'
        if (percentage >= 50) return 'text-amber-400'
        return 'text-red-400'
    }

    // Get mention based on average
    const getMention = (avg: number) => {
        if (avg >= 16) return 'Très Bien'
        if (avg >= 14) return 'Bien'
        if (avg >= 12) return 'Assez Bien'
        if (avg >= 10) return 'Passable'
        return 'Insuffisant'
    }

    // Get subject icon abbreviation
    const getSubjectAbbr = (name: string) => {
        const abbrs: Record<string, string> = {
            'Mathématiques': 'Ma',
            'Français': 'Fr',
            'Arabe': 'Ar',
            'Physique': 'Ph',
            'Sciences': 'Sc',
            'Histoire': 'Hi',
            'Géographie': 'Gé',
            'Anglais': 'En',
        }
        for (const [key, abbr] of Object.entries(abbrs)) {
            if (name.toLowerCase().includes(key.toLowerCase())) return abbr
        }
        return name.slice(0, 2)
    }

    // Get subject color
    const getSubjectColor = (name: string) => {
        const colors: Record<string, string> = {
            'math': 'blue',
            'français': 'purple',
            'arabe': 'emerald',
            'physique': 'amber',
            'sciences': 'green',
            'histoire': 'orange',
        }
        const nameLower = name.toLowerCase()
        for (const [key, color] of Object.entries(colors)) {
            if (nameLower.includes(key)) return color
        }
        return 'gray'
    }

    if (studentLoading || loading) {
        return (
            <div className="max-w-md mx-auto lg:max-w-3xl pb-24 space-y-6 p-4">
                <div className="animate-pulse space-y-4">
                    <div className="h-12 bg-card rounded-xl" />
                    <div className="h-40 bg-blue-600/50 rounded-3xl" />
                    <div className="h-24 bg-card rounded-2xl" />
                    <div className="h-24 bg-card rounded-2xl" />
                </div>
            </div>
        )
    }

    const avgNum = parseFloat(overallStats.average as string)

    return (
        <div className="max-w-md mx-auto lg:max-w-3xl pb-24 space-y-6 p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-border">
                        <AvatarImage src={student?.avatar} />
                        <AvatarFallback>{student?.name?.slice(0, 2).toUpperCase() || 'EL'}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-cyan-500 font-bold tracking-widest uppercase">QALAMI MAURITANIE</span>
                        <span className="font-bold text-lg">Mes Notes</span>
                    </div>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full">
                    <Bell className="w-5 h-5" />
                </Button>
            </div>

            {/* Trimester Tabs */}
            <Tabs value={selectedTrimester} onValueChange={setSelectedTrimester} className="w-full">
                <TabsList className="bg-card border border-border/50 p-1 rounded-xl w-full grid grid-cols-3 mb-6 h-auto">
                    <TabsTrigger value="t1" className="rounded-lg text-xs py-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white font-bold">1er Trimestre</TabsTrigger>
                    <TabsTrigger value="t2" className="rounded-lg text-xs py-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white font-bold">2ème Trimestre</TabsTrigger>
                    <TabsTrigger value="t3" className="rounded-lg text-xs py-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white font-bold">3ème Trimestre</TabsTrigger>
                </TabsList>

                {/* Main Stats Card */}
                <div className="bg-blue-600 p-6 rounded-[2rem] relative overflow-hidden shadow-xl shadow-blue-500/20 mb-6">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 blur-3xl rounded-full translate-x-10 -translate-y-10" />

                    <div className="relative z-10 space-y-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-blue-200 text-xs font-bold uppercase tracking-wider mb-1">MOYENNE GÉNÉRALE</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-5xl font-bold text-white tracking-tighter">
                                        {filteredGrades.length > 0 ? overallStats.average : '--'}
                                    </span>
                                    <span className="text-xl text-blue-200">/20</span>
                                </div>
                            </div>
                            <span className="bg-white/20 px-3 py-1 rounded-lg text-xs font-bold text-white border border-white/20">
                                Rang: {overallStats.rank} / 32
                            </span>
                        </div>

                        {filteredGrades.length > 0 && (
                            <div className="flex items-center gap-2 pt-2">
                                <Award className="w-5 h-5 text-amber-300" />
                                <span className="font-bold text-white text-sm">
                                    Mention: {getMention(avgNum)}
                                </span>
                            </div>
                        )}

                        <div className="pt-2 flex justify-between items-end">
                            <Button className="bg-white text-blue-600 hover:bg-blue-50 font-bold rounded-xl h-10 px-6">
                                Consulter le Bulletin
                            </Button>
                            <div className="text-right">
                                <span className="block text-[10px] text-blue-200">
                                    {overallStats.totalGrades} notes enregistrées
                                </span>
                                {filteredGrades.length > 0 && (() => {
                                    const latest = filteredGrades.reduce((a, b) => {
                                        const aDate = a.updated_at || a.created_at
                                        const bDate = b.updated_at || b.created_at
                                        return aDate > bDate ? a : b
                                    })
                                    const latestDate = latest.updated_at || latest.created_at
                                    return (
                                        <span className="block text-[10px] text-blue-300/60">
                                            MàJ: {new Date(latestDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                                        </span>
                                    )
                                })()}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Subject List */}
                <div className="space-y-4">
                    <h3 className="font-bold text-sm px-1">Matières & Moyennes</h3>

                    {subjectGrades.length === 0 ? (
                        <div className="bg-card border border-border/50 rounded-2xl p-8 text-center text-muted-foreground">
                            Aucune note enregistrée pour ce trimestre
                        </div>
                    ) : (
                        subjectGrades.map((subject) => {
                            const isExpanded = expandedSubject === subject.subjectId
                            const color = getSubjectColor(subject.subjectName)
                            const iconLabel = subject.subjectIcon || getSubjectAbbr(subject.subjectName)

                            return (
                                <div key={subject.subjectId} className="bg-card border border-border/50 rounded-2xl overflow-hidden">
                                    <div
                                        className={cn(
                                            "p-4 flex items-center justify-between cursor-pointer transition-colors",
                                            isExpanded && "bg-white/5"
                                        )}
                                        onClick={() => setExpandedSubject(isExpanded ? null : subject.subjectId)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs border",
                                                `bg-${color}-500/20 text-${color}-400 border-${color}-500/30`
                                            )}>
                                                {iconLabel}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-sm">{subject.subjectName}</h4>
                                                <p className="text-[10px] text-muted-foreground">
                                                    COEFF: {subject.totalCoeff.toFixed(1)} • {subject.grades.length} NOTES
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={cn(
                                                "text-xl font-bold",
                                                subject.average >= 14 ? "text-emerald-400" :
                                                    subject.average >= 10 ? "text-white" : "text-red-400"
                                            )}>
                                                {subject.average.toFixed(1)}
                                            </span>
                                            {isExpanded ? (
                                                <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                            )}
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="bg-black/20 p-4 space-y-3">
                                            {subject.grades.map((grade) => {
                                                const dateStr = new Date(grade.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
                                                const wasUpdated = grade.updated_at && grade.updated_at !== grade.created_at
                                                const updatedStr = wasUpdated
                                                    ? new Date(grade.updated_at!).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
                                                    : null

                                                return (
                                                    <div key={grade.id} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                                                        <div>
                                                            <p className="font-bold text-xs capitalize">{grade.assessment_type}</p>
                                                            <p className="text-[10px] text-muted-foreground">
                                                                {dateStr} • Coeff x{grade.coefficient || 1}
                                                            </p>
                                                            {updatedStr && (
                                                                <p className="text-[10px] text-amber-500/70">Mis à jour: {updatedStr}</p>
                                                            )}
                                                        </div>
                                                        <span className={cn(
                                                            "font-bold text-sm",
                                                            getGradeColor(grade.value, grade.max_value)
                                                        )}>
                                                            {grade.value}/{grade.max_value || 20}
                                                        </span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    )}
                </div>
            </Tabs>
        </div>
    )
}
