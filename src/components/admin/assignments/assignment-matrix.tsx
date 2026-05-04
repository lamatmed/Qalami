'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Plus, X, Loader2, Search, GripVertical, AlertTriangle, UserCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { upsertAssignment, removeAssignment } from '@/app/admin/assignments/actions'
import { toast } from 'sonner'
import { getMySchoolContext } from '@/app/admin/actions'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Teacher { id: string; name: string }
interface Klass   { id: string; name: string }
interface Subject { id: string; name: string }

interface Assignment {
    id: string
    teacherId: string
    teacherName: string
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

// ─── Component ────────────────────────────────────────────────────────────────

export function AssignmentMatrix() {
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
                { data: teachersData },
            ] = await Promise.all([
                supabase.from('classes').select('id, name').eq('school_id', schoolId).order('name'),
                supabase.from('subjects').select('id, name').eq('school_id', schoolId).order('name'),
                supabase.from('profiles').select('id, full_name')
                    .eq('role', 'teacher').eq('school_id', schoolId).order('full_name'),
            ])

            const classIds = (classesData || []).map((c: any) => c.id)

            const { data: assignData } = classIds.length > 0
                ? await supabase
                    .from('teacher_assignments')
                    .select('id, teacher_id, class_id, subject_id, profiles:teacher_id(full_name)')
                    .in('class_id', classIds)
                : { data: [] }

