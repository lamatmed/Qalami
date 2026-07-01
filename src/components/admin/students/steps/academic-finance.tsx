'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ChevronLeft, GraduationCap, Loader2, Layers } from 'lucide-react'
import { RegistrationData } from '../registration-wizard'
import { useLanguage } from '@/i18n'
import { cn } from '@/lib/utils'

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
    cycle?: string | null
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

function normalizeArabicDigits(str: string): string {
    const arabicDigits = /[٠-٩]/g;
    const persianDigits = /[۰-۹]/g;
    return str
        .replace(arabicDigits, (d) => String(d.charCodeAt(0) - 1632))
        .replace(persianDigits, (d) => String(d.charCodeAt(0) - 1776));
}

function cleanNumber(val: string): number {
    const normalized = normalizeArabicDigits(val);
    const cleaned = normalized.replace(/\D/g, '');
    return cleaned ? Number(cleaned) : 0;
}

export function AcademicFinance({ data, updateData, onNext, onPrev }: StepProps) {
    const { t, direction, language } = useLanguage()
    const { academic } = data
    const [levels, setLevels] = useState<LevelOption[]>([])
    const [classes, setClasses] = useState<ClassOption[]>([])
    const [cycleConfigs, setCycleConfigs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [apiError, setApiError] = useState<string | null>(null)
    const academicYearOptions = getAcademicYearOptions()

    // 1. Load Context & Reference Configs
    useEffect(() => {
        fetch('/api/admin/registration-data')
            .then(res => res.json())
            .then(json => {
                if (json.error) { setApiError(json.error); return }
                setLevels(json.levels || [])
                setClasses(json.classes || [])
                setCycleConfigs(json.cycleConfigs || [])
            })
            .catch(err => setApiError(String(err)))
            .finally(() => setLoading(false))
    }, [])

    // 2. Real-time dynamic calculation of yearly total
    useEffect(() => {
        const annualTotal = (academic.registrationFee || 0) + ((academic.monthlyTuition || 0) * 9)
        if (academic.tuitionFee !== annualTotal) {
            updateData('academic', { tuitionFee: annualTotal })
        }
    }, [academic.registrationFee, academic.monthlyTuition])

    const handleChange = (field: string, value: any) => {
        updateData('academic', { [field]: value })
    }

    const handleLevelChange = (levelId: string) => {
        const selectedLevel = levels.find(l => l.id === levelId)
        const levelCycle = selectedLevel?.cycle

        // If a configured price exists for this educational cycle, auto-fill registration and monthly tuition!
        let targetRegFee = academic.registrationFee
        let targetMonthly = academic.monthlyTuition

        if (levelCycle) {
            const config = cycleConfigs.find(c => c.cycle === levelCycle)
            if (config) {
                targetRegFee = config.default_registration_fee || 0
                targetMonthly = config.default_monthly_tuition || 0
            }
        }

        updateData('academic', { 
            level: selectedLevel?.name_fr || levelId, 
            levelId, 
            className: '', 
            classId: '',
            registrationFee: targetRegFee,
            monthlyTuition: targetMonthly
        })
    }

    // Filter classes by selected levelId
    const filteredClasses = academic.levelId
        ? classes.filter(c => c.level_id === academic.levelId)
        : []

    if (apiError) return (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <p className="text-red-400 text-sm font-semibold">Erreur chargement données</p>
            <p className="text-red-300 text-xs font-mono bg-red-500/10 px-3 py-2 rounded-lg">{apiError}</p>
        </div>
    )

    return (
        <div className="space-y-6">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('admin.students.register.academic.title')}</h2>
                <p className="text-gray-400 text-sm">{t('admin.students.register.academic.subtitle')}</p>
            </div>

            <div className="space-y-6">
                {/* Academic Section */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <GraduationCap className="w-5 h-5 text-emerald-500" />
                        <h3 className="font-bold text-gray-900 dark:text-white">{t('admin.students.register.academic.assignmentTitle')}</h3>
                    </div>

                    <div className="space-y-2 mb-4">
                        <Label>{t('admin.students.register.academic.academicYear')}</Label>
                        <Select onValueChange={(val) => handleChange('academicYear', val)} value={academic.academicYear}>
                            <SelectTrigger className="bg-[#1A2530] border-white/5 h-11" dir={direction}>
                                <SelectValue placeholder={t('admin.students.register.academic.chooseYear')} />
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
                            <Label>{t('admin.students.register.academic.studyLevel')}</Label>
                            <Select onValueChange={handleLevelChange} value={academic.levelId || undefined}>
                                <SelectTrigger className="bg-[#1A2530] border-white/5 h-11" dir={direction}>
                                    <SelectValue placeholder={t('admin.students.register.academic.chooseLevel')} />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1A2530] border-white/5 text-white">
                                    {loading ? (
                                        <div className="flex items-center justify-center p-2">
                                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                        </div>
                                    ) : levels.length === 0 ? (
                                        <div className="px-4 py-2 text-xs text-gray-500">{t('admin.students.register.academic.noLevelFound')}</div>
                                    ) : (
                                        levels.map(l => (
                                            <SelectItem key={l.id} value={l.id}>{l.name_fr}</SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>{t('admin.students.register.academic.classroom')}</Label>
                            <Select
                                key={academic.levelId}
                                onValueChange={(val) => handleChange('className', val)}
                                value={academic.className || undefined}
                                disabled={!academic.levelId}
                            >
                                <SelectTrigger className="bg-[#1A2530] border-white/5 h-11 disabled:opacity-50" dir={direction}>
                                    <SelectValue placeholder={!academic.levelId ? t('admin.students.register.academic.chooseLevelFirst') : t('admin.students.register.academic.chooseClass')} />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1A2530] border-white/5 text-white">
                                    {loading ? (
                                        <div className="flex items-center justify-center p-2">
                                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                        </div>
                                    ) : filteredClasses.length === 0 ? (
                                        <div className="px-4 py-2 text-xs text-gray-500">{t('admin.students.register.academic.noClassForLevel')}</div>
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

                {/* Finance Section */}
                <div className="bg-[#1A2530]/50 p-5 rounded-2xl border border-white/5 space-y-5">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-emerald-500">MR</span>
                            <h3 className="font-bold text-gray-900 dark:text-white">{t('admin.students.register.academic.financeTitle')}</h3>
                        </div>
                        {academic.levelId && (
                            <div className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/10 flex items-center gap-1">
                                <Layers className="w-3 h-3" /> {t('admin.students.register.academic.autoPricing')}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-gray-400">{t('admin.students.register.academic.registrationFee')}</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-black text-gray-500">MR</span>
                                <Input
                                    type="number"
                                    value={academic.registrationFee}
                                    onChange={(e) => handleChange('registrationFee', cleanNumber(e.target.value))}
                                    className="bg-[#0F1720] border-white/5 pl-9 font-mono text-emerald-500 font-bold h-11 focus:border-emerald-500/30"
                                    style={{ textAlign: 'left', direction: 'ltr' }}
                                    dir="ltr"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-gray-400">{t('admin.students.register.academic.monthlyTuitionLabel')}</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-black text-gray-500">MR</span>
                                <Input
                                    type="number"
                                    value={academic.monthlyTuition}
                                    onChange={(e) => handleChange('monthlyTuition', cleanNumber(e.target.value))}
                                    className="bg-[#0F1720] border-white/5 pl-9 font-mono text-emerald-500 font-bold h-11 focus:border-emerald-500/30"
                                    style={{ textAlign: 'left', direction: 'ltr' }}
                                    dir="ltr"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex items-center justify-between bg-[#0F1720] p-3.5 rounded-xl border border-white/5">
                            <div className="space-y-0.5">
                                <p className="text-sm font-semibold text-gray-200">{t('admin.students.register.academic.markPaidNow')}</p>
                                <p className="text-[10px] text-gray-500">{t('admin.students.register.academic.markPaidNowHint')}</p>
                            </div>
                            <Switch
                                checked={academic.isPaid}
                                onCheckedChange={(checked) => handleChange('isPaid', checked)}
                            />
                        </div>

                        <div className="space-y-2 flex flex-col justify-center bg-[#0F1720] p-3.5 rounded-xl border border-white/5">
                            <Label className="text-xs font-semibold text-gray-400 flex justify-between">
                                <span>{t('admin.students.register.academic.advanceMonthsLabel')}</span>
                                <span className="text-emerald-400 font-bold">{(academic.advanceMonths || 0)} {t('admin.students.register.academic.monthsUnit')}</span>
                            </Label>
                            <div className="flex gap-2 items-center mt-1">
                                <Input
                                    type="number"
                                    min="0"
                                    max="10"
                                    placeholder={language === 'ar' ? 'مثال: 1' : 'Ex: 1'}
                                    value={academic.advanceMonths === 0 ? '' : academic.advanceMonths}
                                    onChange={(e) => {
                                        const val = Math.min(10, Math.max(0, cleanNumber(e.target.value)))
                                        handleChange('advanceMonths', val)
                                    }}
                                    className="bg-[#161B22] border-white/5 font-mono h-9 text-emerald-400 font-bold w-full focus:border-emerald-500/30 text-center"
                                    style={{ textAlign: 'left', direction: 'ltr' }}
                                    dir="ltr"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Cash Breakdown Indicator */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 flex flex-col justify-center relative overflow-hidden group">
                            <div className="absolute -right-6 -top-6 w-12 h-12 rounded-full bg-emerald-500/5 blur-md group-hover:bg-emerald-500/10 transition-all" />
                            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1 relative z-10">{t('admin.students.register.academic.amountToCollectToday')}</p>
                            <p className="text-2xl font-black text-emerald-400 relative z-10">
                                {((academic.isPaid ? academic.registrationFee : 0) + (academic.monthlyTuition * (academic.advanceMonths || 0))).toLocaleString(language === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR')} <span className="text-xs font-bold">{language === 'ar' ? 'أوقية' : 'MRU'}</span>
                            </p>
                        </div>

                        <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5 flex flex-col justify-center text-center">
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">{t('admin.students.register.academic.estimatedAnnualTotal')}</p>
                            <p className="text-xl font-black text-gray-300">
                                {academic.tuitionFee.toLocaleString(language === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR')} <span className="text-xs font-bold">{language === 'ar' ? 'أوقية' : 'MRU'}</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex gap-4 pt-6">
                <Button
                    variant="outline"
                    onClick={onPrev}
                    className="flex-1 bg-transparent border-white/10 text-white h-12 rounded-xl hover:bg-white/5 transition-all font-semibold"
                >
                    <ChevronLeft className={cn("mr-2 w-4 h-4", direction === 'rtl' && "rotate-180")} /> {t('common.back')}
                </Button>
                <Button
                    onClick={onNext}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold h-12 rounded-xl shadow-md hover:shadow-emerald-500/10 transition-all"
                >
                    {t('admin.students.register.academic.confirmRegistration')}
                </Button>
            </div>
        </div>
    )
}
