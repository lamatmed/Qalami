'use client'

import { useState, useEffect } from 'react'
import {
    getTransferDestinationSchools,
    getClassesForSchool,
    transferStudentToSchool,
} from '@/app/admin/students/actions'
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
import { Loader2, ArrowLeftRight } from 'lucide-react'
import { useLanguage } from '@/i18n'
import { cn } from '@/lib/utils'

interface SchoolOption {
    id: string
    name: string
}

interface ClassOption {
    id: string
    name: string
}

interface TransferStudentDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    studentId: string
    studentName: string
    onSuccess?: () => void
}

export function TransferStudentDialog({
    open,
    onOpenChange,
    studentId,
    studentName,
    onSuccess,
}: TransferStudentDialogProps) {
    const { t, direction } = useLanguage()
    const [schools, setSchools] = useState<SchoolOption[]>([])
    const [loadingSchools, setLoadingSchools] = useState(false)
    const [selectedSchoolId, setSelectedSchoolId] = useState<string>('')
    
    const [classes, setClasses] = useState<ClassOption[]>([])
    const [loadingClasses, setLoadingClasses] = useState(false)
    const [selectedClassId, setSelectedClassId] = useState<string>('')

    const [saving, setSaving] = useState(false)

    // Load destination schools
    useEffect(() => {
        if (!open) return
        setSelectedSchoolId('')
        setSelectedClassId('')
        setClasses([])
        setLoadingSchools(true)

        ;(async () => {
            const res = await getTransferDestinationSchools()
            if (res.error) {
                toast.error(res.error)
            } else if (res.schools) {
                setSchools(res.schools)
            }
            setLoadingSchools(false)
        })()
    }, [open])

    // Load classes when school is selected
    useEffect(() => {
        if (!selectedSchoolId) {
            setClasses([])
            setSelectedClassId('')
            return
        }
        setSelectedClassId('')
        setLoadingClasses(true)

        ;(async () => {
            const res = await getClassesForSchool(selectedSchoolId)
            if (res.error) {
                toast.error(res.error)
            } else if (res.classes) {
                setClasses(res.classes)
            }
            setLoadingClasses(false)
        })()
    }, [selectedSchoolId])

    const handleSave = async () => {
        if (!selectedSchoolId) {
            toast.error(t('admin.students.transferDialog.selectSchoolError'))
            return
        }

        setSaving(true)
        const result = await transferStudentToSchool(
            studentId,
            selectedSchoolId,
            selectedClassId || undefined
        )
        setSaving(false)

        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success(t('admin.students.transferDialog.successMessage'))
            onSuccess?.()
            onOpenChange(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[420px]" dir={direction}>
                <DialogHeader className={direction === 'rtl' ? 'text-right' : 'text-left'}>
                    <DialogTitle className={cn("flex items-center gap-2", direction === 'rtl' ? 'flex-row-reverse justify-start' : 'flex-row')}>
                        <ArrowLeftRight className="w-5 h-5 text-emerald-500" />
                        {t('admin.students.transferDialog.title')}
                    </DialogTitle>
                </DialogHeader>

                <div className="py-2 space-y-4">
                    <p className={cn("text-sm text-muted-foreground", direction === 'rtl' ? 'text-right' : 'text-left')}>
                        {t('admin.students.transferDialog.description')}
                    </p>

                    {/* School selection */}
                    <div className="space-y-1.5">
                        <Label htmlFor="school-select" className={cn("block w-full", direction === 'rtl' ? 'text-right' : 'text-left')}>
                            {t('admin.students.transferDialog.schoolLabel')}
                        </Label>
                        {loadingSchools ? (
                            <div className={cn("flex items-center gap-2 text-sm text-muted-foreground h-10", direction === 'rtl' ? 'flex-row-reverse' : 'flex-row')}>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {t('admin.students.transferDialog.loadingSchools')}
                            </div>
                        ) : schools.length === 0 ? (
                            <p className={cn("text-sm text-muted-foreground", direction === 'rtl' ? 'text-right' : 'text-left')}>
                                Aucun autre établissement actif trouvé.
                            </p>
                        ) : (
                            <Select value={selectedSchoolId} onValueChange={setSelectedSchoolId}>
                                <SelectTrigger id="school-select" dir={direction} className={cn(direction === 'rtl' ? 'text-right' : 'text-left')}>
                                    <SelectValue placeholder={t('admin.students.transferDialog.selectSchoolPlaceholder')} />
                                </SelectTrigger>
                                <SelectContent dir={direction}>
                                    {schools.map(school => (
                                        <SelectItem key={school.id} value={school.id} className={cn(direction === 'rtl' ? 'text-right justify-start' : 'text-left justify-start')}>
                                            {school.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {/* Class selection */}
                    {selectedSchoolId && (
                        <div className="space-y-1.5">
                            <Label htmlFor="class-select" className={cn("block w-full", direction === 'rtl' ? 'text-right' : 'text-left')}>
                                {t('admin.students.transferDialog.classLabel')}
                            </Label>
                            {loadingClasses ? (
                                <div className={cn("flex items-center gap-2 text-sm text-muted-foreground h-10", direction === 'rtl' ? 'flex-row-reverse' : 'flex-row')}>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {t('admin.students.transferDialog.loadingClasses')}
                                </div>
                            ) : classes.length === 0 ? (
                                <p className={cn("text-sm text-muted-foreground", direction === 'rtl' ? 'text-right' : 'text-left')}>
                                    Aucune classe disponible dans cet établissement.
                                </p>
                            ) : (
                                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                                    <SelectTrigger id="class-select" dir={direction} className={cn(direction === 'rtl' ? 'text-right' : 'text-left')}>
                                        <SelectValue placeholder={t('admin.students.transferDialog.selectClassPlaceholder')} />
                                    </SelectTrigger>
                                    <SelectContent dir={direction}>
                                        {classes.map(cls => (
                                            <SelectItem key={cls.id} value={cls.id} className={cn(direction === 'rtl' ? 'text-right justify-start' : 'text-left justify-start')}>
                                                {cls.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className={cn("flex gap-2", direction === 'rtl' ? 'flex-row-reverse justify-start' : '')}>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={saving}
                    >
                        {t('admin.students.transferDialog.cancel')}
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || !selectedSchoolId || loadingSchools}
                    >
                        {saving && <Loader2 className={cn("w-4 h-4 animate-spin", direction === 'rtl' ? 'ms-2' : 'me-2')} />}
                        {t('admin.students.transferDialog.transfer')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
