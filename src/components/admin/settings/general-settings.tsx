'use client'

import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Bell, Globe, Moon, Cloud } from 'lucide-react'
import { useLanguage } from '@/i18n'
import { cn } from '@/lib/utils'

export function GeneralSettings() {
    const { t, language: locale, setLanguage } = useLanguage()

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h3 className="text-xl font-bold text-white">{t('admin.settings.general.title')}</h3>
                <p className="text-gray-400 text-sm">{t('admin.settings.general.subtitle')}</p>
            </div>

            {/* Notifications */}
            <div className="space-y-4">
                <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-4">
                    {t('admin.settings.general.pushNotifications')}
                </h4>

                <div className="bg-[#1A2530] rounded-xl border border-white/5 divide-y divide-white/5">
                    <ToggleItem
                        icon={Bell}
                        label={t('admin.settings.general.absences.label')}
                        desc={t('admin.settings.general.absences.desc')}
                        defaultChecked
                    />
                    <ToggleItem
                        icon={Bell}
                        label={t('admin.settings.general.payments.label')}
                        desc={t('admin.settings.general.payments.desc')}
                        defaultChecked
                    />
                    <ToggleItem
                        icon={Bell}
                        label={t('admin.settings.general.behavior.label')}
                        desc={t('admin.settings.general.behavior.desc')}
                        defaultChecked={false}
                    />
                </div>
            </div>

            {/* Regional */}
            <div className="space-y-4">
                <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-4">
                    {t('admin.settings.general.regionalPreferences')}
                </h4>

                <div className="bg-[#1A2530] rounded-xl border border-white/5 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Globe className="w-5 h-5 text-gray-400" />
                            <span className="font-medium text-white">{t('admin.settings.general.language')}</span>
                        </div>
                        <div className="flex bg-[#0F1720] p-1 rounded-lg">
                            <button
                                onClick={() => setLanguage('fr')}
                                className={cn(
                                    "px-3 py-1 text-xs font-bold transition-all",
                                    locale === 'fr'
                                        ? "bg-[#1A2530] text-emerald-500 rounded-md shadow-sm"
                                        : "text-gray-500 hover:text-white"
                                )}
                            >
                                FR
                            </button>
                            <button
                                onClick={() => setLanguage('ar')}
                                className={cn(
                                    "px-3 py-1 text-xs font-bold transition-all",
                                    locale === 'ar'
                                        ? "bg-[#1A2530] text-emerald-500 rounded-md shadow-sm"
                                        : "text-gray-500 hover:text-white"
                                )}
                            >
                                AR
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Moon className="w-5 h-5 text-gray-400" />
                            <span className="font-medium text-white">{t('admin.settings.general.darkMode')}</span>
                        </div>
                        <Switch defaultChecked />
                    </div>
                </div>
            </div>

            {/* Backup */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-emerald-500 rounded-xl text-black">
                        <Cloud className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-white">{t('admin.settings.general.backupTitle')}</h4>
                        <p className="text-gray-400 text-xs mt-1 mb-4">
                            {t('admin.settings.general.backupDesc')} <br />
                            <span className="text-emerald-500">● {t('admin.settings.general.lastBackup')}</span>
                        </p>
                        <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold">
                            {t('admin.settings.general.backupNow')}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="text-center pt-8">
                <p className="text-[10px] text-gray-600">
                    {t('admin.settings.general.version')} <br />
                    {t('admin.settings.general.copyright')}
                </p>
            </div>
        </div>
    )
}

function ToggleItem({ icon: Icon, label, desc, defaultChecked }: any) {
    return (
        <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
                <Icon className="w-5 h-5 text-gray-400" />
                <div>
                    <h5 className="font-medium text-white text-sm">{label}</h5>
                    <p className="text-xs text-gray-500">{desc}</p>
                </div>
            </div>
            <Switch defaultChecked={defaultChecked} />
        </div>
    )
}
