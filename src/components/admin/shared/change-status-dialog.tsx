'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { updateProfileStatus } from '@/app/auth/actions'
import type { ProfileStatus } from './status-badge'

const STATUS_OPTIONS: { value: ProfileStatus; label: string; description: string }[] = [
    { value: 'active',    label: 'Actif',    description: 'Accès normal au système' },
    { value: 'suspended', label: 'Suspendu', description: 'Accès temporairement bloqué' },
    { value: 'inactive',  label: 'Inactif',  description: 'Compte désactivé par l\'admin' },
    { value: 'archived',  label: 'Archivé',  description: 'Ancien utilisateur, conservé pour l\'historique' },
]

interface ChangeStatusDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    userId: string
    currentStatus: ProfileStatus | string
    userName: string
    onSuccess?: (newStatus: ProfileStatus) => void
}

export function ChangeStatusDialog({
    open,
    onOpenChange,
    userId,
    currentStatus,
    userName,
    onSuccess,
}: ChangeStatusDialogProps) {
    const [newStatus, setNewStatus] = useState<ProfileStatus>(currentStatus as ProfileStatus)
    const [reason, setReason] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async () => {
        if (newStatus === currentStatus) {
            onOpenChange(false)
            return
        }
        if (!reason.trim()) {
            toast.error('Le motif est obligatoire')
            return
        }

        setLoading(true)
        try {
            const result = await updateProfileStatus({
                userId,
                status: newStatus,
                reason: reason.trim(),
            })

            if (result.error) {
                toast.error('Erreur', { description: result.error })
                return
            }

            const label = STATUS_OPTIONS.find(s => s.value === newStatus)?.label ?? newStatus
            toast.success('Statut mis à jour', { description: `${userName} → ${label}` })
            onSuccess?.(newStatus)
            onOpenChange(false)
            setReason('')
        } catch (err: any) {
            toast.error('Erreur inattendue', { description: err.message })
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-[#1A2530] border-white/10 text-white max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-orange-400" />
                        Changer le statut
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-5 pt-2">
                    <p className="text-sm text-gray-400">
                        Modification du statut de <span className="text-white font-bold">{userName}</span>
                    </p>

                    <div className="space-y-2">
                        <Label className="text-gray-300">Nouveau statut</Label>
                        <Select value={newStatus} onValueChange={(v) => setNewStatus(v as ProfileStatus)}>
                            <SelectTrigger className="bg-[#0F1720] border-white/10 text-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1A2530] border-white/10 text-white">
                                {STATUS_OPTIONS.map(opt => (
                                    <SelectItem
                                        key={opt.value}
                                        value={opt.value}
                                        className="focus:bg-white/5 focus:text-white"
                                    >
                                        <span className="font-bold">{opt.label}</span>
                                        <span className="text-gray-400 text-xs ml-2">— {opt.description}</span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-gray-300">
                            Motif <span className="text-red-400">*</span>
                        </Label>
                        <Textarea
                            placeholder="Ex: Congé maladie, sanction disciplinaire, fin de contrat..."
                            className="bg-[#0F1720] border-white/10 text-white placeholder:text-gray-600 resize-none"
                            rows={3}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />
                        <p className="text-[11px] text-gray-500">Ce motif sera enregistré dans l'historique du compte.</p>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button
                            variant="outline"
                            className="flex-1 border-white/10 text-gray-400 hover:text-white"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            Annuler
                        </Button>
                        <Button
                            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold"
                            onClick={handleSubmit}
                            disabled={loading || newStatus === currentStatus}
                        >
                            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            Confirmer
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
