'use client'

import { useState, useEffect, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Building2, Mail, Phone, MapPin, Upload, Loader2, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n'

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
    const { t } = useLanguage()
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

    // Fetch existing settings on mount
    useEffect(() => {
        async function fetchSettings() {
            setIsLoading(true)
            try {
                // Get user's school_id from their profile
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

                // Fetch school settings
                const { data: existingSettings, error } = await supabase
                    .from('school_settings')
                    .select('*')
                    .eq('school_id', profile.school_id)
                    .single()

                if (existingSettings) {
                    setSettings(existingSettings)
                } else {
                    // If no settings, initialize with school_id
                    setSettings(prev => ({ ...prev, school_id: profile.school_id }))
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
                const { error } = await supabase
                    .from('school_settings')
                    .upsert({
                        school_id: settings.school_id,
                        name: settings.name,
                        slogan: settings.slogan,
                        address: settings.address,
                        phone: settings.phone,
                        email: settings.email,
                        logo_url: settings.logo_url
                    }, {
                        onConflict: 'school_id'
                    })

                if (error) throw error

                setIsSaved(true)
                toast.success(t('admin.settings.identity.saveSuccess'))
                setTimeout(() => setIsSaved(false), 2000)
            } catch (error) {
                console.error('Error saving settings:', error)
                toast.error(t('admin.settings.identity.saveError'))
            }
        })
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
                <div className="h-24 w-24 bg-[#0F1720] rounded-2xl flex items-center justify-center border-2 border-dashed border-gray-600 group hover:border-emerald-500 transition-colors cursor-pointer overflow-hidden">
                    {settings.logo_url ? (
                        <img src={settings.logo_url} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                        <Upload className="w-8 h-8 text-gray-500 group-hover:text-emerald-500" />
                    )}
                </div>
                <div>
                    <h4 className="font-bold text-white">{t('admin.settings.identity.logoTitle')}</h4>
                    <p className="text-xs text-gray-500 mb-3">{t('admin.settings.identity.logoDesc')}</p>
                    <Button variant="outline" size="sm" className="border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10">
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
                                onChange={(e) => setSettings(prev => ({ ...prev, phone: e.target.value }))}
                                placeholder="+222 XX XX XX XX"
                                className="pl-9 bg-[#1A2530] border-white/5"
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
        </div>
    )
}
