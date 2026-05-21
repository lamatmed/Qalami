/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { MobileNav } from '@/components/layout/mobile-nav'
import { sidebarItems } from '@/components/admin/sidebar'

interface AcademicContext {
    year: string | null
    term: string | null
    schoolName: string | null
    schoolLogo: string | null
    permissions: string[] | null
    unassignedStudents: number
}

export function AdminMobileNav({ user, academicContext }: { user: any; academicContext: AcademicContext }) {
    const isStaff = user?.role === 'school_staff'
    const permissions = academicContext?.permissions

    // Permission → hrefs mapping for school_staff filtering
    const PERM_HREFS: Record<string, string[]> = {
        students:      ['/admin/students'],
        parents:       ['/admin/parents'],
        teachers:      ['/admin/teachers'],
        classes:       ['/admin/classes', '/admin/subjects', '/admin/assignments'],
        schedule:      ['/admin/schedule', '/admin/terms'],
        attendance:    ['/admin/attendance'],
        reports:       ['/admin/reports'],
        finance:       ['/admin/finance', '/admin/finance/tuition', '/admin/finance/payroll'],
        settings:      ['/admin/settings', '/admin/documents'],
        users:         ['/admin/users'],
        announcements: ['/admin/announcements', '/admin/events'],
    }

    const canSeeHref = (href: string) => {
        if (!isStaff || permissions === null) return true
        if (href === '/admin') return true // dashboard always visible
        return Object.entries(PERM_HREFS).some(
            ([perm, hrefs]) => permissions.includes(perm) && hrefs.includes(href)
        )
    }

    // Filter items based on permissions
    const filteredItems = sidebarItems
        .filter(item => canSeeHref(item.href))
        .map(item => {
            if (item.href === '/admin/students') {
                return { ...item, badge: academicContext?.unassignedStudents }
            }
            return item
        })

    return (
        <MobileNav 
            items={filteredItems} 
            user={user} 
            academicContext={academicContext} 
        />
    )
}
