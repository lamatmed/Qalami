'use client'

import { useState } from 'react'
import { createSubject } from '@/app/admin/subjects/actions'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n'

export function AddSubjectDialog({ onSuccess }: { onSuccess?: () => void }) {
    const { t } = useLanguage()
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setIsLoading(true)

        const formData = new FormData(event.currentTarget)
        const result = await createSubject(formData)

        if (result?.error) {
            toast.error(result.error)
        } else {
            toast.success(t('admin.subjects.subjectAdded'))
            setOpen(false)
            onSuccess?.()
        }
        setIsLoading(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('admin.subjects.add')}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{t('admin.subjects.addSubject')}</DialogTitle>
                    <DialogDescription>
                        {t('admin.subjects.addSubjectDesc')}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={onSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                                {t('admin.subjects.name')}
                            </Label>
                            <Input
                                id="name"
                                name="name"
                                placeholder={t('admin.subjects.namePlaceholder')}
                                className="col-span-3"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="icon" className="text-right">
                                Icône
                            </Label>
                            <Input
                                id="icon"
                                name="icon"
                                placeholder="Ex: Ma, Fr, Ar, 📚"
                                className="col-span-3"
                                maxLength={10}
                            />
                        </div>
                    </div>
                    <DialogFooter>
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
