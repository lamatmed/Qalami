/* eslint-disable @typescript-eslint/no-explicit-any */
import { AdminSidebar } from '@/components/admin/sidebar'
import { AdminMobileNav } from '@/components/admin/admin-mobile-nav'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

import { NotificationBell } from '@/components/shared/notification-bell'
import { Brand } from '@/components/shared/brand'


export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name, avatar_url, first_login')
        .eq('id', user.id)
        .single()

    if (!['admin', 'super_admin', 'school_staff'].includes(profile?.role || '')) {
        redirect('/')
    }

    // First-login redirect for school_staff
    if (profile?.role === 'school_staff' && (profile as any)?.first_login === true) {
        redirect('/staff-first-login')
    }

    const formattedUser = {
        name: (profile as any)?.full_name || user.user_metadata?.full_name || user.email || 'Admin',
        role: profile?.role || 'admin',
        avatar: (profile as any)?.avatar_url || user.user_metadata?.avatar_url || null,
    }

    return (
        <div className="flex h-screen bg-background theme-admin">

            {/* Sidebar — desktop only */}
            <div className="hidden lg:block h-full shrink-0">
                <AdminSidebar />
            </div>

            {/* Main content */}
            <main className="flex-1 overflow-y-auto pb-20 lg:pb-0 min-w-0">

                {/* Mobile top bar — hidden on desktop */}
                <div className="lg:hidden h-12 bg-background border-b border-border px-4 flex items-center justify-between sticky top-0 z-20">
                    <Link href="/admin" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <div className="w-6 h-6 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
                            <span className="font-black text-[11px] text-white leading-none">Q</span>
                        </div>
                        <span className="font-semibold text-sm text-foreground"><Brand /></span>
                    </Link>

                    <NotificationBell />
                </div>

                {/* Page */}
                <div className="p-4 sm:p-6 lg:p-8">
                    {children}
                </div>
            </main>

            <AdminMobileNav user={formattedUser} />
        </div>
    )
}
