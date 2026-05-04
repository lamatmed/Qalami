'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
    LayoutDashboard,
    GraduationCap,
    Calendar,
    FileText,
    AlertTriangle,
    BrainCircuit,
    LogOut
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useLanguage } from '@/i18n'
import { LanguageSwitcher } from '@/components/shared/language-switcher'

export function useTeacherSidebarItems() {
    const { t } = useLanguage()
    return [
        { icon: LayoutDashboard, label: t('teacher.sidebar.dashboard'), href: '/teacher' },
        { icon: GraduationCap, label: t('teacher.sidebar.myClasses'), href: '/teacher/classes' },
        { icon: BrainCircuit, label: t('teacher.sidebar.quizzes'), href: '/teacher/quizzes' },
        { icon: Calendar, label: t('teacher.sidebar.schedule'), href: '/teacher/schedule' },
        { icon: AlertTriangle, label: t('teacher.sidebar.attendance'), href: '/teacher/remarks' },
        { icon: FileText, label: t('common.documents'), href: '/teacher/resources' },
    ]
}

export const sidebarItems = [
    { icon: LayoutDashboard, label: 'Tableau de bord', href: '/teacher' },
    { icon: GraduationCap, label: 'Mes Classes', href: '/teacher/classes' },
    { icon: BrainCircuit, label: 'Quiz', href: '/teacher/quizzes' },
    { icon: Calendar, label: 'Emploi du temps', href: '/teacher/schedule' },
    { icon: AlertTriangle, label: 'Remarques', href: '/teacher/remarks' },
    { icon: FileText, label: 'Ressources', href: '/teacher/resources' },
]

export function TeacherSidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const { t, direction } = useLanguage()
    const items = useTeacherSidebarItems()

    const handleLogout = async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        sessionStorage.removeItem('superAdminViewingAs')
        router.push('/login')
    }

    return (
        <div className={cn("flex flex-col h-full bg-white border-r w-64", direction === 'rtl' && 'border-l border-r-0')}>
            <div className="p-6">
                <h1 className="text-2xl font-bold text-indigo-600">{t('common.appName')}</h1>
                <p className="text-xs text-gray-500">{t('common.teacher')}</p>
            </div>
            <nav className="flex-1 px-4 space-y-1">
                {items.map((item) => {
                    const isActive = pathname.startsWith(item.href) && (item.href !== '/teacher' || pathname === '/teacher')
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                                isActive
                                    ? "bg-indigo-50 text-indigo-600"
                                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                            )}
                        >
                            <item.icon className={cn("h-5 w-5 me-3", isActive ? "text-indigo-600" : "text-gray-400")} />
                            {item.label}
                        </Link>
                    )
                })}
                <LanguageSwitcher variant="full" className="text-gray-600 hover:bg-gray-50 hover:text-gray-900" />
            </nav>
            <div className="p-4 border-t">
                <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                    <LogOut className="h-5 w-5 me-3 text-red-500" />
                    {t('common.logout')}
                </button>
            </div>
        </div>
    )
}
