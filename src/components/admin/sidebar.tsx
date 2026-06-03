/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence, Reorder } from 'framer-motion'


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
    GripVertical,
    ChevronLeft,
    ChevronRight,
    Megaphone,
    CalendarDays,
    Activity,
    Inbox,
    ArrowLeftRight,
} from 'lucide-react'

import { createClient } from '@/utils/supabase/client'
import { useLanguage } from '@/i18n'
import { LanguageSwitcher } from '@/components/shared/language-switcher'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { getMySchoolContext, getAdminUnreadNotificationsCount } from '@/app/admin/actions'
import { getPendingRequestsCount } from '@/app/admin/requests/actions'


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
    { icon: LayoutDashboard, label: 'admin.sidebar.dashboard', href: '/admin' },
    { icon: BarChart3, label: 'admin.sidebar.analytics', href: '/admin/analytics' },
    { icon: Users, label: 'admin.sidebar.students', href: '/admin/students' },
    { icon: ArrowLeftRight, label: 'admin.sidebar.transferredStudents', href: '/admin/students/transferred' },
    { icon: UserCheck, label: 'admin.sidebar.parents', href: '/admin/parents' },
    { icon: BookOpen, label: 'admin.sidebar.teachers', href: '/admin/teachers' },
    { icon: Megaphone, label: 'admin.sidebar.announcements', href: '/admin/announcements' },
    { icon: CalendarDays, label: 'admin.sidebar.events', href: '/admin/events' },
    { icon: GraduationCap, label: 'admin.sidebar.classes', href: '/admin/classes' },
    { icon: BookMarked, label: 'admin.sidebar.subjects', href: '/admin/subjects' },
    { icon: ClipboardList, label: 'admin.sidebar.assignments', href: '/admin/assignments' },
    { icon: Clock, label: 'admin.sidebar.schedule', href: '/admin/schedule' },
    { icon: CalendarRange, label: 'admin.sidebar.terms', href: '/admin/terms' },
    { icon: ClipboardCheck, label: 'admin.sidebar.attendance', href: '/admin/attendance' },
    { icon: ScrollText, label: 'admin.sidebar.reports', href: '/admin/reports' },
    { icon: DollarSign, label: 'admin.sidebar.accounting', href: '/admin/finance' },
    { icon: CreditCard, label: 'admin.sidebar.tuition', href: '/admin/finance/tuition' },
    { icon: Wallet, label: 'admin.sidebar.payroll', href: '/admin/finance/payroll' },
    { icon: ShieldCheck, label: 'admin.sidebar.users', href: '/admin/users' },
    { icon: FileText, label: 'admin.sidebar.archives', href: '/admin/documents' },
    { icon: Settings, label: 'admin.sidebar.settings', href: '/admin/settings' },
    { icon: Activity, label: 'admin.sidebar.activity', href: '/admin/activity' },
]

// ─── Sidebar Component ────────────────────────────────────────────────────────

