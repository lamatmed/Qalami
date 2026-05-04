'use server'

import { getActionContext } from '@/lib/auth-action'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const ClassSchema = z.object({
    name:     z.string().min(1, 'Le nom est requis'),
    level_id: z.string().uuid().optional(),
})

export async function createClass(formData: FormData) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { supabase, schoolId } = ctx

    const name     = formData.get('name') as string
    const level_id = formData.get('level_id') as string | null

    const result = ClassSchema.safeParse({ name, level_id: level_id || undefined })
    if (!result.success) return { error: result.error.errors[0].message }

    const { error } = await supabase.from('classes').insert({
        name,
        level_id: level_id || null,
        school_id: schoolId,
    })

    if (error) return { error: error.message }

    revalidatePath('/admin/classes')
    return { success: true }
}

export async function createLevel(nameFr: string, nameAr: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { supabase, schoolId } = ctx

    const { data, error } = await supabase
        .from('levels')
        .insert({ name_fr: nameFr, name_ar: nameAr, school_id: schoolId })
        .select('id')
        .single()

    if (error) return { error: error.message }

    revalidatePath('/admin/classes')
    return { success: true, id: data.id }
}

export async function deleteLevel(levelId: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { supabase, schoolId } = ctx

    // 1. Get all classes in this level
    const { data: classes } = await supabase
        .from('classes')
        .select('id')
        .eq('level_id', levelId)
        .eq('school_id', schoolId)

    const classIds = (classes ?? []).map(c => c.id)

    if (classIds.length > 0) {
        await Promise.all([
            supabase.from('enrollments').delete().in('class_id', classIds),
            supabase.from('class_subjects').delete().in('class_id', classIds),
            supabase.from('teacher_assignments').delete().in('class_id', classIds),
            // Correct table name: schedule (not schedule_slots)
            supabase.from('schedule').delete().in('class_id', classIds),
        ])

        await supabase
            .from('classes')
            .delete()
            .in('id', classIds)
            .eq('school_id', schoolId)
    }

    const { error } = await supabase
        .from('levels')
        .delete()
        .eq('id', levelId)
        .eq('school_id', schoolId)

    if (error) return { error: error.message }

    revalidatePath('/admin/classes')
    return { success: true }
}

export async function updateClass(classId: string, data: { name: string; capacity?: number }) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { supabase, schoolId } = ctx

    if (!data.name?.trim()) return { error: 'Le nom de la classe est requis' }

    const { error } = await supabase
        .from('classes')
        .update({ name: data.name.trim(), ...(data.capacity ? { capacity: data.capacity } : {}) })
        .eq('id', classId)
        .eq('school_id', schoolId)

    if (error) return { error: error.message }

    revalidatePath('/admin/classes')
    return { success: true }
}

export async function deleteClass(classId: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { supabase, schoolId } = ctx

    // Cascade deletes in parallel — correct table name: schedule (not schedule_slots)
    await Promise.all([
        supabase.from('enrollments').delete().eq('class_id', classId),
        supabase.from('class_subjects').delete().eq('class_id', classId),
        supabase.from('teacher_assignments').delete().eq('class_id', classId),
        supabase.from('schedule').delete().eq('class_id', classId).eq('school_id', schoolId),
    ])

    const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', classId)
        .eq('school_id', schoolId)

    if (error) return { error: error.message }

    revalidatePath('/admin/classes')
    return { success: true }
}
