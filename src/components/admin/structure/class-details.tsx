'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Download, ArrowLeft, Loader2, BookOpen, Plus, X, Users, ClipboardList, UserPlus, Search, UserCheck, Pencil, Trash2, AlertTriangle, TrendingUp } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/i18n'
import { createClient } from '@/utils/supabase/client'
import { useSchoolContext } from '@/lib/use-school-context'
import { removeSubjectFromClass } from '@/app/admin/subjects/actions'
import { ClassPerformance } from './class-performance'
import { assignStudentToClass } from '@/app/admin/students/actions'
import { updateClass, deleteClass } from '@/app/admin/classes/actions'
import { toast } from 'sonner'

interface StudentRow {
    id: string
    name: string
    avatar: string
}

interface UnassignedStudent {
    id: string
    name: string
    avatar: string
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
    const [removingId, setRemovingId] = useState<string | null>(null)

    // Edit / Delete dialogs
    const [editOpen, setEditOpen] = useState(false)
    const [editName, setEditName] = useState('')
    const [editCapacity, setEditCapacity] = useState('')
    const [saving, setSaving] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [deleting, setDeleting] = useState(false)

    // Unassigned students panel
    const [showUnassigned, setShowUnassigned] = useState(false)
    const [unassigned, setUnassigned] = useState<UnassignedStudent[]>([])
    const [loadingUnassigned, setLoadingUnassigned] = useState(false)
    const [assigningId, setAssigningId] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')

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
                    .select('student_id, profiles!enrollments_student_id_fkey(id, full_name)')
                    .eq('class_id', classData.id)

