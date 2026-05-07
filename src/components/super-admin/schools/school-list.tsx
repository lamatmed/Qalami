'use client'

import { useState, useEffect } from 'react'
import { Building2, Plus, Search, MoreHorizontal, Eye, Settings, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { useLanguage } from '@/i18n'
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
    const { t } = useLanguage()
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
                return 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20'
            case 'pro':
                return 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20'
            default:
                return 'bg-gray-50 dark:bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-500/20'
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white">{t('superAdmin.schoolsList.title')}</h1>
                    <p className="text-gray-500">{t('superAdmin.schoolsList.count').replace('{count}', schools.length.toString())}</p>
                </div>
                <Link href="/super-admin/schools/new">
                    <Button className="bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-lg shadow-purple-600/20">
                        <Plus className="w-4 h-4 mr-2" /> {t('superAdmin.schoolsList.newSchool')}
                    </Button>
                </Link>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                <Input
                    placeholder={t('superAdmin.schoolsList.searchPlaceholder')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-12 bg-white dark:bg-slate-800/50 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl h-12 shadow-sm"
                />
            </div>

            {/* Schools Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                </div>
            ) : filteredSchools.length === 0 ? (
                <div className="text-center py-20 text-gray-400 dark:text-gray-500">
                    <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>{search ? t('superAdmin.schoolsList.noResults') : t('superAdmin.schoolsList.noSchools')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredSchools.map(school => (
                        <div
                            key={school.id}
                            className="bg-white dark:bg-slate-800/50 border border-gray-150 dark:border-white/5 rounded-2xl p-5 hover:scale-[1.02] hover:shadow-xl dark:hover:border-purple-500/30 transition-all group shadow-sm"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                                        <Building2 className="w-6 h-6" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors truncate">{school.name}</h3>
                                        <p className="text-xs text-gray-400 dark:text-gray-500">/{school.slug}</p>
                                    </div>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-900 dark:hover:text-white">
                                            <MoreHorizontal className="w-4 h-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-white dark:bg-slate-900 border-gray-200 dark:border-white/10">
                                        <DropdownMenuItem asChild>
                                            <Link href={`/super-admin/schools/${school.id}`} className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                                <Eye className="w-4 h-4" /> {t('superAdmin.schoolsList.viewDetails')}
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                            <Link href={`/super-admin/schools/${school.id}/access`} className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-medium">
                                                <Settings className="w-4 h-4" /> {t('superAdmin.schoolsList.accessAdmin')}
                                            </Link>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className="flex items-center gap-2 mb-4">
                                <span className={cn(
                                    "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border",
                                    school.is_active
                                        ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                                        : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20"
                                )}>
                                    {school.is_active ? t('superAdmin.dashboard.activeLabel') : t('superAdmin.dashboard.inactiveLabel')}
                                </span>
                                <span className={cn(
                                    "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border",
                                    getPlanBadge(school.subscription_plan)
                                )}>
                                    {school.subscription_plan}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="bg-gray-50 dark:bg-slate-900/50 rounded-lg p-3 border border-gray-100 dark:border-white/5">
                                    <p className="text-gray-400 dark:text-gray-500 text-xs font-medium">{t('superAdmin.schoolsList.students')}</p>
                                    <p className="font-bold text-gray-900 dark:text-white mt-0.5">{school.studentCount} / {school.max_students}</p>
                                </div>
                                <div className="bg-gray-50 dark:bg-slate-900/50 rounded-lg p-3 border border-gray-100 dark:border-white/5">
                                    <p className="text-gray-400 dark:text-gray-500 text-xs font-medium">{t('superAdmin.schoolsList.teachers')}</p>
                                    <p className="font-bold text-gray-900 dark:text-white mt-0.5">{school.teacherCount}</p>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5 flex gap-2">
                                <Link href={`/super-admin/schools/${school.id}`} className="flex-1">
                                    <Button variant="outline" className="w-full border-gray-200 dark:border-white/10 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl transition-colors font-semibold">
                                        {t('superAdmin.schoolsList.detailsButton')}
                                    </Button>
                                </Link>
                                <Link href={`/super-admin/schools/${school.id}/access`}>
                                    <Button className="bg-purple-600 hover:bg-purple-500 text-white rounded-xl px-4 shadow-lg shadow-purple-600/10">
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
