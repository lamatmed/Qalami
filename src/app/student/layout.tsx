'use client'

import { StudentMobileNav } from '@/components/student/student-mobile-nav'
import { StudentSidebar } from '@/components/student/sidebar'
import { SuperAdminViewingBanner } from '@/components/shared/super-admin-viewing-banner'
import { StudentProvider } from '@/context/student-context'
import { useLanguage } from '@/i18n'

export default function StudentLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { direction, mounted } = useLanguage()
    const activeDir = mounted ? direction : 'ltr'

    return (
        <StudentProvider>
            <SuperAdminViewingBanner />
            <div className="min-h-screen bg-background pb-20 lg:pb-0 theme-student flex" dir={activeDir}>
                {/* Desktop Sidebar */}
                <div className="hidden lg:block w-64 flex-shrink-0">
                    <StudentSidebar />
                </div>

                <main className="flex-1 min-h-screen w-full">
                    {children}
                </main>

                <StudentMobileNav />
            </div>
        </StudentProvider>
    )
}
