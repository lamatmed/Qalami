'use server'

import { getActionContext } from '@/lib/auth-action'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'

export interface ScheduleTeacherOption {
    id: string
    full_name: string
    subjects: string[]
    phone: string | null
}

function teacherDisplayName(fullName: string | null | undefined, email: string | null | undefined): string {
    const n = (fullName ?? '').trim()
    if (n) return n
    const e = (email ?? '').trim()
    if (e) return e.includes('@') ? e.split('@')[0]! : e
    return 'Enseignant'
}

/** Liste des enseignants pour /admin/schedule (vue par enseignant) — union admin, hors RLS client. */
export async function fetchTeachersForSchedule(): Promise<{
    teachers: ScheduleTeacherOption[]
    error?: string
}> {
    const ctx = await getActionContext()
    if (!ctx) return { teachers: [], error: 'Non authentifié' }

    const { schoolId } = ctx
    const admin = createAdminClient()

    const [{ data: directT }, { data: assignedRows }, { data: schoolLinks }] = await Promise.all([
        admin.from('profiles').select('id').eq('school_id', schoolId).eq('role', 'teacher'),
        admin
            .from('teacher_assignments')
            .select('teacher_id, classes!inner(school_id)')
            .eq('classes.school_id', schoolId),
        admin.from('profile_schools').select('profile_id').eq('school_id', schoolId).eq('role', 'teacher'),
    ])

    const allTeacherIds = [
        ...new Set([
            ...(directT || []).map(p => p.id),
            ...(assignedRows || []).map((r: { teacher_id: string }) => r.teacher_id),
            ...(schoolLinks || []).map(r => r.profile_id),
        ]),
    ]

    if (allTeacherIds.length === 0) return { teachers: [] }

    // Pas de .eq('role','teacher') ici : les IDs viennent déjà des affectations / liens école ;
    // certains profils peuvent avoir un rôle applicatif différent tout en enseignant.
    const [{ data: profiles }, { data: assignData }] = await Promise.all([
        admin
            .from('profiles')
            .select('id, full_name, email, phone')
            .in('id', allTeacherIds)
            .order('full_name'),
        admin
            .from('teacher_assignments')
            .select('teacher_id, subjects(name)')
            .in('teacher_id', allTeacherIds),
    ])

    const subjectsByTeacher = new Map<string, string[]>()
    ;(assignData || []).forEach((a: { teacher_id: string; subjects?: Array<{ name?: string | null }> | { name?: string | null } | null }) => {
        const subj = a.subjects
        const name = Array.isArray(subj) ? subj[0]?.name : subj?.name
        if (!name) return
        const list = subjectsByTeacher.get(a.teacher_id) || []
        if (!list.includes(name)) list.push(name)
        subjectsByTeacher.set(a.teacher_id, list)
    })

    const byId = new Map((profiles || []).map(p => [p.id, p]))
    const teachers: ScheduleTeacherOption[] = allTeacherIds
        .map(id => {
            const p = byId.get(id)
            if (!p) return null
            return {
                id: p.id,
                full_name: teacherDisplayName(p.full_name, p.email),
                subjects: subjectsByTeacher.get(p.id) || [],
                phone: p.phone || null,
            }
        })
        .filter((x): x is ScheduleTeacherOption => x !== null)
        .sort((a, b) => a.full_name.localeCompare(b.full_name, 'fr', { sensitivity: 'base' }))

    return { teachers }
}

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

export interface ScheduleFetchInput {
    classId?: string
    teacherId?: string
    startStr: string
    endStr: string
}

export async function fetchScheduleForAdmin(input: ScheduleFetchInput) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { schoolId } = ctx
    const admin = createAdminClient()

    let query = admin
        .from('schedule')
        .select(`
            id, day_of_week, start_time, end_time, room, session_type,
            teacher_id, class_id, school_id, is_recurring, event_date,
            subjects!schedule_subject_id_fkey(name),
            profiles!schedule_teacher_id_fkey(full_name, email, phone),
            classes!schedule_class_id_fkey(name),
            schools!schedule_school_id_fkey(name)
        `)
        .or(`is_recurring.eq.true,and(event_date.gte.${input.startStr},event_date.lt.${input.endStr})`)

    if (input.classId) {
        query = query.eq('school_id', schoolId).eq('class_id', input.classId)
    } else if (input.teacherId) {
        // For teacher view, fetch across all schools to show complete unavailability
        query = query.eq('teacher_id', input.teacherId)
    } else {
        query = query.eq('school_id', schoolId)
    }

    const { data, error } = await query.order('day_of_week', { ascending: true })
    if (error) {
        console.error('Error fetching schedule via admin client:', error.message)
        return { error: error.message }
    }

    // Extract teacher IDs that appear in the current view's schedule to check conflicts across all schools
    const teacherIds = [...new Set((data || []).map(slot => slot.teacher_id).filter(Boolean))]

    let allSlots: any[] = []
    if (teacherIds.length > 0) {
        const { data: fetchedSlots } = await admin
            .from('schedule')
            .select('teacher_id, day_of_week, start_time')
            .in('teacher_id', teacherIds)
            .or(`is_recurring.eq.true,and(event_date.gte.${input.startStr},event_date.lt.${input.endStr})`)
        allSlots = fetchedSlots || []
    }

    return {
        schedule: data || [],
        allSlots: allSlots || [],
        currentSchoolId: schoolId
    }
}

export interface OccupiedTeacherInfo {
    teacherId: string
    schoolId: string
    schoolName: string
    className: string
    isRecurring: boolean
    eventDate: string | null
}

export async function fetchOccupiedTeachersForSlot(input: {
    dayIndex: number
    startTime: string
    endTime: string
}): Promise<{ occupied: OccupiedTeacherInfo[], error?: string }> {
    const ctx = await getActionContext()
    if (!ctx) return { occupied: [], error: 'Non authentifié' }

    const admin = createAdminClient()

    // Find any schedule overlapping the provided time slot across all schools
    const { data, error } = await admin
        .from('schedule')
        .select(`
            teacher_id,
            school_id,
            is_recurring,
            event_date,
            schools!schedule_school_id_fkey(name),
            classes!schedule_class_id_fkey(name)
        `)
        .eq('day_of_week', input.dayIndex)
        .lt('start_time', input.endTime)
        .gt('end_time', input.startTime)

    if (error) {
        console.error('Error fetching occupied teachers:', error.message)
        return { occupied: [], error: error.message }
    }

    const occupied: OccupiedTeacherInfo[] = (data || []).map((row: any) => ({
        teacherId: row.teacher_id,
        schoolId: row.school_id,
        schoolName: row.schools?.name || 'Autre école',
        className: row.classes?.name || 'Autre classe',
        isRecurring: !!row.is_recurring,
        eventDate: row.event_date,
    }))

    return { occupied }
}
