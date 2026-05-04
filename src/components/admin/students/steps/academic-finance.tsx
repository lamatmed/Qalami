'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ChevronLeft, GraduationCap, DollarSign, Loader2 } from 'lucide-react'
import { RegistrationData } from '../registration-wizard'
import { createClient } from '@/utils/supabase/client'

interface StepProps {
    data: RegistrationData
    updateData: (section: keyof RegistrationData, data: any) => void
    onNext: () => void
    onPrev: () => void
    savedCredentials?: any
}

interface LevelOption {
    id: string
    name_fr: string
    order: number
}

interface ClassOption {
    id: string
    name: string
    level_id: string
}

// Generate academic year options (previous, current, next)
function getAcademicYearOptions(): string[] {
    const now = new Date()
    const baseYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
    return [
        `${baseYear - 1}-${baseYear}`,
        `${baseYear}-${baseYear + 1}`,
        `${baseYear + 1}-${baseYear + 2}`,
    ]
}

export function AcademicFinance({ data, updateData, onNext, onPrev }: StepProps) {
    const { academic } = data
    const [levels, setLevels] = useState<LevelOption[]>([])
    const [classes, setClasses] = useState<ClassOption[]>([])
    const [loading, setLoading] = useState(true)
    const academicYearOptions = getAcademicYearOptions()

    useEffect(() => {
        async function fetchData() {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase
                .from('profiles')
                .select('school_id')
                .eq('id', user.id)
                .single()

            if (!profile?.school_id) return

            const [{ data: levelData }, { data: classData }] = await Promise.all([
                supabase
                    .from('levels')
                    .select('id, name_fr, order')
                    .eq('school_id', profile.school_id)
                    .order('order'),
                supabase
                    .from('classes')
                    .select('id, name, level_id')
                    .eq('school_id', profile.school_id)
                    .order('name'),
            ])

            if (levelData) setLevels(levelData)
            if (classData) setClasses(classData)
            setLoading(false)
        }
        fetchData()
    }, [])

    const handleChange = (field: string, value: any) => {
        updateData('academic', { [field]: value })
    }

    const handleLevelChange = (levelId: string) => {
        const level = levels.find(l => l.id === levelId)
        updateData('academic', { level: level?.name_fr || levelId, levelId, className: '', classId: '' })
    }

    // Filter classes by selected levelId
    const filteredClasses = academic.levelId
        ? classes.filter(c => c.level_id === academic.levelId)
        : []

    return (
        <div className="space-y-6">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Finaliser l&apos;inscription</h2>
                <p className="text-gray-400 text-sm">&Eacute;tape 3 sur 4 : Affectation scolaire et r&egrave;glement.</p>
            </div>

            <div className="space-y-6">
                {/* Academic */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <GraduationCap className="w-5 h-5 text-emerald-500" />
                        <h3 className="font-bold text-white">Affectation Scolaire</h3>
                    </div>

                    <div className="space-y-2 mb-4">
                        <Label>Année académique</Label>
                        <Select onValueChange={(val) => handleChange('academicYear', val)} value={academic.academicYear}>
                            <SelectTrigger className="bg-[#1A2530] border-white/5 h-11">
                                <SelectValue placeholder="Choisir l'année" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1A2530] border-white/5 text-white">
                                {academicYearOptions.map(year => (
                                    <SelectItem key={year} value={year}>{year}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Niveau d&apos;&eacute;tudes</Label>
                            <Select onValueChange={handleLevelChange} value={academic.levelId || undefined}>
                                <SelectTrigger className="bg-[#1A2530] border-white/5 h-11">
                                    <SelectValue placeholder="Choisir le niveau" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1A2530] border-white/5 text-white">
                                    {loading ? (
                                        <div className="flex items-center justify-center p-2">
                                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                        </div>
                                    ) : levels.length === 0 ? (
                                        <div className="px-4 py-2 text-xs text-gray-500">Aucun niveau trouvé</div>
                                    ) : (
                                        levels.map(l => (
                                            <SelectItem key={l.id} value={l.id}>{l.name_fr}</SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Classe sp&eacute;cifique</Label>
                            <Select
                                key={academic.levelId}
                                onValueChange={(val) => handleChange('className', val)}
                                value={academic.className || undefined}
                                disabled={!academic.levelId}
                            >
                                <SelectTrigger className="bg-[#1A2530] border-white/5 h-11 disabled:opacity-50">
                                    <SelectValue placeholder={!academic.levelId ? 'Choisir d\'abord le niveau' : 'Choisir la classe'} />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1A2530] border-white/5 text-white">
                                    {loading ? (
                                        <div className="flex items-center justify-center p-2">
                                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                        </div>
                                    ) : filteredClasses.length === 0 ? (
                                        <div className="px-4 py-2 text-xs text-gray-500">Aucune classe pour ce niveau</div>
                                    ) : (
                                        filteredClasses.map(cls => (
                                            <SelectItem key={cls.id} value={cls.name}>{cls.name}</SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                {/* Finance */}
                <div className="bg-[#1A2530]/50 p-5 rounded-2xl border border-white/5 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-5 h-5 text-emerald-500" />
                        <h3 className="font-bold text-white">D&eacute;tails Financiers</h3>
                    </div>

                    <div className="space-y-2">
                        <Label>Frais d&apos;inscription (MRU)</Label>
                        <Input
                            type="number"
                            value={academic.registrationFee}
                            onChange={(e) => handleChange('registrationFee', Number(e.target.value))}
                            className="bg-[#0F1720] border-white/5 font-mono text-emerald-500 font-bold"
                        />
                    </div>

                    <div className="flex items-center justify-between bg-[#0F1720] p-3 rounded-xl border border-white/5">
                        <span className="text-sm text-gray-300">Marquer comme r&eacute;gl&eacute; &agrave; l&apos;instant</span>
                        <Switch
                            checked={academic.isPaid}
                            onCheckedChange={(checked) => handleChange('isPaid', checked)}
                        />
                    </div>

                    <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 text-center">
                        <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider mb-1">Total Annuel Estim&eacute;</p>
                        <p className="text-2xl font-black text-emerald-500">{academic.tuitionFee.toLocaleString()} MRU</p>
                    </div>
                </div>
            </div>

            <div className="flex gap-4 pt-6">
                <Button
                    variant="outline"
                    onClick={onPrev}
                    className="flex-1 bg-transparent border-white/10 text-white h-12 rounded-xl hover:bg-white/5"
                >
                    <ChevronLeft className="mr-2 w-4 h-4" /> Retour
                </Button>
                <Button
                    onClick={onNext}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-bold h-12 rounded-xl"
                >
                    Confirmer l&apos;inscription
                </Button>
            </div>
        </div>
    )
}
