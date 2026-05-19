'use client'

import { useState } from 'react'
import { Settings, Globe, Bell, CreditCard, Save, Loader2, ShieldAlert, Lock, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'

export function PlatformSettings() {
    const { t, direction } = useLanguage()
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

    const [showPassword, setShowPassword] = useState(false)
    const [updatingPassword, setUpdatingPassword] = useState(false)
    const [passwordForm, setPasswordForm] = useState({
        newPassword: '',
        confirmPassword: ''
    })

    const supabase = createClient()

    const handleSave = async () => {
        setSaving(true)
        // Simulate saving
        await new Promise(resolve => setTimeout(resolve, 1000))
        toast.success(t('superAdmin.settings.saveSuccess'))
        setSaving(false)
    }

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!passwordForm.newPassword || !passwordForm.confirmPassword) {
            toast.error("Veuillez remplir tous les champs.")
            return
        }
        if (passwordForm.newPassword.length < 6) {
            toast.error("Le mot de passe doit comporter au moins 6 caractères.")
            return
        }
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            toast.error("Les mots de passe ne correspondent pas.")
            return
        }

        setUpdatingPassword(true)
        try {
            const { error } = await supabase.auth.updateUser({
                password: passwordForm.newPassword
            })

            if (error) throw error

            toast.success("Mot de passe mis à jour avec succès !")
            setPasswordForm({ newPassword: '', confirmPassword: '' })
        } catch (error: any) {
            console.error("Error updating password:", error)
            toast.error(error.message || "Erreur lors de la mise à jour du mot de passe.")
        } finally {
            setUpdatingPassword(false)
        }
    }

    const updateSetting = (key: string, value: any) => {
        setSettings(prev => ({ ...prev, [key]: value }))
    }

    return (
        <div className="max-w-4xl space-y-8 pb-12 animate-in fade-in duration-500" dir={direction}>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                        {t('superAdmin.settings.title')}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {t('superAdmin.settings.subtitle')}
                    </p>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black rounded-2xl h-12 shadow-lg shadow-purple-600/20 transition-all duration-300 self-start sm:self-auto px-6"
                >
                    {saving ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {t('superAdmin.settings.saving')}
                        </>
                    ) : (
                        <>
                            <Save className={cn("w-4.5 h-4.5", direction === 'rtl' ? 'ml-2' : 'mr-2')} />
                            {t('superAdmin.settings.save')}
                        </>
                    )}
                </Button>
            </div>

            {/* General Settings */}
            <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-3xl p-8 shadow-sm space-y-6">
                <div className="flex items-center gap-4 pb-4 border-b border-gray-100 dark:border-white/5">
                    <div className="h-12 w-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500 shrink-0">
                        <Globe className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="font-bold text-gray-900 dark:text-white text-lg">
                            {t('superAdmin.settings.general.title')}
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {t('superAdmin.settings.general.subtitle')}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <Label className="text-gray-600 dark:text-gray-400 font-bold text-xs uppercase tracking-wider">
                            {t('superAdmin.settings.general.platformName')}
                        </Label>
                        <Input
                            value={settings.platformName}
                            onChange={(e) => updateSetting('platformName', e.target.value)}
                            className="bg-gray-50/60 dark:bg-slate-950/50 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-2xl h-12 transition-all focus:bg-white focus:ring-2 focus:ring-purple-500/20"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-gray-600 dark:text-gray-400 font-bold text-xs uppercase tracking-wider">
                            {t('superAdmin.settings.general.defaultLanguage')}
                        </Label>
                        <select
                            value={settings.defaultLanguage}
                            onChange={(e) => updateSetting('defaultLanguage', e.target.value)}
                            className="w-full h-12 px-4 rounded-2xl bg-gray-50/60 dark:bg-slate-950/50 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:bg-white focus:ring-2 focus:ring-purple-500/20 transition-all font-semibold outline-none"
                        >
                            <option value="fr">Français</option>
                            <option value="ar">العربية</option>
                            <option value="en">English</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-gray-600 dark:text-gray-400 font-bold text-xs uppercase tracking-wider">
                            {t('superAdmin.settings.general.timezone')}
                        </Label>
                        <select
                            value={settings.timezone}
                            onChange={(e) => updateSetting('timezone', e.target.value)}
                            className="w-full h-12 px-4 rounded-2xl bg-gray-50/60 dark:bg-slate-950/50 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:bg-white focus:ring-2 focus:ring-purple-500/20 transition-all font-semibold outline-none"
                        >
                            <option value="Africa/Nouakchott">Africa/Nouakchott (GMT+0)</option>
                            <option value="Europe/Paris">Europe/Paris (GMT+1)</option>
                            <option value="UTC">UTC</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Subscription Defaults */}
            <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-3xl p-8 shadow-sm space-y-6">
                <div className="flex items-center gap-4 pb-4 border-b border-gray-100 dark:border-white/5">
                    <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                        <CreditCard className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="font-bold text-gray-900 dark:text-white text-lg">
                            {t('superAdmin.settings.subscriptions.title')}
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {t('superAdmin.settings.subscriptions.subtitle')}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="text-gray-600 dark:text-gray-400 font-bold text-xs uppercase tracking-wider">
                            {t('superAdmin.settings.subscriptions.defaultPlan')}
                        </Label>
                        <select
                            value={settings.defaultPlan}
                            onChange={(e) => updateSetting('defaultPlan', e.target.value)}
                            className="w-full h-12 px-4 rounded-2xl bg-gray-50/60 dark:bg-slate-950/50 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:bg-white focus:ring-2 focus:ring-purple-500/20 transition-all font-semibold outline-none"
                        >
                            <option value="free">Free</option>
                            <option value="pro">Pro</option>
                            <option value="enterprise">Enterprise</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-gray-600 dark:text-gray-400 font-bold text-xs uppercase tracking-wider">
                            {t('superAdmin.settings.subscriptions.defaultLimit')}
                        </Label>
                        <Input
                            type="number"
                            value={settings.defaultMaxStudents}
                            onChange={(e) => updateSetting('defaultMaxStudents', parseInt(e.target.value) || 100)}
                            className="bg-gray-50/60 dark:bg-slate-950/50 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-2xl h-12 transition-all focus:bg-white focus:ring-2 focus:ring-purple-500/20"
                        />
                    </div>
                </div>
            </div>

            {/* Notifications */}
            <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-3xl p-8 shadow-sm space-y-6">
                <div className="flex items-center gap-4 pb-4 border-b border-gray-100 dark:border-white/5">
                    <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                        <Bell className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="font-bold text-gray-900 dark:text-white text-lg">
                            {t('superAdmin.settings.notifications.title')}
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {t('superAdmin.settings.notifications.subtitle')}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { key: 'emailNotifications', label: t('superAdmin.settings.notifications.email.title'), description: t('superAdmin.settings.notifications.email.desc') },
                        { key: 'adminAlerts', label: t('superAdmin.settings.notifications.alerts.title'), description: t('superAdmin.settings.notifications.alerts.desc') },
                        { key: 'weeklyReports', label: t('superAdmin.settings.notifications.reports.title'), description: t('superAdmin.settings.notifications.reports.desc') },
                    ].map(item => (
                        <div key={item.key} className="flex items-center justify-between p-5 bg-gray-50/50 dark:bg-slate-950/40 border border-gray-100 dark:border-white/5 rounded-2xl transition-all duration-200 hover:bg-gray-50 dark:hover:bg-white/[0.01]">
                            <div className="space-y-1 pr-2">
                                <p className="font-bold text-gray-900 dark:text-white text-sm leading-tight">{item.label}</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 leading-normal">{item.description}</p>
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
            <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-3xl p-8 shadow-sm space-y-6">
                <div className="flex items-center gap-4 pb-4 border-b border-gray-100 dark:border-white/5">
                    <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                        <Settings className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="font-bold text-gray-900 dark:text-white text-lg">
                            {t('superAdmin.settings.features.title')}
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {t('superAdmin.settings.features.subtitle')}
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            { key: 'enableRegistration', label: t('superAdmin.settings.features.registration.title'), description: t('superAdmin.settings.features.registration.desc') },
                            { key: 'enableParentAccess', label: t('superAdmin.settings.features.parents.title'), description: t('superAdmin.settings.features.parents.desc') },
                            { key: 'enableStudentAccess', label: t('superAdmin.settings.features.students.title'), description: t('superAdmin.settings.features.students.desc') },
                        ].map(item => (
                            <div key={item.key} className="flex items-center justify-between p-5 bg-gray-50/50 dark:bg-slate-950/40 border border-gray-100 dark:border-white/5 rounded-2xl transition-all duration-200 hover:bg-gray-50 dark:hover:bg-white/[0.01]">
                                <div className="space-y-1 pr-2">
                                    <p className="font-bold text-gray-900 dark:text-white text-sm leading-tight">{item.label}</p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 leading-normal">{item.description}</p>
                                </div>
                                <Switch
                                    checked={(settings as any)[item.key]}
                                    onCheckedChange={(checked) => updateSetting(item.key, checked)}
                                />
                            </div>
                        ))}
                    </div>

                    {/* Maintenance Mode - Special warning styling */}
                    <div className="flex items-center justify-between p-5 bg-red-50/40 dark:bg-red-500/5 border border-red-100 dark:border-red-500/20 rounded-2xl mt-4">
                        <div className="space-y-1 flex items-start gap-3">
                            <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-red-600 dark:text-red-400 text-sm">{t('superAdmin.settings.features.maintenance.title')}</p>
                                <p className="text-xs text-red-500/80 dark:text-red-400/60 leading-normal">{t('superAdmin.settings.features.maintenance.desc')}</p>
                            </div>
                        </div>
                        <Switch
                            checked={settings.maintenanceMode}
                            onCheckedChange={(checked) => updateSetting('maintenanceMode', checked)}
                        />
                    </div>
                </div>
            </div>
            {/* Security Section */}
            <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-3xl p-8 shadow-sm space-y-6">
                <div className="flex items-center gap-4 pb-4 border-b border-gray-100 dark:border-white/5">
                    <div className="h-12 w-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                        <Lock className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="font-bold text-gray-900 dark:text-white text-lg">
                            {t('admin.settings.securityTitle') || "Sécurité & Authentification"}
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {t('admin.settings.securityDesc') || "Mettre à jour votre mot de passe administrateur."}
                        </p>
                    </div>
                </div>

                <form onSubmit={handleUpdatePassword} className="max-w-lg space-y-5">
                    <div className="space-y-2">
                        <Label className="text-gray-600 dark:text-gray-400 font-bold text-xs uppercase tracking-wider">
                            {t('admin.settings.newPassword') || "Nouveau mot de passe"}
                        </Label>
                        <div className="relative">
                            <Input
                                type={showPassword ? "text" : "password"}
                                value={passwordForm.newPassword}
                                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                placeholder="••••••••"
                                className="bg-gray-50/60 dark:bg-slate-950/50 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-2xl h-12 pr-12"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-gray-600 dark:text-gray-400 font-bold text-xs uppercase tracking-wider">
                            {t('admin.settings.confirmPassword') || "Confirmer le mot de passe"}
                        </Label>
                        <Input
                            type="password"
                            value={passwordForm.confirmPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                            placeholder="••••••••"
                            className="bg-gray-50/60 dark:bg-slate-950/50 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-2xl h-12"
                        />
                    </div>

                    <Button
                        type="submit"
                        disabled={updatingPassword}
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black rounded-2xl px-6 h-12 shadow-lg shadow-purple-600/20 transition-all duration-300"
                    >
                        {updatingPassword ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                {t('admin.settings.updating') || "Mise à jour..."}
                            </>
                        ) : (
                            <>
                                {t('admin.settings.updatePassword') || "Mettre à jour"}
                            </>
                        )}
                    </Button>
                </form>
            </div>
        </div>
    )
}
