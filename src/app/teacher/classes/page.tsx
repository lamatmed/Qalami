import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { TeacherClassesList } from '@/components/teacher/classes/classes-list'

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
                name
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
                .eq('status', 'active')

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
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            <TeacherClassesList initialClasses={classes} />
        </div>
    )
}
