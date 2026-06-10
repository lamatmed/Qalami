/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { getActionContext as getSchoolAndUser } from '@/lib/auth-action'
import { createAdminClient } from '@/utils/supabase/admin'

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

    // Delete existing records for this period before re-inserting — prevents duplicate rows
    // when the unique constraint on (period_id, student_id) is absent from the DB.
    const { error: delError } = await supabase
        .from('attendance')
        .delete()
        .eq('period_id', periodId)
    if (delError) return { error: delError.message }

    const { error } = await supabase
        .from('attendance')
        .insert(rows)

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

export async function getTodayOverview(todayStr?: string) {
    const ctx = await getSchoolAndUser(['admin', 'super_admin', 'school_staff', 'teacher', 'parent'])
    if (!ctx) return { classes: [], absentees: [], totalPresent: 0, totalAbsent: 0, schoolGlobalRate: null }

    const { supabase, schoolId } = ctx

    // Dynamic user-based localized today string or safe server-fallback
    let today = todayStr
    if (!today) {
        const now = new Date()
        today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    }

    const { data: classes } = await supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', schoolId)
        .order('name')

    const classIds = (classes ?? []).map((c: any) => c.id)
    if (classIds.length === 0) {
        return { classes: [], absentees: [], totalPresent: 0, totalAbsent: 0, schoolGlobalRate: null }
    }

    // Use Class IDs to scope attendance universally (since attendance table lacks school_id column)
    const [{ data: todayRows }, { data: allRows }] = await Promise.all([
        // Today's attendance
        supabase
            .from('attendance')
            .select('student_id, status, class_id, profiles!attendance_student_id_fkey(full_name)')
            .in('class_id', classIds)
            .eq('date', today),
        // Global cumulative history for rate calculations & last activity timestamps
        supabase
            .from('attendance')
            .select('class_id, date, status')
            .in('class_id', classIds)
    ])

    // Compute Global Aggregate Stats and Track Latest Date Per Class in a single loop
    let globalCount = 0
    let globalPres = 0
    const latestDateByClass = new Map<string, string>()

    ;(allRows ?? []).forEach((r: any) => {
        globalCount++
        if (r.status === 'present' || r.status === 'late') globalPres++

        const curr = latestDateByClass.get(r.class_id)
        if (!curr || r.date > curr) {
            latestDateByClass.set(r.class_id, r.date)
        }
    })

    const schoolGlobalRate = globalCount > 0 ? Math.round((globalPres / globalCount) * 100) : null

    const attendanceRows = todayRows ?? []

    // Stats per class for today
    const statsByClass = new Map<string, { present: number; absent: number; late: number; excused: number }>()
    attendanceRows.forEach((row: any) => {
        if (!statsByClass.has(row.class_id)) {
            statsByClass.set(row.class_id, { present: 0, absent: 0, late: 0, excused: 0 })
        }
        const s = statsByClass.get(row.class_id)!
        s[row.status as keyof typeof s] = (s[row.status as keyof typeof s] ?? 0) + 1
    })

    const classesWithStatus = (classes ?? []).map((c: any) => {
        const hasToday = statsByClass.has(c.id)
        const stats = statsByClass.get(c.id) ?? null
        const lastDate = latestDateByClass.get(c.id) ?? null
        return {
            id: c.id,
            name: c.name,
            level: null,
            hasDoneAttendance: hasToday,
            lastAttendanceDate: lastDate,
            periodStatus: hasToday ? 'closed' : null,
            stats,
        }
    })

    // Absentees today
    const absentees = attendanceRows
        .filter((r: any) => r.status === 'absent')
        .map((r: any) => ({
            studentId: r.student_id,
            studentName: (r.profiles as any)?.full_name ?? '—',
            classId: r.class_id,
            className: (classes ?? []).find((c: any) => c.id === r.class_id)?.name ?? '—',
        }))

    const totalPresent = attendanceRows.filter((r: any) => r.status === 'present' || r.status === 'late').length
    const totalAbsent  = attendanceRows.filter((r: any) => r.status === 'absent').length

    return {
        classes: classesWithStatus,
        absentees,
        totalPresent,
        totalAbsent,
        schoolGlobalRate
    }
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

export async function getClassPeriods(classId: string) {
    const ctx = await getSchoolAndUser()
    if (!ctx) return []

    const { supabase, schoolId } = ctx

    // First try attendance_periods
    const { data: periods } = await supabase
        .from('attendance_periods')
        .select('id, date, status, created_at, subjects(id, name)')
        .eq('school_id', schoolId)
        .eq('class_id', classId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

    if (periods && periods.length > 0) {
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

    // Fallback: build sessions from attendance table grouped by date
    const { data: rows } = await supabase
        .from('attendance')
        .select('date, status, subject_id, subjects(id, name)')
        .eq('school_id', schoolId)
        .eq('class_id', classId)
        .order('date', { ascending: false })

    if (!rows || rows.length === 0) return []

    const dateMap = new Map<string, {
        date: string
        subjectId: string | null
        subjectName: string | null
        stats: Record<string, number>
    }>()

    rows.forEach((row: any) => {
        const key = `${row.date}::${row.subject_id ?? 'null'}`
        if (!dateMap.has(key)) {
            dateMap.set(key, {
                date: row.date,
                subjectId: row.subject_id ?? null,
                subjectName: (row.subjects as any)?.name ?? null,
                stats: { present: 0, absent: 0, late: 0, excused: 0 },
            })
        }
        const entry = dateMap.get(key)!
        entry.stats[row.status] = (entry.stats[row.status] ?? 0) + 1
    })

    return Array.from(dateMap.values())
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((entry, idx) => ({
            id: `virtual-${entry.date}-${entry.subjectId ?? idx}`,
            date: entry.date,
            status: 'closed',
            subjectId: entry.subjectId,
            subjectName: entry.subjectName,
            stats: entry.stats,
        }))
}

// ─── Per-subject attendance stats for a class ─────────────────────────────────

export async function getSubjectStatsForClass(classId: string) {
    const ctx = await getSchoolAndUser()
    if (!ctx) return []

    const { supabase, schoolId } = ctx

    // Direct fallback: read from attendance table (works even without attendance_periods)
    const { data: attRows } = await supabase
        .from('attendance')
        .select('status, subject_id, subjects(name)')
        .eq('school_id', schoolId)
        .eq('class_id', classId)

    if (!attRows || attRows.length === 0) return []

    // Accumulate per subject
    const subjectMap = new Map<string, {
        subjectId: string | null
        subjectName: string
        sessionDates: Set<string>
        present: number; absent: number; late: number; excused: number
    }>()

    attRows.forEach((row: any) => {
        const key = row.subject_id ?? '__none__'
        if (!subjectMap.has(key)) {
            subjectMap.set(key, {
                subjectId: row.subject_id ?? null,
                subjectName: (row.subjects as any)?.name ?? 'Sans matière',
                sessionDates: new Set(),
                present: 0, absent: 0, late: 0, excused: 0,
            })
        }
        const s = subjectMap.get(key)!
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
                sessions: s.sessionDates.size,
                present: s.present,
                absent: s.absent,
                late: s.late,
                excused: s.excused,
                total,
                rate,
            }
        })
        .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))
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

export async function getClassAttendanceStats(classId: string) {
    const ctx = await getSchoolAndUser()
    if (!ctx) return []

    const { supabase, schoolId } = ctx

    const [enrollmentsRes, attendanceRes] = await Promise.all([
        supabase
            .from('enrollments')
            .select('student_id, profiles!enrollments_student_id_fkey(id, full_name)')
            .eq('class_id', classId)
            .eq('school_id', schoolId),
        supabase
            .from('attendance')
            .select('student_id, status')
            .eq('school_id', schoolId)
            .eq('class_id', classId)
    ])

    const studentMap = new Map<string, {
        id: string
        name: string
        present: number
        absent: number
        late: number
        excused: number
        total: number
    }>()

    ;(enrollmentsRes.data ?? []).forEach((row: any) => {
        studentMap.set(row.student_id, {
            id: row.student_id,
            name: row.profiles?.full_name ?? '—',
            present: 0, absent: 0, late: 0, excused: 0, total: 0,
        })
    })

    ;(attendanceRes.data ?? []).forEach((row: any) => {
        const s = studentMap.get(row.student_id)
        if (s) {
            const statusKey = row.status as 'present' | 'absent' | 'late' | 'excused'
            if (statusKey in s) {
                s[statusKey]++
            }
            s.total++
        }
    })

    return Array.from(studentMap.values())
        .sort((a, b) => a.name.localeCompare(b.name))
}

export async function getClassAttendanceDetails(classId: string) {
    try {
        const ctx = await getSchoolAndUser(['admin', 'super_admin', 'school_staff', 'teacher', 'parent'])
        if (!ctx) return { periods: [], subjectStats: [], enrolled: [], stats: [] }

        const { supabase, schoolId } = ctx

        // ── Strategy: group directly from the attendance table by (date, subject_id).
        // This merges stale/duplicate attendance_periods automatically and includes
        // both admin-portal (period_id) and teacher-portal (no period_id) records.

        // 1. All attendance records for this class
        const { data: attRows } = await supabase
            .from('attendance')
            .select('student_id, status, date, subject_id')
            .eq('class_id', classId)
            .order('date', { ascending: false })

        // 2. Period statuses: open overrides closed within the same (date, subject_id)
        const { data: apRows } = await supabase
            .from('attendance_periods')
            .select('date, subject_id, status')
            .eq('school_id', schoolId)
            .eq('class_id', classId)

        const statusMap = new Map<string, string>()
        ;(apRows ?? []).forEach((p: any) => {
            const k = `${p.date}::${p.subject_id ?? 'null'}`
            if (!statusMap.has(k) || p.status === 'open') statusMap.set(k, p.status as string)
        })

        // 3. Group attendance by (date, subject_id); dedup by student_id keeping worst status
        const WR: Record<string, number> = { absent: 0, late: 1, excused: 2, present: 3 }
        const groupMap = new Map<string, { date: string; subjectId: string | null; students: Map<string, string> }>()

        ;(attRows ?? []).forEach((r: any) => {
            const key = `${r.date}::${r.subject_id ?? 'null'}`
            if (!groupMap.has(key)) {
                groupMap.set(key, { date: r.date, subjectId: r.subject_id ?? null, students: new Map() })
            }
            const g = groupMap.get(key)!
            const ex = g.students.get(r.student_id)
            if (!ex || (WR[r.status] ?? 99) < (WR[ex] ?? 99)) {
                g.students.set(r.student_id, r.status as string)
            }
        })

        // 4. Subject names
        const subjectIds = [...new Set([...groupMap.values()].map(g => g.subjectId).filter(Boolean))] as string[]
        const subjectNameMap = new Map<string, string>()
        if (subjectIds.length > 0) {
            const { data: subs } = await supabase.from('subjects').select('id, name').in('id', subjectIds)
            ;(subs ?? []).forEach((s: any) => subjectNameMap.set(s.id as string, s.name as string))
        }

        // 5. Build one period per (date, subject_id)
        const builtPeriods: any[] = [...groupMap.entries()].map(([key, g]) => {
            const stats = { present: 0, absent: 0, late: 0, excused: 0 }
            g.students.forEach(st => { ;(stats as any)[st] = ((stats as any)[st] ?? 0) + 1 })
            return {
                id: `grp-${key}`,
                date: g.date,
                status: statusMap.get(key) ?? 'closed',
                subjectId: g.subjectId,
                subjectName: g.subjectId ? (subjectNameMap.get(g.subjectId) ?? null) : null,
                startTime: null,
                endTime: null,
                teacherName: null,
                stats,
            }
        }).sort((a, b) => b.date.localeCompare(a.date))

        // 6. Subject stats across all sessions
        const subjectStatMap = new Map<string, { subjectId: string | null; subjectName: string; sessionCount: number; present: number; absent: number; late: number; excused: number }>()
        builtPeriods.forEach((p: any) => {
            const key = p.subjectId ?? '__none__'
            if (!subjectStatMap.has(key)) {
                subjectStatMap.set(key, { subjectId: p.subjectId, subjectName: p.subjectName ?? 'Sans matière', sessionCount: 0, present: 0, absent: 0, late: 0, excused: 0 })
            }
            const s = subjectStatMap.get(key)!
            s.sessionCount++; s.present += p.stats.present; s.absent += p.stats.absent; s.late += p.stats.late; s.excused += p.stats.excused
        })
        const builtSubjectStats = [...subjectStatMap.values()].map(s => {
            const total = s.present + s.absent + s.late + s.excused
            return { ...s, total, rate: total > 0 ? Math.round(((s.present + s.late) / total) * 100) : null }
        }).sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))

        // 7. Enrolled students
        const { data: enrollData } = await supabase
            .from('enrollments')
            .select('student_id, profiles!enrollments_student_id_fkey(id, full_name, avatar_url)')
            .eq('school_id', schoolId).eq('class_id', classId).order('student_id')
        const builtEnrolled = (enrollData ?? []).map((e: any) => ({
            id: e.student_id, full_name: e.profiles?.full_name ?? '—', avatar_url: e.profiles?.avatar_url ?? null,
        }))

        // 8. Per-student overall stats (from grouped data — no double-counting)
        const studentMap = new Map<string, { id: string; name: string; present: number; absent: number; late: number; excused: number; total: number }>()
        builtEnrolled.forEach(e => studentMap.set(e.id, { id: e.id, name: e.full_name, present: 0, absent: 0, late: 0, excused: 0, total: 0 }))
        groupMap.forEach(g => {
            g.students.forEach((status, sid) => {
                if (!studentMap.has(sid)) studentMap.set(sid, { id: sid, name: '—', present: 0, absent: 0, late: 0, excused: 0, total: 0 })
                const s = studentMap.get(sid)!
                ;(s as any)[status] = ((s as any)[status] ?? 0) + 1
                s.total++
            })
        })

        return {
            periods: builtPeriods,
            subjectStats: builtSubjectStats,
            enrolled: builtEnrolled,
            stats: [...studentMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
        }

    } catch (e) {
        console.error('getClassAttendanceDetails server error:', e)
        return { periods: [], subjectStats: [], enrolled: [], stats: [] }
    }
}

