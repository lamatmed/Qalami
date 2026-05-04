'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface ViewingSchool {
    id: string
    name: string
}

interface SuperAdminContextType {
    viewingSchool: ViewingSchool | null
    setViewingSchool: (school: ViewingSchool | null) => void
    isViewingSchool: boolean
}

const SuperAdminContext = createContext<SuperAdminContextType | undefined>(undefined)

export function SuperAdminProvider({ children }: { children: ReactNode }) {
    const [viewingSchool, setViewingSchool] = useState<ViewingSchool | null>(null)

    return (
        <SuperAdminContext.Provider value={{
            viewingSchool,
            setViewingSchool,
            isViewingSchool: viewingSchool !== null
        }}>
            {children}
        </SuperAdminContext.Provider>
    )
}

export function useSuperAdmin() {
    const context = useContext(SuperAdminContext)
    if (context === undefined) {
        throw new Error('useSuperAdmin must be used within a SuperAdminProvider')
    }
    return context
}
