import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { TeacherClassesList } from '@/components/teacher/classes/classes-list'
import { createAdminClient } from '@/utils/supabase/admin'

export const dynamic = 'force-dynamic'

export interface ClassWithDetails {
    id: string
    name: string
    level: string | null
    studentCount: number
    subjects: string[]
}

export interface SchoolGroup {
    id: string
    name: string
    logoUrl: string | null
    phone: string | null
    classes: ClassWithDetails[]
}

export default async function TeacherClassesPage() {
    const supabase = await createClient()

    // Get the logged-in user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const adminClient = createAdminClient()

    // 1. Discover all schools connected to this profile via BOTH direct school_id AND profile_schools intersection
    const { data: profile } = await adminClient
        .from('profiles')
        .select('id, school_id')
        .eq('id', user.id)
        .single()

    const { data: secondaryLinks } = await adminClient
        .from('profile_schools')
        .select('school_id')
        .eq('profile_id', user.id)

    const discoveredSchoolIds = new Set<string>()
    if (profile?.school_id) discoveredSchoolIds.add(profile.school_id)
    if (secondaryLinks) {
        secondaryLinks.forEach(link => { if (link.school_id) discoveredSchoolIds.add(link.school_id) })
    }

    const schoolMap = new Map<string, SchoolGroup>()

    // 2. Pre-seed schoolMap with verified schools (ensures schools with zero classes still appear in the view)
    if (discoveredSchoolIds.size > 0) {
        const { data: schoolDetails } = await adminClient
            .from('schools')
            .select('id, name, logo_url, phone')
            .in('id', Array.from(discoveredSchoolIds))

        if (schoolDetails) {
            for (const sch of schoolDetails) {
                schoolMap.set(sch.id, {
                    id: sch.id,
                    name: sch.name || 'École',
                    logoUrl: sch.logo_url || null,
                    phone: sch.phone || null,
                    classes: []
                })
            }
        }
    }

    // 3. Fetch ALL assigned classes for the teacher using adminClient to bypass RLS
    const { data: assignments, error } = await adminClient
        .from('teacher_assignments')
        .select(`
            class_id,
            subject:subject_id(name),
            classes:class_id (
                id,
                name,
                school_id,
                schools (
                    id,
                    name,
                    logo_url,
                    phone
                )
            )
        `)
        .eq('teacher_id', user.id)

    if (error) {
        console.error('Error fetching teacher assignments:', error)
    }

    // 4. Group assignments inside schoolMap containers, dynamically adding containers if missing
    for (const assignment of assignments || []) {
        const rawClass = assignment.classes as any
        if (!rawClass || !rawClass.id) continue

        const rawSchool = rawClass.schools as any
        const schoolId = rawClass.school_id || rawSchool?.id

        if (!schoolId) continue

        // Seed dynamic container if school discovered via assignment wasn't in profile_schools
        if (!schoolMap.has(schoolId)) {
            schoolMap.set(schoolId, {
                id: schoolId,
                name: rawSchool?.name || 'École',
                logoUrl: rawSchool?.logo_url || null,
                phone: rawSchool?.phone || null,
                classes: []
            })
        }

        const schoolGroup = schoolMap.get(schoolId)!

        // Avoid duplicating classes with multiple subjects
        let classDetails = schoolGroup.classes.find(c => c.id === rawClass.id)
        if (!classDetails) {
            // Fetch student count
            const { count } = await adminClient
                .from('enrollments')
                .select('*', { count: 'exact', head: true })
                .eq('class_id', rawClass.id)
                .eq('status', 'active')

            const subjName = assignment.subject as { name?: string } | null

            classDetails = {
                id: rawClass.id,
                name: rawClass.name,
                level: null,
                studentCount: count || 0,
                subjects: subjName?.name ? [subjName.name] : []
            }
            schoolGroup.classes.push(classDetails)
        } else {
            const subjName = assignment.subject as { name?: string } | null
            if (subjName?.name && !classDetails.subjects.includes(subjName.name)) {
                classDetails.subjects.push(subjName.name)
            }
        }
    }

    const schoolGroups = Array.from(schoolMap.values())

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            <TeacherClassesList schoolGroups={schoolGroups} />
        </div>
    )
}
