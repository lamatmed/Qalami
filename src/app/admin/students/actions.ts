'use server'

import { getActionContext } from '@/lib/auth-action'
import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function assignStudentToClass(studentId: string, classId: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { supabase, schoolId: school_id } = ctx

    // Verify the class belongs to this school
    const { data: classData } = await supabase
        .from('classes')
        .select('id, name')
        .eq('id', classId)
        .eq('school_id', school_id)
        .single()

    if (!classData) return { error: 'Classe introuvable' }

    // Get current academic year (if set)
    const { data: currentYear } = await supabase
        .from('academic_years')
        .select('id')
        .eq('school_id', school_id)
        .eq('is_current', true)
        .single()

    const academicYearId = currentYear?.id ?? null

    // Check if student already has an active enrollment
    const { data: existing } = await supabase
        .from('enrollments')
        .select('id')
        .eq('student_id', studentId)
        .eq('status', 'active')
        .maybeSingle()

    if (existing) {
        const { error } = await supabase
            .from('enrollments')
            .update({ class_id: classId, academic_year_id: academicYearId })
            .eq('id', existing.id)
        if (error) return { error: error.message }
    } else {
        const { error } = await supabase
            .from('enrollments')
            .insert({
                student_id:       studentId,
                class_id:         classId,
                academic_year_id: academicYearId,
                school_id:        school_id,
                status:           'active',
            })
        if (error) return { error: error.message }
    }

    revalidatePath(`/admin/students/${studentId}`)
    revalidatePath('/admin/students')
    return { success: true, className: classData.name }
}

// ─── Bulk import from CSV ─────────────────────────────────────────────────────

interface ImportRow {
    firstName: string
    lastName: string
    gender: string
    dateOfBirth: string
    classId: string | null
}

export async function bulkImportStudents(rows: ImportRow[]): Promise<{
    created?: number
    errors?: string[]
    error?: string
}> {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { supabase, schoolId } = ctx
    const adminClient = createAdminClient()

    const { data: currentYear } = await supabase
        .from('academic_years')
        .select('id')
        .eq('school_id', schoolId)
        .eq('is_current', true)
        .single()
    const academicYearId = currentYear?.id ?? null

    let created = 0
    const errors: string[] = []

    for (const row of rows) {
        const fullName = `${row.firstName.trim()} ${row.lastName.trim()}`
        const pin = String(Math.floor(1000 + Math.random() * 9000))
        const email = `student_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@qalami.local`

        const { data: authUser, error: authErr } = await adminClient.auth.admin.createUser({
            email,
            password: pin,
            email_confirm: true,
            user_metadata: { full_name: fullName, role: 'student' },
        })

        if (authErr) {
            errors.push(`${fullName} : ${authErr.message}`)
            continue
        }

        const { error: profileErr } = await adminClient.from('profiles').upsert({
            id: authUser.user.id,
            email,
            full_name: fullName,
            role: 'student',
            school_id: schoolId,
            gender: row.gender || null,
            date_of_birth: row.dateOfBirth || null,
            status: 'active',
        })

        if (profileErr) {
            errors.push(`${fullName} : ${profileErr.message}`)
            continue
        }

        if (row.classId) {
            await adminClient.from('enrollments').insert({
                student_id: authUser.user.id,
                class_id: row.classId,
                academic_year_id: academicYearId,
                school_id: schoolId,
                status: 'active',
            })
        }

        created++
    }

    revalidatePath('/admin/students')
    return { created, errors }
}