            setClasses(classesData  || [])
            setSubjects(subjectsData || [])
            setTeachers((teachersData || []).map((t: any) => ({
                id: t.id,
                name: t.full_name || 'Enseignant',
            })))
            setAssignments((assignData as any[] || []).map((a: any) => ({
                id:          a.id,
                teacherId:   a.teacher_id,
                teacherName: (a.profiles as any)?.full_name || '—',
                classId:     a.class_id,
                subjectId:   a.subject_id,
            })))
            setLoading(false)
        }
        fetchAll()
    }, [])

    // ── Matrix: subjectId → classId → Assignment ──────────────────────────────

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

    // ── Close popover on outside click or scroll ──────────────────────────────

    useEffect(() => {
        if (!activeCell) return
        const close = () => { setActiveCell(null); setTeacherSearch('') }
        const onScroll = (e: Event) => {
            // Don't close when scrolling inside the popover itself
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

    // ── Teacher search filter ─────────────────────────────────────────────────

    const filteredTeachers = useMemo(() => {
        if (!teacherSearch) return teachers
        const q = teacherSearch.toLowerCase()
        return teachers.filter(t => t.name.toLowerCase().includes(q))
    }, [teachers, teacherSearch])

    // ── Operations ────────────────────────────────────────────────────────────

    const doAssign = async (
        teacherId: string,
        classId: string,
        subjectId: string,
        removeId?: string
    ) => {
        setOperating(true)
        const result = await upsertAssignment(teacherId, classId, subjectId, removeId)
        if (result.error) {
            toast.error(result.error)
            setOperating(false)
            return
        }
        const teacher = teachers.find(t => t.id === teacherId)!
        const newAssign: Assignment = {
            id: result.id!,
            teacherId,
            teacherName: teacher.name,
            classId,
            subjectId,
        }
        setAssignments(prev => {
            // Remove source (if moving) and any existing at target, then add new
            const next = prev.filter(
                a => a.id !== removeId && !(a.classId === classId && a.subjectId === subjectId)
            )
            return [...next, newAssign]
        })
        setActiveCell(null)
        setTeacherSearch('')
        toast.success(`${teacher.name} affecté(e)`)
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
            toast.success('Affectation retirée')
        }
        setOperating(false)
    }

    // ── Drag & drop ───────────────────────────────────────────────────────────

    const handleDrop = async (targetSubjectId: string, targetClassId: string) => {
        setDragOverCell(null)
        if (!dragInfo) return
        if (dragInfo.subjectId === targetSubjectId && dragInfo.classId === targetClassId) {
            setDragInfo(null); return
        }
        await doAssign(dragInfo.teacherId, targetClassId, targetSubjectId, dragInfo.assignmentId)
        setDragInfo(null)
    }

    // ── Open popover for a cell ───────────────────────────────────────────────

    const openCell = (
        e: React.MouseEvent,
        subject: Subject,
        cls: Klass,
        assignment: Assignment | null
    ) => {
        e.nativeEvent.stopImmediatePropagation()
        const isSame = activeCell?.subjectId === subject.id && activeCell?.classId === cls.id
        if (isSame) { setActiveCell(null); return }
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        setActiveCell({
            subjectId:   subject.id,
            subjectName: subject.name,
            classId:     cls.id,
            className:   cls.name,
            mode:        assignment ? 'view' : 'pick',
            assignment,
            rect,
        })
        setTeacherSearch('')
    }

    // ── Popover position (fixed, flips if near viewport bottom) ──────────────

    const popoverStyle = activeCell ? (() => {
        const POPOVER_H = 260
        const spaceBelow = window.innerHeight - activeCell.rect.bottom
        const top = spaceBelow > POPOVER_H
            ? activeCell.rect.bottom + 6
            : activeCell.rect.top - POPOVER_H - 6
        const left = Math.min(activeCell.rect.left, window.innerWidth - 220)
        return { position: 'fixed' as const, top, left, zIndex: 1000, width: 212 }
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

            {/* Count hint */}
            <p className="text-sm text-gray-500">
                {assignments.length} affectation{assignments.length !== 1 ? 's' : ''}
                {!isEmpty && ' · Cliquer une cellule pour affecter · Glisser pour déplacer'}
            </p>

            {isEmpty ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500 bg-[#1A2530] rounded-3xl border border-white/5">
                    <AlertTriangle className="w-10 h-10 mb-3 opacity-20" />
                    <p className="font-medium">Aucune donnée</p>
                    <p className="text-sm mt-1 text-gray-600">
                        {subjects.length === 0 ? 'Créez des matières' : 'Créez des classes'} avant de gérer les affectations.
                    </p>
                </div>
            ) : (
                <>
                    {/* ── Matrix table ──────────────────────────────────────── */}
                    <div className="overflow-x-auto rounded-3xl border border-white/5 bg-[#1A2530]">
                        <table
                            className="border-collapse"
                            style={{ minWidth: `${classes.length * 152 + 180}px` }}
                        >
                            {/* Header: class names */}
                            <thead>
                                <tr>
                                    <th className="sticky left-0 z-20 bg-[#1A2530] px-4 py-3 text-left text-[10px] font-bold text-gray-600 uppercase tracking-wider border-b border-r border-white/5 min-w-[180px]">
                                        Matière ╲ Classe
                                    </th>
                                    {classes.map(cls => (
                                        <th
                                            key={cls.id}
                                            className="px-3 py-3 text-center text-xs font-bold text-white border-b border-r border-white/5 last:border-r-0 whitespace-nowrap"
                                            style={{ minWidth: 152 }}
                                        >
                                            {cls.name}
                                        </th>
                                    ))}
                                </tr>
                            </thead>

                            {/* Rows: subjects */}
                            <tbody>
                                {subjects.map((subject, rowIdx) => (
                                    <tr key={subject.id}>
                                        {/* Sticky subject name */}
                                        <td className="sticky left-0 z-10 bg-[#1A2530] px-4 py-2 text-sm font-semibold text-gray-300 border-r border-b border-white/5 whitespace-nowrap last:border-b-0">
                                            {subject.name}
                                        </td>

                                        {/* Assignment cells */}
                                        {classes.map(cls => {
                                            const assignment    = matrix.get(subject.id)?.get(cls.id) ?? null
                                            const isActivHere   = activeCell?.subjectId === subject.id && activeCell?.classId === cls.id
                                            const isDraggingFrom = dragInfo?.subjectId === subject.id && dragInfo?.classId === cls.id
                                            const isOver        = dragOverCell?.subjectId === subject.id && dragOverCell?.classId === cls.id
                                            const isLastRow     = rowIdx === subjects.length - 1

                                            return (
                                                <td
                                                    key={cls.id}
                                                    className={cn(
                                                        "p-1.5 border-r border-b border-white/5 last:border-r-0",
                                                        isLastRow && "border-b-0",
                                                        isOver && "bg-emerald-500/5"
                                                    )}
                                                    onDragOver={e => { e.preventDefault(); setDragOverCell({ subjectId: subject.id, classId: cls.id }) }}
                                                    onDragLeave={() => setDragOverCell(null)}
                                                    onDrop={e => { e.preventDefault(); handleDrop(subject.id, cls.id) }}
                                                >
                                                    <div
                                                        draggable={!!assignment}
                                                        onDragStart={e => {
                                                            if (!assignment) return
                                                            e.dataTransfer.effectAllowed = 'move'
                                                            setDragInfo({
                                                                assignmentId: assignment.id,
                                                                teacherId:    assignment.teacherId,
                                                                teacherName:  assignment.teacherName,
                                                                subjectId:    subject.id,
                                                                classId:      cls.id,
                                                            })
                                                        }}
                                                        onDragEnd={() => setDragInfo(null)}
                                                        onClick={e => openCell(e, subject, cls, assignment)}
                                                        className={cn(
                                                            "h-10 rounded-xl flex items-center justify-center px-2 gap-1.5 text-xs font-medium transition-all select-none",
                                                            assignment
                                                                ? cn(
                                                                    "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                                                                    isDraggingFrom
                                                                        ? "opacity-25 cursor-grabbing"
                                                                        : "cursor-grab hover:bg-emerald-500/20 hover:border-emerald-500/40",
                                                                    isActivHere && "ring-1 ring-emerald-500/60"
                                                                )
                                                                : cn(
                                                                    "cursor-pointer border border-transparent",
                                                                    isOver
                                                                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                                                        : "text-gray-700 hover:text-gray-400 hover:bg-white/5 hover:border-white/10",
                                                                    isActivHere && "bg-white/5 border-white/10 text-gray-400"
                                                                )
                                                        )}
                                                    >
                                                        {assignment ? (
                                                            <>
                                                                <GripVertical className="w-3 h-3 shrink-0 opacity-30" />
                                                                <span className="truncate" style={{ maxWidth: 100 }}>
                                                                    {assignment.teacherName}
                                                                </span>
                                                            </>
                                                        ) : isOver ? (
                                                            <UserCheck className="w-3.5 h-3.5" />
                                                        ) : (
                                                            <Plus className="w-3.5 h-3.5 opacity-20" />
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
                            Affecté
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="h-3 w-3 rounded bg-white/[0.03] border border-white/10" />
                            Non affecté
                        </div>
                        <span>· Glisser une cellule verte pour déplacer l'affectation</span>
                    </div>
                </>
            )}

            {/* ── Fixed popover — outside the table to avoid overflow clipping ── */}
            {activeCell && popoverStyle && (
                <div
                    ref={popoverRef}
                    style={popoverStyle}
                    className="bg-[#0F1720] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
                    onClick={e => e.nativeEvent.stopImmediatePropagation()}
                >
                    {activeCell.mode === 'view' && activeCell.assignment ? (
                        /* ── View mode: show teacher + actions ── */
                        <div className="p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                        {activeCell.subjectName}
                                    </p>
                                    <p className="text-[10px] text-gray-600">{activeCell.className}</p>
                                </div>
                                <button
                                    className="text-gray-600 hover:text-white mt-0.5 shrink-0"
                                    onClick={() => setActiveCell(null)}
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <p className="text-sm font-bold text-white">{activeCell.assignment.teacherName}</p>
                            <div className="pt-2 space-y-0.5 border-t border-white/5">
                                <button
                                    className="w-full text-left px-3 py-2 text-xs rounded-lg text-gray-300 hover:bg-white/5 transition-colors"
                                    onClick={() => setActiveCell(prev => prev ? { ...prev, mode: 'pick' } : null)}
                                >
                                    Changer l'enseignant
                                </button>
                                <button
                                    className="w-full text-left px-3 py-2 text-xs rounded-lg text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                                    disabled={operating}
                                    onClick={() => doRemove(activeCell.assignment!.id)}
                                >
                                    {operating
                                        ? <Loader2 className="w-3 h-3 animate-spin" />
                                        : <X className="w-3 h-3" />
                                    }
                                    Retirer l'affectation
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* ── Pick mode: teacher search + list ── */
                        <div className="p-2">
                            <div className="px-2 pt-1.5 pb-2 flex items-start justify-between gap-2">
                                <div>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                        {activeCell.subjectName}
                                    </p>
                                    <p className="text-[10px] text-gray-600">{activeCell.className}</p>
                                </div>
                                <button
                                    className="text-gray-600 hover:text-white mt-0.5 shrink-0"
                                    onClick={() => setActiveCell(null)}
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <div className="px-2 pb-1.5">
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600 pointer-events-none" />
                                    <input
                                        autoFocus
                                        value={teacherSearch}
                                        onChange={e => setTeacherSearch(e.target.value)}
                                        placeholder="Rechercher un enseignant…"
                                        className="w-full pl-7 pr-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50"
                                    />
                                </div>
                            </div>

                            <div className="max-h-48 overflow-y-auto">
                                {filteredTeachers.length === 0 ? (
                                    <p className="text-xs text-gray-600 text-center py-4">Aucun résultat</p>
                                ) : filteredTeachers.map(teacher => {
                                    const isCurrentTeacher = activeCell.assignment?.teacherId === teacher.id
                                    return (
                                        <button
                                            key={teacher.id}
                                            disabled={operating}
                                            className={cn(
                                                "w-full text-left px-4 py-2.5 text-xs transition-colors",
                                                isCurrentTeacher
                                                    ? "text-emerald-400 font-bold bg-emerald-500/5"
                                                    : "text-gray-300 hover:bg-white/5"
                                            )}
                                            onClick={() => doAssign(
                                                teacher.id,
                                                activeCell.classId,
                                                activeCell.subjectId,
                                                activeCell.assignment?.id
                                            )}
                                        >
                                            {isCurrentTeacher && (
                                                <span className="mr-1">✓</span>
                                            )}
                                            {teacher.name}
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
