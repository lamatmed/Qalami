'use client'

import { useState, useEffect } from 'react'
import { Shield, X, User } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ViewingSchool {
    id: string
    name: string
    role: string
}

interface ViewingUser {
    userId: string
    userName: string
    userEmail: string
    role: string
    schoolId: string
    schoolName: string
}

export function SuperAdminViewingBanner() {
    const [viewingSchool, setViewingSchool] = useState<ViewingSchool | null>(null)
    const [viewingUser, setViewingUser] = useState<ViewingUser | null>(null)

    useEffect(() => {
        // Check sessionStorage for super admin viewing context
        const storedSchool = sessionStorage.getItem('superAdminViewingSchool')
        if (storedSchool) {
            try {
                setViewingSchool(JSON.parse(storedSchool))
            } catch {
                // ignore
            }
        }

        const storedUser = sessionStorage.getItem('superAdminViewingAs')
        if (storedUser) {
            try {
                setViewingUser(JSON.parse(storedUser))
            } catch {
                // ignore
            }
        }
    }, [])

    const handleExit = () => {
        sessionStorage.removeItem('superAdminViewingSchool')
        sessionStorage.removeItem('superAdminViewingAs')
        window.close()
    }

    // User-level impersonation takes priority
    if (viewingUser) {
        const roleLabels: Record<string, string> = {
            admin: 'Administrateur',
            teacher: 'Enseignant',
            student: 'Élève',
            parent: 'Parent'
        }
        return (
            <div className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 flex items-center justify-center gap-3 text-sm">
                <User className="w-4 h-4" />
                <span>
                    <strong>Super Admin</strong> visualise en tant que{' '}
                    <strong>{viewingUser.userName || viewingUser.userEmail}</strong>{' '}
                    ({roleLabels[viewingUser.role] || viewingUser.role})
                    {viewingUser.schoolName && (
                        <span className="opacity-75"> • {viewingUser.schoolName}</span>
                    )}
                </span>
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleExit}
                    className="h-6 px-2 text-white hover:bg-white/20"
                >
                    <X className="w-3 h-3 mr-1" /> Fermer
                </Button>
            </div>
        )
    }

    if (!viewingSchool) return null

    return (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 flex items-center justify-center gap-3 text-sm">
            <Shield className="w-4 h-4" />
            <span>
                <strong>Super Admin</strong> visualise <strong>{viewingSchool.name}</strong> en tant que <strong>{viewingSchool.role}</strong>
            </span>
            <Button
                size="sm"
                variant="ghost"
                onClick={handleExit}
                className="h-6 px-2 text-white hover:bg-white/20"
            >
                <X className="w-3 h-3 mr-1" /> Fermer
            </Button>
        </div>
    )
}

// Export helper to get impersonated user for other components
export function getImpersonatedUser(): ViewingUser | null {
    if (typeof window === 'undefined') return null
    const stored = sessionStorage.getItem('superAdminViewingAs')
    if (!stored) return null
    try {
        return JSON.parse(stored)
    } catch {
        return null
    }
}

