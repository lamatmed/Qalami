'use client'

import { useState, useEffect } from 'react'
import { TeacherSidebar, sidebarItems } from '@/components/teacher/sidebar'
import { MobileNav } from '@/components/layout/mobile-nav'
import { cn } from '@/lib/utils'
import { SuperAdminViewingBanner } from '@/components/shared/super-admin-viewing-banner'
import { useLanguage } from '@/i18n'

interface TeacherLayoutFrameProps {
    children: React.ReactNode
    header: React.ReactNode
}

export function TeacherLayoutFrame({ children, header }: TeacherLayoutFrameProps) {
    const [isCollapsed, setIsCollapsed] = useState(false)
    const [mounted, setMounted] = useState(false)
    const { direction } = useLanguage()

    // Hydrate state from localStorage once client-side mounted to prevent SSR mismatches
    useEffect(() => {
        const saved = localStorage.getItem('qalami_teacher_sidebar_collapsed')
        if (saved === 'true') {
            setIsCollapsed(true)
        }
        setMounted(true)
    }, [])

    const handleToggle = () => {
        const nextState = !isCollapsed
        setIsCollapsed(nextState)
        localStorage.setItem('qalami_teacher_sidebar_collapsed', String(nextState))
    }

    return (
        <div className={cn(
            "flex h-screen bg-slate-50/50 dark:bg-muted/20 theme-teacher overflow-hidden transition-colors duration-300",
            direction === 'rtl' ? "flex-row-reverse" : "flex-row"
        )}>
            {/* Sidebar container with smooth dynamic width */}
            <div className={cn(
                "hidden lg:block h-full transition-all duration-300 ease-in-out shrink-0 border-slate-100 dark:border-white/5",
                direction === 'rtl' ? "border-l" : "border-r",
                isCollapsed ? "w-20" : "w-64"
            )}>
                <TeacherSidebar isCollapsed={isCollapsed} onToggle={handleToggle} />
            </div>

            {/* Content Frame */}
            <div className="flex-1 flex flex-col min-w-0 h-full bg-transparent overflow-hidden">
                <SuperAdminViewingBanner />
                {header}
                <main className="flex-1 overflow-y-auto pb-24 lg:pb-0">
                    {children}
                </main>
            </div>

            {/* Navigation for mobile clients */}
            <MobileNav items={sidebarItems} />
        </div>
    )
}
