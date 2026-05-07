"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LogOut, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/utils/supabase/client"
import { useLanguage } from "@/i18n"
import { LanguageSwitcher } from "@/components/shared/language-switcher"

export interface SidebarItem {
    icon: LucideIcon
    label: string
    href: string
}

interface RoleSidebarProps {
    items: SidebarItem[]
    logoIcon: LucideIcon
    logoBgClass: string
    roleLabel: string
    accent: {
        active: string
        activeText: string
        activeIcon: string
        bar: string
        accentText: string
    }
}

export function RoleSidebar({ items, logoIcon: LogoIcon, logoBgClass, roleLabel, accent }: RoleSidebarProps) {
    const pathname = usePathname()
    const router = useRouter()
    const { t, direction, mounted } = useLanguage()

    const handleLogout = async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        sessionStorage.removeItem("superAdminViewingAs")
        router.push("/login")
    }

    return (
        <aside
            className={cn(
                "w-64 bg-[#0D1117] border-white/5 h-screen flex flex-col fixed top-0 overflow-hidden z-40",
                mounted && direction === "rtl" ? "right-0 border-l" : "left-0 border-r"
            )}
        >
            {/* Logo */}
            <div className="h-16 flex items-center px-6 border-b border-white/5">
                <div className="flex items-center gap-2">
                    <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", logoBgClass)}>
                        <LogoIcon className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-lg font-bold text-white tracking-tight">
                        {t("common.appName")}
                        <span className={accent.accentText}>.{roleLabel}</span>
                    </span>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
                {items.map(item => {
                    const isActive = pathname === item.href
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center w-full p-3 rounded-xl transition-all duration-200 group relative",
                                isActive
                                    ? cn(accent.active, accent.activeText)
                                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                            )}
                        >
                            {isActive && (
                                <div
                                    className={cn(
                                        "absolute top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full",
                                        accent.bar,
                                        direction === "rtl" ? "right-0 rounded-l-full rounded-r-none" : "left-0"
                                    )}
                                />
                            )}
                            <item.icon
                                className={cn(
                                    "w-5 h-5 me-3 transition-colors",
                                    isActive ? accent.activeIcon : "text-gray-500 group-hover:text-white"
                                )}
                            />
                            <span className="font-medium text-sm">{item.label}</span>
                        </Link>
                    )
                })}
                <LanguageSwitcher variant="full" className="text-gray-400 hover:bg-white/5 hover:text-white" />
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-white/5 space-y-3">
                <button
                    onClick={handleLogout}
                    className="flex items-center w-full p-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors group"
                >
                    <LogOut className="w-5 h-5 me-3 text-red-500" />
                    <span className="font-medium text-sm">{t("common.logout")}</span>
                </button>
            </div>
        </aside>
    )
}