export function AdminSidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const { t, direction } = useLanguage()

    const [currentYear, setCurrentYear] = useState<string | null>(null)
    const [currentTerm, setCurrentTerm] = useState<string | null>(null)
    const [unreadNotifications, setUnreadNotifications] = useState(0)
    const [unassignedStudents, setUnassignedStudents] = useState(0)
    const [pendingRequests, setPendingRequests] = useState(0)
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [userMenuOpen, setUserMenuOpen] = useState(false)
    const [staffPermissions, setStaffPermissions] = useState<string[] | null>(null)
    const [schoolName, setSchoolName] = useState<string | null>(null)
    const [schoolLogo, setSchoolLogo] = useState<string | null>(null)
    const [openGroups, setOpenGroups] = useState<string[]>([])
    const [groupOrder, setGroupOrder] = useState<string[]>(['general', 'community', 'pedagogy', 'finance'])

    const [isCollapsed, setIsCollapsed] = useState(false)
    const [mounted, setMounted] = useState(false)

    // Hydrate collapsed state
    useEffect(() => {
        const saved = localStorage.getItem('qalami_admin_sidebar_collapsed')
        if (saved === 'true') {
            setIsCollapsed(true)
        }
        setMounted(true)
    }, [])

    const toggleCollapse = () => {
        const nextState = !isCollapsed
        setIsCollapsed(nextState)
        localStorage.setItem('qalami_admin_sidebar_collapsed', String(nextState))
    }

    // Load saved group order
    useEffect(() => {
        const saved = localStorage.getItem('qalami-admin-sidebar-order')
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setGroupOrder(parsed)
                }
            } catch (e) {
                console.error('Failed to parse sidebar order', e)
            }
        }
    }, [])

    // Persist group order
    useEffect(() => {
        if (groupOrder.length > 0) {
            localStorage.setItem('qalami-admin-sidebar-order', JSON.stringify(groupOrder))
        }
    }, [groupOrder])




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
                notifCount,
                { data: allStudents },
                { data: enrolled },
                { data: schoolData },
                pendingCount,
            ] = await Promise.all([
                supabase.from('academic_years').select('name').eq('school_id', profile.school_id).eq('is_current', true).single(),
                supabase.from('terms').select('name').eq('school_id', profile.school_id).eq('is_current', true).single(),
                getAdminUnreadNotificationsCount(profile.school_id),
                supabase.from('profiles').select('id').eq('school_id', profile.school_id).eq('role', 'student').eq('status', 'active'),
                supabase.from('enrollments').select('student_id').eq('school_id', profile.school_id).eq('status', 'active'),
                supabase.from('school_settings').select('name, logo_url').eq('school_id', profile.school_id).single(),
                getPendingRequestsCount(),
            ])

            setCurrentYear(yearData?.name ?? null)
            setCurrentTerm(termData?.name ?? null)
            setUnreadNotifications(notifCount ?? 0)
            setPendingRequests(pendingCount ?? 0)

            // school_settings.name first, fallback to schools.name
            const settingsName = (schoolData as any)?.name ?? null
            setSchoolLogo((schoolData as any)?.logo_url ?? null)
            
            if (settingsName) {
                setSchoolName(settingsName)
            } else {
                const { data: schoolRow } = await supabase
                    .from('schools')
                    .select('name, logo_url')
                    .eq('id', profile.school_id)
                    .single()
                setSchoolName((schoolRow as any)?.name ?? null)
                if (!(schoolData as any)?.logo_url) {
                    setSchoolLogo((schoolRow as any)?.logo_url ?? null)
                }
            }

            const enrolledSet = new Set((enrolled || []).map((e: any) => e.student_id))
            const unassigned = (allStudents || []).filter((s: any) => !enrolledSet.has(s.id)).length
            setUnassignedStudents(unassigned)
        }

        fetchSidebarData()
    }, [])

    // Permission → hrefs mapping for school_staff filtering
    const PERM_HREFS: Record<string, string[]> = {
        students:      ['/admin/students', '/admin/students/transferred'],
        parents:       ['/admin/parents'],
        teachers:      ['/admin/teachers'],
        classes:       ['/admin/classes', '/admin/subjects', '/admin/assignments'],
        schedule:      ['/admin/schedule', '/admin/terms'],
        attendance:    ['/admin/attendance'],
        reports:       ['/admin/reports'],
        finance:       ['/admin/finance', '/admin/finance/tuition', '/admin/finance/payroll'],
        settings:      ['/admin/settings', '/admin/documents'],
        users:         ['/admin/users'],
        announcements: ['/admin/announcements', '/admin/events'],
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
                { icon: ArrowLeftRight, label: t('admin.sidebar.transferredStudents'), href: '/admin/students/transferred' },
                { icon: UserCheck, label: t('admin.sidebar.parents'), href: '/admin/parents' },
                { icon: BookOpen, label: t('admin.sidebar.teachers'), href: '/admin/teachers' },
                { icon: Inbox, label: t('admin.sidebar.requests'), href: '/admin/requests', badge: pendingRequests },
                { icon: Megaphone, label: t('admin.sidebar.announcements'), href: '/admin/announcements' },
                { icon: CalendarDays, label: t('admin.sidebar.events'), href: '/admin/events' },
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
                ...(!isStaff ? [{ icon: Activity, label: t('admin.sidebar.activity'), href: '/admin/activity' }] : []),
            ],
        },


    ]

    // Filter and order groups
    const groups = allGroups
        .map(group => ({ ...group, items: group.items.filter(item => canSeeHref(item.href)) }))
        .filter(group => group.items.length > 0)

    const orderedGroups = [
        ...groupOrder
            .map(id => groups.find(g => g.id === id))
            .filter((g): g is SidebarGroup => !!g),
        ...groups.filter(g => !groupOrder.includes(g.id) && g.id !== 'system')
    ]

    const systemGroup = groups.find(g => g.id === 'system')




    const toggleGroup = (id: string) => {
        setOpenGroups(prev => 
            prev.includes(id) ? [] : [id]
        )
    }



    const handleLogout = async () => {
        const supabase = createClient()
        await supabase.auth.signOut({ scope: 'local' })
        sessionStorage.removeItem('superAdminViewingAs')
        router.push('/login')
    }

    return (
        <aside className={cn(
            "hidden lg:flex flex-col h-screen sticky top-0 bg-background z-30 transition-all duration-300 ease-in-out relative select-none",
            isCollapsed ? "w-20" : "w-60",
            direction === 'rtl' ? 'border-l border-border' : 'border-r border-border'
        )}>
            {/* Collapse Toggle floating knob */}
            <button
                onClick={toggleCollapse}
                title={isCollapsed ? "Agrandir" : "Réduire"}
                className={cn(
                    "hidden lg:flex absolute top-16 w-6 h-6 bg-background dark:bg-card border border-border rounded-full items-center justify-center shadow-md text-muted-foreground hover:text-emerald-600 hover:border-emerald-300 dark:hover:text-emerald-400 transition-all active:scale-90 z-50",
                    direction === 'rtl' ? "-left-3" : "-right-3"
                )}
            >
                {isCollapsed 
                    ? (direction === 'rtl' ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />)
                    : (direction === 'rtl' ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />)
                }
            </button>

            {/* ── Logo ──────────────────────────────────────────────────────── */}
            <div className={cn("px-4 pt-5 pb-3 space-y-3", isCollapsed ? "flex flex-col items-center px-2" : "")}>
                {/* App identity */}
                <div className={cn("flex items-center", isCollapsed ? "justify-center w-full" : "justify-between")}>
                    <Link href="/admin" className={cn("flex items-center hover:opacity-80 transition-opacity", isCollapsed ? "justify-center" : "gap-3")}>
                        <div className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm overflow-hidden border border-border/50",
                            !schoolLogo && "bg-emerald-600"
                        )}>
                            {schoolLogo ? (
                                <img src={schoolLogo} alt="Logo" className="w-full h-full object-cover" />
                            ) : (
                                <span className="font-black text-[16px] text-white leading-none">Q</span>
                            )}
                        </div>
                        {!isCollapsed && (
                            <div className="min-w-0 animate-in fade-in slide-in-from-left-2 duration-300">
                                <p className="font-bold text-[15px] text-foreground leading-tight tracking-tight truncate">
                                    {schoolName || t('common.appName')}
                                </p>
                                {schoolName && (
                                    <p className="text-[10px] text-muted-foreground/60 font-medium mt-0.5 truncate flex items-center gap-1">
                                        <span className="w-1 h-1 rounded-full bg-emerald-500/50"></span>
                                        {t('common.appName')} Portal
                                    </p>
                                )}
                            </div>
                        )}
                    </Link>
                   
                </div>


                {/* Year / term pill */}
                {!isCollapsed && (
                    <Link
                        href="/admin/terms"
                        className={cn(
                            "flex items-center gap-2 w-full px-3 py-2 rounded-xl text-[12px] font-medium transition-colors border animate-in fade-in duration-300",
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
                )}

            </div>

            {/* ── Navigation ────────────────────────────────────────────────── */}
            <nav className={cn("flex-1 overflow-y-auto py-3 flex flex-col scrollbar-hide", isCollapsed ? "px-2" : "px-3")}>

                <Reorder.Group 
                    axis="y" 
                    values={groupOrder} 
                    onReorder={setGroupOrder}
                    className="space-y-4"
                >
                    {orderedGroups.map((group) => {
                        const isOpen = openGroups.includes(group.id)
                        return (
                            <Reorder.Item 
                                key={group.id} 
                                value={group.id}
                                className="space-y-1"
                            >
                                {!isCollapsed && (
                                    <div className="flex items-center group/label animate-in fade-in duration-300">
                                        <div className="w-4 flex items-center justify-center opacity-0 group-hover/label:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
                                            <GripVertical className="h-3 w-3 text-muted-foreground/30" />
                                        </div>
                                        <button
                                            onClick={() => toggleGroup(group.id)}
                                            className="flex-1 flex items-center justify-between py-1 pr-2 text-[11px] font-semibold text-muted-foreground/40 hover:text-muted-foreground transition-colors uppercase tracking-widest"
                                        >
                                            <span>{group.label}</span>
                                            <ChevronDown className={cn(
                                                "h-3 w-3 transition-transform duration-200",
                                                !isOpen && "-rotate-90"
                                            )} />
                                        </button>
                                    </div>
                                )}




                                <AnimatePresence initial={false}>
                                    {(isOpen || isCollapsed) && (
                                        <motion.div
                                            initial={isCollapsed ? false : { height: 0, opacity: 0 }}
                                            animate={isCollapsed ? false : { height: "auto", opacity: 1 }}
                                            exit={isCollapsed ? false : { height: 0, opacity: 0 }}
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
                                                        title={isCollapsed ? item.label : undefined}
                                                        className={cn(
                                                            "flex items-center rounded-xl text-[14px] transition-all duration-200 group/item relative",
                                                            isCollapsed ? "justify-center h-11 w-11 mx-auto" : "justify-between px-3 py-2.5",
                                                            isActive
                                                                ? "bg-emerald-50 text-emerald-700 font-bold shadow-[inset_0_0_0_1px_rgba(16,185,129,0.1)]"
                                                                : "text-foreground/70 hover:text-foreground hover:bg-muted/60 font-normal"
                                                        )}
                                                    >
                                                        <div className={cn("flex items-center min-w-0", isCollapsed ? "justify-center" : "gap-3")}>
                                                            <item.icon className={cn(
                                                                "h-[18px] w-[18px] shrink-0 transition-colors",
                                                                isActive ? "text-emerald-600" : "text-foreground/40 group-hover/item:text-emerald-600"
                                                            )} />
                                                            {!isCollapsed && <span className="truncate animate-in fade-in duration-300">{item.label}</span>}
                                                        </div>
                                                        {!isCollapsed && item.badge != null && item.badge > 0 && (
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
                                                        {isCollapsed && item.badge != null && item.badge > 0 && (
                                                            <span className="absolute top-1 right-1 flex h-2 w-2">
                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                                            </span>
                                                        )}
                                                    </Link>
                                                )
                                            })}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </Reorder.Item>
                        )
                    })}
                </Reorder.Group>

                <div className={cn("mt-auto pt-4 space-y-4", isCollapsed ? "w-full flex flex-col items-center" : "")}>
                    {systemGroup && (
                        <div key={systemGroup.id} className="space-y-1 w-full">
                            {!isCollapsed && (
                                <button
                                    onClick={() => toggleGroup(systemGroup.id)}
                                    className="w-full flex items-center justify-between px-2 mb-1 text-[11px] font-semibold text-muted-foreground/40 hover:text-muted-foreground transition-colors uppercase tracking-widest animate-in fade-in duration-300"
                                >
                                    <span>{systemGroup.label}</span>
                                    <ChevronDown className={cn(
                                        "h-3 w-3 transition-transform duration-200",
                                        !openGroups.includes(systemGroup.id) && "-rotate-90"
                                    )} />
                                </button>
                            )}
                            
                            <AnimatePresence initial={false}>
                                {(openGroups.includes(systemGroup.id) || isCollapsed) && (
                                    <motion.div
                                        initial={isCollapsed ? false : { height: 0, opacity: 0 }}
                                        animate={isCollapsed ? false : { height: "auto", opacity: 1 }}
                                        exit={isCollapsed ? false : { height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3, ease: "easeInOut" }}
                                        className="overflow-hidden space-y-0.5 w-full"
                                    >
                                        {systemGroup.items.map((item) => {
                                            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    title={isCollapsed ? item.label : undefined}
                                                    className={cn(
                                                        "flex items-center rounded-xl text-[14px] transition-all duration-200 group/item relative",
                                                        isCollapsed ? "justify-center h-11 w-11 mx-auto" : "justify-between px-3 py-2.5",
                                                        isActive
                                                            ? "bg-emerald-50 text-emerald-700 font-bold shadow-[inset_0_0_0_1px_rgba(16,185,129,0.1)]"
                                                            : "text-foreground/70 hover:text-foreground hover:bg-muted/60 font-normal"
                                                    )}
                                                >
                                                    <div className={cn("flex items-center min-w-0", isCollapsed ? "justify-center" : "gap-3")}>
                                                        <item.icon className={cn(
                                                            "h-[18px] w-[18px] shrink-0 transition-colors",
                                                            isActive ? "text-emerald-600" : "text-foreground/40 group-hover/item:text-emerald-600"
                                                        )} />
                                                        {!isCollapsed && <span className="truncate animate-in fade-in duration-300">{item.label}</span>}
                                                    </div>
                                                </Link>
                                            )
                                        })}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                    
                    {!isCollapsed ? (
                        <div className="pt-1 pb-2 animate-in fade-in duration-300 space-y-1">
                            <LanguageSwitcher variant="full" />
                            <ThemeToggle variant="full" />
                        </div>
                    ) : (
                        <div className="pb-2 flex flex-col items-center gap-1">
                            <LanguageSwitcher variant="icon" />
                            <ThemeToggle variant="icon" />
                        </div>
                    )}
                </div>


            </nav>


            {/* ── User footer ───────────────────────────────────────────────── */}
            <div className={cn("border-t border-border p-3 space-y-1", isCollapsed ? "flex flex-col items-center" : "")}>
                {/* User row — click to toggle menu */}
                <button
                    onClick={() => setUserMenuOpen(o => !o)}
                    className={cn(
                        "flex items-center rounded-lg hover:bg-muted/60 transition-colors group",
                        isCollapsed ? "justify-center h-10 w-10 p-0" : "gap-2.5 w-full px-2.5 py-2"
                    )}
                    title={isCollapsed ? (userInfo?.name || "Compte") : undefined}
                >
                    {/* Avatar */}
                    <div className="w-7 h-7 rounded-lg bg-white dark:bg-muted border border-border flex items-center justify-center shrink-0 overflow-hidden shadow-sm p-0.5">
                        <img 
                            src={schoolLogo || '/web-app-manifest-192x192.png'} 
                            alt="Logo" 
                            className="w-full h-full object-contain" 
                        />
                    </div>

                    {/* Name + role */}
                    {!isCollapsed && (
                        <>
                            <div className="flex-1 text-left min-w-0 animate-in fade-in duration-300">
                                <p className="text-[13px] font-medium text-foreground truncate leading-tight">
                                    {schoolName || userInfo?.name || '—'}
                                </p>
                                <p className="text-[10px] text-muted-foreground/60 leading-tight capitalize">
                                    {userInfo?.role === 'super_admin' ? t('common.superAdmin') : userInfo?.role === 'school_staff' ? 'Staff' : t('common.admin')}
                                </p>
                            </div>

                            {/* Chevron */}
                            <div className="flex items-center shrink-0">
                                <ChevronUp className={cn(
                                    'w-3.5 h-3.5 text-muted-foreground/40 transition-transform',
                                    !userMenuOpen && 'rotate-180'
                                )} />
                            </div>
                        </>
                    )}
                </button>

                {/* Expanded: logout */}
                {userMenuOpen && (
                    <button
                        onClick={handleLogout}
                        title={isCollapsed ? t('admin.sidebar.logout') : undefined}
                        className={cn(
                            "flex items-center gap-2.5 text-[13px] font-medium text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors rounded-lg",
                            isCollapsed ? "h-10 w-10 justify-center p-0" : "w-full px-3 py-2"
                        )}
                    >
                        <LogOut className="h-3.5 w-3.5 text-red-500" />
                        {!isCollapsed && <span className="animate-in fade-in duration-300">{t('admin.sidebar.logout')}</span>}
                    </button>
                )}
            </div>
        </aside>
    )
}
