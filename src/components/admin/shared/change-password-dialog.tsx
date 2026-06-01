'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Loader2, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { adminUpdateUserPassword } from '@/app/admin/users/actions'
import { useLanguage } from '@/i18n'

interface ChangePasswordDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    userId: string
    userName: string
    userPhone: string | null
}

export function ChangePasswordDialog({
    open,
    onOpenChange,
    userId,
    userName,
    userPhone,
}: ChangePasswordDialogProps) {
    const { t } = useLanguage()
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async () => {
        if (!password.trim()) {
            toast.error(t('admin.users.pleaseEnterPassword') || 'Veuillez saisir un mot de passe')
            return
        }
        if (!/^\d{6}$/.test(password.trim())) {
            toast.error('Le mot de passe doit être exactement 6 chiffres')
            return
        }
        if (password !== confirm) {
            toast.error(t('admin.users.passwordsDoNotMatch') || 'Les mots de passe ne correspondent pas')
            return
        }

        setLoading(true)
        try {
            const result = await adminUpdateUserPassword(userId, password)

            if (result.error) {
                toast.error(t('common.error') || 'Erreur', { description: result.error })
                return
            }

            toast.success(t('admin.users.passwordUpdated') || 'Le mot de passe a été mis à jour avec succès')
            onOpenChange(false)
            setPassword('')
            setConfirm('')
        } catch (err: any) {
            toast.error(t('common.error') || 'Erreur', { description: err.message })
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-[#1A2530] border-white/10 text-white max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <KeyRound className="w-5 h-5 text-emerald-500" />
                        {t('admin.users.changePassword') || 'Modifier le mot de passe'}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-5 pt-2">
                    <p className="text-sm text-gray-400">
                        {t('admin.users.changingPasswordFor') || 'Changer le mot de passe de'} <span className="text-white font-bold">{userName}</span>
                        {userPhone && <span className="text-xs text-gray-500 block mt-0.5 font-mono">{userPhone}</span>}
                    </p>

                    <div className="space-y-2">
                        <Label className="text-gray-300">
                            {t('admin.users.newPassword') || 'Nouveau mot de passe *'}
                        </Label>
                        <Input
                            type="password"
                            placeholder="6 chiffres (ex. 123456)"
                            className="bg-[#0F1720] border-white/10 text-white placeholder:text-gray-600"
                            value={password}
                            onChange={(e) => setPassword(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            inputMode="numeric"
                            maxLength={6}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-gray-300">
                            {t('admin.users.confirmPassword') || 'Confirmer le mot de passe *'}
                        </Label>
                        <Input
                            type="password"
                            placeholder={t('admin.users.confirmPasswordPlaceholder') || 'Répétez le mot de passe'}
                            className="bg-[#0F1720] border-white/10 text-white placeholder:text-gray-600"
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                            inputMode="numeric"
                            maxLength={6}
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button
                            variant="outline"
                            className="flex-1 border-white/10 text-gray-400 hover:text-white"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            {t('common.cancel') || 'Annuler'}
                        </Button>
                        <Button
                            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-bold"
                            onClick={handleSubmit}
                            disabled={loading}
                        >
                            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            {t('common.confirm') || 'Confirmer'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
