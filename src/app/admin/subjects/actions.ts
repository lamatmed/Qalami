'use server'

import { getActionContext } from '@/lib/auth-action'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const SubjectSchema = z.object({
    name: z.string().min(1, 'Le nom est requis'),
    icon: z.string().max(10).optional(),
})

export async function createSubject(formData: FormData) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { supabase, schoolId } = ctx

    const result = SubjectSchema.safeParse({
        name: formData.get('name'),
        icon: (formData.get('icon') as string) || undefined,
    })
    if (!result.success) return { error: result.error.errors[0].message }

    const { error } = await supabase.from('subjects').insert({
        name: result.data.name,
        icon: result.data.icon || null,
        school_id: schoolId,
    })

    if (error) return { error: error.message }

    revalidatePath('/admin/subjects')
    return { success: true }
}

export async function updateSubject(subjectId: string, formData: FormData) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { supabase, schoolId } = ctx

    const result = SubjectSchema.safeParse({
        name: formData.get('name'),
        icon: (formData.get('icon') as string) || undefined,
    })
    if (!result.success) return { error: result.error.errors[0].message }

    const { error } = await supabase
        .from('subjects')
        .update({ name: result.data.name, icon: result.data.icon || null })
        .eq('id', subjectId)
        .eq('school_id', schoolId)

    if (error) return { error: error.message }

    revalidatePath('/admin/subjects')
    return { success: true }
}

export async function upsertSubjectCoefficient(subjectId: string, classId: string, coefficient: number) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { supabase, schoolId } = ctx

    const { data: existing } = await supabase
        .from('subject_coefficients')
        .select('id')
        .eq('subject_id', subjectId)
        .eq('class_id', classId)
        .eq('school_id', schoolId)
        .maybeSingle()

    if (existing) {
        const { error } = await supabase
            .from('subject_coefficients')
            .update({ coefficient })
            .eq('id', existing.id)
        if (error) return { error: error.message }
    } else {
        const { error } = await supabase
            .from('subject_coefficients')
            .insert({ subject_id: subjectId, class_id: classId, school_id: schoolId, coefficient })
        if (error) return { error: error.message }
    }

    return { success: true }
}

export async function addSubjectToClass(classId: string, subjectId: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { supabase, schoolId } = ctx

    const { error } = await supabase
        .from('class_subjects')
        .insert({ class_id: classId, subject_id: subjectId, school_id: schoolId })

    if (error) return { error: error.message }

    revalidatePath('/admin/classes')
    return { success: true }
}

export async function removeSubjectFromClass(classId: string, subjectId: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { supabase, schoolId } = ctx

    const { error } = await supabase
        .from('class_subjects')
        .delete()
        .eq('class_id', classId)
        .eq('subject_id', subjectId)
        .eq('school_id', schoolId)

    if (error) return { error: error.message }

    revalidatePath('/admin/classes')
    return { success: true }
}

export async function deleteSubject(subjectId: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { supabase, schoolId } = ctx

    const { error } = await supabase
        .from('subjects')
        .delete()
        .eq('id', subjectId)
        .eq('school_id', schoolId)

    if (error) return { error: error.message }

    revalidatePath('/admin/subjects')
    return { success: true }
}
