'use server'

import { getActionContext } from '@/lib/auth-action'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface StudentReport {
    studentId: string
    studentName: string
    subjects: { subjectId: string; subjectName: string; coefficient: number; average: number | null }[]
    generalAverage: number | null
}

export interface ReportCardExtra {
    studentId: string
    conductGrade: string | null
    generalComment: string | null
    attendanceDays: number | null
    absenceDays: number | null
    status: string
}

// ─── Calculate averages for a class + termId (UUID) ───────────────────────────

export async function calculateReportCards(classId: string, termId: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { supabase, schoolId } = ctx

    const { data: termRecord, error: termError } = await supabase
        .from('terms')
        .select('id, name, academic_year_id')
        .eq('id', termId)
        .eq('school_id', schoolId)
        .single()

    if (termError || !termRecord) return { error: 'Trimestre introuvable' }

    const { data: enrollments, error: enrollError } = await supabase
        .from('enrollments')
        .select('student_id, profiles!enrollments_student_id_fkey(id, full_name)')
        .eq('class_id', classId)
        .eq('school_id', schoolId)

    if (enrollError) return { error: enrollError.message }
    if (!enrollments || enrollments.length === 0) return { error: 'Aucun élève inscrit dans cette classe' }

    const studentIds = enrollments.map(e => e.student_id)

    const { data: grades, error: gradesError } = await supabase
        .from('grades')
        .select('student_id, value, max_value, coefficient, subjects(id, name)')
        .in('student_id', studentIds)
        .eq('term_id', termId)

    if (gradesError) return { error: gradesError.message }

    const reports: StudentReport[] = (enrollments as any[]).map(enrollment => {
        const profile = enrollment.profiles as { id: string; full_name: string } | null
        const studentGrades = ((grades as any[]) ?? []).filter(g => g.student_id === enrollment.student_id)

        const bySubject = new Map<string, { name: string; coef: number; grades: typeof studentGrades }>()
        studentGrades.forEach((g: any) => {
            const subj = g.subjects as { id: string; name: string } | null
            const sid = subj?.id ?? 'unknown'
            if (!bySubject.has(sid)) {
                bySubject.set(sid, { name: subj?.name ?? '—', coef: g.coefficient || 1, grades: [] })
            }
            bySubject.get(sid)!.grades.push(g)
        })

        const subjects = Array.from(bySubject.entries()).map(([subjectId, s]) => {
            const totalCoef   = s.grades.reduce((sum, g) => sum + (g.coefficient || 1), 0)
            const weightedSum = s.grades.reduce((sum, g) => {
                const normalized = g.max_value > 0 ? (g.value / g.max_value) * 20 : 0
                return sum + normalized * (g.coefficient || 1)
            }, 0)
            return {
                subjectId,
                subjectName: s.name,
                coefficient: s.coef,
                average: totalCoef > 0 ? weightedSum / totalCoef : null,
            }
        })

        const totalSubjectCoef = subjects.reduce((sum, s) => sum + s.coefficient, 0)
        const weightedAvg      = subjects.reduce((sum, s) => sum + (s.average ?? 0) * s.coefficient, 0)
        const generalAverage   = subjects.length > 0 && totalSubjectCoef > 0
            ? weightedAvg / totalSubjectCoef
            : null

        return {
            studentId:   enrollment.student_id,
            studentName: profile?.full_name ?? '—',
            subjects,
            generalAverage,
        }
    })

    reports.sort((a, b) => (b.generalAverage ?? -1) - (a.generalAverage ?? -1))

    const validReports = reports.filter(r => r.generalAverage !== null)
    const classAvg     = validReports.length > 0
        ? validReports.reduce((s, r) => s + (r.generalAverage ?? 0), 0) / validReports.length
        : null

    const rows = reports
        .filter(r => r.generalAverage !== null)
        .map((r, index) => ({
            school_id:        schoolId,
            student_id:       r.studentId,
            class_id:         classId,
            term_id:          termId,
            academic_year_id: termRecord.academic_year_id,
            overall_average:  r.generalAverage,
            rank:             index + 1,
            class_size:       reports.length,
            class_average:    classAvg,
            subject_averages: r.subjects,
            status:           'draft',
        }))

    if (rows.length > 0) {
        await supabase
            .from('report_cards' as any)
            .upsert(rows, { onConflict: 'student_id,class_id,term_id', ignoreDuplicates: false })
    }

    return { reports, classAverage: classAvg, totalStudents: reports.length }
}

// ─── Load saved extras (conduct grade, comment, attendance) ────────────────────

