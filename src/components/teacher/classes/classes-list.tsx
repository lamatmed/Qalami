'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Users, ArrowRight, BookOpen, Phone, Building2, ChevronDown, Sparkles, GraduationCap } from 'lucide-react'
import { useLanguage } from '@/i18n'
import { SchoolGroup } from '@/app/teacher/classes/page'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface TeacherClassesListProps {
    schoolGroups: SchoolGroup[]
}

export function TeacherClassesList({ schoolGroups }: TeacherClassesListProps) {
    const { t, direction } = useLanguage()
    
    // Par défaut, toutes les écoles sont fermées
    const [expandedSchools, setExpandedSchools] = useState<Record<string, boolean>>({})

    const toggleSchool = (schoolId: string) => {
        setExpandedSchools(prev => ({
            ...prev,
            [schoolId]: prev[schoolId] === true ? false : true
        }))
    }

    const totalClasses = schoolGroups.reduce((acc, group) => acc + group.classes.length, 0)
    const isRTL = direction === 'rtl'

    return (
        <div className="space-y-10 pb-12 select-none animate-in fade-in duration-500 font-sans">
            {/* Luxurious Header Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-150 dark:border-white/10">
                <div>
                    <div className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-black text-[10px] tracking-[0.25em] uppercase mb-2 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-full px-3.5 py-1 shadow-sm">
                        <GraduationCap className="w-3.5 h-3.5" />
                        <span>{t('teacher.classes.portal') || 'PORTAIL ENSEIGNANT'}</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
                        {t('teacher.classes.title') || 'Mes Classes'}
                    </h1>
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-1.5 flex items-center gap-2 uppercase tracking-wide">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                        {totalClasses === 1 
                            ? (t('teacher.classes.assignedTotalOne')?.replace('{count}', '1') || '1 classe assignée au total')
                            : (t('teacher.classes.assignedTotal')?.replace('{count}', totalClasses.toString()) || `${totalClasses} classes assignées au total`)}
                    </p>
                </div>
            </div>

            {schoolGroups.length === 0 ? (
                <div className="p-16 text-center border border-dashed border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/40 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center shadow-sm">
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl mb-4 shadow-inner border border-slate-100 dark:border-white/5">
                        <BookOpen className="w-8 h-8 text-indigo-500 opacity-80" />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 font-black uppercase tracking-wider text-xs">
                        {t('teacher.classes.noClasses') || 'Aucune classe assignée'}
                    </p>
                </div>
            ) : (
                schoolGroups.map((group) => {
                    const isExpanded = expandedSchools[group.id] === true

                    return (
                        <div key={group.id} className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                            
                            {/* Collapsible Glass Header */}
                            <div 
                                onClick={() => toggleSchool(group.id)}
                                className={cn(
                                    "flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 dark:bg-slate-900/40 backdrop-blur-xl p-5 rounded-[28px] border border-slate-150 dark:border-white/5 shadow-[0_4px_25px_-10px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all duration-300 cursor-pointer select-none group/header active:scale-[0.99]",
                                    isExpanded && "ring-1 ring-indigo-500/20 bg-indigo-50/10 dark:bg-indigo-950/10"
                                )}
                            >
                                <div className="flex items-center gap-4 min-w-0">
                                    {/* Luxury Logo Holder */}
                                    <div className="relative shrink-0">
                                        <div className="absolute -inset-1 bg-gradient-to-tr from-indigo-500 to-teal-400 rounded-2xl opacity-10 group-hover/header:opacity-30 transition-opacity blur-sm" />
                                        <Avatar className="h-14 w-14 rounded-2xl border border-slate-150 dark:border-white/10 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] bg-white dark:bg-slate-950 relative object-cover flex items-center justify-center overflow-hidden group-hover/header:scale-[1.03] transition-transform duration-300">
                                            <AvatarImage src={group.logoUrl || undefined} className="object-cover" />
                                            <AvatarFallback className="rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 text-indigo-600 dark:text-indigo-400 font-black">
                                                <Building2 className="w-5.5 h-5.5" />
                                            </AvatarFallback>
                                        </Avatar>
                                    </div>
                                    
                                    <div className="min-w-0">
                                        <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white tracking-tight group-hover/header:text-indigo-600 dark:group-hover/header:text-indigo-400 transition-colors truncate leading-tight">
                                            {group.name}
                                        </h2>
                                        <div className="flex items-center gap-1.5 mt-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                            <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-widest opacity-90">
                                                {group.classes.length === 1 
                                                    ? (t('teacher.classes.assignedOne')?.replace('{count}', '1') || '1 classe assignée')
                                                    : (t('teacher.classes.assigned')?.replace('{count}', group.classes.length.toString()) || `${group.classes.length} classes assignées`)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Accessories */}
                                <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto shrink-0">
                                    {group.phone && (
                                        <div 
                                            onClick={(e) => e.stopPropagation()}
                                            className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-50/80 dark:bg-emerald-500/10 rounded-[14px] border border-emerald-100 dark:border-emerald-500/20 shadow-[0_2px_8px_-2px_rgba(16,185,129,0.05)] shrink-0 select-all"
                                        >
                                            <Phone className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                            <span className="text-xs font-black font-mono text-emerald-700 dark:text-emerald-400 tracking-wider" dir="ltr">{group.phone}</span>
                                        </div>
                                    )}

                                    {/* Techy expand chevron */}
                                    <div className={cn(
                                        "h-9 w-9 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-white/5 text-slate-400 transition-all duration-300 group-hover/header:text-indigo-600 shadow-inner shrink-0",
                                        isExpanded ? "rotate-180 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 border-indigo-100 dark:border-indigo-500/20" : "rotate-0"
                                    )}>
                                        <ChevronDown className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>

                            {/* Expandable Classes Grid */}
                            <AnimatePresence initial={false}>
                                {isExpanded && (
                                    <motion.div
                                        key="content"
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                                        className="overflow-hidden"
                                    >
                                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 pt-1 pb-2 px-0.5">
                                            {group.classes.map((cls) => (
                                                <Link key={cls.id} href={`/teacher/classes/${cls.id}`} className="block group">
                                                    <div className="h-full bg-white dark:bg-slate-900/40 border border-slate-150 dark:border-white/5 rounded-[24px] hover:border-indigo-500/30 dark:hover:border-indigo-500/30 hover:shadow-[0_10px_30px_-10px_rgba(0,0,0,0.05)] transition-all duration-300 flex flex-col justify-between relative overflow-hidden cursor-pointer hover:-translate-y-1">
                                                        
                                                        {/* Luminous Top Border bar */}
                                                        <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-indigo-500 to-teal-400" />
                                                        
                                                        {/* Soft back glow on card hover */}
                                                        <div className="absolute -top-20 -right-20 w-40 h-40 bg-indigo-500/5 dark:bg-indigo-500/10 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                                                        <div className="p-6 pb-4">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <h3 className="text-lg font-black text-slate-900 dark:text-white truncate pr-1 tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                                    {cls.name}
                                                                </h3>
                                                                <div className="p-2 bg-indigo-50/80 dark:bg-indigo-500/10 rounded-xl border border-indigo-100/50 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 shrink-0 group-hover:scale-110 duration-300 shadow-sm">
                                                                    <Users className="w-4 h-4" />
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mt-2 tracking-wider">
                                                                {cls.level && <span>{cls.level}</span>}
                                                                {cls.level && <span className="text-slate-200 dark:text-slate-800">•</span>}
                                                                <span className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 px-2 py-0.5 rounded-md text-slate-600 dark:text-slate-400">
                                                                    {t('teacher.classes.studentsCount')
                                                                        .replace('{count}', cls.studentCount.toString())
                                                                        .replace('{plural}', cls.studentCount !== 1 ? 's' : '')
                                                                    }
                                                                </span>
                                                            </div>

                                                            {cls.subjects.length > 0 && (
                                                                <div className="mt-4 flex flex-wrap gap-1.5">
                                                                    {cls.subjects.map((subj) => (
                                                                        <span 
                                                                            key={subj}
                                                                            className="text-[9px] font-black bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-100/50 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-300 px-2.5 py-1 rounded-full shadow-sm uppercase tracking-wider"
                                                                        >
                                                                            {subj}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Dynamic Footer Action Link */}
                                                        <div className="mx-6 mb-6 mt-3 pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                                                            <span>{t('teacher.classes.viewClass') || 'Consulter la Classe'}</span>
                                                            <div className={cn("p-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5 opacity-80 group-hover:opacity-100 transition-all", isRTL ? "group-hover:-translate-x-1" : "group-hover:translate-x-1")}>
                                                                <ArrowRight className={cn("w-3 h-3", isRTL ? "rotate-180" : "")} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )
                })
            )}
        </div>
    )
}
