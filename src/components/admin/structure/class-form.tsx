'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Save, ArrowLeft, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useLanguage } from '@/i18n'
import { createClient } from '@/utils/supabase/client'
import { createClass } from '@/app/admin/classes/actions'
import { toast } from 'sonner'

interface LevelOption {
    id: string
    nameFr: string
    nameAr: string
}

export function ClassForm({ levelId }: { levelId: string }) {
    const router = useRouter()
    const { t } = useLanguage()

    const [className, setClassName] = useState('')
    const [selectedLevelId, setSelectedLevelId] = useState(levelId)
    const [capacity, setCapacity] = useState('40')
    const [saving, setSaving] = useState(false)
    const [levels, setLevels] = useState<LevelOption[]>([])
    const [currentLevelName, setCurrentLevelName] = useState('')

    useEffect(() => {
        async function fetchLevels() {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase
                .from('profiles')
                .select('school_id')
                .eq('id', user.id)
                .single()

            if (!profile?.school_id) return

            const { data } = await supabase
                .from('levels')
                .select('id, name_fr, name_ar')
                .eq('school_id', profile.school_id)
                .order('order', { ascending: true })

            if (data) {
                const opts = data.map(l => ({ id: l.id, nameFr: l.name_fr, nameAr: l.name_ar }))
                setLevels(opts)
                const current = opts.find(l => l.id === levelId)
                if (current) setCurrentLevelName(current.nameFr)
            }
        }
        fetchLevels()
    }, [levelId])

    const handleSave = async () => {
        if (!className.trim()) {
            toast.error(t('admin.classForm.classNameRequired') || 'Le nom de la classe est requis')
            return
        }

        setSaving(true)
        try {
            const formData = new FormData()
            formData.set('name', className.trim())
            if (selectedLevelId) formData.set('level_id', selectedLevelId)
            formData.set('capacity', capacity)

            const result = await createClass(formData)

            if (result?.error) throw new Error(result.error)

            toast.success(t('admin.classForm.classCreated') || 'Classe créée avec succès')
            router.back()
            router.refresh()
        } catch (err: any) {
            console.error('Error creating class:', err?.message || err)
            toast.error(err?.message || 'Erreur lors de la création')
        }

        setSaving(false)
    }

    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-right duration-500">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h2 className="text-2xl font-bold text-foreground">{t('admin.classForm.createClass')}</h2>
                    <p className="text-muted-foreground text-sm">{t('admin.classForm.level')}: <span className="text-primary font-bold">{currentLevelName}</span></p>
                </div>
            </div>

            <div className="bg-card p-6 lg:p-8 rounded-3xl border border-border space-y-8">
                {/* General Info */}
                <div className="space-y-4">
                    <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-4">{t('admin.classForm.generalInfo')}</h3>

                    <div className="space-y-2">
                        <Label>{t('admin.classForm.className')}</Label>
                        <Input
                            placeholder={t('admin.classForm.classNamePlaceholder')}
                            className="bg-muted border-border"
                            value={className}
                            onChange={e => setClassName(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>{t('admin.classForm.associatedLevel')}</Label>
                            <Select value={selectedLevelId} onValueChange={setSelectedLevelId}>
                                <SelectTrigger className="bg-muted border-border">
                                    <SelectValue placeholder={t('admin.classForm.selectLevel')} />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                    {levels.map(lvl => (
                                        <SelectItem key={lvl.id} value={lvl.id}>{lvl.nameFr}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>{t('admin.classForm.maxCapacity')}</Label>
                            <Input
                                type="number"
                                placeholder={t('admin.classForm.capacityPlaceholder')}
                                className="bg-muted border-border"
                                value={capacity}
                                onChange={e => setCapacity(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="pt-6 border-t border-border">
                    <Button
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-12 rounded-xl"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? (
                            <Loader2 className="w-4 h-4 me-2 animate-spin" />
                        ) : (
                            <Save className="me-2 w-4 h-4" />
                        )}
                        {t('admin.classForm.saveClass')}
                    </Button>
                </div>
            </div>
        </div>
    )
}
