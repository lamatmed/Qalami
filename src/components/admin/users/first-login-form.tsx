'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { changeFirstLoginPassword } from '@/app/staff-first-login/actions'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n'

export function FirstLoginForm() {
    const { t } = useLanguage()
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [saving, setSaving] = useState(false)

    async function handleSubmit() {
        if (!/^\d{6}$/.test(password)) { toast.error('Le mot de passe doit être exactement 6 chiffres'); return }
        if (password !== confirm) { toast.error(t('admin.users.passwordsDoNotMatch')); return }

        setSaving(true)
        const result = await changeFirstLoginPassword(password)
        if (result?.error) {
            toast.error(result.error)
            setSaving(false)
        }
        // redirect happens server-side on success
    }

    return (
        <div className="w-full max-w-sm">
            <div className="bg-white dark:bg-[#0F1720] border border-gray-200 dark:border-white/10 rounded-3xl p-8 shadow-xl">
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                        <ShieldCheck className="w-8 h-8 text-emerald-500" />
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-1">{t('admin.users.firstLoginTitle')}</h1>
                <p className="text-sm text-gray-400 text-center mb-8">
                    {t('admin.users.firstLoginDesc')}
                </p>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>{t('admin.users.newPassword')}</Label>
                        <div className="relative">
                            <KeyRound className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                            <Input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder={t('admin.users.newPasswordPlaceholder')}
                                className="pl-9 bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5"
                                inputMode="numeric"
                                maxLength={6}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>{t('admin.users.confirmPassword')}</Label>
                        <div className="relative">
                            <KeyRound className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                            <Input
                                type="password"
                                value={confirm}
                                onChange={e => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder={t('admin.users.confirmPasswordPlaceholder')}
                                className="pl-9 bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5"
                                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                                inputMode="numeric"
                                maxLength={6}
                            />
                        </div>
                    </div>
                </div>

                <Button
                    className="w-full mt-6 bg-emerald-500 hover:bg-emerald-600 text-black font-bold h-12 rounded-xl"
                    onClick={handleSubmit}
                    disabled={saving}
                >
                    {saving ? t('admin.users.saving') : t('admin.users.confirmAndAccess')}
                </Button>
            </div>
        </div>
    )
}