export async function getReportCardExtras(classId: string, termId: string): Promise<ReportCardExtra[]> {
    const ctx = await getActionContext()
    if (!ctx) return []
    const { supabase, schoolId } = ctx

    const { data } = await supabase
        .from('report_cards' as any)
        .select('student_id, conduct_grade, general_comment, attendance_days, absence_days, status')
        .eq('class_id', classId)
        .eq('term_id', termId)
        .eq('school_id', schoolId)

    return (data ?? []).map((row: any) => ({
        studentId:      row.student_id,
        conductGrade:   row.conduct_grade   ?? null,
        generalComment: row.general_comment ?? null,
        attendanceDays: row.attendance_days ?? null,
        absenceDays:    row.absence_days    ?? null,
        status:         row.status          ?? 'draft',
    }))
}

// ─── Attendance stats for class within term date range ─────────────────────────

export async function getAttendanceStatsForTerm(
    classId: string,
    termId: string,
): Promise<Record<string, { present: number; absent: number; late: number; total: number }>> {
    const ctx = await getActionContext()
    if (!ctx) return {}
    const { supabase, schoolId } = ctx

    const { data: term } = await supabase
        .from('terms')
        .select('start_date, end_date')
        .eq('id', termId)
        .single()

    let query = supabase
        .from('attendance')
        .select('student_id, status')
        .eq('class_id', classId)
        .eq('school_id', schoolId)

    if (term?.start_date) query = query.gte('date', (term.start_date as string).split('T')[0])
    if (term?.end_date)   query = query.lte('date', (term.end_date   as string).split('T')[0])

    const { data } = await query

    const stats: Record<string, { present: number; absent: number; late: number; total: number }> = {}
    ;(data ?? []).forEach((row: any) => {
        if (!stats[row.student_id]) stats[row.student_id] = { present: 0, absent: 0, late: 0, total: 0 }
        const s = stats[row.student_id]
        if (row.status === 'present') s.present++
        else if (row.status === 'absent') s.absent++
        else if (row.status === 'late')   s.late++
        s.total++
    })

    return stats
}

// ─── Save per-student conduct grade + general comment ─────────────────────────

export interface ReportDetail {
    studentId: string
    conductGrade: string
    generalComment: string
}

export async function saveReportCardDetails(classId: string, termId: string, details: ReportDetail[]) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { supabase, schoolId } = ctx

    const updates = details.map(d => ({
        school_id:       schoolId,
        class_id:        classId,
        term_id:         termId,
        student_id:      d.studentId,
        conduct_grade:   d.conductGrade   || null,
        general_comment: d.generalComment || null,
    }))

    const { error } = await supabase
        .from('report_cards' as any)
        .upsert(updates, { onConflict: 'student_id,class_id,term_id' })

    if (error) return { error: error.message }
    return { success: true }
}

// ─── Save attendance days per student ─────────────────────────────────────────

export async function saveAttendanceDays(
    classId: string,
    termId: string,
    stats: Record<string, { present: number; absent: number; late: number; total: number }>,
) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { supabase, schoolId } = ctx

    const updates = Object.entries(stats).map(([studentId, s]) => ({
        school_id:       schoolId,
        class_id:        classId,
        term_id:         termId,
        student_id:      studentId,
        attendance_days: s.present + s.late,
        absence_days:    s.absent,
    }))

    if (updates.length === 0) return { success: true }

    const { error } = await supabase
        .from('report_cards' as any)
        .upsert(updates, { onConflict: 'student_id,class_id,term_id' })

    if (error) return { error: error.message }
    return { success: true }
}

// ─── Validate bulletins (draft → validated) ────────────────────────────────────

export async function validateReportCards(classId: string, termId: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { supabase, schoolId } = ctx

    const { error } = await supabase
        .from('report_cards' as any)
        .update({ status: 'validated' })
        .eq('class_id', classId)
        .eq('term_id', termId)
        .eq('school_id', schoolId)
        .eq('status', 'draft')

    if (error) {
        if (error.code === '42P01') return { error: 'Table report_cards introuvable.' }
        return { error: error.message }
    }
    return { success: true }
}

// ─── Publish bulletins (validated → published) ─────────────────────────────────

export async function publishReportCards(classId: string, termId: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { supabase, schoolId } = ctx

    const { error } = await supabase
        .from('report_cards' as any)
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('class_id', classId)
        .eq('term_id', termId)
        .eq('school_id', schoolId)

    if (error) {
        if (error.code === '42P01') return { error: "Table report_cards inexistante. Calculez d'abord les moyennes." }
        return { error: error.message }
    }
    return { success: true }
}
