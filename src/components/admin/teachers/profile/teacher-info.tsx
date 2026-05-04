'use client'

import { Badge } from '@/components/ui/badge'
import { User, MapPin, Briefcase, Award } from 'lucide-react'

export function TeacherInfo({ teacherId }: { teacherId?: string }) {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Professional Info */}
            <div className="bg-[#1A2530] rounded-3xl border border-white/5 overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-white/5">
                    <h3 className="font-bold text-white flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-emerald-500" /> Informations Professionnelles
                    </h3>
                </div>

                <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                        <p className="text-xs text-gray-500 uppercase font-bold">Spécialité Principale</p>
                        <div className="text-white font-medium flex items-center gap-2">
                            Mathématiques <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]">Primaire & Collège</Badge>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <p className="text-xs text-gray-500 uppercase font-bold">Statut</p>
                        <p className="text-white font-medium flex items-center gap-2">
                            Titulaire <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                        </p>
                    </div>

                    <div className="space-y-1">
                        <p className="text-xs text-gray-500 uppercase font-bold">Date d'embauche</p>
                        <p className="text-white font-medium">15 Septembre 2021</p>
                    </div>

                    <div className="space-y-1">
                        <p className="text-xs text-gray-500 uppercase font-bold">Diplôme le plus élevé</p>
                        <p className="text-white font-medium flex items-center gap-2">
                            <Award className="w-4 h-4 text-purple-400" /> Master en Mathématiques
                        </p>
                    </div>
                </div>
            </div>

            {/* Personal Info */}
            <div className="bg-[#1A2530] rounded-3xl border border-white/5 overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-white/5">
                    <h3 className="font-bold text-white flex items-center gap-2">
                        <User className="w-5 h-5 text-blue-500" /> Informations Personnelles
                    </h3>
                </div>

                <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                        <p className="text-xs text-gray-500 uppercase font-bold">Numéro National d'Identité (NNI)</p>
                        <p className="text-white font-mono bg-[#0F1720] px-2 py-1 rounded inline-block">1234567890</p>
                    </div>

                    <div className="space-y-1">
                        <p className="text-xs text-gray-500 uppercase font-bold">Date de Naissance</p>
                        <p className="text-white font-medium">12/04/1985 (39 ans)</p>
                    </div>

                    <div className="space-y-1 md:col-span-2">
                        <p className="text-xs text-gray-500 uppercase font-bold">Adresse</p>
                        <p className="text-white font-medium flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-400" /> Tevragh Zeina, Nouakchott, Mauritanie
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
