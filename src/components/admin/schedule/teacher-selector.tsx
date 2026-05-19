'use client'

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { GraduationCap, Loader2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { fetchTeachersForSchedule, type ScheduleTeacherOption } from '@/app/admin/schedule/actions'
import { useLanguage } from '@/i18n'
import { toast } from 'sonner'

export function TeacherSelector({
    selectedTeacher,
    onTeacherChange,
}: {
    selectedTeacher: string
    onTeacherChange: (value: string) => void
}) {
    const { t } = useLanguage()
    const [teachers, setTeachers] = useState<ScheduleTeacherOption[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        async function load() {
            setLoading(true)
            const { teachers: list, error } = await fetchTeachersForSchedule()
            if (cancelled) return
            if (error) {
                toast.error(error)
                setTeachers([])
                setLoading(false)
                return
            }
            setTeachers(list)
            if (list.length > 0 && !selectedTeacher) {
                onTeacherChange(list[0].id)
            }
            setLoading(false)
        }
        void load()
        return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chargement unique ; liste via action serveur (admin)
    }, [])

    const selected = teachers.find(tOpt => tOpt.id === selectedTeacher)

    return (
        <div className="flex flex-col sm:flex-row gap-4 items-center bg-card p-4 rounded-2xl border border-border">
            <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-lg">
                    <GraduationCap className="w-5 h-5 text-primary" />
                </div>
                <div>
                    <h3 className="text-foreground font-bold text-sm">{t('admin.schedule.byTeacherView')}</h3>
                    <p className="text-muted-foreground text-xs">{t('admin.schedule.selectTeacherDesc')}</p>
                </div>
            </div>

            <div className="flex-1 w-full sm:w-auto sm:ms-auto flex items-center gap-3">
                {loading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                ) : (
                    <Select value={selectedTeacher} onValueChange={onTeacherChange}>
                        <SelectTrigger className="w-full sm:w-[280px] bg-muted border-border text-foreground">
                            <SelectValue placeholder={t('admin.schedule.chooseTeacherPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground">
                            {teachers.length === 0 && (
                                <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                                    {t('admin.schedule.noTeachers')}
                                </div>
                            )}
                            {teachers.map(emp => (
                                <SelectItem key={emp.id} value={emp.id}>
                                    <div className="flex flex-col">
                                        <span>{emp.full_name}</span>
                                        {emp.subjects.length > 0 && (
                                            <span className="text-xs text-muted-foreground">
                                                {emp.subjects.slice(0, 2).join(', ')}{emp.subjects.length > 2 ? '…' : ''}
                                            </span>
                                        )}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                {selected && (
                    <div className="hidden sm:flex flex-col">
                        <span className="text-xs font-bold text-foreground">{selected.full_name}</span>
                        {selected.subjects.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                                {selected.subjects.slice(0, 3).join(' · ')}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
