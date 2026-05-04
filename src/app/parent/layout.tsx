'use client'

import { ParentMobileNav } from '@/components/parent/parent-mobile-nav'
import { ParentSidebar } from '@/components/parent/sidebar'
import { ParentProvider } from '@/context/parent-context'
import { SuperAdminViewingBanner } from '@/components/shared/super-admin-viewing-banner'

export default function ParentLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <ParentProvider>
            <SuperAdminViewingBanner />
            <div className="min-h-screen bg-background pb-20 lg:pb-0 theme-parent flex pt-[36px]">
                <div className="hidden lg:block w-64 flex-shrink-0">
                    <ParentSidebar />
                </div>

                <main className="flex-1 min-h-screen lg:ml-64 w-full">
                    {children}
                </main>

                <ParentMobileNav />
            </div>
        </ParentProvider>
    )
}

