'use client'

import { useState, useEffect } from 'react'
import { Users, Search, MoreHorizontal, Eye, Building2, GraduationCap, BookOpen, UserCheck, UserX, Loader2, Shield, Mail, Calendar, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import Link from 'next/link'
import { useLanguage } from '@/i18n'

interface User {
    id: string
    email: string
    full_name: string | null
    role: string
    school_id: string | null
    is_active: boolean
    created_at: string
    school?: {
        id: string
        name: string
    }
}

interface School {
    id: string
    name: string
}

export function UserList() {
    const { t, direction } = useLanguage()
    const [users, setUsers] = useState<User[]>([])
    const [schools, setSchools] = useState<School[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [roleFilter, setRoleFilter] = useState<string>('all')
    const [schoolFilter, setSchoolFilter] = useState<string>('all')
    const [selectedUser, setSelectedUser] = useState<User | null>(null)

    useEffect(() => {
        const fetchData = async () => {
            const supabase = createClient()
            try {
                // Fetch schools first
                const { data: schoolsData, error: schoolsError } = await supabase
                    .from('schools')
                    .select('id, name')
                    .order('name')

                if (schoolsError) {
                    console.error('Error fetching schools:', schoolsError)
                }

                setSchools(schoolsData ?? [])

                // Fetch all users with their school info
                const { data: usersData, error: usersError } = await supabase
                    .from('profiles')
                    .select(`
                        id,
                        email,
                        full_name,
                        role,
                        school_id,
                        created_at
                    `)
                    .order('created_at', { ascending: false })

                if (usersError) {
                    console.error('Error fetching profiles:', usersError)
                }

                if (usersData) {
                    const usersWithSchools = usersData.map(user => ({
                        ...user,
                        is_active: true, // Default to active since column doesn't exist
                        school: schoolsData?.find(s => s.id === user.school_id)
                    }))
                    setUsers(usersWithSchools as User[])
                }
            } catch (error) {
                console.error('Error fetching users:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [])

    const filteredUsers = users.filter(user => {
        const matchesSearch =
            (user.full_name?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
            (user.email?.toLowerCase().includes(search.toLowerCase()) ?? false)
        const matchesRole = roleFilter === 'all' || user.role === roleFilter
        const matchesSchool = schoolFilter === 'all' || user.school_id === schoolFilter
        return matchesSearch && matchesRole && matchesSchool
    })

    const getRoleIcon = (role: string) => {
        switch (role) {
            case 'super_admin': return Shield
            case 'admin': return Building2
            case 'teacher': return BookOpen
            case 'student': return GraduationCap
            case 'parent': return Users
            default: return Users
        }
    }

    const getRoleColor = (role: string) => {
        switch (role) {
            case 'super_admin': return 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20'
            case 'admin': return 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
            case 'teacher': return 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20'
            case 'student': return 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20'
            case 'parent': return 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'
            default: return 'bg-gray-50 text-gray-600 border-gray-100 dark:bg-gray-500/10 dark:text-gray-400 dark:border-gray-500/20'
        }
    }

    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'super_admin': return t('superAdmin.usersList.superAdmins')
            case 'admin': return t('superAdmin.usersList.admins')
            case 'teacher': return t('superAdmin.usersList.teachers')
            case 'student': return t('superAdmin.usersList.students')
            case 'parent': return t('superAdmin.usersList.parents')
            default: return role
        }
    }

    const accessAsUser = (user: User) => {
        if (!user.role || user.role === 'super_admin') {
            return
        }

        sessionStorage.setItem('superAdminViewingAs', JSON.stringify({
            userId: user.id,
            userName: user.full_name,
            userEmail: user.email,
            role: user.role,
            schoolId: user.school_id,
            schoolName: user.school?.name
        }))

        if (user.school_id && user.school) {
            sessionStorage.setItem('superAdminViewingSchool', JSON.stringify({
                id: user.school_id,
                name: user.school.name,
                role: user.role
            }))
        }

        const routes: Record<string, string> = {
            admin: '/admin',
            teacher: '/teacher',
            student: '/student',
            parent: '/parent'
        }

        const route = routes[user.role]
        if (route) {
            window.open(route, '_blank')
        }
    }

    const stats = {
        total: users.length,
        superAdmins: users.filter(u => u.role === 'super_admin').length,
        admins: users.filter(u => u.role === 'admin').length,
        teachers: users.filter(u => u.role === 'teacher').length,
        students: users.filter(u => u.role === 'student').length,
        parents: users.filter(u => u.role === 'parent').length,
    }

    return (
        <div className="space-y-6 pb-12 animate-in fade-in duration-500" dir={direction}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                        {t('superAdmin.usersList.title')}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {t('superAdmin.usersList.count').replace('{count}', stats.total.toString())}
                    </p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                {[
                    { label: t('superAdmin.usersList.total'), value: stats.total, color: 'gray' },
                    { label: t('superAdmin.usersList.superAdmins'), value: stats.superAdmins, color: 'purple' },
                    { label: t('superAdmin.usersList.admins'), value: stats.admins, color: 'emerald' },
                    { label: t('superAdmin.usersList.teachers'), value: stats.teachers, color: 'indigo' },
                    { label: t('superAdmin.usersList.students'), value: stats.students, color: 'blue' },
                    { label: t('superAdmin.usersList.parents'), value: stats.parents, color: 'amber' },
                ].map((stat, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm transition-transform hover:scale-[1.03] duration-300">
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-black tracking-wider">{stat.label}</p>
                        <p className={cn(
                            "text-3xl font-black mt-2",
                            stat.color === 'gray' && "text-gray-900 dark:text-white",
                            stat.color === 'purple' && "text-purple-600 dark:text-purple-400",
                            stat.color === 'emerald' && "text-emerald-600 dark:text-emerald-400",
                            stat.color === 'indigo' && "text-indigo-600 dark:text-indigo-400",
                            stat.color === 'blue' && "text-blue-600 dark:text-blue-400",
                            stat.color === 'amber' && "text-amber-600 dark:text-amber-400"
                        )}>{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className={cn("absolute top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400", direction === 'rtl' ? 'right-4' : 'left-4')} />
                    <Input
                        placeholder={t('superAdmin.usersList.searchPlaceholder')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className={cn("bg-white dark:bg-slate-900 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-400 rounded-2xl h-12 shadow-sm transition-all focus:bg-white focus:ring-2 focus:ring-purple-500/10", direction === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4')}
                    />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-full md:w-48 bg-white dark:bg-slate-900 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-2xl h-12 shadow-sm font-semibold">
                        <SelectValue placeholder={t('superAdmin.usersList.allRoles')} />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-900 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-2xl shadow-xl">
                        <SelectItem value="all" className="font-semibold">{t('superAdmin.usersList.allRoles')}</SelectItem>
                        <SelectItem value="super_admin" className="font-semibold">{t('superAdmin.usersList.superAdmins')}</SelectItem>
                        <SelectItem value="admin" className="font-semibold">{t('superAdmin.usersList.admins')}</SelectItem>
                        <SelectItem value="teacher" className="font-semibold">{t('superAdmin.usersList.teachers')}</SelectItem>
                        <SelectItem value="student" className="font-semibold">{t('superAdmin.usersList.students')}</SelectItem>
                        <SelectItem value="parent" className="font-semibold">{t('superAdmin.usersList.parents')}</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={schoolFilter} onValueChange={setSchoolFilter}>
                    <SelectTrigger className="w-full md:w-64 bg-white dark:bg-slate-900 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-2xl h-12 shadow-sm font-semibold">
                        <SelectValue placeholder={t('superAdmin.usersList.allSchools')} />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-900 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-2xl shadow-xl">
                        <SelectItem value="all" className="font-semibold">{t('superAdmin.usersList.allSchools')}</SelectItem>
                        {schools.map(school => (
                            <SelectItem key={school.id} value={school.id} className="font-semibold">{school.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Users Content */}
            {loading ? (
                <div className="flex items-center justify-center py-24 bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-3xl shadow-sm">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
                    </div>
                </div>
            ) : filteredUsers.length === 0 ? (
                <div className="text-center py-24 bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-3xl shadow-sm text-gray-400">
                    <Users className="w-16 h-16 mx-auto mb-4 opacity-30 text-purple-600" />
                    <p className="font-bold text-gray-500">{search || roleFilter !== 'all' || schoolFilter !== 'all' ? t('superAdmin.usersList.noResults') : t('superAdmin.usersList.noUsers')}</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-3xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-slate-900/50">
                                    <th className={cn("text-xs text-gray-400 uppercase font-bold tracking-wider px-6 py-4.5", direction === 'rtl' ? 'text-right' : 'text-left')}>{t('superAdmin.usersList.thUser')}</th>
                                    <th className={cn("text-xs text-gray-400 uppercase font-bold tracking-wider px-6 py-4.5", direction === 'rtl' ? 'text-right' : 'text-left')}>{t('superAdmin.usersList.thRole')}</th>
                                    <th className={cn("text-xs text-gray-400 uppercase font-bold tracking-wider px-6 py-4.5", direction === 'rtl' ? 'text-right' : 'text-left')}>{t('superAdmin.usersList.thSchool')}</th>
                                    <th className={cn("text-xs text-gray-400 uppercase font-bold tracking-wider px-6 py-4.5", direction === 'rtl' ? 'text-right' : 'text-left')}>{t('superAdmin.usersList.thStatus')}</th>
                                    <th className={cn("text-xs text-gray-400 uppercase font-bold tracking-wider px-6 py-4.5", direction === 'rtl' ? 'text-left' : 'text-right')}>{t('superAdmin.usersList.thActions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                {filteredUsers.map(user => {
                                    const RoleIcon = getRoleIcon(user.role)
                                    const roleClass = getRoleColor(user.role)
                                    return (
                                        <tr key={user.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors duration-200">
                                            <td className="px-6 py-4.5">
                                                <div className="flex items-center gap-4.5">
                                                    <div className={cn(
                                                        "h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 border",
                                                        roleClass.split(' ')[0],
                                                        roleClass.split(' ').find(c => c.startsWith('border-')) || 'border-transparent'
                                                    )}>
                                                        <RoleIcon className={cn("w-5.5 h-5.5", roleClass.split(' ')[1])} />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-900 dark:text-white leading-snug">{user.full_name || t('superAdmin.usersList.unnamed')}</p>
                                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{user.email || `ID: ${user.id.slice(0, 8)}...`}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4.5">
                                                <span className={cn(
                                                    "px-3 py-1 rounded-full text-[10px] font-black uppercase border tracking-wider",
                                                    roleClass
                                                )}>
                                                    {getRoleLabel(user.role)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4.5">
                                                {user.school ? (
                                                    <div className="flex items-center gap-2">
                                                        <Building2 className="w-4 h-4 text-gray-400" />
                                                        <span className="text-gray-700 dark:text-gray-300 text-sm font-semibold">{user.school.name}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400 text-sm">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4.5">
                                                <span className={cn(
                                                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                                                    user.is_active !== false
                                                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                                                        : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                                                )}>
                                                    {user.is_active !== false ? (
                                                        <><UserCheck className="w-3.5 h-3.5" /> {t('superAdmin.usersList.active')}</>
                                                    ) : (
                                                        <><UserX className="w-3.5 h-3.5" /> {t('superAdmin.usersList.inactive')}</>
                                                    )}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4.5 text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-9 w-9 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-xl">
                                                            <MoreHorizontal className="w-4.5 h-4.5" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align={direction === 'rtl' ? 'start' : 'end'} className="bg-white dark:bg-slate-900 border-gray-100 dark:border-white/10 text-gray-900 dark:text-white rounded-2xl shadow-xl p-1.5 min-w-48">
                                                        <DropdownMenuItem
                                                            className="flex items-center gap-2.5 cursor-pointer rounded-xl py-2.5 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-white/5"
                                                            onClick={() => setSelectedUser(user)}
                                                        >
                                                            <Eye className="w-4 h-4 text-gray-400" /> {t('superAdmin.usersList.viewProfile')}
                                                        </DropdownMenuItem>
                                                        {user.school && (
                                                            <DropdownMenuItem asChild>
                                                                <Link
                                                                    href={`/super-admin/schools/${user.school_id}`}
                                                                    className="flex items-center gap-2.5 cursor-pointer rounded-xl py-2.5 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-white/5"
                                                                >
                                                                    <Building2 className="w-4 h-4 text-gray-400" /> {t('superAdmin.usersList.viewSchool')}
                                                                </Link>
                                                            </DropdownMenuItem>
                                                        )}
                                                        {user.role && user.role !== 'super_admin' && (
                                                            <DropdownMenuItem
                                                                className="flex items-center gap-2.5 cursor-pointer rounded-xl py-2.5 font-semibold text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10"
                                                                onClick={() => accessAsUser(user)}
                                                            >
                                                                <ExternalLink className="w-4 h-4" /> {t('superAdmin.usersList.accessAs').replace('{role}', getRoleLabel(user.role))}
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* User Profile Dialog */}
            <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
                <DialogContent className="bg-white dark:bg-slate-900 border-gray-100 dark:border-white/10 text-gray-900 dark:text-white max-w-md rounded-3xl p-6 shadow-2xl" dir={direction}>
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black tracking-tight">{t('superAdmin.usersList.profileTitle')}</DialogTitle>
                    </DialogHeader>
                    {selectedUser && (
                        <div className="space-y-6 mt-4">
                            {/* User Avatar & Name */}
                            <div className="flex items-center gap-4">
                                <div className={cn(
                                    "h-16 w-16 rounded-2xl flex items-center justify-center border shrink-0",
                                    getRoleColor(selectedUser.role).split(' ')[0],
                                    getRoleColor(selectedUser.role).split(' ').find(c => c.startsWith('border-')) || 'border-transparent'
                                )}>
                                    {(() => {
                                        const RoleIcon = getRoleIcon(selectedUser.role)
                                        return <RoleIcon className={cn("w-7 h-7", getRoleColor(selectedUser.role).split(' ')[1])} />
                                    })()}
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-lg font-black tracking-tight leading-none">{selectedUser.full_name || t('superAdmin.usersList.unnamed')}</h3>
                                    <span className={cn(
                                        "inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border tracking-wider",
                                        getRoleColor(selectedUser.role)
                                    )}>
                                        {getRoleLabel(selectedUser.role)}
                                    </span>
                                </div>
                            </div>

                            {/* User Details */}
                            <div className="space-y-3.5 bg-gray-50/70 dark:bg-slate-950/40 rounded-2xl p-5 border border-gray-100 dark:border-white/5">
                                <div className="flex items-center gap-3 text-sm font-semibold">
                                    <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                                    <span className="text-gray-400 font-bold text-xs uppercase tracking-wider min-w-24">{t('superAdmin.usersList.profileEmail')}:</span>
                                    <span className="text-gray-800 dark:text-gray-200 break-all">{selectedUser.email || '-'}</span>
                                </div>
                                {selectedUser.school && (
                                    <div className="flex items-center gap-3 text-sm font-semibold">
                                        <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                                        <span className="text-gray-400 font-bold text-xs uppercase tracking-wider min-w-24">{t('superAdmin.usersList.profileSchool')}:</span>
                                        <Link
                                            href={`/super-admin/schools/${selectedUser.school_id}`}
                                            className="text-purple-600 hover:text-purple-500 dark:text-purple-400 dark:hover:text-purple-300 font-bold underline decoration-purple-600/30 hover:decoration-purple-600"
                                        >
                                            {selectedUser.school.name}
                                        </Link>
                                    </div>
                                )}
                                <div className="flex items-center gap-3 text-sm font-semibold">
                                    <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                                    <span className="text-gray-400 font-bold text-xs uppercase tracking-wider min-w-24">{t('superAdmin.usersList.profileRegistered')}:</span>
                                    <span className="text-gray-800 dark:text-gray-200">
                                        {new Date(selectedUser.created_at).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'fr-FR', {
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric'
                                        })}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-sm font-semibold">
                                    <UserCheck className="w-4 h-4 text-gray-400 shrink-0" />
                                    <span className="text-gray-400 font-bold text-xs uppercase tracking-wider min-w-24">{t('superAdmin.usersList.profileStatus')}:</span>
                                    <span className={cn(
                                        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider",
                                        selectedUser.is_active !== false
                                            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                                            : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                                    )}>
                                        {selectedUser.is_active !== false ? t('superAdmin.usersList.active') : t('superAdmin.usersList.inactive')}
                                    </span>
                                </div>
                            </div>

                            {/* User ID */}
                            <div className="text-[10px] text-gray-400 font-mono tracking-widest bg-gray-50/50 dark:bg-slate-950/20 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-white/5">
                                ID: {selectedUser.id}
                            </div>

                            {/* Access as User Button */}
                            {selectedUser.role && selectedUser.role !== 'super_admin' && (
                                <Button
                                    onClick={() => {
                                        accessAsUser(selectedUser)
                                        setSelectedUser(null)
                                    }}
                                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black rounded-2xl h-12 shadow-lg shadow-purple-600/20 transition-all duration-300 py-3"
                                >
                                    <ExternalLink className="w-4.5 h-4.5 mr-2" />
                                    {t('superAdmin.usersList.accessAs').replace('{role}', getRoleLabel(selectedUser.role))}
                                </Button>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
