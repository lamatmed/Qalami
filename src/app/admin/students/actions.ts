'use server'

import { getActionContext } from '@/lib/auth-action'
import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'

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

    logActivity({ actorId: ctx.userId, schoolId: school_id, action: 'assign_student', entityType: 'student', entityId: studentId, details: `Élève affecté à la classe: ${classData.name}` })
    revalidatePath(`/admin/students/${studentId}`)
    revalidatePath('/admin/students')
    return { success: true, className: classData.name }
}

export async function removeStudentFromClass(studentId: string, classId: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { supabase, schoolId: school_id } = ctx

    const { error } = await supabase
        .from('enrollments')
        .delete()
        .eq('student_id', studentId)
        .eq('class_id', classId)
        .eq('school_id', school_id)
        .eq('status', 'active')

    if (error) return { error: error.message }

    logActivity({ actorId: ctx.userId, schoolId: school_id, action: 'remove_student_from_class', entityType: 'student', entityId: studentId, details: `Élève retiré de la classe ${classId}` })
    revalidatePath('/admin/students')
    return { success: true }
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

    if (created > 0) logActivity({ actorId: ctx.userId, schoolId, action: 'bulk_import_students', entityType: 'student', entityId: schoolId, details: `Import en masse: ${created} élève(s) créé(s)${errors.length > 0 ? `, ${errors.length} erreur(s)` : ''}` })
    revalidatePath('/admin/students')
    return { created, errors }
}

export async function assignParentsToStudent(studentId: string, parentIds: string[]) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { userId, schoolId } = ctx
    const adminClient = createAdminClient()

    // 1. Delete all existing parent-student links for this student
    const { error: deleteError } = await adminClient
        .from('parent_student_links')
        .delete()
        .eq('student_id', studentId)

    if (deleteError) {
        console.error('Error deleting student parent links:', deleteError)
        return { error: deleteError.message }
    }

    // 2. Insert new parent-student links (supports up to 2 parents)
    for (let i = 0; i < parentIds.length; i++) {
        const parentId = parentIds[i]
        const { error: linkError } = await adminClient
            .from('parent_student_links')
            .insert({
                parent_id: parentId,
                student_id: studentId,
                relationship: 'parent',
                is_primary: i === 0,
            })
        if (linkError) {
            console.error('Parent link error:', linkError)
            return { error: linkError.message }
        }
    }

    logActivity({
        actorId: userId,
        schoolId,
        action: 'assign_parents',
        entityType: 'student',
        entityId: studentId,
        details: `${parentIds.length} parent(s) affecté(s) à l'élève`,
    })
    revalidatePath(`/admin/students/${studentId}`)
    revalidatePath('/admin/students')
    return { success: true }
}

export async function getTransferDestinationSchools() {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { schoolId } = ctx
    const adminClient = createAdminClient()
    
    const { data: schools, error } = await adminClient
        .from('schools')
        .select('id, name')
        .eq('is_active', true)
        .neq('id', schoolId)
        .order('name')
        
    if (error) return { error: error.message }
    return { schools: schools || [] }
}

export async function getClassesForSchool(targetSchoolId: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const adminClient = createAdminClient()
    
    const { data: classes, error } = await adminClient
        .from('classes')
        .select('id, name')
        .eq('school_id', targetSchoolId)
        .order('name')
        
    if (error) return { error: error.message }
    return { classes: classes || [] }
}

