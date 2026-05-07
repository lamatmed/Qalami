'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

import {
    LayoutDashboard,
    Users,
    GraduationCap,
    BookOpen,
    BookMarked,
    Settings,
    FileText,
    DollarSign,
    ClipboardList,
    LogOut,
    Wallet,
    Clock,
    UserCheck,
    BarChart3,
    UserPlus,
    CalendarRange,
    AlertTriangle,
    CreditCard,
    ScrollText,
    ClipboardCheck,
    Bell,
    ChevronUp,
    ShieldCheck,
    ChevronDown,
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useLanguage } from '@/i18n'
import { LanguageSwitcher } from '@/components/shared/language-switcher'
import { getMySchoolContext } from '@/app/admin/actions'

// ─── Types ───────────────────────────────────────────────────────────────────

interface SidebarItem {
    icon: React.ElementType
    label: string
    href: string
    badge?: number
}

interface SidebarGroup {
    id: string
    label: string
    items: SidebarItem[]
}


interface UserInfo {
    name: string
    role: string
    initials: string
    avatar: string | null
}

// ─── Flat list (kept for mobile nav compatibility) ────────────────────────────

export const sidebarItems = [
    { icon: LayoutDashboard, label: 'Tableau de bord', href: '/admin' },
    { icon: BarChart3, label: 'Analytics', href: '/admin/analytics' },
    { icon: Users, label: 'Élèves', href: '/admin/students' },
    { icon: UserCheck, label: 'Parents', href: '/admin/parents' },
    { icon: BookOpen, label: 'Enseignants', href: '/admin/teachers' },
    { icon: UserPlus, label: 'Invitations', href: '/admin/invitations' },
    { icon: GraduationCap, label: 'Classes', href: '/admin/classes' },
    { icon: BookMarked, label: 'Matières', href: '/admin/subjects' },
    { icon: ClipboardList, label: 'Affectations', href: '/admin/assignments' },
    { icon: Clock, label: 'Emploi du temps', href: '/admin/schedule' },
    { icon: CalendarRange, label: 'Trimestres', href: '/admin/terms' },
    { icon: DollarSign, label: 'Comptabilité', href: '/admin/finance' },
    { icon: CreditCard, label: 'Scolarité & Paiements', href: '/admin/finance/tuition' },
    { icon: Wallet, label: 'Gestion Paie', href: '/admin/finance/payroll' },
    { icon: FileText, label: 'Archives', href: '/admin/documents' },
    { icon: Settings, label: 'Paramètres', href: '/admin/settings' },
]

// ─── Sidebar Component ────────────────────────────────────────────────────────

