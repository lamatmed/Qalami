'use client'

import { useState, useEffect } from 'react'
import { Building2, ArrowLeft, Eye, Users, GraduationCap, BookOpen, Loader2, ExternalLink, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'

interface AccessSchoolProps {
    schoolId: string
}

export function AccessSchool({ schoolId }: AccessSchoolProps) {
    const supabase = createClient()
    const [school, setSchool] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchSchool = async () => {
            try {
                const { data } = await supabase
                    .from('schools')
                    .select('*')
                    .eq('id', schoolId)
                    .single()

                setSchool(data)
            } catch (error) {
                console.error('Error:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchSchool()
    }, [schoolId])

    const accessAs = (role: 'admin' | 'teacher' | 'student' | 'parent') => {
        // Store the school context in sessionStorage for the target pages to read
        sessionStorage.setItem('superAdminViewingSchool', JSON.stringify({
            id: school.id,
            name: school.name,
            role: role
        }))

        // Navigate to the corresponding dashboard
        const routes: Record<string, string> = {
            admin: '/admin',
            teacher: '/teacher',
            student: '/student',
            parent: '/parent'
        }

        window.open(routes[role], '_blank')
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

    const accessOptions = [
        { role: 'admin', label: 'Administrateur', icon: Shield, color: 'emerald', description: 'Tableau de bord admin, gestion des élèves, finances...' },
        { role: 'teacher', label: 'Enseignant', icon: BookOpen, color: 'indigo', description: 'Planning, notes, devoirs, quiz...' },
        { role: 'student', label: 'Élève', icon: GraduationCap, color: 'blue', description: 'Vue élève, cours, devoirs, résultats...' },
        { role: 'parent', label: 'Parent', icon: Users, color: 'amber', description: 'Suivi des enfants, paiements, communication...' },
    ]

    return (
        <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <Link href={`/super-admin/schools/${schoolId}`}>
                    <Button variant="ghost" size="icon" className="rounded-xl text-gray-400 hover:text-white">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                </Link>
                <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                        <Building2 className="w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white">Accéder à {school.name}</h1>
                        <p className="text-gray-500">Choisissez un rôle pour visualiser l'interface</p>
                    </div>
                </div>
            </div>

            {/* Warning Banner */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-8 flex items-center gap-3">
                <Eye className="w-5 h-5 text-amber-500 shrink-0" />
                <p className="text-sm text-amber-200">
                    <strong>Mode lecture seule.</strong> Vous visualisez les interfaces de cette école à des fins de débogage. Les modifications seront effectuées avec le contexte de cette école.
                </p>
            </div>

            {/* Access Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {accessOptions.map((option) => (
                    <button
                        key={option.role}
                        onClick={() => accessAs(option.role as any)}
                        className={cn(
                            "bg-slate-800/50 border border-white/5 rounded-2xl p-6 text-left hover:border-purple-500/30 transition-all group"
                        )}
                    >
                        <div className="flex items-start gap-4">
                            <div className={cn(
                                "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
                                option.color === 'emerald' && "bg-emerald-500/10 text-emerald-500",
                                option.color === 'indigo' && "bg-indigo-500/10 text-indigo-500",
                                option.color === 'blue' && "bg-blue-500/10 text-blue-500",
                                option.color === 'amber' && "bg-amber-500/10 text-amber-500"
                            )}>
                                <option.icon className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                    <h3 className="font-bold text-white group-hover:text-purple-400 transition-colors">
                                        {option.label}
                                    </h3>
                                    <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-purple-400 transition-colors" />
                                </div>
                                <p className="text-sm text-gray-500">{option.description}</p>
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {/* Info */}
            <div className="mt-8 bg-slate-800/30 rounded-2xl p-6 text-center">
                <p className="text-sm text-gray-500">
                    Les interfaces s'ouvriront dans un nouvel onglet. Fermez l'onglet pour revenir ici.
                </p>
            </div>
        </div>
    )
}
