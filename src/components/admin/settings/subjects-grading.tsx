'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Calculator, BookOpen, MoreVertical, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import { getMySchoolContext } from '@/app/admin/actions'

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
    const [subjects, setSubjects] = useState<SubjectRow[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            const ctx = await getMySchoolContext()
            if (!ctx) return
            const profile = { school_id: ctx.school_id }
            const supabase = createClient()

            const { data } = await supabase
                .from('subjects')
                .select('id, name')
                .eq('school_id', profile.school_id)
                .order('name')

            // Get teacher assignments for each subject
            const subjectIds = (data || []).map((s: any) => s.id)
            const { data: assignments } = await supabase
                .from('teacher_assignments')
                .select('subject_id, profiles!teacher_assignments_teacher_id_fkey(full_name)')
                .in('subject_id', subjectIds)

            const teacherMap: Record<string, string[]> = {}
                ; (assignments || []).forEach((a: any) => {
                    if (!teacherMap[a.subject_id]) teacherMap[a.subject_id] = []
                    if (a.profiles?.full_name) teacherMap[a.subject_id].push(a.profiles.full_name)
                })

            const rows = (data || []).map((s: any, i: number) => ({
                id: s.id,
                name: s.name,
                coef: 1,
                teachers: (teacherMap[s.id] || []).join(', ') || 'Non assign\u00e9',
                color: SUBJECT_COLORS[i % SUBJECT_COLORS.length]
            }))
            setSubjects(rows)
            setLoading(false)
        }
        load()
    }, [])

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-xl font-bold text-white">Mati&egrave;res &amp; Notation</h3>
                    <p className="text-gray-400 text-sm">G&eacute;rez le programme et les bar&egrave;mes.</p>
                </div>
                <Button size="icon" className="bg-emerald-500 hover:bg-emerald-600 rounded-full h-10 w-10 shadow-lg shadow-emerald-500/20">
                    <Plus className="w-5 h-5 text-black" />
                </Button>
            </div>

            {/* Grading Scale */}
            <div className="bg-[#1A2530] p-5 rounded-2xl border border-white/5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                        <Calculator className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="font-bold text-white">Bar&egrave;me par d&eacute;faut</h4>
                        <p className="text-xs text-gray-500">S&apos;applique &agrave; toutes les &eacute;valuations.</p>
                    </div>
                </div>

                <div className="flex bg-[#0F1720] p-1 rounded-xl w-full max-w-md">
                    <button className="flex-1 py-1.5 text-xs font-bold text-gray-400 hover:text-white transition-colors">/10</button>
                    <button className="flex-1 py-1.5 text-xs font-bold bg-[#1A2530] text-emerald-500 shadow-sm rounded-lg border border-white/5">/20</button>
                    <button className="flex-1 py-1.5 text-xs font-bold text-gray-400 hover:text-white transition-colors">/100</button>
                </div>
            </div>

            {/* Subjects List */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-white text-sm uppercase tracking-wider">
                        {loading ? 'Chargement...' : `Liste des mati\u00e8res (${subjects.length})`}
                    </h4>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center p-8">
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                    </div>
                ) : subjects.length === 0 ? (
                    <div className="text-center p-8 text-gray-500 text-sm">
                        Aucune mati&egrave;re configur&eacute;e
                    </div>
                ) : (
                    <div className="space-y-3">
                        {subjects.map((subject) => (
                            <div key={subject.id} className="group bg-[#1A2530] p-4 rounded-xl border border-white/5 hover:border-emerald-500/30 transition-all flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center text-white shadow-lg", subject.color)}>
                                        <BookOpen className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h5 className="font-bold text-white">{subject.name}</h5>
                                        <p className="text-xs text-gray-500">{subject.teachers}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="px-3 py-1 bg-[#0F1720] rounded-lg border border-white/5">
                                        <span className="text-xs font-bold text-gray-400 uppercase mr-2">Coef:</span>
                                        <span className="text-sm font-bold text-emerald-500">{subject.coef}</span>
                                    </div>
                                    <Button variant="ghost" size="icon" className="text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                        <MoreVertical className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
