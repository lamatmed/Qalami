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
import { useState, useEffect } from 'react'

interface ClassOption {
    id: string
    name: string
    level_name: string | null
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
        fetch('/api/admin/classes')
            .then(res => res.ok ? res.json() : null)
            .then(json => {
                if (!json) return
                const data = json.classes || []
                setClasses(data)
                if (data.length > 0 && !selectedClass) onClassChange(data[0].id)
            })
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [])

    const selectedClass_ = classes.find(c => c.id === selectedClass)
    const selectedClassName = selectedClass_?.name || ''
    const selectedLevelName = selectedClass_?.level_name || ''

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
                                <SelectItem key={cls.id} value={cls.id}>
                                    <span>{cls.name}</span>
                                    {cls.level_name && (
                                        <span className="ms-2 text-xs text-muted-foreground">({cls.level_name})</span>
                                    )}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                {selectedClassName && (
                    <Badge variant="outline" className="hidden sm:flex border-primary/30 text-primary bg-primary/5">
                        {selectedLevelName && <span className="text-muted-foreground me-1">{selectedLevelName} /</span>}
                        {selectedClassName}
                    </Badge>
                )}
            </div>
        </div>
    )
}
