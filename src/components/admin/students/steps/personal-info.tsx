'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon, ChevronRight, User, MapPin, CreditCard, Home, KeyRound, Phone, Smartphone, SmartphoneNfc } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RegistrationData } from '../registration-wizard'
import { useLanguage } from '@/i18n'
import { toast } from 'sonner'

interface StepProps {
    data: RegistrationData
    updateData: (section: keyof RegistrationData, data: any) => void
    onNext: () => void
    onPrev: () => void
    savedCredentials?: any
}

function normalizeArabicDigits(str: string): string {
    const arabicDigits = /[٠-٩]/g;
    const persianDigits = /[۰-۹]/g;
    return str
        .replace(arabicDigits, (d) => String(d.charCodeAt(0) - 1632))
        .replace(persianDigits, (d) => String(d.charCodeAt(0) - 1776));
}

function cleanPhoneDigits(str: string): string {
    const normalized = normalizeArabicDigits(str);
    return normalized.replace(/\D/g, '');
}

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate()
}

export function PersonalInfo({ data, updateData, onNext }: StepProps) {
    const { t, language, direction } = useLanguage()
    const [isChecking, setIsChecking] = useState(false)
    const { personal } = data
    const months = language === 'ar'
        ? ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
        : ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

    // Parse existing date if any
    const existingDate = personal.dateOfBirth ? new Date(personal.dateOfBirth) : null
    const [selectedYear, setSelectedYear] = useState<string>(existingDate ? String(existingDate.getFullYear()) : '')
    const [selectedMonth, setSelectedMonth] = useState<string>(existingDate ? String(existingDate.getMonth()) : '')
    const [selectedDay, setSelectedDay] = useState<string>(existingDate ? String(existingDate.getDate()) : '')
    const [isOpen, setIsOpen] = useState(false)
    
    // Internal phone component state to combine code + number
    const [countryCode, setCountryCode] = useState('+222')
    const [localNumber, setLocalNumber] = useState('')

    const COMMON_COUNTRIES = [
        { code: '+222', label: '🇲🇷 +222' },
        { code: '+221', label: '🇸🇳 +221' },
        { code: '+212', label: '🇲🇦 +212' },
        { code: '+33',  label: '🇫🇷 +33' },
        { code: '+213', label: '🇩🇿 +213' },
        { code: '+216', label: '🇹🇳 +216' },
        { code: '+1',   label: '🇺🇸 +1' },
    ]

    // Push combination whenever sub-pieces change
    useEffect(() => {
        if (personal.hasPhone) {
            const combined = localNumber.trim() ? `${countryCode}${localNumber.trim().replace(/[^\d\s]/g, '')}` : ''
            if (personal.phone !== combined) {
                handleChange('phone', combined)
            }
        }
    }, [countryCode, localNumber, personal.hasPhone])

    // Seed local components from persistent data if present on reload
    useEffect(() => {
        if (personal.phone && !localNumber) {
            const known = ['+222', '+221', '+212', '+33', '+213', '+216', '+1']
            const hit = known.find(c => personal.phone.startsWith(c))
            if (hit) {
                setCountryCode(hit)
                setLocalNumber(personal.phone.substring(hit.length))
            } else {
                setLocalNumber(personal.phone)
            }
        }
    }, [])

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
        personal.nationalId?.trim().length === 10 &&
        (!personal.hasPhone || (personal.phone?.trim() && personal.password?.trim()))

    const handleNext = async () => {
        if (!personal.nationalId?.trim()) return
        
        if (personal.nationalId.trim().length !== 10) {
            toast.error(t('admin.students.register.errors.nniLengthError'))
            return
        }
        
        setIsChecking(true)
        try {
            const { checkStudentByNNI } = await import('@/app/auth/actions')
            const res = await checkStudentByNNI(personal.nationalId.trim())
            
            if (res.exists) {
                toast.error(t('admin.students.register.errors.nniExistsError').replace('{name}', res.fullName || ''))
                setIsChecking(false)
                return
            }
            
            onNext()
        } catch (err) {
            console.error('Error validating NNI:', err)
            toast.error(t('admin.students.register.errors.nniValidationError'))
        } finally {
            setIsChecking(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('admin.students.register.personal.title')}</h2>
                <p className="text-gray-400 text-sm">{t('admin.students.register.personal.subtitle')}</p>
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>{t('admin.students.register.personal.firstName')}</Label>
                        <div className="relative">
                            <User className={cn("absolute top-3 h-4 w-4 text-gray-500", direction === 'rtl' ? 'right-3' : 'left-3')} />
                            <Input
                                value={personal.firstName}
                                onChange={(e) => handleChange('firstName', e.target.value)}
                                placeholder={t('admin.students.register.personal.firstNamePlaceholder')}
                                className={cn("bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5", direction === 'rtl' ? 'pr-9 pl-3 text-right placeholder:text-right' : 'pl-9 pr-3 text-left placeholder:text-left')}
                                dir={direction}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>{t('admin.students.register.personal.lastName')}</Label>
                        <Input
                            value={personal.lastName}
                            onChange={(e) => handleChange('lastName', e.target.value)}
                            placeholder={t('admin.students.register.personal.lastNamePlaceholder')}
                            className={cn("bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5", direction === 'rtl' ? 'text-right placeholder:text-right' : 'text-left placeholder:text-left')}
                            dir={direction}
                        />
                    </div>
                </div>

                {/* Date de Naissance - Year → Month → Day */}
                <div className="space-y-2">
                    <Label>{t('admin.students.register.personal.birthDate')}</Label>
                    <Popover open={isOpen} onOpenChange={setIsOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                    "w-full justify-start font-normal bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-[#1A2530] hover:text-gray-900 dark:hover:text-white",
                                    direction === 'rtl' ? 'text-right' : 'text-left',
                                    !personal.dateOfBirth && "text-muted-foreground"
                                )}
                                dir={direction}
                            >
                                <CalendarIcon className={cn("h-4 w-4", direction === 'rtl' ? 'ml-2' : 'mr-2')} />
                                {formatDisplayDate() || <span>{t('admin.students.register.personal.chooseDate')}</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-4 bg-white dark:bg-[#0F1720] border-gray-200 dark:border-white/10" align="start">
                            <div className="space-y-3">
                                <p className="text-xs text-gray-500 font-bold uppercase mb-2">{t('admin.students.register.personal.selectDate')}</p>

                                {/* Year selector */}
                                <div className="space-y-1">
                                    <label className="text-xs text-gray-400">{t('admin.students.register.personal.year')}</label>
                                    <Select value={selectedYear} onValueChange={handleYearChange}>
                                        <SelectTrigger className="bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5 h-10 text-gray-900 dark:text-white" dir={direction}>
                                            <SelectValue placeholder={t('admin.students.register.personal.yearPlaceholder')} />
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
                                        <label className="text-xs text-gray-400">{t('admin.students.register.personal.month')}</label>
                                        <Select value={selectedMonth} onValueChange={handleMonthChange}>
                                            <SelectTrigger className="bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5 h-10 text-gray-900 dark:text-white" dir={direction}>
                                                <SelectValue placeholder={t('admin.students.register.personal.monthPlaceholder')} />
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
                                        <label className="text-xs text-gray-400">{t('admin.students.register.personal.day')}</label>
                                        <Select value={selectedDay} onValueChange={handleDayChange}>
                                            <SelectTrigger className="bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5 h-10 text-gray-900 dark:text-white" dir={direction}>
                                                <SelectValue placeholder={t('admin.students.register.personal.dayPlaceholder')} />
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
                    <Label>{t('admin.students.register.personal.gender')}</Label>
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => handleChange('gender', 'male')}
                            className={cn(
                                "flex items-center justify-center p-3 rounded-xl border transition-all",
                                personal.gender === 'male' ? "bg-emerald-500/20 border-emerald-500 text-emerald-500" : "bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#23303d]"
                            )}
                        >
                            {t('common.male')}
                        </button>
                        <button
                            onClick={() => handleChange('gender', 'female')}
                            className={cn(
                                "flex items-center justify-center p-3 rounded-xl border transition-all",
                                personal.gender === 'female' ? "bg-pink-500/20 border-pink-500 text-pink-500" : "bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#23303d]"
                            )}
                        >
                            {t('common.female')}
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>{t('admin.students.register.personal.birthPlace')}</Label>
                    <div className="relative">
                        <MapPin className={cn("absolute top-3 h-4 w-4 text-gray-500", direction === 'rtl' ? 'right-3' : 'left-3')} />
                        <Input
                            value={personal.placeOfBirth}
                            onChange={(e) => handleChange('placeOfBirth', e.target.value)}
                            placeholder={t('admin.students.register.personal.birthPlacePlaceholder')}
                            className={cn("bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5", direction === 'rtl' ? 'pr-9 pl-3 text-right placeholder:text-right' : 'pl-9 pr-3 text-left placeholder:text-left')}
                            dir={direction}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                        {t('admin.students.register.personal.nationalId')}
                        <span className="text-red-500 font-bold">*</span>
                    </Label>
                    <div className="relative">
                        <CreditCard className={cn("absolute top-3 h-4 w-4 text-gray-500", direction === 'rtl' ? 'right-3' : 'left-3')} />
                        <Input
                            value={personal.nationalId ?? ''}
                            onChange={(e) => {
                                const normalized = normalizeArabicDigits(e.target.value)
                                const val = normalized.replace(/\D/g, '').slice(0, 10)
                                handleChange('nationalId', val)
                            }}
                            maxLength={10}
                            placeholder={t('admin.students.register.personal.nationalIdPlaceholder') || "10 chiffres obligatoire"}
                            className={cn("bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5 font-mono tracking-wider", direction === 'rtl' ? 'pr-9 pl-3 text-right placeholder:text-right' : 'pl-9 pr-3 text-left placeholder:text-left')}
                            dir={direction}
                        />
                    </div>
                    <p className="text-[11px] text-gray-400 italic">{t('admin.students.register.personal.nationalIdHint')}</p>
                </div>

                <div className="space-y-2">
                    <Label>{t('common.address')}</Label>
                    <div className="relative">
                        <Home className={cn("absolute top-3 h-4 w-4 text-gray-500", direction === 'rtl' ? 'right-3' : 'left-3')} />
                        <Input
                            value={personal.address ?? ''}
                            onChange={(e) => handleChange('address', e.target.value)}
                            placeholder={t('admin.students.register.personal.addressPlaceholder')}
                            className={cn("bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5", direction === 'rtl' ? 'pr-9 pl-3 text-right placeholder:text-right' : 'pl-9 pr-3 text-left placeholder:text-left')}
                            dir={direction}
                        />
                    </div>
                </div>

                {/* Phone toggle */}
                <div className="pt-2 border-t border-gray-200 dark:border-white/5">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t('admin.students.register.personal.hasPhoneQuestion')}</p>
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
                            <SmartphoneNfc className="w-4 h-4" /> {t('common.no')}
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
                            <Smartphone className="w-4 h-4" /> {t('common.yes')}
                        </button>
                    </div>
                </div>

                {/* Phone + password — shown only if hasPhone */}
                {personal.hasPhone && (
                    <>
                        <div className="space-y-2">
                            <Label>{t('admin.students.register.personal.phoneRequired')}</Label>
                            <div className="relative flex items-center" style={{ direction: 'ltr' }}>
                                <div className="absolute left-1 z-10" style={{ position: 'absolute', left: '4px', right: 'auto', zIndex: 10 }}>
                                    <select
                                        value={countryCode}
                                        onChange={(e) => setCountryCode(e.target.value)}
                                        className="bg-transparent text-gray-500 dark:text-gray-400 text-[10px] font-bold pl-2 pr-1 py-1 focus:outline-none appearance-none border-r border-gray-200 dark:border-white/10 cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors"
                                        style={{ borderRight: '1px solid rgba(255,255,255,0.1)', borderLeft: 'none', paddingLeft: '6px', paddingRight: '4px' }}
                                    >
                                        {COMMON_COUNTRIES.map(c => (
                                            <option key={c.code} value={c.code} className="bg-white dark:bg-[#1A2530] text-black dark:text-white">{c.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <Input
                                    value={localNumber}
                                    onChange={(e) => setLocalNumber(cleanPhoneDigits(e.target.value))}
                                    placeholder={t('admin.students.register.personal.phonePlaceholder')}
                                    className="bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5"
                                    style={{ paddingLeft: '64px', paddingRight: '12px', textAlign: 'left', direction: 'ltr' }}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>{t('admin.students.register.personal.tempPassword')}</Label>
                            <div className="relative" style={{ direction: 'ltr' }}>
                                <KeyRound className={cn("absolute top-3 h-4 w-4 text-gray-500", direction === 'rtl' ? 'right-3' : 'left-3')} style={{ left: direction === 'rtl' ? 'auto' : '12px', right: direction === 'rtl' ? '12px' : 'auto' }} />
                                <Input
                                    value={personal.password ?? ''}
                                    onChange={(e) => handleChange('password', e.target.value)}
                                    placeholder={t('admin.students.register.personal.tempPasswordPlaceholder')}
                                    className={cn("bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5", direction === 'rtl' ? 'pr-9 pl-3' : 'pl-9 pr-3')}
                                    style={{ textAlign: 'left', direction: 'ltr' }}
                                    dir="ltr"
                                />
                            </div>
                            <p className="text-[11px] text-gray-400 italic">{t('admin.students.register.personal.tempPasswordHint')}</p>
                        </div>
                    </>
                )}

                {!personal.hasPhone && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                        <p className="text-xs text-blue-500">{t('admin.students.register.personal.parentsOnlyAccess')}</p>
                    </div>
                )}
            </div>

            <div className="pt-6">
                <Button
                    onClick={handleNext}
                    disabled={!isValid || isChecking}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold h-12 rounded-xl relative"
                >
                    {isChecking ? (
                        <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto" />
                    ) : (
                        <>
                            {t('common.next')} <ChevronRight className={cn("ml-2 w-4 h-4", direction === 'rtl' && "rotate-180")} />
                        </>
                    )}
                </Button>
            </div>
        </div>
    )
}
