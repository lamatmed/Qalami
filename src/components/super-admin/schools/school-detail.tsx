'use client'

import { useState, useEffect } from 'react'
import { Building2, ArrowLeft, Users, GraduationCap, Eye, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'

interface SchoolDetailProps {
    schoolId: string
}

export function SchoolDetail({ schoolId }: SchoolDetailProps) {
    const supabase = createClient()
    const router = useRouter()
    const [school, setSchool] = useState<any>(null)
    const [stats, setStats] = useState({ students: 0, teachers: 0, parents: 0, admins: 0 })
    const [loading, setLoading] = useState(true)
    const [toggling, setToggling] = useState(false)

    useEffect(() => {
        const fetchSchool = async () => {
            try {
                const { data } = await supabase
                    .from('schools')
                    .select('*')
                    .eq('id', schoolId)
                    .single()

                setSchool(data)

                // Fetch user counts
                const [studentsRes, teachersRes, parentsRes, adminsRes] = await Promise.all([
                    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('role', 'student'),
                    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('role', 'teacher'),
                    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('role', 'parent'),
                    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('role', 'admin'),
                ])

                setStats({
                    students: studentsRes.count ?? 0,
                    teachers: teachersRes.count ?? 0,
                    parents: parentsRes.count ?? 0,
                    admins: adminsRes.count ?? 0,
                })
            } catch (error) {
                console.error('Error fetching school:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchSchool()
    }, [schoolId])

    const toggleActive = async () => {
        if (!school) return
        setToggling(true)
        try {
            const { error } = await supabase
                .from('schools')
                .update({ is_active: !school.is_active })
                .eq('id', schoolId)

            if (error) throw error

            setSchool({ ...school, is_active: !school.is_active })
            toast.success(school.is_active ? 'École désactivée' : 'École activée')
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setToggling(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        )
    }

    if (!school) {
        return (
            <div className="text-center py-20">
                <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-500 opacity-50" />
                <p className="text-gray-500">École non trouvée</p>
            </div>
        )
    }

    const getPlanBadge = (plan: string) => {
        switch (plan) {
            case 'enterprise': return 'bg-purple-500/10 text-purple-400'
            case 'pro': return 'bg-blue-500/10 text-blue-400'
            default: return 'bg-gray-500/10 text-gray-400'
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/super-admin/schools">
                        <Button variant="ghost" size="icon" className="rounded-xl text-gray-400 hover:text-white">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                            <Building2 className="w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-white">{school.name}</h1>
                            <p className="text-gray-500">/{school.slug}</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        onClick={toggleActive}
                        disabled={toggling}
                        className={cn(
                            "border-white/10 rounded-xl",
                            school.is_active ? "text-emerald-400 hover:bg-emerald-500/10" : "text-red-400 hover:bg-red-500/10"
                        )}
                    >
                        {toggling ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : school.is_active ? (
                            <ToggleRight className="w-4 h-4 mr-2" />
                        ) : (
                            <ToggleLeft className="w-4 h-4 mr-2" />
                        )}
                        {school.is_active ? 'Active' : 'Inactive'}
                    </Button>
                    <Link href={`/super-admin/schools/${schoolId}/access`}>
                        <Button className="bg-purple-600 hover:bg-purple-500 text-white rounded-xl">
                            <Eye className="w-4 h-4 mr-2" /> Accéder à l'admin
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Élèves', value: stats.students, max: school.max_students, icon: GraduationCap, color: 'blue' },
                    { label: 'Enseignants', value: stats.teachers, icon: Users, color: 'indigo' },
                    { label: 'Parents', value: stats.parents, icon: Users, color: 'amber' },
                    { label: 'Admins', value: stats.admins, icon: Users, color: 'purple' },
                ].map((stat, idx) => (
                    <div key={idx} className="bg-slate-800/50 border border-white/5 rounded-2xl p-5">
                        <div className={cn(
                            "h-10 w-10 rounded-xl flex items-center justify-center mb-3",
                            stat.color === 'blue' && "bg-blue-500/10 text-blue-500",
                            stat.color === 'indigo' && "bg-indigo-500/10 text-indigo-500",
                            stat.color === 'amber' && "bg-amber-500/10 text-amber-500",
                            stat.color === 'purple' && "bg-purple-500/10 text-purple-500"
                        )}>
                            <stat.icon className="w-5 h-5" />
                        </div>
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">{stat.label}</p>
                        <p className="text-2xl font-black text-white">
                            {stat.value}
                            {stat.max && <span className="text-sm text-gray-500 font-normal"> / {stat.max}</span>}
                        </p>
                    </div>
                ))}
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-800/50 border border-white/5 rounded-2xl p-6">
                    <h2 className="font-bold text-white mb-4">Informations</h2>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Email</span>
                            <span className="text-white">{school.email || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Téléphone</span>
                            <span className="text-white">{school.phone || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Adresse</span>
                            <span className="text-white">{school.address || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Créée le</span>
                            <span className="text-white">{new Date(school.created_at).toLocaleDateString('fr-FR')}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800/50 border border-white/5 rounded-2xl p-6">
                    <h2 className="font-bold text-white mb-4">Abonnement</h2>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500">Plan</span>
                            <span className={cn("px-2 py-1 rounded-full text-xs font-bold uppercase", getPlanBadge(school.subscription_plan))}>
                                {school.subscription_plan}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Limite élèves</span>
                            <span className="text-white">{school.max_students}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500">Statut</span>
                            <span className={cn(
                                "px-2 py-1 rounded-full text-xs font-bold",
                                school.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                            )}>
                                {school.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