export async function transferStudentToSchool(studentId: string, targetSchoolId: string, targetClassId?: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { schoolId } = ctx
    const adminClient = createAdminClient()

    // 1. Verify student exists and belongs to the administrator's school
    const { data: student, error: studentErr } = await adminClient
        .from('profiles')
        .select('id, school_id, status')
        .eq('id', studentId)
        .eq('role', 'student')
        .single()

    if (studentErr || !student) {
        return { error: "Élève introuvable." }
    }
    if (student.school_id !== schoolId) {
        return { error: "Cet élève n'appartient pas à votre établissement." }
    }

    // 2. Update profiles.school_id to targetSchoolId
    const { error: updateProfileErr } = await adminClient
        .from('profiles')
        .update({ school_id: targetSchoolId, status: 'active', updated_at: new Date().toISOString() })
        .eq('id', studentId)

    if (updateProfileErr) {
        return { error: "Erreur lors de la mise à jour de la fiche élève : " + updateProfileErr.message }
    }

    // 3. Mark current active enrollments at the old school as 'transferred'
    const { error: updateEnrollmentErr } = await adminClient
        .from('enrollments')
        .update({ status: 'transferred' })
        .eq('student_id', studentId)
        .eq('school_id', schoolId)
        .eq('status', 'active')

    if (updateEnrollmentErr) {
        console.error("Warning: failed to update old enrollments status to transferred:", updateEnrollmentErr)
    }

    // 4. Update profile_schools link for old school to 'inactive'
    const { data: existingLinkOld } = await adminClient
        .from('profile_schools')
        .select('id')
        .eq('profile_id', studentId)
        .eq('school_id', schoolId)
        .eq('role', 'student')
        .maybeSingle()

    if (existingLinkOld) {
        await adminClient
            .from('profile_schools')
            .update({ status: 'inactive', is_primary: false, updated_at: new Date().toISOString() })
            .eq('id', existingLinkOld.id)
    } else {
        await adminClient
            .from('profile_schools')
            .insert({
                profile_id: studentId,
                school_id: schoolId,
                role: 'student',
                status: 'inactive',
                is_primary: false
            })
    }

    // 5. Update profile_schools link for target school to 'active'
    const { data: existingLinkNew } = await adminClient
        .from('profile_schools')
        .select('id')
        .eq('profile_id', studentId)
        .eq('school_id', targetSchoolId)
        .eq('role', 'student')
        .maybeSingle()

    if (existingLinkNew) {
        await adminClient
            .from('profile_schools')
            .update({ status: 'active', is_primary: true, updated_at: new Date().toISOString() })
            .eq('id', existingLinkNew.id)
    } else {
        await adminClient
            .from('profile_schools')
            .insert({
                profile_id: studentId,
                school_id: targetSchoolId,
                role: 'student',
                status: 'active',
                is_primary: true
            })
    }

    // 6. Create new enrollment in target class if specified
    if (targetClassId) {
        // Get target school's current academic year
        const { data: currentYear } = await adminClient
            .from('academic_years')
            .select('id')
            .eq('school_id', targetSchoolId)
            .eq('is_current', true)
            .single()

        const targetAcademicYearId = currentYear?.id ?? null

        const { error: insertEnrollmentErr } = await adminClient
            .from('enrollments')
            .insert({
                student_id: studentId,
                class_id: targetClassId,
                academic_year_id: targetAcademicYearId,
                school_id: targetSchoolId,
                status: 'active'
            })

        if (insertEnrollmentErr) {
            console.error("Warning: failed to create new enrollment in target class:", insertEnrollmentErr)
        }
    }

    logActivity({ actorId: ctx.userId, schoolId, action: 'transfer_student', entityType: 'student', entityId: studentId, details: `Élève transféré vers établissement ${targetSchoolId}` })
    revalidatePath(`/admin/students/${studentId}`)
    revalidatePath('/admin/students')
    return { success: true }
}

export async function revertStudentTransfer(studentId: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { schoolId } = ctx
    const adminClient = createAdminClient()

    // 1. Verify student exists and is currently linked to the administrator's school (as inactive/archived)
    const { data: student, error: studentErr } = await adminClient
        .from('profiles')
        .select('id, school_id, status')
        .eq('id', studentId)
        .eq('role', 'student')
        .single()

    if (studentErr || !student) {
        return { error: "Élève introuvable." }
    }
    if (student.school_id === schoolId) {
        return { error: "Cet élève est déjà actif dans votre établissement." }
    }

    const previousSchoolId = student.school_id

    // Verify they are actually linked to our school
    const { data: linkOld } = await adminClient
        .from('profile_schools')
        .select('id')
        .eq('profile_id', studentId)
        .eq('school_id', schoolId)
        .eq('role', 'student')
        .maybeSingle()

    if (!linkOld) {
        return { error: "Vous n'avez pas de lien avec cet élève pour annuler son transfert." }
    }

    // 2. Update profiles.school_id back to our school and status to 'active'
    const { error: updateProfileErr } = await adminClient
        .from('profiles')
        .update({ school_id: schoolId, status: 'active', updated_at: new Date().toISOString() })
        .eq('id', studentId)

    if (updateProfileErr) {
        return { error: "Erreur lors de la réactivation de la fiche élève : " + updateProfileErr.message }
    }

    // 3. Mark the latest 'transferred' enrollment at our school as 'active' again
    const { data: latestTransferredEnrollment } = await adminClient
        .from('enrollments')
        .select('id')
        .eq('student_id', studentId)
        .eq('school_id', schoolId)
        .eq('status', 'transferred')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (latestTransferredEnrollment) {
        await adminClient
            .from('enrollments')
            .update({ status: 'active' })
            .eq('id', latestTransferredEnrollment.id)
    }

    // 4. Mark active enrollments at the other school (if any) as 'transferred'
    if (previousSchoolId) {
        await adminClient
            .from('enrollments')
            .update({ status: 'transferred' })
            .eq('student_id', studentId)
            .eq('school_id', previousSchoolId)
            .eq('status', 'active')
    }

    // 5. Update profile_schools link for our school to 'active' and primary
    await adminClient
        .from('profile_schools')
        .update({ status: 'active', is_primary: true, updated_at: new Date().toISOString() })
        .eq('profile_id', studentId)
        .eq('school_id', schoolId)

    // 6. Update profile_schools link for the other school to 'inactive' and non-primary
    if (previousSchoolId) {
        await adminClient
            .from('profile_schools')
            .update({ status: 'inactive', is_primary: false, updated_at: new Date().toISOString() })
            .eq('profile_id', studentId)
            .eq('school_id', previousSchoolId)
    }

    revalidatePath(`/admin/students/${studentId}`)
    revalidatePath('/admin/students')
    return { success: true }
}

