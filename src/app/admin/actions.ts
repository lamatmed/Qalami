'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function getMySchoolContext() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const adminClient = createAdminClient()
    const { data: profile } = await adminClient
        .from('profiles')
        .select('school_id, role, full_name, avatar_url')
        .eq('id', user.id)
        .single()

    if (!profile?.school_id) return null
    return {
        school_id: profile.school_id,
        role: profile.role,
        user_id: user.id,
        full_name: (profile as any).full_name || null,
        avatar_url: (profile as any).avatar_url || null,
    }
}

export async function getSchoolLinkedProfileIds(schoolId: string, role: 'teacher' | 'parent' | 'student') {
    const ctx = await getMySchoolContext()
    if (!ctx || (ctx.school_id !== schoolId && ctx.role !== 'super_admin')) {
        throw new Error("Non autorisé")
    }
    const adminClient = createAdminClient()
    const { data, error } = await adminClient
        .from('profile_schools')
        .select('profile_id')
        .eq('school_id', schoolId)
        .eq('role', role)
    
    if (error) {
        console.error('Error fetching profile links via admin context:', error)
        return []
    }
    return (data || []).map(r => r.profile_id)
}

export async function secureFetchProfiles(profileIds: string[], selectString: string = '*') {
    if (!profileIds || profileIds.length === 0) return []
    const ctx = await getMySchoolContext()
    if (!ctx) return []

    const adminClient = createAdminClient()
    
    // If not a super_admin, restrict only to profile IDs belonging to the same school
    let filteredIds = profileIds
    if (ctx.role !== 'super_admin') {
        const [{ data: links }, { data: direct }] = await Promise.all([
            adminClient
                .from('profile_schools')
                .select('profile_id')
                .eq('school_id', ctx.school_id)
                .in('profile_id', profileIds),
            adminClient
                .from('profiles')
                .select('id')
                .eq('school_id', ctx.school_id)
                .in('id', profileIds)
        ])
        const allowed = new Set([
            ...(links || []).map(l => l.profile_id),
            ...(direct || []).map(d => d.id)
        ])
        filteredIds = profileIds.filter(id => allowed.has(id))
    }

    if (filteredIds.length === 0) return []

    const { data, error } = await adminClient
        .from('profiles')
        .select(selectString)
        .in('id', filteredIds)
        .order('full_name')
        
    if (error) {
        console.error('Error securely fetching profiles:', error)
        return []
    }
    return data
}

export async function getSchoolMetricsCounts(schoolId: string) {
    const ctx = await getMySchoolContext()
    if (!ctx || (ctx.school_id !== schoolId && ctx.role !== 'super_admin')) {
        throw new Error("Non autorisé")
    }
    const adminClient = createAdminClient()
    
    // --- 1. STUDENTS (Direct) ---
    const { count: studentCount } = await adminClient
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('role', 'student')

    // --- 2. TEACHERS (3-way Union) ---
    // A. Direct
    const { data: directTeachers } = await adminClient
        .from('profiles')
        .select('id')
        .eq('school_id', schoolId)
        .eq('role', 'teacher')
    
    // B. Assignments
    const { data: assignedTeachers } = await adminClient
        .from('teacher_assignments')
        .select('teacher_id, classes!inner(school_id)')
        .eq('classes.school_id', schoolId)

    // C. profile_schools links
    const { data: schoolLinkTeachers } = await adminClient
        .from('profile_schools')
        .select('profile_id')
        .eq('school_id', schoolId)
        .eq('role', 'teacher')

    const uniqueTeacherIds = new Set([
        ...(directTeachers || []).map(t => t.id),
        ...(assignedTeachers || []).map((t: any) => t.teacher_id),
        ...(schoolLinkTeachers || []).map(t => t.profile_id)
    ])

    // --- 3. PARENTS (3-way Union) ---
    // A. Direct
    const { data: directParents } = await adminClient
        .from('profiles')
        .select('id')
        .eq('school_id', schoolId)
        .eq('role', 'parent')
    
    // B. Linked through students in this school
    const { data: linkedParents } = await adminClient
        .from('parent_student_links')
        .select('parent_id, students:profiles!parent_student_links_student_id_fkey!inner(school_id)')
        .eq('students.school_id', schoolId)

    // C. profile_schools links
    const { data: schoolLinkParents } = await adminClient
        .from('profile_schools')
        .select('profile_id')
        .eq('school_id', schoolId)
        .eq('role', 'parent')

    const uniqueParentIds = new Set([
        ...(directParents || []).map(p => p.id),
        ...(linkedParents || []).map((p: any) => p.parent_id),
        ...(schoolLinkParents || []).map(p => p.profile_id)
    ])

    return {
        students: studentCount || 0,
        teachers: uniqueTeacherIds.size,
        parents: uniqueParentIds.size,
    }
}

