'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Settings, Users, School, BookOpen, ChevronRight,
    Calendar, DollarSign, Shield, Bell,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/i18n'
import { SchoolIdentity }          from './school-identity'
import { SubjectsGrading }         from './subjects-grading'
import { GeneralSettings }         from './general-settings'
import { PersonnelManagement }     from './personnel-management'
import { AcademicYearsSettings }   from './academic-years-settings'
import { FeeStructures }           from './fee-structures'
import { RolesPermissions }        from './roles-permissions'
import { NotificationSettings }    from './notification-settings'

export function SettingsHub() {
    const [activeTab, setActiveTab] = useState('identity')
    const { t } = useLanguage()

    const menuItems = [
        // ── École ─────────────────────────────────────────────────────────────
        {
            group: 'École',
            items: [
                { id: 'identity',  label: t('admin.settings.schoolIdentity'),     icon: School,    desc: t('admin.settings.schoolIdentityDesc'),  component: SchoolIdentity,        color: 'text-indigo-500 bg-indigo-500/10' },
                { id: 'academic',  label: 'Années scolaires',                     icon: Calendar,  desc: 'Années, trimestres et calendrier',       component: AcademicYearsSettings, color: 'text-violet-500 bg-violet-500/10' },
                { id: 'fees',      label: 'Barème des frais',                     icon: DollarSign, desc: 'Scolarité, transport, cantine…',        component: FeeStructures,         color: 'text-amber-500 bg-amber-500/10' },
            ],
        },
        // ── Pédagogie ─────────────────────────────────────────────────────────
        {
            group: 'Pédagogie',
            items: [
                { id: 'subjects',  label: t('admin.settings.subjectsGrading'),    icon: BookOpen,  desc: t('admin.settings.subjectsGradingDesc'), component: SubjectsGrading,       color: 'text-emerald-500 bg-emerald-500/10' },
                { id: 'staff',     label: t('admin.settings.personnelManagement'), icon: Users,    desc: t('admin.settings.personnelDesc'),        component: PersonnelManagement,   color: 'text-pink-500 bg-pink-500/10' },
            ],
        },
        // ── Système ───────────────────────────────────────────────────────────
        {
            group: 'Système',
            items: [
                { id: 'roles',         label: 'Rôles & Permissions',      icon: Shield,  desc: 'Droits d\'accès par profil',               component: RolesPermissions,    color: 'text-blue-500 bg-blue-500/10' },
                { id: 'notifications', label: 'Notifications',             icon: Bell,    desc: 'Événements et canaux d\'alerte',           component: NotificationSettings, color: 'text-cyan-500 bg-cyan-500/10' },
                { id: 'general',       label: t('admin.settings.appSettings'), icon: Settings, desc: t('admin.settings.appSettingsDesc'), component: GeneralSettings,     color: 'text-gray-400 bg-gray-500/10' },
            ],
        },
    ]

    const ActiveComponent = menuItems
        .flatMap(g => g.items)
        .find(item => item.id === activeTab)?.component || SchoolIdentity

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-100px)] gap-6">
            {/* Sidebar Menu */}
            <div className="w-full lg:w-72 shrink-0 space-y-5 overflow-y-auto no-scrollbar">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-1">{t('admin.settings.configuration')}</h2>
                    <p className="text-gray-400 text-sm">{t('admin.settings.configurationDesc')}</p>
                </div>

                {menuItems.map(group => (
                    <div key={group.group} className="space-y-1.5">
                        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-1">
                            {group.group}
                        </p>
                        {group.items.map(item => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left group",
                                    activeTab === item.id
                                        ? "bg-[#1A2530] border-emerald-500/50 shadow-lg shadow-black/20"
                                        : "bg-[#0F1720] border-white/5 hover:bg-[#1A2530] hover:border-white/10"
                                )}
                            >
                                <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", item.color)}>
                                    <item.icon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className={cn(
                                        "font-bold text-sm truncate",
                                        activeTab === item.id ? "text-white" : "text-gray-300 group-hover:text-white"
                                    )}>
                                        {item.label}
                                    </h3>
                                    <p className="text-xs text-gray-600 truncate">{item.desc}</p>
                                </div>
                                {activeTab === item.id && (
                                    <ChevronRight className="w-4 h-4 text-emerald-500 shrink-0 animate-in slide-in-from-left-2" />
                                )}
                            </button>
                        ))}
                    </div>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 bg-[#0F1720] border border-white/5 rounded-3xl p-6 lg:p-8 overflow-y-auto shadow-2xl">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="h-full"
                    >
                        <ActiveComponent />
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    )
}
