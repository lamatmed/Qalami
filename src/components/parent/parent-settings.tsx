'use client'

import { Bell, Globe, Moon, Info, LogOut, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useParent } from '@/context/parent-context'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useLanguage } from '@/i18n'
import { LanguageSwitcher } from '@/components/shared/language-switcher'
import { ThemeToggle } from '@/components/shared/theme-toggle'

export function ParentSettings() {
    const { selectedChild, loading } = useParent()
    const router = useRouter()
    const { t } = useLanguage()

    const handleLogout = async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        sessionStorage.removeItem('superAdminViewingAs')
        router.push('/login')
    }

    // Show loading state during SSR/initial render
    if (loading) {
        return (
            <div className="max-w-md mx-auto lg:max-w-3xl pb-24 space-y-8 p-4">
                <div className="animate-pulse space-y-4">
                    <div className="h-10 w-48 bg-muted rounded" />
                    <div className="h-64 bg-muted rounded-3xl" />
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-md mx-auto lg:max-w-3xl pb-24 space-y-8 p-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 bg-cyan-500/20 text-cyan-500 border border-cyan-500/30">
                        <AvatarFallback><User className="w-5 h-5" /></AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="font-bold text-lg">{t('common.settings')}</span>
                        <span className="text-xs text-muted-foreground">{selectedChild?.name}</span>
                    </div>
                </div>
            </div>

            {/* Settings Section */}
            <div className="space-y-4">
                <h2 className="text-sm font-bold text-gray-300 px-1">{t('common.profileSettings')}</h2>

                <div className="bg-card border border-border/50 rounded-3xl overflow-hidden p-2 space-y-1">
                    {/* Notifications */}
                    <div className="flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors">
                        <div className="flex items-center gap-4">
                            <Bell className="w-5 h-5 text-gray-400" />
                            <span className="font-medium text-sm">{t('common.notifications')}</span>
                        </div>
                        <Switch id="notif-mode" defaultChecked className="data-[state=checked]:bg-cyan-500" />
                    </div>

                    {/* Language */}
                    <div className="flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors">
                        <div className="flex items-center gap-4">
                            <Globe className="w-5 h-5 text-gray-400" />
                            <span className="font-medium text-sm">{t('common.language')}</span>
                        </div>
                        <LanguageSwitcher variant="compact" />
                    </div>

                    {/* Theme */}
                    <div className="flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors">
                        <div className="flex items-center gap-4">
                            <Moon className="w-5 h-5 text-gray-400" />
                            <span className="font-medium text-sm">{t('common.theme')}</span>
                        </div>
                        <ThemeToggle />
                    </div>

                    {/* About */}
                    <div className="flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors cursor-pointer">
                        <div className="flex items-center gap-4">
                            <Info className="w-5 h-5 text-gray-400" />
                            <span className="font-medium text-sm">{t('common.about')}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">v2.4.0</span>
                    </div>
                </div>

                {/* Logout Button */}
                <Button onClick={handleLogout} variant="outline" className="w-full h-14 rounded-2xl border-red-500/20 text-red-500 hover:bg-red-500/10 hover:text-red-400 mt-6 gap-2 font-bold">
                    <LogOut className="w-5 h-5" />
                    {t('common.logout')}
                </Button>
            </div>
        </div>
    )
}