export function AdminSidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const { t, direction } = useLanguage()

    const [currentYear, setCurrentYear] = useState<string | null>(null)
    const [currentTerm, setCurrentTerm] = useState<string | null>(null)
    const [unreadNotifications, setUnreadNotifications] = useState(0)
    const [pendingInvitations, setPendingInvitations] = useState(0)
    const [unassignedStudents, setUnassignedStudents] = useState(0)
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [userMenuOpen, setUserMenuOpen] = useState(false)
    const [staffPermissions, setStaffPermissions] = useState<string[] | null>(null)
    const [schoolName, setSchoolName] = useState<string | null>(null)
    const [openGroups, setOpenGroups] = useState<string[]>([])



    useEffect(() => {
        async function fetchSidebarData() {
            const supabase = createClient()
            const ctx = await getMySchoolContext()
            if (!ctx) return

            const profile = {
                school_id: ctx.school_id,
                full_name: ctx.full_name,
                role: ctx.role,
                avatar_url: ctx.avatar_url,
            }

            // Set user info
            const name = profile.full_name || 'Admin'
            setUserInfo({
                name,
                role: profile.role || 'admin',
                initials: name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2),
                avatar: profile.avatar_url || null,
            })

            // Fetch permissions for school_staff
            if ((profile as any).role === 'school_staff') {
                const { data: permsData } = await supabase
                    .from('staff_permissions')
                    .select('permissions')
                    .eq('user_id', ctx.user_id)
                    .single()
                setStaffPermissions(permsData?.permissions || [])
            }

            const [
                { data: yearData },
                { data: termData },
                { count: notifCount },
                { count: inviteCount },
                { data: allStudents },
                { data: enrolled },
                { data: schoolData },
            ] = await Promise.all([
                supabase.from('academic_years').select('name').eq('school_id', profile.school_id).eq('is_current', true).single(),
                supabase.from('terms').select('name').eq('school_id', profile.school_id).eq('is_current', true).single(),
                supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', ctx.user_id).eq('is_read', false),
                supabase.from('invitations').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id).eq('status', 'pending'),
                supabase.from('profiles').select('id').eq('school_id', profile.school_id).eq('role', 'student').eq('status', 'active'),
                supabase.from('enrollments').select('student_id').eq('school_id', profile.school_id).eq('status', 'active'),
                supabase.from('school_settings').select('name').eq('school_id', profile.school_id).single(),
            ])

            setCurrentYear(yearData?.name ?? null)
            setCurrentTerm(termData?.name ?? null)
            setUnreadNotifications(notifCount ?? 0)
            setPendingInvitations(inviteCount ?? 0)

            // school_settings.name first, fallback to schools.name
            const settingsName = (schoolData as any)?.name ?? null
            if (settingsName) {
                setSchoolName(settingsName)
            } else {
                const { data: schoolRow } = await supabase
                    .from('schools')
                    .select('name')
                    .eq('id', profile.school_id)
                    .single()
                setSchoolName((schoolRow as any)?.name ?? null)
            }

            const enrolledSet = new Set((enrolled || []).map((e: any) => e.student_id))
            const unassigned = (allStudents || []).filter((s: any) => !enrolledSet.has(s.id)).length
            setUnassignedStudents(unassigned)
        }

        fetchSidebarData()
    }, [])

    // Permission → hrefs mapping for school_staff filtering
    const PERM_HREFS: Record<string, string[]> = {
        students:   ['/admin/students'],
        parents:    ['/admin/parents'],
        teachers:   ['/admin/teachers'],
        classes:    ['/admin/classes', '/admin/subjects', '/admin/assignments'],
        schedule:   ['/admin/schedule', '/admin/terms'],
        attendance: ['/admin/attendance'],
        reports:    ['/admin/reports'],
        finance:    ['/admin/finance', '/admin/finance/tuition', '/admin/finance/payroll'],
        settings:   ['/admin/settings', '/admin/documents'],
        users:      ['/admin/users'],
    }

    const isStaff = userInfo?.role === 'school_staff'

    const canSeeHref = (href: string) => {
        if (!isStaff || staffPermissions === null) return true
        if (href === '/admin') return true // dashboard always visible
        return Object.entries(PERM_HREFS).some(
            ([perm, hrefs]) => staffPermissions.includes(perm) && hrefs.includes(href)
        )
    }

    const allGroups: SidebarGroup[] = [
        {
            id: 'general',
            label: t('admin.sidebar.general'),
            items: [
                { icon: LayoutDashboard, label: t('admin.sidebar.dashboard'), href: '/admin' },
                { icon: BarChart3, label: t('admin.sidebar.analytics'), href: '/admin/analytics' },
            ],
        },
        {
            id: 'community',
            label: t('admin.sidebar.community'),
            items: [
                { icon: Users, label: t('admin.sidebar.students'), href: '/admin/students', badge: unassignedStudents },
                { icon: UserCheck, label: t('admin.sidebar.parents'), href: '/admin/parents' },
                { icon: BookOpen, label: t('admin.sidebar.teachers'), href: '/admin/teachers' },
                { icon: UserPlus, label: t('admin.sidebar.invitations'), href: '/admin/invitations', badge: pendingInvitations },
            ],
        },
        {
            id: 'pedagogy',
            label: t('admin.sidebar.pedagogy'),
            items: [
                { icon: GraduationCap, label: t('admin.sidebar.classes'), href: '/admin/classes' },
                { icon: BookMarked, label: t('admin.sidebar.subjects'), href: '/admin/subjects' },
                { icon: ClipboardList, label: t('admin.sidebar.assignments'), href: '/admin/assignments' },
                { icon: Clock, label: t('admin.sidebar.schedule'), href: '/admin/schedule' },
                { icon: CalendarRange, label: t('admin.sidebar.terms'), href: '/admin/terms' },
                { icon: ClipboardCheck, label: t('admin.sidebar.attendance'), href: '/admin/attendance' },
                { icon: ScrollText, label: t('admin.sidebar.reports'), href: '/admin/reports' },
            ],
        },

        {
            id: 'finance',
            label: t('admin.sidebar.finance'),
            items: [
                { icon: DollarSign, label: t('admin.sidebar.accounting'), href: '/admin/finance' },
                { icon: CreditCard, label: t('admin.sidebar.tuition'), href: '/admin/finance/tuition' },
                { icon: Wallet, label: t('admin.sidebar.payroll'), href: '/admin/finance/payroll' },
            ],
        },
        {
            id: 'system',
            label: t('admin.sidebar.system'),
            items: [
                { icon: ShieldCheck, label: t('admin.sidebar.users'), href: '/admin/users' },
                { icon: FileText, label: t('admin.sidebar.archives'), href: '/admin/documents' },
                { icon: Settings, label: t('admin.sidebar.settings'), href: '/admin/settings' },
            ],
        },


    ]

    // Filter groups for school_staff based on permissions
    const groups = allGroups
        .map(group => ({ ...group, items: group.items.filter(item => canSeeHref(item.href)) }))
        .filter(group => group.items.length > 0)

    // Initialize all groups as open on first load
    useEffect(() => {
        if (groups.length > 0 && openGroups.length === 0) {
            setOpenGroups(groups.map(g => g.id))
        }
    }, [groups, openGroups.length])

    const toggleGroup = (id: string) => {
        setOpenGroups(prev => 
            prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
        )
    }



    const handleLogout = async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        sessionStorage.removeItem('superAdminViewingAs')
        router.push('/login')
    }

    return (
        <aside className={cn(
            "hidden lg:flex flex-col w-60 h-screen sticky top-0 bg-background z-30",
            direction === 'rtl' ? 'border-l border-border' : 'border-r border-border'
        )}>

            {/* ── Logo ──────────────────────────────────────────────────────── */}
            <div className="px-4 pt-5 pb-3 space-y-3">
                {/* App identity */}
                <Link href="/admin" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0 shadow-sm">
                        <span className="font-black text-[16px] text-white leading-none">Q</span>
                    </div>
                    <div className="min-w-0">
                        <p className="font-bold text-[15px] text-foreground leading-none tracking-tight">{t('common.appName')}</p>
                        {schoolName && (
                            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest font-medium mt-0.5 truncate">
                                {schoolName}
                            </p>
                        )}
                    </div>
                </Link>


                {/* Year / term pill */}
                <Link
                    href="/admin/terms"
                    className={cn(
                        "flex items-center gap-2 w-full px-3 py-2 rounded-xl text-[12px] font-medium transition-colors border",
                        currentYear
                            ? "bg-muted/60 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                            : "bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100"
                    )}
                >
                    {currentYear ? (
                        <>
                            <CalendarRange className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                            <span className="truncate flex-1">{currentYear}{currentTerm ? ` · ${currentTerm}` : ''}</span>
                            <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground/40" />
                        </>
                    ) : (
                        <>
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>{t('admin.sidebar.noCurrentYear')}</span>
                        </>
                    )}
                </Link>

            </div>

            {/* ── Navigation ────────────────────────────────────────────────── */}
            <nav className="flex-1 overflow-y-auto py-3 px-3 flex flex-col scrollbar-hide">
                <div className="space-y-4">
                    {groups.filter(g => g.id !== 'system').map((group) => {
                        const isOpen = openGroups.includes(group.id)
                        return (
                            <div key={group.id} className="space-y-1">
                                <button
                                    onClick={() => toggleGroup(group.id)}
                                    className="w-full flex items-center justify-between px-2 mb-1 text-[11px] font-semibold text-muted-foreground/40 hover:text-muted-foreground transition-colors uppercase tracking-widest group/label"
                                >

                                    <span>{group.label}</span>
                                    <ChevronDown className={cn(
                                        "h-3 w-3 transition-transform duration-200",
                                        !isOpen && "-rotate-90"
                                    )} />
                                </button>

                                <AnimatePresence initial={false}>
                                    {isOpen && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3, ease: "easeInOut" }}
                                            className="overflow-hidden space-y-0.5"
                                        >
                                            {group.items.map((item) => {
                                                const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
                                                const isActionBadge = item.href === '/admin/students' || item.href === '/admin/invitations'
                                                return (
                                                    <Link
                                                        key={item.href}
                                                        href={item.href}
                                                        className={cn(
                                                            "flex items-center justify-between px-3 py-2.5 rounded-xl text-[14px] transition-colors",
                                                            isActive
                                                                ? "bg-emerald-50 text-emerald-700 font-bold"
                                                                : "text-foreground/70 hover:text-foreground hover:bg-muted/60 font-normal"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <item.icon className={cn(
                                                                "h-[18px] w-[18px] shrink-0",
                                                                isActive ? "text-emerald-600" : "text-foreground/40"
                                                            )} />
                                                            <span className="truncate">{item.label}</span>
                                                        </div>
                                                        {item.badge != null && item.badge > 0 && (
                                                            isActionBadge ? (
                                                                <span className="ml-2 min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 bg-emerald-500 text-white">
                                                                    {item.badge > 99 ? '99+' : item.badge}
                                                                </span>
                                                            ) : (
                                                                <span className="ml-2 min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-semibold flex items-center justify-center shrink-0 bg-muted text-muted-foreground">
                                                                    {item.badge > 99 ? '99+' : item.badge}
                                                                </span>
                                                            )
                                                        )}
                                                    </Link>
                                                )
                                            })}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )
                    })}
                </div>


                <div className="mt-auto pt-4 space-y-4">
                    {groups.filter(g => g.id === 'system').map((group) => {
                        const isOpen = openGroups.includes(group.id)
                        return (
                            <div key={group.id} className="space-y-1">
                                <button
                                    onClick={() => toggleGroup(group.id)}
                                    className="w-full flex items-center justify-between px-2 mb-1 text-[11px] font-semibold text-muted-foreground/40 hover:text-muted-foreground transition-colors uppercase tracking-widest"
                                >

                                    <span>{group.label}</span>
                                    <ChevronDown className={cn(
                                        "h-3 w-3 transition-transform duration-200",
                                        !isOpen && "-rotate-90"
                                    )} />
                                </button>
                                
                                <AnimatePresence initial={false}>
                                    {isOpen && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3, ease: "easeInOut" }}
                                            className="overflow-hidden space-y-0.5"
                                        >
                                            {group.items.map((item) => {
                                                const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
                                                return (
                                                    <Link
                                                        key={item.href}
                                                        href={item.href}
                                                        className={cn(
                                                            "flex items-center justify-between px-3 py-2.5 rounded-xl text-[14px] transition-colors",
                                                            isActive
                                                                ? "bg-emerald-50 text-emerald-700 font-bold"
                                                                : "text-foreground/70 hover:text-foreground hover:bg-muted/60 font-normal"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <item.icon className={cn(
                                                                "h-[18px] w-[18px] shrink-0",
                                                                isActive ? "text-emerald-600" : "text-foreground/40"
                                                            )} />
                                                            <span className="truncate">{item.label}</span>
                                                        </div>
                                                    </Link>
                                                )
                                            })}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )
                    })}
                    <div className="pt-1 pb-2">
                        <LanguageSwitcher variant="full" />
                    </div>
                </div>

            </nav>


            {/* ── User footer ───────────────────────────────────────────────── */}
            <div className="border-t border-border p-3 space-y-1">
                {/* User row — click to toggle menu */}
                <button
                    onClick={() => setUserMenuOpen(o => !o)}
                    className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg hover:bg-muted/60 transition-colors group"
                >
                    {/* Avatar */}
                    <div className="w-7 h-7 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0 overflow-hidden">
                        {userInfo?.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={userInfo.avatar} alt={userInfo.name} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-[10px] font-bold text-muted-foreground">
                                {userInfo?.initials ?? '?'}
                            </span>
                        )}
                    </div>

                    {/* Name + role */}
                    <div className="flex-1 text-left min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate leading-tight">
                            {userInfo?.name ?? '—'}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 leading-tight capitalize">
                            {userInfo?.role === 'super_admin' ? t('common.superAdmin') : userInfo?.role === 'school_staff' ? 'Staff' : t('common.admin')}
                        </p>

                    </div>

                    {/* Bell + chevron */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        <span className="relative p-1 rounded-md">
                            <Bell className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground" />
                            {unreadNotifications > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 text-[8px] font-black text-white flex items-center justify-center">
                                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                                </span>
                            )}
                        </span>
                        <ChevronUp className={cn(
                            'w-3.5 h-3.5 text-muted-foreground/40 transition-transform',
                            !userMenuOpen && 'rotate-180'
                        )} />
                    </div>
                </button>

                {/* Expanded: logout */}
                {userMenuOpen && (
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>{t('admin.sidebar.logout')}</span>
                    </button>
                )}
            </div>
        </aside>
    )
}
