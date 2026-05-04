'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Save, Loader2, Bell, BellOff, Mail, Smartphone, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getMySchoolContext } from '@/app/admin/actions'

// ─── Config ────────────────────────────────────────────────────────────────────

interface NotifEvent {
    id: string
    label: string
    desc: string
    recipients: string
    defaultApp: boolean
    defaultEmail: boolean
}

interface NotifCategory {
    id: string
    label: string
    color: string
    events: NotifEvent[]
}

const CATEGORIES: NotifCategory[] = [
    {
        id: 'payments',
        label: 'Paiements',
        color: 'text-emerald-400',
        events: [
            { id: 'payment_received',  label: 'Paiement reçu',           desc: 'Confirmation immédiate après encaissement',    recipients: 'Parent',          defaultApp: true,  defaultEmail: true },
            { id: 'payment_overdue',   label: 'Paiement en retard',       desc: 'Rappel automatique après la date d\'échéance', recipients: 'Parent, Admin',   defaultApp: true,  defaultEmail: true },
            { id: 'payment_partial',   label: 'Paiement partiel',         desc: 'Solde restant à régler',                       recipients: 'Parent',          defaultApp: true,  defaultEmail: false },
        ],
    },
    {
        id: 'attendance',
        label: 'Présences',
        color: 'text-blue-400',
        events: [
            { id: 'absence_marked',    label: 'Absence signalée',         desc: 'Alerte dès que l\'absence est pointée',        recipients: 'Parent',          defaultApp: true,  defaultEmail: false },
            { id: 'late_arrival',      label: 'Retard enregistré',        desc: 'Notification au parent en temps réel',         recipients: 'Parent',          defaultApp: true,  defaultEmail: false },
            { id: 'absence_justified', label: 'Absence justifiée',        desc: 'Confirmation de traitement de l\'absence',     recipients: 'Parent',          defaultApp: false, defaultEmail: false },
        ],
    },
    {
        id: 'grades',
        label: 'Notes & Bulletins',
        color: 'text-violet-400',
        events: [
            { id: 'grade_published',   label: 'Notes publiées',           desc: 'Disponibles dans l\'espace parent/élève',      recipients: 'Parent, Élève',   defaultApp: true,  defaultEmail: true },
            { id: 'bulletin_ready',    label: 'Bulletin disponible',      desc: 'Fin de trimestre — bulletin téléchargeable',   recipients: 'Parent',          defaultApp: true,  defaultEmail: true },
            { id: 'grade_warning',     label: 'Alerte résultats',         desc: 'Résultats en baisse significative',            recipients: 'Parent, Admin',   defaultApp: false, defaultEmail: false },
        ],
    },
    {
        id: 'general',
        label: 'Général',
        color: 'text-amber-400',
        events: [
            { id: 'enrollment_confirmed', label: 'Inscription confirmée', desc: 'Accueil du nouvel élève dans l\'école',        recipients: 'Parent',          defaultApp: true,  defaultEmail: true },
            { id: 'schedule_changed',     label: 'Emploi du temps modifié', desc: 'Changement de dernière minute',              recipients: 'Parent, Enseignant', defaultApp: true, defaultEmail: false },
            { id: 'announcement_posted',  label: 'Nouvelle annonce',      desc: 'Publication dans le tableau d\'annonces',      recipients: 'Tous',            defaultApp: true,  defaultEmail: false },
        ],
    },
]

type NotifState = Record<string, { app: boolean; email: boolean }>

function buildDefault(): NotifState {
    const state: NotifState = {}
    CATEGORIES.forEach(cat => {
        cat.events.forEach(ev => {
            state[ev.id] = { app: ev.defaultApp, email: ev.defaultEmail }
        })
    })
    return state
}

const STORAGE_KEY = 'qalami_notification_settings'

// ─── Component ─────────────────────────────────────────────────────────────────

