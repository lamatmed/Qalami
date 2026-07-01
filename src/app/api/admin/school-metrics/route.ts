import { NextResponse } from 'next/server'
import { getMySchoolContext } from '@/app/admin/actions'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const schoolId = searchParams.get('schoolId')

    if (!schoolId) {
        return NextResponse.json({ error: 'schoolId required' }, { status: 400 })
    }

    const ctx = await getMySchoolContext()
    if (!ctx || (ctx.school_id !== schoolId && ctx.role !== 'super_admin')) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    const { count: studentCount } = await adminClient
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('role', 'student')

    const [
        { data: directTeachers },
        { data: assignedTeachers },
        { data: schoolLinkTeachers },
    ] = await Promise.all([
        adminClient.from('profiles').select('id').eq('school_id', schoolId).eq('role', 'teacher'),
        adminClient.from('teacher_assignments').select('teacher_id, classes!inner(school_id)').eq('classes.school_id', schoolId),
        adminClient.from('profile_schools').select('profile_id').eq('school_id', schoolId).eq('role', 'teacher'),
    ])

    const uniqueTeacherIds = new Set([
        ...(directTeachers || []).map((t: any) => t.id),
        ...(assignedTeachers || []).map((t: any) => t.teacher_id),
        ...(schoolLinkTeachers || []).map((t: any) => t.profile_id),
    ])

    return NextResponse.json({
        students: studentCount || 0,
        teachers: uniqueTeacherIds.size,
        parents: 0,
    })
}