export async function getClassAttendanceDetails_OLD_UNUSED(classId: string) {
    try {
        const ctx = await getSchoolAndUser(['admin', 'super_admin', 'school_staff', 'teacher', 'parent'])
        if (!ctx) return { periods: [], subjectStats: [], enrolled: [], stats: [] }

        const { supabase, schoolId } = ctx

        // ── 1. Fetch attendance_periods (raw, no enrichment — client will enrich with schedule)
        const { data: apRows } = await supabase
            .from('attendance_periods')
            .select('id, date, status, start_time, end_time, subject_id')
            .eq('school_id', schoolId)
            .eq('class_id', classId)
            .order('date', { ascending: false })

        // ── 2. Stats per period — deduplicate by (period_id, student_id), keep worst status
        const periodIds = (apRows ?? []).map((p: any) => p.id as string).filter(Boolean)
        const statsByPeriod = new Map<string, { present: number; absent: number; late: number; excused: number }>()
        if (periodIds.length > 0) {
            const { data: pRows } = await supabase
                .from('attendance')
                .select('period_id, student_id, status')
                .in('period_id', periodIds)
            const WORST_RANK: Record<string, number> = { absent: 0, late: 1, excused: 2, present: 3 }
            const bestByStudentPeriod = new Map<string, { periodId: string; status: string }>()
            ;(pRows ?? []).forEach((r: any) => {
                const key = `${r.period_id}::${r.student_id}`
                const existing = bestByStudentPeriod.get(key)
                const newRank  = WORST_RANK[r.status as string] ?? 99
                const oldRank  = existing ? (WORST_RANK[existing.status] ?? 99) : 99
                if (!existing || newRank < oldRank) {
                    bestByStudentPeriod.set(key, { periodId: r.period_id, status: r.status })
                }
            })
            bestByStudentPeriod.forEach(({ periodId, status }) => {
                if (!statsByPeriod.has(periodId)) statsByPeriod.set(periodId, { present: 0, absent: 0, late: 0, excused: 0 })
                const s = statsByPeriod.get(periodId)!
                ;(s as any)[status] = ((s as any)[status] ?? 0) + 1
            })
        }

        // ── 3. Subject names for subject_ids in attendance_periods
        const apSubjectIds = [...new Set((apRows ?? []).map((p: any) => p.subject_id).filter(Boolean))] as string[]
        let subjectNameMap = new Map<string, string>()
        if (apSubjectIds.length > 0) {
            const { data: subjectRows } = await supabase
                .from('subjects')
                .select('id, name')
                .in('id', apSubjectIds)
            subjectNameMap = new Map((subjectRows ?? []).map((s: any) => [s.id as string, s.name as string]))
        }

        // ── 4. Build periods — no schedule enrichment (handled client-side by getClassSchedule)
        let builtPeriods: any[]
        if ((apRows ?? []).length > 0) {
            builtPeriods = (apRows ?? []).map((p: any) => ({
                id: p.id as string,
                date: p.date as string,
                status: (p.status ?? 'closed') as string,
                subjectId: (p.subject_id ?? null) as string | null,
                subjectName: p.subject_id ? (subjectNameMap.get(p.subject_id) ?? null) : null,
                startTime: (p.start_time ?? null) as string | null,
                endTime: (p.end_time ?? null) as string | null,
                teacherName: null as string | null,
                stats: statsByPeriod.get(p.id) ?? { present: 0, absent: 0, late: 0, excused: 0 },
            }))
        } else {
            // Fallback: unique dates from attendance table
            const { data: attDates } = await supabase
                .from('attendance')
                .select('date, status')
                .eq('class_id', classId)
                .order('date', { ascending: false })
            const dateStats = new Map<string, { present: number; absent: number; late: number; excused: number }>()
            ;(attDates ?? []).forEach((r: any) => {
                if (!dateStats.has(r.date)) dateStats.set(r.date, { present: 0, absent: 0, late: 0, excused: 0 })
                const s = dateStats.get(r.date)!
                ;(s as any)[r.status] = ((s as any)[r.status] ?? 0) + 1
            })
            builtPeriods = [...dateStats.entries()].map(([date, stats]) => ({
                id: `virtual-${date}`,
                date,
                status: 'closed',
                subjectId: null,
                subjectName: null,
                startTime: null,
                endTime: null,
                teacherName: null,
                stats,
            }))
        }

        // ── 4b. Virtual periods for teacher-portal attendance (no attendance_period entry)
        // attendance_periods only captures admin-initiated sessions. Teacher-portal records
        // go directly to attendance table with subject_id but no period_id. Add them as
        // virtual periods so every subject shows in the detail page.
        if ((apRows ?? []).length >= 0) {
            // Keys already covered by real periods
            const coveredKeys = new Set(
                (apRows ?? []).map((p: any) => `${p.date}::${p.subject_id ?? 'null'}`)
            )

            const { data: directRows } = await supabase
                .from('attendance')
                .select('date, subject_id, status, student_id')
                .eq('class_id', classId)
                .order('date', { ascending: false })

            // Group uncovered rows by (date::subjectId), dedup by student_id keeping worst status
            const uncoveredGroups = new Map<string, { date: string; subjectId: string | null }>()
            const bestDirect = new Map<string, { groupKey: string; status: string }>()
            const WR2: Record<string, number> = { absent: 0, late: 1, excused: 2, present: 3 }

            ;(directRows ?? []).forEach((r: any) => {
                const groupKey = `${r.date}::${r.subject_id ?? 'null'}`
                if (coveredKeys.has(groupKey)) return
                if (!uncoveredGroups.has(groupKey)) {
                    uncoveredGroups.set(groupKey, { date: r.date, subjectId: r.subject_id ?? null })
                }
                const studentKey = `${groupKey}::${r.student_id}`
                const ex = bestDirect.get(studentKey)
                if (!ex || (WR2[r.status] ?? 99) < (WR2[ex.status] ?? 99)) {
                    bestDirect.set(studentKey, { groupKey, status: r.status })
                }
            })

            // Accumulate stats per group
            const groupStats = new Map<string, { present: number; absent: number; late: number; excused: number }>()
            bestDirect.forEach(({ groupKey, status }) => {
                if (!groupStats.has(groupKey)) groupStats.set(groupKey, { present: 0, absent: 0, late: 0, excused: 0 })
                const s = groupStats.get(groupKey)!
                ;(s as any)[status] = ((s as any)[status] ?? 0) + 1
            })

            // Resolve subject names for any new subject_ids not already in subjectNameMap
            const newSubIds = [...new Set([...uncoveredGroups.values()].map(g => g.subjectId).filter(Boolean))] as string[]
            const missingIds = newSubIds.filter(id => !subjectNameMap.has(id))
            if (missingIds.length > 0) {
                const { data: extraSubs } = await supabase.from('subjects').select('id, name').in('id', missingIds)
                ;(extraSubs ?? []).forEach((s: any) => subjectNameMap.set(s.id as string, s.name as string))
            }

            uncoveredGroups.forEach((g, groupKey) => {
                builtPeriods.push({
                    id: `virtual-${groupKey}`,
                    date: g.date,
                    status: 'closed',
                    subjectId: g.subjectId,
                    subjectName: g.subjectId ? (subjectNameMap.get(g.subjectId) ?? null) : null,
                    startTime: null,
                    endTime: null,
                    teacherName: null,
                    stats: groupStats.get(groupKey) ?? { present: 0, absent: 0, late: 0, excused: 0 },
                })
            })
        }

        // ── 5. Subject Stats (grouped by subjectId across all periods)
        const subjectStatMap = new Map<string, {
            subjectId: string | null; subjectName: string
            sessionCount: number
            present: number; absent: number; late: number; excused: number
        }>()
        builtPeriods.forEach((p: any) => {
            const key = p.subjectId ?? '__none__'
            if (!subjectStatMap.has(key)) {
                subjectStatMap.set(key, {
                    subjectId: p.subjectId,
                    subjectName: p.subjectName ?? 'Sans matière',
                    sessionCount: 0,
                    present: 0, absent: 0, late: 0, excused: 0,
                })
            }
            const s = subjectStatMap.get(key)!
            s.sessionCount++
            s.present += p.stats.present
            s.absent += p.stats.absent
            s.late += p.stats.late
            s.excused += p.stats.excused
        })
        const builtSubjectStats = Array.from(subjectStatMap.values())
            .map(s => {
                const total = s.present + s.absent + s.late + s.excused
                const rate = total > 0 ? Math.round(((s.present + s.late) / total) * 100) : null
                return {
                    subjectId: s.subjectId,
                    subjectName: s.subjectName,
                    sessions: s.sessionCount,
                    present: s.present,
                    absent: s.absent,
                    late: s.late,
                    excused: s.excused,
                    total,
                    rate,
                }
            })
            .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))

        // 3. Fetch Enrolled Students
        const { data: enrollData } = await supabase
            .from('enrollments')
            .select('student_id, profiles!enrollments_student_id_fkey(id, full_name, avatar_url)')
            .eq('school_id', schoolId)
            .eq('class_id', classId)
            .order('student_id')

        const builtEnrolled = (enrollData ?? []).map((e: any) => ({
            id: e.student_id,
            full_name: e.profiles?.full_name ?? '—',
            avatar_url: e.profiles?.avatar_url ?? null,
        }))

        // 4. Fetch Student Stats
        const { data: attStatsRows } = await supabase
            .from('attendance')
            .select('student_id, status, profiles!attendance_student_id_fkey(id, full_name)')
            .eq('class_id', classId)

        const studentMap = new Map<string, {
            id: string
            name: string
            present: number
            absent: number
            late: number
            excused: number
            total: number
        }>()

        builtEnrolled.forEach(e => {
            studentMap.set(e.id, {
                id: e.id,
                name: e.full_name,
                present: 0, absent: 0, late: 0, excused: 0, total: 0,
            })
        })

        ;(attStatsRows ?? []).forEach((row: any) => {
            if (!studentMap.has(row.student_id)) {
                const studentName = (row.profiles as any)?.full_name ?? '—'
                studentMap.set(row.student_id, {
                    id: row.student_id,
                    name: studentName,
                    present: 0, absent: 0, late: 0, excused: 0, total: 0,
                })
            }
            const s = studentMap.get(row.student_id)!
            const statusKey = row.status as 'present' | 'absent' | 'late' | 'excused'
            if (statusKey in s) {
                s[statusKey]++
            }
            s.total++
        })

        const builtStats = Array.from(studentMap.values())
            .sort((a, b) => a.name.localeCompare(b.name))

        return {
            periods: builtPeriods,
            subjectStats: builtSubjectStats,
            enrolled: builtEnrolled,
            stats: builtStats,
        }

    } catch (e) {
        console.error('getClassAttendanceDetails server error:', e)
        return { periods: [], subjectStats: [], enrolled: [], stats: [] }
    }
}

