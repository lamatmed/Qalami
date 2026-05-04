'use client'

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Users, Loader2 } from "lucide-react"
import { useLanguage } from '@/i18n'
import { createClient } from '@/utils/supabase/client'
import { useState, useEffect } from 'react'

interface ClassOption {
    id: string
    name: string
}

export function ClassSelector({
    selectedClass,
    onClassChange
}: {
    selectedClass: string,
    onClassChange: (value: string) => void
}) {
    const { t } = useLanguage()
    const [classes, setClasses] = useState<ClassOption[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchClasses() {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setLoading(false); return }

            const { data: profile } = await supabase
                .from('profiles')
                .select('school_id')
                .eq('id', user.id)
                .single()

            if (!profile?.school_id) { setLoading(false); return }

            const { data } = await supabase
                .from('classes')
                .select('id, name')
                .eq('school_id', profile.school_id)
                .order('name', { ascending: true })

            setClasses(data || [])
            // Auto-select first class if no selection
            if (data && data.length > 0 && !selectedClass) {
                onClassChange(data[0].id)
            }
            setLoading(false)
        }
        fetchClasses()
    }, [])

    const selectedClassName = classes.find(c => c.id === selectedClass)?.name || ''

    return (
        <div className="flex flex-col sm:flex-row gap-4 items-center bg-card p-4 rounded-2xl border border-border">
            <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-lg">
                    <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                    <h3 className="text-foreground font-bold text-sm">{t('admin.schedule.title')}</h3>
                    <p className="text-muted-foreground text-xs">{t('admin.schedule.selectClass')}</p>
                </div>
            </div>

            <div className="flex-1 w-full sm:w-auto sm:ms-auto flex items-center gap-3">
                {loading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                ) : (
                    <Select value={selectedClass} onValueChange={onClassChange}>
                        <SelectTrigger className="w-full sm:w-[250px] bg-muted border-border text-foreground">
                            <SelectValue placeholder={t('admin.schedule.selectClassPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground">
                            {classes.map(cls => (
                                <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                {selectedClassName && (
                    <Badge variant="outline" className="hidden sm:flex border-primary/30 text-primary bg-primary/5">
                        {selectedClassName}
                    </Badge>
                )}
            </div>
        </div>
    )
}
