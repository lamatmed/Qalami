'use client'

import { MobileNav } from '@/components/layout/mobile-nav'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Calendar, BrainCircuit, BookOpen, User, Settings, HelpCircle, Bell, Shield, FileText } from 'lucide-react'
import { useStudent } from '@/context/student-context'
import { useLanguage } from '@/i18n'

export function StudentMobileNav() {
    const { student } = useStudent()
    const { t } = useLanguage()

    const navItems = [
        { icon: LayoutDashboard, label: t('student.sidebar.dashboard'), href: '/student' },
        { icon: Calendar, label: t('student.sidebar.schedule'), href: '/student/schedule' },
        { icon: BrainCircuit, label: t('student.sidebar.quizzes'), href: '/student/quiz' },
        { icon: BookOpen, label: t('student.sidebar.courses'), href: '/student/courses' },
        // Overflow items start here
        { icon: FileText, label: t('student.sidebar.homework'), href: '/student/homework' },
        { icon: User, label: t('common.profile'), href: '#' },
        { icon: Settings, label: t('common.settings'), href: '#' },
        { icon: Bell, label: t('common.notifications'), href: '#' },
        { icon: Shield, label: t('common.settings'), href: '#' },
        { icon: HelpCircle, label: t('common.info'), href: '#' },
    ]

    const user = {
        name: student?.fullName || t('common.student'),
        role: `${student?.className || t('common.classes')} • ${student?.school || t('common.appName')}`,
        avatar: student?.avatar
    }

    const pathname = usePathname()

    // Hide mobile nav on homework detail pages (e.g. /student/homework/1)
    if (pathname.includes('/student/homework/') && pathname.split('/').length > 3) {
        return null
    }

    return <MobileNav items={navItems} user={user} />
}
