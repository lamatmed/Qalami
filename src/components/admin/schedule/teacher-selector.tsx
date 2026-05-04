'use client'

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { GraduationCap, Loader2 } from "lucide-react"
import { createClient } from '@/utils/supabase/client'
import { useState, useEffect } from 'react'
import { getMySchoolContext } from '@/app/admin/actions'

interface TeacherOption {
    id: string
    full_name: string
    subjects: string[]
}

export function TeacherSelector({
    selectedTeacher,
    onTeacherChange,
}: {
    selectedTeacher: string
    onTeacherChange: (value: string) => void
}) {
    const [teachers, setTeachers] = useState<TeacherOption[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchTeachers() {
            const supabase = createClient()
            const ctx = await getMySchoolContext()
            if (!ctx) { setLoading(false); return }
            const profile = { school_id: ctx.school_id }

            const [{ data: teacherData }, { data: assignData }] = await Promise.all([
                supabase.from('profiles')
                    .select('id, full_name')
                    .eq('school_id', profile.school_id)
                    .eq('role', 'teacher')
                    .order('full_name'),
                supabase.from('teacher_assignments')
                    .select('teacher_id, subjects(name)'),
            ])

            // Build subject list per teacher
            const subjectsByTeacher = new Map<string, string[]>()
            ;(assignData || []).forEach((a: { teacher_id: string; subjects?: { name?: string } | null }) => {
                const name = a.subjects?.name
                if (!name) return
                const list = subjectsByTeacher.get(a.teacher_id) || []
                if (!list.includes(name)) list.push(name)
                subjectsByTeacher.set(a.teacher_id, list)
            })

            const result: TeacherOption[] = (teacherData || []).map(t => ({
                id: t.id,
                full_name: t.full_name || 'Enseignant',
                subjects: subjectsByTeacher.get(t.id) || [],
            }))

            setTeachers(result)
            if (result.length > 0 && !selectedTeacher) {
                onTeacherChange(result[0].id)
            }
            setLoading(false)
        }
        fetchTeachers()
    }, [])

    const selected = teachers.find(t => t.id === selectedTeacher)

    return (
        <div className="flex flex-col sm:flex-row gap-4 items-center bg-card p-4 rounded-2xl border border-border">
            <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-lg">
                    <GraduationCap className="w-5 h-5 text-primary" />
                </div>
                <div>
                    <h3 className="text-foreground font-bold text-sm">Vue par enseignant</h3>
                    <p className="text-muted-foreground text-xs">Sélectionnez un enseignant</p>
                </div>
            </div>

            <div className="flex-1 w-full sm:w-auto sm:ms-auto flex items-center gap-3">
                {loading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                ) : (
                    <Select value={selectedTeacher} onValueChange={onTeacherChange}>
                        <SelectTrigger className="w-full sm:w-[280px] bg-muted border-border text-foreground">
                            <SelectValue placeholder="Choisir un enseignant..." />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground">
                            {teachers.map(t => (
                                <SelectItem key={t.id} value={t.id}>
                                    <div className="flex flex-col">
                                        <span>{t.full_name}</span>
                                        {t.subjects.length > 0 && (
                                            <span className="text-xs text-muted-foreground">
                                                {t.subjects.slice(0, 2).join(', ')}{t.subjects.length > 2 ? '…' : ''}
                                            </span>
                                        )}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                {selected && (
                    <div className="hidden sm:flex flex-col">
                        <span className="text-xs font-bold text-foreground">{selected.full_name}</span>
                        {selected.subjects.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                                {selected.subjects.slice(0, 3).join(' · ')}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
