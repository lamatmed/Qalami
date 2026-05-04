'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon, ChevronRight, User, MapPin, CreditCard, Home, KeyRound, Phone, Smartphone, SmartphoneNfc } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RegistrationData } from '../registration-wizard'

interface StepProps {
    data: RegistrationData
    updateData: (section: keyof RegistrationData, data: any) => void
    onNext: () => void
    onPrev: () => void
    savedCredentials?: any
}

const months = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate()
}

export function PersonalInfo({ data, updateData, onNext }: StepProps) {
    const { personal } = data

    // Parse existing date if any
    const existingDate = personal.dateOfBirth ? new Date(personal.dateOfBirth) : null
    const [selectedYear, setSelectedYear] = useState<string>(existingDate ? String(existingDate.getFullYear()) : '')
    const [selectedMonth, setSelectedMonth] = useState<string>(existingDate ? String(existingDate.getMonth()) : '')
    const [selectedDay, setSelectedDay] = useState<string>(existingDate ? String(existingDate.getDate()) : '')
    const [isOpen, setIsOpen] = useState(false)

    const handleChange = (field: string, value: any) => {
        updateData('personal', { [field]: value })
    }

    const updateDate = (year: string, month: string, day: string) => {
        if (year && month !== '' && day) {
            const y = parseInt(year)
            const m = parseInt(month)
            const d = parseInt(day)
            const date = new Date(y, m, d)
            handleChange('dateOfBirth', date.toISOString())
            setIsOpen(false)
        }
    }

    const handleYearChange = (val: string) => {
        setSelectedYear(val)
        setSelectedDay('') // reset day when year changes
        if (selectedMonth !== '' && val) {
            // Don't auto-close yet, need day
        }
    }

    const handleMonthChange = (val: string) => {
        setSelectedMonth(val)
        setSelectedDay('') // reset day when month changes
    }

    const handleDayChange = (val: string) => {
        setSelectedDay(val)
        updateDate(selectedYear, selectedMonth, val)
    }

    // Generate year list (from current year down to 1990)
    const currentYear = new Date().getFullYear()
    const years = Array.from({ length: currentYear - 1989 }, (_, i) => currentYear - i)

    // Generate day list based on selected year/month
    const daysCount = selectedYear && selectedMonth !== '' ? getDaysInMonth(parseInt(selectedYear), parseInt(selectedMonth)) : 31
    const days = Array.from({ length: daysCount }, (_, i) => i + 1)

    const formatDisplayDate = () => {
        if (!personal.dateOfBirth) return null
        const d = new Date(personal.dateOfBirth)
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
    }

    const isValid = personal.firstName && personal.lastName && personal.dateOfBirth && personal.gender && personal.placeOfBirth &&
        (!personal.hasPhone || (personal.phone?.trim() && personal.password?.trim()))

    return (
        <div className="space-y-6">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Informations Personnelles</h2>
                <p className="text-gray-400 text-sm">Étape 1 sur 4 : Identité de l'élève telle que figurant sur l'acte de naissance.</p>
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Prénom</Label>
                        <div className="relative">
                            <User className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                            <Input
                                value={personal.firstName}
                                onChange={(e) => handleChange('firstName', e.target.value)}
                                placeholder="ex. Mohamed"
                                className="pl-9 bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Nom</Label>
                        <Input
                            value={personal.lastName}
                            onChange={(e) => handleChange('lastName', e.target.value)}
                            placeholder="ex. Ould Ahmed"
                            className="bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5"
                        />
                    </div>
                </div>

                {/* Date de Naissance - Year → Month → Day */}
                <div className="space-y-2">
                    <Label>Date de Naissance</Label>
                    <Popover open={isOpen} onOpenChange={setIsOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                    "w-full justify-start text-left font-normal bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-[#1A2530] hover:text-gray-900 dark:hover:text-white",
                                    !personal.dateOfBirth && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {formatDisplayDate() || <span>Choisir une date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-4 bg-white dark:bg-[#0F1720] border-gray-200 dark:border-white/10" align="start">
                            <div className="space-y-3">
                                <p className="text-xs text-gray-500 font-bold uppercase mb-2">Sélectionner la date</p>

                                {/* Year selector */}
                                <div className="space-y-1">
                                    <label className="text-xs text-gray-400">Année</label>
                                    <Select value={selectedYear} onValueChange={handleYearChange}>
                                        <SelectTrigger className="bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5 h-10 text-gray-900 dark:text-white">
                                            <SelectValue placeholder="Année..." />
                                        </SelectTrigger>
                                        <SelectContent className="bg-white dark:bg-[#1A2530] border-gray-200 dark:border-white/5 text-gray-900 dark:text-white max-h-[200px]">
                                            {years.map(y => (
                                                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Month selector */}
                                {selectedYear && (
                                    <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                        <label className="text-xs text-gray-400">Mois</label>
                                        <Select value={selectedMonth} onValueChange={handleMonthChange}>
                                            <SelectTrigger className="bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5 h-10 text-gray-900 dark:text-white">
                                                <SelectValue placeholder="Mois..." />
                                            </SelectTrigger>
                                            <SelectContent className="bg-white dark:bg-[#1A2530] border-gray-200 dark:border-white/5 text-gray-900 dark:text-white max-h-[200px]">
                                                {months.map((m, i) => (
                                                    <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {/* Day selector */}
                                {selectedYear && selectedMonth !== '' && (
                                    <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                        <label className="text-xs text-gray-400">Jour</label>
                                        <Select value={selectedDay} onValueChange={handleDayChange}>
                                            <SelectTrigger className="bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5 h-10 text-gray-900 dark:text-white">
                                                <SelectValue placeholder="Jour..." />
                                            </SelectTrigger>
                                            <SelectContent className="bg-white dark:bg-[#1A2530] border-gray-200 dark:border-white/5 text-gray-900 dark:text-white max-h-[200px]">
                                                {days.map(d => (
                                                    <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

                <div className="space-y-2">
                    <Label>Genre</Label>
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => handleChange('gender', 'male')}
                            className={cn(
                                "flex items-center justify-center p-3 rounded-xl border transition-all",
                                personal.gender === 'male' ? "bg-emerald-500/20 border-emerald-500 text-emerald-500" : "bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#23303d]"
                            )}
                        >
                            Masculin
                        </button>
                        <button
                            onClick={() => handleChange('gender', 'female')}
                            className={cn(
                                "flex items-center justify-center p-3 rounded-xl border transition-all",
                                personal.gender === 'female' ? "bg-pink-500/20 border-pink-500 text-pink-500" : "bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#23303d]"
                            )}
                        >
                            Féminin
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Lieu de Naissance</Label>
                    <div className="relative">
                        <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                        <Input
                            value={personal.placeOfBirth}
                            onChange={(e) => handleChange('placeOfBirth', e.target.value)}
                            placeholder="ex. Nouakchott"
                            className="pl-9 bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Numéro National d'Identité (NNI)</Label>
                    <div className="relative">
                        <CreditCard className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                        <Input
                            value={personal.nationalId ?? ''}
                            onChange={(e) => handleChange('nationalId', e.target.value)}
                            placeholder="ex. 1234567890"
                            className="pl-9 bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5"
                        />
                    </div>
                    <p className="text-[11px] text-gray-400 italic">Optionnel — requis pour l'enregistrement officiel.</p>
                </div>

                <div className="space-y-2">
                    <Label>Adresse</Label>
                    <div className="relative">
                        <Home className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                        <Input
                            value={personal.address ?? ''}
                            onChange={(e) => handleChange('address', e.target.value)}
                            placeholder="ex. Tevragh Zeina, Nouakchott"
                            className="pl-9 bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5"
                        />
                    </div>
                </div>

                {/* Phone toggle */}
                <div className="pt-2 border-t border-gray-200 dark:border-white/5">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">L'élève a-t-il un numéro de téléphone ?</p>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => { handleChange('hasPhone', false); handleChange('phone', ''); handleChange('password', '') }}
                            className={cn(
                                "flex items-center justify-center gap-2 p-3 rounded-xl border transition-all text-sm font-medium",
                                !personal.hasPhone
                                    ? "bg-gray-500/20 border-gray-500 text-gray-700 dark:text-gray-200"
                                    : "bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5 text-gray-400 hover:bg-gray-100 dark:hover:bg-[#23303d]"
                            )}
                        >
                            <SmartphoneNfc className="w-4 h-4" /> Non
                        </button>
                        <button
                            type="button"
                            onClick={() => handleChange('hasPhone', true)}
                            className={cn(
                                "flex items-center justify-center gap-2 p-3 rounded-xl border transition-all text-sm font-medium",
                                personal.hasPhone
                                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-600 dark:text-emerald-400"
                                    : "bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5 text-gray-400 hover:bg-gray-100 dark:hover:bg-[#23303d]"
                            )}
                        >
                            <Smartphone className="w-4 h-4" /> Oui
                        </button>
                    </div>
                </div>

                {/* Phone + password — shown only if hasPhone */}
                {personal.hasPhone && (
                    <>
                        <div className="space-y-2">
                            <Label>Numéro de téléphone *</Label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                                <Input
                                    value={personal.phone ?? ''}
                                    onChange={(e) => handleChange('phone', e.target.value)}
                                    placeholder="ex. +22236123456"
                                    className="pl-9 bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Mot de passe instantané *</Label>
                            <div className="relative">
                                <KeyRound className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                                <Input
                                    value={personal.password ?? ''}
                                    onChange={(e) => handleChange('password', e.target.value)}
                                    placeholder="ex. Eleve2024"
                                    className="pl-9 bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5"
                                />
                            </div>
                            <p className="text-[11px] text-gray-400 italic">Ce mot de passe sera communiqué à l'élève pour la première connexion.</p>
                        </div>
                    </>
                )}

                {!personal.hasPhone && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                        <p className="text-xs text-blue-500">Les parents pourront suivre cet élève via leur compte. L'élève n'aura pas accès à l'application.</p>
                    </div>
                )}
            </div>

            <div className="pt-6">
                <Button
                    onClick={onNext}
                    disabled={!isValid}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold h-12 rounded-xl"
                >
                    Suivant <ChevronRight className="ml-2 w-4 h-4" />
                </Button>
            </div>
        </div>
    )
}
