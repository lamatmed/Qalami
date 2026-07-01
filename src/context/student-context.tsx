'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/utils/supabase/client'

async function getSessionUserId(): Promise<string | null> {
    try {
        const res = await fetch('/api/admin/context')
        if (!res.ok) return null
        const data = await res.json()
        return data.user_id ?? null
    } catch {
        return null
    }
}

interface StudentData {
    id: string
    name: string
    fullName: string
    class: string
    className: string
    school: string
    avatar?: string
    level: number
    xp: number
    streak: number
    rank: number
    nextLevelXp: number
}

interface StudentContextType {
    student: StudentData | null
    loading: boolean
    refreshStudent: () => Promise<void>
}

const defaultStudent: StudentData = {
    id: '',
    name: 'Élève',
    fullName: 'Élève',
    class: '',
    className: '',
    school: '',
    level: 1,
    xp: 0,
    streak: 0,
    rank: 0,
    nextLevelXp: 100
}

const StudentContext = createContext<StudentContextType | undefined>(undefined)

export function StudentProvider({ children }: { children: ReactNode }) {
    const [student, setStudent] = useState<StudentData | null>(null)
    const [loading, setLoading] = useState(true)

    const loadStudentData = async () => {
        const supabase = createClient()

        // Check if we're in impersonation mode
        const stored = sessionStorage.getItem('superAdminViewingAs')
        let studentId: string | null = null

        if (stored) {
            try {
                const userData = JSON.parse(stored)
                studentId = userData.userId
            } catch {
                // Ignore parsing errors
            }
        } else {
            studentId = await getSessionUserId()
        }

        if (studentId) {
            // Fetch student profile
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, school_id')
                .eq('id', studentId)
                .single()

            if (profileError) {
                console.error('[StudentContext] Profile fetch error:', profileError)
                setLoading(false)
                return
            }

            if (profile) {
                // Get enrollment with class name
                const { data: enrollment } = await supabase
                    .from('enrollments')
                    .select(`
                        class_id,
                        classes (name)
                    `)
                    .eq('student_id', studentId)
                    .single()

                // Get school name if we have school_id
                let schoolName = 'École'
                if (profile.school_id) {
                    const { data: school } = await supabase
                        .from('schools')
                        .select('name')
                        .eq('id', profile.school_id)
                        .single()
                    if (school) {
                        schoolName = school.name
                    }
                }

                // Get student gamification stats
                const { data: gamification } = await supabase
                    .from('student_gamification')
                    .select('xp, level, streak')
                    .eq('student_id', studentId)
                    .single()

                // Calculate XP from gamification or fallback to grades
                let totalXp = 0
                let level = 1
                let streak = 0

                if (gamification) {
                    totalXp = gamification.xp || 0
                    level = gamification.level || 1
                    streak = gamification.streak || 0
                } else {
                    // Fallback: calculate from grades
                    const { data: grades } = await supabase
                        .from('grades')
                        .select('score, max_score')
                        .eq('student_id', studentId)

                    totalXp = grades?.length ? grades.length * 50 : 0
                    level = Math.floor(totalXp / 100) + 1
                }

                // Calculate rank (how many students in same school have higher XP)
                let rank = 1
                if (profile.school_id) {
                    // Get all student IDs in the same school
                    const { data: schoolProfiles } = await supabase
                        .from('profiles')
                        .select('id')
                        .eq('school_id', profile.school_id)
                        .eq('role', 'student')

                    if (schoolProfiles && schoolProfiles.length > 0) {
                        const schoolStudentIds = schoolProfiles.map(p => p.id)
                        const { count } = await supabase
                            .from('student_gamification')
                            .select('*', { count: 'exact', head: true })
                            .in('student_id', schoolStudentIds)
                            .gt('xp', totalXp)

                        rank = (count ?? 0) + 1
                    }
                }

                const firstName = profile.full_name?.split(' ')[0] || 'Élève'

                setStudent({
                    id: profile.id,
                    name: firstName,
                    fullName: profile.full_name || 'Élève',
                    class: enrollment?.class_id || '',
                    className: (Array.isArray(enrollment?.classes) ? enrollment?.classes[0]?.name : (enrollment?.classes as any)?.name) || 'Non assigné',
                    school: schoolName,
                    avatar: profile.avatar_url,
                    level: level,
                    xp: totalXp,
                    streak: streak,
                    rank: rank,
                    nextLevelXp: (level * 100) - totalXp
                })
            }
        }

        setLoading(false)
    }

    useEffect(() => {
        loadStudentData()
    }, [])

    return (
        <StudentContext.Provider value={{
            student,
            loading,
            refreshStudent: loadStudentData
        }}>
            {children}
        </StudentContext.Provider>
    )
}

export function useStudent() {
    const context = useContext(StudentContext)
    if (context === undefined) {
        throw new Error('useStudent must be used within a StudentProvider')
    }
    return context
}
