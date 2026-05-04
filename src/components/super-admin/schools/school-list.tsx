'use client'

import { useState, useEffect } from 'react'
import { Building2, Plus, Search, MoreHorizontal, Eye, Settings, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface School {
    id: string
    name: string
    slug: string
    is_active: boolean
    subscription_plan: string
    max_students: number
    created_at: string
    studentCount?: number
    teacherCount?: number
}

export function SchoolList() {
    const supabase = createClient()
    const [schools, setSchools] = useState<School[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    useEffect(() => {
        const fetchSchools = async () => {
            try {
                const { data } = await supabase
                    .from('schools')
                    .select('*')
                    .order('created_at', { ascending: false })

                if (data) {
                    // Fetch counts for each school
                    const schoolsWithCounts = await Promise.all(
                        data.map(async (school) => {
                            const [studentsRes, teachersRes] = await Promise.all([
                                supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', school.id).eq('role', 'student'),
                                supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', school.id).eq('role', 'teacher'),
                            ])
                            return {
                                ...school,
                                studentCount: studentsRes.count ?? 0,
                                teacherCount: teachersRes.count ?? 0,
                            }
                        })
                    )
                    setSchools(schoolsWithCounts)
                }
            } catch (error) {
                console.error('Error fetching schools:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchSchools()
    }, [])

    const filteredSchools = schools.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.slug.toLowerCase().includes(search.toLowerCase())
    )

    const getPlanBadge = (plan: string) => {
        switch (plan) {
            case 'enterprise':
                return 'bg-purple-500/10 text-purple-400 border-purple-500/20'
            case 'pro':
                return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
            default:
                return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-white">Écoles</h1>
                    <p className="text-gray-500">{schools.length} école(s) sur la plateforme</p>
                </div>
                <Link href="/super-admin/schools/new">
                    <Button className="bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl">
                        <Plus className="w-4 h-4 mr-2" /> Nouvelle école
                    </Button>
                </Link>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <Input
                    placeholder="Rechercher une école..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-12 bg-slate-800/50 border-white/10 text-white placeholder:text-gray-500 rounded-xl h-12"
                />
            </div>

            {/* Schools Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                </div>
            ) : filteredSchools.length === 0 ? (
                <div className="text-center py-20 text-gray-500">
                    <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>{search ? 'Aucun résultat' : 'Aucune école'}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredSchools.map(school => (
                        <div
                            key={school.id}
                            className="bg-slate-800/50 border border-white/5 rounded-2xl p-5 hover:border-purple-500/30 transition-all group"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                                        <Building2 className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white group-hover:text-purple-400 transition-colors">{school.name}</h3>
                                        <p className="text-xs text-gray-500">/{school.slug}</p>
                                    </div>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-white">
                                            <MoreHorizontal className="w-4 h-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-slate-900 border-white/10">
                                        <DropdownMenuItem asChild>
                                            <Link href={`/super-admin/schools/${school.id}`} className="flex items-center gap-2">
                                                <Eye className="w-4 h-4" /> Voir détails
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                            <Link href={`/super-admin/schools/${school.id}/access`} className="flex items-center gap-2 text-purple-400">
                                                <Settings className="w-4 h-4" /> Accéder à l'admin
                                            </Link>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className="flex items-center gap-2 mb-4">
                                <span className={cn(
                                    "px-2 py-1 rounded-full text-[10px] font-bold uppercase border",
                                    school.is_active
                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                        : "bg-red-500/10 text-red-400 border-red-500/20"
                                )}>
                                    {school.is_active ? 'Active' : 'Inactive'}
                                </span>
                                <span className={cn(
                                    "px-2 py-1 rounded-full text-[10px] font-bold uppercase border",
                                    getPlanBadge(school.subscription_plan)
                                )}>
                                    {school.subscription_plan}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="bg-slate-900/50 rounded-lg p-3">
                                    <p className="text-gray-500 text-xs">Élèves</p>
                                    <p className="font-bold text-white">{school.studentCount} / {school.max_students}</p>
                                </div>
                                <div className="bg-slate-900/50 rounded-lg p-3">
                                    <p className="text-gray-500 text-xs">Enseignants</p>
                                    <p className="font-bold text-white">{school.teacherCount}</p>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-white/5 flex gap-2">
                                <Link href={`/super-admin/schools/${school.id}`} className="flex-1">
                                    <Button variant="outline" className="w-full border-white/10 text-white hover:bg-white/5 rounded-xl">
                                        Détails
                                    </Button>
                                </Link>
                                <Link href={`/super-admin/schools/${school.id}/access`}>
                                    <Button className="bg-purple-600 hover:bg-purple-500 text-white rounded-xl px-4">
                                        <Eye className="w-4 h-4" />
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
