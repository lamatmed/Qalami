'use client'

import { useState } from 'react'
import { deleteSubject } from '@/app/admin/subjects/actions'
import { Button } from '@/components/ui/button'
import { Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export function DeleteSubjectButton({ id, onSuccess }: { id: string; onSuccess?: () => void }) {
    const { t } = useLanguage()
    const [isLoading, setIsLoading] = useState(false)

    async function onDelete() {
        setIsLoading(true)
        const result = await deleteSubject(id)
        if (result?.error) {
            toast.error(result.error)
        } else {
            toast.success(t('admin.subjects.subjectDeleted'))
            onSuccess?.()
        }
        setIsLoading(false)
    }

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t('admin.subjects.areYouSure')}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {t('admin.subjects.irreversibleAction')}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>{t('admin.subjects.cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete} disabled={isLoading} className="bg-red-600 hover:bg-red-700">
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('admin.subjects.delete')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
