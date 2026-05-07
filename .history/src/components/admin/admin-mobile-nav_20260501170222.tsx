'use client'

import { MobileNav } from '@/components/layout/mobile-nav'
import { sidebarItems } from '@/components/admin/sidebar'

export function AdminMobileNav({ user }: { user: any }) {
    return <MobileNav items={sidebarItems} user={user} />
}