// ─── Schedule slots for a class (for client-side period enrichment) ───────────

export async function getClassSchedule(classId: string) {
    const ctx = await getSchoolAndUser(['admin', 'super_admin', 'school_staff', 'teacher', 'parent'])
    if (!ctx) return []
    const { schoolId } = ctx
    // Use adminClient — schedule table has RLS that may block non-teacher roles
    const admin = createAdminClient()

    const { data } = await admin
        .from('schedule')
        .select(`
            subject_id, day_of_week, start_time, end_time,
            subjects!schedule_subject_id_fkey(id, name),
            profiles!schedule_teacher_id_fkey(full_name, phone)
        `)
        .eq('school_id', schoolId)
        .eq('class_id', classId)

    return (data ?? []).map((s: any) => ({
        subjectId: (s.subject_id as string | null) ?? null,
        subjectName: (s.subjects as any)?.name ?? null,
        dayOfWeek: s.day_of_week as number,
        startTime: (s.start_time as string | null) ?? null,
        endTime: (s.end_time as string | null) ?? null,
        teacherName: (s.profiles as any)?.full_name ?? null,
    }))
}

// ─── Today's attendance for a class (per-student status) ─────────────────────

export async function getTodayClassAttendance(classId: string) {
    const ctx = await getSchoolAndUser()
    if (!ctx) return { students: [], date: '', hasData: false }

    const { supabase, schoolId } = ctx

    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    const [enrolledRes, attendanceRes] = await Promise.all([
        supabase
            .from('enrollments')
            .select('student_id, profiles!enrollments_student_id_fkey(id, full_name, avatar_url)')
            .eq('class_id', classId)
            .eq('school_id', schoolId)
            .eq('status', 'active')
            .order('student_id'),
        supabase
            .from('attendance')
            .select('student_id, status')
            .eq('class_id', classId)
            .eq('date', today),
    ])

    const enrolled = enrolledRes.data ?? []
    const attendance = attendanceRes.data ?? []
    const statusMap = new Map(attendance.map((a: any) => [a.student_id, a.status as string]))

    const students = (enrolled as any[]).map(e => ({
        id: e.student_id as string,
        name: (e.profiles as any)?.full_name ?? '—',
        status: (statusMap.get(e.student_id) ?? null) as string | null,
    })).sort((a, b) => a.name.localeCompare(b.name))

    return { students, date: today, hasData: attendance.length > 0 }
}

