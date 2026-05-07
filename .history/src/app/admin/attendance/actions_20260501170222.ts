'use server'

import { getActionContext as getSchoolAndUser } from '@/lib/auth-action'

// ─── Classes ──────────────────────────────────────────────────────────────────

export async function getClasses() {
    const ctx = await getSchoolAndUser()
    if (!ctx) return []

    const { supabase, schoolId } = ctx
    const { data } = await supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', schoolId)
        .order('name')

    return data ?? []
}

// ─── Subjects by class ────────────────────────────────────────────────────────

export async function getSubjectsByClass(classId: string) {
    const ctx = await getSchoolAndUser()
    if (!ctx) return []

    const { supabase, schoolId } = ctx
    const { data } = await supabase
        .from('class_subjects')
        .select('subjects(id, name)')
        .eq('class_id', classId)
        .eq('school_id', schoolId)

    return (data ?? [])
        .map((row: any) => row.subjects)
        .filter(Boolean) as { id: string; name: string }[]
}

// ─── Enrolled students ────────────────────────────────────────────────────────

export async function getEnrolledStudents(classId: string) {
    const ctx = await getSchoolAndUser()
    if (!ctx) return []

    const { supabase, schoolId } = ctx
    const { data } = await supabase
        .from('enrollments')
        .select('student_id, profiles!enrollments_student_id_fkey(id, full_name, avatar_url)')
        .eq('class_id', classId)
        .eq('school_id', schoolId)
        .eq('status', 'active')
        .order('student_id')

    return (data ?? []).map((e: any) => ({
        id: e.student_id,
        full_name: e.profiles?.full_name ?? '—',
        avatar_url: e.profiles?.avatar_url ?? null,
    }))
}

// ─── Open / get attendance period ─────────────────────────────────────────────

export async function openAttendancePeriod(
    classId: string,
    date: string,
    subjectId: string | null,
) {
    const ctx = await getSchoolAndUser()
    if (!ctx) return { error: 'Non authentifié' }

    const { supabase, schoolId, userId } = ctx

    // Check for existing open period for this class/date/subject
    const query = supabase
        .from('attendance_periods')
        .select('*')
        .eq('school_id', schoolId)
        .eq('class_id', classId)
        .eq('date', date)

    const { data: existing } = subjectId
        ? await query.eq('subject_id', subjectId).maybeSingle()
        : await query.is('subject_id', null).maybeSingle()

    if (existing) {
        return { period: existing }
    }

    // Create new period
    const { data: period, error } = await supabase
        .from('attendance_periods')
        .insert({
            school_id: schoolId,
            class_id: classId,
            subject_id: subjectId ?? null,
            teacher_id: userId,
            date,
            status: 'open',
        })
        .select()
        .single()

    if (error) return { error: error.message }
    return { period }
}

// ─── Load existing attendance for a period ────────────────────────────────────

export async function getAttendanceForPeriod(periodId: string) {
    const ctx = await getSchoolAndUser()
    if (!ctx) return []

    const { supabase } = ctx
    const { data } = await supabase
        .from('attendance')
        .select('student_id, status, justified, justification_note')
        .eq('period_id', periodId)

    return data ?? []
}

// ─── Save attendance batch ────────────────────────────────────────────────────

export interface AttendanceRecord {
    studentId: string
    status: 'present' | 'absent' | 'late' | 'excused'
    justified?: boolean
    note?: string
}

export async function saveAttendance(
    periodId: string,
    classId: string,
    date: string,
    records: AttendanceRecord[],
) {
    const ctx = await getSchoolAndUser()
    if (!ctx) return { error: 'Non authentifié' }

    const { supabase, schoolId, userId } = ctx

    const rows = records.map(r => ({
        school_id: schoolId,
        period_id: periodId,
        class_id: classId,
        student_id: r.studentId,
        date,
        status: r.status,
        justified: r.justified ?? false,
        justification_note: r.note ?? null,
        recorded_by: userId,
    }))

    const { error } = await supabase
        .from('attendance')
        .upsert(rows, { onConflict: 'period_id,student_id' })

    if (error) return { error: error.message }

    // Close the period
    await supabase
        .from('attendance_periods')
        .update({ status: 'closed' })
        .eq('id', periodId)

    return { success: true }
}

// ─── Attendance history ───────────────────────────────────────────────────────

