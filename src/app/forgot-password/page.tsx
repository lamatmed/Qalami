'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, ArrowRight, ArrowLeft, Loader2, ShieldCheck, KeyRound, CheckCircle2, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PinInput } from '@/components/auth/pin-input'
import { useLanguage } from '@/i18n'
import { toast } from 'sonner'
import Link from 'next/link'
import Image from 'next/image'
import { LanguageSwitcher } from '@/components/shared/language-switcher'
import { requestPasswordReset, verifyPasswordResetOTP, resetPin } from '@/app/auth/password-reset-actions'

type Step = 'phone' | 'otp' | 'newpin' | 'success'

export default function ForgotPasswordPage() {
    const { t, direction } = useLanguage()
    const [step, setStep] = useState<Step>('phone')
    const [isLoading, setIsLoading] = useState(false)
    const [phone, setPhone] = useState('')
    const [otp, setOtp] = useState('')
    const [newPin, setNewPin] = useState('')
    const [confirmPin, setConfirmPin] = useState('')
    const [userName, setUserName] = useState('')
    const [countdown, setCountdown] = useState(0)

    const countryCodes = useMemo(() => [
        { code: '+222', flag: '🇲🇷', name: t('auth.countries.mauritania') },
        { code: '+221', flag: '🇸🇳', name: t('auth.countries.senegal') },
        { code: '+223', flag: '🇲🇱', name: t('auth.countries.mali') },
        { code: '+212', flag: '🇲🇦', name: t('auth.countries.morocco') },
        { code: '+213', flag: '🇩🇿', name: t('auth.countries.algeria') },
        { code: '+216', flag: '🇹🇳', name: t('auth.countries.tunisia') },
        { code: '+33', flag: '🇫🇷', name: t('auth.countries.france') },
        { code: '+1', flag: '🇺🇸', name: t('auth.countries.usa') },
    ], [t])

    const [countryCode, setCountryCode] = useState(countryCodes[0])
    const [showCountryDropdown, setShowCountryDropdown] = useState(false)

    const isRtl = direction === 'rtl'

    // Full phone number with country code
    const fullPhone = countryCode.code + phone.replace(/^0+/, '')

    // Countdown timer for resend
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
            return () => clearTimeout(timer)
        }
    }, [countdown])

    const handleSendOTP = useCallback(async () => {
        if (!phone.trim()) {
            toast.error(t('auth.otp.phoneRequired'))
            return
        }
        setIsLoading(true)
        try {
            const result = await requestPasswordReset(fullPhone)
            if (result.error) {
                toast.error(result.error)
            } else {
                setUserName(result.userName || '')
                setStep('otp')
                setCountdown(60)
                toast.success(t('auth.otp.codeSent'))
            }
        } catch {
            toast.error(t('auth.unknownError'))
        } finally {
            setIsLoading(false)
        }
    }, [phone, fullPhone, t])

    const handleVerifyOTP = useCallback(async () => {
        if (otp.length !== 6) {
            toast.error(t('auth.otp.codeRequired'))
            return
        }
        setIsLoading(true)
        try {
            const result = await verifyPasswordResetOTP(fullPhone, otp)
            if (result.error) {
                toast.error(result.error)
            } else {
                setStep('newpin')
                toast.success(t('auth.otp.verified'))
            }
        } catch {
            toast.error(t('auth.unknownError'))
        } finally {
            setIsLoading(false)
        }
    }, [fullPhone, otp, t])

    const handleResetPin = useCallback(async () => {
        if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
            toast.error(t('auth.otp.pinInvalid'))
            return
        }
        if (newPin !== confirmPin) {
            toast.error(t('auth.pinMismatch'))
            return
        }
        setIsLoading(true)
        try {
            const result = await resetPin(fullPhone, newPin)
            if (result.error) {
                toast.error(result.error)
            } else {
                setStep('success')
            }
        } catch {
            toast.error(t('auth.unknownError'))
        } finally {
            setIsLoading(false)
        }
    }, [fullPhone, newPin, confirmPin, t])

    const handleResend = useCallback(async () => {
        if (countdown > 0) return
        setIsLoading(true)
        try {
            const result = await requestPasswordReset(fullPhone)
            if (result.error) {
                toast.error(result.error)
            } else {
                setCountdown(60)
                toast.success(t('auth.otp.codeSent'))
            }
        } catch {
            toast.error(t('auth.unknownError'))
        } finally {
            setIsLoading(false)
        }
    }, [fullPhone, countdown, t])

    const stepConfig = {
        phone: { icon: Phone, color: 'from-blue-500 to-indigo-600' },
        otp: { icon: ShieldCheck, color: 'from-emerald-500 to-teal-600' },
        newpin: { icon: KeyRound, color: 'from-violet-500 to-purple-600' },
        success: { icon: CheckCircle2, color: 'from-green-500 to-emerald-600' },
    }

    const currentStep = stepConfig[step]

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50" dir={direction}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md"
            >
                <div className="backdrop-blur-xl bg-white/80 border border-white/40 shadow-2xl rounded-2xl p-6 md:p-8 relative overflow-hidden">
                    {/* Top gradient bar */}
                    <motion.div
                        className={`absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r ${currentStep.color}`}
                        layoutId="gradientBar"
                        transition={{ duration: 0.3 }}
                    />

                    {/* Logo */}
                    <div className="mb-5 text-center">
                        <div className="flex justify-center mb-3">
                            <Image
                                src="/Logo.png"
                                alt="Qalami"
                                width={120}
                                height={48}
                                priority
                                className="drop-shadow-md"
                            />
                        </div>
                        <div className="flex justify-center">
                            <LanguageSwitcher variant="compact" />
                        </div>
                    </div>

                    {/* Progress indicator */}
                    <div className="flex items-center justify-center gap-2 mb-6">
                        {(['phone', 'otp', 'newpin'] as const).map((s, i) => (
                            <div key={s} className="flex items-center gap-2">
                                <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${step === s || (['otp', 'newpin', 'success'].indexOf(step) > ['phone', 'otp', 'newpin'].indexOf(s))
                                        ? `bg-gradient-to-r ${currentStep.color} text-white shadow-lg`
                                        : 'bg-gray-200 text-gray-500'
                                        }`}
                                >
                                    {i + 1}
                                </div>
                                {i < 2 && (
                                    <div className={`w-8 h-0.5 rounded-full transition-all duration-300 ${['otp', 'newpin', 'success'].indexOf(step) > i
                                        ? `bg-gradient-to-r ${currentStep.color}`
                                        : 'bg-gray-200'
                                        }`} />
                                )}
                            </div>
                        ))}
                    </div>

                    <AnimatePresence mode="wait">
                        {/* STEP 1: Phone Number */}
                        {step === 'phone' && (
                            <motion.div
                                key="phone"
                                initial={{ opacity: 0, x: isRtl ? -20 : 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: isRtl ? 20 : -20 }}
                                transition={{ duration: 0.25 }}
                                className="space-y-5"
                            >
                                <div className="text-center mb-4">
                                    <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                                        <Phone className="h-7 w-7 text-white" />
                                    </div>
                                    <h2 className="text-xl font-bold text-foreground">{t('auth.otp.title')}</h2>
                                    <p className="text-sm text-muted-foreground mt-1">{t('auth.otp.enterPhone')}</p>
                                </div>

                                <div className="relative group">
                                    {/* Country code selector */}
                                    <div className={`absolute top-0 bottom-0 z-10 ${isRtl ? 'right-0' : 'left-0'}`}>
                                        <button
                                            type="button"
                                            onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                                            className={`h-full flex items-center gap-1 px-3 text-sm font-medium text-foreground hover:bg-gray-100 transition-colors border-black/5 ${isRtl ? 'rounded-r-md border-l' : 'rounded-l-md border-r'}`}
                                        >
                                            <span className="text-lg leading-none">{countryCode.flag}</span>
                                            <span className="text-xs text-muted-foreground" dir="ltr">{countryCode.code}</span>
                                            <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                        </button>

                                        {showCountryDropdown && (
                                            <>
                                                <div className="fixed inset-0 z-20" onClick={() => setShowCountryDropdown(false)} />
                                                <div className={`absolute top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-30 py-1 min-w-[200px] max-h-48 overflow-y-auto ${isRtl ? 'right-0' : 'left-0'}`}>
                                                    {countryCodes.map((cc) => (
                                                        <button
                                                            key={cc.code}
                                                            type="button"
                                                            onClick={() => {
                                                                setCountryCode(cc)
                                                                setShowCountryDropdown(false)
                                                            }}
                                                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${cc.code === countryCode.code ? 'bg-gray-50 font-medium' : ''} ${isRtl ? 'text-right' : 'text-left'}`}
                                                        >
                                                            <span className="text-lg">{cc.flag}</span>
                                                            <span className="text-foreground">{cc.name}</span>
                                                            <span className={`text-muted-foreground text-xs ${isRtl ? 'mr-auto' : 'ml-auto'}`} dir="ltr">{cc.code}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <Input
                                        type="tel"
                                        placeholder="37 00 10 01"
                                        className={`h-12 bg-white/50 border-black/5 text-lg ${isRtl ? 'pr-[110px] pl-4' : 'pl-[110px] pr-4'}`}
                                        dir="ltr"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSendOTP()}
                                    />
                                </div>

                                <Button
                                    onClick={handleSendOTP}
                                    disabled={isLoading || !phone.trim()}
                                    className="w-full h-11 text-base font-medium bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25 hover:opacity-90"
                                >
                                    {isLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            {t('auth.otp.sendCode')}
                                            <ArrowRight className={`ms-2 h-4 w-4 ${isRtl ? 'rotate-180' : ''}`} />
                                        </>
                                    )}
                                </Button>

                                <div className="text-center">
                                    <Link href="/login" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                                        <ArrowLeft className={`inline h-3 w-3 ${isRtl ? 'ms-1 rotate-180' : 'me-1'}`} />
                                        {t('auth.otp.backToLogin')}
                                    </Link>
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 2: OTP Verification */}
                        {step === 'otp' && (
                            <motion.div
                                key="otp"
                                initial={{ opacity: 0, x: isRtl ? -20 : 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: isRtl ? 20 : -20 }}
                                transition={{ duration: 0.25 }}
                                className="space-y-5"
                            >
                                <div className="text-center mb-4">
                                    <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                                        <ShieldCheck className="h-7 w-7 text-white" />
                                    </div>
                                    <h2 className="text-xl font-bold text-foreground">{t('auth.otp.verifyTitle')}</h2>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {t('auth.otp.codeSentTo')} <span className="font-semibold text-foreground" dir="ltr">{fullPhone}</span>
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Input
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={6}
                                        placeholder="000000"
                                        className="h-14 text-center text-2xl tracking-[0.5em] font-mono bg-white/50 border-black/5"
                                        dir="ltr"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        onKeyDown={(e) => e.key === 'Enter' && handleVerifyOTP()}
                                        autoFocus
                                    />
                                </div>

                                <Button
                                    onClick={handleVerifyOTP}
                                    disabled={isLoading || otp.length !== 6}
                                    className="w-full h-11 text-base font-medium bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 hover:opacity-90"
                                >
                                    {isLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            {t('auth.otp.verify')}
                                            <ArrowRight className={`ms-2 h-4 w-4 ${isRtl ? 'rotate-180' : ''}`} />
                                        </>
                                    )}
                                </Button>

                                <div className="flex items-center justify-between">
                                    <button
                                        onClick={() => setStep('phone')}
                                        className="text-xs text-muted-foreground hover:text-primary transition-colors"
                                    >
                                        <ArrowLeft className={`inline h-3 w-3 ${isRtl ? 'ms-1 rotate-180' : 'me-1'}`} />
                                        {t('auth.otp.changePhone')}
                                    </button>
                                    <button
                                        onClick={handleResend}
                                        disabled={countdown > 0 || isLoading}
                                        className={`text-xs font-medium transition-colors ${countdown > 0 ? 'text-muted-foreground' : 'text-primary hover:text-primary/80'
                                            }`}
                                    >
                                        {countdown > 0
                                            ? `${t('auth.otp.resendIn')} ${countdown}s`
                                            : t('auth.otp.resend')
                                        }
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 3: New PIN */}
                        {step === 'newpin' && (
                            <motion.div
                                key="newpin"
                                initial={{ opacity: 0, x: isRtl ? -20 : 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: isRtl ? 20 : -20 }}
                                transition={{ duration: 0.25 }}
                                className="space-y-5"
                            >
                                <div className="text-center mb-4">
                                    <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                                        <KeyRound className="h-7 w-7 text-white" />
                                    </div>
                                    <h2 className="text-xl font-bold text-foreground">{t('auth.otp.newPinTitle')}</h2>
                                    <p className="text-sm text-muted-foreground mt-1">{t('auth.otp.newPinSubtitle')}</p>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-sm font-medium text-foreground mb-2 block">
                                            {t('auth.otp.newPin')}
                                        </label>
                                        <PinInput
                                            value={newPin}
                                            onChange={setNewPin}
                                            disabled={isLoading}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-foreground mb-2 block">
                                            {t('auth.confirmPin')}
                                        </label>
                                        <PinInput
                                            value={confirmPin}
                                            onChange={setConfirmPin}
                                            disabled={isLoading}
                                            error={confirmPin.length === 4 && newPin !== confirmPin ? t('auth.pinMismatch') : undefined}
                                        />
                                        {confirmPin.length === 4 && newPin !== confirmPin && (
                                            <p className="text-xs text-red-500 text-center mt-1">
                                                {t('auth.pinMismatch')}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <Button
                                    onClick={handleResetPin}
                                    disabled={isLoading || newPin.length !== 4 || newPin !== confirmPin}
                                    className="w-full h-11 text-base font-medium bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25 hover:opacity-90"
                                >
                                    {isLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            {t('auth.otp.resetPin')}
                                            <ArrowRight className={`ms-2 h-4 w-4 ${isRtl ? 'rotate-180' : ''}`} />
                                        </>
                                    )}
                                </Button>
                            </motion.div>
                        )}

                        {/* STEP 4: Success */}
                        {step === 'success' && (
                            <motion.div
                                key="success"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.4 }}
                                className="text-center space-y-5 py-4"
                            >
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: 'spring', stiffness: 200, damping: 10, delay: 0.2 }}
                                    className="w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center shadow-xl"
                                >
                                    <CheckCircle2 className="h-10 w-10 text-white" />
                                </motion.div>
                                <div>
                                    <h2 className="text-xl font-bold text-foreground">{t('auth.otp.successTitle')}</h2>
                                    <p className="text-sm text-muted-foreground mt-2">{t('auth.otp.successMessage')}</p>
                                </div>
                                <Link href="/login">
                                    <Button className="w-full h-11 text-base font-medium bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/25 hover:opacity-90 mt-2">
                                        {t('auth.otp.goToLogin')}
                                        <ArrowRight className={`ms-2 h-4 w-4 ${isRtl ? 'rotate-180' : ''}`} />
                                    </Button>
                                </Link>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    )
}

