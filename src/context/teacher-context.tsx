'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/utils/supabase/client'

export interface ClassInfo {
    id: string
    name: string
    studentCount: number
}

export interface SchoolInfo {
    id: string
    name: string
}

interface TeacherContextType {
    teacherId: string | null
    teacherName: string
    loading: boolean
    classes: ClassInfo[]
    schoolId: string | null      // Active school ID
    schools: SchoolInfo[]        // All linked schools
    setActiveSchool: (id: string) => void
}

const TeacherContext = createContext<TeacherContextType>({
    teacherId: null,
    teacherName: 'Enseignant',
    loading: true,
    classes: [],
    schoolId: null,
    schools: [],
    setActiveSchool: () => {}
})

export function TeacherProvider({ children }: { children: ReactNode }) {
    const [teacherId, setTeacherId] = useState<string | null>(null)
    const [teacherName, setTeacherName] = useState('Enseignant')
    const [loading, setLoading] = useState(true)
    const [classes, setClasses] = useState<ClassInfo[]>([])
    const [schoolId, setSchoolId] = useState<string | null>(null) // Current active school ID
    const [schools, setSchools] = useState<SchoolInfo[]>([]) // Available schools

    // Initialize user and loaded schools list
    useEffect(() => {
        async function initializeTeacher() {
            try {
                const supabase = createClient()

                // Impersonation or standard user
                let userId: string | null = null
                const stored = sessionStorage.getItem('superAdminViewingAs')
                if (stored) {
                    try {
                        const parsed = JSON.parse(stored)
                        userId = parsed.userId
                    } catch { }
                }
                if (!userId) {
                    const { data: { user } } = await supabase.auth.getUser()
                    userId = user?.id || null
                }

                if (!userId) {
                    setLoading(false)
                    return
                }

            // Load profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('id, full_name, role, school_id')
                .eq('id', userId)
                .single()

            if (!profile) {
                setLoading(false)
                return
            }

            // Confirm teacher-level access
            if (profile.role !== 'teacher' && profile.role !== 'super_admin' && profile.role !== 'admin') {
                setLoading(false)
                return
            }

            setTeacherId(profile.id)
            setTeacherName(profile.full_name || 'Enseignant')

            // DISCOVER SCHOOLS: profile_schools table + user's primary profiles.school_id
            const { data: secondaryLinks } = await supabase
                .from('profile_schools')
                .select('school_id')
                .eq('profile_id', profile.id)

            const discoveredIds = new Set<string>()
            if (profile.school_id) discoveredIds.add(profile.school_id)
            if (secondaryLinks) {
                secondaryLinks.forEach(lnk => { if (lnk.school_id) discoveredIds.add(lnk.school_id) })
            }

            if (discoveredIds.size === 0) {
                // No schools found
                setLoading(false)
                return
            }

            // Fetch all school details (names)
            const { data: schData } = await supabase
                .from('schools')
                .select('id, name')
                .in('id', Array.from(discoveredIds))

            const resolvedSchools: SchoolInfo[] = schData || []
            setSchools(resolvedSchools)

            // Determine active school: try cookie, try local storage, else fallback to profile primary school, else first school found
            let currentActiveId: string | null = null
            
            const getCookieValue = (name: string) => {
                const val = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)')
                return val ? val.pop() : null
            }
            const cookieVal = getCookieValue('qalami_active_school_teacher')
            const savedActiveId = localStorage.getItem(`qalami_active_school_${profile.id}`)
            
            if (cookieVal && resolvedSchools.some(s => s.id === cookieVal)) {
                currentActiveId = cookieVal
            } else if (savedActiveId && resolvedSchools.some(s => s.id === savedActiveId)) {
                currentActiveId = savedActiveId
                document.cookie = `qalami_active_school_teacher=${savedActiveId}; path=/; max-age=31536000`
            } else if (profile.school_id && resolvedSchools.some(s => s.id === profile.school_id)) {
                currentActiveId = profile.school_id
                document.cookie = `qalami_active_school_teacher=${profile.school_id}; path=/; max-age=31536000`
            } else if (resolvedSchools.length > 0) {
                currentActiveId = resolvedSchools[0].id
                document.cookie = `qalami_active_school_teacher=${resolvedSchools[0].id}; path=/; max-age=31536000`
            }

            setSchoolId(currentActiveId)
            // Note: loading remains true until classes finish loading if school is found.
            // If no school was found, we set loading to false here.
            if (!currentActiveId) {
                setLoading(false)
            }
            } catch (error: any) {
                if (error?.name === 'AbortError') {
                    console.log('TeacherContext initialization aborted')
                } else {
                    console.error('Error initializing teacher:', error)
                }
                setLoading(false)
            }
        }

        initializeTeacher()
    }, [])

    // Reactively load Classes when teacherId OR schoolId changes!
    useEffect(() => {
        async function loadSchoolClasses() {
            if (!teacherId || !schoolId) {
                setClasses([])
                return
            }

            const supabase = createClient()

            try {
                // Load assignments STRICTLY FILTERED to classes in the active school!
                const { data: assignments } = await supabase
                    .from('teacher_assignments')
                    .select(`
                        class_id,
                        classes!inner (
                            id,
                            name,
                            school_id
                        )
                    `)
                    .eq('teacher_id', teacherId)
                    .eq('classes.school_id', schoolId)

                if (!assignments || assignments.length === 0) {
                    setClasses([])
                    setLoading(false)
                    return
                }

                // Deduplicate classes
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
                    // Fetch student enrollments
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
                        for (const cId of classIds) {
                            const cls = classMap.get(cId)
                            if (cls) {
                                cls.studentCount = counts[cId] || 0
                            }
                        }
                    }
                }

                setClasses(Array.from(classMap.values()))
            } catch (error: any) {
                if (error?.name === 'AbortError') {
                    console.log('Teacher loadSchoolClasses aborted')
                } else {
                    console.error('Error loading school classes:', error)
                }
            } finally {
                setLoading(false)
            }
        }

        loadSchoolClasses()
    }, [teacherId, schoolId])

    const setActiveSchool = (id: string) => {
        if (schools.some(s => s.id === id)) {
            setSchoolId(id)
            document.cookie = `qalami_active_school_teacher=${id}; path=/; max-age=31536000`
            if (teacherId) {
                localStorage.setItem(`qalami_active_school_${teacherId}`, id)
            }
            // Trigger a router refresh so any Server Components reading the cookie reload instantly!
            window.location.reload()
        }
    }

    return (
        <TeacherContext.Provider value={{ teacherId, teacherName, loading, classes, schoolId, schools, setActiveSchool }}>
            {children}
        </TeacherContext.Provider>
    )
}

export function useTeacher() {
    return useContext(TeacherContext)
}
