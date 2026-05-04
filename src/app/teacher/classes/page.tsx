import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Users, ArrowRight, BookOpen } from 'lucide-react'
import { redirect } from 'next/navigation'

interface ClassWithDetails {
    id: string
    name: string
    level: string | null
    studentCount: number
    subjects: string[]
}

export default async function TeacherClassesPage() {
    const supabase = await createClient()

    // Get the logged-in user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    // Fetch teacher's assigned classes via teacher_assignments junction table
    const { data: assignments, error } = await supabase
        .from('teacher_assignments')
        .select(`
            class_id,
            subject:subject_id(name),
            classes:class_id(
                id,
                name,
                level
            )
        `)
        .eq('teacher_id', user.id)

    if (error) {
        console.error('Error fetching teacher assignments:', error)
    }

    // Build a map of unique classes with their subjects
    const classMap = new Map<string, ClassWithDetails>()

    for (const assignment of assignments || []) {
        const cls = assignment.classes as { id: string; name: string; level: string | null } | null
        const subject = assignment.subject as { name: string } | null

        if (!cls?.id) continue

        if (!classMap.has(cls.id)) {
            // Get student count for this class
            const { count } = await supabase
                .from('enrollments')
                .select('*', { count: 'exact', head: true })
                .eq('class_id', cls.id)

            classMap.set(cls.id, {
                id: cls.id,
                name: cls.name,
                level: null,
                studentCount: count || 0,
                subjects: subject?.name ? [subject.name] : []
            })
        } else {
            // Add subject to existing class entry
            const existing = classMap.get(cls.id)!
            if (subject?.name && !existing.subjects.includes(subject.name)) {
                existing.subjects.push(subject.name)
            }
        }
    }

    const classes = Array.from(classMap.values())

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            <h1 className="text-2xl font-bold">Mes Classes</h1>

            {classes.length === 0 ? (
                <Card className="p-8 text-center">
                    <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                        Aucune classe assignée pour le moment.
                    </p>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {classes.map((cls) => (
                        <Link key={cls.id} href={`/teacher/classes/${cls.id}`}>
                            <Card className="hover:border-primary/50 transition-all cursor-pointer group h-full">
                                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                    <CardTitle className="text-lg font-bold">{cls.name}</CardTitle>
                                    <div className="p-2 bg-primary/10 rounded-full group-hover:bg-primary/20 transition-colors">
                                        <Users className="w-4 h-4 text-primary" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-sm text-muted-foreground">
                                        {cls.level && <span>{cls.level} • </span>}
                                        {cls.studentCount} Élève{cls.studentCount !== 1 ? 's' : ''}
                                    </div>
                                    {cls.subjects.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {cls.subjects.map((subject) => (
                                                <span
                                                    key={subject}
                                                    className="text-xs bg-secondary px-2 py-0.5 rounded-full"
                                                >
                                                    {subject}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <div className="mt-4 flex items-center text-xs font-semibold text-primary">
                                        Voir la classe <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
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
