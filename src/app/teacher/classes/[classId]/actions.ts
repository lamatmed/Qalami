'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

export async function loadGradesAction(classId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Non authentifié')

    const admin = createAdminClient()
    const { data, error } = await admin
        .from('grades')
        .select(`
            *,
            subjects:subject_id(name)
        `)
        .eq('class_id', classId)
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false })
    
    if (error) throw new Error(error.message)
    return (data || []).map((g: any) => ({
        ...g,
        subject_name: g.subjects?.name
    }))
}

export async function loadScheduleAction(classId: string) {
    const admin = createAdminClient()
    const { data, error } = await admin
        .from('schedule')
        .select(`
            id,
            day_of_week,
            start_time,
            end_time,
            room,
            subjects:subject_id(name)
        `)
        .eq('class_id', classId)
        .order('day_of_week')
        .order('start_time')

    if (error) throw new Error(error.message)
    return (data || []).map((s: any) => ({
        ...s,
        subject: s.subjects
    }))
}

export async function loadAttendanceHistoryAction(classId: string) {
    const admin = createAdminClient()
    const { data, error } = await admin
        .from('attendance')
        .select('*')
        .eq('class_id', classId)
        .order('date', { ascending: false })
        .limit(100)

    if (error) throw new Error(error.message)
    return data || []
}

export async function loadTeacherSubjectsAction(classId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Non authentifié')

    const admin = createAdminClient()

    // 1. Secure the school_id of the specific class being viewed for accurate term isolation
    const { data: classInfo } = await admin
        .from('classes')
        .select('school_id')
        .eq('id', classId)
        .maybeSingle()
    
    const schoolId = classInfo?.school_id

    let termQuery = admin.from('terms').select('id, name, label_fr').eq('is_current', true)
    if (schoolId) {
        termQuery = termQuery.eq('school_id', schoolId)
    }

    const [assignResult, termResult] = await Promise.all([
        admin.from('teacher_assignments')
            .select('subject_id')
            .eq('teacher_id', user.id)
            .eq('class_id', classId),
        termQuery.maybeSingle()
    ])

    if (assignResult.error) throw new Error(assignResult.error.message)

    let currentTerm = termResult.data || null
    
    // Fallback 1: If no current term is explicitly flagged for this school, grab its most recently created term
    if (!currentTerm && schoolId) {
        const { data: fallbackTerm } = await admin
            .from('terms')
            .select('id, name, label_fr')
            .eq('school_id', schoolId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        if (fallbackTerm) currentTerm = fallbackTerm
    }

    // Fallback 2: Ultimate safety check - fetch the first available globally active term to prevent NULL blocks
    if (!currentTerm) {
        const { data: globalTerm } = await admin
            .from('terms')
            .select('id, name, label_fr')
            .eq('is_current', true)
            .limit(1)
            .maybeSingle()
        if (globalTerm) currentTerm = globalTerm
    }

    const termId = currentTerm?.id || null
    const subjectIds = (assignResult.data || []).map(a => a.subject_id).filter(Boolean)

    if (subjectIds.length === 0) {
        return { subjects: [], termId, currentTerm }
    }

    const { data: subjectsData, error: subjectsError } = await admin
        .from('subjects')
        .select('id, name')
        .in('id', subjectIds)

    if (subjectsError) throw new Error(subjectsError.message)
    return { subjects: subjectsData || [], termId, currentTerm }
}

export async function saveAttendanceAction(records: any[]) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Non authentifié')

    if (!records || records.length === 0) return { success: true }

    const admin = createAdminClient()
    
    // Pre-emptively secure parameters from the batch
    const classId = records[0].class_id
    const date = records[0].date
    const studentIds = records.map(r => r.student_id)

    // --- 1. STRICT SCHEDULE ENFORCEMENT ---
    // Compute server local time (Mauritanie GMT/UTC timezone context)
    const now = new Date()
    const dayOfWeek = now.getDay() // 0 = Dimanche, 1 = Lundi, etc.

    // Find active schedule slots assigned to THIS teacher for THIS class on THIS day of the week
    const { data: slots, error: slotsError } = await admin
        .from('schedule')
        .select('id, subject_id, start_time, end_time')
        .eq('class_id', classId)
        .eq('teacher_id', user.id)
        .eq('day_of_week', dayOfWeek)

    if (slotsError) throw new Error(`Erreur de validation du planning: ${slotsError.message}`)

    // Find slot corresponding to current server time (with 15-minute early buffer and 30-minute late buffer)
    const activeSlot = (slots || []).find(slot => {
        const timeToMins = (t: string) => {
            const [h, m] = t.split(':').map(Number)
            return h * 60 + m
        }
        const nowMins = now.getHours() * 60 + now.getMinutes()
        const startMins = timeToMins(slot.start_time)
        const endMins = timeToMins(slot.end_time)
        return nowMins >= (startMins - 15) && nowMins <= (endMins + 30)
    })

    if (!activeSlot) {
        const DAYS_FR = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]
        const currentDayName = DAYS_FR[dayOfWeek]
        const currentHourStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0')
        
        if (!slots || slots.length === 0) {
            return { success: false, error: `Action bloquée : Aucun cours n'est planifié pour vous le ${currentDayName} dans cette classe. Veuillez configurer l'emploi du temps.` }
        } else {
            const slotTimes = slots.map(s => `${s.start_time.substring(0, 5)} à ${s.end_time.substring(0, 5)}`).join(', ')
            return { success: false, error: `Hors planning : Il est ${currentHourStr} (${currentDayName}). Vos séances aujourd'hui sont prévues à : ${slotTimes}. (Marge acceptée : 15 min avant / 30 min après).` }
        }
    }

    const scheduleId = activeSlot.id
    const subjectId = activeSlot.subject_id

    // --- 2. ATOMIC DEDUPLICATION (SCOPED BY SESSION) ---
    // Safely purge previous records ONLY for THIS specific class slot today to preserve others
    const { error: deleteError } = await admin
        .from('attendance')
        .delete()
        .eq('class_id', classId)
        .eq('date', date)
        .eq('schedule_id', scheduleId)
        .in('student_id', studentIds)

    if (deleteError) {
        console.error("Error clearing previous session attendance:", deleteError)
        throw new Error(deleteError.message)
    }

    // --- 3. SECURE INSERT ---
    const secureRecords = records.map(r => ({
        ...r,
        recorded_by: user.id,
        schedule_id: scheduleId,
        subject_id: subjectId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }))

    const { error } = await admin
        .from('attendance')
        .insert(secureRecords)

    if (error) throw new Error(error.message)
    return { success: true }
}

