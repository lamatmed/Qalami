'use client'

import { useState, useEffect, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Building2, Mail, Phone, MapPin, Upload, Loader2, CheckCircle2, KeyRound, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n'
import { updateCurrentUserPassword, updateSchoolIdentityAction } from '@/app/admin/settings/actions'
import { cn } from '@/lib/utils'

interface SchoolSettings {
    id?: string
    school_id: string
    name: string
    slogan: string
    address: string
    phone: string
    email: string
    logo_url?: string
}

export function SchoolIdentity() {
    const { t, language } = useLanguage()
    const isAr = language === 'ar'
    const supabase = createClient()
    const [isPending, startTransition] = useTransition()
    const [isLoading, setIsLoading] = useState(true)
    const [isSaved, setIsSaved] = useState(false)

    const [settings, setSettings] = useState<SchoolSettings>({
        school_id: '',
        name: '',
        slogan: '',
        address: '',
        phone: '',
        email: '',
        logo_url: ''
    })

    const [passwords, setPasswords] = useState({ new: '', confirm: '' })
    const [showNewPass, setShowNewPass] = useState(false)
    const [showConfirmPass, setShowConfirmPass] = useState(false)
    const [isUpdatingPass, setIsUpdatingPass] = useState(false)

    // Fetch existing settings on mount
    useEffect(() => {
        async function fetchSettings() {
            setIsLoading(true)
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('school_id')
                    .eq('id', user.id)
                    .single()

                if (!profile?.school_id) {
                    console.warn('User has no school_id')
                    setIsLoading(false)
                    return
                }

                // Parallel fetch primary school info and settings overrides
                const [settingsResponse, schoolResponse] = await Promise.all([
                    supabase.from('school_settings').select('*').eq('school_id', profile.school_id).maybeSingle(),
                    supabase.from('schools').select('*').eq('id', profile.school_id).maybeSingle()
                ])

                const existingSettings = settingsResponse.data
                const coreSchool = schoolResponse.data

                if (existingSettings) {
                    setSettings({
                        ...existingSettings,
                        // Fallback fields to Core info if they aren't specifically overridden yet
                        name: existingSettings.name || coreSchool?.name || '',
                        email: existingSettings.email || coreSchool?.email || '',
                        phone: existingSettings.phone || coreSchool?.phone || '',
                        address: existingSettings.address || coreSchool?.address || '',
                        logo_url: existingSettings.logo_url || coreSchool?.logo_url || ''
                    })
                } else {
                    // Populate initial form with the core school creation defaults
                    setSettings({
                        school_id: profile.school_id,
                        name: coreSchool?.name || '',
                        slogan: '',
                        address: coreSchool?.address || '',
                        phone: coreSchool?.phone || '',
                        email: coreSchool?.email || '',
                        logo_url: coreSchool?.logo_url || ''
                    })
                }
            } catch (error) {
                console.error('Error fetching settings:', error)
            } finally {
                setIsLoading(false)
            }
        }
        fetchSettings()
    }, [supabase])

    const handleSave = () => {
        startTransition(async () => {
            try {
                const response = await updateSchoolIdentityAction({
                    school_id: settings.school_id,
                    name: settings.name,
                    slogan: settings.slogan,
                    address: settings.address,
                    email: settings.email,
                    logo_url: settings.logo_url
                })

                if (response.error) throw new Error(response.error)

                setIsSaved(true)
                toast.success(t('admin.settings.identity.saveSuccess'))
                setTimeout(() => setIsSaved(false), 2000)
            } catch (error: any) {
                console.error('Error saving settings:', error)
                toast.error(error.message || t('admin.settings.identity.saveError'))
            }
        })
    }

    const handlePasswordUpdate = async (e: React.FormEvent) => {
        e.preventDefault()
        
        if (!/^\d{6}$/.test(passwords.new)) {
            toast.error(t('admin.settings.identity.passwordTooShort'))
            return
        }

        if (passwords.new !== passwords.confirm) {
            toast.error(t('admin.settings.identity.passwordMismatch'))
            return
        }

        setIsUpdatingPass(true)
        try {
            const response = await updateCurrentUserPassword(passwords.new)
            if (response.error) {
                toast.error(response.error)
            } else {
                toast.success(t('admin.settings.identity.passwordUpdated'))
                setPasswords({ new: '', confirm: '' })
            }
        } catch (err) {
            toast.error(t('admin.settings.identity.passwordError'))
        } finally {
            setIsUpdatingPass(false)
        }
    }

    const [isUploading, setIsUploading] = useState(false)

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!settings.school_id) {
            toast.error("School ID is missing. Cannot upload logo.")
            return
        }

        setIsUploading(true)
        const loadingToastId = toast.loading("Téléchargement du logo...")

        try {
            // 1. Create standard browser form and append required context
            const fd = new FormData()
            fd.append('file', file)
            fd.append('schoolId', settings.school_id)

            // 2. POST to secure internal backend bridge bypassing user scope denial
            const response = await fetch('/api/admin/upload-logo', {
                method: 'POST',
                body: fd
            })

            const result = await response.json()

            if (!response.ok || result.error) {
                throw new Error(result.error || "Erreur serveur lors du téléchargement")
            }

            // 3. Extract Public URL provided securely by backend response
            setSettings(prev => ({ ...prev, logo_url: result.publicUrl }))
            
            toast.success("Logo téléchargé avec succès !", { id: loadingToastId })
        } catch (error: any) {
            console.error('Error uploading image:', error)
            toast.error("Erreur lors du téléchargement du logo.", { id: loadingToastId })
        } finally {
            setIsUploading(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h3 className="text-xl font-bold text-white">{t('admin.settings.identity.title')}</h3>
                <p className="text-gray-400 text-sm">{t('admin.settings.identity.subtitle')}</p>
            </div>

            {/* Logo Upload */}
            <div className="flex items-center gap-6 p-6 bg-[#1A2530] rounded-2xl border border-white/5">
                <div 
                    onClick={() => document.getElementById('logo-input')?.click()}
                    className="h-24 w-24 bg-[#0F1720] rounded-2xl flex items-center justify-center border-2 border-dashed border-gray-600 group hover:border-emerald-500 transition-all cursor-pointer overflow-hidden relative"
                >
                    {isUploading ? (
                        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                    ) : settings.logo_url ? (
                        <>
                            <img src={settings.logo_url} alt="Logo" className="w-full h-full object-cover group-hover:opacity-50 transition-opacity" />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Upload className="w-6 h-6 text-white" />
                            </div>
                        </>
                    ) : (
                        <Upload className="w-8 h-8 text-gray-500 group-hover:text-emerald-500" />
                    )}
                </div>
                <div>
                    <h4 className="font-bold text-white">{t('admin.settings.identity.logoTitle')}</h4>
                    <p className="text-xs text-gray-500 mb-3">{t('admin.settings.identity.logoDesc')}</p>
                    
                    <input 
                        id="logo-input" 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleLogoUpload}
                        disabled={isUploading}
                    />

                    <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={isUploading}
                        onClick={() => document.getElementById('logo-input')?.click()}
                        className="border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10"
                    >
                        {isUploading ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : null}
                        {t('admin.settings.identity.modifyLogo')}
                    </Button>
                </div>
            </div>

            {/* Form */}
            <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                        <Label>{t('admin.settings.identity.schoolNameLabel')}</Label>
                        <div className="relative">
                            <Building2 className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                            <Input
                                value={settings.name}
                                onChange={(e) => setSettings(prev => ({ ...prev, name: e.target.value }))}
                                placeholder={t('admin.settings.identity.schoolNamePlaceholder')}
                                className="pl-9 bg-[#1A2530] border-white/5"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>{t('admin.settings.identity.sloganLabel')}</Label>
                        <Input
                             value={settings.slogan}
                             onChange={(e) => setSettings(prev => ({ ...prev, slogan: e.target.value }))}
                             placeholder={t('admin.settings.identity.sloganPlaceholder')}
                             className="bg-[#1A2530] border-white/5"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>{t('admin.settings.identity.addressLabel')}</Label>
                    <div className="relative">
                        <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                        <Input
                            value={settings.address}
                            onChange={(e) => setSettings(prev => ({ ...prev, address: e.target.value }))}
                            placeholder={t('admin.settings.identity.addressPlaceholder')}
                            className="pl-9 bg-[#1A2530] border-white/5"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                        <Label>{t('admin.settings.identity.phoneLabel')}</Label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                            <Input
                                value={settings.phone}
                                disabled={true}
                                readOnly={true}
                                placeholder="+222 XX XX XX XX"
                                className="pl-9 bg-[#1A2530]/40 border-white/5 text-gray-400 cursor-not-allowed select-none"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>{t('admin.settings.identity.emailLabel')}</Label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                            <Input
                                value={settings.email}
                                onChange={(e) => setSettings(prev => ({ ...prev, email: e.target.value }))}
                                placeholder="contact@ecole.mr"
                                className="pl-9 bg-[#1A2530] border-white/5"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="pt-6 border-t border-white/5 flex justify-end">
                <Button
                    onClick={handleSave}
                    disabled={isPending || !settings.school_id}
                    className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold px-8 gap-2"
                >
                    {isPending ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> {t('admin.settings.identity.saving')}</>
                    ) : isSaved ? (
                        <><CheckCircle2 className="h-4 w-4" /> {t('admin.settings.identity.saved')}</>
                    ) : (
                        t('admin.settings.identity.saveChanges')
                    )}
                </Button>
            </div>

            {/* Security Password Block */}
            <div className="mt-12 pt-8 border-t border-white/5 space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
                <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-emerald-500" />
                        {t('admin.settings.identity.securityTitle')}
                    </h3>
                    <p className="text-gray-400 text-sm">{t('admin.settings.identity.securityDesc')}</p>
                </div>

                <form onSubmit={handlePasswordUpdate} className="bg-[#1A2530] border border-white/5 rounded-2xl p-6 max-w-2xl space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <Label className="text-gray-300">{t('admin.settings.identity.newPassword')}</Label>
                            <div className="relative">
                                <KeyRound className={cn("absolute top-3 h-4 w-4 text-gray-500", isAr ? "right-3" : "left-3")} />
                                <Input
                                    type={showNewPass ? "text" : "password"}
                                    value={passwords.new}
                                    onChange={(e) => setPasswords(prev => ({ ...prev, new: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                                    placeholder={t('admin.settings.identity.newPasswordPlaceholder')}
                                    className={cn("bg-[#0F1720] border-white/5 text-white", isAr ? "pr-9 pl-10 text-right" : "pl-9 pr-10")}
                                    dir={isAr ? 'rtl' : 'ltr'}
                                    inputMode="numeric"
                                    maxLength={6}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPass(!showNewPass)}
                                    className={cn("absolute top-3 text-gray-500 hover:text-emerald-500 transition-colors", isAr ? "left-3" : "right-3")}
                                >
                                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-gray-300">{t('admin.settings.identity.confirmPassword')}</Label>
                            <div className="relative">
                                <KeyRound className={cn("absolute top-3 h-4 w-4 text-gray-500", isAr ? "right-3" : "left-3")} />
                                <Input
                                    type={showConfirmPass ? "text" : "password"}
                                    value={passwords.confirm}
                                    onChange={(e) => setPasswords(prev => ({ ...prev, confirm: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                                    placeholder={t('admin.settings.identity.confirmPasswordPlaceholder')}
                                    className={cn("bg-[#0F1720] border-white/5 text-white", isAr ? "pr-9 pl-10 text-right" : "pl-9 pr-10")}
                                    dir={isAr ? 'rtl' : 'ltr'}
                                    inputMode="numeric"
                                    maxLength={6}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                                    className={cn("absolute top-3 text-gray-500 hover:text-emerald-500 transition-colors", isAr ? "left-3" : "right-3")}
                                >
                                    {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button
                            type="submit"
                            disabled={isUpdatingPass || !passwords.new}
                            className={cn(
                                "font-bold gap-2 transition-all duration-300",
                                passwords.new && passwords.new === passwords.confirm
                                    ? "bg-emerald-500 hover:bg-emerald-600 text-black shadow-lg shadow-emerald-500/20"
                                    : "bg-white/10 hover:bg-white/20 text-gray-300"
                            )}
                        >
                            {isUpdatingPass ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <KeyRound className="h-4 w-4" />
                            )}
                            {t('admin.settings.identity.updatePassword')}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}
