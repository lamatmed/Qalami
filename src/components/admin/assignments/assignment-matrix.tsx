'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Plus, X, Loader2, Search, GripVertical, AlertTriangle, UserCheck, Phone, Fingerprint } from 'lucide-react'
import { cn } from '@/lib/utils'
import { upsertAssignment, removeAssignment } from '@/app/admin/assignments/actions'
import { toast } from 'sonner'
import { getMySchoolContext, getSchoolLinkedProfileIds, secureFetchProfiles } from '@/app/admin/actions'
import { useLanguage } from '@/i18n'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Teacher { id: string; name: string; phone?: string; nni?: string }
interface Klass   { id: string; name: string }
interface Subject { id: string; name: string }

interface Assignment {
    id: string
    teacherId: string
    teacherName: string
    teacherPhone?: string
    teacherNni?: string
    classId: string
    subjectId: string
}

interface ActiveCell {
    subjectId: string
    subjectName: string
    classId: string
    className: string
    mode: 'view' | 'pick'
    assignment: Assignment | null
    rect: DOMRect
}

interface DragInfo {
    assignmentId: string
    teacherId: string
    teacherName: string
    subjectId: string
    classId: string
}

function initials(name: string) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AssignmentMatrix() {
    const { t } = useLanguage()
    const [teachers,    setTeachers]    = useState<Teacher[]>([])
    const [classes,     setClasses]     = useState<Klass[]>([])
    const [subjects,    setSubjects]    = useState<Subject[]>([])
    const [assignments, setAssignments] = useState<Assignment[]>([])
    const [loading,     setLoading]     = useState(true)

    const [activeCell,    setActiveCell]    = useState<ActiveCell | null>(null)
    const [teacherSearch, setTeacherSearch] = useState('')
    const [dragInfo,      setDragInfo]      = useState<DragInfo | null>(null)
    const [dragOverCell,  setDragOverCell]  = useState<{ subjectId: string; classId: string } | null>(null)
    const [operating,     setOperating]     = useState(false)
    const popoverRef = useRef<HTMLDivElement>(null)

    // ── Data fetch ───────────────────────────────────────────────────────────

    useEffect(() => {
        const fetchAll = async () => {
            const ctx = await getMySchoolContext()
            if (!ctx) { setLoading(false); return }
            const schoolId = ctx.school_id
            const supabase = createClient()

            const [
                { data: classesData },
                { data: subjectsData },
            ] = await Promise.all([
                supabase.from('classes').select('id, name').eq('school_id', schoolId).order('name'),
                supabase.from('subjects').select('id, name').eq('school_id', schoolId).order('name'),
            ])

            const classIds = (classesData || []).map((c: any) => c.id)

            const { data: directT } = await supabase.from('profiles')
                .select('id')
                .eq('role', 'teacher').eq('school_id', schoolId)

            let assignedIds: string[] = []
            if (classIds.length > 0) {
                const { data: existingAssignments } = await supabase
                    .from('teacher_assignments')
                    .select('teacher_id')
                    .in('class_id', classIds)
                assignedIds = (existingAssignments || []).map((a: any) => a.teacher_id)
            }

            const schoolLinkedIds = await getSchoolLinkedProfileIds(schoolId, 'teacher')

            const uniqueTeacherIds = Array.from(new Set([
                ...(directT || []).map(p => p.id),
                ...assignedIds,
                ...schoolLinkedIds
            ]))

            const teachersData = await secureFetchProfiles(uniqueTeacherIds, 'id, full_name, phone, national_id')

            const { data: assignData } = classIds.length > 0
                ? await supabase
                    .from('teacher_assignments')
                    .select('id, teacher_id, class_id, subject_id, profiles:teacher_id(full_name, phone, national_id)')
                    .in('class_id', classIds)
                : { data: [] }

            setClasses(classesData  || [])
            setSubjects(subjectsData || [])
            setTeachers((teachersData || []).map((t: any) => ({
                id:   t.id,
                name: t.full_name || t('admin.assignments.defaultTeacher'),
                phone: t.phone,
                nni:  t.national_id,
            })))
            setAssignments((assignData as any[] || []).map((a: any) => ({
                id:           a.id,
                teacherId:    a.teacher_id,
                teacherName:  (a.profiles as any)?.full_name || '—',
                teacherPhone: (a.profiles as any)?.phone,
                teacherNni:   (a.profiles as any)?.national_id,
                classId:      a.class_id,
                subjectId:    a.subject_id,
            })))
            setLoading(false)
        }
        fetchAll()
    }, [])

    // ── Matrix ────────────────────────────────────────────────────────────────

    const matrix = useMemo(() => {
        const m = new Map<string, Map<string, Assignment | null>>()
        subjects.forEach(s => {
            const row = new Map<string, Assignment | null>()
            classes.forEach(c => row.set(c.id, null))
            m.set(s.id, row)
        })
        assignments.forEach(a => m.get(a.subjectId)?.set(a.classId, a))
        return m
    }, [subjects, classes, assignments])

    // ── Close on outside click ────────────────────────────────────────────────

    useEffect(() => {
        if (!activeCell) return
        const close = () => { setActiveCell(null); setTeacherSearch('') }
        const onScroll = (e: Event) => {
            if (popoverRef.current?.contains(e.target as Node)) return
            close()
        }
        document.addEventListener('click', close)
        window.addEventListener('scroll', onScroll, true)
        return () => {
            document.removeEventListener('click', close)
            window.removeEventListener('scroll', onScroll, true)
        }
    }, [!!activeCell])

    // ── Teacher search ────────────────────────────────────────────────────────

    const filteredTeachers = useMemo(() => {
        if (!teacherSearch) return teachers
        const q = teacherSearch.toLowerCase()
        return teachers.filter(t =>
            t.name.toLowerCase().includes(q) ||
            (t.phone && t.phone.includes(q)) ||
            (t.nni && t.nni.includes(q))
        )
    }, [teachers, teacherSearch])

    useEffect(() => {
        const raw = teacherSearch.trim()
        if (raw.length >= 4 && /^\+?\d+$/.test(raw) && filteredTeachers.length === 0) {
            const timer = setTimeout(async () => {
                const { checkUserByPhone } = await import('@/app/auth/actions')
                const res = await checkUserByPhone(raw)
                if (res.exists && res.role === 'teacher') {
                    setTeachers(prev => {
                        if (prev.some(t => t.id === res.id)) return prev
                        return [...prev, { id: res.id!, name: res.fullName!, phone: raw }]
                    })
                }
            }, 500)
            return () => clearTimeout(timer)
        }
    }, [teacherSearch, filteredTeachers.length])

    // ── Operations ────────────────────────────────────────────────────────────

    const doAssign = async (teacherId: string, classId: string, subjectId: string, removeId?: string) => {
        setOperating(true)
        const result = await upsertAssignment(teacherId, classId, subjectId, removeId)
        if (result.error) { toast.error(result.error); setOperating(false); return }
        const teacher = teachers.find(t => t.id === teacherId)!
        const newAssign: Assignment = {
            id: result.id!,
            teacherId,
            teacherName:  teacher.name,
            teacherPhone: teacher.phone,
            teacherNni:   teacher.nni,
            classId,
            subjectId,
        }
        setAssignments(prev => {
            const next = prev.filter(a => a.id !== removeId && !(a.classId === classId && a.subjectId === subjectId))
            return [...next, newAssign]
        })
        setActiveCell(null)
        setTeacherSearch('')
        toast.success(t('admin.assignments.assignedSuccess', { name: teacher.name }))
        setOperating(false)
    }

    const doRemove = async (assignmentId: string) => {
        setOperating(true)
        const result = await removeAssignment(assignmentId)
        if (result.error) {
            toast.error(result.error)
        } else {
            setAssignments(prev => prev.filter(a => a.id !== assignmentId))
            setActiveCell(null)
            toast.success(t('admin.assignments.assignmentRemoved'))
        }
        setOperating(false)
    }

    // ── Drag & drop ───────────────────────────────────────────────────────────

    const handleDrop = async (targetSubjectId: string, targetClassId: string) => {
        setDragOverCell(null)
        if (!dragInfo) return
        if (dragInfo.subjectId === targetSubjectId && dragInfo.classId === targetClassId) { setDragInfo(null); return }
        await doAssign(dragInfo.teacherId, targetClassId, targetSubjectId, dragInfo.assignmentId)
        setDragInfo(null)
    }

    // ── Popover positioning ───────────────────────────────────────────────────

    const openCell = (e: React.MouseEvent, subject: Subject, cls: Klass, assignment: Assignment | null) => {
        e.nativeEvent.stopImmediatePropagation()
        const isSame = activeCell?.subjectId === subject.id && activeCell?.classId === cls.id
        if (isSame) { setActiveCell(null); return }
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        setActiveCell({ subjectId: subject.id, subjectName: subject.name, classId: cls.id, className: cls.name, mode: assignment ? 'view' : 'pick', assignment, rect })
        setTeacherSearch('')
    }

    const popoverStyle = activeCell ? (() => {
        const POPOVER_H = 300
        const spaceBelow = window.innerHeight - activeCell.rect.bottom
        const top = spaceBelow > POPOVER_H ? activeCell.rect.bottom + 6 : activeCell.rect.top - POPOVER_H - 6
        const left = Math.min(activeCell.rect.left, window.innerWidth - 280)
        return { position: 'fixed' as const, top, left, zIndex: 1000, width: 268 }
    })() : null

    // ─────────────────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        )
    }

    const isEmpty = subjects.length === 0 || classes.length === 0

    return (
        <div className="space-y-5 animate-in fade-in duration-500">

            <p className="text-sm text-gray-500">
                {t('admin.assignments.assignmentsCount', { count: assignments.length, s: assignments.length !== 1 ? 's' : '' })}
                {!isEmpty && t('admin.assignments.matrixHint')}
            </p>

            {isEmpty ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500 bg-[#161B22] rounded-3xl border border-white/5">
                    <AlertTriangle className="w-10 h-10 mb-3 opacity-20" />
                    <p className="font-medium">{t('admin.assignments.noData')}</p>
                    <p className="text-sm mt-1 text-gray-600">
                        {subjects.length === 0 ? t('admin.assignments.noSubjectsError') : t('admin.assignments.noClassesError')}
                    </p>
                </div>
            ) : (
                <>
                    {/* ── Matrix table ── */}
                    <div className="overflow-x-auto rounded-2xl border border-white/5 bg-[#161B22]">
                        <table className="border-collapse" style={{ minWidth: `${classes.length * 168 + 180}px` }}>
                            <thead>
                                <tr className="border-b border-white/5">
                                    <th className="sticky left-0 rtl:right-0 rtl:left-auto z-20 bg-[#161B22] px-5 py-4 text-left rtl:text-right text-xs font-bold text-gray-600 uppercase tracking-wider border-r rtl:border-l rtl:border-r-0 border-white/5 min-w-[180px]">
                                        {t('admin.assignments.subjectClass')}
                                    </th>
                                    {classes.map(cls => (
                                        <th key={cls.id} className="px-3 py-4 text-center text-sm font-bold text-white border-r rtl:border-l rtl:border-r-0 border-white/5 last:border-r-0 whitespace-nowrap min-w-[168px]">
                                            {cls.name}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {subjects.map((subject, rowIdx) => (
                                    <tr key={subject.id} className="border-b border-white/5 last:border-b-0">
                                        <td className="sticky left-0 rtl:right-0 rtl:left-auto z-10 bg-[#161B22] px-5 py-3 text-sm font-semibold text-gray-300 border-r rtl:border-l rtl:border-r-0 border-white/5 whitespace-nowrap">
                                            {subject.name}
                                        </td>
                                        {classes.map(cls => {
                                            const assignment     = matrix.get(subject.id)?.get(cls.id) ?? null
                                            const isActivHere    = activeCell?.subjectId === subject.id && activeCell?.classId === cls.id
                                            const isDraggingFrom = dragInfo?.subjectId === subject.id && dragInfo?.classId === cls.id
                                            const isOver         = dragOverCell?.subjectId === subject.id && dragOverCell?.classId === cls.id

                                            return (
                                                <td
                                                    key={cls.id}
                                                    className="p-2 border-r rtl:border-l rtl:border-r-0 border-white/5 last:border-r-0"
                                                    onDragOver={e => { e.preventDefault(); setDragOverCell({ subjectId: subject.id, classId: cls.id }) }}
                                                    onDragLeave={() => setDragOverCell(null)}
                                                    onDrop={e => { e.preventDefault(); handleDrop(subject.id, cls.id) }}
                                                >
                                                    <div
                                                        draggable={!!assignment}
                                                        onDragStart={e => {
                                                            if (!assignment) return
                                                            e.dataTransfer.effectAllowed = 'move'
                                                            setDragInfo({ assignmentId: assignment.id, teacherId: assignment.teacherId, teacherName: assignment.teacherName, subjectId: subject.id, classId: cls.id })
                                                        }}
                                                        onDragEnd={() => setDragInfo(null)}
                                                        onClick={e => openCell(e, subject, cls, assignment)}
                                                        className={cn(
                                                            "rounded-xl px-2.5 py-2 flex flex-col gap-0.5 transition-all select-none min-h-[52px] justify-center",
                                                            assignment
                                                                ? cn(
                                                                    "bg-emerald-500/10 border border-emerald-500/20",
                                                                    isDraggingFrom ? "opacity-25 cursor-grabbing" : "cursor-grab hover:bg-emerald-500/15 hover:border-emerald-500/35",
                                                                    isActivHere && "ring-1 ring-emerald-500/50 border-emerald-500/40"
                                                                )
                                                                : cn(
                                                                    "cursor-pointer border",
                                                                    isOver
                                                                        ? "bg-emerald-500/10 border-emerald-500/30"
                                                                        : "border-transparent hover:bg-white/5 hover:border-white/10",
                                                                    isActivHere && "bg-white/5 border-white/10"
                                                                )
                                                        )}
                                                    >
                                                        {assignment ? (
                                                            <>
                                                                <div className="flex items-center gap-1.5">
                                                                    <GripVertical className="w-3 h-3 shrink-0 text-emerald-500/30" />
                                                                    <span className="text-xs font-semibold text-emerald-300 truncate max-w-[110px]">
                                                                        {assignment.teacherName}
                                                                    </span>
                                                                </div>
                                                                {assignment.teacherPhone && (
                                                                    <span className="text-[10px] text-emerald-500/60 ps-5 truncate font-mono max-w-[130px]">
                                                                        {assignment.teacherPhone}
                                                                    </span>
                                                                )}
                                                            </>
                                                        ) : isOver ? (
                                                            <div className="flex items-center justify-center">
                                                                <UserCheck className="w-4 h-4 text-emerald-400" />
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-center">
                                                                <Plus className="w-3.5 h-3.5 text-gray-700" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            )
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-5 text-xs text-gray-600 flex-wrap">
                        <div className="flex items-center gap-1.5">
                            <div className="h-3 w-3 rounded bg-emerald-500/20 border border-emerald-500/30" />
                            {t('admin.assignments.assigned')}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="h-3 w-3 rounded bg-white/5 border border-white/10" />
                            {t('admin.assignments.unassigned')}
                        </div>
                        <span>{t('admin.assignments.dragHint')}</span>
                    </div>
                </>
            )}

            {/* ── Popover ── */}
            {activeCell && popoverStyle && (
                <div
                    ref={popoverRef}
                    style={popoverStyle}
                    className="bg-[#161B22] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
                    onClick={e => e.nativeEvent.stopImmediatePropagation()}
                >
                    {activeCell.mode === 'view' && activeCell.assignment ? (
                        /* ── View mode ── */
                        <div className="p-4 space-y-3">
                            {/* Header */}
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{activeCell.subjectName}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{activeCell.className}</p>
                                </div>
                                <button type="button" title="Fermer" className="text-gray-600 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors shrink-0" onClick={() => setActiveCell(null)}>
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            {/* Teacher card */}
                            <div className="bg-[#0F1720] rounded-xl p-3 border border-white/5 space-y-2.5">
                                {/* Avatar + name */}
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-xs font-bold text-emerald-300 shrink-0">
                                        {initials(activeCell.assignment.teacherName)}
                                    </div>
                                    <p className="text-sm font-bold text-white leading-tight">{activeCell.assignment.teacherName}</p>
                                </div>
                                {/* Phone */}
                                {activeCell.assignment.teacherPhone && (
                                    <div className="flex items-center gap-2">
                                        <Phone className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                                        <span className="text-xs text-gray-300 font-mono">{activeCell.assignment.teacherPhone}</span>
                                    </div>
                                )}
                                {/* NNI */}
                                {activeCell.assignment.teacherNni && (
                                    <div className="flex items-center gap-2">
                                        <Fingerprint className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                                        <span className="text-xs text-gray-300 font-mono tracking-wider">{activeCell.assignment.teacherNni}</span>
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="space-y-1 border-t border-white/5 pt-2">
                                <button
                                    type="button"
                                    className="w-full text-left px-3 py-2 text-xs rounded-xl text-gray-300 hover:bg-white/5 hover:text-white transition-colors font-medium"
                                    onClick={() => setActiveCell(prev => prev ? { ...prev, mode: 'pick' } : null)}
                                >
                                    {t('admin.assignments.changeTeacher')}
                                </button>
                                <button
                                    type="button"
                                    className="w-full text-left px-3 py-2 text-xs rounded-xl text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2 font-medium"
                                    disabled={operating}
                                    onClick={() => doRemove(activeCell.assignment!.id)}
                                >
                                    {operating ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                                    {t('admin.assignments.removeAssignment')}
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* ── Pick mode ── */
                        <div>
                            {/* Header */}
                            <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-2 border-b border-white/5">
                                <div>
                                    <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{activeCell.subjectName}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{activeCell.className}</p>
                                </div>
                                <button type="button" title="Fermer" className="text-gray-600 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors shrink-0" onClick={() => setActiveCell(null)}>
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            {/* Search */}
                            <div className="px-3 py-2.5 border-b border-white/5">
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
                                    <input
                                        autoFocus
                                        value={teacherSearch}
                                        onChange={e => setTeacherSearch(e.target.value)}
                                        placeholder={t('admin.assignments.searchPlaceholder')}
                                        className="w-full ps-8 pe-3 py-2 bg-[#0F1720] border border-white/5 rounded-xl text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/40"
                                    />
                                </div>
                            </div>

                            {/* Teacher list */}
                            <div className="max-h-52 overflow-y-auto p-1.5 space-y-0.5">
                                {filteredTeachers.length === 0 ? (
                                    <p className="text-xs text-gray-600 text-center py-6">{t('admin.assignments.noResults')}</p>
                                ) : filteredTeachers.map(teacher => {
                                    const isCurrent = activeCell.assignment?.teacherId === teacher.id
                                    return (
                                        <button
                                            key={teacher.id}
                                            type="button"
                                            disabled={operating}
                                            className={cn(
                                                "w-full text-left px-3 py-2.5 rounded-xl transition-colors flex items-center gap-3",
                                                isCurrent
                                                    ? "bg-emerald-500/10 border border-emerald-500/20"
                                                    : "hover:bg-white/5 border border-transparent"
                                            )}
                                            onClick={() => doAssign(teacher.id, activeCell.classId, activeCell.subjectId, activeCell.assignment?.id)}
                                        >
                                            <div className={cn(
                                                "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                                                isCurrent
                                                    ? "bg-emerald-500/20 text-emerald-300"
                                                    : "bg-white/5 text-gray-400"
                                            )}>
                                                {initials(teacher.name)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={cn("text-xs font-semibold truncate", isCurrent ? "text-emerald-300" : "text-white")}>
                                                    {teacher.name}
                                                    {isCurrent && <span className="ms-1.5 text-[10px] text-emerald-500">✓</span>}
                                                </p>
                                                {teacher.phone && (
                                                    <p className="text-[10px] text-gray-500 font-mono truncate">{teacher.phone}</p>
                                                )}
                                                {teacher.nni && (
                                                    <p className="text-[10px] text-gray-600 font-mono tracking-wider truncate">{teacher.nni}</p>
                                                )}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
