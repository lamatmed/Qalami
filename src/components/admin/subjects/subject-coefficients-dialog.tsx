'use client'

import { useState, useEffect } from 'react'
import { upsertSubjectCoefficient } from '@/app/admin/subjects/actions'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/utils/supabase/client'
import { useLanguage } from '@/i18n'

interface ClassRow {
    id: string
    name: string
    level_name: string | null
}

interface SubjectCoefficientsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    subject: { id: string; name: string }
}

export function SubjectCoefficientsDialog({ open, onOpenChange, subject }: SubjectCoefficientsDialogProps) {
    const { t } = useLanguage()
    const [classes, setClasses] = useState<ClassRow[]>([])
    const [coefficients, setCoefficients] = useState<Record<string, string>>({})
    const [saving, setSaving] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!open) return

        async function fetchData() {
            setLoading(true)
            const supabase = createClient()

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setLoading(false); return }

            const { data: profile } = await supabase
                .from('profiles')
                .select('school_id')
                .eq('id', user.id)
                .single()

            if (!profile?.school_id) { setLoading(false); return }

            const [{ data: classesData }, { data: coeffsData }] = await Promise.all([
                supabase
                    .from('classes')
                    .select('id, name, levels(name_fr)')
                    .eq('school_id', profile.school_id)
                    .order('name', { ascending: true }),
                supabase
                    .from('subject_coefficients')
                    .select('class_id, coefficient')
                    .eq('subject_id', subject.id)
                    .eq('school_id', profile.school_id),
            ])

            setClasses((classesData || []).map((c: any) => ({
                id: c.id,
                name: c.name,
                level_name: c.levels?.name_fr ?? null,
            })))

            const map: Record<string, string> = {}
            ;(coeffsData || []).forEach((c: any) => {
                map[c.class_id] = String(c.coefficient)
            })
            setCoefficients(map)
            setLoading(false)
        }

        fetchData()
    }, [open, subject.id])

    const handleSave = async (classId: string) => {
        const val = parseFloat(coefficients[classId] || '1')
        if (isNaN(val) || val < 0.5 || val > 10) {
            toast.error(t('admin.subjects.invalidCoeff'))
            return
        }
        setSaving(classId)
        const result = await upsertSubjectCoefficient(subject.id, classId, val)
        if (result?.error) {
            toast.error(result.error)
        } else {
            toast.success(t('admin.subjects.coeffSaved'))
        }
        setSaving(null)
    }

    // Group classes by level
    const grouped = classes.reduce<Record<string, ClassRow[]>>((acc, cls) => {
        const key = cls.level_name ?? t('admin.subjects.noLevel')
        if (!acc[key]) acc[key] = []
        acc[key].push(cls)
        return acc
    }, {})

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{t('admin.subjects.coeffTitle', { name: subject.name })}</DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                ) : classes.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                        {t('admin.subjects.noClasses')}
                    </p>
                ) : (
                    <div className="space-y-5 py-2">
                        <p className="text-xs text-muted-foreground">
                            {t('admin.subjects.coeffDesc', { name: subject.name })}
                        </p>
                        {Object.entries(grouped).map(([levelName, levelClasses]) => (
                            <div key={levelName}>
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                    {levelName}
                                </p>
                                <div className="space-y-2">
                                    {levelClasses.map(cls => (
                                        <div key={cls.id} className="flex items-center gap-3">
                                            <p className="flex-1 text-sm font-medium">{cls.name}</p>
                                            <Input
                                                type="number"
                                                min="0.5"
                                                max="10"
                                                step="0.5"
                                                className="w-24 text-center"
                                                value={coefficients[cls.id] ?? '1'}
                                                onChange={e => setCoefficients(prev => ({ ...prev, [cls.id]: e.target.value }))}
                                            />
                                            <Button
                                                size="icon"
                                                variant="outline"
                                                type="button"
                                                onClick={() => handleSave(cls.id)}
                                                disabled={saving === cls.id}
                                                className="shrink-0"
                                            >
                                                {saving === cls.id
                                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                                    : <Check className="w-4 h-4" />
                                                }
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
