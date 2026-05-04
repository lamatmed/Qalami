'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { ArrowLeft, GraduationCap, MapPin, Clock, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { ParentGrades } from '@/components/parent/parent-grades'
import { ParentSchedule } from '@/components/parent/parent-schedule'
import { ParentAttendance } from '@/components/parent/parent-attendance'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { createClient } from '@/utils/supabase/client'
import { useParent } from '@/context/parent-context'

interface ChildData {
    name: string
    class: string
    school: string
    avatar: string
    average: number | null
    absences: number
}

export default function ChildProfilePage() {
    const params = useParams()
    const childId = params.id as string
    const { childrenList, setSelectedChild } = useParent()
    const [child, setChild] = useState<ChildData | null>(null)
    const [loading, setLoading] = useState(true)

    // Current academic year (Sep–Aug cycle)
    const currentAcademicYear = (() => {
        const now = new Date()
        const y = now.getFullYear()
        return now.getMonth() >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`
    })()

    useEffect(() => {
        async function fetchChildData() {
            setLoading(true)
            const supabase = createClient()

            // Check if we have this child in our context first
            const contextChild = childrenList.find(c => c.id === childId)

            // Fetch profile data
            const { data: profile } = await supabase
                .from('profiles')
                .select(`
                    id,
                    full_name,
                    avatar_url,
                    enrollments!inner (
                        academic_year,
                        status,
                        classes (
                            name,
                            schools (
                                name
                            )
                        )
                    )
                `)
                .eq('id', childId)
                .single()

            if (profile) {
                // Calculate average from grades
                const { data: grades } = await supabase
                    .from('grades')
                    .select('value, max_value, coefficient')
                    .eq('student_id', childId)
                    .eq('term', 'T1')

                let average: number | null = null
                if (grades && grades.length > 0) {
                    let totalWeighted = 0
                    let totalCoeff = 0
                    grades.forEach(g => {
                        const coeff = g.coefficient || 1
                        const normalized = (g.value / (g.max_value || 20)) * 20
                        totalWeighted += normalized * coeff
                        totalCoeff += coeff
                    })
                    average = totalCoeff > 0 ? totalWeighted / totalCoeff : null
                }

                // Count absences
                const { data: attendance } = await supabase
                    .from('attendance')
                    .select('status')
                    .eq('student_id', childId)
                    .neq('status', 'present')

                // Prefer current-year active enrollment; fallback to latest
                const enrollments = profile.enrollments as any[] || []
                const activeEnrollment = enrollments.find(
                    (e: any) => e.academic_year === currentAcademicYear && e.status === 'active'
                ) ?? enrollments[0]

                setChild({
                    name: profile.full_name || 'Élève',
                    class: contextChild?.class || activeEnrollment?.classes?.name || 'Non assigné',
                    school: activeEnrollment?.classes?.schools?.name || '',
                    avatar: profile.full_name?.substring(0, 2).toUpperCase() || 'EL',
                    average,
                    absences: attendance?.length || 0
                })

                // Update context if this child is from context
                if (contextChild) {
                    setSelectedChild(contextChild)
                }
            }

            setLoading(false)
        }

        if (childId) {
            fetchChildData()
        }
    }, [childId, childrenList, setSelectedChild])

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!child) {
        return (
            <div className="space-y-6 p-4">
                <Link href="/parent/children">
                    <Button variant="ghost" size="icon" className="rounded-full">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                </Link>
                <div className="bg-card border border-border rounded-3xl p-6 text-center">
                    <p className="text-muted-foreground">Élève non trouvé.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header / Nav */}
            <div className="flex items-center gap-4">
                <Link href="/parent/children">
                    <Button variant="ghost" size="icon" className="rounded-full">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Profil Élève</h1>
                    <p className="text-muted-foreground text-sm">Vue détaillée</p>
                </div>
            </div>

            {/* Profile Hero Card */}
            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-32 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">
                    <Avatar className="h-20 w-20 border-4 border-white/20 shadow-inner">
                        <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${child.name}`} />
                        <AvatarFallback className="text-2xl bg-blue-700 text-white">{child.avatar}</AvatarFallback>
                    </Avatar>

                    <div className="flex-1 space-y-2">
                        <div>
                            <h2 className="text-2xl font-bold">{child.name}</h2>
                            <div className="flex items-center gap-2 text-blue-200 text-sm">
                                <GraduationCap className="w-4 h-4" />
                                <span>{child.class}{child.school && ` • ${child.school}`}</span>
                            </div>
                        </div>

                        <div className="flex gap-4 pt-2">
                            <div className="bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur-sm border border-white/10">
                                <span className="block text-[10px] text-blue-200 uppercase tracking-widest">Moyenne</span>
                                <span className="font-bold text-lg">
                                    {child.average !== null ? child.average.toFixed(1) : '--'}
                                    <span className="text-xs font-normal opacity-70">/20</span>
                                </span>
                            </div>
                            <div className="bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur-sm border border-white/10">
                                <span className="block text-[10px] text-blue-200 uppercase tracking-widest">Absences</span>
                                <span className="font-bold text-lg">{child.absences}<span className="text-xs font-normal opacity-70">h</span></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Tabs */}
            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="w-full justify-start overflow-x-auto scrollbar-hide bg-transparent p-0 border-b border-border/40 h-auto gap-4 mb-6">
                    <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 pb-2">Vue d'ensemble</TabsTrigger>
                    <TabsTrigger value="grades" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 pb-2">Notes & Bulletin</TabsTrigger>
                    <TabsTrigger value="schedule" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 pb-2">Emploi du temps</TabsTrigger>
                    <TabsTrigger value="attendance" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 pb-2">Absences</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Quick Actions / Recent Activity Placeholder */}
                        <div className="bg-card border border-border/50 rounded-2xl p-6">
                            <h3 className="font-bold mb-4 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-amber-500" /> Activité Récente
                            </h3>
                            <div className="space-y-4">
                                <div className="flex gap-3 text-sm">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                                    <div>
                                        <p className="font-medium">Devoir de Mathématiques rendu</p>
                                        <p className="text-muted-foreground text-xs">Il y a 2 heures</p>
                                    </div>
                                </div>
                                <div className="flex gap-3 text-sm">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                                    <div>
                                        <p className="font-medium">Nouveau bulletin disponible</p>
                                        <p className="text-muted-foreground text-xs">Hier</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-card border border-border/50 rounded-2xl p-6">
                            <h3 className="font-bold mb-4 flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-blue-500" /> Prochain Cours
                            </h3>
                            <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl">
                                <h4 className="font-bold text-lg text-primary">Physique-Chimie</h4>
                                <p className="text-sm text-muted-foreground mb-2">Salle 204 • M. Sy</p>
                                <div className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 bg-white dark:bg-black rounded border border-border">
                                    14:00 - 16:00
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="grades">
                    <ParentGrades studentId={childId} />
                </TabsContent>

                <TabsContent value="schedule">
                    <ParentSchedule studentId={childId} />
                </TabsContent>

                <TabsContent value="attendance">
                    <ParentAttendance studentId={childId} />
                </TabsContent>
            </Tabs>
        </div>
    )
}
