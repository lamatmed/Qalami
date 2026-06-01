'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Camera, User, Phone, Mail, Briefcase, KeyRound, Loader2, UserPlus, AlertTriangle } from 'lucide-react'
import { useLanguage } from '@/i18n'
import { cn } from '@/lib/utils'

interface PersonalInfoStepProps {
    data: any
    onUpdate: (data: any) => void
    onNext: () => void
    isSubmitting?: boolean
}

export function PersonalInfoStep({ data, onUpdate, onNext, isSubmitting }: PersonalInfoStepProps) {
    const { t, direction } = useLanguage()
    
    // Track internal pieces to build full phone string
    const [countryCode, setCountryCode] = useState('+222')
    const [localNumber, setLocalNumber] = useState('')

    // Sync with outer data whenever pieces change
    useEffect(() => {
        const combined = localNumber.trim() ? `${countryCode}${localNumber.trim()}` : ''
        // Only update if it actually changed to prevent recursive loops
        if (data.phone !== combined) {
            onUpdate({ ...data, phone: combined })
        }
    }, [countryCode, localNumber])

    // Support parsing initial default data if re-editing
    useEffect(() => {
        if (data.phone && !localNumber) {
            // Simple heuristic to detect standard codes
            const knownCodes = ['+222', '+221', '+212', '+33', '+213', '+216', '+1']
            const code = knownCodes.find(c => data.phone.startsWith(c))
            if (code) {
                setCountryCode(code)
                setLocalNumber(data.phone.substring(code.length))
            } else {
                setLocalNumber(data.phone)
            }
        }
    }, [])

    const COMMON_COUNTRIES = [
        { code: '+222', label: '🇲🇷 +222' },
        { code: '+221', label: '🇸🇳 +221' },
        { code: '+212', label: '🇲🇦 +212' },
        { code: '+33',  label: '🇫🇷 +33' },
        { code: '+213', label: '🇩🇿 +213' },
        { code: '+216', label: '🇹🇳 +216' },
        { code: '+1',   label: '🇺🇸 +1' },
    ]

    // Stage flags
    const [isPhoneVerified, setIsPhoneVerified] = useState(false)
    const [checkingPhone, setCheckingPhone] = useState(false)
    const [foundExistingUser, setFoundExistingUser] = useState<any>(null)
    const [validationError, setValidationError] = useState('')

    const handleCheckPhone = async () => {
        setValidationError('')
        const raw = localNumber.trim().replace(/[^\d\s]/g, '')
        if (raw.length < 4) {
            setValidationError(t('admin.teachers.personalInfoStep.invalidPhoneError'))
            return
        }
        setCheckingPhone(true)
        try {
            const combined = `${countryCode}${raw}`
            const { checkUserByPhone } = await import('@/app/auth/actions')
            const res = await checkUserByPhone(combined)

            if (res.exists) {
                if (res.role !== 'teacher') {
                    setValidationError(t('admin.teachers.personalInfoStep.numberAlreadyExistsError'))
                    setIsPhoneVerified(false)
                } else {
                    setFoundExistingUser(res)
                    setIsPhoneVerified(true)
                    onUpdate({ ...data, name: res.fullName, phone: combined })
                }
            } else {
                setFoundExistingUser(null)
                setIsPhoneVerified(true)
                onUpdate({ ...data, phone: combined })
            }
        } catch (err) {
            setValidationError(t('admin.teachers.personalInfoStep.technicalError'))
        } finally {
            setCheckingPhone(false)
        }
    }

    return (
        <div className="space-y-6" dir={direction}>
            {/* Phone input always visible at top */}
            <div className="space-y-2">
                <Label className={cn("text-gray-300 font-medium block w-full", direction === 'rtl' ? 'text-right' : 'text-left')}>{t('admin.teachers.phone')}</Label>
                <div className="relative flex items-center">
                    <div className={cn("absolute z-10", direction === 'rtl' ? 'right-1' : 'left-1')}>
                        <select
                             value={countryCode}
                             onChange={(e) => { setCountryCode(e.target.value); setIsPhoneVerified(false); }}
                             disabled={isPhoneVerified}
                             className={cn("bg-transparent text-gray-300 text-xs font-bold pl-2 pr-1 py-1.5 focus:outline-none appearance-none cursor-pointer hover:text-white transition-colors disabled:opacity-50", direction === 'rtl' ? 'border-l border-white/10' : 'border-r border-white/10')}
                        >
                            {COMMON_COUNTRIES.map(c => (
                                <option key={c.code} value={c.code} className="bg-[#1A2530] text-white">{c.label}</option>
                            ))}
                        </select>
                    </div>
                    <Input
                        placeholder={t('admin.teachers.phonePlaceholder')}
                        className={cn("bg-[#0F1720] border-white/10 text-white focus:ring-emerald-500/50 tracking-wide h-12 disabled:opacity-70", direction === 'rtl' ? 'pr-20 pl-24 text-right' : 'pl-20 pr-24 text-left')}
                        value={localNumber}
                        onChange={(e) => { setLocalNumber(e.target.value.replace(/[^\d\s]/g, '')); setIsPhoneVerified(false); }}
                        disabled={isPhoneVerified}
                        dir={direction}
                    />
                    {!isPhoneVerified && (
                        <Button 
                            onClick={handleCheckPhone}
                            disabled={checkingPhone || !localNumber.trim()}
                            className={cn("absolute bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs h-10 px-3", direction === 'rtl' ? 'left-1' : 'right-1')}
                        >
                            {checkingPhone ? <Loader2 className="w-4 h-4 animate-spin" /> : t('admin.teachers.personalInfoStep.verify')}
                        </Button>
                    )}
                    {isPhoneVerified && (
                        <button 
                            onClick={() => { setIsPhoneVerified(false); setFoundExistingUser(null); }}
                            className={cn("absolute text-emerald-500 hover:text-white transition-colors flex items-center gap-1 text-xs border border-emerald-500/20 bg-emerald-500/5 px-2 py-1 rounded-md", direction === 'rtl' ? 'left-3' : 'right-3')}
                        >
                            <KeyRound className="w-3 h-3" /> {t('admin.teachers.personalInfoStep.edit')}
                        </button>
                    )}
                </div>
                {validationError && (
                    <div className={cn("flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg mt-2 animate-in slide-in-from-top-1 duration-200", direction === 'rtl' ? 'flex-row-reverse text-right' : 'flex-row text-left')}>
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{validationError}</span>
                    </div>
                )}
            </div>

            {!isPhoneVerified && !checkingPhone && !validationError && (
                <div className="py-8 text-center bg-white/5 rounded-xl border border-dashed border-white/10">
                    <Phone className="w-8 h-8 text-gray-500 mx-auto mb-2 opacity-50" />
                    <p className="text-gray-400 text-sm">{t('admin.teachers.personalInfoStep.enterPhoneToStart')}</p>
                </div>
            )}

            {/* CASE A: Existing Teacher Found */}
            {isPhoneVerified && foundExistingUser && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 space-y-4 animate-in slide-in-from-top-4 duration-300">
                    <div className={cn("flex items-center gap-4", direction === 'rtl' ? 'flex-row-reverse text-right' : 'flex-row text-left')}>
                        <div className="h-14 w-14 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
                            <User className="w-7 h-7" />
                        </div>
                        <div>
                            <div className="bg-emerald-500/20 text-emerald-400 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded inline-block mb-1">{t('admin.teachers.personalInfoStep.existingAccountLabel')}</div>
                            <h3 className="text-xl font-bold text-white">{foundExistingUser.fullName}</h3>
                        </div>
                    </div>
                    <p className={cn("text-gray-400 text-sm border-t border-white/5 pt-4", direction === 'rtl' ? 'text-right' : 'text-left')}>
                        {t('admin.teachers.personalInfoStep.existingAccountDesc')}
                    </p>
                    <div className="pt-2">
                        <Button 
                            onClick={onNext} 
                            disabled={isSubmitting}
                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold h-12 text-lg shadow-[0_0_20px_rgba(16,185,129,0.1)]"
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <><UserPlus className={cn("w-5 h-5", direction === 'rtl' ? 'ml-2' : 'mr-2')} /> {t('admin.teachers.personalInfoStep.finish')}</>
                            )}
                        </Button>
                    </div>
                </div>
            )}

            {/* CASE B: Complete details for NEW teacher */}
            {isPhoneVerified && !foundExistingUser && (
                <div className="space-y-6 animate-in slide-in-from-top-8 duration-500">
                    <div className={cn("bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm p-3 rounded-xl flex items-center gap-2", direction === 'rtl' ? 'flex-row-reverse text-right' : 'flex-row text-left')}>
                        <User className="w-4 h-4 shrink-0" /> {t('admin.teachers.personalInfoStep.newAccountAlert')}
                    </div>

                    {/* Photo Upload */}
                    <div className="flex flex-col items-center justify-center mb-4">
                        <div className="relative group cursor-pointer">
                            <div className="h-24 w-24 rounded-full border-4 border-[#0F1720] bg-gray-700 flex items-center justify-center overflow-hidden">
                                {data.photo ? (
                                    <img src={data.photo} alt="Profile" className="h-full w-full object-cover" />
                                ) : (
                                    <User className="w-10 h-10 text-gray-500" />
                                )}
                            </div>
                            <div className="absolute bottom-0 right-0 bg-emerald-500 rounded-full p-1.5 border-4 border-[#1A2530] text-black shadow-lg group-hover:bg-emerald-400 transition-colors">
                                <Camera className="w-3 h-3" />
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1 font-medium uppercase">{t('admin.teachers.profilePhoto')}</p>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className={cn("text-gray-300 block w-full", direction === 'rtl' ? 'text-right' : 'text-left')}>{t('admin.teachers.fullName')}</Label>
                            <div className="relative">
                                <User className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500", direction === 'rtl' ? 'right-3' : 'left-3')} />
                                <Input
                                    placeholder={t('admin.teachers.fullNamePlaceholder')}
                                    className={cn("bg-[#0F1720] border-white/10 text-white focus:ring-emerald-500/50", direction === 'rtl' ? 'pr-10 pl-3 text-right' : 'pl-10 pr-3 text-left')}
                                    defaultValue={data.name}
                                    onChange={(e) => onUpdate({ ...data, name: e.target.value })}
                                    dir={direction}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className={cn("text-gray-300 block w-full", direction === 'rtl' ? 'text-right' : 'text-left')}>{t('admin.teachers.email')}</Label>
                            <div className="relative">
                                <Mail className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500", direction === 'rtl' ? 'right-3' : 'left-3')} />
                                <Input
                                    placeholder={t('admin.teachers.emailPlaceholder')}
                                    className={cn("bg-[#0F1720] border-white/10 text-white focus:ring-emerald-500/50", direction === 'rtl' ? 'pr-10 pl-3 text-right' : 'pl-10 pr-3 text-left')}
                                    defaultValue={data.email}
                                    onChange={(e) => onUpdate({ ...data, email: e.target.value })}
                                    dir={direction}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className={cn("text-gray-300 block w-full", direction === 'rtl' ? 'text-right' : 'text-left')}>{t('admin.teachers.nni')}</Label>
                                <div className="relative">
                                    <Briefcase className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500", direction === 'rtl' ? 'right-3' : 'left-3')} />
                                    <Input
                                        placeholder={t('admin.teachers.nniPlaceholder')}
                                        className={cn("bg-[#0F1720] border-white/10 text-white focus:ring-emerald-500/50", direction === 'rtl' ? 'pr-10 pl-3 text-right' : 'pl-10 pr-3 text-left')}
                                        defaultValue={data.nni}
                                        onChange={(e) => onUpdate({ ...data, nni: e.target.value })}
                                        dir={direction}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className={cn("text-gray-300 block w-full", direction === 'rtl' ? 'text-right' : 'text-left')}>{t('admin.teachers.tempPassword')}</Label>
                                <div className="relative">
                                    <KeyRound className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500", direction === 'rtl' ? 'right-3' : 'left-3')} />
                                    <Input
                                        placeholder={t('admin.teachers.tempPasswordPlaceholder')}
                                        className={cn("bg-[#0F1720] border-white/10 text-white focus:ring-emerald-500/50", direction === 'rtl' ? 'pr-10 pl-3 text-right' : 'pl-10 pr-3 text-left')}
                                        defaultValue={data.password}
                                        onChange={(e) => {
                                            const digits = e.target.value.replace(/\D/g, '').slice(0, 6)
                                            onUpdate({ ...data, password: digits })
                                        }}
                                        dir="ltr"
                                        inputMode="numeric"
                                        maxLength={6}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6">
                        <Button
                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold h-12 text-lg shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                            onClick={onNext}
                            disabled={!data.name?.trim() || !/^\d{6}$/.test(data.password ?? '') || isSubmitting}
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <><UserPlus className={cn("w-5 h-5", direction === 'rtl' ? 'ml-2' : 'mr-2')} /> {t('admin.teachers.saveTeacher')}</>
                            )}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
