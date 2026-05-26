'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Download, ArrowLeft, Loader2, BookOpen, Plus, X, Users, ClipboardList, UserPlus, Search, UserCheck, Pencil, Trash2, AlertTriangle, TrendingUp, ArrowRightLeft, UserMinus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/i18n'
import { createClient } from '@/utils/supabase/client'
import { useSchoolContext } from '@/lib/use-school-context'
import { removeSubjectFromClass, addSubjectToClass } from '@/app/admin/subjects/actions'
import { ClassPerformance } from './class-performance'
import { assignStudentToClass, removeStudentFromClass } from '@/app/admin/students/actions'
import { updateClass, deleteClass } from '@/app/admin/classes/actions'
import { toast } from 'sonner'

interface StudentRow {
    id: string
    name: string
    avatar: string
    nni?: string
}

interface AvailableStudent {
    id: string
    name: string
    avatar: string
    nni?: string
    currentClass?: string
}

interface SubjectRow {
    id: string
    name: string
    icon: string | null
}

export function ClassDetails({ levelId, classId }: { levelId: string, classId: string }) {
    const router = useRouter()
    const { t } = useLanguage()
    const { context } = useSchoolContext()
    const [activeTab, setActiveTab] = useState<'students' | 'subjects' | 'performance'>('students')
    const [students, setStudents] = useState<StudentRow[]>([])
    const [classSubjects, setClassSubjects] = useState<SubjectRow[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingSubjects, setLoadingSubjects] = useState(false)
    const [className, setClassName] = useState('')
    const [resolvedClassId, setResolvedClassId] = useState('')
    const [removingSubjectId, setRemovingSubjectId] = useState<string | null>(null)

    // Add subject panel
    const [showAddSubject, setShowAddSubject] = useState(false)
    const [allSubjects, setAllSubjects] = useState<SubjectRow[]>([])
    const [loadingAllSubjects, setLoadingAllSubjects] = useState(false)
    const [addingSubjectId, setAddingSubjectId] = useState<string | null>(null)
    const [subjectSearch, setSubjectSearch] = useState('')

    // Edit / Delete dialogs
    const [editOpen, setEditOpen] = useState(false)
    const [editName, setEditName] = useState('')
    const [editCapacity, setEditCapacity] = useState('')
    const [saving, setSaving] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [deleting, setDeleting] = useState(false)

    // Available students panel (all students not in this class)
    const [showUnassigned, setShowUnassigned] = useState(false)
    const [unassigned, setUnassigned] = useState<AvailableStudent[]>([])
    const [loadingUnassigned, setLoadingUnassigned] = useState(false)
    const [assigningId, setAssigningId] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')

    // Remove student from class
    const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null)
    const [removingStudentFromClass, setRemovingStudentFromClass] = useState(false)

    // Transfer student to another class
    const [transferStudent, setTransferStudent] = useState<StudentRow | null>(null)
    const [allClasses, setAllClasses] = useState<{ id: string; name: string }[]>([])
    const [loadingClasses, setLoadingClasses] = useState(false)
    const [transferringTo, setTransferringTo] = useState<string | null>(null)
    const [classSearch, setClassSearch] = useState('')

    useEffect(() => {
        async function load() {
            const supabase = createClient()

            const { data: classData } = await supabase
                .from('classes')
                .select('id, name')
                .or(`id.eq.${classId},name.ilike.%${classId}%`)
                .single()

            if (classData) {
                setClassName(classData.name)
                setResolvedClassId(classData.id)

                const { data: enrollments } = await supabase
                    .from('enrollments')
                    .select('student_id, profiles!enrollments_student_id_fkey(id, full_name, national_id)')
                    .eq('class_id', classData.id)
                    .eq('status', 'active')

                setStudents((enrollments || []).map((e: any) => ({
                    id: e.profiles?.id || e.student_id,
                    name: e.profiles?.full_name || 'Inconnu',
                    avatar: (e.profiles?.full_name || 'XX').split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase(),
                    nni: e.profiles?.national_id ?? undefined,
                })))
            }
            setLoading(false)
        }
        load()
    }, [classId])

    // Load classes for transfer modal
    const loadAllClasses = useCallback(async () => {
        if (!context || !resolvedClassId) return
        setLoadingClasses(true)
        const supabase = createClient()
        const { data } = await supabase
            .from('classes')
            .select('id, name')
            .eq('school_id', context.school_id)
            .neq('id', resolvedClassId)
            .order('name')
        setAllClasses((data || []).map((c: any) => ({ id: c.id, name: c.name })))
        setLoadingClasses(false)
    }, [context, resolvedClassId])

    useEffect(() => {
        if (transferStudent) loadAllClasses()
    }, [transferStudent, loadAllClasses])

    // Load all available students (unassigned + in other classes)
    const loadUnassigned = useCallback(async () => {
        if (!context || !resolvedClassId) return
        setLoadingUnassigned(true)
        const supabase = createClient()
        const schoolId = context.school_id

        const [{ data: allStudents }, { data: enrollments }] = await Promise.all([
            supabase
                .from('profiles')
                .select('id, full_name, national_id')
                .eq('school_id', schoolId)
                .eq('role', 'student')
                .eq('status', 'active')
                .order('full_name'),
            supabase
                .from('enrollments')
                .select('student_id, class_id, classes(name)')
                .eq('school_id', schoolId)
                .eq('status', 'active'),
        ])

        // Map: student_id → their current class name (if enrolled elsewhere)
        const enrollmentMap = new Map<string, string>()
        const thisClassStudentIds = new Set<string>()
        for (const e of (enrollments || []) as any[]) {
            if (e.class_id === resolvedClassId) {
                thisClassStudentIds.add(e.student_id)
            } else {
                enrollmentMap.set(e.student_id, e.classes?.name || '')
            }
        }

        const available = (allStudents || [])
            .filter((s: any) => !thisClassStudentIds.has(s.id))
            .map((s: any) => ({
                id: s.id,
                name: s.full_name || 'Inconnu',
                avatar: (s.full_name || 'XX').split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase(),
                nni: s.national_id ?? undefined,
                currentClass: enrollmentMap.get(s.id),
            }))

        setUnassigned(available)
        setLoadingUnassigned(false)
    }, [context, resolvedClassId])

    useEffect(() => {
        if (showUnassigned) loadUnassigned()
    }, [showUnassigned, loadUnassigned])

    const handleAssign = async (student: AvailableStudent) => {
        if (!resolvedClassId) return
        setAssigningId(student.id)
        const result = await assignStudentToClass(student.id, resolvedClassId)
        if (result?.error) {
            toast.error(result.error)
        } else {
            toast.success(t('admin.structure.studentAssignedToClass').replace('{name}', student.name).replace('{className}', className))
            setUnassigned(prev => prev.filter(s => s.id !== student.id))
            setStudents(prev => [...prev, { id: student.id, name: student.name, avatar: student.avatar, nni: student.nni }])
        }
        setAssigningId(null)
    }

    const handleRemoveStudent = async (studentId: string, studentName: string) => {
        setRemovingStudentFromClass(true)
        const result = await removeStudentFromClass(studentId, resolvedClassId)
        if (result?.error) {
            toast.error(result.error)
        } else {
            toast.success(t('admin.structure.studentRemovedFromClass').replace('{name}', studentName))
            setStudents(prev => prev.filter(s => s.id !== studentId))
            setRemoveConfirmId(null)
        }
        setRemovingStudentFromClass(false)
    }

    const handleTransferStudent = async (targetClassId: string, targetClassName: string) => {
        if (!transferStudent) return
        setTransferringTo(targetClassId)
        const result = await assignStudentToClass(transferStudent.id, targetClassId)
        if (result?.error) {
            toast.error(result.error)
        } else {
            toast.success(t('admin.structure.studentTransferred').replace('{name}', transferStudent.name).replace('{className}', targetClassName))
            setStudents(prev => prev.filter(s => s.id !== transferStudent.id))
            setTransferStudent(null)
        }
        setTransferringTo(null)
    }

    const loadSubjects = useCallback(async () => {
        if (!resolvedClassId) return
        setLoadingSubjects(true)
        const supabase = createClient()

        const { data: csData } = await supabase
            .from('class_subjects')
            .select('subject_id, subjects(id, name, icon)')
            .eq('class_id', resolvedClassId)

        const linked: SubjectRow[] = (csData || []).map((cs: any) => ({
            id: cs.subjects?.id,
            name: cs.subjects?.name,
            icon: cs.subjects?.icon ?? null,
        })).filter((s: SubjectRow) => s.id)

        setClassSubjects(linked)
        setLoadingSubjects(false)
    }, [resolvedClassId])

    useEffect(() => {
        if (activeTab === 'subjects' && resolvedClassId) loadSubjects()
    }, [activeTab, resolvedClassId, loadSubjects])

    const loadAllSubjects = useCallback(async () => {
        if (!context) return
        setLoadingAllSubjects(true)
        const supabase = createClient()
        const { data } = await supabase
            .from('subjects')
            .select('id, name, icon')
            .eq('school_id', context.school_id)
            .order('name')
        setAllSubjects((data || []).map((s: any) => ({ id: s.id, name: s.name, icon: s.icon ?? null })))
        setLoadingAllSubjects(false)
    }, [context])

    useEffect(() => {
        if (showAddSubject) loadAllSubjects()
    }, [showAddSubject, loadAllSubjects])

    const handleAddSubject = async (subject: SubjectRow) => {
        setAddingSubjectId(subject.id)
        const result = await addSubjectToClass(resolvedClassId, subject.id)
        if (result?.error) {
            toast.error(result.error)
        } else {
            toast.success(t('admin.structure.subjectAddedToClass').replace('{name}', subject.name))
            setClassSubjects(prev => [...prev, subject])
        }
        setAddingSubjectId(null)
    }

    const handleRemoveSubject = async (subjectId: string, subjectName: string) => {
        setRemovingSubjectId(subjectId)
        const result = await removeSubjectFromClass(resolvedClassId, subjectId)
        if (result?.error) {
            toast.error(result.error)
        } else {
            toast.success(t('admin.structure.subjectRemovedFromClass').replace('{name}', subjectName))
            setClassSubjects(prev => prev.filter(s => s.id !== subjectId))
        }
        setRemovingSubjectId(null)
    }

    const handleEditOpen = () => {
        setEditName(className)
        setEditCapacity('40')
        setEditOpen(true)
    }

    const handleEditSave = async () => {
        if (!editName.trim()) { toast.error(t('admin.structure.classNameRequired')); return }
        setSaving(true)
        const result = await updateClass(resolvedClassId, { name: editName.trim(), capacity: parseInt(editCapacity) || undefined })
        if (result?.error) {
            toast.error(result.error)
        } else {
            toast.success(t('admin.structure.classEditedSuccess'))
            setClassName(editName.trim())
            setEditOpen(false)
        }
        setSaving(false)
    }

    const handleDelete = async () => {
        setDeleting(true)
        const result = await deleteClass(resolvedClassId)
        if (result?.error) {
            toast.error(result.error)
            setDeleting(false)
        } else {
            toast.success(t('admin.structure.classDeletedSuccess').replace('{name}', className))
            router.back()
        }
    }

    const handleExportPDF = () => {
        const win = window.open('', '_blank')
        if (!win) return
        const rows = students.map((s, i) => `
            <tr>
                <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;color:#666;font-size:13px;">${i + 1}</td>
                <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;font-weight:600;font-size:14px;">${s.name}</td>
                <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;color:#999;font-family:monospace;font-size:12px;">${s.id.substring(0, 16)}</td>
            </tr>
        `).join('')
        win.document.write(`<!DOCTYPE html><html><head>
            <meta charset="utf-8">
            <title>Classe ${className} — Liste des élèves</title>
            <style>
                body{font-family:system-ui,sans-serif;padding:40px;color:#111;max-width:800px;margin:0 auto}
                h1{font-size:22px;font-weight:700;margin:0 0 4px}
                .meta{color:#777;font-size:13px;margin-bottom:32px}
                table{width:100%;border-collapse:collapse}
                th{text-align:left;padding:8px 14px;background:#f8f8f8;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#999;font-weight:700}
                @media print{body{padding:20px}}
            </style>
        </head><body>
            <h1>Classe : ${className}</h1>
            <p class="meta">${students.length} élève${students.length !== 1 ? 's' : ''} · Exporté le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <table><thead><tr><th>#</th><th>Nom complet</th><th>Identifiant</th></tr></thead>
            <tbody>${rows}</tbody></table>
        </body></html>`)
        win.document.close()
        win.focus()
        setTimeout(() => win.print(), 250)
    }

    const filteredUnassigned = searchQuery.trim()
        ? unassigned.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : unassigned

    const filteredClasses = classSearch.trim()
        ? allClasses.filter(c => c.name.toLowerCase().includes(classSearch.toLowerCase()))
        : allClasses

    return (
        <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-gray-400 hover:text-white -ml-2">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold text-white">
                            {t('admin.structure.classTitle').replace('{name}', className || classId.toUpperCase())}
                        </h2>
                        <p className="text-emerald-500 text-sm font-bold">
                            {loading ? '…' : `${students.length} élève${students.length !== 1 ? 's' : ''}`}
                        </p>
                    </div>
                </div>
                {resolvedClassId && (
                    <div className="flex items-center gap-2">
                        <Link href={`/admin/assignments?class_id=${resolvedClassId}`}>
                            <Button variant="outline" size="sm" className="gap-2 border-white/10 text-gray-300 hover:text-white hover:bg-white/5 text-xs">
                                <ClipboardList className="w-3.5 h-3.5" />
                                {t('admin.structure.assignmentsBtn')}
                            </Button>
                        </Link>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleEditOpen}
                            className="gap-1.5 border-white/10 text-gray-300 hover:text-white hover:bg-white/5 text-xs"
                        >
                            <Pencil className="w-3.5 h-3.5" />
                            {t('admin.structure.editBtn')}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteOpen(true)}
                            className="gap-1.5 border-red-500/20 text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            {t('admin.structure.deleteBtn')}
                        </Button>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-white/10">
                <button
                    type="button"
                    onClick={() => setActiveTab('students')}
                    className={cn(
                        "flex items-center gap-2 px-4 pb-3 text-sm font-bold transition-colors border-b-2",
                        activeTab === 'students'
                            ? "border-emerald-500 text-emerald-500"
                            : "border-transparent text-gray-500 hover:text-white"
                    )}
                >
                    <Users className="w-4 h-4" />
                    {t('admin.structure.tabStudents')}
                    <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded-full">{students.length}</span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('subjects')}
                    className={cn(
                        "flex items-center gap-2 px-4 pb-3 text-sm font-bold transition-colors border-b-2",
                        activeTab === 'subjects'
                            ? "border-emerald-500 text-emerald-500"
                            : "border-transparent text-gray-500 hover:text-white"
                    )}
                >
                    <BookOpen className="w-4 h-4" />
                    {t('admin.structure.tabSubjects')}
                    {classSubjects.length > 0 && (
                        <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded-full">{classSubjects.length}</span>
                    )}
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('performance')}
                    className={cn(
                        "flex items-center gap-2 px-4 pb-3 text-sm font-bold transition-colors border-b-2",
                        activeTab === 'performance'
                            ? "border-emerald-500 text-emerald-500"
                            : "border-transparent text-gray-500 hover:text-white"
                    )}
                >
                    <TrendingUp className="w-4 h-4" />
                    {t('admin.structure.tabPerformance')}
                </button>
            </div>

            {/* ── Tab: Students ── */}
            {activeTab === 'students' && (
                <div className="flex-1 flex gap-5 min-h-0">
                    {/* Left: enrolled students */}
                    <div className="flex-1 flex flex-col">
                        <div className="bg-[#1A2530] rounded-2xl border border-white/5 p-5 flex flex-col flex-1">
                            <div className="flex justify-between items-center mb-4">
                                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                    {t('admin.structure.studentList')} · {students.length}
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="border-white/10 text-gray-400 hover:text-white hover:bg-white/5 h-8 text-xs gap-1.5"
                                        onClick={handleExportPDF}
                                        disabled={students.length === 0}
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        {t('admin.structure.exportBtn')}
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => { setShowUnassigned(v => !v); setSearchQuery('') }}
                                        className={cn(
                                            "h-8 text-xs gap-1.5 font-semibold transition-colors",
                                            showUnassigned
                                                ? "bg-white/8 text-gray-300 hover:bg-white/12 border border-white/10"
                                                : "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20"
                                        )}
                                    >
                                        {showUnassigned ? (
                                            <><X className="w-3.5 h-3.5" /> {t('admin.structure.closeBtn')}</>
                                        ) : (
                                            <><UserPlus className="w-3.5 h-3.5" /> {t('admin.structure.assignStudentBtn')}</>
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                                </div>
                            ) : students.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                                    <Users className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                                    <p className="text-sm text-gray-500">{t('admin.structure.noStudentsInClass')}</p>
                                    {!showUnassigned && (
                                        <button
                                            type="button"
                                            onClick={() => setShowUnassigned(true)}
                                            className="mt-3 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                                        >
                                            {t('admin.structure.assignStudentsHint')}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-1.5 overflow-y-auto">
                                    {students.map((student) => (
                                        <div key={student.id}>
                                            <div className={cn(
                                                "group flex items-center gap-3 p-3 bg-[#0F1720] rounded-xl border border-white/5 hover:border-white/10 transition-colors",
                                                removeConfirmId === student.id && "rounded-b-none border-b-0 border-red-500/20"
                                            )}>
                                                <div className="w-9 h-9 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400 font-bold text-xs shrink-0">
                                                    {student.avatar}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-semibold text-gray-200 text-sm truncate">{student.name}</p>
                                                    {student.nni && (
                                                        <p className="text-[10px] text-gray-600 font-mono">{student.nni}</p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        type="button"
                                                        onClick={() => { setTransferStudent(student); setClassSearch('') }}
                                                        title={t('admin.structure.transferStudentTitle')}
                                                        className="p-1.5 rounded-lg text-gray-600 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                                                    >
                                                        <ArrowRightLeft className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setRemoveConfirmId(prev => prev === student.id ? null : student.id)}
                                                        title={t('admin.structure.removeStudentTitle')}
                                                        className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                                    >
                                                        <UserMinus className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                            {/* Inline remove confirmation */}
                                            {removeConfirmId === student.id && (
                                                <div className="flex items-center justify-between px-3 py-2 rounded-b-xl bg-red-500/8 border border-red-500/20 border-t-0">
                                                    <span className="text-xs text-red-400">{t('admin.structure.confirmRemoveStudent')}</span>
                                                    <div className="flex gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => setRemoveConfirmId(null)}
                                                            className="px-2.5 py-1 text-[11px] text-gray-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                                                        >
                                                            {t('common.cancel')}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveStudent(student.id, student.name)}
                                                            disabled={removingStudentFromClass}
                                                            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-red-400 bg-red-500/20 rounded-lg hover:bg-red-500/30 disabled:opacity-50 transition-colors"
                                                        >
                                                            {removingStudentFromClass && <Loader2 className="w-3 h-3 animate-spin" />}
                                                            {t('common.confirm')}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: available students panel */}
                    {showUnassigned && (
                        <div className="w-80 shrink-0 flex flex-col animate-in slide-in-from-right-4 duration-300">
                            <div className="bg-[#161B22] rounded-2xl border border-emerald-500/20 p-4 flex flex-col flex-1">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-6 h-6 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                                        <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                                    </div>
                                    <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                                        {t('admin.structure.availableStudentsPanel')}
                                    </p>
                                </div>

                                <div className="relative mb-3">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
                                    <Input
                                        placeholder={t('admin.structure.searchStudentPlaceholder')}
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="pl-8 h-8 text-xs bg-[#0D1117] border-white/8 text-white placeholder:text-gray-700 focus:border-emerald-500/40 rounded-lg"
                                    />
                                </div>

                                {loadingUnassigned ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                                    </div>
                                ) : filteredUnassigned.length === 0 ? (
                                    <div className="text-center py-8">
                                        <UserCheck className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                                        <p className="text-xs text-gray-500">
                                            {searchQuery ? t('admin.structure.noResults') : t('admin.structure.noAvailableStudents')}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5 overflow-y-auto flex-1">
                                        <p className="text-[10px] text-gray-600 mb-2">
                                            {filteredUnassigned.length} élève{filteredUnassigned.length > 1 ? 's' : ''} disponible{filteredUnassigned.length > 1 ? 's' : ''}
                                        </p>
                                        {filteredUnassigned.map(student => (
                                            <div
                                                key={student.id}
                                                className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#0D1117] border border-white/5 hover:border-emerald-500/20 transition-colors"
                                            >
                                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 font-bold text-[11px] shrink-0">
                                                    {student.avatar}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium text-gray-300 truncate">{student.name}</p>
                                                    {student.currentClass ? (
                                                        <p className="text-[10px] text-blue-400/70 font-medium truncate">↪ {student.currentClass}</p>
                                                    ) : student.nni ? (
                                                        <p className="text-[10px] text-gray-600 font-mono">{student.nni}</p>
                                                    ) : null}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleAssign(student)}
                                                    disabled={assigningId === student.id}
                                                    className="shrink-0 h-7 px-2.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-[11px] font-semibold border border-emerald-500/20 hover:bg-emerald-500/25 transition-colors disabled:opacity-50 flex items-center gap-1"
                                                >
                                                    {assigningId === student.id
                                                        ? <Loader2 className="w-3 h-3 animate-spin" />
                                                        : <><Plus className="w-3 h-3" />{t('admin.structure.assignBtn')}</>
                                                    }
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Tab: Subjects ── */}
            {activeTab === 'subjects' && (
                <div className="flex-1 flex gap-5 min-h-0">
                    {/* Subjects list */}
                    <div className="flex-1 flex flex-col">
                        <div className="bg-[#1A2530] rounded-2xl border border-white/5 p-5 flex flex-col flex-1">
                            <div className="flex justify-between items-center mb-4">
                                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                    {t('admin.structure.classSubjectsHeader')} · {classSubjects.length} matière{classSubjects.length !== 1 ? 's' : ''}
                                </p>
                                <Button
                                    size="sm"
                                    onClick={() => { setShowAddSubject(v => !v); setSubjectSearch('') }}
                                    className={cn(
                                        "h-8 text-xs gap-1.5 font-semibold transition-colors",
                                        showAddSubject
                                            ? "bg-white/8 text-gray-300 hover:bg-white/12 border border-white/10"
                                            : "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20"
                                    )}
                                >
                                    {showAddSubject
                                        ? <><X className="w-3.5 h-3.5" /> {t('admin.structure.closeBtn')}</>
                                        : <><Plus className="w-3.5 h-3.5" /> {t('admin.structure.addSubjectBtn')}</>
                                    }
                                </Button>
                            </div>

                            {loadingSubjects ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                                </div>
                            ) : classSubjects.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                                    <BookOpen className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                                    <p className="text-sm text-gray-500">{t('admin.structure.noSubjectsInClass')}</p>
                                    {!showAddSubject && (
                                        <button
                                            type="button"
                                            onClick={() => setShowAddSubject(true)}
                                            className="mt-3 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                                        >
                                            {t('admin.structure.addSubjectsHint')}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2 overflow-y-auto">
                                    {classSubjects.map(subject => (
                                        <div key={subject.id} className="flex items-center justify-between p-3 bg-[#0F1720] rounded-xl border border-white/5 hover:border-red-500/10 transition-all group">
                                            <div className="flex items-center gap-3">
                                                {subject.icon ? (
                                                    <span className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-base">
                                                        {subject.icon}
                                                    </span>
                                                ) : (
                                                    <div className="h-9 w-9 rounded-lg bg-white/5 flex items-center justify-center">
                                                        <BookOpen className="w-4 h-4 text-gray-500" />
                                                    </div>
                                                )}
                                                <span className="font-medium text-white text-sm">{subject.name}</span>
                                            </div>
                                            <button
                                                type="button"
                                                className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                                title={t('admin.structure.removeSubjectTitle')}
                                                onClick={() => handleRemoveSubject(subject.id, subject.name)}
                                                disabled={removingSubjectId === subject.id}
                                            >
                                                {removingSubjectId === subject.id
                                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                                    : <Trash2 className="w-3.5 h-3.5" />
                                                }
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: add subject panel */}
                    {showAddSubject && (
                        <div className="w-80 shrink-0 flex flex-col animate-in slide-in-from-right-4 duration-300">
                            <div className="bg-[#161B22] rounded-2xl border border-emerald-500/20 p-4 flex flex-col flex-1">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-6 h-6 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                                        <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                                    </div>
                                    <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                                        {t('admin.structure.availableSubjectsPanel')}
                                    </p>
                                </div>

                                <div className="relative mb-3">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
                                    <Input
                                        placeholder={t('admin.structure.searchSubjectPlaceholder')}
                                        value={subjectSearch}
                                        onChange={e => setSubjectSearch(e.target.value)}
                                        className="pl-8 h-8 text-xs bg-[#0D1117] border-white/8 text-white placeholder:text-gray-700 focus:border-emerald-500/40 rounded-lg"
                                    />
                                </div>

                                {loadingAllSubjects ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                                    </div>
                                ) : (() => {
                                    const linkedIds = new Set(classSubjects.map(s => s.id))
                                    const available = allSubjects
                                        .filter(s => !linkedIds.has(s.id))
                                        .filter(s => !subjectSearch.trim() || s.name.toLowerCase().includes(subjectSearch.toLowerCase()))
                                    return available.length === 0 ? (
                                        <div className="text-center py-8">
                                            <BookOpen className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                                            <p className="text-xs text-gray-500">
                                                {subjectSearch ? t('admin.structure.noResults') : t('admin.structure.allSubjectsLinked')}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-1.5 overflow-y-auto flex-1">
                                            <p className="text-[10px] text-gray-600 mb-2">
                                                {available.length} matière{available.length > 1 ? 's' : ''} disponible{available.length > 1 ? 's' : ''}
                                            </p>
                                            {available.map(subject => (
                                                <div
                                                    key={subject.id}
                                                    className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#0D1117] border border-white/5 hover:border-emerald-500/20 transition-colors group"
                                                >
                                                    {subject.icon ? (
                                                        <span className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-sm shrink-0">
                                                            {subject.icon}
                                                        </span>
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                                                            <BookOpen className="w-3.5 h-3.5 text-gray-500" />
                                                        </div>
                                                    )}
                                                    <p className="text-xs font-medium text-gray-300 flex-1 truncate">{subject.name}</p>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAddSubject(subject)}
                                                        disabled={addingSubjectId === subject.id}
                                                        className="shrink-0 h-7 px-2.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-[11px] font-semibold border border-emerald-500/20 hover:bg-emerald-500/25 transition-colors disabled:opacity-50 flex items-center gap-1"
                                                    >
                                                        {addingSubjectId === subject.id
                                                            ? <Loader2 className="w-3 h-3 animate-spin" />
                                                            : <><Plus className="w-3 h-3" />{t('admin.structure.add')}</>
                                                        }
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                })()}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Tab: Performance ── */}
            {activeTab === 'performance' && resolvedClassId && (
                <ClassPerformance resolvedClassId={resolvedClassId} />
            )}

            {/* ── Transfer Student Modal ── */}
            {transferStudent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !transferringTo && setTransferStudent(null)} />
                    <div className="relative w-full max-w-sm bg-[#161B22] rounded-2xl border border-white/8 shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[75vh]">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
                                <ArrowRightLeft className="w-4 h-4 text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-bold text-white">{t('admin.structure.transferDialogTitle')}</h3>
                                <p className="text-xs text-gray-500 truncate">{transferStudent.name}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setTransferStudent(null)}
                                disabled={!!transferringTo}
                                className="text-gray-600 hover:text-white transition-colors shrink-0 disabled:opacity-40"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
                            <Input
                                placeholder={t('admin.structure.searchClassPlaceholder')}
                                value={classSearch}
                                onChange={e => setClassSearch(e.target.value)}
                                className="pl-8 h-8 text-xs bg-[#0D1117] border-white/8 text-white placeholder:text-gray-700 rounded-lg"
                            />
                        </div>

                        <div className="overflow-y-auto flex-1 space-y-1.5">
                            {loadingClasses ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                                </div>
                            ) : filteredClasses.length === 0 ? (
                                <div className="text-center py-8">
                                    <p className="text-xs text-gray-500">
                                        {classSearch ? t('admin.structure.noResults') : t('admin.structure.noOtherClasses')}
                                    </p>
                                </div>
                            ) : filteredClasses.map(cls => (
                                <div key={cls.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#0D1117] border border-white/5 hover:border-blue-500/20 transition-colors">
                                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                        <Users className="w-3.5 h-3.5 text-blue-400" />
                                    </div>
                                    <p className="flex-1 text-sm font-medium text-gray-200">{cls.name}</p>
                                    <button
                                        type="button"
                                        onClick={() => handleTransferStudent(cls.id, cls.name)}
                                        disabled={!!transferringTo}
                                        className="shrink-0 h-7 px-3 rounded-lg bg-blue-500/15 text-blue-400 text-[11px] font-semibold border border-blue-500/20 hover:bg-blue-500/25 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                                    >
                                        {transferringTo === cls.id
                                            ? <Loader2 className="w-3 h-3 animate-spin" />
                                            : <ArrowRightLeft className="w-3 h-3" />
                                        }
                                        {t('admin.structure.transferBtn')}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Edit Dialog ── */}
            {editOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditOpen(false)} />
                    <div className="relative w-full max-w-sm bg-[#161B22] rounded-2xl border border-white/8 shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
                                <Pencil className="w-4 h-4 text-blue-400" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-white">{t('admin.structure.editDialogTitle')}</h3>
                                <p className="text-[11px] text-gray-500">{t('admin.structure.editDialogSubtitle')}</p>
                            </div>
                            <button type="button" aria-label={t('admin.structure.closeBtn')} onClick={() => setEditOpen(false)} className="ml-auto text-gray-600 hover:text-white transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{t('admin.structure.classNameLabel')}</label>
                                <Input
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    placeholder={t('admin.structure.classNamePlaceholder')}
                                    className="bg-[#0D1117] border-white/8 text-white placeholder:text-gray-700 focus:border-blue-500/60 h-10 rounded-xl"
                                    onKeyDown={e => e.key === 'Enter' && handleEditSave()}
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{t('admin.structure.capacityLabel')}</label>
                                <Input
                                    type="number"
                                    value={editCapacity}
                                    onChange={e => setEditCapacity(e.target.value)}
                                    placeholder="40"
                                    className="bg-[#0D1117] border-white/8 text-white placeholder:text-gray-700 focus:border-blue-500/60 h-10 rounded-xl"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setEditOpen(false)}
                                className="flex-1 h-10 rounded-xl border border-white/8 text-gray-500 hover:text-gray-300 hover:bg-white/4 text-sm font-medium transition-colors"
                            >
                                {t('admin.structure.cancelBtn')}
                            </button>
                            <button
                                type="button"
                                onClick={handleEditSave}
                                disabled={saving || !editName.trim()}
                                className="flex-1 h-10 rounded-xl bg-blue-600/85 hover:bg-blue-600 text-white text-sm font-semibold disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                {saving ? t('admin.structure.savingLabel') : t('admin.structure.saveBtn')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete Confirm Dialog ── */}
            {deleteOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !deleting && setDeleteOpen(false)} />
                    <div className="relative w-full max-w-sm bg-[#161B22] rounded-2xl border border-red-500/20 shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0 mt-0.5">
                                <AlertTriangle className="w-4 h-4 text-red-400" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-white">{t('admin.structure.deleteDialogTitle')}</h3>
                                <p className="text-sm text-gray-400 mt-1">
                                    {t('admin.structure.deleteDialogDesc').replace('{name}', className)}
                                </p>
                            </div>
                        </div>

                        <div className="bg-red-500/8 border border-red-500/15 rounded-xl p-3 space-y-1.5">
                            <p className="text-[11px] font-bold text-red-400 uppercase tracking-wider">{t('admin.structure.deleteImpactTitle')}</p>
                            <ul className="space-y-1">
                                {[
                                    t('admin.structure.deleteImpactStudents').replace('{count}', String(students.length)),
                                    t('admin.structure.impactDeleteSubjects'),
                                    t('admin.structure.impactRemoveTeacherAssignments'),
                                    t('admin.structure.impactClearSchedule'),
                                ].map(line => (
                                    <li key={line} className="text-xs text-red-300/80 flex items-start gap-1.5">
                                        <span className="text-red-500 mt-0.5 shrink-0">·</span>
                                        {line}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setDeleteOpen(false)}
                                disabled={deleting}
                                className="flex-1 h-10 rounded-xl border border-white/8 text-gray-500 hover:text-gray-300 hover:bg-white/4 text-sm font-medium transition-colors disabled:opacity-40"
                            >
                                {t('admin.structure.cancelBtn')}
                            </button>
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={deleting}
                                className="flex-1 h-10 rounded-xl bg-red-600/85 hover:bg-red-600 text-white text-sm font-semibold disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                            >
                                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                {deleting ? t('admin.structure.deleting') : t('admin.structure.deleteBtn')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
