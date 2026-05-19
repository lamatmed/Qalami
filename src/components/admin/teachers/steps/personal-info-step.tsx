'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Camera, User, Phone, Mail, Briefcase, KeyRound, Loader2, UserPlus, AlertTriangle } from 'lucide-react'
import { useLanguage } from '@/i18n'

interface PersonalInfoStepProps {
    data: any
    onUpdate: (data: any) => void
    onNext: () => void
    isSubmitting?: boolean
}

export function PersonalInfoStep({ data, onUpdate, onNext, isSubmitting }: PersonalInfoStepProps) {
    const { t } = useLanguage()
    
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
            setValidationError("Veuillez saisir un numéro de téléphone valide")
            return
        }
        setCheckingPhone(true)
        try {
            const combined = `${countryCode}${raw}`
            const { checkUserByPhone } = await import('@/app/auth/actions')
            const res = await checkUserByPhone(combined)

            if (res.exists) {
                if (res.role !== 'teacher') {
                    setValidationError(`Ce numéro est déjà rattaché à un compte. Impossible de l'utiliser comme enseignant.`)
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
            setValidationError("Erreur technique lors de la vérification")
        } finally {
            setCheckingPhone(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Phone input always visible at top */}
            <div className="space-y-2">
                <Label className="text-gray-300 font-medium">{t('admin.teachers.phone')}</Label>
                <div className="relative flex items-center">
                    <div className="absolute left-1 z-10">
                        <select
                            value={countryCode}
                            onChange={(e) => { setCountryCode(e.target.value); setIsPhoneVerified(false); }}
                            disabled={isPhoneVerified}
                            className="bg-transparent text-gray-300 text-xs font-bold pl-2 pr-1 py-1.5 focus:outline-none appearance-none border-r border-white/10 cursor-pointer hover:text-white transition-colors disabled:opacity-50"
                        >
                            {COMMON_COUNTRIES.map(c => (
                                <option key={c.code} value={c.code} className="bg-[#1A2530] text-white">{c.label}</option>
                            ))}
                        </select>
                    </div>
                    <Input
                        placeholder={t('admin.teachers.phonePlaceholder')}
                        className="pl-20 pr-24 bg-[#0F1720] border-white/10 text-white focus:ring-emerald-500/50 tracking-wide h-12 disabled:opacity-70"
                        value={localNumber}
                        onChange={(e) => { setLocalNumber(e.target.value.replace(/[^\d\s]/g, '')); setIsPhoneVerified(false); }}
                        disabled={isPhoneVerified}
                    />
                    {!isPhoneVerified && (
                        <Button 
                            onClick={handleCheckPhone}
                            disabled={checkingPhone || !localNumber.trim()}
                            className="absolute right-1 bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs h-10 px-3"
                        >
                            {checkingPhone ? <Loader2 className="w-4 h-4 animate-spin" /> : "Vérifier"}
                        </Button>
                    )}
                    {isPhoneVerified && (
                        <button 
                            onClick={() => { setIsPhoneVerified(false); setFoundExistingUser(null); }}
                            className="absolute right-3 text-emerald-500 hover:text-white transition-colors flex items-center gap-1 text-xs border border-emerald-500/20 bg-emerald-500/5 px-2 py-1 rounded-md"
                        >
                            <KeyRound className="w-3 h-3" /> Modifier
                        </button>
                    )}
                </div>
                {validationError && (
                    <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg mt-2 animate-in slide-in-from-top-1 duration-200">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{validationError}</span>
                    </div>
                )}
            </div>

            {!isPhoneVerified && !checkingPhone && !validationError && (
                <div className="py-8 text-center bg-white/5 rounded-xl border border-dashed border-white/10">
                    <Phone className="w-8 h-8 text-gray-500 mx-auto mb-2 opacity-50" />
                    <p className="text-gray-400 text-sm">Entrez le numéro de téléphone pour commencer</p>
                </div>
            )}

            {/* CASE A: Existing Teacher Found */}
            {isPhoneVerified && foundExistingUser && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 space-y-4 animate-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                            <User className="w-7 h-7" />
                        </div>
                        <div>
                            <div className="bg-emerald-500/20 text-emerald-400 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded inline-block mb-1">Compte existant</div>
                            <h3 className="text-xl font-bold text-white">{foundExistingUser.fullName}</h3>
                        </div>
                    </div>
                    <p className="text-gray-400 text-sm border-t border-white/5 pt-4">
                        Cet enseignant est déjà inscrit sur Qalami. Cliquez sur Terminer pour 
                        <strong> l'attacher à votre école </strong>. Il restera dans ses autres établissements 
                        mais deviendra visible et opérationnel dans votre annuaire local.
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
                                <><UserPlus className="w-5 h-5 mr-2" /> Terminer</>
                            )}
                        </Button>
                    </div>
                </div>
            )}

            {/* CASE B: Complete details for NEW teacher */}
            {isPhoneVerified && !foundExistingUser && (
                <div className="space-y-6 animate-in slide-in-from-top-8 duration-500">
                    <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm p-3 rounded-xl flex items-center gap-2">
                        <User className="w-4 h-4" /> Nouveau compte ! Complétez le profil ci-dessous.
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
                            <Label className="text-gray-300">{t('admin.teachers.fullName')}</Label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <Input
                                    placeholder={t('admin.teachers.fullNamePlaceholder')}
                                    className="pl-10 bg-[#0F1720] border-white/10 text-white focus:ring-emerald-500/50"
                                    defaultValue={data.name}
                                    onChange={(e) => onUpdate({ ...data, name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-gray-300">{t('admin.teachers.email')}</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <Input
                                    placeholder={t('admin.teachers.emailPlaceholder')}
                                    className="pl-10 bg-[#0F1720] border-white/10 text-white focus:ring-emerald-500/50"
                                    defaultValue={data.email}
                                    onChange={(e) => onUpdate({ ...data, email: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-gray-300">{t('admin.teachers.nni')}</Label>
                                <div className="relative">
                                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <Input
                                        placeholder={t('admin.teachers.nniPlaceholder')}
                                        className="pl-10 bg-[#0F1720] border-white/10 text-white focus:ring-emerald-500/50"
                                        defaultValue={data.nni}
                                        onChange={(e) => onUpdate({ ...data, nni: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-gray-300">{t('admin.teachers.tempPassword')}</Label>
                                <div className="relative">
                                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <Input
                                        placeholder={t('admin.teachers.tempPasswordPlaceholder')}
                                        className="pl-10 bg-[#0F1720] border-white/10 text-white focus:ring-emerald-500/50"
                                        defaultValue={data.password}
                                        onChange={(e) => onUpdate({ ...data, password: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6">
                        <Button
                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold h-12 text-lg shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                            onClick={onNext}
                            disabled={!data.name?.trim() || !data.password?.trim() || isSubmitting}
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <><UserPlus className="w-5 h-5 mr-2" /> {t('admin.teachers.saveTeacher')}</>
                            )}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
