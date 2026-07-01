'use client'

import { Building2, Users, GraduationCap, ArrowRight, CheckCircle2, XCircle, Sparkles, Clock } from 'lucide-react'
import { cn, proxyStorageUrl } from '@/lib/utils'
import Link from 'next/link'
import { useLanguage } from '@/i18n'
import { motion } from 'framer-motion'

interface GlobalStats {
    totalSchools: number
    activeSchools: number
    totalStudents: number
    totalTeachers: number
    totalParents: number
}

interface Props {
    stats: GlobalStats
    recentSchools: any[]
}

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.08
        }
    }
}

const itemVariants = {
    hidden: { y: 15, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: { type: 'spring' as const, stiffness: 320, damping: 26 }
    }
}

export function SuperAdminDashboard({ stats, recentSchools }: Props) {
    const { t, direction } = useLanguage()

    const kpis = [
        {
            label: t('superAdmin.dashboard.schools') || 'Schools',
            value: stats.totalSchools,
            icon: Building2,
            color: "from-purple-600 to-indigo-600",
            glowColor: "group-hover:shadow-purple-500/10",
            iconBg: "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-500/20",
            trend: `${stats.activeSchools} ${t('superAdmin.dashboard.active') || 'Actives'}`
        },
        {
            label: t('superAdmin.dashboard.students') || 'Students',
            value: stats.totalStudents,
            icon: GraduationCap,
            color: "from-blue-600 to-cyan-600",
            glowColor: "group-hover:shadow-blue-500/10",
            iconBg: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-500/20"
        },
        {
            label: t('superAdmin.dashboard.teachers') || 'Teachers',
            value: stats.totalTeachers,
            icon: Users,
            color: "from-amber-600 to-orange-600",
            glowColor: "group-hover:shadow-amber-500/10",
            iconBg: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-500/20"
        },
        {
            label: t('superAdmin.dashboard.parents') || 'Parents',
            value: stats.totalParents,
            icon: Users,
            color: "from-emerald-600 to-teal-600",
            glowColor: "group-hover:shadow-emerald-500/10",
            iconBg: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20"
        },
    ]

    const isRTL = direction === 'rtl'

    return (
        <motion.div 
            className="space-y-10 pb-12 select-none font-sans"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            {/* Luxurious Header Section */}
            <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
                <div className="relative z-10">
                    <div className="inline-flex items-center gap-2 text-purple-600 dark:text-purple-400 font-black text-[11px] tracking-[0.2em] uppercase mb-2 bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20 rounded-full px-3.5 py-1 shadow-sm">
                        <Sparkles className="w-3 h-3 fill-purple-600 dark:fill-purple-400" />
                        <span>{t('superAdmin.dashboard.title') || 'CONSOLE PRINCIPALE'}</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white mt-1 leading-none flex items-center gap-3">
                        Tableau de Bord
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-semibold mt-2 text-sm md:text-base max-w-xl leading-relaxed">
                        {t('superAdmin.dashboard.subtitle') || 'Vue globale et pilotage centralisé de la plateforme éducative.'}
                    </p>
                </div>
                
                {/* Real-time indicator */}
                <div className="flex items-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-300 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-5 py-3 rounded-2xl border border-slate-150 dark:border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.03)] shrink-0 self-start md:self-auto transition-all hover:scale-[1.02]">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-sm"></span>
                    </span>
                    <span>Système Connecté</span>
                </div>
            </motion.div>

            {/* KPI Supercharged Grid */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                {kpis.map((kpi, idx) => (
                    <div 
                        key={idx} 
                        className={cn(
                            "group relative bg-white dark:bg-slate-900/50 border border-slate-150 dark:border-white/5 rounded-3xl p-6 overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-xl hover:-translate-y-1.5 transition-all duration-500",
                            kpi.glowColor
                        )}
                    >
                        {/* Subtle animated gradient border on top */}
                        <div className={cn("absolute top-0 inset-x-0 h-1 bg-gradient-to-r opacity-50 dark:opacity-80", kpi.color)} />
                        
                        {/* Ambient back glow */}
                        <div className={cn(
                            "absolute -right-10 -bottom-10 w-36 h-36 bg-gradient-to-br blur-3xl opacity-0 group-hover:opacity-15 dark:group-hover:opacity-20 transition-opacity duration-700 rounded-full pointer-events-none",
                            kpi.color
                        )} />

                        <div className="flex justify-between items-start mb-5 relative z-10">
                            <div className={cn("p-3 rounded-2xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 border shadow-sm", kpi.iconBg)}>
                                <kpi.icon className="w-6 h-6" />
                            </div>
                            
                            {kpi.trend && (
                                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider shadow-sm">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    {kpi.trend}
                                </div>
                            )}
                        </div>
                        
                        <div className="relative z-10 space-y-1">
                            <p className="text-[10px] font-black tracking-[0.15em] text-slate-400 dark:text-slate-500 uppercase">
                                {kpi.label}
                            </p>
                            <div className="flex items-baseline gap-1 mt-1">
                                <span className="text-4xl font-black tracking-tight text-slate-900 dark:text-white tabular-nums">
                                    {kpi.value.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </motion.div>

            {/* Detailed Activity / Recent Schools Card */}
            <motion.div variants={itemVariants} className="bg-white/80 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-150 dark:border-white/5 rounded-3xl overflow-hidden shadow-[0_10px_40px_-10px_rgba(0,0,0,0.04)]">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 sm:p-8 border-b border-slate-100 dark:border-white/5 gap-4">
                    <div>
                        <h2 className="font-black text-xl md:text-2xl text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
                            <Building2 className="w-6 h-6 text-purple-500" />
                            {t('superAdmin.dashboard.recentSchools') || 'Derniers Établissements'}
                        </h2>
                        <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-semibold mt-1">
                            Suivi en temps réel des dernières écoles créées sur la plateforme.
                        </p>
                    </div>
                    <Link 
                        href="/super-admin/schools" 
                        className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 hover:bg-purple-600 hover:text-white dark:hover:bg-purple-500 bg-purple-50 dark:bg-purple-500/10 border border-purple-100/50 dark:border-purple-500/20 px-5 py-3 rounded-2xl transition-all group shadow-sm self-end sm:self-auto hover:scale-[1.02] active:scale-95"
                    >
                        {t('superAdmin.dashboard.viewAll') || 'Voir Tout'}
                        <ArrowRight className={cn("w-3.5 h-3.5 transition-transform", isRTL ? "group-hover:-translate-x-1" : "group-hover:translate-x-1")} />
                    </Link>
                </div>

                <div className="p-6 sm:p-8">
                    {recentSchools.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400 border border-dashed border-slate-200 dark:border-white/10 rounded-3xl bg-slate-50/50 dark:bg-slate-900/20">
                            <div className="bg-white dark:bg-slate-800 shadow-md border border-slate-100 dark:border-white/5 p-4.5 rounded-2xl mb-4 animate-bounce">
                                <Building2 className="w-8 h-8 text-purple-500 opacity-80" />
                            </div>
                            <p className="font-black text-slate-500 tracking-wide uppercase text-xs">{t('superAdmin.dashboard.noSchools') || 'Aucune école'}</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {recentSchools.map((school, i) => (
                                <Link
                                    key={school.id}
                                    href={`/super-admin/schools/${school.id}`}
                                    className="group flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-slate-50/50 dark:bg-slate-950/30 border border-slate-100/80 dark:border-white/5 hover:border-purple-500/30 dark:hover:border-purple-500/30 rounded-2xl hover:bg-white dark:hover:bg-slate-900 transition-all duration-300 shadow-sm hover:shadow-lg gap-4"
                                >
                                    <div className="flex items-center gap-4.5 min-w-0">
                                        {/* Glowing Ring Logo container */}
                                        <div className="w-13 h-13 rounded-2xl overflow-hidden bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400 border border-slate-200 dark:border-white/10 shadow-inner group-hover:ring-2 group-hover:ring-purple-500/30 dark:group-hover:ring-purple-500/20 transition-all shrink-0">
                                            {school.logo_url ? (
                                                <img src={proxyStorageUrl(school.logo_url) ?? undefined} alt={school.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                            ) : (
                                                <Building2 className="w-5.5 h-5.5 opacity-70 transition-colors group-hover:text-purple-500" />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors text-[15px] sm:text-base truncate leading-tight">
                                                {school.name}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3 shrink-0" />
                                                    {new Date(school.created_at).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </span>
                                                {school.phone && (
                                                    <>
                                                        <span className="text-slate-300 dark:text-slate-700">•</span>
                                                        <span className="text-slate-600 dark:text-slate-300 font-bold select-all" dir="ltr">
                                                            {school.phone}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center justify-between sm:justify-end gap-4.5 mt-2 sm:mt-0">
                                        <div className={cn(
                                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm",
                                            school.is_active
                                                ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                                                : "bg-red-50 text-red-600 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
                                        )}>
                                            {school.is_active ? (
                                                <CheckCircle2 className="w-3 h-3" />
                                            ) : (
                                                <XCircle className="w-3 h-3" />
                                            )}
                                            <span>
                                                {school.is_active ? (t('superAdmin.dashboard.activeLabel') || 'Actif') : (t('superAdmin.dashboard.inactiveLabel') || 'Suspendu')}
                                            </span>
                                        </div>
                                        
                                        <div className={cn(
                                            "p-2 rounded-xl bg-slate-100/80 dark:bg-white/5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-purple-500 dark:text-purple-400 border border-slate-200 dark:border-white/10 hidden sm:block",
                                            isRTL ? "group-hover:translate-x-0 translate-x-2" : ""
                                        )}>
                                            <ArrowRight className={cn("w-4 h-4", isRTL ? "rotate-180" : "")} />
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    )
}
