'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, GraduationCap } from 'lucide-react'
import { toast } from 'sonner'
import { updateEnrollmentStatus } from '@/app/auth/actions'

type EnrollmentStatus = 'active' | 'transferred' | 'withdrawn' | 'completed' | 'suspended'

const STATUS_OPTIONS: { value: EnrollmentStatus; label: string; description: string }[] = [
    { value: 'active',      label: 'Actif',      description: 'Inscription en cours' },
    { value: 'suspended',   label: 'Suspendu',   description: 'Temporairement suspendu' },
    { value: 'transferred', label: 'Transféré',  description: 'Transfert vers un autre établissement' },
    { value: 'withdrawn',   label: 'Retiré',     description: 'Retrait volontaire ou parental' },
    { value: 'completed',   label: 'Terminé',    description: 'Année/cycle complété avec succès' },
]

interface ChangeEnrollmentStatusProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    enrollmentId: string
    currentStatus: EnrollmentStatus | string
    studentName: string
    onSuccess?: (newStatus: EnrollmentStatus) => void
}

export function ChangeEnrollmentStatus({
    open,
    onOpenChange,
    enrollmentId,
    currentStatus,
    studentName,
    onSuccess,
}: ChangeEnrollmentStatusProps) {
    const [newStatus, setNewStatus] = useState<EnrollmentStatus>(currentStatus as EnrollmentStatus)
    const [reason, setReason] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async () => {
        if (newStatus === currentStatus) {
            onOpenChange(false)
            return
        }

        setLoading(true)
        try {
            const result = await updateEnrollmentStatus({
                enrollmentId,
                status: newStatus,
                reason: reason.trim() || undefined,
            })

            if (result.error) {
                toast.error('Erreur', { description: result.error })
                return
            }

            const label = STATUS_OPTIONS.find(s => s.value === newStatus)?.label ?? newStatus
            toast.success("Statut d'inscription mis à jour", { description: `${studentName} → ${label}` })
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
                        <GraduationCap className="w-5 h-5 text-emerald-400" />
                        Statut d'inscription
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-5 pt-2">
                    <p className="text-sm text-gray-400">
                        Modifier le statut d'inscription de <span className="text-white font-bold">{studentName}</span>
                    </p>

                    <div className="space-y-2">
                        <Label className="text-gray-300">Nouveau statut</Label>
                        <Select value={newStatus} onValueChange={(v) => setNewStatus(v as EnrollmentStatus)}>
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
                        <Label className="text-gray-300">Motif (optionnel)</Label>
                        <Textarea
                            placeholder="Ex: Déménagement, fin de contrat, exclusion temporaire..."
                            className="bg-[#0F1720] border-white/10 text-white placeholder:text-gray-600 resize-none"
                            rows={3}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />
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
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
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