// ─── Today's periods (all appels of the day) with subject + times + stats ──────

export async function getTodayPeriods(todayStr: string) {
    const ctx = await getSchoolAndUser()
    if (!ctx) return []

    const { supabase, schoolId } = ctx

    // Resolve class IDs for this school
    const { data: classes } = await supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', schoolId)

    const classIds = (classes ?? []).map((c: any) => c.id as string)
    if (classIds.length === 0) return []

    const classNameMap = new Map((classes ?? []).map((c: any) => [c.id as string, c.name as string]))

    // ── 0. Fetch today's schedule slots to enrich times + teacher info
    const [y, m, d] = todayStr.split('-').map(Number)
    const todayDow = new Date(y, m - 1, d).getDay() // 0=Sun…6=Sat

    const admin = createAdminClient()
    const { data: scheduleSlots } = await admin
        .from('schedule')
        .select(`
            class_id, subject_id, start_time, end_time,
            subjects!schedule_subject_id_fkey(id, name),
            profiles!schedule_teacher_id_fkey(full_name, phone)
        `)
        .eq('school_id', schoolId)
        .in('class_id', classIds)
        .eq('day_of_week', todayDow)

    type SchedData = { startTime: string | null; endTime: string | null; teacherName: string | null; teacherPhone: string | null; subjectId: string | null; subjectName: string | null }
    // Map key: "classId::subjectId" (or "classId::null")
    const scheduleMap = new Map<string, SchedData>()
    // Fallback map: "classId" → first schedule slot for that class (for null-subject periods)
    const scheduleByClass = new Map<string, SchedData>()
    // Sort ASC by start_time so the latest slot wins (last-set wins in Map) — prevents stale earlier entries
    const sortedSlots = [...(scheduleSlots ?? [])].sort(
        (a: any, b: any) => (a.start_time ?? '').localeCompare(b.start_time ?? '')
    )
    sortedSlots.forEach((s: any) => {
        const data: SchedData = {
            startTime: s.start_time ?? null,
            endTime: s.end_time ?? null,
            teacherName: (s.profiles as any)?.full_name ?? null,
            teacherPhone: (s.profiles as any)?.phone ?? null,
            subjectId: s.subject_id ?? null,
            subjectName: (s.subjects as any)?.name ?? null,
        }
        scheduleMap.set(`${s.class_id}::${s.subject_id ?? 'null'}`, data)
        if (!scheduleByClass.has(s.class_id)) scheduleByClass.set(s.class_id, data)
    })

    // ── 1. Fetch from attendance_periods (preferred — has start/end times)
    const { data: periods } = await supabase
        .from('attendance_periods')
        .select(`
            id, class_id, date, start_time, end_time, status,
            subjects(id, name)
        `)
        .in('class_id', classIds)
        .eq('date', todayStr)
        .order('start_time', { ascending: true, nullsFirst: false })

    const periodIds = (periods ?? []).map((p: any) => p.id as string)
    const classesWithPeriod = new Set((periods ?? []).map((p: any) => p.class_id as string))

    // Stats per period — deduplicate by (period_id, student_id), keep worst status
    const statsMap = new Map<string, { present: number; absent: number; late: number; excused: number }>()
    if (periodIds.length > 0) {
        const { data: pRows } = await supabase
            .from('attendance')
            .select('period_id, student_id, status')
            .in('period_id', periodIds)

        const WR: Record<string, number> = { absent: 0, late: 1, excused: 2, present: 3 }
        const bestSP = new Map<string, { periodId: string; status: string }>()
        ;(pRows ?? []).forEach((row: any) => {
            const k = `${row.period_id}::${row.student_id}`
            const ex = bestSP.get(k)
            if (!ex || (WR[row.status] ?? 99) < (WR[ex.status] ?? 99)) {
                bestSP.set(k, { periodId: row.period_id, status: row.status })
            }
        })
        bestSP.forEach(({ periodId, status }) => {
            if (!statsMap.has(periodId)) statsMap.set(periodId, { present: 0, absent: 0, late: 0, excused: 0 })
            const s = statsMap.get(periodId)!
            ;(s as any)[status] = ((s as any)[status] ?? 0) + 1
        })
    }

    const result = (periods ?? []).map((p: any) => {
        const subjectId = (p.subjects as any)?.id ?? null
        const subjectName = (p.subjects as any)?.name ?? null
        let sched = scheduleMap.get(`${p.class_id}::${subjectId ?? 'null'}`)
        if (!sched && !subjectId) sched = scheduleByClass.get(p.class_id)
        return {
            id: p.id as string,
            classId: p.class_id as string,
            className: classNameMap.get(p.class_id) ?? '—',
            subjectId: subjectId ?? sched?.subjectId ?? null,
            subjectName: subjectName ?? sched?.subjectName ?? null,
            startTime: (p.start_time as string | null) ?? sched?.startTime ?? null,
            endTime: (p.end_time as string | null) ?? sched?.endTime ?? null,
            teacherName: sched?.teacherName ?? null,
            teacherPhone: sched?.teacherPhone ?? null,
            status: p.status as string,
            stats: statsMap.get(p.id) ?? { present: 0, absent: 0, late: 0, excused: 0 },
            synthetic: false,
        }
    })

    // ── 2. For classes with NO period record, build synthetic appels from attendance table
    const classesWithoutPeriod = classIds.filter(id => !classesWithPeriod.has(id))
    if (classesWithoutPeriod.length > 0) {
        const { data: directRows } = await supabase
            .from('attendance')
            .select('class_id, subject_id, status, subjects(id, name)')
            .in('class_id', classesWithoutPeriod)
            .eq('date', todayStr)

        // Group by (class_id, subject_id)
        const syntheticMap = new Map<string, {
            classId: string; subjectId: string | null; subjectName: string | null
            stats: { present: number; absent: number; late: number; excused: number }
        }>()

        ;(directRows ?? []).forEach((row: any) => {
            const key = `${row.class_id}::${row.subject_id ?? 'null'}`
            if (!syntheticMap.has(key)) {
                syntheticMap.set(key, {
                    classId: row.class_id,
                    subjectId: row.subject_id ?? null,
                    subjectName: (row.subjects as any)?.name ?? null,
                    stats: { present: 0, absent: 0, late: 0, excused: 0 },
                })
            }
            const entry = syntheticMap.get(key)!
            entry.stats[row.status as keyof typeof entry.stats] =
                (entry.stats[row.status as keyof typeof entry.stats] ?? 0) + 1
        })

        syntheticMap.forEach(entry => {
            let sched = scheduleMap.get(`${entry.classId}::${entry.subjectId ?? 'null'}`)
            if (!sched && !entry.subjectId) sched = scheduleByClass.get(entry.classId)
            result.push({
                id: `syn-${entry.classId}-${entry.subjectId ?? 'none'}`,
                classId: entry.classId,
                className: classNameMap.get(entry.classId) ?? '—',
                subjectId: entry.subjectId ?? sched?.subjectId ?? null,
                subjectName: entry.subjectName ?? sched?.subjectName ?? null,
                startTime: sched?.startTime ?? null,
                endTime: sched?.endTime ?? null,
                teacherName: sched?.teacherName ?? null,
                teacherPhone: sched?.teacherPhone ?? null,
                status: 'closed',
                stats: entry.stats,
                synthetic: true,
            })
        })
    }

    // ── 3. Add schedule slots for today that have NO matching period yet
    // For each (classId, subjectId) group: compare slot count vs period count.
    // Match by startTime when possible; fall back to count-based diff.

    // Build coverage: count of existing periods + their startTimes per (classId::subjectId)
    const periodCoverage = new Map<string, { count: number; times: Set<string> }>()
    result.forEach(r => {
        const key = `${r.classId}::${r.subjectId ?? 'null'}`
        if (!periodCoverage.has(key)) periodCoverage.set(key, { count: 0, times: new Set() })
        const c = periodCoverage.get(key)!
        c.count++
        if (r.startTime) c.times.add(r.startTime)
    })

    // Deduplicate schedule slots by (classId::subjectId::startTime) — removes DB duplicates
    const seenSlotKeys = new Set<string>()
    const dedupedSlots = (scheduleSlots ?? []).filter((s: any) => {
        const k = `${s.class_id}::${s.subject_id ?? 'null'}::${s.start_time ?? 'null'}`
        if (seenSlotKeys.has(k)) return false
        seenSlotKeys.add(k)
        return true
    })

    // Group deduplicated schedule slots by (classId::subjectId), sorted by start_time
    const slotGroups = new Map<string, any[]>()
    dedupedSlots.forEach((s: any) => {
        const key = `${s.class_id}::${s.subject_id ?? 'null'}`
        if (!slotGroups.has(key)) slotGroups.set(key, [])
        slotGroups.get(key)!.push(s)
    })

    const makePending = (s: any) => ({
        id: `pending-${s.class_id}-${s.subject_id ?? 'none'}-${s.start_time ?? 'x'}`,
        classId: s.class_id as string,
        className: classNameMap.get(s.class_id) ?? '—',
        subjectId: (s.subject_id ?? null) as string | null,
        subjectName: (s.subjects as any)?.name ?? null,
        startTime: (s.start_time ?? null) as string | null,
        endTime: (s.end_time ?? null) as string | null,
        teacherName: (s.profiles as any)?.full_name ?? null,
        teacherPhone: (s.profiles as any)?.phone ?? null,
        status: 'pending',
        stats: { present: 0, absent: 0, late: 0, excused: 0 },
        synthetic: false,
    })

    slotGroups.forEach((slots, key) => {
        const cov = periodCoverage.get(key) ?? { count: 0, times: new Set<string>() }
        const sorted = [...slots].sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''))

        if (cov.count === 0) {
            // No periods at all → every slot is pending
            sorted.forEach((s: any) => result.push(makePending(s)))
            return
        }

        if (cov.count >= sorted.length) return  // all slots covered

        // Periods exist but fewer than schedule slots.
        // Only add pending if at least one existing period's startTime matches a slot EXACTLY.
        // If none match (schedule is stale / times shifted), skip to avoid false "À faire" entries.
        const hasExactMatch = sorted.some(
            (s: any) => s.start_time && cov.times.has(s.start_time as string)
        )
        if (!hasExactMatch) return

        // Add pending only for unmatched slots
        const unmatched = sorted.filter(
            (s: any) => !s.start_time || !cov.times.has(s.start_time as string)
        )
        const needed = sorted.length - cov.count
        unmatched.slice(0, needed).forEach((s: any) => result.push(makePending(s)))
    })

    // Deduplicate by id (safety net), then sort by classId + startTime
    const seen = new Set<string>()
    const deduped = result.filter(r => {
        if (seen.has(r.id)) return false
        seen.add(r.id)
        return true
    })

    deduped.sort((a, b) => {
        if (a.classId !== b.classId) return a.classId.localeCompare(b.classId)
        const ta = a.startTime ?? '99:99'
        const tb = b.startTime ?? '99:99'
        return ta.localeCompare(tb)
    })

    return deduped
}
