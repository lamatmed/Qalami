'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LucideIcon, MoreHorizontal } from 'lucide-react'
import { motion } from 'framer-motion'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LogOut, CalendarRange, ChevronUp, ChevronDown } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { useLanguage } from '@/i18n'
import { LanguageSwitcher } from '@/components/shared/language-switcher'

interface NavItem {
    icon: LucideIcon
    label: string
    href: string
    badge?: number
}

interface MobileNavProps {
    items: NavItem[]
    user?: {
        name: string
        role: string
        avatar?: string
    }
    academicContext?: {
        year: string | null
        term: string | null
        schoolName: string | null
        schoolLogo: string | null
        unassignedStudents: number
    }
}

export function MobileNav({ items, user, academicContext }: MobileNavProps) {
    const pathname = usePathname()
    const router = useRouter()
    const { t, direction } = useLanguage()
    const [sheetOpen, setSheetOpen] = useState(false)
    const gridScrollRef = useRef<HTMLDivElement>(null)

    // Close the sheet on route change to prevent stuck overlay/freeze
    useEffect(() => { setSheetOpen(false) }, [pathname])

    const scrollGrid = (dir: 'up' | 'down') => {
        gridScrollRef.current?.scrollBy({ top: dir === 'down' ? 160 : -160, behavior: 'smooth' })
    }

    const handleLogout = async () => {
        setSheetOpen(false)
        const supabase = createClient()
        await supabase.auth.signOut({ scope: 'local' })
        // Clear any impersonation data
        sessionStorage.removeItem('superAdminViewingAs')
        router.push('/login')
    }

    const handleNavClick = (href: string) => {
        setSheetOpen(false)
        router.push(href)
    }

    const mainItems = items.slice(0, 4)
    const overflowItems = items.slice(4)

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 lg:hidden w-[90%] max-w-sm">
            {/* Dock Container */}
            <div className="bg-black/90 backdrop-blur-2xl border border-white/10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] rounded-full px-6 py-4 flex items-center justify-between relative overflow-visible">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent pointer-events-none opacity-50 rounded-full" />

                {mainItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/admin' && item.href !== '/teacher' && pathname.startsWith(item.href))

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="relative flex flex-col items-center justify-center z-10"
                        >
                            <motion.div
                                animate={isActive ? { scale: 1.2, y: -4 } : { scale: 1, y: 0 }}
                                transition={{ type: "spring" as const, stiffness: 400, damping: 25 }}
                                className={cn(
                                    "p-2 rounded-full transition-all duration-300 relative",
                                    isActive ? "bg-primary text-primary-foreground shadow-[0_0_20px_rgba(var(--primary),0.6)]" : "text-muted-foreground hover:text-white"
                                )}
                            >
                                <item.icon className="h-5 w-5 stroke-[2px]" />
                                {item.badge != null && item.badge > 0 && (
                                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center bg-emerald-500 text-white shadow-sm">
                                        {item.badge > 99 ? '99+' : item.badge}
                                    </span>
                                )}
                            </motion.div>

                            {isActive && (
                                <motion.div
                                    layoutId="mobileNavDot"
                                    className="absolute -bottom-2 w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_10px_white]"
                                    transition={{ duration: 0.3 }}
                                />
                            )}
                        </Link>
                    )
                })}

                {/* Overflow Menu (Sheet) */}
                {overflowItems.length > 0 && (
                    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                        <SheetTrigger asChild>
                            <button suppressHydrationWarning className="relative flex flex-col items-center justify-center z-10 outline-none">
                                <div className="p-2 rounded-full text-muted-foreground hover:text-white transition-colors relative">
                                    <MoreHorizontal className="h-5 w-5 stroke-[2px]" />
                                    {overflowItems.some(item => item.badge != null && item.badge > 0) && (
                                        <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </span>
                                    )}
                                </div>
                            </button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="h-[85vh] rounded-t-[2.5rem] bg-black/95 backdrop-blur-xl border-white/10 !p-0 overflow-hidden" dir={direction}>
                            <div className="h-full flex flex-col">

                                {/* Fixed Header */}
                                <div className="shrink-0 px-6 pt-5">
                                    <SheetHeader className="pb-3 mb-2 border-b border-white/5">
                                        {user ? (
                                            <div className={cn("flex items-center gap-3", direction === 'rtl' ? 'flex-row-reverse text-right' : 'flex-row text-left')}>
                                                <Avatar className="h-10 w-10 border-2 border-white/10 shadow-xl shrink-0">
                                                    <AvatarImage src={user.avatar} />
                                                    <AvatarFallback className="text-sm bg-primary/20 text-primary font-bold">{user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                <div className={cn("min-w-0", direction === 'rtl' ? 'text-right' : 'text-left')}>
                                                    <SheetTitle className="text-base font-bold truncate">{user.name}</SheetTitle>
                                                    <p className="text-[11px] text-muted-foreground capitalize">{user.role}</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <SheetTitle className={direction === 'rtl' ? 'text-right' : 'text-left'}>{t('common.menu')}</SheetTitle>
                                        )}
                                    </SheetHeader>

                                    {/* Academic context year/term pill */}
                                    {academicContext && (academicContext.year || academicContext.schoolName) && (
                                        <div className="mb-2 animate-in fade-in duration-300">
                                            <div className={cn(
                                                "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] font-medium bg-card/30 border-white/5 text-gray-300",
                                                direction === 'rtl' ? 'flex-row-reverse text-right' : 'flex-row text-left'
                                            )}>
                                                <CalendarRange className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                                                <span className="truncate flex-1">
                                                    {academicContext.schoolName || t('common.appName')}{academicContext.year ? ` — ${academicContext.year}` : ''}{academicContext.term ? ` (${academicContext.term})` : ''}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Scrollable nav grid with arrow controls */}
                                <div className="flex flex-col flex-1 min-h-0">
                                    {/* Up arrow */}
                                    <button
                                        onClick={() => scrollGrid('up')}
                                        className="shrink-0 flex items-center justify-center py-1.5 text-white/25 hover:text-white/60 transition-colors active:scale-90"
                                    >
                                        <ChevronUp className="h-5 w-5" />
                                    </button>

                                    {/* Grid */}
                                    <div ref={gridScrollRef} className="flex-1 min-h-0 overflow-y-auto px-6 scrollbar-hide">
                                        <div className="grid grid-cols-3 gap-2.5 py-1">
                                            {overflowItems.map((item) => (
                                                <button
                                                    key={item.label}
                                                    onClick={() => handleNavClick(item.href)}
                                                    className="bg-card/30 border border-white/5 py-3 px-2 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-card hover:border-white/20 transition-all group"
                                                >
                                                    <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors relative">
                                                        <item.icon className="h-[18px] w-[18px] text-muted-foreground group-hover:text-primary transition-colors" />
                                                        {item.badge != null && item.badge > 0 && (
                                                            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-0.5 rounded-full text-[9px] font-bold flex items-center justify-center bg-emerald-500 text-white shadow-md">
                                                                {item.badge > 99 ? '99+' : item.badge}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="font-medium text-[11px] text-gray-300 group-hover:text-white text-center leading-tight w-full truncate px-1">{t(item.label)}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Down arrow */}
                                    <button
                                        onClick={() => scrollGrid('down')}
                                        className="shrink-0 flex items-center justify-center py-1.5 text-white/25 hover:text-white/60 transition-colors active:scale-90"
                                    >
                                        <ChevronDown className="h-5 w-5" />
                                    </button>
                                </div>

                                {/* Fixed Footer */}
                                <div className="shrink-0 px-6 pb-5 pt-2 border-t border-white/5 space-y-2">
                                    {/* Language + Theme row */}
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 flex items-center justify-between px-4 py-2.5 rounded-2xl border border-white/5 bg-card/30">
                                            <span className="text-sm font-medium text-gray-300">{t('common.language')}</span>
                                            <LanguageSwitcher variant="tabs" />
                                        </div>
                                        <div className="flex items-center justify-center px-3 py-2.5 rounded-2xl border border-white/5 bg-card/30">
                                            <ThemeToggle variant="icon" />
                                        </div>
                                    </div>

                                    {/* Logout Button */}
                                    <button onClick={handleLogout} className="w-full h-11 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-500 font-bold flex items-center justify-center gap-2 hover:bg-red-500/20 transition-colors">
                                        <LogOut className="w-5 h-5" />
                                        {t('common.logout')}
                                    </button>
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>
                )}
            </div>
        </div>
    )
}
