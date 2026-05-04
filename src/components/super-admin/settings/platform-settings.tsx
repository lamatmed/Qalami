'use client'

import { useState } from 'react'
import { Settings, Globe, Bell, CreditCard, Save, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

export function PlatformSettings() {
    const [saving, setSaving] = useState(false)
    const [settings, setSettings] = useState({
        // General
        platformName: 'Qalami',
        defaultLanguage: 'fr',
        timezone: 'Africa/Nouakchott',

        // Subscription defaults
        defaultMaxStudents: 100,
        defaultPlan: 'free',

        // Notifications
        emailNotifications: true,
        adminAlerts: true,
        weeklyReports: true,

        // Features
        enableRegistration: true,
        enableParentAccess: true,
        enableStudentAccess: true,
        maintenanceMode: false,
    })

    const handleSave = async () => {
        setSaving(true)
        // Simulate saving
        await new Promise(resolve => setTimeout(resolve, 1000))
        toast.success('Paramètres enregistrés avec succès!')
        setSaving(false)
    }

    const updateSetting = (key: string, value: any) => {
        setSettings(prev => ({ ...prev, [key]: value }))
    }

    return (
        <div className="max-w-4xl space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-white">Configuration</h1>
                    <p className="text-gray-500">Paramètres généraux de la plateforme</p>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl"
                >
                    {saving ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Enregistrement...
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4 mr-2" />
                            Enregistrer
                        </>
                    )}
                </Button>
            </div>

            {/* General Settings */}
            <div className="bg-slate-800/50 border border-white/5 rounded-2xl p-6 space-y-6">
                <div className="flex items-center gap-4 pb-4 border-b border-white/5">
                    <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                        <Globe className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="font-bold text-white">Paramètres généraux</h2>
                        <p className="text-sm text-gray-500">Configuration de base de la plateforme</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="text-gray-400">Nom de la plateforme</Label>
                        <Input
                            value={settings.platformName}
                            onChange={(e) => updateSetting('platformName', e.target.value)}
                            className="bg-slate-900/50 border-white/10 text-white rounded-xl"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-gray-400">Langue par défaut</Label>
                        <select
                            value={settings.defaultLanguage}
                            onChange={(e) => updateSetting('defaultLanguage', e.target.value)}
                            className="w-full h-10 px-3 rounded-xl bg-slate-900/50 border border-white/10 text-white"
                        >
                            <option value="fr">Français</option>
                            <option value="ar">العربية</option>
                            <option value="en">English</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-gray-400">Fuseau horaire</Label>
                        <select
                            value={settings.timezone}
                            onChange={(e) => updateSetting('timezone', e.target.value)}
                            className="w-full h-10 px-3 rounded-xl bg-slate-900/50 border border-white/10 text-white"
                        >
                            <option value="Africa/Nouakchott">Africa/Nouakchott (GMT+0)</option>
                            <option value="Europe/Paris">Europe/Paris (GMT+1)</option>
                            <option value="UTC">UTC</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Subscription Defaults */}
            <div className="bg-slate-800/50 border border-white/5 rounded-2xl p-6 space-y-6">
                <div className="flex items-center gap-4 pb-4 border-b border-white/5">
                    <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                        <CreditCard className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="font-bold text-white">Abonnements par défaut</h2>
                        <p className="text-sm text-gray-500">Valeurs par défaut pour les nouvelles écoles</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="text-gray-400">Plan par défaut</Label>
                        <select
                            value={settings.defaultPlan}
                            onChange={(e) => updateSetting('defaultPlan', e.target.value)}
                            className="w-full h-10 px-3 rounded-xl bg-slate-900/50 border border-white/10 text-white"
                        >
                            <option value="free">Free</option>
                            <option value="pro">Pro</option>
                            <option value="enterprise">Enterprise</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-gray-400">Limite d'élèves par défaut</Label>
                        <Input
                            type="number"
                            value={settings.defaultMaxStudents}
                            onChange={(e) => updateSetting('defaultMaxStudents', parseInt(e.target.value) || 100)}
                            className="bg-slate-900/50 border-white/10 text-white rounded-xl"
                        />
                    </div>
                </div>
            </div>

            {/* Notifications */}
            <div className="bg-slate-800/50 border border-white/5 rounded-2xl p-6 space-y-6">
                <div className="flex items-center gap-4 pb-4 border-b border-white/5">
                    <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                        <Bell className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="font-bold text-white">Notifications</h2>
                        <p className="text-sm text-gray-500">Configuration des alertes et rapports</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {[
                        { key: 'emailNotifications', label: 'Notifications par email', description: 'Recevoir les notifications importantes par email' },
                        { key: 'adminAlerts', label: 'Alertes admin', description: 'Alertes pour les événements critiques de la plateforme' },
                        { key: 'weeklyReports', label: 'Rapports hebdomadaires', description: 'Recevoir un rapport récapitulatif chaque semaine' },
                    ].map(item => (
                        <div key={item.key} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl">
                            <div>
                                <p className="font-medium text-white">{item.label}</p>
                                <p className="text-sm text-gray-500">{item.description}</p>
                            </div>
                            <Switch
                                checked={(settings as any)[item.key]}
                                onCheckedChange={(checked) => updateSetting(item.key, checked)}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Feature Flags */}
            <div className="bg-slate-800/50 border border-white/5 rounded-2xl p-6 space-y-6">
                <div className="flex items-center gap-4 pb-4 border-b border-white/5">
                    <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <Settings className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="font-bold text-white">Fonctionnalités</h2>
                        <p className="text-sm text-gray-500">Activer/désactiver des fonctionnalités de la plateforme</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {[
                        { key: 'enableRegistration', label: 'Inscription ouverte', description: 'Permettre aux nouvelles écoles de s\'inscrire' },
                        { key: 'enableParentAccess', label: 'Accès parents', description: 'Activer le portail parents pour toutes les écoles' },
                        { key: 'enableStudentAccess', label: 'Accès élèves', description: 'Activer le portail élèves pour toutes les écoles' },
                    ].map(item => (
                        <div key={item.key} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl">
                            <div>
                                <p className="font-medium text-white">{item.label}</p>
                                <p className="text-sm text-gray-500">{item.description}</p>
                            </div>
                            <Switch
                                checked={(settings as any)[item.key]}
                                onCheckedChange={(checked) => updateSetting(item.key, checked)}
                            />
                        </div>
                    ))}

                    {/* Maintenance Mode - Special styling */}
                    <div className="flex items-center justify-between p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                        <div>
                            <p className="font-medium text-white">Mode maintenance</p>
                            <p className="text-sm text-red-400">⚠️ Désactive l'accès à toute la plateforme sauf pour les super admins</p>
                        </div>
                        <Switch
                            checked={settings.maintenanceMode}
                            onCheckedChange={(checked) => updateSetting('maintenanceMode', checked)}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
