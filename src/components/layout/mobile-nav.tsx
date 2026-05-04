'use client'

import { useState } from 'react'
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
import { LogOut } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { useLanguage } from '@/i18n'
import { LanguageSwitcher } from '@/components/shared/language-switcher'

interface NavItem {
    icon: LucideIcon
    label: string
    href: string
}

interface MobileNavProps {
    items: NavItem[]
    user?: {
        name: string
        role: string
        avatar?: string
    }
}

export function MobileNav({ items, user }: MobileNavProps) {
    const pathname = usePathname()
    const router = useRouter()
    const { t } = useLanguage()
    const [sheetOpen, setSheetOpen] = useState(false)

    const handleLogout = async () => {
        setSheetOpen(false)
        const supabase = createClient()
        await supabase.auth.signOut()
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
                                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                className={cn(
                                    "p-2 rounded-full transition-all duration-300",
                                    isActive ? "bg-primary text-primary-foreground shadow-[0_0_20px_rgba(var(--primary),0.6)]" : "text-muted-foreground hover:text-white"
                                )}
                            >
                                <item.icon className="h-5 w-5 stroke-[2px]" />
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
                                <div className="p-2 rounded-full text-muted-foreground hover:text-white transition-colors">
                                    <MoreHorizontal className="h-5 w-5 stroke-[2px]" />
                                </div>
                            </button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="h-[85vh] rounded-t-[2.5rem] bg-black/95 backdrop-blur-xl border-white/10 p-6">
                            <SheetHeader className="pb-6 mb-4 border-b border-white/5">
                                {user ? (
                                    <div className="flex items-center gap-4">
                                        <Avatar className="h-16 w-16 border-2 border-white/10 shadow-xl">
                                            <AvatarImage src={user.avatar} />
                                            <AvatarFallback className="text-lg bg-primary/20 text-primary font-bold">{user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div className="text-left">
                                            <SheetTitle className="text-2xl font-bold">{user.name}</SheetTitle>
                                            <p className="text-sm text-muted-foreground">{user.role}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <SheetTitle>Menu</SheetTitle>
                                )}
                            </SheetHeader>

                            <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-4 pb-4">
                                {overflowItems.map((item, i) => (
                                    <button
                                        key={item.label}
                                        onClick={() => handleNavClick(item.href)}
                                        className="bg-card/30 border border-white/5 p-4 rounded-3xl flex flex-col items-center justify-center gap-3 aspect-[1.4] hover:bg-card hover:border-white/20 transition-all group"
                                    >
                                        <div className="h-12 w-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                                            <item.icon className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                                        </div>
                                        <span className="font-medium text-sm text-gray-300 group-hover:text-white">{item.label}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="pt-4 mt-auto space-y-3">
                                {/* Language Switcher */}
                                <div className="flex items-center justify-between px-4 py-3 rounded-2xl border border-white/5 bg-card/30">
                                    <span className="text-sm font-medium text-gray-300">{t('common.language')}</span>
                                    <LanguageSwitcher variant="compact" />
                                </div>

                                {/* Theme Toggle */}
                                <div className="flex items-center justify-between px-4 py-3 rounded-2xl border border-white/5 bg-card/30">
                                    <span className="text-sm font-medium text-gray-300">Theme</span>
                                    <ThemeToggle />
                                </div>

                                {/* Logout Button */}
                                <button onClick={handleLogout} className="w-full h-14 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-500 font-bold flex items-center justify-center gap-2 hover:bg-red-500/20 transition-colors">
                                    <LogOut className="w-5 h-5" />
                                    {t('common.logout')}
                                </button>
                                <p className="text-center text-[10px] text-muted-foreground mt-4">Version 2.4.0 (Build 20240501)</p>
                            </div>
                        </SheetContent>
                    </Sheet>
                )}
            </div>
        </div>
    )
}
