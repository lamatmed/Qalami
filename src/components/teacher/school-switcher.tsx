'use client'

import { useTeacher } from '@/context/teacher-context'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { School, Building2 } from 'lucide-react'

export function TeacherSchoolSwitcher() {
    const { schoolId, schools, setActiveSchool } = useTeacher()

    // Only render the switcher if teacher belongs to more than one school
    if (!schools || schools.length <= 1) {
        return null
    }

    return (
        <div className="flex items-center gap-2">
            <Select value={schoolId || undefined} onValueChange={setActiveSchool}>
                <SelectTrigger className="h-9 px-3 bg-card hover:bg-muted/50 border-border/50 rounded-xl text-xs font-semibold flex gap-2 items-center min-w-[160px] shadow-sm focus:ring-1">
                    <Building2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <SelectValue placeholder="Choisir l'école" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border/50 rounded-xl">
                    {schools.map((sch) => (
                        <SelectItem 
                            key={sch.id} 
                            value={sch.id}
                            className="text-xs font-medium rounded-lg flex items-center gap-2"
                        >
                            {sch.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}