export function NotificationSettings() {
    const [settings, setSettings] = useState<NotifState>(buildDefault())
    const [saving, setSaving] = useState(false)
    const [schoolId, setSchoolId] = useState<string | null>(null)

    useEffect(() => {
        async function init() {
            const supabase = createClient()
            const ctx = await getMySchoolContext()
            const sid = ctx?.school_id ?? null
            setSchoolId(sid)

            const key = sid ? `${STORAGE_KEY}_${sid}` : STORAGE_KEY
            const stored = localStorage.getItem(key)
            if (stored) {
                try {
                    setSettings({ ...buildDefault(), ...JSON.parse(stored) })
                } catch { /* ignore */ }
            }
        }
        init()
    }, [])

    const toggle = (eventId: string, channel: 'app' | 'email') => {
        setSettings(prev => ({
            ...prev,
            [eventId]: { ...prev[eventId], [channel]: !prev[eventId][channel] },
        }))
    }

    const toggleCategory = (cat: NotifCategory, channel: 'app' | 'email') => {
        const anyOn = cat.events.some(ev => settings[ev.id]?.[channel])
        setSettings(prev => {
            const next = { ...prev }
            cat.events.forEach(ev => {
                next[ev.id] = { ...next[ev.id], [channel]: !anyOn }
            })
            return next
        })
    }

    const handleSave = async () => {
        setSaving(true)
        const key = schoolId ? `${STORAGE_KEY}_${schoolId}` : STORAGE_KEY
        localStorage.setItem(key, JSON.stringify(settings))

        // Try to persist to DB
        const supabase = createClient()
        if (schoolId) {
            await supabase
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .from('school_notification_settings' as any)
                .upsert({ school_id: schoolId, settings }, { onConflict: 'school_id' })
                // Silently ignore if table doesn't exist
                .then(() => {})
        }

        toast.success('Préférences de notification sauvegardées')
        setSaving(false)
    }

    const enabledCount = Object.values(settings).filter(s => s.app || s.email).length
    const totalCount = Object.keys(settings).length

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h3 className="text-xl font-bold text-white">Notifications</h3>
                    <p className="text-gray-400 text-sm mt-1">
                        Configurez quels événements déclenchent une alerte et sur quel canal.
                    </p>
                </div>
                <div className="text-xs text-gray-500 font-mono shrink-0">
                    {enabledCount}/{totalCount} actifs
                </div>
            </div>

            {/* Channel legend */}
            <div className="flex gap-4 p-4 bg-[#1A2530] rounded-xl border border-white/5">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                        <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                    </div>
                    <span><strong className="text-gray-300">Application</strong> — Notification in-app et push mobile</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                    <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                        <Mail className="w-3.5 h-3.5 text-cyan-400" />
                    </div>
                    <span><strong className="text-gray-300">Email</strong> — Envoi automatique par courriel</span>
                </div>
            </div>

            {/* Categories */}
            <div className="space-y-6">
                {CATEGORIES.map(cat => {
                    const allApp   = cat.events.every(ev => settings[ev.id]?.app)
                    const allEmail = cat.events.every(ev => settings[ev.id]?.email)

                    return (
                        <div key={cat.id} className="bg-[#1A2530] rounded-2xl border border-white/5 overflow-hidden">
                            {/* Category header */}
                            <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-[#0F1720]/50">
                                <span className={cn("text-xs font-bold uppercase tracking-wider", cat.color)}>
                                    {cat.label}
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-gray-600 me-1">Tout activer :</span>
                                    <ChannelToggle
                                        active={allApp}
                                        icon={<Smartphone className="w-3 h-3" />}
                                        color="indigo"
                                        onClick={() => toggleCategory(cat, 'app')}
                                        small
                                    />
                                    <ChannelToggle
                                        active={allEmail}
                                        icon={<Mail className="w-3 h-3" />}
                                        color="cyan"
                                        onClick={() => toggleCategory(cat, 'email')}
                                        small
                                    />
                                </div>
                            </div>

                            {/* Events */}
                            <div className="divide-y divide-white/5">
                                {cat.events.map(ev => {
                                    const state = settings[ev.id] ?? { app: false, email: false }
                                    const anyOn = state.app || state.email

                                    return (
                                        <div
                                            key={ev.id}
                                            className={cn(
                                                "flex items-center gap-4 px-5 py-3.5 transition-colors",
                                                !anyOn && "opacity-50"
                                            )}
                                        >
                                            {/* Bell icon */}
                                            <div className={cn(
                                                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                                                anyOn ? "bg-white/5" : "bg-white/[0.02]"
                                            )}>
                                                {anyOn
                                                    ? <Bell className="w-3.5 h-3.5 text-gray-400" />
                                                    : <BellOff className="w-3.5 h-3.5 text-gray-700" />}
                                            </div>

                                            {/* Label + description */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-white">{ev.label}</p>
                                                <p className="text-xs text-gray-500">{ev.desc}</p>
                                                <p className="text-[10px] text-gray-600 mt-0.5">→ {ev.recipients}</p>
                                            </div>

                                            {/* Toggles */}
                                            <div className="flex items-center gap-2 shrink-0">
                                                <ChannelToggle
                                                    active={state.app}
                                                    icon={<Smartphone className="w-3 h-3" />}
                                                    color="indigo"
                                                    onClick={() => toggle(ev.id, 'app')}
                                                    label="App"
                                                />
                                                <ChannelToggle
                                                    active={state.email}
                                                    icon={<Mail className="w-3 h-3" />}
                                                    color="cyan"
                                                    onClick={() => toggle(ev.id, 'email')}
                                                    label="Email"
                                                />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Info */}
            <div className="flex items-start gap-3 bg-[#1A2530] border border-white/5 rounded-xl p-4 text-sm">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-gray-500" />
                <p className="text-xs text-gray-500">
                    {"Les préférences sont sauvegardées localement et synchronisées avec la table "}
                    <code className="bg-white/10 px-1 rounded">school_notification_settings</code>
                    {" si disponible. L'envoi effectif des emails nécessite la configuration d'un service SMTP dans les variables d'environnement."}
                </p>
            </div>

            <div className="flex justify-end">
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold"
                >
                    {saving ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Save className="w-4 h-4 me-2" />}
                    Sauvegarder
                </Button>
            </div>
        </div>
    )
}

// ─── Channel toggle button ─────────────────────────────────────────────────────

function ChannelToggle({
    active,
    icon,
    color,
    onClick,
    label,
    small,
}: {
    active: boolean
    icon: React.ReactNode
    color: 'indigo' | 'cyan'
    onClick: () => void
    label?: string
    small?: boolean
}) {
    const colors = {
        indigo: active
            ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400'
            : 'bg-white/5 border-white/10 text-gray-600 hover:text-gray-400',
        cyan: active
            ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
            : 'bg-white/5 border-white/10 text-gray-600 hover:text-gray-400',
    }

    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-1 rounded-lg border font-bold text-[11px] transition-all",
                small ? "px-1.5 py-1" : "px-2.5 py-1.5",
                colors[color]
            )}
        >
            {icon}
            {label && <span>{label}</span>}
        </button>
    )
}