export async function deleteStudentPermanently(studentId: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { schoolId } = ctx
    const adminClient = createAdminClient()

    const { data: student } = await adminClient
        .from('profiles')
        .select('id')
        .eq('id', studentId)
        .eq('role', 'student')
        .eq('school_id', schoolId)
        .single()

    if (!student) return { error: 'Élève introuvable dans cet établissement' }

    await adminClient.from('enrollments').delete().eq('student_id', studentId)
    await adminClient.from('profile_schools').delete().eq('profile_id', studentId)

    const { error } = await adminClient.auth.admin.deleteUser(studentId)
    if (error) return { error: error.message }

    revalidatePath('/admin/students')
    return { success: true }
}

export async function updateStudentInfo(studentId: string, data: {
    full_name: string
    date_of_birth: string | null
    place_of_birth: string | null
    address: string | null
    gender: string | null
}) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { schoolId } = ctx
    const adminClient = createAdminClient()

    if (!data.full_name?.trim()) return { error: 'Le nom est obligatoire' }

    const { error } = await adminClient
        .from('profiles')
        .update({
            full_name: data.full_name.trim(),
            date_of_birth: data.date_of_birth || null,
            place_of_birth: data.place_of_birth?.trim() || null,
            address: data.address?.trim() || null,
            gender: data.gender || null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', studentId)
        .eq('school_id', schoolId)
        .eq('role', 'student')

    if (error) return { error: error.message }

    revalidatePath('/admin/students')
    return { success: true }
}

// ─── Attendance records with justification files ───────────────────────────────

export interface AttendanceWithFile {
    id: string
    date: string
    status: 'present' | 'absent' | 'late' | 'excused'
    justified: boolean
    justification_note: string | null
    justification_file_url: string | null
    subjects: { name: string } | null
    recorder: { full_name: string | null } | null
}

export async function getStudentAttendanceWithFiles(
    studentId: string,
    schoolId: string
): Promise<AttendanceWithFile[]> {
    const admin = createAdminClient()

    // Try with justification_file_url column, fallback without
    let records: any[] = []

    const { data: withCol, error: colErr } = await admin
        .from('attendance')
        .select(`
            id, date, status, justified, justification_note, justification_file_url,
            subjects ( name ),
            recorder:profiles!attendance_recorded_by_fkey ( full_name ),
            classes!inner ( school_id )
        `)
        .eq('student_id', studentId)
        .eq('classes.school_id', schoolId)
        .neq('status', 'present')
        .order('date', { ascending: false })

    if (colErr) {
        const { data: withoutCol } = await admin
            .from('attendance')
            .select(`
                id, date, status, justified, justification_note,
                subjects ( name ),
                recorder:profiles!attendance_recorded_by_fkey ( full_name ),
                classes!inner ( school_id )
            `)
            .eq('student_id', studentId)
            .eq('classes.school_id', schoolId)
            .neq('status', 'present')
            .order('date', { ascending: false })
        records = (withoutCol || []).map((r: any) => ({ ...r, justification_file_url: null }))
    } else {
        records = withCol || []
    }

    // Match by attendance ID in path only (bucket file matching is handled separately via getAllJustificationFiles)
    const BUCKET = 'attendance-justifications'
    const bucketFileMap: Record<string, string> = {}

    const { data: studentFolderFiles } = await admin.storage
        .from(BUCKET)
        .list(studentId, { limit: 1000 })

    for (const f of studentFolderFiles || []) {
        if (f.name === '.emptyFolderPlaceholder' || !f.id) continue
        const fullPath = `${studentId}/${f.name}`
        const matched = records.find((r: any) => !bucketFileMap[r.id] && fullPath.includes(r.id))
        if (matched) {
            const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(fullPath, 3600)
            if (signed?.signedUrl) bucketFileMap[matched.id] = signed.signedUrl
        }
    }

    return records.map((r: any) => ({
        id: r.id,
        date: r.date,
        status: r.status,
        justified: r.justified,
        justification_note: r.justification_note,
        justification_file_url: r.justification_file_url || bucketFileMap[r.id] || null,
        subjects: r.subjects,
        recorder: r.recorder,
    }))
}

// ─── List all justification files for a student from the bucket ────────────────

export interface JustificationFile {
    name: string
    publicUrl: string
    createdAt: string | null
}

export async function getAllJustificationFiles(studentId: string): Promise<JustificationFile[]> {
    const admin = createAdminClient()
    const BUCKET = 'attendance-justifications'
    const results: JustificationFile[] = []

    const collectFiles = async (prefix: string | undefined) => {
        const { data: items } = await admin.storage
            .from(BUCKET)
            .list(prefix, { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } })

        for (const item of items || []) {
            if (item.name === '.emptyFolderPlaceholder') continue
            const fullPath = prefix ? `${prefix}/${item.name}` : item.name
            if (!item.id) {
                // folder — recurse one level
                await collectFiles(fullPath)
            } else {
                // Bucket is private — use signed URL (valid 1 hour)
                const { data: signed } = await admin.storage
                    .from(BUCKET)
                    .createSignedUrl(fullPath, 3600)
                if (signed?.signedUrl) {
                    results.push({
                        name: item.name,
                        publicUrl: signed.signedUrl,
                        createdAt: item.created_at ?? null,
                    })
                }
            }
        }
    }

    // Try both studentId subfolder and root level
    await Promise.all([collectFiles(studentId), collectFiles(undefined)])

    // Deduplicate by file name
    const seen = new Set<string>()
    return results.filter(f => {
        if (seen.has(f.name)) return false
        seen.add(f.name)
        return true
    })
}

