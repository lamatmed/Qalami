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
            case 'super_admin': return 'bg-purple-500/10 text-purple-400 border-purple-500/20'
            case 'admin': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            case 'teacher': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
            case 'student': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
            case 'parent': return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
        }
    }

    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'super_admin': return 'Super Admin'
            case 'admin': return 'Admin'
            case 'teacher': return 'Enseignant'
            case 'student': return 'Élève'
            case 'parent': return 'Parent'
            default: return role
        }
    }

    // Function to access the app as a specific user
    const accessAsUser = (user: User) => {
        if (!user.role || user.role === 'super_admin') {
            return // Can't impersonate super admins
        }

        // Store the user context in sessionStorage for the target pages to read
        sessionStorage.setItem('superAdminViewingAs', JSON.stringify({
            userId: user.id,
            userName: user.full_name,
            userEmail: user.email,
            role: user.role,
            schoolId: user.school_id,
            schoolName: user.school?.name
        }))

        // Also set the school context if user has a school
        if (user.school_id && user.school) {
            sessionStorage.setItem('superAdminViewingSchool', JSON.stringify({
                id: user.school_id,
                name: user.school.name,
                role: user.role
            }))
        }

        // Navigate to the corresponding dashboard
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
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-white">Utilisateurs</h1>
                    <p className="text-gray-500">{stats.total} utilisateur(s) sur la plateforme</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {[
                    { label: 'Total', value: stats.total, color: 'gray' },
                    { label: 'Super Admins', value: stats.superAdmins, color: 'purple' },
                    { label: 'Admins', value: stats.admins, color: 'emerald' },
                    { label: 'Enseignants', value: stats.teachers, color: 'indigo' },
                    { label: 'Élèves', value: stats.students, color: 'blue' },
                    { label: 'Parents', value: stats.parents, color: 'amber' },
                ].map((stat, idx) => (
                    <div key={idx} className="bg-slate-800/50 border border-white/5 rounded-xl p-4">
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">{stat.label}</p>
                        <p className={cn(
                            "text-2xl font-black",
                            stat.color === 'gray' && "text-white",
                            stat.color === 'purple' && "text-purple-400",
                            stat.color === 'emerald' && "text-emerald-400",
                            stat.color === 'indigo' && "text-indigo-400",
                            stat.color === 'blue' && "text-blue-400",
                            stat.color === 'amber' && "text-amber-400"
                        )}>{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <Input
                        placeholder="Rechercher un utilisateur..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-12 bg-slate-800/50 border-white/10 text-white placeholder:text-gray-500 rounded-xl h-12"
                    />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-full md:w-48 bg-slate-800/50 border-white/10 text-white rounded-xl h-12">
                        <SelectValue placeholder="Tous les rôles" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10">
                        <SelectItem value="all">Tous les rôles</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="teacher">Enseignant</SelectItem>
                        <SelectItem value="student">Élève</SelectItem>
                        <SelectItem value="parent">Parent</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={schoolFilter} onValueChange={setSchoolFilter}>
                    <SelectTrigger className="w-full md:w-56 bg-slate-800/50 border-white/10 text-white rounded-xl h-12">
                        <SelectValue placeholder="Toutes les écoles" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10">
                        <SelectItem value="all">Toutes les écoles</SelectItem>
                        {schools.map(school => (
                            <SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Users Table */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                </div>
            ) : filteredUsers.length === 0 ? (
                <div className="text-center py-20 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>{search || roleFilter !== 'all' || schoolFilter !== 'all' ? 'Aucun résultat' : 'Aucun utilisateur'}</p>
                </div>
            ) : (
                <div className="bg-slate-800/50 border border-white/5 rounded-2xl overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="text-left text-xs text-gray-500 uppercase font-bold tracking-wider px-6 py-4">Utilisateur</th>
                                <th className="text-left text-xs text-gray-500 uppercase font-bold tracking-wider px-6 py-4">Rôle</th>
                                <th className="text-left text-xs text-gray-500 uppercase font-bold tracking-wider px-6 py-4">École</th>
                                <th className="text-left text-xs text-gray-500 uppercase font-bold tracking-wider px-6 py-4">Statut</th>
                                <th className="text-right text-xs text-gray-500 uppercase font-bold tracking-wider px-6 py-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredUsers.map(user => {
                                const RoleIcon = getRoleIcon(user.role)
                                return (
                                    <tr key={user.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "h-10 w-10 rounded-xl flex items-center justify-center",
                                                    getRoleColor(user.role).split(' ')[0]
                                                )}>
                                                    <RoleIcon className={cn("w-5 h-5", getRoleColor(user.role).split(' ')[1])} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-white">{user.full_name || 'Sans nom'}</p>
                                                    <p className="text-xs text-gray-500">{user.email || `ID: ${user.id.slice(0, 8)}...`}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "px-2 py-1 rounded-full text-[10px] font-bold uppercase border",
                                                getRoleColor(user.role)
                                            )}>
                                                {getRoleLabel(user.role)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {user.school ? (
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="w-4 h-4 text-gray-500" />
                                                    <span className="text-white text-sm">{user.school.name}</span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-500 text-sm">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                                                user.is_active !== false
                                                    ? "bg-emerald-500/10 text-emerald-400"
                                                    : "bg-red-500/10 text-red-400"
                                            )}>
                                                {user.is_active !== false ? (
                                                    <><UserCheck className="w-3 h-3" /> Actif</>
                                                ) : (
                                                    <><UserX className="w-3 h-3" /> Inactif</>
                                                )}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-white">
                                                        <MoreHorizontal className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="bg-slate-900 border-white/10">
                                                    <DropdownMenuItem
                                                        className="flex items-center gap-2 cursor-pointer"
                                                        onClick={() => setSelectedUser(user)}
                                                    >
                                                        <Eye className="w-4 h-4" /> Voir profil
                                                    </DropdownMenuItem>
                                                    {user.school && (
                                                        <DropdownMenuItem asChild>
                                                            <Link
                                                                href={`/super-admin/schools/${user.school_id}`}
                                                                className="flex items-center gap-2 cursor-pointer"
                                                            >
                                                                <Building2 className="w-4 h-4" /> Voir école
                                                            </Link>
                                                        </DropdownMenuItem>
                                                    )}
                                                    {user.role && user.role !== 'super_admin' && (
                                                        <DropdownMenuItem
                                                            className="flex items-center gap-2 cursor-pointer text-purple-400"
                                                            onClick={() => accessAsUser(user)}
                                                        >
                                                            <ExternalLink className="w-4 h-4" /> Accéder en tant que
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
            )}

            {/* User Profile Dialog */}
            <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
                <DialogContent className="bg-slate-900 border-white/10 text-white max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">Profil utilisateur</DialogTitle>
                    </DialogHeader>
                    {selectedUser && (
                        <div className="space-y-6">
                            {/* User Avatar & Name */}
                            <div className="flex items-center gap-4">
                                <div className={cn(
                                    "h-16 w-16 rounded-2xl flex items-center justify-center",
                                    getRoleColor(selectedUser.role).split(' ')[0]
                                )}>
                                    {(() => {
                                        const RoleIcon = getRoleIcon(selectedUser.role)
                                        return <RoleIcon className={cn("w-8 h-8", getRoleColor(selectedUser.role).split(' ')[1])} />
                                    })()}
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold">{selectedUser.full_name || 'Sans nom'}</h3>
                                    <span className={cn(
                                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border",
                                        getRoleColor(selectedUser.role)
                                    )}>
                                        {getRoleLabel(selectedUser.role)}
                                    </span>
                                </div>
                            </div>

                            {/* User Details */}
                            <div className="space-y-3 bg-slate-800/50 rounded-xl p-4">
                                <div className="flex items-center gap-3 text-sm">
                                    <Mail className="w-4 h-4 text-gray-500" />
                                    <span className="text-gray-400">Email:</span>
                                    <span className="text-white">{selectedUser.email || 'Non défini'}</span>
                                </div>
                                {selectedUser.school && (
                                    <div className="flex items-center gap-3 text-sm">
                                        <Building2 className="w-4 h-4 text-gray-500" />
                                        <span className="text-gray-400">École:</span>
                                        <Link
                                            href={`/super-admin/schools/${selectedUser.school_id}`}
                                            className="text-purple-400 hover:text-purple-300"
                                        >
                                            {selectedUser.school.name}
                                        </Link>
                                    </div>
                                )}
                                <div className="flex items-center gap-3 text-sm">
                                    <Calendar className="w-4 h-4 text-gray-500" />
                                    <span className="text-gray-400">Inscrit le:</span>
                                    <span className="text-white">
                                        {new Date(selectedUser.created_at).toLocaleDateString('fr-FR', {
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric'
                                        })}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                    <UserCheck className="w-4 h-4 text-gray-500" />
                                    <span className="text-gray-400">Statut:</span>
                                    <span className={cn(
                                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                                        selectedUser.is_active !== false
                                            ? "bg-emerald-500/10 text-emerald-400"
                                            : "bg-red-500/10 text-red-400"
                                    )}>
                                        {selectedUser.is_active !== false ? 'Actif' : 'Inactif'}
                                    </span>
                                </div>
                            </div>

                            {/* User ID */}
                            <div className="text-xs text-gray-600 font-mono">
                                ID: {selectedUser.id}
                            </div>

                            {/* Access as User Button */}
                            {selectedUser.role && selectedUser.role !== 'super_admin' && (
                                <Button
                                    onClick={() => {
                                        accessAsUser(selectedUser)
                                        setSelectedUser(null)
                                    }}
                                    className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl"
                                >
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    Accéder en tant que {getRoleLabel(selectedUser.role)}
                                </Button>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