export async function saveGradesAction(gradesToInsert: any[]) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Non authentifié')

    if (!gradesToInsert || gradesToInsert.length === 0) {
        return { success: true }
    }

    const admin = createAdminClient()

    // Airtight Academic Rules Validation: Max 1 Exam ('examen') per Term & Subject per Student
    const examsToInsert = gradesToInsert.filter(g => g.assessment_type === 'examen')
    if (examsToInsert.length > 0) {
        const firstExam = examsToInsert[0]
        const studentIds = examsToInsert.map(e => e.student_id)

        if (!firstExam.subject_id || !firstExam.term_id) {
            return { success: false, error: "Erreur de validation : Matière ou trimestre manquant pour la saisie." }
        }

        const { data: existingExams, error: checkError } = await admin
            .from('grades')
            .select('student_id')
            .in('student_id', studentIds)
            .eq('subject_id', firstExam.subject_id)
            .eq('term_id', firstExam.term_id)
            .eq('assessment_type', 'examen')

        if (checkError) {
            console.error('[saveGradesAction] Integrity check error:', checkError)
            return { success: false, error: `Erreur d'intégrité lors de la vérification : ${checkError.message}` }
        }

        if (existingExams && existingExams.length > 0) {
            return { 
                success: false, 
                error: "Politique académique enfreinte : L'examen ne peut être saisi qu'une seule fois par trimestre et par matière pour chaque élève. Un examen existe déjà." 
            }
        }
    }

    // Fetch the school_id associated with the target class for correct reporting attribution
    const classId = gradesToInsert[0]?.class_id
    let schoolId = null
    if (classId) {
        const { data: classData } = await admin
            .from('classes')
            .select('school_id')
            .eq('id', classId)
            .maybeSingle()
        schoolId = classData?.school_id
    }

    // Enforce verified user id as assigning teacher and school identification
    const secureGrades = gradesToInsert.map(g => ({
        ...g,
        teacher_id: user.id,
        school_id: schoolId // CRITICAL FIX: Satisfy schema constraint for RLS
    }))

    const { error } = await admin
        .from('grades')
        .insert(secureGrades)

    if (error) {
        console.error('[saveGradesAction] Supabase error:', error)
        return { success: false, error: error.message }
    }
    return { success: true }
}

export async function loadActiveSessionAttendanceAction(classId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Non authentifié')

    const admin = createAdminClient()
    
    const now = new Date()
    const dayOfWeek = now.getDay()
    const today = now.toISOString().split('T')[0]

    // Establish the active schedule slot exactly like saveAction does
    const { data: slots, error: slotsError } = await admin
        .from('schedule')
        .select('id, start_time, end_time')
        .eq('class_id', classId)
        .eq('teacher_id', user.id)
        .eq('day_of_week', dayOfWeek)

    if (slotsError) return []

    const activeSlot = (slots || []).find(slot => {
        const timeToMins = (t: string) => {
            const [h, m] = t.split(':').map(Number)
            return h * 60 + m
        }
        const nowMins = now.getHours() * 60 + now.getMinutes()
        const startMins = timeToMins(slot.start_time)
        const endMins = timeToMins(slot.end_time)
        return nowMins >= (startMins - 15) && nowMins <= (endMins + 30)
    })

    if (!activeSlot) return []

    // Query for saved entries during this slot today
    const { data, error } = await admin
        .from('attendance')
        .select('student_id, status')
        .eq('class_id', classId)
        .eq('date', today)
        .eq('schedule_id', activeSlot.id)

    if (error) throw new Error(error.message)
    return data || []
}

export async function updateGradeAction(gradeId: string, newValue: number) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Non authentifié')

    const admin = createAdminClient()
    
    const { error } = await admin
        .from('grades')
        .update({ value: newValue, updated_at: new Date().toISOString() })
        .eq('id', gradeId)
        .eq('teacher_id', user.id)

    if (error) {
        console.error('[updateGradeAction] error:', error)
        return { success: false, error: error.message }
    }
    return { success: true }
}

export async function deleteGradeAction(gradeId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Non authentifié')

    const admin = createAdminClient()

    const { error } = await admin
        .from('grades')
        .delete()
        .eq('id', gradeId)
        .eq('teacher_id', user.id)

    if (error) {
        console.error('[deleteGradeAction] error:', error)
        return { success: false, error: error.message }
    }
    return { success: true }
}
