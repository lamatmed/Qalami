'use client'

import { useState, useEffect } from 'react'
import { Users, Search, MoreHorizontal, Eye, Building2, GraduationCap, BookOpen, UserCheck, UserX, Loader2, Shield, Mail, Calendar, ExternalLink, Phone, Sparkles, Filter, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { updateUserPassword } from '@/app/super-admin/users/actions'
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
import { motion } from 'framer-motion'

interface User {
    id: string
    email: string
    full_name: string | null
    role: string
    school_id: string | null
    phone: string | null
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
    const [passwordUser, setPasswordUser] = useState<User | null>(null)
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [updatingPassword, setUpdatingPassword] = useState(false)

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!passwordUser) return

        if (!/^\d{6}$/.test(newPassword)) {
            toast.error('Le mot de passe doit être exactement 6 chiffres')
            return
        }

        if (newPassword !== confirmPassword) {
            toast.error('Les mots de passe ne correspondent pas.')
            return
        }

        setUpdatingPassword(true)
        try {
            const res = await updateUserPassword(passwordUser.id, newPassword)
            if (res.error) {
                toast.error(res.error)
            } else {
                toast.success('Le mot de passe a été mis à jour avec succès.')
                setPasswordUser(null)
                setNewPassword('')
                setConfirmPassword('')
            }
        } catch (error) {
            console.error('Error changing password:', error)
            toast.error('Une erreur est survenue lors de la mise à jour.')
        } finally {
            setUpdatingPassword(false)
        }
    }

    useEffect(() => {
        const fetchData = async () => {
            const supabase = createClient()
            try {
                const { data: schoolsData, error: schoolsError } = await supabase
                    .from('schools')
                    .select('id, name')
                    .order('name')

                if (schoolsError) {
                    console.error('Error fetching schools:', schoolsError)
                }

                setSchools(schoolsData ?? [])

                const { data: usersData, error: usersError } = await supabase
                    .from('profiles')
                    .select(`
                        id,
                        email,
                        full_name,
                        role,
                        phone,
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
                        is_active: true,
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
            (user.email?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
            (user.phone?.toLowerCase().includes(search.toLowerCase()) ?? false)
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

    const isRTL = direction === 'rtl'

    return (
        <div className="space-y-10 pb-12 select-none animate-in fade-in duration-500" dir={direction}>
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <div className="inline-flex items-center gap-2 text-purple-600 dark:text-purple-400 font-black text-[11px] tracking-[0.2em] uppercase mb-2 bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20 rounded-full px-3.5 py-1 shadow-sm">
                        <Sparkles className="w-3 h-3 fill-purple-600 dark:fill-purple-400" />
                        <span>{t('superAdmin.usersList.title') || 'ANNUAIRE'}</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white mt-1">
                        Gestion des Utilisateurs
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-semibold mt-1.5 text-sm">
                        {t('superAdmin.usersList.count').replace('{count}', stats.total.toString())}
                    </p>
                </div>
            </div>

            {/* Supercharged Mini KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4.5">
                {[
                    { label: t('superAdmin.usersList.total') || 'Total', value: stats.total, color: 'bg-slate-500 dark:bg-slate-400', text: 'text-slate-900 dark:text-white' },
                    { label: t('superAdmin.usersList.superAdmins') || 'Super Admins', value: stats.superAdmins, color: 'bg-purple-500', text: 'text-purple-600 dark:text-purple-400' },
                    { label: t('superAdmin.usersList.admins') || 'Admins', value: stats.admins, color: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
                    { label: t('superAdmin.usersList.teachers') || 'Teachers', value: stats.teachers, color: 'bg-indigo-500', text: 'text-indigo-600 dark:text-indigo-400' },
                    { label: t('superAdmin.usersList.students') || 'Students', value: stats.students, color: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400' },
                    { label: t('superAdmin.usersList.parents') || 'Parents', value: stats.parents, color: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
                ].map((stat, idx) => (
                    <div 
                        key={idx} 
                        className="group relative bg-white dark:bg-slate-900/50 border border-slate-150 dark:border-white/5 rounded-2xl p-5 overflow-hidden shadow-[0_4px_20px_-8px_rgba(0,0,0,0.02)] transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
                    >
                        <div className={cn("absolute top-0 inset-x-0 h-[3px] opacity-60 group-hover:opacity-100 transition-opacity", stat.color)} />
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-[0.15em] truncate">{stat.label}</p>
                        <p className={cn(
                            "text-2xl sm:text-3xl font-black mt-2 tabular-nums leading-none",
                            stat.text
                        )}>{stat.value.toLocaleString()}</p>
                    </div>
                ))}
            </div>

            {/* Premium Filters Bar */}
            <div className="bg-white/60 dark:bg-slate-900/30 backdrop-blur-md p-4 rounded-2xl border border-slate-150 dark:border-white/5 shadow-sm flex flex-col md:flex-row gap-4">
                <div className="relative flex-1 min-w-0">
                    <Search className={cn("absolute top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400", isRTL ? 'right-4.5' : 'left-4.5')} />
                    <Input
                        placeholder={t('superAdmin.usersList.searchPlaceholder') || 'Rechercher par nom, email, téléphone...'}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className={cn(
                            "bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 font-medium rounded-xl h-12 shadow-inner transition-all focus:bg-white focus:ring-2 focus:ring-purple-500/20", 
                            isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'
                        )}
                    />
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                        <SelectTrigger className="w-full sm:w-48 bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl h-12 shadow-sm font-bold text-sm">
                            <div className="flex items-center gap-2 truncate">
                                <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <SelectValue placeholder={t('superAdmin.usersList.allRoles')} />
                            </div>
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl shadow-2xl">
                            <SelectItem value="all" className="font-bold py-2.5">{t('superAdmin.usersList.allRoles')}</SelectItem>
                            <SelectItem value="super_admin" className="font-bold py-2.5">{t('superAdmin.usersList.superAdmins')}</SelectItem>
                            <SelectItem value="admin" className="font-bold py-2.5">{t('superAdmin.usersList.admins')}</SelectItem>
                            <SelectItem value="teacher" className="font-bold py-2.5">{t('superAdmin.usersList.teachers')}</SelectItem>
                            <SelectItem value="student" className="font-bold py-2.5">{t('superAdmin.usersList.students')}</SelectItem>
                            <SelectItem value="parent" className="font-bold py-2.5">{t('superAdmin.usersList.parents')}</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={schoolFilter} onValueChange={setSchoolFilter}>
                        <SelectTrigger className="w-full sm:w-60 bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl h-12 shadow-sm font-bold text-sm">
                            <div className="flex items-center gap-2 truncate">
                                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <SelectValue placeholder={t('superAdmin.usersList.allSchools')} />
                            </div>
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl shadow-2xl max-h-72">
                            <SelectItem value="all" className="font-bold py-2.5">{t('superAdmin.usersList.allSchools')}</SelectItem>
                            {schools.map(school => (
                                <SelectItem key={school.id} value={school.id} className="font-bold py-2.5">{school.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Users Content */}
            {loading ? (
                <div className="flex items-center justify-center py-28 bg-white/80 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-150 dark:border-white/5 rounded-3xl shadow-sm animate-pulse">
                    <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
                </div>
            ) : filteredUsers.length === 0 ? (
                <div className="text-center py-24 bg-white/80 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-150 dark:border-white/5 rounded-3xl shadow-sm text-slate-400">
                    <div className="bg-slate-50 dark:bg-slate-800 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100 dark:border-white/5">
                        <Users className="w-8 h-8 text-purple-500 opacity-80" />
                    </div>
                    <p className="font-black uppercase tracking-wider text-xs text-slate-500">
                        {search || roleFilter !== 'all' || schoolFilter !== 'all' ? t('superAdmin.usersList.noResults') || 'Aucun résultat' : t('superAdmin.usersList.noUsers') || 'Aucun utilisateur'}
                    </p>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-900/40 backdrop-blur-xl border border-slate-150 dark:border-white/5 rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.03)] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-950/20">
                                    <th className={cn("text-[10px] text-slate-400 uppercase font-black tracking-[0.15em] px-6 py-4.5", isRTL ? 'text-right' : 'text-left')}>{t('superAdmin.usersList.thUser') || 'UTILISATEUR'}</th>
                                    <th className={cn("text-[10px] text-slate-400 uppercase font-black tracking-[0.15em] px-6 py-4.5", isRTL ? 'text-right' : 'text-left')}>{t('superAdmin.usersList.thRole') || 'RÔLE'}</th>
                                    <th className={cn("text-[10px] text-slate-400 uppercase font-black tracking-[0.15em] px-6 py-4.5", isRTL ? 'text-right' : 'text-left')}>TÉLÉPHONE</th>
                                    <th className={cn("text-[10px] text-slate-400 uppercase font-black tracking-[0.15em] px-6 py-4.5", isRTL ? 'text-right' : 'text-left')}>{t('superAdmin.usersList.thSchool') || 'ÉCOLE'}</th>
                                    <th className={cn("text-[10px] text-slate-400 uppercase font-black tracking-[0.15em] px-6 py-4.5", isRTL ? 'text-right' : 'text-left')}>{t('superAdmin.usersList.thStatus') || 'STATUT'}</th>
                                    <th className={cn("text-[10px] text-slate-400 uppercase font-black tracking-[0.15em] px-6 py-4.5", isRTL ? 'text-left' : 'text-right')}>{t('superAdmin.usersList.thActions') || 'ACTIONS'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {filteredUsers.map(user => {
                                    const RoleIcon = getRoleIcon(user.role)
                                    const roleClass = getRoleColor(user.role)
                                    const roleBg = roleClass.split(' ')[0]
                                    const roleText = roleClass.split(' ')[1]
                                    const roleBorder = roleClass.split(' ').find(c => c.startsWith('border-')) || 'border-transparent'
                                    
                                    return (
                                        <tr key={user.id} className="group hover:bg-white/80 dark:hover:bg-white/[0.02] transition-all duration-200">
                                            <td className="px-6 py-4.5">
                                                <div className="flex items-center gap-4">
                                                    <div className={cn(
                                                        "h-12 w-12 rounded-xl flex items-center justify-center shrink-0 border shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] group-hover:scale-105 group-hover:rotate-1 transition-all duration-300",
                                                        roleBg,
                                                        roleBorder
                                                    )}>
                                                        <RoleIcon className={cn("w-5.5 h-5.5", roleText)} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-black text-slate-900 dark:text-white leading-snug text-sm truncate tracking-tight group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">{user.full_name || t('superAdmin.usersList.unnamed')}</p>
                                                        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5 truncate max-w-[200px] select-all">{user.email || `ID: ${user.id.slice(0, 8)}...`}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4.5">
                                                <span className={cn(
                                                    "px-2.5 py-1 rounded-full text-[9px] font-black uppercase border tracking-widest shadow-[0_1px_3px_rgba(0,0,0,0.02)]",
                                                    roleClass
                                                )}>
                                                    {getRoleLabel(user.role)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4.5">
                                                <span className="text-slate-700 dark:text-slate-300 font-black text-xs font-mono bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 px-2 py-0.5 rounded-lg select-all" dir="ltr">
                                                    {user.phone || '-'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4.5">
                                                {user.school ? (
                                                    <div className="flex items-center gap-2 truncate max-w-[200px]">
                                                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                        <span className="text-slate-700 dark:text-slate-300 text-xs font-black truncate uppercase tracking-wide">{user.school.name}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-300 dark:text-slate-700 font-bold text-xs">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4.5">
                                                <span className={cn(
                                                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm",
                                                    user.is_active !== false
                                                        ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                                                        : "bg-red-50 text-red-600 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
                                                )}>
                                                    {user.is_active !== false ? (
                                                        <><UserCheck className="w-3 h-3" /> {t('superAdmin.usersList.active') || 'ACTIF'}</>
                                                    ) : (
                                                        <><UserX className="w-3 h-3" /> {t('superAdmin.usersList.inactive') || 'INACTIF'}</>
                                                    )}
                                                </span>
                                            </td>
                                            <td className={cn("px-6 py-4.5", isRTL ? 'text-left' : 'text-right')}>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-xl transition-all">
                                                            <MoreHorizontal className="w-4.5 h-4.5" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align={isRTL ? 'start' : 'end'} className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-white/10 text-slate-900 dark:text-white rounded-2xl shadow-2xl p-1.5 min-w-[200px]">
                                                        <DropdownMenuItem
                                                            className="flex items-center gap-2.5 cursor-pointer rounded-xl py-3 font-bold text-xs uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                                                            onClick={() => setSelectedUser(user)}
                                                        >
                                                            <Eye className="w-4 h-4 text-slate-400" /> {t('superAdmin.usersList.viewProfile')}
                                                        </DropdownMenuItem>
                                                        
                                                        {user.school && (
                                                            <DropdownMenuItem asChild>
                                                                <Link
                                                                    href={`/super-admin/schools/${user.school_id}`}
                                                                    className="flex items-center gap-2.5 cursor-pointer rounded-xl py-3 font-bold text-xs uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                                                                >
                                                                    <Building2 className="w-4 h-4 text-slate-400" /> {t('superAdmin.usersList.viewSchool')}
                                                                </Link>
                                                            </DropdownMenuItem>
                                                        )}
                                                        
                                                        {user.role && user.role !== 'super_admin' && (
                                                            <DropdownMenuItem
                                                                className="flex items-center gap-2.5 cursor-pointer rounded-xl py-3 font-black text-xs uppercase tracking-wider text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors border-t border-slate-100 dark:border-white/5 mt-1"
                                                                onClick={() => accessAsUser(user)}
                                                            >
                                                                <ExternalLink className="w-4 h-4 text-purple-500" /> {t('superAdmin.usersList.accessAs').replace('{role}', getRoleLabel(user.role))}
                                                            </DropdownMenuItem>
                                                        )}

                                                        <DropdownMenuItem
                                                            className="flex items-center gap-2.5 cursor-pointer rounded-xl py-3 font-bold text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors border-t border-slate-100 dark:border-white/5 mt-1"
                                                            onClick={() => setPasswordUser(user)}
                                                        >
                                                            <KeyRound className="w-4 h-4 text-amber-500" /> {t('superAdmin.usersList.changePassword') || 'Modifier mot de passe'}
                                                        </DropdownMenuItem>
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

            {/* User Profile Dialog - Luxuriously Polished */}
            <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
                <DialogContent className="bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl border border-slate-150 dark:border-white/10 text-slate-900 dark:text-white max-w-md rounded-[28px] p-7 shadow-2xl overflow-hidden" dir={direction}>
                    
                    {/* Top background glow accent */}
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/10 blur-3xl rounded-full pointer-events-none" />
                    
                    <DialogHeader className="relative z-10">
                        <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-2 text-slate-900 dark:text-white">
                            <Shield className="w-5 h-5 text-purple-500" />
                            {t('superAdmin.usersList.profileTitle') || 'Fiche Utilisateur'}
                        </DialogTitle>
                    </DialogHeader>
                    
                    {selectedUser && (
                        <div className="space-y-6 mt-5 relative z-10">
                            {/* User Avatar / Identity */}
                            <div className="flex items-center gap-4 p-1">
                                <div className={cn(
                                    "h-16 w-16 rounded-[20px] flex items-center justify-center border shadow-[0_4px_15px_-3px_rgba(0,0,0,0.05)] shrink-0",
                                    getRoleColor(selectedUser.role).split(' ')[0],
                                    getRoleColor(selectedUser.role).split(' ').find(c => c.startsWith('border-')) || 'border-transparent'
                                )}>
                                    {(() => {
                                        const RoleIcon = getRoleIcon(selectedUser.role)
                                        const roleTextClass = getRoleColor(selectedUser.role).split(' ')[1]
                                        return <RoleIcon className={cn("w-7 h-7", roleTextClass)} />
                                    })()}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white truncate leading-tight">
                                        {selectedUser.full_name || t('superAdmin.usersList.unnamed')}
                                    </h3>
                                    <div className="mt-1.5">
                                        <span className={cn(
                                            "inline-block px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase border tracking-widest shadow-sm",
                                            getRoleColor(selectedUser.role)
                                        )}>
                                            {getRoleLabel(selectedUser.role)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* User Details Section */}
                            <div className="space-y-3 bg-slate-50/80 dark:bg-slate-900/50 border border-slate-150 dark:border-white/5 rounded-2xl p-5">
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-black tracking-widest uppercase">{t('superAdmin.usersList.profileEmail') || 'EMAIL'}</span>
                                    <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200 text-sm truncate select-all">
                                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        {selectedUser.email || '—'}
                                    </div>
                                </div>
                                
                                <div className="h-px bg-slate-200/60 dark:bg-white/5 w-full my-2" />

                                <div className="flex flex-col gap-1.5">
                                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-black tracking-widest uppercase">TÉLÉPHONE</span>
                                    <div className="flex items-center gap-2 font-black text-slate-800 dark:text-slate-200 text-sm font-mono select-all" dir="ltr">
                                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        {selectedUser.phone || '—'}
                                    </div>
                                </div>

                                {selectedUser.school && (
                                    <>
                                        <div className="h-px bg-slate-200/60 dark:bg-white/5 w-full my-2" />
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-black tracking-widest uppercase">{t('superAdmin.usersList.profileSchool') || 'ÉCOLE ASSIGNÉE'}</span>
                                            <div className="flex items-center gap-2 font-black text-sm uppercase tracking-wide">
                                                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <Link
                                                    href={`/super-admin/schools/${selectedUser.school_id}`}
                                                    className="text-purple-600 hover:text-purple-500 dark:text-purple-400 dark:hover:text-purple-300 underline decoration-purple-600/20 hover:decoration-purple-600"
                                                >
                                                    {selectedUser.school.name}
                                                </Link>
                                            </div>
                                        </div>
                                    </>
                                )}

                                <div className="h-px bg-slate-200/60 dark:bg-white/5 w-full my-2" />

                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-black tracking-widest uppercase">{t('superAdmin.usersList.profileRegistered') || 'INSCRIPTION'}</span>
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            {new Date(selectedUser.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'fr-FR', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric'
                                            })}
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-col gap-1 items-end">
                                        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-black tracking-widest uppercase">{t('superAdmin.usersList.profileStatus') || 'STATUT'}</span>
                                        <span className={cn(
                                            "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm mt-0.5",
                                            selectedUser.is_active !== false
                                                ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400"
                                                : "bg-red-50 text-red-600 border-red-100 dark:bg-red-500/10 dark:text-red-400"
                                        )}>
                                            {selectedUser.is_active !== false ? t('superAdmin.usersList.active') || 'ACTIF' : t('superAdmin.usersList.inactive') || 'INACTIF'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* User ID Tech Tag */}
                            <div className="text-[9px] font-bold font-mono tracking-widest text-slate-400 dark:text-slate-600 bg-slate-50 dark:bg-slate-900/60 px-3 py-2 rounded-xl border border-slate-150 dark:border-white/5 text-center uppercase select-all">
                                UID: {selectedUser.id}
                            </div>

                            {/* Access as User Call-To-Action Button */}
                            {selectedUser.role && selectedUser.role !== 'super_admin' && (
                                <Button
                                    onClick={() => {
                                        accessAsUser(selectedUser)
                                        setSelectedUser(null)
                                    }}
                                    className="w-full bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:via-indigo-500 hover:to-blue-500 text-white font-black rounded-[18px] h-12.5 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-500 py-3 text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-98"
                                >
                                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                                    {t('superAdmin.usersList.accessAs').replace('{role}', getRoleLabel(selectedUser.role))}
                                </Button>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* User Password Dialog */}
            <Dialog open={!!passwordUser} onOpenChange={(open) => {
                if (!open) {
                    setPasswordUser(null)
                    setNewPassword('')
                    setConfirmPassword('')
                }
            }}>
                <DialogContent className="bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl border border-slate-150 dark:border-white/10 text-slate-900 dark:text-white max-w-md rounded-[28px] p-7 shadow-2xl overflow-hidden" dir={direction}>
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/10 blur-3xl rounded-full pointer-events-none" />
                    
                    <DialogHeader className="relative z-10">
                        <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-2 text-slate-900 dark:text-white">
                            <KeyRound className="w-5 h-5 text-purple-500" />
                            {t('superAdmin.usersList.changePassword') || 'Modifier le mot de passe'}
                        </DialogTitle>
                    </DialogHeader>

                    {passwordUser && (
                        <form onSubmit={handleUpdatePassword} className="space-y-4 mt-4 relative z-10">
                            <div className="bg-slate-50/80 dark:bg-slate-900/50 border border-slate-150 dark:border-white/5 rounded-2xl p-4 mb-2">
                                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                    Utilisateur : <span className="text-purple-600 dark:text-purple-400 font-black">{passwordUser.full_name || passwordUser.email}</span>
                                </p>
                                <p className="text-[10px] font-semibold text-slate-400 mt-1 truncate">
                                    {passwordUser.email}
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                                    {t('superAdmin.usersList.newPassword') || 'Nouveau mot de passe'}
                                </label>
                                <Input
                                    type="password"
                                    required
                                    placeholder="6 chiffres (ex. 123456)"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    className="bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl h-11 shadow-inner focus:ring-2 focus:ring-purple-500/20"
                                    inputMode="numeric"
                                    maxLength={6}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                                    {t('superAdmin.usersList.confirmPassword') || 'Confirmer le mot de passe'}
                                </label>
                                <Input
                                    type="password"
                                    required
                                    placeholder="Répétez les 6 chiffres"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    className="bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl h-11 shadow-inner focus:ring-2 focus:ring-purple-500/20"
                                    inputMode="numeric"
                                    maxLength={6}
                                />
                            </div>

                            <div className="flex gap-3 pt-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setPasswordUser(null)}
                                    className="flex-1 rounded-[18px] h-11 font-bold text-xs uppercase tracking-wider border-slate-200 dark:border-white/10"
                                >
                                    {t('common.cancel') || 'Annuler'}
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={updatingPassword}
                                    className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black rounded-[18px] h-11 shadow-lg shadow-purple-500/25 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                                >
                                    {updatingPassword ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        t('common.confirm') || 'Confirmer'
                                    )}
                                </Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
