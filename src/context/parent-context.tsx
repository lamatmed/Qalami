'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/utils/supabase/client'

interface Child {
    id: string
    name: string
    class: string
    avatar?: string
    schoolId?: string
}

interface ParentContextType {
    selectedChild: Child | null
    setSelectedChild: (child: Child) => void
    childrenList: Child[]
    loading: boolean
    parentName: string
}

const ParentContext = createContext<ParentContextType | undefined>(undefined)

export function ParentProvider({ children }: { children: ReactNode }) {
    const [childrenList, setChildrenList] = useState<Child[]>([])
    const [selectedChild, setSelectedChild] = useState<Child | null>(null)
    const [loading, setLoading] = useState(true)
    const [parentName, setParentName] = useState('Parent')

    useEffect(() => {
        async function loadParentData() {
            const supabase = createClient()

            // Check if we're in impersonation mode
            const stored = sessionStorage.getItem('superAdminViewingAs')
            let parentId: string | null = null

            if (stored) {
                try {
                    const userData = JSON.parse(stored)
                    const firstName = userData.userName?.split(' ')[0] || 'Parent'
                    setParentName(firstName)
                    parentId = userData.userId
                } catch {
                    // Ignore parsing errors
                }
            } else {
                // Get current logged-in user
                const { data: { user } } = await supabase.auth.getUser()
                if (user) {
                    parentId = user.id
                    // Get parent's name from profile
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('full_name')
                        .eq('id', user.id)
                        .single()
                    if (profile?.full_name) {
                        setParentName(profile.full_name.split(' ')[0])
                    }
                }
            }

            if (parentId) {
                // Fetch real children from parent_student_links table
                const { data: links, error } = await supabase
                    .from('parent_student_links')
                    .select('student_id')
                    .eq('parent_id', parentId)

                if (!error && links && links.length > 0) {
                    const studentIds = links.map(l => l.student_id)

                    // Fetch student profiles and their enrollments
                    const { data: students } = await supabase
                        .from('profiles')
                        .select(`
                            id,
                            full_name,
                            avatar_url,
                            school_id,
                            enrollments (
                                classes (
                                    name
                                )
                            )
                        `)
                        .in('id', studentIds)

                    if (students && students.length > 0) {
                        const fetchedChildren: Child[] = students.map((student) => ({
                            id: student.id,
                            name: student.full_name || 'Enfant',
                            class: student.enrollments?.[0]?.classes?.name || 'Non assigné',
                            avatar: student.avatar_url,
                            schoolId: student.school_id
                        }))

                        setChildrenList(fetchedChildren)
                        setSelectedChild(fetchedChildren[0] || null)
                    } else {
                        setChildrenList([])
                        setSelectedChild(null)
                    }
                } else {
                    // No children linked, show empty state
                    setChildrenList([])
                    setSelectedChild(null)
                }
            }

            setLoading(false)
        }

        loadParentData()
    }, [])

    return (
        <ParentContext.Provider value={{
            selectedChild,
            setSelectedChild,
            childrenList,
            loading,
            parentName
        }}>
            {children}
        </ParentContext.Provider>
    )
}

export function useParent() {
    const context = useContext(ParentContext)
    // Return default values if context is not available (during SSR/static build)
    if (context === undefined) {
        return {
            selectedChild: null,
            setSelectedChild: () => { },
            childrenList: [],
            loading: true,
            parentName: 'Parent'
        }
    }
    return context
}
