'use client'

import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Bell, Globe, Moon, Cloud } from 'lucide-react'

export function GeneralSettings() {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h3 className="text-xl font-bold text-white">Paramètres Généraux</h3>
                <p className="text-gray-400 text-sm">Préférences de l'application et du système.</p>
            </div>

            {/* Notifications */}
            <div className="space-y-4">
                <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-4">Notifications Push</h4>

                <div className="bg-[#1A2530] rounded-xl border border-white/5 divide-y divide-white/5">
                    <ToggleItem
                        icon={Bell}
                        label="Absences & Retards"
                        desc="Notifier les parents immédiatement."
                        defaultChecked
                    />
                    <ToggleItem
                        icon={Bell}
                        label="Paiements"
                        desc="Rappels de scolarité automatiques."
                        defaultChecked
                    />
                    <ToggleItem
                        icon={Bell}
                        label="Comportement"
                        desc="Incidents et disciplines."
                        defaultChecked={false}
                    />
                </div>
            </div>

            {/* Regional */}
            <div className="space-y-4">
                <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-4">Préférences Régionales</h4>

                <div className="bg-[#1A2530] rounded-xl border border-white/5 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Globe className="w-5 h-5 text-gray-400" />
                            <span className="font-medium text-white">Langue</span>
                        </div>
                        <div className="flex bg-[#0F1720] p-1 rounded-lg">
                            <button className="px-3 py-1 text-xs font-bold bg-[#1A2530] text-emerald-500 rounded-md shadow-sm">FR</button>
                            <button className="px-3 py-1 text-xs font-bold text-gray-500 hover:text-white">AR</button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Moon className="w-5 h-5 text-gray-400" />
                            <span className="font-medium text-white">Thème Sombre</span>
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
                        <h4 className="font-bold text-white">Sauvegarde & Sync</h4>
                        <p className="text-gray-400 text-xs mt-1 mb-4">Vos données sont sécurisées sur le serveur Qalami. <br /> <span className="text-emerald-500">● Dernière sauvegarde : Il y a 5 min</span></p>
                        <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold">
                            Sauvegarder maintenant
                        </Button>
                    </div>
                </div>
            </div>

            <div className="text-center pt-8">
                <p className="text-[10px] text-gray-600">Qalami School Management v2.4.0 <br /> © 2024 Mauritanie Éducation</p>
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
