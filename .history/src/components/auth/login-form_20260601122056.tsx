'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { LoginSchema } from '@/app/auth/schemas'
import { login } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Loader2, ArrowRight, Phone, Lock, Eye, EyeOff, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import Image from 'next/image'
import { useLanguage } from '@/i18n'
import { LanguageSwitcher } from '@/components/shared/language-switcher'

export function LoginForm() {
    const [isLoading, setIsLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const { t, direction } = useLanguage()

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

    const form = useForm({
        resolver: zodResolver(LoginSchema),
        defaultValues: { phone: '', password: '' },
    })

    const isRtl = direction === 'rtl'

    async function onSubmit(data: z.infer<typeof LoginSchema>) {
        setIsLoading(true)
        try {
            const fullPhone = countryCode.code + data.phone.replace(/^0+/, '')
            const result = await login({ ...data, phone: fullPhone })
            if (result?.error) {
                toast.error(result.error)
            }
        } catch (error: any) {
            if (error?.digest?.startsWith('NEXT_REDIRECT')) throw error
            toast.error(t('auth.unknownError'))
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full"
            dir={direction}
        >
            <div className="backdrop-blur-xl bg-white/60 dark:bg-black/40 border border-white/20 dark:border-white/10 shadow-2xl rounded-2xl p-6 md:p-8 relative overflow-hidden">
                {/* Top accent bar */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />

                {/* Logo + language */}
                <div className="mb-7 text-center">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.15 }}
                        className="flex justify-center mb-3"
                    >
                        <Image
                            src="/Logo.png"
                            alt="Qalami"
                            width={130}
                            height={52}
                            priority
                            className="drop-shadow-md"
                        />
                    </motion.div>
                    <div className="flex justify-center mb-4">
                        <LanguageSwitcher variant="compact" />
                    </div>
                    <h1 className="text-xl font-bold text-foreground">{t('auth.login')}</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {t('auth.loginDesc')}
                    </p>
                </div>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                        {/* Phone */}
                        <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <div className="relative group">
                                            {/* Country code */}
                                            <div className={`absolute top-0 bottom-0 z-10 ${isRtl ? 'right-0' : 'left-0'}`}>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                                                    className={`h-full flex items-center gap-1 px-3 text-sm font-medium text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors border-black/5 dark:border-white/10 ${isRtl ? 'rounded-r-md border-l' : 'rounded-l-md border-r'}`}
                                                >
                                                    <span className="text-lg leading-none">{countryCode.flag}</span>
                                                    <span className="text-xs text-muted-foreground" dir="ltr">{countryCode.code}</span>
                                                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                                </button>

                                                {showCountryDropdown && (
                                                    <>
                                                        <div className="fixed inset-0 z-20" onClick={() => setShowCountryDropdown(false)} />
                                                        <div className={`absolute top-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-30 py-1 min-w-[200px] max-h-48 overflow-y-auto ${isRtl ? 'right-0' : 'left-0'}`}>
                                                            {countryCodes.map((cc) => (
                                                                <button
                                                                    key={cc.code}
                                                                    type="button"
                                                                    onClick={() => { setCountryCode(cc); setShowCountryDropdown(false) }}
                                                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${cc.code === countryCode.code ? 'bg-gray-50 dark:bg-white/5 font-medium' : ''} ${isRtl ? 'text-right' : 'text-left'}`}
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

                                            <Phone className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none ${isRtl ? 'left-3' : 'right-3'}`} />
                                            <Input
                                                type="tel"
                                                placeholder="37 00 10 01"
                                                className={`h-11 bg-white/50 dark:bg-black/20 border-black/5 dark:border-white/10 focus:border-emerald-400 transition-all ${isRtl ? 'pr-[110px] pl-9' : 'pl-[110px] pr-9'}`}
                                                dir="ltr"
                                                {...field}
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage className="text-xs" />
                                </FormItem>
                            )}
                        />

                        {/* Password */}
                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <div className="relative">
                                            <Lock className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none ${isRtl ? 'right-3' : 'left-3'}`} />
                                            <Input
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder={t('auth.passwordPlaceholder')}
                                                className={`h-11 bg-white/50 dark:bg-black/20 border-black/5 dark:border-white/10 focus:border-emerald-400 transition-all ${isRtl ? 'pr-9 pl-10' : 'pl-9 pr-10'}`}
                                                {...field}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(v => !v)}
                                                className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors ${isRtl ? 'left-3' : 'right-3'}`}
                                                tabIndex={-1}
                                            >
                                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </FormControl>
                                    <FormMessage className="text-xs" />
                                </FormItem>
                            )}
                        />

?//
                        <Button
                            className="w-full h-11 text-base font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/20 transition-all duration-300"
                            type="submit"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <>
                                    {t('auth.login')}
                                    <ArrowRight className={`ms-2 h-4 w-4 ${isRtl ? 'rotate-180' : ''}`} />
                                </>
                            )}
                        </Button>
                    </form>
                </Form>

                <div className="mt-6 text-center">
                    <p className="text-xs text-muted-foreground">
                        {t('auth.needHelp')}{' '}
                        <Link href="/contact-admin" className="font-semibold text-emerald-600 hover:text-emerald-500 transition-colors">
                            {t('auth.contactAdmin')}
                        </Link>
                    </p>
                </div>
            </div>
        </motion.div>
    )
}