export async function getAttendanceHistory(limit = 30) {
    const ctx = await getSchoolAndUser()
    if (!ctx) return []

    const { supabase, schoolId } = ctx

    const { data: periods } = await supabase
        .from('attendance_periods')
        .select(`
            id, date, status, created_at,
            classes(id, name),
            subjects(id, name)
        `)
        .eq('school_id', schoolId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit)

    if (!periods || periods.length === 0) return []

    const periodIds = periods.map(p => p.id)

    // Fetch attendance counts per period
    const { data: attendanceRows } = await supabase
        .from('attendance')
        .select('period_id, status')
        .in('period_id', periodIds)

    const statsMap = new Map<string, Record<string, number>>()
    ;(attendanceRows ?? []).forEach((row: any) => {
        if (!statsMap.has(row.period_id)) {
            statsMap.set(row.period_id, { present: 0, absent: 0, late: 0, excused: 0 })
        }
        const s = statsMap.get(row.period_id)!
        s[row.status] = (s[row.status] ?? 0) + 1
    })

    return periods.map((p: any) => ({
        id: p.id,
        date: p.date,
        status: p.status,
        className: p.classes?.name ?? '—',
        classId: p.classes?.id ?? null,
        subjectName: p.subjects?.name ?? null,
        stats: statsMap.get(p.id) ?? { present: 0, absent: 0, late: 0, excused: 0 },
    }))
}

// ─── Today's overview: which classes have/haven't done attendance ──────────────

export async function getTodayOverview() {
    const ctx = await getSchoolAndUser()
    if (!ctx) return { classes: [], absentees: [], totalPresent: 0, totalAbsent: 0 }

    const { supabase, schoolId } = ctx
    const today = new Date().toISOString().split('T')[0]

    const [{ data: classes }, { data: periods }] = await Promise.all([
        supabase.from('classes').select('id, name').eq('school_id', schoolId).order('name'),
        supabase
            .from('attendance_periods')
            .select('id, class_id, status')
            .eq('school_id', schoolId)
            .eq('date', today),
    ])

    const periodByClass = new Map<string, { id: string; status: string }>()
    ;(periods ?? []).forEach((p: any) => {
        periodByClass.set(p.class_id, { id: p.id, status: p.status })
    })

    const periodIds = (periods ?? []).map((p: any) => p.id)

    let attendanceRows: any[] = []
    if (periodIds.length > 0) {
        const { data } = await supabase
            .from('attendance')
            .select('student_id, status, class_id, profiles!attendance_student_id_fkey(full_name)')
            .in('period_id', periodIds)
            .eq('school_id', schoolId)
        attendanceRows = data ?? []
    }

    // Stats per class
    const statsByClass = new Map<string, { present: number; absent: number; late: number; excused: number }>()
    attendanceRows.forEach((row: any) => {
        if (!statsByClass.has(row.class_id)) {
            statsByClass.set(row.class_id, { present: 0, absent: 0, late: 0, excused: 0 })
        }
        const s = statsByClass.get(row.class_id)!
        s[row.status as keyof typeof s] = (s[row.status as keyof typeof s] ?? 0) + 1
    })

    const classesWithStatus = (classes ?? []).map((c: any) => {
        const period = periodByClass.get(c.id)
        const stats = statsByClass.get(c.id) ?? null
        return {
            id: c.id,
            name: c.name,
            level: null,
            hasDoneAttendance: !!period,
            periodStatus: period?.status ?? null,
            stats,
        }
    })

    // Absentees today across all classes
    const absentees = attendanceRows
        .filter((r: any) => r.status === 'absent')
        .map((r: any) => ({
            studentId: r.student_id,
            studentName: (r.profiles as any)?.full_name ?? '—',
            classId: r.class_id,
            className: (classes ?? []).find((c: any) => c.id === r.class_id)?.name ?? '—',
        }))

    const totalPresent = attendanceRows.filter((r: any) => r.status === 'present' || r.status === 'late').length
    const totalAbsent = attendanceRows.filter((r: any) => r.status === 'absent').length

    return { classes: classesWithStatus, absentees, totalPresent, totalAbsent }
}

// ─── Chronic absentees (students above threshold in N days) ────────────────────

