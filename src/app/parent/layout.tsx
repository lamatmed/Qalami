'use client'

import { ParentMobileNav } from '@/components/parent/parent-mobile-nav'
import { ParentSidebar } from '@/components/parent/sidebar'
import { ParentProvider } from '@/context/parent-context'
import { SuperAdminViewingBanner } from '@/components/shared/super-admin-viewing-banner'
import { useLanguage } from '@/i18n'

export default function ParentLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { direction, mounted } = useLanguage()
    const activeDir = mounted ? direction : 'ltr'

    return (
        <ParentProvider>
            <SuperAdminViewingBanner />
            <div className="min-h-screen bg-background pb-20 lg:pb-0 theme-parent flex pt-[36px]" dir={activeDir}>
                <div className="hidden lg:block w-64 flex-shrink-0">
                    <ParentSidebar />
                </div>

                <main className="flex-1 min-h-screen w-full">
                    {children}
                </main>

                <ParentMobileNav />
            </div>
        </ParentProvider>
    )
}

