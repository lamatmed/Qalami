'use client'

import { cn } from '@/lib/utils'
import { Check, Minus, Eye, Shield, Info } from 'lucide-react'

// ─── Data ──────────────────────────────────────────────────────────────────────

type AccessLevel = 'full' | 'view' | 'partial' | 'none'

interface FeatureRow {
    category?: string        // section header
    feature?: string         // feature label
    desc?: string
    access?: Record<Role, AccessLevel>
}

type Role = 'super_admin' | 'admin' | 'teacher' | 'parent' | 'student'

const ROLES: { id: Role; label: string; color: string }[] = [
    { id: 'super_admin', label: 'Super Admin', color: 'text-red-400' },
    { id: 'admin',       label: 'Admin',       color: 'text-indigo-400' },
    { id: 'teacher',     label: 'Enseignant',  color: 'text-amber-400' },
    { id: 'parent',      label: 'Parent',      color: 'text-blue-400' },
    { id: 'student',     label: 'Élève',       color: 'text-emerald-400' },
]

const PERMISSIONS: FeatureRow[] = [
    { category: 'Administration' },
    {
        feature: 'Tableau de bord',
        desc: "Vue d'ensemble et statistiques",
        access: { super_admin: 'full', admin: 'full', teacher: 'partial', parent: 'partial', student: 'partial' },
    },
    {
        feature: 'Gestion des élèves',
        desc: 'Inscription, profils, dossiers',
        access: { super_admin: 'full', admin: 'full', teacher: 'view', parent: 'none', student: 'none' },
    },
    {
        feature: 'Gestion des enseignants',
        desc: 'Profils, contrats, affectations',
        access: { super_admin: 'full', admin: 'full', teacher: 'none', parent: 'none', student: 'none' },
    },
    {
        feature: 'Paramètres école',
        desc: 'Configuration générale, identité',
        access: { super_admin: 'full', admin: 'full', teacher: 'none', parent: 'none', student: 'none' },
    },

    { category: 'Pédagogie' },
    {
        feature: 'Emploi du temps',
        desc: 'Consultation et modification',
        access: { super_admin: 'full', admin: 'full', teacher: 'view', parent: 'view', student: 'view' },
    },
    {
        feature: 'Affectations enseignants',
        desc: 'Classe × matière × enseignant',
        access: { super_admin: 'full', admin: 'full', teacher: 'view', parent: 'none', student: 'none' },
    },
    {
        feature: 'Notes & Évaluations',
        desc: 'Saisie des notes et bulletins',
        access: { super_admin: 'full', admin: 'full', teacher: 'full', parent: 'view', student: 'view' },
    },
    {
        feature: 'Présences & Absences',
        desc: 'Pointage et historique',
        access: { super_admin: 'full', admin: 'full', teacher: 'full', parent: 'view', student: 'none' },
    },
    {
        feature: 'Matières & Programmes',
        desc: 'Gestion des matières',
        access: { super_admin: 'full', admin: 'full', teacher: 'view', parent: 'none', student: 'none' },
    },

    { category: 'Finance' },
    {
        feature: 'Scolarité & Paiements',
        desc: 'Suivi des paiements élèves',
        access: { super_admin: 'full', admin: 'full', teacher: 'none', parent: 'view', student: 'none' },
    },
    {
        feature: 'Comptabilité générale',
        desc: 'Transactions, trésorerie',
        access: { super_admin: 'full', admin: 'full', teacher: 'none', parent: 'none', student: 'none' },
    },
    {
        feature: 'Paie enseignants',
        desc: 'Salaires et fiche de paie',
        access: { super_admin: 'full', admin: 'full', teacher: 'view', parent: 'none', student: 'none' },
    },

    { category: 'Communication' },
    {
        feature: 'Annonces',
        desc: 'Création et consultation',
        access: { super_admin: 'full', admin: 'full', teacher: 'partial', parent: 'view', student: 'view' },
    },
    {
        feature: 'Messagerie',
        desc: 'Communication interne',
        access: { super_admin: 'full', admin: 'full', teacher: 'full', parent: 'full', student: 'partial' },
    },
]

// ─── Access cell ───────────────────────────────────────────────────────────────

