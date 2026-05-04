'use client'

import { MobileNav } from '@/components/layout/mobile-nav'
import { LayoutDashboard, Calendar, FileText, CreditCard, Clock, File, Settings } from 'lucide-react'
import { useLanguage } from '@/i18n'

export function ParentMobileNav() {
    const { t } = useLanguage()

    const navItems = [
        { icon: LayoutDashboard, label: t('parent.sidebar.dashboard'), href: '/parent' },
        { icon: Calendar, label: t('parent.sidebar.schedule'), href: '/parent/schedule' },
        { icon: FileText, label: t('parent.sidebar.grades'), href: '/parent/grades' },
        { icon: CreditCard, label: t('parent.sidebar.finances'), href: '/parent/finances' },
        { icon: Clock, label: t('parent.sidebar.attendance'), href: '/parent/attendance' },
        { icon: File, label: t('parent.sidebar.documents'), href: '/parent/documents' },
        { icon: Settings, label: t('parent.sidebar.settings'), href: '/parent/settings' },
    ]

    return <MobileNav items={navItems} />
}
