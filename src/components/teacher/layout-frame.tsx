'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { TeacherSidebar, useTeacherSidebarItems } from '@/components/teacher/sidebar'
import { cn } from '@/lib/utils'
import { SuperAdminViewingBanner } from '@/components/shared/super-admin-viewing-banner'
import { useLanguage } from '@/i18n'
import { createClient } from '@/utils/supabase/client'
import { MoreHorizontal, LogOut, X } from 'lucide-react'
import { LanguageSwitcher } from '@/components/shared/language-switcher'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { motion, AnimatePresence } from 'framer-motion'

interface TeacherLayoutFrameProps {
    children: React.ReactNode
    header: React.ReactNode
}

// Items shown in the bottom bar (most-used 4 + "More" trigger)
const BOTTOM_BAR_HREFS = ['/teacher', '/teacher/classes', '/teacher/documents', '/teacher/quizzes']

export function TeacherLayoutFrame({ children, header }: TeacherLayoutFrameProps) {
    const [isCollapsed, setIsCollapsed] = useState(false)
    const [sheetOpen, setSheetOpen] = useState(false)
    const { direction, t } = useLanguage()
    const pathname = usePathname()
    const router = useRouter()
    const items = useTeacherSidebarItems()

    useEffect(() => {
        const saved = localStorage.getItem('qalami_teacher_sidebar_collapsed')
        if (saved === 'true') setIsCollapsed(true)
    }, [])

    // Close sheet on route change
    useEffect(() => { setSheetOpen(false) }, [pathname])

    const handleToggle = () => {
        const next = !isCollapsed
        setIsCollapsed(next)
        localStorage.setItem('qalami_teacher_sidebar_collapsed', String(next))
    }

    const handleLogout = async () => {
        setSheetOpen(false)
        const supabase = createClient()
        await supabase.auth.signOut({ scope: 'local' })
        sessionStorage.removeItem('superAdminViewingAs')
        router.push('/login')
    }

    const bottomItems = items.filter(i => BOTTOM_BAR_HREFS.includes(i.href))
    const sheetItems = items.filter(i => !BOTTOM_BAR_HREFS.includes(i.href))

    return (
        <div className={cn(
            "flex h-screen bg-slate-50/50 dark:bg-muted/20 theme-teacher overflow-hidden transition-colors duration-300",
            direction === 'rtl' ? "flex-row-reverse" : "flex-row"
        )}>
            {/* Desktop sidebar */}
            <div className={cn(
                "hidden lg:block h-full transition-all duration-300 ease-in-out shrink-0 border-slate-100 dark:border-white/5",
                direction === 'rtl' ? "border-l" : "border-r",
                isCollapsed ? "w-20" : "w-64"
            )}>
                <TeacherSidebar isCollapsed={isCollapsed} onToggle={handleToggle} />
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col min-w-0 h-full bg-transparent overflow-hidden">
                <SuperAdminViewingBanner />
                {header}
                <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
                    {children}
                </main>
            </div>

            {/* ── Mobile bottom navigation bar ──────────────────────────── */}
            <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 dark:bg-card/95 backdrop-blur-xl border-t border-slate-100 dark:border-white/10 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] pb-safe">
                <div className="flex items-stretch h-16">
                    {bottomItems.map((item) => {
                        const isActive = pathname.startsWith(item.href) && (item.href !== '/teacher' || pathname === '/teacher')
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex-1 flex flex-col items-center justify-center gap-1 transition-colors relative",
                                    isActive
                                        ? "text-indigo-600 dark:text-indigo-400"
                                        : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                )}
                            >
                                {isActive && (
                                    <span className="absolute top-0 inset-x-3 h-0.5 bg-indigo-500 rounded-b-full" />
                                )}
                                <item.icon className={cn("h-5 w-5", isActive ? "stroke-[2.5px]" : "stroke-[1.8px]")} />
                                <span className={cn("text-[10px] font-bold truncate max-w-[56px] text-center", isActive ? "font-extrabold" : "")}>
                                    {item.label}
                                </span>
                            </Link>
                        )
                    })}

                    {/* "More" trigger */}
                    <button
                        onClick={() => setSheetOpen(true)}
                        className={cn(
                            "flex-1 flex flex-col items-center justify-center gap-1 transition-colors relative",
                            sheetOpen
                                ? "text-indigo-600 dark:text-indigo-400"
                                : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        )}
                    >
                        <MoreHorizontal className="h-5 w-5 stroke-[1.8px]" />
                        <span className="text-[10px] font-bold">{t('common.more') || 'Plus'}</span>
                    </button>
                </div>
            </nav>

            {/* ── More sheet ─────────────────────────────────────────────── */}
            <AnimatePresence>
                {sheetOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            key="backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="lg:hidden fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
                            onClick={() => setSheetOpen(false)}
                        />

                        {/* Sheet */}
                        <motion.div
                            key="sheet"
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                            className="lg:hidden fixed bottom-0 inset-x-0 z-[61] bg-white dark:bg-card rounded-t-3xl shadow-2xl pb-safe"
                            dir={direction}
                        >
                            {/* Handle */}
                            <div className="flex justify-center pt-3 pb-1">
                                <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-white/10" />
                            </div>

                            {/* Close button */}
                            <div className="flex items-center justify-between px-5 pb-3 border-b border-slate-100 dark:border-white/5">
                                <span className="text-sm font-extrabold text-slate-700 dark:text-slate-200">{t('common.menu') || 'Menu'}</span>
                                <button onClick={() => setSheetOpen(false)} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                                    <X className="h-4 w-4 text-slate-500" />
                                </button>
                            </div>

                            {/* Extra nav items */}
                            <div className="px-4 py-3 grid grid-cols-3 gap-2.5">
                                {sheetItems.map((item) => {
                                    const isActive = pathname.startsWith(item.href)
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={cn(
                                                "flex flex-col items-center justify-center gap-2 py-4 rounded-2xl border transition-all",
                                                isActive
                                                    ? "bg-indigo-50 dark:bg-indigo-500/15 border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400"
                                                    : "bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-indigo-200 dark:hover:border-indigo-500/20"
                                            )}
                                        >
                                            <item.icon className="h-5 w-5" />
                                            <span className="text-[11px] font-bold text-center leading-tight px-1">{item.label}</span>
                                        </Link>
                                    )
                                })}
                            </div>

                            {/* Language + Theme + Logout */}
                            <div className="px-4 pb-5 pt-2 border-t border-slate-100 dark:border-white/5 space-y-2.5">
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 flex items-center justify-between px-4 py-2.5 rounded-2xl border border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-white/5">
                                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{t('common.language')}</span>
                                        <LanguageSwitcher variant="tabs" />
                                    </div>
                                    <div className="flex items-center justify-center px-3 py-2.5 rounded-2xl border border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-white/5">
                                        <ThemeToggle variant="icon" />
                                    </div>
                                </div>

                                <button
                                    onClick={handleLogout}
                                    className="w-full h-12 rounded-2xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-bold flex items-center justify-center gap-2.5 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                                >
                                    <LogOut className="w-5 h-5" />
                                    {t('common.logout')}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}