function AccessCell({ level }: { level: AccessLevel }) {
    if (level === 'full')    return <div className="flex justify-center"><div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center"><Check className="w-3 h-3 text-emerald-400" /></div></div>
    if (level === 'view')    return <div className="flex justify-center"><div className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center"><Eye className="w-3 h-3 text-blue-400" /></div></div>
    if (level === 'partial') return <div className="flex justify-center"><div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center"><span className="w-2 h-2 rounded-full bg-amber-400" /></div></div>
    return <div className="flex justify-center"><div className="w-5 h-5 rounded-full flex items-center justify-center"><Minus className="w-3 h-3 text-gray-700" /></div></div>
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function RolesPermissions() {
    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            <div>
                <h3 className="text-xl font-bold text-white">Rôles & Permissions</h3>
                <p className="text-gray-400 text-sm mt-1">
                    Matrice des accès par profil utilisateur dans Qalami.
                </p>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4">
                {[
                    { label: 'Accès complet', bg: 'bg-emerald-500/20 border-emerald-500/30', icon: <Check className="w-3 h-3 text-emerald-400" /> },
                    { label: 'Lecture seule', bg: 'bg-blue-500/20 border-blue-500/30', icon: <Eye className="w-3 h-3 text-blue-400" /> },
                    { label: 'Partiel',       bg: 'bg-amber-500/20 border-amber-500/30', icon: <span className="w-2 h-2 rounded-full bg-amber-400" /> },
                    { label: 'Aucun accès',  bg: 'bg-transparent border-white/10', icon: <Minus className="w-3 h-3 text-gray-700" /> },
                ].map(item => (
                    <div key={item.label} className="flex items-center gap-2 text-xs text-gray-400">
                        <div className={cn("w-5 h-5 rounded-full border flex items-center justify-center", item.bg)}>
                            {item.icon}
                        </div>
                        {item.label}
                    </div>
                ))}
            </div>

            {/* Matrix */}
            <div className="bg-[#1A2530] rounded-2xl border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/5 bg-[#0F1720]">
                                <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-56">Fonctionnalité</th>
                                {ROLES.map(role => (
                                    <th key={role.id} className="px-4 py-3 text-center">
                                        <div className="flex flex-col items-center gap-1">
                                            <div className={cn("w-7 h-7 rounded-full flex items-center justify-center bg-white/5", role.color.replace('text-', 'border-') + '/30 border')}>
                                                <Shield className={cn("w-3.5 h-3.5", role.color)} />
                                            </div>
                                            <span className={cn("text-[11px] font-bold whitespace-nowrap", role.color)}>
                                                {role.label}
                                            </span>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {PERMISSIONS.map((row, i) => {
                                if (row.category) {
                                    return (
                                        <tr key={`cat-${i}`} className="border-t border-white/5 bg-[#0F1720]/50">
                                            <td colSpan={6} className="px-5 py-2">
                                                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">
                                                    {row.category}
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                }
                                return (
                                    <tr key={`feat-${i}`} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                                        <td className="px-5 py-3">
                                            <p className="font-medium text-gray-200 text-sm">{row.feature}</p>
                                            {row.desc && <p className="text-[11px] text-gray-600 mt-0.5">{row.desc}</p>}
                                        </td>
                                        {ROLES.map(role => (
                                            <td key={role.id} className="px-4 py-3">
                                                <AccessCell level={row.access?.[role.id] ?? 'none'} />
                                            </td>
                                        ))}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Info note */}
            <div className="flex items-start gap-3 bg-[#1A2530] border border-white/5 rounded-xl p-4 text-sm text-gray-400">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-gray-500" />
                <div>
                    <p className="font-semibold text-gray-300">{"Permissions codées dans l'application"}</p>
                    <p className="text-xs text-gray-500 mt-1">
                        Les rôles et permissions actuels sont définis dans le code source. La personnalisation fine par utilisateur (ex : un enseignant qui peut voir la finance) nécessite une extension du schéma de base de données avec une table <code className="bg-white/10 px-1 rounded">role_permissions</code>.
                    </p>
                </div>
            </div>
        </div>
    )
}
