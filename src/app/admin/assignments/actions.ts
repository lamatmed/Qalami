'use server'

import { getActionContext } from '@/lib/auth-action'
import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// ─── Upsert (assign or move/replace) ─────────────────────────────────────────

export async function upsertAssignment(
    teacherId: string,
    classId: string,
    subjectId: string,
    removeId?: string,
): Promise<{ success?: boolean; id?: string; error?: string }> {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { schoolId } = ctx
    const db = createAdminClient()

    // 1. Remove source assignment (move / change-teacher)
    if (removeId) {
        await db.from('teacher_assignments').delete().eq('id', removeId)
    }

    // 2. Clear any existing assignment at the target cell
    await db
        .from('teacher_assignments')
        .delete()
        .eq('class_id', classId)
        .eq('subject_id', subjectId)

    // 3. Insert the new assignment
    const { data, error } = await db
        .from('teacher_assignments')
        .insert({ teacher_id: teacherId, class_id: classId, subject_id: subjectId })
        .select('id')
        .single()

    if (error) return { error: error.message }

    // 4. Sync class_subjects
    await db
        .from('class_subjects')
        .upsert(
            { class_id: classId, subject_id: subjectId, school_id: schoolId },
            { onConflict: 'class_id,subject_id' },
        )

    revalidatePath('/admin/assignments')
    return { success: true, id: data.id }
}

// ─── Remove assignment (with auth) ───────────────────────────────────────────

export async function removeAssignment(id: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { schoolId } = ctx
    const db = createAdminClient()

    // Verify the assignment belongs to this school before deleting
    const { data: assignment } = await db
        .from('teacher_assignments')
        .select('id, class_id, classes!teacher_assignments_class_id_fkey(school_id)')
        .eq('id', id)
        .single()

    if (!assignment) return { error: 'Affectation introuvable' }

    const assignmentSchoolId = (assignment.classes as any)?.school_id
    if (assignmentSchoolId !== schoolId) return { error: 'Accès non autorisé' }

    const { error } = await db
        .from('teacher_assignments')
        .delete()
        .eq('id', id)

    if (error) return { error: error.message }

    revalidatePath('/admin/assignments')
    return { success: true }
}

// ─── Assign teacher (form action) ────────────────────────────────────────────

const AssignmentSchema = z.object({
    teacher_id: z.string().uuid('Enseignant invalide'),
    class_id:   z.string().uuid('Classe invalide'),
    subject_id: z.string().uuid('Matière invalide'),
})

export async function assignTeacher(formData: FormData) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { schoolId } = ctx
    const db = createAdminClient()

    const result = AssignmentSchema.safeParse({
        teacher_id: formData.get('teacher_id'),
        class_id:   formData.get('class_id'),
        subject_id: formData.get('subject_id'),
    })
    if (!result.success) return { error: result.error.errors[0].message }

    const { teacher_id, class_id, subject_id } = result.data

    const { error } = await db
        .from('teacher_assignments')
        .insert({ teacher_id, class_id, subject_id })

    if (error) return { error: error.message }

    await db
        .from('class_subjects')
        .upsert(
            { class_id, subject_id, school_id: schoolId },
            { onConflict: 'class_id,subject_id' },
        )

    revalidatePath('/admin/assignments')
    revalidatePath('/admin/classes')
    return { success: true }
}
