'use server'

import { getActionContext } from '@/lib/auth-action'
import { revalidatePath } from 'next/cache'

function padTime(t: string): string {
    const trimmed = t.trim()
    if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
        const [h, m] = trimmed.split(':')
        return `${h.padStart(2, '0')}:${m}:00`
    }
    return trimmed
}

// ─── Copy schedule ─────────────────────────────────────────────────────────────

export async function copySchedule(sourceClassId: string, targetClassId: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { supabase, schoolId } = ctx

    const { data: rows, error: fetchError } = await supabase
        .from('schedule')
        .select('day_of_week, start_time, end_time, room, session_type, subject_id, teacher_id')
        .eq('school_id', schoolId)
        .eq('class_id', sourceClassId)

    if (fetchError) return { error: fetchError.message }
    if (!rows || rows.length === 0) return { error: 'Aucun cours dans la classe source' }

    await supabase
        .from('schedule')
        .delete()
        .eq('school_id', schoolId)
        .eq('class_id', targetClassId)

    const newRows = rows.map(r => ({
        ...r,
        school_id: schoolId,
        class_id: targetClassId,
    }))

    const { error: insertError } = await supabase.from('schedule').insert(newRows)
    if (insertError) return { error: insertError.message }

    revalidatePath('/admin/schedule')
    return { success: true, count: rows.length }
}

// ─── Import schedule from CSV ──────────────────────────────────────────────────

export interface ImportRow {
    classe: string
    jour: number
    heure_debut: string
    heure_fin: string
    matiere: string
    enseignant: string
    salle?: string
    type_seance?: string
}

export async function importSchedule(rows: ImportRow[]) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { supabase, schoolId } = ctx

    const [{ data: classes }, { data: subjects }, { data: teachers }] = await Promise.all([
        supabase.from('classes').select('id, name').eq('school_id', schoolId),
        supabase.from('subjects').select('id, name').eq('school_id', schoolId),
        supabase.from('profiles').select('id, full_name').eq('school_id', schoolId).eq('role', 'teacher'),
    ])

    const classMap   = new Map((classes  ?? []).map(c => [c.name.toLowerCase().trim(), c.id]))
    const subjectMap = new Map((subjects ?? []).map(s => [s.name.toLowerCase().trim(), s.id]))
    const teacherMap = new Map((teachers ?? []).map(t => [(t.full_name ?? '').toLowerCase().trim(), t.id]))

    interface ScheduleInsert {
        school_id: string; class_id: string; subject_id: string; teacher_id: string
        day_of_week: number; start_time: string; end_time: string
        room: string | null; session_type: string
    }
    const toInsert: ScheduleInsert[] = []
    const errors: { row: number; reason: string }[] = []

    rows.forEach((row, i) => {
        const classId   = classMap.get(row.classe.toLowerCase().trim())
        const subjectId = subjectMap.get(row.matiere.toLowerCase().trim())
        const teacherId = teacherMap.get(row.enseignant.toLowerCase().trim())

        if (!classId)   { errors.push({ row: i + 2, reason: `Classe introuvable: "${row.classe}"` });      return }
        if (!subjectId) { errors.push({ row: i + 2, reason: `Matière introuvable: "${row.matiere}"` });    return }
        if (!teacherId) { errors.push({ row: i + 2, reason: `Enseignant introuvable: "${row.enseignant}"` }); return }

        toInsert.push({
            school_id:    schoolId,
            class_id:     classId,
            subject_id:   subjectId,
            teacher_id:   teacherId,
            day_of_week:  row.jour,
            start_time:   padTime(row.heure_debut),
            end_time:     padTime(row.heure_fin),
            room:         row.salle || null,
            session_type: row.type_seance || 'course',
        })
    })

    if (toInsert.length === 0) return { error: 'Aucune ligne valide', errors }

    const { error: insertError } = await supabase.from('schedule').insert(toInsert)
    if (insertError) return { error: insertError.message }

    revalidatePath('/admin/schedule')
    return { success: true, count: toInsert.length, errors }
}
