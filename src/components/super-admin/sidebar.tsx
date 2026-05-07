'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
    LayoutDashboard,
    Building2,
    Users,
    Settings,
    LogOut,
    ChevronRight,
    ChevronLeft,
    Shield
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useLanguage } from '@/i18n'
import { LanguageSwitcher } from '@/components/shared/language-switcher'

export function useSuperAdminSidebarItems() {
    const { t } = useLanguage()
    return [
        { icon: LayoutDashboard, label: t('superAdmin.sidebar.dashboard'), href: '/super-admin' },
        { icon: Building2, label: t('superAdmin.sidebar.schools'), href: '/super-admin/schools' },
        { icon: Users, label: t('superAdmin.sidebar.users'), href: '/super-admin/users' },
        { icon: Settings, label: t('common.settings'), href: '/super-admin/settings' },
    ]
}

export const superAdminSidebarItems = [
    { icon: LayoutDashboard, label: 'Tableau de bord', href: '/super-admin' },
    { icon: Building2, label: 'Écoles', href: '/super-admin/schools' },
    { icon: Users, label: 'Utilisateurs', href: '/super-admin/users' },
    { icon: Settings, label: 'Configuration', href: '/super-admin/settings' },
]

export function SuperAdminSidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const { t, direction } = useLanguage()
    const items = useSuperAdminSidebarItems()
    const ChevronIcon = direction === 'rtl' ? ChevronLeft : ChevronRight

    const handleLogout = async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        sessionStorage.removeItem('superAdminViewingAs')
        router.push('/login')
    }

    return (
        <aside className={cn(
            "hidden lg:flex flex-col w-72 h-screen sticky top-0 bg-white dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 border-gray-200 dark:border-white/10 shadow-lg z-30",
            direction === 'rtl' ? 'border-l' : 'border-r'
        )}>
            {/* Header / Logo */}
            <div className="h-20 flex items-center px-8 border-b border-gray-200 dark:border-white/10">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
                        <Shield className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-xl tracking-tight text-gray-900 dark:text-white">{t('common.appName')}</span>
                        <span className="text-[10px] text-purple-500 dark:text-purple-400 uppercase tracking-widest font-bold">{t('common.superAdmin')}</span>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
                <div className="mb-2 px-4 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    {t('admin.sidebar.mainMenu')}
                </div>
                {items.map((item) => {
                    const isActive = pathname === item.href ||
                        (item.href !== '/super-admin' && pathname.startsWith(item.href))
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "group flex items-center justify-between px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200",
                                isActive
                                    ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <item.icon className={cn(
                                    "h-5 w-5 transition-transform duration-300 group-hover:scale-110",
                                    isActive ? "text-white" : "text-gray-400 dark:text-gray-500 group-hover:text-purple-500 dark:group-hover:text-purple-400"
                                )} />
                                <span>{item.label}</span>
                            </div>
                            {isActive && <ChevronIcon className="w-4 h-4" />}
                        </Link>
                    )
                })}
                <LanguageSwitcher variant="full" className="text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white" />
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-white/10">
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all w-full"
                >
                    <LogOut className="h-5 w-5" />
                    <span>{t('common.logout')}</span>
                </button>
            </div>
        </aside>
    )
}
