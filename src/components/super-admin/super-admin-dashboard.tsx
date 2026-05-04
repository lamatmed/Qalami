'use client'

import { useState, useEffect } from 'react'
import { Building2, Users, GraduationCap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'

interface GlobalStats {
    totalSchools: number
    activeSchools: number
    totalStudents: number
    totalTeachers: number
    totalParents: number
}

export function SuperAdminDashboard() {
    const supabase = createClient()
    const [stats, setStats] = useState<GlobalStats | null>(null)
    const [recentSchools, setRecentSchools] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Fetch all schools
                const { data: schools } = await supabase
                    .from('schools')
                    .select('id, name, is_active, created_at')
                    .order('created_at', { ascending: false })

                // Fetch profile counts
                const [studentsRes, teachersRes, parentsRes] = await Promise.all([
                    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
                    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
                    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'parent'),
                ])

                const allSchools = schools ?? []

                setStats({
                    totalSchools: allSchools.length,
                    activeSchools: allSchools.filter(s => s.is_active).length,
                    totalStudents: studentsRes.count ?? 0,
                    totalTeachers: teachersRes.count ?? 0,
                    totalParents: parentsRes.count ?? 0,
                })

                setRecentSchools(allSchools.slice(0, 5))
            } catch (error) {
                console.error('Error fetching stats:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchStats()
    }, [])

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="h-10 w-48 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
                    ))}
                </div>
            </div>
        )
    }

    const kpis = [
        { label: 'ÉCOLES', value: stats?.totalSchools ?? 0, icon: Building2, color: 'purple', trend: stats?.activeSchools ?? 0, trendLabel: 'actives' },
        { label: 'ÉLÈVES', value: stats?.totalStudents ?? 0, icon: GraduationCap, color: 'blue' },
        { label: 'ENSEIGNANTS', value: stats?.totalTeachers ?? 0, icon: Users, color: 'indigo' },
        { label: 'PARENTS', value: stats?.totalParents ?? 0, icon: Users, color: 'amber' },
    ]

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black text-gray-900 dark:text-white">Tableau de bord</h1>
                <p className="text-gray-500">Vue globale de la plateforme Qalami</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {kpis.map((kpi, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-white/5 rounded-2xl p-5 hover:scale-[1.02] transition-transform shadow-sm">
                        <div className={cn(
                            "h-10 w-10 rounded-xl flex items-center justify-center mb-3",
                            kpi.color === 'purple' && "bg-purple-500/10 text-purple-500",
                            kpi.color === 'blue' && "bg-blue-500/10 text-blue-500",
                            kpi.color === 'indigo' && "bg-indigo-500/10 text-indigo-500",
                            kpi.color === 'amber' && "bg-amber-500/10 text-amber-500"
                        )}>
                            <kpi.icon className="w-5 h-5" />
                        </div>
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">{kpi.label}</p>
                        <p className="text-3xl font-black text-gray-900 dark:text-white">{kpi.value}</p>
                        {kpi.trendLabel && (
                            <p className="text-xs text-emerald-500 mt-1">{kpi.trend} {kpi.trendLabel}</p>
                        )}
                    </div>
                ))}
            </div>

            {/* Recent Schools */}
            <div className="bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-white/5 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="font-bold text-lg text-gray-900 dark:text-white">Écoles récentes</h2>
                    <Link href="/super-admin/schools" className="text-sm text-purple-500 dark:text-purple-400 hover:underline">
                        Voir tout →
                    </Link>
                </div>

                {recentSchools.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <Building2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p>Aucune école</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {recentSchools.map(school => (
                            <Link
                                key={school.id}
                                href={`/super-admin/schools/${school.id}`}
                                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900/50 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-900 transition-colors group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500">
                                        <Building2 className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white group-hover:text-purple-500 dark:group-hover:text-purple-400 transition-colors">{school.name}</p>
                                        <p className="text-xs text-gray-500">
                                            Créée le {new Date(school.created_at).toLocaleDateString('fr-FR')}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={cn(
                                        "px-2 py-1 rounded-full text-xs font-bold",
                                        school.is_active
                                            ? "bg-emerald-500/10 text-emerald-500"
                                            : "bg-red-500/10 text-red-500"
                                    )}>
                                        {school.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
