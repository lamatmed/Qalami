'use client'

import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Users, ArrowRight, BookOpen } from 'lucide-react'
import { useLanguage } from '@/i18n'

interface ClassWithDetails {
    id: string
    name: string
    level: string | null
    studentCount: number
    subjects: string[]
}

interface TeacherClassesListProps {
    initialClasses: ClassWithDetails[]
}

export function TeacherClassesList({ initialClasses }: TeacherClassesListProps) {
    const { t } = useLanguage()

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">{t('teacher.classes.title')}</h1>

            {initialClasses.length === 0 ? (
                <Card className="p-8 text-center border-gray-200 dark:border-white/5 bg-white dark:bg-slate-800/50">
                    <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                    <p className="text-muted-foreground">
                        {t('teacher.classes.noClasses')}
                    </p>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {initialClasses.map((cls) => (
                        <Link key={cls.id} href={`/teacher/classes/${cls.id}`}>
                            <Card className="hover:border-primary/50 dark:hover:border-primary/30 transition-all cursor-pointer group h-full shadow-sm hover:shadow-md bg-white dark:bg-slate-800/50 border-gray-150 dark:border-white/5">
                                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                    <CardTitle className="text-lg font-bold text-gray-900 dark:text-white truncate max-w-[80%]">{cls.name}</CardTitle>
                                    <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-full group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/20 transition-colors">
                                        <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-sm text-gray-500 dark:text-muted-foreground font-medium">
                                        {cls.level && <span>{cls.level} • </span>}
                                        {t('teacher.classes.studentsCount')
                                            .replace('{count}', cls.studentCount.toString())
                                            .replace('{plural}', cls.studentCount !== 1 ? 's' : '')
                                        }
                                    </div>
                                    {cls.subjects.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {cls.subjects.map((subject) => (
                                                <span
                                                    key={subject}
                                                    className="text-xs bg-gray-50 dark:bg-slate-900/50 text-gray-600 dark:text-gray-300 border border-gray-150 dark:border-white/5 px-2.5 py-0.5 rounded-full font-medium"
                                                >
                                                    {subject}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <div className="mt-4 flex items-center text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                        {t('teacher.classes.viewClass')} <ArrowRight className="w-3 h-3 ms-1 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}
