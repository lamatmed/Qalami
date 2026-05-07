'use client'

import { useState, useEffect } from 'react'
import { Building2, ArrowLeft, ArrowRight, Eye, Users, GraduationCap, BookOpen, Loader2, ExternalLink, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { useLanguage } from '@/i18n'

interface AccessSchoolProps {
    schoolId: string
}

export function AccessSchool({ schoolId }: AccessSchoolProps) {
    const { t, direction } = useLanguage()
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
        sessionStorage.setItem('superAdminViewingSchool', JSON.stringify({
            id: school.id,
            name: school.name,
            role: role
        }))

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
            <div className="flex items-center justify-center py-24 bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-3xl shadow-sm animate-pulse max-w-3xl mx-auto">
                <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
            </div>
        )
    }

    if (!school) {
        return (
            <div className="text-center py-24 bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-3xl shadow-sm text-gray-400 max-w-3xl mx-auto">
                <Building2 className="w-16 h-16 mx-auto mb-4 opacity-30 text-purple-600 animate-bounce" />
                <p className="font-bold text-gray-500">{t('superAdmin.accessSchool.notFound')}</p>
            </div>
        )
    }

    const accessOptions = [
        { role: 'admin', label: t('superAdmin.accessSchool.adminLabel'), icon: Shield, color: 'emerald', description: t('superAdmin.accessSchool.adminDesc') },
        { role: 'teacher', label: t('superAdmin.accessSchool.teacherLabel'), icon: BookOpen, color: 'indigo', description: t('superAdmin.accessSchool.teacherDesc') },
        { role: 'student', label: t('superAdmin.accessSchool.studentLabel'), icon: GraduationCap, color: 'blue', description: t('superAdmin.accessSchool.studentDesc') },
        { role: 'parent', label: t('superAdmin.accessSchool.parentLabel'), icon: Users, color: 'amber', description: t('superAdmin.accessSchool.parentDesc') },
    ]

    const BackIcon = direction === 'rtl' ? ArrowRight : ArrowLeft

    return (
        <div className="max-w-3xl mx-auto space-y-8 pb-12 animate-in fade-in duration-500" dir={direction}>
            {/* Header */}
            <div className="flex items-center gap-4.5">
                <Link href={`/super-admin/schools/${schoolId}`}>
                    <Button variant="ghost" size="icon" className="h-11 w-11 rounded-2xl text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-100 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 shadow-sm transition-all duration-300">
                        <BackIcon className="w-5 h-5" />
                    </Button>
                </Link>
                <div className="flex items-center gap-4">
                    <div className="h-15 w-15 rounded-2xl bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 border border-purple-100 dark:border-purple-500/20 flex items-center justify-center shrink-0">
                        <Building2 className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight leading-tight">
                            {t('superAdmin.accessSchool.title').replace('{name}', school.name)}
                        </h1>
                        <p className="text-sm font-semibold text-gray-400 mt-1">
                            {t('superAdmin.accessSchool.subtitle')}
                        </p>
                    </div>
                </div>
            </div>

            {/* Warning Banner */}
            <div className="bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-5 flex items-start gap-4.5 shadow-sm">
                <Eye className="w-5.5 h-5.5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                <p className="text-sm leading-relaxed">
                    <strong className="font-bold">{t('superAdmin.accessSchool.warningTitle')}</strong>
                    {t('superAdmin.accessSchool.warningDesc')}
                </p>
            </div>

            {/* Access Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {accessOptions.map((option) => (
                    <button
                        key={option.role}
                        onClick={() => accessAs(option.role as any)}
                        className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-3xl p-6 shadow-sm hover:shadow-md hover:border-purple-200 dark:hover:border-purple-500/20 transition-all duration-300 group"
                    >
                        <div className="flex items-start gap-4.5">
                            <div className={cn(
                                "h-13 w-13 rounded-2xl flex items-center justify-center shrink-0 border transition-all duration-300 group-hover:scale-105",
                                option.color === 'emerald' && "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
                                option.color === 'indigo' && "bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20",
                                option.color === 'blue' && "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
                                option.color === 'amber' && "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
                            )}>
                                <option.icon className="w-6.5 h-6.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                    <h3 className={cn("font-bold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors text-base", direction === 'rtl' ? 'text-right' : 'text-left')}>
                                        {option.label}
                                    </h3>
                                    <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors shrink-0" />
                                </div>
                                <p className={cn("text-xs font-semibold text-gray-400 dark:text-gray-500 leading-relaxed", direction === 'rtl' ? 'text-right' : 'text-left')}>
                                    {option.description}
                                </p>
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {/* Info Footer */}
            <div className="bg-gray-50/50 dark:bg-slate-950/20 border border-gray-100 dark:border-white/5 rounded-2xl p-5 text-center">
                <p className="text-xs font-bold text-gray-400 dark:text-gray-500">
                    {t('superAdmin.accessSchool.footerInfo')}
                </p>
            </div>
        </div>
    )
}
