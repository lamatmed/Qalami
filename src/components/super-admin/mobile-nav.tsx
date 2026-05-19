'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import {
    LayoutDashboard, Building2, Users, Settings,
    MoreHorizontal, LogOut, Sparkles
} from 'lucide-react'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet'
import { createClient } from '@/utils/supabase/client'
import { useLanguage } from '@/i18n'
import { LanguageSwitcher } from '@/components/shared/language-switcher'
import { ThemeToggle } from '@/components/shared/theme-toggle'

const NAV_ITEMS = [
    { icon: LayoutDashboard, labelKey: 'superAdmin.sidebar.dashboard', href: '/super-admin' },
    { icon: Building2,       labelKey: 'superAdmin.sidebar.schools',   href: '/super-admin/schools' },
    { icon: Users,           labelKey: 'superAdmin.sidebar.users',     href: '/super-admin/users' },
    { icon: Settings,        labelKey: 'common.settings',              href: '/super-admin/settings' },
]

// First 3 in dock, rest in overflow sheet
const DOCK_COUNT = 3

export function SuperAdminMobileNav() {
    const pathname  = usePathname()
    const router    = useRouter()
    const { t, direction } = useLanguage()
    const [sheetOpen, setSheetOpen] = useState(false)

    const handleLogout = async () => {
        setSheetOpen(false)
        const supabase = createClient()
        await supabase.auth.signOut()
        sessionStorage.removeItem('superAdminViewingAs')
        router.push('/login')
    }

    const handleNavClick = (href: string) => {
        setSheetOpen(false)
        router.push(href)
    }

    const dockItems     = NAV_ITEMS.slice(0, DOCK_COUNT)
    const overflowItems = NAV_ITEMS.slice(DOCK_COUNT)

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 lg:hidden w-[90%] max-w-sm">
            <div className="bg-slate-900/95 backdrop-blur-2xl border border-white/10 shadow-[0_10px_40px_-10px_rgba(147,51,234,0.4)] rounded-full px-6 py-4 flex items-center justify-between relative overflow-visible">
                {/* Purple glow */}
                <div className="absolute inset-0 bg-gradient-to-t from-purple-500/10 to-transparent pointer-events-none opacity-50 rounded-full" />

                {dockItems.map((item) => {
                    const isActive = pathname === item.href ||
                        (item.href !== '/super-admin' && pathname.startsWith(item.href))
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="relative flex flex-col items-center justify-center z-10"
                        >
                            <motion.div
                                animate={isActive ? { scale: 1.2, y: -4 } : { scale: 1, y: 0 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                className={cn(
                                    'p-2 rounded-full transition-all duration-300',
                                    isActive
                                        ? 'bg-purple-600 text-white shadow-[0_0_20px_rgba(147,51,234,0.6)]'
                                        : 'text-slate-400 hover:text-white'
                                )}
                            >
                                <item.icon className="h-5 w-5 stroke-[2px]" />
                            </motion.div>
                            {isActive && (
                                <motion.div
                                    layoutId="superAdminMobileNavDot"
                                    className="absolute -bottom-2 w-1.5 h-1.5 bg-purple-400 rounded-full shadow-[0_0_8px_rgba(147,51,234,0.8)]"
                                    transition={{ duration: 0.3 }}
                                />
                            )}
                        </Link>
                    )
                })}

                {/* Overflow Sheet — shows when there are extra items */}
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                    <SheetTrigger asChild>
                        <button suppressHydrationWarning className="relative flex flex-col items-center justify-center z-10 outline-none">
                            <div className="p-2 rounded-full text-slate-400 hover:text-white transition-colors">
                                <MoreHorizontal className="h-5 w-5 stroke-[2px]" />
                            </div>
                        </button>
                    </SheetTrigger>
                    <SheetContent
                        side="bottom"
                        className="h-auto rounded-t-[2.5rem] bg-slate-900/98 backdrop-blur-xl border-white/10 !p-0 overflow-hidden"
                        dir={direction}
                    >
                        <div className="flex flex-col">
                            {/* Drag handle */}
                            <div className="flex justify-center pt-3 pb-1 shrink-0">
                                <div className="w-10 h-1 rounded-full bg-white/20" />
                            </div>

                            {/* Header */}
                            <div className="shrink-0 px-6 pt-3 pb-4 border-b border-white/5">
                                <SheetHeader>
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/20 shrink-0">
                                            <Sparkles className="w-4 h-4 text-purple-400" />
                                        </div>
                                        <div>
                                            <SheetTitle className="text-base font-bold text-white">Qalami</SheetTitle>
                                            <p className="text-[10px] font-black text-purple-400 tracking-widest uppercase">Superadmin</p>
                                        </div>
                                    </div>
                                </SheetHeader>
                            </div>

                            {/* All nav items in overflow (Settings) */}
                            {overflowItems.length > 0 && (
                                <div className="px-6 py-4 grid grid-cols-3 gap-2.5 border-b border-white/5">
                                    {overflowItems.map((item) => {
                                        const isActive = pathname === item.href ||
                                            (item.href !== '/super-admin' && pathname.startsWith(item.href))
                                        return (
                                            <button
                                                key={item.href}
                                                onClick={() => handleNavClick(item.href)}
                                                className={cn(
                                                    "py-3 px-2 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all group border",
                                                    isActive
                                                        ? "bg-purple-600/20 border-purple-500/30"
                                                        : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/15"
                                                )}
                                            >
                                                <div className={cn(
                                                    "h-9 w-9 rounded-xl flex items-center justify-center transition-colors",
                                                    isActive ? "bg-purple-600/30 text-purple-300" : "bg-white/5 text-slate-400 group-hover:text-purple-400"
                                                )}>
                                                    <item.icon className="h-[18px] w-[18px]" />
                                                </div>
                                                <span className="font-medium text-[11px] text-gray-300 group-hover:text-white text-center">{t(item.labelKey)}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            )}

                            {/* Footer: Language + Theme + Logout */}
                            <div className="px-6 py-4 space-y-2.5">
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 flex items-center justify-between px-4 py-2.5 rounded-2xl border border-white/5 bg-white/5">
                                        <span className="text-sm font-medium text-gray-300">{t('common.language')}</span>
                                        <LanguageSwitcher variant="tabs" />
                                    </div>
                                    <div className="flex items-center justify-center px-3 py-2.5 rounded-2xl border border-white/5 bg-white/5">
                                        <ThemeToggle variant="icon" />
                                    </div>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="w-full h-11 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400 font-bold flex items-center justify-center gap-2 hover:bg-red-500/20 transition-colors"
                                >
                                    <LogOut className="w-4 h-4" />
                                    {t('common.logout')}
                                </button>
                            </div>
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
        </div>
    )
}