export async function getChronicAbsentees(threshold = 3, days = 30) {
    const ctx = await getSchoolAndUser()
    if (!ctx) return []

    const { supabase, schoolId } = ctx

    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toISOString().split('T')[0]

    const { data } = await supabase
        .from('attendance')
        .select('student_id, status, class_id, profiles!attendance_student_id_fkey(full_name), classes!attendance_class_id_fkey(name)')
        .eq('school_id', schoolId)
        .eq('status', 'absent')
        .gte('date', sinceStr)

    if (!data || data.length === 0) return []

    const map = new Map<string, { id: string; name: string; className: string; absences: number }>()
    data.forEach((row: any) => {
        const sid = row.student_id
        if (!map.has(sid)) {
            map.set(sid, {
                id: sid,
                name: (row.profiles as any)?.full_name ?? '—',
                className: (row.classes as any)?.name ?? '—',
                absences: 0,
            })
        }
        map.get(sid)!.absences++
    })

    return Array.from(map.values())
        .filter(s => s.absences >= threshold)
        .sort((a, b) => b.absences - a.absences)
}

// ─── Periods for a specific class (for sessions list) ─────────────────────────

export async function getClassPeriods(classId: string, days = 30) {
    const ctx = await getSchoolAndUser()
    if (!ctx) return []

    const { supabase, schoolId } = ctx

    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toISOString().split('T')[0]

    const { data: periods } = await supabase
        .from('attendance_periods')
        .select('id, date, status, created_at, subjects(id, name)')
        .eq('school_id', schoolId)
        .eq('class_id', classId)
        .gte('date', sinceStr)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

    if (!periods || periods.length === 0) return []

    const periodIds = periods.map((p: any) => p.id)

    const { data: rows } = await supabase
        .from('attendance')
        .select('period_id, status')
        .in('period_id', periodIds)

    const statsMap = new Map<string, Record<string, number>>()
    ;(rows ?? []).forEach((row: any) => {
        if (!statsMap.has(row.period_id)) {
            statsMap.set(row.period_id, { present: 0, absent: 0, late: 0, excused: 0 })
        }
        const s = statsMap.get(row.period_id)!
        s[row.status] = (s[row.status] ?? 0) + 1
    })

    return periods.map((p: any) => ({
        id: p.id,
        date: p.date,
        status: p.status,
        subjectId: (p.subjects as any)?.id ?? null,
        subjectName: (p.subjects as any)?.name ?? null,
        stats: statsMap.get(p.id) ?? { present: 0, absent: 0, late: 0, excused: 0 },
    }))
}

// ─── Per-subject attendance stats for a class ─────────────────────────────────

export async function getSubjectStatsForClass(classId: string, days = 30) {
    const ctx = await getSchoolAndUser()
    if (!ctx) return []

    const { supabase, schoolId } = ctx

    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toISOString().split('T')[0]

    const { data: periods } = await supabase
        .from('attendance_periods')
        .select('id, subject_id, subjects(name)')
        .eq('school_id', schoolId)
        .eq('class_id', classId)
        .gte('date', sinceStr)

    if (!periods || periods.length === 0) return []

    const periodIds = periods.map((p: any) => p.id)

    const { data: rows } = await supabase
        .from('attendance')
        .select('period_id, status')
        .in('period_id', periodIds)

    // Map periodId → subject
    const periodSubjectMap = new Map<string, { subjectId: string | null; subjectName: string }>()
    periods.forEach((p: any) => {
        periodSubjectMap.set(p.id, {
            subjectId: p.subject_id ?? null,
            subjectName: (p.subjects as any)?.name ?? 'Sans matière',
        })
    })

    // Accumulate per subject
    const subjectMap = new Map<string, {
        subjectId: string | null
        subjectName: string
        sessionIds: Set<string>
        present: number; absent: number; late: number; excused: number
    }>()

    periods.forEach((p: any) => {
        const key = p.subject_id ?? '__none__'
        if (!subjectMap.has(key)) {
            subjectMap.set(key, {
                subjectId: p.subject_id ?? null,
                subjectName: (p.subjects as any)?.name ?? 'Sans matière',
                sessionIds: new Set(),
                present: 0, absent: 0, late: 0, excused: 0,
            })
        }
        subjectMap.get(key)!.sessionIds.add(p.id)
    })

    ;(rows ?? []).forEach((row: any) => {
        const sub = periodSubjectMap.get(row.period_id)
        if (!sub) return
        const key = sub.subjectId ?? '__none__'
        const s = subjectMap.get(key)
        if (!s) return
        s[row.status as 'present' | 'absent' | 'late' | 'excused'] =
            (s[row.status as 'present' | 'absent' | 'late' | 'excused'] ?? 0) + 1
    })

    return Array.from(subjectMap.values())
        .map(s => {
            const total = s.present + s.absent + s.late + s.excused
            const rate = total > 0 ? Math.round(((s.present + s.late) / total) * 100) : null
            return {
                subjectId: s.subjectId,
                subjectName: s.subjectName,
                sessions: s.sessionIds.size,
                present: s.present,
                absent: s.absent,
                late: s.late,
                excused: s.excused,
                total,
                rate,
            }
        })
        .sort((a, b) => {
            if (a.rate === null && b.rate === null) return 0
            if (a.rate === null) return 1
            if (b.rate === null) return -1
            return a.rate - b.rate
        })
}

