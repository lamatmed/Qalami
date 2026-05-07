'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/utils/supabase/client'

interface ClassInfo {
    id: string
    name: string
    studentCount: number
}

interface TeacherContextType {
    teacherId: string | null
    teacherName: string
    loading: boolean
    classes: ClassInfo[]
    schoolId: string | null
}

const TeacherContext = createContext<TeacherContextType>({
    teacherId: null,
    teacherName: 'Enseignant',
    loading: true,
    classes: [],
    schoolId: null
})

export function TeacherProvider({ children }: { children: ReactNode }) {
    const [teacherId, setTeacherId] = useState<string | null>(null)
    const [teacherName, setTeacherName] = useState('Enseignant')
    const [loading, setLoading] = useState(true)
    const [classes, setClasses] = useState<ClassInfo[]>([])
    const [schoolId, setSchoolId] = useState<string | null>(null)

    useEffect(() => {
        async function loadTeacherData() {
            const supabase = createClient()

            // Check for super admin impersonation first
            let userId: string | null = null
            const stored = sessionStorage.getItem('superAdminViewingAs')
            if (stored) {
                try {
                    const parsed = JSON.parse(stored)
                    userId = parsed.userId
                } catch { }
            }

            // If not impersonating, get actual logged-in user
            if (!userId) {
                const { data: { user } } = await supabase.auth.getUser()
                userId = user?.id || null
            }

            if (!userId) {
                setLoading(false)
                return
            }

            // Fetch teacher profile
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('id, full_name, role, school_id')
                .eq('id', userId)
                .single()

            if (profileError || !profile) {
                setLoading(false)
                return
            }

            // Skip if not a teacher (unless they're admin/super_admin viewing)
            if (profile.role !== 'teacher' && profile.role !== 'super_admin' && profile.role !== 'admin') {
                setLoading(false)
                return
            }

            setTeacherId(profile.id)
            setTeacherName(profile.full_name || 'Enseignant')
            setSchoolId(profile.school_id)

            // Fetch classes this teacher teaches
            const { data: assignments } = await supabase
                .from('teacher_assignments')
                .select(`
                    class_id,
                    classes (
                        id,
                        name
                    )
                `)
                .eq('teacher_id', profile.id)

            if (assignments) {
                // Get unique classes and student counts
                const classMap = new Map<string, ClassInfo>()
                const classIds: string[] = []
                
                for (const a of assignments) {
                    const cls = a.classes as { id?: string, name?: string }
                    if (cls?.id && !classMap.has(cls.id)) {
                        classIds.push(cls.id)
                        classMap.set(cls.id, {
                            id: cls.id,
                            name: cls.name || 'Classe',
                            studentCount: 0
                        })
                    }
                }

                if (classIds.length > 0) {
                    // Batch fetch student enrollments for these classes
                    const { data: enrollments } = await supabase
                        .from('enrollments')
                        .select('class_id')
                        .in('class_id', classIds)
                        .eq('status', 'active')

                    if (enrollments) {
                        const counts: Record<string, number> = {}
                        for (const e of enrollments) {
                            if (e.class_id) {
                                counts[e.class_id] = (counts[e.class_id] || 0) + 1
                            }
                        }
                        for (const classId of classIds) {
                            const cls = classMap.get(classId)
                            if (cls) {
                                cls.studentCount = counts[classId] || 0
                            }
                        }
                    }
                }
                setClasses(Array.from(classMap.values()))
            }

            setLoading(false)
        }

        loadTeacherData()
    }, [])

    return (
        <TeacherContext.Provider value={{ teacherId, teacherName, loading, classes, schoolId }}>
            {children}
        </TeacherContext.Provider>
    )
}

export function useTeacher() {
    return useContext(TeacherContext)
}
