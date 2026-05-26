'use server'

import { getActionContext } from '@/lib/auth-action'
import { createAdminClient } from '@/utils/supabase/admin'
import { logActivity } from '@/lib/activity-log'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface StudentReport {
    studentId: string
    studentName: string
    studentNNI?: string
    enrollmentStatus?: string
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
    subjectAppreciations: { subjectId: string; appreciation: string }[]
}

// ─── Calculate averages for a class + termId (UUID) ───────────────────────────

export async function calculateReportCards(classId: string, termId: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { supabase, schoolId } = ctx

    const { data: termRecord, error: termError } = await supabase
        .from('terms')
        .select('id, name, academic_year_id, start_date, end_date')
        .eq('id', termId)
        .eq('school_id', schoolId)
        .single()

    if (termError || !termRecord) return { error: 'Trimestre introuvable' }

    // Fetch all duplicate term IDs in the same school & academic year with the same name
    const { data: sameNamedTerms } = await supabase
        .from('terms')
        .select('id')
        .eq('school_id', schoolId)
        .eq('academic_year_id', termRecord.academic_year_id)
        .eq('name', termRecord.name)

    const allTermIds = sameNamedTerms && sameNamedTerms.length > 0 
        ? sameNamedTerms.map(t => t.id) 
        : [termId]

    const admin = createAdminClient()

    const { data: enrollments, error: enrollError } = await admin
        .from('enrollments')
        .select('student_id, status, profiles!enrollments_student_id_fkey(id, full_name, national_id)')
        .eq('class_id', classId)
        .eq('school_id', schoolId)

    if (enrollError) return { error: enrollError.message }
    if (!enrollments || enrollments.length === 0) return { error: 'Aucun élève inscrit dans cette classe' }

    const studentIds = enrollments.map(e => e.student_id)

    let attendanceQuery = admin
        .from('attendance')
        .select('student_id, status')
        .eq('class_id', classId)
        .in('student_id', studentIds)

    if (termRecord?.start_date) {
        attendanceQuery = attendanceQuery.gte('date', (termRecord.start_date as string).split('T')[0])
    }
    if (termRecord?.end_date) {
        attendanceQuery = attendanceQuery.lte('date', (termRecord.end_date as string).split('T')[0])
    }

    let { data: attendanceData } = await attendanceQuery

    // FALLBACK: If no attendance records found in the term date range, fetch all attendance records for the class
    if (!attendanceData || attendanceData.length === 0) {
        const { data: fallbackData } = await admin
            .from('attendance')
            .select('student_id, status')
            .eq('class_id', classId)
            .in('student_id', studentIds)
        if (fallbackData && fallbackData.length > 0) {
            attendanceData = fallbackData
        }
    }

    const attMap = new Map<string, { present: number; absent: number; late: number }>()
    ;(attendanceData ?? []).forEach((row: any) => {
        if (!attMap.has(row.student_id)) {
            attMap.set(row.student_id, { present: 0, absent: 0, late: 0 })
        }
        const s = attMap.get(row.student_id)!
        if (row.status === 'present') s.present++
        else if (row.status === 'absent' || row.status === 'excused') s.absent++
        else if (row.status === 'late')   s.late++
    })

    const { data: rawGrades, error: gradesError } = await admin
        .from('grades')
        .select('student_id, value, max_value, coefficient, subjects(id, name), term_id, created_at, terms!inner(school_id)')
        .in('student_id', studentIds)
        .eq('terms.school_id', schoolId)

    if (gradesError) return { error: gradesError.message }

    const startDate = termRecord.start_date ? new Date(termRecord.start_date) : null
    const endDate = termRecord.end_date ? new Date(termRecord.end_date) : null
    if (endDate) {
        endDate.setHours(23, 59, 59, 999)
    }

    const grades = (rawGrades || []).filter((g: any) => {
        // Rule 1: Explicitly registered under one of our acceptable target active terms
        if (allTermIds.includes(g.term_id)) return true

        // Rule 2: Advanced Calendar Reconstruction for legacy or collision-affected records
        // If the record was recorded within the semester dates, auto-bind it mathematically
        if (g.created_at && startDate && endDate) {
            const cAt = new Date(g.created_at)
            return cAt >= startDate && cAt <= endDate
        }
        return false
    })

    const { data: classCoefs } = await admin
        .from('subject_coefficients')
        .select('subject_id, coefficient')
        .eq('class_id', classId)

    const coefMap = new Map<string, number>()
    if (classCoefs) {
        classCoefs.forEach((c: any) => {
            coefMap.set(c.subject_id, c.coefficient)
        })
    }

    const reports: StudentReport[] = (enrollments as any[]).map(enrollment => {
        const profile = enrollment.profiles as { id: string; full_name: string; national_id?: string } | null
        const studentGrades = ((grades as any[]) ?? []).filter(g => g.student_id === enrollment.student_id)

        const bySubject = new Map<string, { name: string; coef: number; grades: typeof studentGrades }>()
        studentGrades.forEach((g: any) => {
            const subj = g.subjects as { id: string; name: string } | null
            const sid = subj?.id ?? 'unknown'
            if (!bySubject.has(sid)) {
                bySubject.set(sid, { name: subj?.name ?? '—', coef: coefMap.get(sid) ?? 1, grades: [] })
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
            studentNNI:  profile?.national_id ?? undefined,
            enrollmentStatus: enrollment.status,
            subjects,
            generalAverage,
        }
    })

    reports.sort((a, b) => (b.generalAverage ?? -1) - (a.generalAverage ?? -1))

    const validReports = reports.filter(r => r.generalAverage !== null)
    const classAvg     = validReports.length > 0
        ? validReports.reduce((s, r) => s + (r.generalAverage ?? 0), 0) / validReports.length
        : null

    // Preserve existing subject appreciations before recalculating
    const { data: existingCards } = await supabase
        .from('report_cards' as any)
        .select('student_id, subject_averages')
        .eq('class_id', classId)
        .in('term_id', allTermIds)
        .eq('school_id', schoolId)

    const existingApprMap = new Map<string, Map<string, string>>()
    ;(existingCards ?? []).forEach((card: any) => {
        const apprMap = new Map<string, string>()
        ;(card.subject_averages ?? []).forEach((s: any) => {
            if (s.appreciation) apprMap.set(s.subjectId, s.appreciation)
        })
        existingApprMap.set(card.student_id, apprMap)
    })

    let currentRank = 1
    const rows = reports.map((r) => {
        const att = attMap.get(r.studentId) ?? { present: 0, absent: 0, late: 0 }
        const hasAvg = r.generalAverage !== null
        const rankVal = hasAvg ? currentRank++ : null
        const apprMap = existingApprMap.get(r.studentId)

        return {
            school_id:        schoolId,
            student_id:       r.studentId,
            class_id:         classId,
            term_id:          termId,
            academic_year_id: termRecord.academic_year_id,
            overall_average:  r.generalAverage,
            rank:             rankVal,
            class_size:       reports.length,
            class_average:    classAvg,
            subject_averages: r.subjects.map(s => ({
                ...s,
                appreciation: apprMap?.get(s.subjectId) ?? null,
            })),
            status:           'draft',
            attendance_days:  att.present + att.late,
            absence_days:     att.absent,
        }
    })

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

    // Also resolve sameNamedTerms for Extras query to merge them if necessary
    const { data: targetTerm } = await supabase
        .from('terms')
        .select('name, academic_year_id')
        .eq('id', termId)
        .eq('school_id', schoolId)
        .single()

    let allTermIds = [termId]
    if (targetTerm) {
        const { data: sisterTerms } = await supabase
            .from('terms')
            .select('id')
            .eq('school_id', schoolId)
            .eq('academic_year_id', targetTerm.academic_year_id)
            .eq('name', targetTerm.name)
        if (sisterTerms && sisterTerms.length > 0) {
            allTermIds = sisterTerms.map(t => t.id)
        }
    }

    const { data } = await supabase
        .from('report_cards' as any)
        .select('student_id, conduct_grade, general_comment, attendance_days, absence_days, status, subject_averages')
        .eq('class_id', classId)
        .in('term_id', allTermIds)
        .eq('school_id', schoolId)

    return (data ?? []).map((row: any) => ({
        studentId:      row.student_id,
        conductGrade:   row.conduct_grade   ?? null,
        generalComment: row.general_comment ?? null,
        attendanceDays: row.attendance_days ?? null,
        absenceDays:    row.absence_days    ?? null,
        status:         row.status          ?? 'draft',
        subjectAppreciations: (row.subject_averages ?? [])
            .filter((s: any) => s.appreciation)
            .map((s: any) => ({ subjectId: s.subjectId, appreciation: s.appreciation })),
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

    let { data } = await query

    // FALLBACK: If no attendance records found in the term date range, fetch all attendance records for the class
    if (!data || data.length === 0) {
        const { data: fallbackData } = await supabase
            .from('attendance')
            .select('student_id, status')
            .eq('class_id', classId)
        if (fallbackData && fallbackData.length > 0) {
            data = fallbackData
        }
    }

    const stats: Record<string, { present: number; absent: number; late: number; total: number }> = {}
    ;(data ?? []).forEach((row: any) => {
        if (!stats[row.student_id]) stats[row.student_id] = { present: 0, absent: 0, late: 0, total: 0 }
        const s = stats[row.student_id]
        if (row.status === 'present') s.present++
        else if (row.status === 'absent' || row.status === 'excused') s.absent++
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

    const promises = details.map(d => 
        supabase
            .from('report_cards' as any)
            .update({
                conduct_grade:   d.conductGrade   || null,
                general_comment: d.generalComment || null,
            })
            .eq('school_id', schoolId)
            .eq('class_id', classId)
            .eq('term_id', termId)
            .eq('student_id', d.studentId)
    )

    const results = await Promise.all(promises)
    const firstError = results.find(r => r.error)?.error
    if (firstError) return { error: firstError.message }

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

    const promises = Object.entries(stats).map(([studentId, s]) => 
        supabase
            .from('report_cards' as any)
            .update({
                attendance_days: s.present + s.late,
                absence_days:    s.absent,
            })
            .eq('school_id', schoolId)
            .eq('class_id', classId)
            .eq('term_id', termId)
            .eq('student_id', studentId)
    )

    if (promises.length === 0) return { success: true }

    const results = await Promise.all(promises)
    const firstError = results.find(r => r.error)?.error
    if (firstError) return { error: firstError.message }

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
    const [{ data: cls }, { data: term }] = await Promise.all([
        supabase.from('classes').select('name').eq('id', classId).single(),
        supabase.from('terms').select('name').eq('id', termId).single(),
    ])
    logActivity({ actorId: ctx.userId, schoolId, action: 'validate_reports', entityType: 'report_cards', entityId: classId, details: `Bulletins validés — Classe: ${cls?.name ?? classId}, Trimestre: ${term?.name ?? termId}` })
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
    const [{ data: cls }, { data: term }] = await Promise.all([
        supabase.from('classes').select('name').eq('id', classId).single(),
        supabase.from('terms').select('name').eq('id', termId).single(),
    ])
    logActivity({ actorId: ctx.userId, schoolId, action: 'publish_reports', entityType: 'report_cards', entityId: classId, details: `Bulletins publiés — Classe: ${cls?.name ?? classId}, Trimestre: ${term?.name ?? termId}` })
    return { success: true }
}

// ─── Save per-subject appreciations into subject_averages JSONB ───────────────

export async function saveSubjectAppreciations(
    classId: string,
    termId: string,
    appreciations: { studentId: string; subjectId: string; appreciation: string }[]
) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { supabase, schoolId } = ctx

    const { data: targetTerm } = await supabase
        .from('terms')
        .select('name, academic_year_id')
        .eq('id', termId)
        .eq('school_id', schoolId)
        .single()

    let allTermIds = [termId]
    if (targetTerm) {
        const { data: sisterTerms } = await supabase
            .from('terms')
            .select('id')
            .eq('school_id', schoolId)
            .eq('academic_year_id', targetTerm.academic_year_id)
            .eq('name', targetTerm.name)
        if (sisterTerms && sisterTerms.length > 0) allTermIds = sisterTerms.map(t => t.id)
    }

    const byStudent = new Map<string, Map<string, string>>()
    appreciations.forEach(a => {
        if (!byStudent.has(a.studentId)) byStudent.set(a.studentId, new Map())
        byStudent.get(a.studentId)!.set(a.subjectId, a.appreciation)
    })

    const promises = Array.from(byStudent.entries()).map(async ([studentId, apprMap]) => {
        const { data } = await supabase
            .from('report_cards' as any)
            .select('subject_averages')
            .eq('school_id', schoolId)
            .eq('class_id', classId)
            .in('term_id', allTermIds)
            .eq('student_id', studentId)
            .maybeSingle()

        const existing: any[] = (data as any)?.subject_averages ?? []
        const updated = existing.map((s: any) => ({
            ...s,
            appreciation: apprMap.has(s.subjectId) ? apprMap.get(s.subjectId) : (s.appreciation ?? null),
        }))

        return supabase
            .from('report_cards' as any)
            .update({ subject_averages: updated })
            .eq('school_id', schoolId)
            .eq('class_id', classId)
            .eq('term_id', termId)
            .eq('student_id', studentId)
    })

    const results = await Promise.all(promises)
    const firstError = results.find(r => r.error)?.error
    if (firstError) return { error: firstError.message }
    return { success: true }
}

// ─── Search students by name ───────────────────────────────────────────────────

export async function getStudentsByName(query: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { schoolId } = ctx
    const adminClient = createAdminClient()

    const { data: links } = await adminClient
        .from('profile_schools')
        .select('profile_id')
        .eq('school_id', schoolId)
        .eq('role', 'student')

    if (!links || links.length === 0) return { students: [] }

    const profileIds = (links as any[]).map((l: any) => l.profile_id)

    const { data: profiles, error } = await adminClient
        .from('profiles')
        .select('id, full_name, national_id')
        .in('id', profileIds)
        .ilike('full_name', `%${query}%`)
        .eq('role', 'student')
        .limit(10)

    if (error) return { error: error.message }
    if (!profiles || profiles.length === 0) return { students: [] }

    const students = await Promise.all((profiles as any[]).map(async (profile: any) => {
        const { data: enrollment } = await adminClient
            .from('enrollments')
            .select('class_id, academic_year_id')
            .eq('student_id', profile.id)
            .eq('school_id', schoolId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        return { profile, enrollment }
    }))

    return { students: students.filter(s => s.enrollment) }
}

export async function getStudentInfoByNNI(nni: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { schoolId } = ctx
    const adminClient = createAdminClient()

    // 1. Fetch profile using admin client to bypass school_id RLS if student was transferred
    const { data: profile, error: profileError } = await adminClient
        .from('profiles')
        .select('id, full_name, national_id')
        .eq('national_id', nni)
        .eq('role', 'student')
        .maybeSingle()

    if (profileError || !profile) return { error: 'Élève introuvable avec ce NNI' }

    // 2. Authorize: Check if student has ever been linked to this school
    const { data: schoolLink, error: linkError } = await adminClient
        .from('profile_schools')
        .select('id')
        .eq('profile_id', profile.id)
        .eq('school_id', schoolId)
        .eq('role', 'student')
        .maybeSingle()

    if (linkError || !schoolLink) {
        return { error: 'Élève introuvable avec ce NNI dans votre établissement' }
    }

    // 3. Fetch latest enrollment at this school (active or transferred)
    const { data: enrollment, error: enrollError } = await adminClient
        .from('enrollments')
        .select('class_id, academic_year_id')
        .eq('student_id', profile.id)
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (enrollError) return { error: enrollError.message }
    if (!enrollment) return { error: 'Cet élève n\'est inscrit dans aucune classe dans votre établissement' }

    return { student: profile, enrollment }
}