// ─── Missing attendance details for a class ───────────────────────────────────
// Returns the scheduled slots today for this class that have no attendance period

export async function getMissingAttendanceDetails(classId: string) {
    const ctx = await getSchoolAndUser()
    if (!ctx) return []

    const { supabase, schoolId } = ctx
    const today = new Date().toISOString().split('T')[0]

    // JS getDay(): 0=Sun … 6=Sat — same as PostgreSQL DOW convention
    const todayDow = new Date().getDay()

    // Scheduled slots for this class today
    const { data: slots } = await supabase
        .from('schedule')
        .select(`
            id, start_time, end_time, room, subject_id,
            subjects(name),
            profiles!schedule_teacher_id_fkey(id, full_name)
        `)
        .eq('school_id', schoolId)
        .eq('class_id', classId)
        .eq('day_of_week', todayDow)
        .order('start_time')

    if (!slots || slots.length === 0) {
        // No schedule found — fall back to teacher assignments
        const { data: assignments } = await supabase
            .from('teacher_assignments')
            .select(`
                subject_id,
                subjects(name),
                profiles!teacher_assignments_teacher_id_fkey(id, full_name)
            `)
            .eq('class_id', classId)
            .eq('school_id', schoolId)

        return (assignments ?? []).map((a: any) => ({
            id:          a.subject_id,
            teacherName: a.profiles?.full_name ?? '—',
            subjectName: a.subjects?.name ?? '—',
            startTime:   null,
            endTime:     null,
            room:        null,
            hasPeriod:   false,
        }))
    }

    // Which subject_ids already have a period today?
    const { data: periods } = await supabase
        .from('attendance_periods')
        .select('subject_id')
        .eq('school_id', schoolId)
        .eq('class_id', classId)
        .eq('date', today)

    const doneSubs = new Set((periods ?? []).map((p: any) => p.subject_id))

    return slots.map((s: any) => ({
        id:          s.id,
        teacherName: s.profiles?.full_name ?? '—',
        subjectName: s.subjects?.name ?? '—',
        startTime:   s.start_time ? s.start_time.slice(0, 5) : null,
        endTime:     s.end_time   ? s.end_time.slice(0, 5)   : null,
        room:        s.room ?? null,
        hasPeriod:   doneSubs.has(s.subject_id),
    }))
}

// ─── Class attendance stats (for reports tab) ─────────────────────────────────

export async function getClassAttendanceStats(classId: string, days = 30) {
    const ctx = await getSchoolAndUser()
    if (!ctx) return []

    const { supabase, schoolId } = ctx

    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toISOString().split('T')[0]

    const { data } = await supabase
        .from('attendance')
        .select('student_id, status, justified, date, profiles!attendance_student_id_fkey(full_name)')
        .eq('school_id', schoolId)
        .eq('class_id', classId)
        .gte('date', sinceStr)
        .order('date', { ascending: false })

    if (!data || data.length === 0) return []

    // Group by student
    const studentMap = new Map<string, {
        id: string
        name: string
        present: number
        absent: number
        late: number
        excused: number
        total: number
    }>()

    data.forEach((row: any) => {
        const sid = row.student_id
        if (!studentMap.has(sid)) {
            studentMap.set(sid, {
                id: sid,
                name: row.profiles?.full_name ?? '—',
                present: 0, absent: 0, late: 0, excused: 0, total: 0,
            })
        }
        const s = studentMap.get(sid)!
        s[row.status as keyof typeof s]++
        s.total++
    })

    return Array.from(studentMap.values())
        .sort((a, b) => a.name.localeCompare(b.name))
}
