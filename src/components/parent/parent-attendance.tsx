'use client'

import { useState, useEffect } from 'react'
import { Bell, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from '@/lib/utils'
import { useParent } from '@/context/parent-context'
import { createClient } from '@/utils/supabase/client'

interface AttendanceRecord {
    id: string
    date: string
    status: string
    justified: boolean
    justification_note: string | null
    subjectName: string | null
    subjectIcon: string | null
    startTime: string | null
    endTime: string | null
}

interface ParentAttendanceProps {
    studentId?: string
}

export function ParentAttendance({ studentId }: ParentAttendanceProps = {}) {
    const { selectedChild, loading } = useParent()
    const [absences, setAbsences] = useState<AttendanceRecord[]>([])
    const [loadingData, setLoadingData] = useState(false)
    const [stats, setStats] = useState({ total: 0, justified: 0, unjustified: 0 })

    const effectiveStudentId = studentId || selectedChild?.id

    useEffect(() => {
        async function fetchAttendance() {
            if (!effectiveStudentId) return

            setLoadingData(true)
            const supabase = createClient()

            try {
                const { data, error } = await supabase
                    .from('attendance')
                    .select(`
                        id,
                        date,
                        status,
                        justified,
                        justification_note,
                        subjects (name, icon),
                        schedule (start_time, end_time)
                    `)
                    .eq('student_id', effectiveStudentId)
                    .neq('status', 'present')
                    .order('date', { ascending: false })

                if (!error && data) {
                    const mapped: AttendanceRecord[] = (data as any[]).map(r => ({
                        id: r.id,
                        date: r.date,
                        status: r.status,
                        justified: r.justified,
                        justification_note: r.justification_note,
                        subjectName: r.subjects?.name || null,
                        subjectIcon: r.subjects?.icon || null,
                        startTime: r.schedule?.start_time?.slice(0, 5) || null,
                        endTime: r.schedule?.end_time?.slice(0, 5) || null,
                    }))
                    setAbsences(mapped)

                    const justified = data.filter(a => a.justified).length
                    setStats({
                        total: data.length,
                        justified,
                        unjustified: data.length - justified
                    })
                }
            } catch (err) {
                console.error('Error fetching attendance:', err)
            }

            setLoadingData(false)
        }

        fetchAttendance()
    }, [effectiveStudentId])

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        })
    }

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            'absent': 'Absent',
            'late': 'Retard',
            'excused': 'Excusé'
        }
        return labels[status] || status
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!effectiveStudentId) {
        return (
            <div className="max-w-md mx-auto lg:max-w-3xl lg:ms-12 lg:me-auto p-4">
                <div className="bg-card border border-border rounded-3xl p-6 text-center">
                    <p className="text-muted-foreground">Aucun enfant sélectionné.</p>
                </div>
            </div>
        )
    }

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
                            <span className="font-bold text-lg">Historique & Présence</span>
                            <span className="text-xs text-muted-foreground">{selectedChild.name} - {selectedChild.class}</span>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" className="rounded-full">
                        <Bell className="w-5 h-5" />
                    </Button>
                </div>
            )}

            {/* Tabs */}
            <Tabs defaultValue="absences" className="w-full">
                <TabsList className="bg-card border border-border/50 p-1 rounded-2xl w-full grid grid-cols-2 mb-6">
                    <TabsTrigger value="absences" className="rounded-xl data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-500">Absences</TabsTrigger>
                    <TabsTrigger value="comportement" className="rounded-xl data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-500">Comportement</TabsTrigger>
                </TabsList>

                <TabsContent value="absences" className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-card border border-border/50 p-3 rounded-2xl flex flex-col items-center">
                            <span className="text-[10px] text-muted-foreground uppercase">Total</span>
                            {loadingData ? (
                                <Loader2 className="h-6 w-6 animate-spin text-primary mt-1" />
                            ) : (
                                <span className="text-2xl font-bold">{stats.total}</span>
                            )}
                        </div>
                        <div className="bg-card border border-border/50 p-3 rounded-2xl flex flex-col items-center">
                            <span className="text-[10px] text-muted-foreground uppercase">Justifiées</span>
                            {loadingData ? (
                                <Loader2 className="h-6 w-6 animate-spin text-primary mt-1" />
                            ) : (
                                <span className="text-2xl font-bold text-emerald-500">{stats.justified}</span>
                            )}
                        </div>
                        <div className="bg-card border border-border/50 p-3 rounded-2xl flex flex-col items-center">
                            <span className="text-[10px] text-muted-foreground uppercase">Non Just.</span>
                            {loadingData ? (
                                <Loader2 className="h-6 w-6 animate-spin text-primary mt-1" />
                            ) : (
                                <span className="text-2xl font-bold text-red-500">{stats.unjustified}</span>
                            )}
                        </div>
                    </div>

                    {/* List */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center px-1">
                            <h3 className="font-bold text-sm">Détails des absences</h3>
                            <Button variant="ghost" size="sm" className="h-6 text-xs text-cyan-500 hover:text-cyan-400">Filtrer</Button>
                        </div>

                        {loadingData && (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            </div>
                        )}

                        {!loadingData && absences.length === 0 && (
                            <div className="bg-card border border-border/50 rounded-2xl p-6 text-center">
                                <p className="text-muted-foreground">Aucune absence enregistrée. 🎉</p>
                            </div>
                        )}

                        {absences.map((item) => {
                            const isJustified = item.justified
                            const color = isJustified ? 'text-emerald-500' : 'text-red-500'
                            const bg = isJustified ? 'bg-emerald-500/10' : 'bg-red-500/10'
                            const border = isJustified ? 'border-emerald-500/20' : 'border-red-500/20'

                            return (
                                <div key={item.id} className="bg-card p-4 rounded-2xl flex items-center justify-between border border-border/50">
                                    <div>
                                        <h4 className="font-bold text-sm text-gray-200">{formatDate(item.date)}</h4>
                                        <p className="text-xs text-muted-foreground">
                                            {getStatusLabel(item.status)}
                                            {item.subjectName && (
                                                <> — {item.subjectIcon ? `${item.subjectIcon} ` : ''}{item.subjectName}</>
                                            )}
                                            {item.startTime && item.endTime && (
                                                <>, {item.startTime}–{item.endTime}</>
                                            )}
                                            {item.justification_note ? ` · ${item.justification_note}` : ''}
                                        </p>
                                    </div>
                                    <span className={cn("px-2 py-1 rounded-lg text-[10px] font-bold border", bg, color, border)}>
                                        {isJustified ? 'JUSTIFIÉE' : 'INJUSTIFIÉE'}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </TabsContent>

                <TabsContent value="comportement" className="text-center py-10 text-muted-foreground space-y-4">
                    <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground/50" />
                    <p>Aucun incident de comportement signalé.</p>
                </TabsContent>
            </Tabs>
        </div>
    )
}
