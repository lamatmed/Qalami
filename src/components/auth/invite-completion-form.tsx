'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { completeRegistration } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { PinInput } from '@/components/auth/pin-input'
import { Loader2, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import Image from 'next/image'

import { useLanguage } from '@/i18n'

interface InvitationData {
    fullName: string
    email: string | null
    role: string
    schoolName: string
}

interface InviteCompletionFormProps {
    token: string
    invitation?: InvitationData
    error?: string | null
}

export function InviteCompletionForm({ token, invitation, error: initialError }: InviteCompletionFormProps) {
    const { t } = useLanguage()
    const [pin, setPin] = useState('')
    const [confirmPin, setConfirmPin] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isComplete, setIsComplete] = useState(false)
    const [error, setError] = useState<string | null>(initialError || null)

    if (initialError) {
        return (
            <div className="backdrop-blur-xl bg-white/80 border border-white/40 shadow-2xl rounded-2xl p-8 md:p-10 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-50" />

                <div className="flex justify-center mb-6">
                    <Image
                        src="/Logo.png"
                        alt="Qalami"
                        width={120}
                        height={48}
                        priority
                        className="drop-shadow-md"
                    />
                </div>

                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="w-8 h-8 text-red-400" />
                </div>

                <h1 className="text-xl font-bold text-foreground mb-2">
                    {t('auth.invalidInvitation')}
                </h1>
                <p className="text-sm text-muted-foreground mb-6">
                    {initialError === 'Invitation expirée'
                        ? t('auth.inviteExpiredDesc')
                        : initialError === 'Invitation déjà utilisée'
                        ? t('auth.inviteUsed')
                        : initialError === 'Invitation introuvable'
                        ? t('auth.inviteNotFound')
                        : initialError}
                </p>

                <Link href="/login" className="text-sm text-primary hover:underline block mt-4">
                    {t('auth.goToLogin')}
                </Link>
            </div>
        )
    }

    const roleLabels: Record<string, string> = {
        student: t('common.student'),
        parent: t('common.parent'),
        teacher: t('common.teacher'),
        admin: t('admin.settings.roles.names.admin') || t('common.admin'),
        super_admin: t('admin.settings.roles.names.super_admin') || t('common.superAdmin'),
        school_staff: t('admin.settings.roles.names.school_staff'),
    }

    const pinMismatch = confirmPin.length === 6 && pin !== confirmPin
    const canSubmit = pin.length === 6 && confirmPin.length === 6 && pin === confirmPin

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!canSubmit) return

        setIsLoading(true)
        setError(null)

        try {
            const result = await completeRegistration({
                token,
                pin,
                confirmPin,
            })

            if (result?.error) {
                setError(result.error)
                toast.error(result.error)
            } else {
                setIsComplete(true)
                toast.success(t('auth.registrationComplete'))
            }
        } catch {
            setError(t('common.error'))
            toast.error(t('common.error'))
        } finally {
            setIsLoading(false)
        }
    }

    if (isComplete) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md mx-auto"
            >
                <div className="backdrop-blur-xl bg-white/80 border border-white/40 shadow-2xl rounded-2xl p-8 md:p-10 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50" />

                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: 'spring' }}
                        className="flex justify-center mb-6"
                    >
                        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                        </div>
                    </motion.div>

                    <h1 className="text-2xl font-bold text-foreground mb-2">
                        {t('auth.registrationComplete')}
                    </h1>
                    <p className="text-sm text-muted-foreground mb-8">
                        {t('auth.registrationCompleteDesc')}
                    </p>

                    <Link href="/login">
                        <Button className="w-full h-11 text-base font-medium shadow-lg shadow-primary/25">
                            {t('auth.goToLogin')}
                        </Button>
                    </Link>
                </div>
            </motion.div>
        )
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md mx-auto"
        >
            <div className="backdrop-blur-xl bg-white/80 border border-white/40 shadow-2xl rounded-2xl p-8 md:p-10 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50" />

                {/* Header */}
                <div className="mb-8 text-center space-y-2">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="flex justify-center mb-4"
                    >
                        <Image
                            src="/Logo.png"
                            alt="Qalami"
                            width={140}
                            height={56}
                            priority
                            className="drop-shadow-md"
                        />
                    </motion.div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        {t('auth.inviteTitle')}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {t('auth.inviteSubtitle')}
                    </p>
                </div>

                {/* User Info Card */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mb-6 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
                            {invitation.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate">
                                {invitation.fullName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                                {roleLabels[invitation.role] || invitation.role} • {invitation.schoolName}
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* PIN Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <PinInput
                            value={pin}
                            onChange={setPin}
                            label={t('auth.createPin')}
                            disabled={isLoading}
                            autoFocus
                        />

                        <PinInput
                            value={confirmPin}
                            onChange={setConfirmPin}
                            label={t('auth.confirmPin')}
                            error={pinMismatch ? t('auth.pinMismatch') : undefined}
                            disabled={isLoading}
                        />
                    </div>

                    <AnimatePresence>
                        {pin.length === 4 && confirmPin.length === 4 && pin === confirmPin && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="flex items-center gap-2 text-emerald-500 text-sm justify-center"
                            >
                                <ShieldCheck className="w-4 h-4" />
                                <span>{t('auth.pinsMatch')}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center gap-2 text-red-400 text-sm justify-center"
                        >
                            <AlertTriangle className="w-4 h-4" />
                            <span>{error}</span>
                        </motion.div>
                    )}

                    <Button
                        className="w-full h-11 text-base font-medium shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300"
                        type="submit"
                        disabled={!canSubmit || isLoading}
                    >
                        {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            t('auth.activateAccount')
                        )}
                    </Button>
                </form>

                <div className="mt-6 text-center">
                    <p className="text-xs text-muted-foreground">
                        {t('auth.hasAccount')}{' '}
                        <Link href="/login" className="text-primary hover:underline">
                            {t('auth.login')}
                        </Link>
                    </p>
                </div>
            </div>
        </motion.div>
    )
}
