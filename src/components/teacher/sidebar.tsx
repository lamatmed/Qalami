'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
    LayoutDashboard,
    GraduationCap,
    Calendar,
    AlertTriangle,
    BrainCircuit,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Settings,
    Bell,
    FolderOpen,
    BarChart3,
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useLanguage } from '@/i18n'
import { LanguageSwitcher } from '@/components/shared/language-switcher'
import { ThemeToggle } from '@/components/shared/theme-toggle'

export function useTeacherSidebarItems() {
    const { t } = useLanguage()
    return [
        { icon: LayoutDashboard, label: t('teacher.sidebar.dashboard'), href: '/teacher' },
        { icon: BarChart3, label: t('teacher.sidebar.stats'), href: '/teacher/statistique' },
        { icon: GraduationCap, label: t('teacher.sidebar.myClasses'), href: '/teacher/classes' },
        { icon: Calendar, label: t('teacher.sidebar.schedule'), href: '/teacher/schedule' },
        { icon: BrainCircuit, label: t('teacher.sidebar.quizzes'), href: '/teacher/quizzes' },
        { icon: AlertTriangle, label: t('teacher.sidebar.attendance'), href: '/teacher/remarks' },
        { icon: FolderOpen, label: t('teacher.sidebar.documents') || 'Documents', href: '/teacher/documents' },
        { icon: Bell, label: t('teacher.sidebar.community') || 'Communauté', href: '/teacher/community' },
        { icon: Settings, label: t('teacher.sidebar.settings') || 'Paramètres', href: '/teacher/settings' },
    ]
}

export const sidebarItems = [
    { icon: LayoutDashboard, label: 'teacher.sidebar.dashboard', href: '/teacher' },
    { icon: BarChart3, label: 'teacher.sidebar.stats', href: '/teacher/statistique' },
    { icon: GraduationCap, label: 'teacher.sidebar.myClasses', href: '/teacher/classes' },
    { icon: Calendar, label: 'teacher.sidebar.schedule', href: '/teacher/schedule' },
    { icon: BrainCircuit, label: 'teacher.sidebar.quizzes', href: '/teacher/quizzes' },
    { icon: AlertTriangle, label: 'teacher.sidebar.attendance', href: '/teacher/remarks' },
    { icon: FolderOpen, label: 'teacher.sidebar.documents', href: '/teacher/documents' },
    { icon: Bell, label: 'teacher.sidebar.community', href: '/teacher/community' },
    { icon: Settings, label: 'teacher.sidebar.settings', href: '/teacher/settings' },
]

export function TeacherSidebar({ isCollapsed = false, onToggle }: { isCollapsed?: boolean; onToggle?: () => void }) {
    const pathname = usePathname()
    const router = useRouter()
    const { t, direction } = useLanguage()
    const items = useTeacherSidebarItems()

    const handleLogout = async () => {
        const supabase = createClient()
        await supabase.auth.signOut({ scope: 'local' })
        sessionStorage.removeItem('superAdminViewingAs')
        router.push('/login')
    }

    return (
        <div className={cn(
            "flex flex-col h-full bg-white border-slate-100 dark:bg-card dark:border-white/5 relative transition-all duration-300 select-none",
            isCollapsed ? "w-20" : "w-64"
        )}>
            {/* Desktop Collapse Toggle floating knob */}
            {onToggle && (
                <button
                    onClick={onToggle}
                    title={isCollapsed ? "Agrandir" : "Réduire"}
                    className={cn(
                        "hidden lg:flex absolute top-16 w-6 h-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-full items-center justify-center shadow-md text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:text-indigo-400 transition-all active:scale-90 z-50",
                        direction === 'rtl' ? "-left-3" : "-right-3"
                    )}
                >
                    {isCollapsed
                        ? (direction === 'rtl' ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />)
                        : (direction === 'rtl' ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />)
                    }
                </button>
            )}

            {/* Sidebar Header Logo */}
            <div className={cn(
                "p-6 flex items-center border-b border-slate-50 dark:border-white/5 shrink-0",
                isCollapsed ? "justify-center" : "gap-3"
            )}>
                <div className="relative w-10 h-10 shrink-0 overflow-hidden rounded-xl shadow-[0_4px_12px_rgba(79,70,229,0.15)] border border-indigo-50 dark:border-indigo-500/20 bg-white flex items-center justify-center transition-transform duration-300 hover:scale-105">
                    <img src="/web-app-manifest-192x192.png" alt="Logo" className="w-7 h-7 object-contain" />
                </div>
                {!isCollapsed && (
                    <div className="flex flex-col overflow-hidden animate-in fade-in slide-in-from-left-2 duration-300">
                        <h1 className="text-xl font-black tracking-tight text-indigo-600 dark:text-indigo-400 leading-none truncate">{t('common.appName')}</h1>
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1 leading-none truncate">{t('common.teacher')}</p>
                    </div>
                )}
            </div>

            {/* Navigation links — scrollable so footer logout is always visible */}
            <nav className={cn("flex-1 py-6 space-y-1.5 overflow-y-auto", isCollapsed ? "px-2.5" : "px-4")}>
                {items.map((item) => {
                    const isActive = pathname.startsWith(item.href) && (item.href !== '/teacher' || pathname === '/teacher')
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            title={isCollapsed ? item.label : undefined}
                            className={cn(
                                "flex items-center text-sm font-bold rounded-xl transition-all duration-200 group relative",
                                isCollapsed ? "justify-center h-11 w-11 mx-auto" : "px-4 py-3 h-11",
                                isActive
                                    ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.1)]"
                                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
                            )}
                        >
                            <item.icon className={cn(
                                "h-5 w-5 shrink-0 transition-colors",
                                isCollapsed ? "" : "me-3",
                                isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500 group-hover:text-indigo-500"
                            )} />
                            {!isCollapsed && (
                                <span className="truncate font-extrabold animate-in fade-in duration-300">
                                    {item.label}
                                </span>
                            )}
                        </Link>
                    )
                })}

                {!isCollapsed ? (
                    <div className="pt-4 border-t border-slate-50 dark:border-white/5 mt-4 space-y-2">
                        <LanguageSwitcher variant="full" className="text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 font-bold" />
                        <ThemeToggle variant="full" />
                    </div>
                ) : (
                    <div className="pt-4 border-t border-slate-50 dark:border-white/5 mt-4 flex flex-col items-center gap-1">
                        <LanguageSwitcher variant="icon" />
                        <ThemeToggle variant="icon" />
                    </div>
                )}
            </nav>

            {/* Footer Logout — always visible, never pushed off-screen */}
            <div className={cn("shrink-0 p-4 border-t border-slate-50 dark:border-white/5", isCollapsed ? "flex justify-center" : "")}>
                <button
                    onClick={handleLogout}
                    title={isCollapsed ? t('common.logout') : undefined}
                    className={cn(
                        "flex items-center text-sm font-black text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all duration-200 group",
                        isCollapsed ? "h-11 w-11 justify-center" : "w-full px-4 py-3 h-11"
                    )}
                >
                    <LogOut className={cn("h-5 w-5 shrink-0 transition-transform group-hover:scale-110", isCollapsed ? "" : "me-3", "text-red-500")} />
                    {!isCollapsed && (
                        <span className="truncate animate-in fade-in duration-300">
                            {t('common.logout')}
                        </span>
                    )}
                </button>
            </div>
        </div>
    )
}
