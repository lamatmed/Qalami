'use client'

import { Settings, User, LogOut, HelpCircle, Bell, Shield, FileText, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useStudent } from '@/context/student-context'
import { useLanguage } from '@/i18n'

export function StudentMore() {
    const router = useRouter()
    const { student, loading } = useStudent()
    const { t } = useLanguage()

    const handleLogout = async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        sessionStorage.removeItem('superAdminViewingAs')
        router.push('/login')
    }

    const menuItems = [
        { icon: User, label: t('common.myProfile'), href: '#', color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
        { icon: BookOpen, label: t('common.homework'), href: '/student/homework', color: 'text-purple-500', bg: 'bg-purple-500/10' },
        { icon: Settings, label: t('common.settings'), href: '#', color: 'text-gray-400', bg: 'bg-gray-500/10' },
        { icon: Bell, label: t('common.notifications'), href: '#', color: 'text-amber-500', bg: 'bg-amber-500/10' },
        { icon: Shield, label: t('common.privacy'), href: '#', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        { icon: HelpCircle, label: t('common.helpSupport'), href: '#', color: 'text-blue-500', bg: 'bg-blue-500/10' },
        { icon: FileText, label: t('common.termsOfUse'), href: '#', color: 'text-purple-500', bg: 'bg-purple-500/10' },
    ]

    // Get initials from name
    const initials = student?.fullName
        ?.split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'EL'

    return (
        <div className="max-w-md mx-auto lg:max-w-3xl lg:ms-12 lg:me-auto pb-24 space-y-8 p-4">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Avatar className="h-12 w-12 border border-border">
                    <AvatarImage src={student?.avatar} />
                    <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div>
                    <h1 className="font-bold text-xl">{loading ? t('common.loading') : student?.fullName || t('common.student')}</h1>
                    <p className="text-xs text-muted-foreground">{student?.className || t('common.classes')} • {student?.school || ''}</p>
                </div>
            </div>

            {/* Menu Grid */}
            <div className="grid grid-cols-2 gap-3">
                {menuItems.map((item, i) => (
                    <Button key={i} variant="outline" className="h-24 flex-col items-center justify-center gap-2 rounded-2xl border-white/5 bg-card/30 hover:bg-card hover:border-white/10 group">
                        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center transition-colors", item.bg)}>
                            <item.icon className={cn("w-5 h-5", item.color)} />
                        </div>
                        <span className="font-medium text-sm text-gray-200">{item.label}</span>
                    </Button>
                ))}
            </div>

            {/* Logout */}
            <Button onClick={handleLogout} variant="ghost" className="w-full h-14 rounded-2xl text-red-500 hover:bg-red-500/10 hover:text-red-400 gap-2 font-bold mt-8 border border-red-500/10">
                <LogOut className="w-5 h-5" />
                {t('common.logout')}
            </Button>

            <div className="text-center">
                <p className="text-[10px] text-muted-foreground">Version 2.4.0 (Build 20240501)</p>
            </div>
        </div>
    )
}
