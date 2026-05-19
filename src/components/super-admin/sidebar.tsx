'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import {
    LayoutDashboard,
    Building2,
    Users,
    Settings,
    LogOut,
    ChevronRight,
    ChevronLeft,
    Sparkles
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useLanguage } from '@/i18n'
import { LanguageSwitcher } from '@/components/shared/language-switcher'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { useState, useEffect } from 'react'

export function useSuperAdminSidebarItems() {
    const { t } = useLanguage()
    return [
        { icon: LayoutDashboard, label: t('superAdmin.sidebar.dashboard'), href: '/super-admin' },
        { icon: Building2, label: t('superAdmin.sidebar.schools'), href: '/super-admin/schools' },
        { icon: Users, label: t('superAdmin.sidebar.users'), href: '/super-admin/users' },
        { icon: Settings, label: t('common.settings'), href: '/super-admin/settings' },
    ]
}

export function SuperAdminSidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const { t, direction } = useLanguage()
    const items = useSuperAdminSidebarItems()
    const ChevronIcon = direction === 'rtl' ? ChevronLeft : ChevronRight
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
    
    const [isCollapsed, setIsCollapsed] = useState(false)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        const saved = localStorage.getItem('qalami_superadmin_sidebar_collapsed')
        if (saved === 'true') setIsCollapsed(true)
        setMounted(true)
    }, [])

    const toggleCollapse = () => {
        const next = !isCollapsed
        setIsCollapsed(next)
        localStorage.setItem('qalami_superadmin_sidebar_collapsed', String(next))
    }

    const handleLogout = async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        sessionStorage.removeItem('superAdminViewingAs')
        router.push('/login')
    }

    if (!mounted) {
        return <div className="hidden lg:block w-64 h-screen shrink-0 bg-white/80 dark:bg-slate-950/80 border-r border-slate-200/60 dark:border-white/5" />
    }

    const isRTL = direction === 'rtl'

    return (
        <aside className={cn(
            "hidden lg:flex flex-col h-screen sticky top-0 bg-white/85 dark:bg-slate-950/90 backdrop-blur-2xl shadow-[rgba(17,_17,_26,_0.05)_0px_0px_16px] dark:shadow-[rgba(0,_0,_0,_0.2)_0px_0px_24px] z-30 shrink-0 transition-all duration-500 cubic-bezier(0.4,0,0.2,1) relative select-none",
            isCollapsed ? "w-[78px]" : "w-64",
            isRTL ? 'border-l border-slate-150 dark:border-white/5' : 'border-r border-slate-150 dark:border-white/5'
        )}>
            {/* Collapse Toggle floating jewel */}
            <button
                onClick={toggleCollapse}
                title={isCollapsed ? "Agrandir" : "Réduire"}
                className={cn(
                    "hidden lg:flex absolute top-16 w-6 h-6 bg-white dark:bg-slate-900 hover:bg-purple-600 dark:hover:bg-purple-500 hover:text-white text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-white/10 rounded-full items-center justify-center shadow-[0_2px_8px_rgba(124,58,237,0.08)] hover:shadow-[0_4px_12px_rgba(124,58,237,0.3)] hover:scale-110 active:scale-95 transition-all duration-300 z-50 cursor-pointer focus:outline-none ring-2 ring-transparent hover:ring-purple-500/20",
                    isRTL ? "-left-3" : "-right-3"
                )}
            >
                {isCollapsed 
                    ? (isRTL ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />)
                    : (isRTL ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />)
                }
            </button>

            {/* Header / Logo Area */}
            <div className={cn(
                "h-20 flex items-center relative overflow-hidden shrink-0 border-b border-slate-100 dark:border-white/5",
                isCollapsed ? "justify-center px-2" : "px-6"
            )}>
                {!isCollapsed && (
                    <div className="absolute -right-10 -top-10 w-32 h-32 bg-purple-500/5 blur-3xl rounded-full pointer-events-none" />
                )}
                <div className={cn("flex items-center relative z-10", isCollapsed ? "justify-center" : "gap-3.5")}>
                    {/* Glassmorphic Glowing Logo Frame */}
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-150 dark:border-white/10 shadow-[0_4px_15px_-3px_rgba(147,51,234,0.15)] ring-2 ring-purple-500/10 dark:ring-purple-500/20 group cursor-default transition-all duration-500 hover:scale-105 hover:rotate-3 hover:shadow-[0_4px_20px_-1px_rgba(147,51,234,0.3)] overflow-hidden p-1.5 shrink-0">
                        <img src="/web-app-manifest-192x192.png" alt="Qalami Logo" className="w-full h-full object-contain" />
                    </div>
                    
                    {!isCollapsed && (
                        <div className="flex flex-col animate-in fade-in slide-in-from-left-2 duration-500">
                            <span className="font-extrabold text-[17px] tracking-tight text-slate-900 dark:text-white leading-tight">
                                Qalami
                            </span>
                            <div className="flex items-center gap-1 mt-0.5">
                                <Sparkles className="w-2.5 h-2.5 text-purple-500 dark:text-purple-400 fill-purple-500/20" />
                                <span className="text-[9px] font-black text-purple-600 dark:text-purple-400 tracking-widest uppercase leading-none opacity-80">
                                    Superadmin
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Navigation Section */}
            <nav 
                className={cn("flex-1 overflow-y-auto py-6 flex flex-col select-none scrollbar-none", isCollapsed ? "px-2.5" : "px-3.5 space-y-2")}
                onMouseLeave={() => setHoveredIndex(null)}
            >
                {!isCollapsed && (
                    <div className="mb-3 px-3 text-[10px] font-black text-slate-400 dark:text-slate-500 tracking-[0.25em] uppercase opacity-80 animate-in fade-in duration-500">
                        {t('admin.sidebar.mainMenu') || 'MENU PRINCIPAL'}
                    </div>
                )}
                
                <div className="space-y-1">
                    {items.map((item, idx) => {
                        const isActive = pathname === item.href ||
                            (item.href !== '/super-admin' && pathname.startsWith(item.href))
                        
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onMouseEnter={() => setHoveredIndex(idx)}
                                title={isCollapsed ? item.label : undefined}
                                className={cn(
                                    "group relative flex items-center rounded-xl transition-all duration-300 text-[14px] font-semibold",
                                    isCollapsed ? "justify-center h-12 w-12 mx-auto p-0" : "justify-between px-3.5 py-2.5",
                                    isActive 
                                        ? "text-purple-600 dark:text-purple-100 shadow-[0_2px_8px_-2px_rgba(147,51,234,0.08)]" 
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:translate-x-0.5"
                                )}
                            >
                                {/* Premium Active Glass Pill */}
                                <AnimatePresence initial={false}>
                                    {isActive && (
                                        <motion.div
                                            layoutId="sidebar-active-pill"
                                            className={cn(
                                                "absolute inset-0 bg-gradient-to-r from-purple-50 to-purple-50/30 dark:from-purple-500/10 dark:to-transparent border-purple-600/30 dark:border-purple-500/20 rounded-xl z-0 border",
                                                isCollapsed ? "" : (isRTL ? "border-r-2 border-r-purple-600 dark:border-r-purple-400 border-l-0" : "border-l-2 border-l-purple-600 dark:border-l-purple-400 border-r-0")
                                            )}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ type: "spring", stiffness: 380, damping: 30 }}
                                        />
                                    )}
                                    
                                    {/* Smooth Hover Effect */}
                                    {!isActive && hoveredIndex === idx && (
                                        <motion.div
                                            layoutId="sidebar-hover-pill"
                                            className="absolute inset-0 bg-slate-100/60 dark:bg-white/5 border border-slate-200/20 dark:border-white/5 rounded-xl z-0"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ type: "spring", stiffness: 400, damping: 35 }}
                                        />
                                    )}
                                </AnimatePresence>

                                <div className={cn("flex items-center relative z-10 w-full", isCollapsed ? "justify-center" : "gap-3")}>
                                    <div className={cn(
                                        "p-1.5 rounded-lg transition-all duration-300 shrink-0",
                                        isActive ? "bg-purple-100/80 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 shadow-sm" : "bg-transparent text-slate-400 dark:text-slate-500 group-hover:text-purple-600 dark:group-hover:text-purple-400"
                                    )}>
                                        <item.icon className="h-4.5 w-4.5 transition-transform duration-300 group-hover:scale-110" />
                                    </div>
                                    {!isCollapsed && (
                                        <span className="tracking-wide animate-in fade-in duration-500 truncate">
                                            {item.label}
                                        </span>
                                    )}
                                </div>

                                {!isCollapsed && isActive && (
                                    <motion.div 
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className="relative z-10 ml-auto"
                                    >
                                        <ChevronIcon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 opacity-70 group-hover:opacity-100 transition-opacity" />
                                    </motion.div>
                                )}
                            </Link>
                        )
                    })}
                </div>
                
                {!isCollapsed ? (
                    <div className="pt-6 border-t border-slate-100 dark:border-white/5 mt-6 animate-in fade-in duration-500 space-y-2">
                        <LanguageSwitcher variant="full" className="w-full bg-slate-50/50 hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/[0.08] border border-slate-150 dark:border-white/5 rounded-xl shadow-sm transition-all duration-300 font-bold py-2.5 text-xs" />
                        <ThemeToggle variant="full" />
                    </div>
                ) : (
                    <div className="pb-2 flex flex-col items-center gap-1 mt-4 border-t border-slate-100 dark:border-white/5 pt-4">
                        <LanguageSwitcher variant="icon" />
                        <ThemeToggle variant="icon" />
                    </div>
                )}
            </nav>

            {/* Footer Section */}
            <div className={cn(
                "p-4 border-t border-slate-100 dark:border-white/5 bg-slate-50/30 dark:bg-transparent shrink-0 flex transition-all duration-300",
                isCollapsed ? "flex-col items-center" : ""
            )}>
                <button
                    onClick={handleLogout}
                    title={isCollapsed ? t('common.logout') : undefined}
                    className={cn(
                        "group flex items-center text-sm font-bold transition-all duration-300 rounded-xl",
                        isCollapsed 
                            ? "h-12 w-12 justify-center p-0 text-slate-400 hover:text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-500/10 shadow-sm" 
                            : "gap-3 px-3.5 py-3 w-full text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 border border-transparent hover:border-red-100 dark:hover:border-red-900/20 shadow-sm hover:shadow-md"
                    )}
                >
                    <div className={cn(
                        "p-1.5 rounded-lg bg-transparent transition-all duration-300",
                        isCollapsed ? "h-9 w-9 flex items-center justify-center p-0" : "group-hover:bg-red-100/80 dark:group-hover:bg-red-500/20"
                    )}>
                        <LogOut className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                    </div>
                    {!isCollapsed && <span className="tracking-wide animate-in fade-in duration-500">{t('common.logout')}</span>}
                </button>
            </div>
        </aside>
    )
}
