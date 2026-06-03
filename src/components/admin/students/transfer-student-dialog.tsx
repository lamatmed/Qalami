'use client'

import { useState, useEffect } from 'react'
import {
    getTransferDestinationSchools,
    getClassesForSchool,
    transferStudentToSchool,
    transferStudentExternally,
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
import { createClient } from '@/utils/supabase/client'
import { generateTransferPDF } from '@/utils/pdf-generator'

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
    const [transferType, setTransferType] = useState<'network' | 'external'>('external')
    const [schools, setSchools] = useState<SchoolOption[]>([])
    const [loadingSchools, setLoadingSchools] = useState(false)
    const [selectedSchoolId, setSelectedSchoolId] = useState<string>('')
    
    const [classes, setClasses] = useState<ClassOption[]>([])
    const [loadingClasses, setLoadingClasses] = useState(false)
    const [selectedClassId, setSelectedClassId] = useState<string>('')

    const [saving, setSaving] = useState(false)

    // Reset state on open
    useEffect(() => {
        if (!open) return
        setTransferType('external')
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
        setSaving(true)

        if (transferType === 'network') {
            if (!selectedSchoolId) {
                toast.error(t('admin.students.transferDialog.selectSchoolError'))
                setSaving(false)
                return
            }

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
        } else {
            try {
                // 1. Fetch details needed for the PDF certificate
                const supabase = createClient()
                const { data: { user } } = await supabase.auth.getUser()
                let schoolName = "Établissement Qalami"
                if (user) {
                    const { data: adminProfile } = await supabase
                        .from('profiles')
                        .select('school_id')
                        .eq('id', user.id)
                        .single()
                    if (adminProfile?.school_id) {
                        const { data: school } = await supabase
                            .from('schools')
                            .select('name')
                            .eq('id', adminProfile.school_id)
                            .single()
                        if (school?.name) schoolName = school.name
                    }
                }

                const { data: student } = await supabase
                    .from('profiles')
                    .select(`
                        full_name, date_of_birth, place_of_birth, national_id,
                        enrollments (
                            status,
                            academic_years ( name ),
                            classes ( name )
                        )
                    `)
                    .eq('id', studentId)
                    .single()

                // 2. Perform external transfer in database
                const result = await transferStudentExternally(studentId)

                if (result.error) {
                    toast.error(result.error)
                } else {
                    // 3. Generate PDF certificate
                    if (student) {
                        const rawEnrollments = student.enrollments as any[] || []
                        const activeEnroll = rawEnrollments.find(e => e.status === 'active') || rawEnrollments[0]
                        const birthDateFormatted = student.date_of_birth 
                            ? new Date(student.date_of_birth).toLocaleDateString('fr-FR')
                            : '—'
                        generateTransferPDF({
                            schoolName,
                            studentName: student.full_name,
                            birthDate: birthDateFormatted,
                            birthPlace: student.place_of_birth || '',
                            nni: student.national_id || '',
                            className: activeEnroll?.classes?.name || 'Non affecté',
                            academicYear: activeEnroll?.academic_years?.name || '2025-2026',
                            transferDate: new Date().toLocaleDateString('fr-FR')
                        })
                    }

                    toast.success("Élève transféré avec succès et certificat généré !")
                    onSuccess?.()
                    onOpenChange(false)
                }
            } catch (err: any) {
                toast.error(err.message || "Erreur lors du transfert externe")
            } finally {
                setSaving(false)
            }
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[420px] bg-[#161B22] border-white/10 text-white" dir={direction}>
                <DialogHeader className={direction === 'rtl' ? 'text-right' : 'text-left'}>
                    <DialogTitle className={cn("flex items-center gap-2", direction === 'rtl' ? 'flex-row-reverse justify-start' : 'flex-row')}>
                        <ArrowLeftRight className="w-5 h-5 text-emerald-500" />
                        {t('admin.students.transferDialog.title')}
                    </DialogTitle>
                </DialogHeader>

                <div className="py-2 space-y-4">
                    <div className="space-y-2 text-sm text-gray-400 bg-[#0D1117]/50 p-4 rounded-2xl border border-white/5">
                        <p className="font-semibold text-white">{t('admin.students.transferDialog.externalTitle')}</p>
                        <p className="text-xs">
                            {t('admin.students.transferDialog.externalDesc1')}
                        </p>
                        <p className="text-xs mt-2 text-emerald-400 font-bold">
                            {t('admin.students.transferDialog.externalDesc2')}
                        </p>
                    </div>
                </div>

                <DialogFooter className={cn("flex gap-2", direction === 'rtl' ? 'flex-row-reverse justify-start' : '')}>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={saving}
                        className="border-white/10 text-gray-400 hover:text-white"
                    >
                        {t('admin.students.transferDialog.cancel')}
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold"
                    >
                        {saving && <Loader2 className={cn("w-4 h-4 animate-spin", direction === 'rtl' ? 'ms-2' : 'me-2')} />}
                        {t('admin.students.transferDialog.transferAndCert')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
