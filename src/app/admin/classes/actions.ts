'use server'

import { getActionContext } from '@/lib/auth-action'
import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { logActivity } from '@/lib/activity-log'

const ClassSchema = z.object({
    name:     z.string().min(1, 'Le nom est requis'),
    level_id: z.string().uuid().optional(),
})

export async function createClass(formData: FormData) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { schoolId } = ctx
    const db = createAdminClient()

    const name     = formData.get('name') as string
    const level_id = formData.get('level_id') as string | null

    const result = ClassSchema.safeParse({ name, level_id: level_id || undefined })
    if (!result.success) return { error: result.error.errors[0].message }

    const { error } = await db.from('classes').insert({
        name,
        level_id: level_id || null,
        school_id: schoolId,
    })

    if (error) return { error: error.message }

    logActivity({ actorId: ctx.userId, schoolId, action: 'create_class', entityType: 'class', entityId: schoolId, details: `Classe créée: ${name}` })
    revalidatePath('/admin/classes')
    return { success: true }
}

export async function createLevel(nameFr: string, nameAr: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { schoolId } = ctx
    const db = createAdminClient()

    const { data, error } = await db
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
    const { schoolId } = ctx
    const db = createAdminClient()

    const { data: classes } = await db
        .from('classes')
        .select('id')
        .eq('level_id', levelId)
        .eq('school_id', schoolId)

    const classIds = (classes ?? []).map((c: any) => c.id)

    if (classIds.length > 0) {
        await Promise.all([
            db.from('enrollments').delete().in('class_id', classIds),
            db.from('class_subjects').delete().in('class_id', classIds),
            db.from('teacher_assignments').delete().in('class_id', classIds),
            db.from('schedule').delete().in('class_id', classIds),
        ])
        await db.from('classes').delete().in('id', classIds).eq('school_id', schoolId)
    }

    const { error } = await db
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
    const { schoolId } = ctx
    const db = createAdminClient()

    if (!data.name?.trim()) return { error: 'Le nom de la classe est requis' }

    const { error } = await db
        .from('classes')
        .update({ name: data.name.trim(), ...(data.capacity ? { capacity: data.capacity } : {}) })
        .eq('id', classId)
        .eq('school_id', schoolId)

    if (error) return { error: error.message }

    logActivity({ actorId: ctx.userId, schoolId, action: 'update_class', entityType: 'class', entityId: classId, details: `Classe modifiée: ${data.name}` })
    revalidatePath('/admin/classes')
    return { success: true }
}

export async function deleteClass(classId: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { schoolId } = ctx
    const db = createAdminClient()

    await Promise.all([
        db.from('enrollments').delete().eq('class_id', classId),
        db.from('class_subjects').delete().eq('class_id', classId),
        db.from('teacher_assignments').delete().eq('class_id', classId),
        db.from('schedule').delete().eq('class_id', classId).eq('school_id', schoolId),
    ])

    const { error } = await db
        .from('classes')
        .delete()
        .eq('id', classId)
        .eq('school_id', schoolId)

    if (error) return { error: error.message }

    logActivity({ actorId: ctx.userId, schoolId, action: 'delete_class', entityType: 'class', entityId: classId, details: `Classe supprimée (id: ${classId})` })
    revalidatePath('/admin/classes')
    return { success: true }
}
