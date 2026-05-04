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
    onSuccess?: (className: string) => void
}

export function AssignClassDialog({
    open,
    onOpenChange,
    studentId,
    studentName,
    currentClassId,
    onSuccess,
}: AssignClassDialogProps) {
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
            toast.error('Veuillez sélectionner une classe')
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
            toast.success(`${studentName} assigné(e) à ${result.className}`)
            onSuccess?.(result.className!)
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
            <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <GraduationCap className="w-5 h-5 text-emerald-500" />
                        Assigner à une classe
                    </DialogTitle>
                </DialogHeader>

                <div className="py-2 space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Choisissez la classe pour <span className="font-semibold text-foreground">{studentName}</span>.
                        {currentClassId && (
                            <span className="block mt-0.5 text-xs text-amber-600">
                                L'inscription actuelle sera mise à jour vers la nouvelle classe.
                            </span>
                        )}
                    </p>

                    <div className="space-y-1.5">
                        <Label htmlFor="class-select">Classe</Label>
                        {loadingClasses ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground h-10">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Chargement des classes…
                            </div>
                        ) : classes.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Aucune classe disponible.</p>
                        ) : (
                            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                                <SelectTrigger id="class-select">
                                    <SelectValue placeholder="Sélectionner une classe" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(grouped).map(([level, levelClasses]) => (
                                        <div key={level}>
                                            <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                                {level}
                                            </div>
                                            {levelClasses.map(cls => (
                                                <SelectItem key={cls.id} value={cls.id}>
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

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={saving}
                    >
                        Annuler
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || !selectedClassId || loadingClasses}
                    >
                        {saving && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                        {currentClassId ? 'Changer de classe' : 'Assigner'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
