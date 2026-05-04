'use client'

import { StudentMobileNav } from '@/components/student/student-mobile-nav'
import { StudentSidebar } from '@/components/student/sidebar'
import { SuperAdminViewingBanner } from '@/components/shared/super-admin-viewing-banner'
import { StudentProvider } from '@/context/student-context'

export default function StudentLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <StudentProvider>
            <SuperAdminViewingBanner />
            <div className="min-h-screen bg-background pb-20 lg:pb-0 theme-student flex">
                {/* Desktop Sidebar */}
                <div className="hidden lg:block w-64 flex-shrink-0">
                    <StudentSidebar />
                </div>

                <main className="flex-1 min-h-screen lg:ml-64 w-full">
                    {children}
                </main>

                <StudentMobileNav />
            </div>
        </StudentProvider>
    )
}
