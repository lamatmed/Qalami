'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { assignStudentToClass } from '@/app/admin/students/actions'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2, GraduationCap } from 'lucide-react'
import { useLanguage } from '@/i18n'
import { cn } from '@/lib/utils'

interface ClassOption {
    id: string
    name: string
    level_name: string | null
}

interface AssignClassDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    studentId: string
    studentName: string
    currentClassId?: string | null
    onSuccess?: (className: string, classId: string) => void
}

export function AssignClassDialog({
    open,
    onOpenChange,
    studentId,
    studentName,
    currentClassId,
    onSuccess,
}: AssignClassDialogProps) {
    const { t, direction } = useLanguage()
    const [classes, setClasses] = useState<ClassOption[]>([])
    const [loadingClasses, setLoadingClasses] = useState(false)
    const [selectedClassId, setSelectedClassId] = useState<string>(currentClassId || '')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!open) return
        setSelectedClassId(currentClassId || '')
        setLoadingClasses(true)

        const supabase = createClient()

        ;(async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: adminProfile } = await supabase
                .from('profiles')
                .select('school_id')
                .eq('id', user.id)
                .single()

            if (!adminProfile?.school_id) return

            const { data, error } = await supabase
                .from('classes')
                .select(`
                    id,
                    name,
                    levels ( name_fr )
                `)
                .eq('school_id', adminProfile.school_id)
                .order('name')

            if (!error && data) {
                setClasses(data.map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    level_name: c.levels?.name_fr ?? null,
                })))
            }
            setLoadingClasses(false)
        })()
    }, [open, currentClassId])

    const handleSave = async () => {
        if (!selectedClassId) {
            toast.error(t('admin.students.assignClassDialog.selectError'))
            return
        }
        if (selectedClassId === currentClassId) {
            onOpenChange(false)
            return
        }

        setSaving(true)
        const result = await assignStudentToClass(studentId, selectedClassId)
        setSaving(false)

        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success(
                t('admin.students.assignClassDialog.successMessage')
                    .replace('{name}', studentName)
                    .replace('{className}', result.className || '')
            )
            onSuccess?.(result.className!, selectedClassId)
            onOpenChange(false)
        }
    }

    // Group classes by level
    const grouped = classes.reduce<Record<string, ClassOption[]>>((acc, cls) => {
        const key = cls.level_name ?? 'Sans niveau'
        if (!acc[key]) acc[key] = []
        acc[key].push(cls)
        return acc
    }, {})

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[420px]" dir={direction}>
                <DialogHeader className={direction === 'rtl' ? 'text-right' : 'text-left'}>
                    <DialogTitle className={cn("flex items-center gap-2", direction === 'rtl' ? 'flex-row-reverse justify-start' : 'flex-row')}>
                        <GraduationCap className="w-5 h-5 text-emerald-500" />
                        {t('admin.students.assignClassDialog.title')}
                    </DialogTitle>
                </DialogHeader>

                <div className="py-2 space-y-4">
                    <p className={cn("text-sm text-muted-foreground", direction === 'rtl' ? 'text-right' : 'text-left')}>
                        {t('admin.students.assignClassDialog.chooseClassFor').replace('{name}', studentName)}
                        {currentClassId && (
                            <span className="block mt-0.5 text-xs text-amber-600">
                                {t('admin.students.assignClassDialog.updateWarning')}
                            </span>
                        )}
                    </p>

                    <div className="space-y-1.5">
                        <Label htmlFor="class-select" className={cn("block w-full", direction === 'rtl' ? 'text-right' : 'text-left')}>{t('admin.students.assignClassDialog.classLabel')}</Label>
                        {loadingClasses ? (
                            <div className={cn("flex items-center gap-2 text-sm text-muted-foreground h-10", direction === 'rtl' ? 'flex-row-reverse' : 'flex-row')}>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {t('admin.students.assignClassDialog.loadingClasses')}
                            </div>
                        ) : classes.length === 0 ? (
                            <p className={cn("text-sm text-muted-foreground", direction === 'rtl' ? 'text-right' : 'text-left')}>{t('admin.students.assignClassDialog.noClassAvailable')}</p>
                        ) : (
                            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                                <SelectTrigger id="class-select" dir={direction} className={cn(direction === 'rtl' ? 'text-right' : 'text-left')}>
                                    <SelectValue placeholder={t('admin.students.assignClassDialog.selectPlaceholder')} />
                                </SelectTrigger>
                                <SelectContent dir={direction}>
                                    {Object.entries(grouped).map(([level, levelClasses]) => (
                                        <div key={level}>
                                            <div className={cn("px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider", direction === 'rtl' ? 'text-right' : 'text-left')}>
                                                {level}
                                            </div>
                                            {levelClasses.map(cls => (
                                                <SelectItem key={cls.id} value={cls.id} className={cn(direction === 'rtl' ? 'text-right justify-start' : 'text-left justify-start')}>
                                                    {cls.name}
                                                </SelectItem>
                                            ))}
                                        </div>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </div>

                <DialogFooter className={cn("flex gap-2", direction === 'rtl' ? 'flex-row-reverse justify-start' : '')}>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={saving}
                    >
                        {t('admin.students.assignClassDialog.cancel')}
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || !selectedClassId || loadingClasses}
                    >
                        {saving && <Loader2 className={cn("w-4 h-4 animate-spin", direction === 'rtl' ? 'ms-2' : 'me-2')} />}
                        {currentClassId ? t('admin.students.assignClassDialog.changeClass') : t('admin.students.assignClassDialog.assign')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