export async function searchSchoolParents(searchTerm: string) {
    const ctx = await getMySchoolContext()
    if (!ctx) return []
    const schoolId = ctx.school_id

    const adminClient = createAdminClient()

    // Step A: Direct school parents
    const { data: directP } = await adminClient.from('profiles')
        .select('id')
        .eq('school_id', schoolId)
        .eq('role', 'parent')

    // Step B: Profile_schools links
    const { data: linkP } = await adminClient.from('profile_schools')
        .select('profile_id')
        .eq('school_id', schoolId)
        .eq('role', 'parent')

    // Step C: Linked parents via existing students
    const { data: studentLinkedP } = await adminClient.from('parent_student_links')
        .select('parent_id, students:profiles!parent_student_links_student_id_fkey!inner(school_id)')
        .eq('students.school_id', schoolId)

    const allParentIds = Array.from(new Set([
        ...(directP || []).map(p => p.id),
        ...(linkP || []).map(p => p.profile_id),
        ...(studentLinkedP || []).map((p: any) => p.parent_id)
    ]))

    // Final search query
    const isPhoneSearch = /^\+?\d{4,}$/.test(searchTerm.trim())

    let query = adminClient.from('profiles')
        .select('id, full_name, phone, email')
        .eq('role', 'parent')
        .or(`full_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)

    if (!isPhoneSearch) {
        // If not a specific phone number search, restrict only to parents already linked to this school
        if (allParentIds.length === 0) return []
        query = query.in('id', allParentIds)
    }

    const { data } = await query.limit(15).order('full_name')
    return (data || []) as { id: string; full_name: string; phone: string | null; email: string | null }[]
}

export async function notifyLateParentAction(studentId: string, overdueCount: number, totalOwed: number) {
    const ctx = await getMySchoolContext()
    if (!ctx) return { error: 'Non authentifié' }

    const adminClient = createAdminClient()

    // 1. Get student name and school
    const { data: student } = await adminClient
        .from('profiles')
        .select('full_name, school_id')
        .eq('id', studentId)
        .single()

    if (!student) {
        return { error: "Élève introuvable." }
    }

    if (student.school_id !== ctx.school_id && ctx.role !== 'super_admin') {
        return { error: "Non autorisé à notifier les parents de cet élève." }
    }

    const studentName = student.full_name || "l'élève"

    // 2. Find all parents linked to this student
    const { data: parentLinks } = await adminClient
        .from('parent_student_links')
        .select('parent_id')
        .eq('student_id', studentId)

    if (!parentLinks || parentLinks.length === 0) {
        return { error: "Aucun parent n'est lié à cet élève pour envoyer la notification." }
    }

    // 3. Insert a notification for each parent
    const notifications = parentLinks.map(link => ({
        user_id: link.parent_id,
        school_id: ctx.school_id,
        title: `🔔 Rappel de Paiement : ${studentName}`,
        message: `Bonjour, nous vous rappelons que ${studentName} a ${overdueCount} mensualité(s) en retard pour un total de ${totalOwed.toLocaleString('fr-FR')} MRU. Merci de régulariser dès que possible.`,
        type: 'warning',
        event_type: 'payment_reminder'
    }))

    const { error } = await adminClient
        .from('notifications')
        .insert(notifications)

    if (error) {
        console.error("Error creating late notifications:", error)
        return { error: error.message }
    }

    // Notify admin themselves as confirmation the reminders were sent
    await adminClient.from('notifications').insert({
        user_id: ctx.user_id,
        school_id: ctx.school_id,
        title: `✅ Rappel envoyé : ${studentName}`,
        message: `${overdueCount} mensualité(s) en retard — ${totalOwed.toLocaleString('fr-FR')} MRU. Rappel envoyé aux parents.`,
        type: 'success',
        action_url: '/admin/students',
        event_type: 'payment_reminder_sent',
        is_read: false,
    })

    return { success: true }
}

export async function notifyAdminSelf(params: {
    title: string
    message: string
    type?: 'info' | 'success' | 'warning' | 'action'
    actionUrl?: string
    eventType?: string
}) {
    const ctx = await getMySchoolContext()
    if (!ctx) return
    const adminClient = createAdminClient()
    await adminClient.from('notifications').insert({
        user_id: ctx.user_id,
        school_id: ctx.school_id,
        title: params.title,
        message: params.message,
        type: params.type ?? 'info',
        action_url: params.actionUrl ?? null,
        event_type: params.eventType ?? null,
        is_read: false,
    })
}

export async function getAdminNotifications(schoolId: string) {
    const ctx = await getMySchoolContext()
    if (!ctx || (ctx.school_id !== schoolId && ctx.role !== 'super_admin')) {
        return []
    }
    const adminClient = createAdminClient()
    const { data } = await adminClient
        .from('notifications')
        .select('*')
        .eq('user_id', ctx.user_id)
        .order('created_at', { ascending: false })
        .limit(50)
    return data || []
}

export async function getAdminUnreadNotificationsCount(schoolId: string) {
    const ctx = await getMySchoolContext()
    if (!ctx || (ctx.school_id !== schoolId && ctx.role !== 'super_admin')) {
        return 0
    }
    const adminClient = createAdminClient()
    const { count } = await adminClient
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', ctx.user_id)
        .eq('is_read', false)
    return count || 0
}