                setStudents((enrollments || []).map((e: any) => ({
                    id: e.profiles?.id || e.student_id,
                    name: e.profiles?.full_name || 'Inconnu',
                    avatar: (e.profiles?.full_name || 'XX').split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase(),
                })))
            }
            setLoading(false)
        }
        load()
    }, [classId])

    // Load unassigned students
    const loadUnassigned = useCallback(async () => {
        if (!context) return
        setLoadingUnassigned(true)
        const supabase = createClient()
        const schoolId = context.school_id

        // All active students
        const { data: allStudents } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('school_id', schoolId)
            .eq('role', 'student')
            .eq('status', 'active')
            .order('full_name')

        // All enrolled student IDs
        const { data: enrollments } = await supabase
            .from('enrollments')
            .select('student_id')
            .eq('school_id', schoolId)
            .eq('status', 'active')

        const enrolledIds = new Set((enrollments || []).map((e: any) => e.student_id))

        const unassignedList = (allStudents || [])
            .filter((s: any) => !enrolledIds.has(s.id))
            .map((s: any) => ({
                id: s.id,
                name: s.full_name || 'Inconnu',
                avatar: (s.full_name || 'XX').split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase(),
            }))

        setUnassigned(unassignedList)
        setLoadingUnassigned(false)
    }, [context])

    useEffect(() => {
        if (showUnassigned) loadUnassigned()
    }, [showUnassigned, loadUnassigned])

    const handleAssign = async (student: UnassignedStudent) => {
        if (!resolvedClassId) return
        setAssigningId(student.id)
        const result = await assignStudentToClass(student.id, resolvedClassId)
        if (result?.error) {
            toast.error(result.error)
        } else {
            toast.success(`${student.name} affecté(e) à ${className}`)
            // Move student from unassigned to class list
            setUnassigned(prev => prev.filter(s => s.id !== student.id))
            setStudents(prev => [...prev, student])
        }
        setAssigningId(null)
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

    const handleRemove = async (subjectId: string, subjectName: string) => {
        setRemovingId(subjectId)
        const result = await removeSubjectFromClass(resolvedClassId, subjectId)
        if (result?.error) {
            toast.error(result.error)
        } else {
            toast.success(`${subjectName} retiré de la classe`)
            setClassSubjects(prev => prev.filter(s => s.id !== subjectId))
        }
        setRemovingId(null)
    }

    const handleEditOpen = () => {
        setEditName(className)
        setEditCapacity('40')
        setEditOpen(true)
    }

    const handleEditSave = async () => {
        if (!editName.trim()) { toast.error('Le nom est requis'); return }
        setSaving(true)
        const result = await updateClass(resolvedClassId, { name: editName.trim(), capacity: parseInt(editCapacity) || undefined })
        if (result?.error) {
            toast.error(result.error)
        } else {
            toast.success('Classe modifiée avec succès')
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
            toast.success(`Classe "${className}" supprimée`)
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

    // Filtered unassigned students by search
    const filteredUnassigned = searchQuery.trim()
        ? unassigned.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : unassigned

    return (
        <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-gray-400 hover:text-white -ml-2">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold text-white">Classe : {className || classId.toUpperCase()}</h2>
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
                                Affectations
                            </Button>
                        </Link>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleEditOpen}
                            className="gap-1.5 border-white/10 text-gray-300 hover:text-white hover:bg-white/5 text-xs"
                        >
                            <Pencil className="w-3.5 h-3.5" />
                            Modifier
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteOpen(true)}
                            className="gap-1.5 border-red-500/20 text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            Supprimer
                        </Button>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-white/10">
                <button
                    onClick={() => setActiveTab('students')}
                    className={cn(
                        "flex items-center gap-2 px-4 pb-3 text-sm font-bold transition-colors border-b-2",
                        activeTab === 'students'
                            ? "border-emerald-500 text-emerald-500"
                            : "border-transparent text-gray-500 hover:text-white"
                    )}
                >
                    <Users className="w-4 h-4" />
                    Élèves
                    <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded-full">{students.length}</span>
                </button>
                <button
                    onClick={() => setActiveTab('subjects')}
                    className={cn(
                        "flex items-center gap-2 px-4 pb-3 text-sm font-bold transition-colors border-b-2",
                        activeTab === 'subjects'
                            ? "border-emerald-500 text-emerald-500"
                            : "border-transparent text-gray-500 hover:text-white"
                    )}
                >
                    <BookOpen className="w-4 h-4" />
                    Matières
                    {classSubjects.length > 0 && (
                        <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded-full">{classSubjects.length}</span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('performance')}
                    className={cn(
                        "flex items-center gap-2 px-4 pb-3 text-sm font-bold transition-colors border-b-2",
                        activeTab === 'performance'
                            ? "border-emerald-500 text-emerald-500"
                            : "border-transparent text-gray-500 hover:text-white"
                    )}
                >
                    <TrendingUp className="w-4 h-4" />
                    Performances
                </button>
            </div>

            {/* Tab: Students */}
            {activeTab === 'students' && (
                <div className="flex-1 flex gap-5 min-h-0">

                    {/* Left: enrolled students */}
                    <div className={cn(
                        "flex flex-col transition-all duration-300",
                        showUnassigned ? "flex-1" : "flex-1"
                    )}>
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
                                        Exporter
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
                                            <><X className="w-3.5 h-3.5" /> Fermer</>
                                        ) : (
                                            <><UserPlus className="w-3.5 h-3.5" /> Affecter un élève</>
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
                                    <p className="text-sm text-gray-500">Aucun élève inscrit dans cette classe</p>
                                    {!showUnassigned && (
                                        <button
                                            onClick={() => setShowUnassigned(true)}
                                            className="mt-3 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                                        >
                                            Affecter des élèves →
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2 overflow-y-auto">
                                    {students.map((student) => (
                                        <div key={student.id} className="flex items-center gap-3 p-3 bg-[#0F1720] rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                            <div className="w-9 h-9 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400 font-bold text-xs shrink-0">
                                                {student.avatar}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-gray-200 text-sm truncate">{student.name}</p>
                                                <p className="text-[10px] text-gray-600 font-mono">{student.id.substring(0, 12)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: unassigned students panel */}
                    {showUnassigned && (
                        <div className="w-80 shrink-0 flex flex-col animate-in slide-in-from-right-4 duration-300">
                            <div className="bg-[#161B22] rounded-2xl border border-emerald-500/20 p-4 flex flex-col flex-1">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-6 h-6 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                                        <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                                    </div>
                                    <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                                        Élèves sans classe
                                    </p>
                                </div>

                                {/* Search */}
                                <div className="relative mb-3">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
                                    <Input
                                        placeholder="Rechercher un élève…"
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
                                            {searchQuery ? 'Aucun résultat' : 'Tous les élèves sont assignés'}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5 overflow-y-auto flex-1">
                                        <p className="text-[10px] text-gray-600 mb-2">
                                            {filteredUnassigned.length} élève{filteredUnassigned.length > 1 ? 's' : ''} non assigné{filteredUnassigned.length > 1 ? 's' : ''}
                                        </p>
                                        {filteredUnassigned.map(student => (
                                            <div
                                                key={student.id}
                                                className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#0D1117] border border-white/5 hover:border-emerald-500/20 transition-colors group"
                                            >
                                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 font-bold text-[11px] shrink-0">
                                                    {student.avatar}
                                                </div>
                                                <p className="text-xs font-medium text-gray-300 flex-1 truncate">{student.name}</p>
                                                <button
                                                    onClick={() => handleAssign(student)}
                                                    disabled={assigningId === student.id}
                                                    className="shrink-0 h-7 px-2.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-[11px] font-semibold border border-emerald-500/20 hover:bg-emerald-500/25 transition-colors disabled:opacity-50 flex items-center gap-1"
                                                >
                                                    {assigningId === student.id
                                                        ? <Loader2 className="w-3 h-3 animate-spin" />
                                                        : <><Plus className="w-3 h-3" />Affecter</>
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

            {/* Tab: Subjects */}
            {activeTab === 'subjects' && (
                <div className="flex-1 flex flex-col gap-4">
                    {/* Subjects list */}
                    <div className="flex-1 bg-[#1A2530] rounded-2xl border border-white/5 p-5">
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-4">
                            Programme de la classe · {classSubjects.length} matière{classSubjects.length !== 1 ? 's' : ''}
                        </p>

                        {loadingSubjects ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                            </div>
                        ) : classSubjects.length === 0 ? (
                            <div className="text-center py-12 text-gray-500 text-sm">
                                Aucune matière assignée à cette classe.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {classSubjects.map(subject => (
                                    <div key={subject.id} className="flex items-center justify-between p-3 bg-[#0F1720] rounded-xl border border-white/5 hover:border-emerald-500/20 transition-all group">
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
                                            className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                            title="Retirer de la classe"
                                            onClick={() => handleRemove(subject.id, subject.name)}
                                            disabled={removingId === subject.id}
                                        >
                                            {removingId === subject.id
                                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                                : <X className="w-4 h-4" />
                                            }
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Tab: Performance */}
            {activeTab === 'performance' && resolvedClassId && (
                <ClassPerformance
                    resolvedClassId={resolvedClassId}
                />
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
                                <h3 className="text-base font-semibold text-white">Modifier la classe</h3>
                                <p className="text-[11px] text-gray-500">Mettre à jour les informations</p>
                            </div>
                            <button onClick={() => setEditOpen(false)} className="ml-auto text-gray-600 hover:text-white transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Nom de la classe</label>
                                <Input
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    placeholder="Ex : 6ème A"
                                    className="bg-[#0D1117] border-white/8 text-white placeholder:text-gray-700 focus:border-blue-500/60 h-10 rounded-xl"
                                    onKeyDown={e => e.key === 'Enter' && handleEditSave()}
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Capacité maximale</label>
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
                                onClick={() => setEditOpen(false)}
                                className="flex-1 h-10 rounded-xl border border-white/8 text-gray-500 hover:text-gray-300 hover:bg-white/4 text-sm font-medium transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleEditSave}
                                disabled={saving || !editName.trim()}
                                className="flex-1 h-10 rounded-xl bg-blue-600/85 hover:bg-blue-600 text-white text-sm font-semibold disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                {saving ? 'Enregistrement…' : 'Enregistrer'}
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
                                <h3 className="text-base font-semibold text-white">Supprimer la classe</h3>
                                <p className="text-sm text-gray-400 mt-1">
                                    La classe <span className="font-semibold text-white">"{className}"</span> sera supprimée définitivement.
                                </p>
                            </div>
                        </div>

                        <div className="bg-red-500/8 border border-red-500/15 rounded-xl p-3 space-y-1.5">
                            <p className="text-[11px] font-bold text-red-400 uppercase tracking-wider">Cette action va :</p>
                            <ul className="space-y-1">
                                {[
                                    `Désassigner les ${students.length} élève${students.length !== 1 ? 's' : ''} de la classe`,
                                    'Supprimer toutes les matières liées',
                                    'Retirer les affectations enseignants',
                                    'Effacer les créneaux de l\'emploi du temps',
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
                                onClick={() => setDeleteOpen(false)}
                                disabled={deleting}
                                className="flex-1 h-10 rounded-xl border border-white/8 text-gray-500 hover:text-gray-300 hover:bg-white/4 text-sm font-medium transition-colors disabled:opacity-40"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="flex-1 h-10 rounded-xl bg-red-600/85 hover:bg-red-600 text-white text-sm font-semibold disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                            >
                                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                {deleting ? 'Suppression…' : 'Supprimer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
