'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, UserPen } from 'lucide-react'
import { toast } from 'sonner'
import { updateParentInfo } from '@/app/admin/parents/actions'

interface EditParentDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    parentId: string
    initialData: { full_name: string; address?: string | null; email?: string | null }
    onSuccess: () => void
}

export function EditParentDialog({ open, onOpenChange, parentId, initialData, onSuccess }: EditParentDialogProps) {
    const [fullName, setFullName] = useState(initialData.full_name)
    const [address, setAddress] = useState(initialData.address ?? '')
    const [email, setEmail] = useState(initialData.email ?? '')
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        if (!fullName.trim()) { toast.error('Le nom est obligatoire'); return }
        setSaving(true)
        const result = await updateParentInfo(parentId, { full_name: fullName, address, email: email || null })
        setSaving(false)
        if (result.error) { toast.error(result.error); return }
        toast.success('Informations mises à jour')
        onSuccess()
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-[#1A2530] border-white/10 text-white max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPen className="w-5 h-5 text-emerald-500" />
                        Modifier les informations du parent
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                        <Label className="text-gray-300">Nom complet *</Label>
                        <Input value={fullName} onChange={e => setFullName(e.target.value)}
                            className="bg-[#0F1720] border-white/10 text-white" />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-gray-300">Adresse</Label>
                        <Input value={address} onChange={e => setAddress(e.target.value)}
                            className="bg-[#0F1720] border-white/10 text-white" />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-gray-300">Email</Label>
                        <Input type="email" value={email} onChange={e => setEmail(e.target.value)}
                            className="bg-[#0F1720] border-white/10 text-white" dir="ltr" />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button variant="outline" className="flex-1 border-white/10 text-gray-400 hover:text-white"
                            onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button>
                        <Button className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-bold"
                            onClick={handleSave} disabled={saving}>
                            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            Enregistrer
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
