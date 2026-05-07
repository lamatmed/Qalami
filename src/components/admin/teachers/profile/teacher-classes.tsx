'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronRight, Users, GraduationCap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/i18n'

interface TeacherClass {
    id: string
    name: string
    level: string | null
    studentCount: number
    subjectName: string
}

export function TeacherClasses({ teacherId }: { teacherId: string }) {
    const router = useRouter()
    const { t } = useLanguage()
    const [classes, setClasses] = useState<TeacherClass[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchClasses() {
            setLoading(true)
            const supabase = createClient()

            // Get teacher assignments (class + subject)
            const { data: assignments, error } = await supabase
                .from('teacher_assignments')
                .select(`
                    class_id,
                    subject:subject_id ( name ),
                    classes:class_id ( id, name )
                `)
                .eq('teacher_id', teacherId)

            if (error) {
                console.error('Error fetching teacher classes:', error?.message, error?.code, error?.details, error?.hint)
                setLoading(false)
                return
            }

            // Get unique classes
            const classMap = new Map<string, TeacherClass>()
            for (const a of assignments || []) {
                const cls = a.classes as any
                if (!cls?.id || classMap.has(cls.id)) continue
                classMap.set(cls.id, {
                    id: cls.id,
                    name: cls.name,
                    level: null,
                    studentCount: 0,
                    subjectName: (a.subject as any)?.name || ''
                })
            }

            // Get student counts per class
            for (const [classId, cls] of classMap) {
                const { count } = await supabase
                    .from('enrollments')
                    .select('id', { count: 'exact', head: true })
                    .eq('class_id', classId)

                cls.studentCount = count || 0
            }

            setClasses(Array.from(classMap.values()))
            setLoading(false)
        }

        fetchClasses()
    }, [teacherId])

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-20 rounded-2xl" />
                <Skeleton className="h-20 rounded-2xl" />
            </div>
        )
    }

    const colors = ['bg-purple-500', 'bg-blue-500', 'bg-emerald-500', 'bg-orange-500', 'bg-pink-500']

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground">{t('admin.teachers.classesAssigned.title')}</h2>
            </div>
 
            {classes.length === 0 ? (
                <div className="bg-card rounded-3xl border border-border p-12 text-center text-muted-foreground">
                    <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>{t('admin.teachers.classesAssigned.noClasses')}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {classes.map((cls, i) => (
                        <div
                            key={cls.id}
                            className="bg-card rounded-2xl p-4 border border-border flex items-center justify-between hover:border-primary/30 transition-all cursor-pointer group"
                            onClick={() => router.push(`/admin/classes/all/${cls.id}`)}
                        >
                            <div className="flex items-center gap-4">
                                <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-lg", colors[i % colors.length])}>
                                    {cls.name.substring(0, 3)}
                                </div>
                                <div>
                                    <h4 className="font-bold text-foreground text-lg group-hover:text-primary transition-colors">{cls.name}</h4>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {t('admin.teachers.classesAssigned.studentsCount').replace('{count}', cls.studentCount.toString())}</span>
                                        {cls.subjectName && (
                                            <>
                                                <span>•</span>
                                                <span className="text-primary font-medium">{cls.subjectName}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
 
                            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground shrink-0">
                                <ChevronRight className="w-5 h-5 rtl:rotate-180" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