export async function transferStudentExternally(studentId: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { schoolId } = ctx
    const adminClient = createAdminClient()

    // 1. Verify student exists and belongs to the administrator's school
    const { data: student, error: studentErr } = await adminClient
        .from('profiles')
        .select('id, school_id, status')
        .eq('id', studentId)
        .eq('role', 'student')
        .single()

    if (studentErr || !student) {
        return { error: "Élève introuvable." }
    }
    if (student.school_id !== schoolId) {
        return { error: "Cet élève n'appartient pas à votre établissement." }
    }

    // 2. Update profiles status to 'inactive'
    const { error: updateProfileErr } = await adminClient
        .from('profiles')
        .update({ status: 'inactive', updated_at: new Date().toISOString() })
        .eq('id', studentId)

    if (updateProfileErr) {
        return { error: "Erreur lors de la mise à jour de la fiche élève : " + updateProfileErr.message }
    }

    // 3. Mark current active enrollments at the school as 'transferred'
    const { error: updateEnrollmentErr } = await adminClient
        .from('enrollments')
        .update({ status: 'transferred' })
        .eq('student_id', studentId)
        .eq('school_id', schoolId)
        .eq('status', 'active')

    if (updateEnrollmentErr) {
        console.error("Warning: failed to update enrollments status to transferred:", updateEnrollmentErr)
    }

    logActivity({ actorId: ctx.userId, schoolId, action: 'transfer_student_external', entityType: 'student', entityId: studentId, details: `Élève transféré (départ externe)` })
    revalidatePath(`/admin/students/${studentId}`)
    revalidatePath('/admin/students')
    return { success: true }
}

export async function reintegrateExternalStudent(studentId: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { schoolId } = ctx
    const adminClient = createAdminClient()

    // 1. Verify student exists and belongs to the administrator's school
    const { data: student, error: studentErr } = await adminClient
        .from('profiles')
        .select('id, school_id, status')
        .eq('id', studentId)
        .eq('role', 'student')
        .single()

    if (studentErr || !student) {
        return { error: "Élève introuvable." }
    }
    if (student.school_id !== schoolId) {
        return { error: "Cet élève n'appartient pas à votre établissement." }
    }

    // 2. Update profiles status back to 'active'
    const { error: updateProfileErr } = await adminClient
        .from('profiles')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', studentId)

    if (updateProfileErr) {
        return { error: "Erreur lors de la réactivation de la fiche élève : " + updateProfileErr.message }
    }

    // 3. Mark the latest 'transferred' enrollment at our school as 'active' again
    const { data: latestTransferredEnrollment } = await adminClient
        .from('enrollments')
        .select('id')
        .eq('student_id', studentId)
        .eq('school_id', schoolId)
        .eq('status', 'transferred')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (latestTransferredEnrollment) {
        const { error: updateEnrollmentErr } = await adminClient
            .from('enrollments')
            .update({ status: 'active' })
            .eq('id', latestTransferredEnrollment.id)
        if (updateEnrollmentErr) {
            return { error: "Erreur lors de la réactivation de l'inscription : " + updateEnrollmentErr.message }
        }
    }

    logActivity({ actorId: ctx.userId, schoolId, action: 'reintegrate_student', entityType: 'student', entityId: studentId, details: `Élève réintégré (annulation transfert)` })
    revalidatePath(`/admin/students/${studentId}`)
    revalidatePath('/admin/students')
    return { success: true }
}
