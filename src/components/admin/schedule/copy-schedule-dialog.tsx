'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ArrowRight, Loader2, AlertTriangle, Copy } from 'lucide-react'
import { copySchedule } from '@/app/admin/schedule/actions'
import { toast } from 'sonner'
import { getMySchoolContext } from '@/app/admin/actions'
import { useLanguage } from '@/i18n'

interface ClassOption { id: string; name: string; level: string | null }

export function CopyScheduleDialog({
    open,
    onClose,
    onSuccess,
}: {
    open: boolean
    onClose: () => void
    onSuccess: () => void
}) {
    const { t } = useLanguage()
    const [classes, setClasses] = useState<ClassOption[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [sourceId, setSourceId] = useState('')
    const [targetId, setTargetId] = useState('')

    useEffect(() => {
        if (!open) return
        async function fetchClasses() {
            setLoading(true)
            const supabase = createClient()
            const ctx = await getMySchoolContext()
            if (!ctx) { setLoading(false); return }
            const profile = { school_id: ctx.school_id }

            const { data } = await supabase
                .from('classes')
                .select('id, name, level')
                .eq('school_id', profile.school_id)
                .order('level').order('name')

            setClasses(data || [])
            setLoading(false)
        }
        if (open) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSourceId('')
             
            setTargetId('')
            fetchClasses()
        }
    }, [open])

    const handleCopy = async () => {
        if (!sourceId || !targetId) return
        if (sourceId === targetId) {
            toast.error(t('admin.schedule.copyDialog.errorSameClass'))
            return
        }
        setSaving(true)
        const result = await copySchedule(sourceId, targetId)
        setSaving(false)
        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success(t('admin.schedule.copyDialog.successMessage', { count: result.count }))
            onSuccess()
        }
    }

    const sourceName = classes.find(c => c.id === sourceId)?.name
    const targetName = classes.find(c => c.id === targetId)?.name

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[480px] bg-card border-border text-foreground">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Copy className="w-4 h-4" />
                        {t('admin.schedule.copyDialog.title')}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        {t('admin.schedule.copyDialog.description')}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-6 text-muted-foreground">
                            <Loader2 className="w-5 h-5 animate-spin me-2" /> {t('common.loading')}
                        </div>
                    ) : (
                        <>
                            <div className="grid gap-2">
                                <Label className="text-xs uppercase font-bold text-muted-foreground">{t('admin.schedule.copyDialog.sourceClass')}</Label>
                                <Select value={sourceId} onValueChange={setSourceId}>
                                    <SelectTrigger className="bg-muted border-border">
                                        <SelectValue placeholder={t('admin.schedule.copyDialog.sourcePlaceholder')} />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border">
                                        {classes.map(c => (
                                            <SelectItem key={c.id} value={c.id} disabled={c.id === targetId}>
                                                {c.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center justify-center">
                                <ArrowRight className="w-5 h-5 text-muted-foreground" />
                            </div>

                            <div className="grid gap-2">
                                <Label className="text-xs uppercase font-bold text-muted-foreground">{t('admin.schedule.copyDialog.targetClass')}</Label>
                                <Select value={targetId} onValueChange={setTargetId}>
                                    <SelectTrigger className="bg-muted border-border">
                                        <SelectValue placeholder={t('admin.schedule.copyDialog.targetPlaceholder')} />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border">
                                        {classes.map(c => (
                                            <SelectItem key={c.id} value={c.id} disabled={c.id === sourceId}>
                                                {c.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {sourceId && targetId && sourceId !== targetId && (
                                <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-amber-400 text-sm">
                                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <span>
                                        {t('admin.schedule.copyDialog.warningMessage', { target: targetName || '', source: sourceName || '' })}
                                    </span>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} className="text-muted-foreground">
                        {t('common.cancel')}
                    </Button>
                    <Button
                        onClick={handleCopy}
                        disabled={saving || !sourceId || !targetId || sourceId === targetId}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                    >
                        {saving && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                        {t('admin.schedule.copy')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
