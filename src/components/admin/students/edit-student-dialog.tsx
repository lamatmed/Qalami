'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, UserPen } from 'lucide-react'
import { toast } from 'sonner'
import { updateStudentInfo } from '@/app/admin/students/actions'
import { useLanguage } from '@/i18n'

interface EditStudentDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    studentId: string
    initialData: {
        full_name: string
        date_of_birth: string | null
        place_of_birth: string | null
        address: string | null
        gender: string | null
    }
    onSuccess: () => void
}

export function EditStudentDialog({ open, onOpenChange, studentId, initialData, onSuccess }: EditStudentDialogProps) {
    const { t } = useLanguage()
    const [fullName, setFullName] = useState(initialData.full_name)
    const [dob, setDob] = useState(initialData.date_of_birth ? initialData.date_of_birth.split('T')[0] : '')
    const [placeOfBirth, setPlaceOfBirth] = useState(initialData.place_of_birth ?? '')
    const [address, setAddress] = useState(initialData.address ?? '')
    const [gender, setGender] = useState(initialData.gender ?? '')
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        if (!fullName.trim()) { toast.error(t('admin.students.register.errors.nameRequired') || 'Le nom est obligatoire'); return }
        setSaving(true)
        const result = await updateStudentInfo(studentId, {
            full_name: fullName,
            date_of_birth: dob || null,
            place_of_birth: placeOfBirth,
            address,
            gender,
        })
        setSaving(false)
        if (result.error) { toast.error(result.error); return }
        toast.success(t('admin.students.profile.editStudentSuccess'))
        onSuccess()
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-[#1A2530] border-white/10 text-white max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPen className="w-5 h-5 text-emerald-500" />
                        {t('admin.students.profile.editStudentTitle')}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                        <Label className="text-gray-300">Nom complet *</Label>
                        <Input value={fullName} onChange={e => setFullName(e.target.value)}
                            className="bg-[#0F1720] border-white/10 text-white" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-gray-300">Date de naissance</Label>
                            <Input type="date" value={dob} onChange={e => setDob(e.target.value)}
                                className="bg-[#0F1720] border-white/10 text-white" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-gray-300">Genre</Label>
                            <select value={gender} onChange={e => setGender(e.target.value)}
                                className="w-full h-10 bg-[#0F1720] border border-white/10 text-white rounded-md px-3 text-sm">
                                <option value="">—</option>
                                <option value="male">Masculin</option>
                                <option value="female">Féminin</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-gray-300">Lieu de naissance</Label>
                        <Input value={placeOfBirth} onChange={e => setPlaceOfBirth(e.target.value)}
                            className="bg-[#0F1720] border-white/10 text-white" />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-gray-300">Adresse</Label>
                        <Input value={address} onChange={e => setAddress(e.target.value)}
                            className="bg-[#0F1720] border-white/10 text-white" />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button variant="outline" className="flex-1 border-white/10 text-gray-400 hover:text-white"
                            onClick={() => onOpenChange(false)} disabled={saving}>
                            {t('common.cancel')}
                        </Button>
                        <Button className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-bold"
                            onClick={handleSave} disabled={saving}>
                            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            {t('admin.students.profile.editStudentSave')}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
