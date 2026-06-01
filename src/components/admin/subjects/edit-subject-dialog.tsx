'use client'

import { useState } from 'react'
import { updateSubject } from '@/app/admin/subjects/actions'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n'

interface EditSubjectDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    subject: { id: string; name: string; name_ar?: string | null; icon?: string | null }
    onSuccess?: () => void
}

export function EditSubjectDialog({ open, onOpenChange, subject, onSuccess }: EditSubjectDialogProps) {
    const { t } = useLanguage()
    const [isLoading, setIsLoading] = useState(false)

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setIsLoading(true)

        const formData = new FormData(event.currentTarget)
        const result = await updateSubject(subject.id, formData)

        if (result?.error) {
            toast.error(result.error)
        } else {
            toast.success(t('admin.subjects.subjectUpdated'))
            onSuccess?.()
            onOpenChange(false)
        }
        setIsLoading(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{t('admin.subjects.editSubject')}</DialogTitle>
                </DialogHeader>
                <form onSubmit={onSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-name" className="text-right">{t('admin.subjects.name')} (FR)</Label>
                            <Input
                                id="edit-name"
                                name="name"
                                defaultValue={subject.name}
                                className="col-span-3"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-name-ar" className="text-right">الاسم (AR)</Label>
                            <Input
                                id="edit-name-ar"
                                name="name_ar"
                                defaultValue={subject.name_ar ?? ''}
                                placeholder="مثال: الرياضيات"
                                className="col-span-3 text-right"
                                dir="rtl"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-icon" className="text-right">{t('admin.subjects.icon')}</Label>
                            <Input
                                id="edit-icon"
                                name="icon"
                                defaultValue={subject.icon ?? ''}
                                placeholder="Ex: Ma, Fr, Ar, 📚"
                                className="col-span-3"
                                maxLength={10}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={isLoading}>
                            {t('admin.subjects.cancel')}
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('admin.subjects.save')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
