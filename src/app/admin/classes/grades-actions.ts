'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'

async function getAuthCtx() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const db = createAdminClient()
    const { data: profile } = await db.from('profiles').select('school_id').eq('id', user.id).maybeSingle()
    if (!profile?.school_id) return null
    return { supabase: db, userId: user.id, schoolId: profile.school_id }
}

export interface GradeEntry {
    id: string
    studentId: string
    subjectId: string
    assessmentType: 'devoir' | 'examen'
    comment: string | null
    value: number
    maxValue: number
    coefficient: number
    createdAt: string
    termId: string | null
}

export interface StudentPerf {
    studentId: string
    studentName: string
    avatar: string
    grades: GradeEntry[]
    avgBySubject: Record<string, number | null>
    generalAverage: number | null
    rank: number
}

export interface TermOption {
    id: string
    name: string
}

// ─── Fetch terms for selector ─────────────────────────────────────────────────

export async function getTermsForSchool(): Promise<TermOption[]> {
    const ctx = await getAuthCtx()
    if (!ctx) return []

    const { supabase, schoolId } = ctx
    const { data } = await supabase
        .from('terms')
        .select('id, name')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })

    return (data || []).map((t: any) => ({ id: t.id, name: t.name }))
}

// ─── Fetch class performance data ─────────────────────────────────────────────

export async function getClassPerformance(
    classId: string,
    termId: string,
    subjectId?: string,
) {
    const ctx = await getAuthCtx()
    if (!ctx) return { error: 'Non authentifié' as string, students: [] as StudentPerf[], classAverage: null as number | null, topStudent: null as StudentPerf | null, totalGrades: 0, subjectMap: {} as Record<string, string>, classSubjects: [] as { id: string; name: string; icon: string | null }[] }

    const { supabase } = ctx

    // FIX 1 : pas de filtre school_id sur enrollments (cohérent avec class-details.tsx)
    const { data: enrollments } = await supabase
        .from('enrollments')
        .select('student_id, profiles!enrollments_student_id_fkey(id, full_name)')
        .eq('class_id', classId)

    if (!enrollments?.length) {
        return { students: [], classAverage: null, topStudent: null, totalGrades: 0, subjectMap: {}, classSubjects: [] }
    }

    const studentIds = enrollments.map((e: any) => e.student_id)

    // FIX 2 : term_id optionnel — si termId vide, récupère TOUTES les notes
    let query = supabase
        .from('grades')
        .select('id, student_id, subject_id, assessment_type, comment, value, max_value, coefficient, created_at, term_id')
        .eq('class_id', classId)
        .in('student_id', studentIds)

    if (termId) query = query.eq('term_id', termId)
    if (subjectId) query = query.eq('subject_id', subjectId)

    const { data: gradesData } = await query
    const grades = gradesData || []

    // FIX 3 : charger les matières ici pour ne pas dépendre du prop (qui peut être vide)
    const { data: csData } = await supabase
        .from('class_subjects')
        .select('subject_id, subjects(id, name, icon)')
        .eq('class_id', classId)

    const subjectMap: Record<string, string> = {}
    const classSubjects: { id: string; name: string; icon: string | null }[] = []
    ;(csData || []).forEach((cs: any) => {
        if (cs.subjects?.id) {
            subjectMap[cs.subjects.id] = cs.subjects.name
            classSubjects.push({ id: cs.subjects.id, name: cs.subjects.name, icon: cs.subjects.icon ?? null })
        }
    })

    // Build per-student performance
    const students: StudentPerf[] = enrollments.map((e: any) => {
        const profile = e.profiles as { id: string; full_name: string } | null
        const name = profile?.full_name || 'Inconnu'
        const avatar = name.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()

        const studentGrades: GradeEntry[] = grades
            .filter((g: any) => g.student_id === e.student_id)
            .map((g: any) => ({
                id: g.id,
                studentId: g.student_id,
                subjectId: g.subject_id,
                assessmentType: g.assessment_type ?? 'devoir',
                comment: g.comment ?? null,
                value: g.value ?? 0,
                maxValue: g.max_value ?? 20,
                coefficient: g.coefficient ?? 1,
                createdAt: g.created_at,
                termId: g.term_id ?? null,
            }))

        // Average by subject
        const subjectGradesMap: Record<string, GradeEntry[]> = {}
        studentGrades.forEach(g => {
            if (!subjectGradesMap[g.subjectId]) subjectGradesMap[g.subjectId] = []
            subjectGradesMap[g.subjectId].push(g)
        })

        const avgBySubject: Record<string, number | null> = {}
        Object.entries(subjectGradesMap).forEach(([sid, sGrades]) => {
            const totalCoef = sGrades.reduce((s, g) => s + g.coefficient, 0)
            const weighted = sGrades.reduce((s, g) => {
                const norm = g.maxValue > 0 ? (g.value / g.maxValue) * 20 : 0
                return s + norm * g.coefficient
            }, 0)
            avgBySubject[sid] = totalCoef > 0 ? weighted / totalCoef : null
        })

        // General average
        const avgs = Object.values(avgBySubject).filter(v => v !== null) as number[]
        const generalAverage = avgs.length > 0 ? avgs.reduce((s, v) => s + v, 0) / avgs.length : null

        return { studentId: e.student_id, studentName: name, avatar, grades: studentGrades, avgBySubject, generalAverage, rank: 0 }
    })

    students.sort((a, b) => (b.generalAverage ?? -1) - (a.generalAverage ?? -1))
    students.forEach((s, i) => { s.rank = i + 1 })

    const withGrades = students.filter(s => s.generalAverage !== null)
    const classAverage = withGrades.length > 0
        ? withGrades.reduce((s, st) => s + (st.generalAverage ?? 0), 0) / withGrades.length
        : null
    const topStudent = withGrades[0] ?? null

    return { students, classAverage, topStudent, totalGrades: grades.length, subjectMap, classSubjects }
}

// ─── Add a grade ──────────────────────────────────────────────────────────────

export async function addGrade(data: {
    studentId: string
    subjectId: string
    termId: string
    title: string
    value: number
    maxValue: number
    coefficient: number
}) {
    const ctx = await getAuthCtx()
    if (!ctx) return { error: 'Non authentifié' }

    const { supabase, userId, schoolId } = ctx

    if (data.value < 0 || data.value > data.maxValue) return { error: 'Note invalide' }
    if (!data.title?.trim()) return { error: 'Le titre est requis' }

    const { error } = await supabase.from('grades').insert({
        school_id: schoolId,
        student_id: data.studentId,
        subject_id: data.subjectId,
        term_id: data.termId,
        title: data.title.trim(),
        value: data.value,
        max_value: data.maxValue,
        coefficient: data.coefficient,
        created_by: userId,
    })

    if (error) return { error: error.message }
    revalidatePath('/admin/classes')
    return { success: true }
}

// ─── Delete a grade ───────────────────────────────────────────────────────────

export async function deleteGrade(gradeId: string) {
    const ctx = await getAuthCtx()
    if (!ctx) return { error: 'Non authentifié' }

    const { supabase } = ctx
    const { error } = await supabase.from('grades').delete().eq('id', gradeId)
    if (error) return { error: error.message }
    return { success: true }
}
