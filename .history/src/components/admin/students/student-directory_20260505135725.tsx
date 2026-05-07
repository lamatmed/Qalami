/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
    Search, UserPlus, X, Loader2, ShieldAlert, GraduationCap,
    LayoutList, LayoutGrid, Square, CheckSquare2, ChevronDown, Upload,
} from 'lucide-react'
import { StatusBadge } from '@/components/admin/shared/status-badge'
import { ChangeStatusDialog } from '@/components/admin/shared/change-status-dialog'
import { AssignClassDialog } from '@/components/admin/students/assign-class-dialog'
import { CsvImportDialog } from '@/components/admin/students/csv-import-dialog'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { createClient } from '@/utils/supabase/client'
import { useLanguage } from '@/i18n'
import { assignStudentToClass } from '@/app/admin/students/actions'
import { getMySchoolContext } from '@/app/admin/actions'
import { toast } from 'sonner'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Student {
    id: string
    name: string
    className: string
    classId: string
    status: string
    gender: string | null
    paymentStatus: 'ok' | 'overdue' | null
    academicYear: string | null
    initials: string
    email: string
}

interface ClassOption {
    id: string
    name: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function genderLabel(g: string | null) {
    if (g === 'male') return 'Garçon'
    if (g === 'female') return 'Fille'
    return '—'
}

const STATUS_LABELS: Record<string, string> = {
    active: 'Actif',
    suspended: 'Suspendu',
    inactive: 'Inactif',
    archived: 'Archivé',
}

const statusDotClass = (status: string) => cn(
    "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#161B22]",
    status === 'active' ? "bg-emerald-500" :
    status === 'suspended' ? "bg-orange-500" :
    status === 'archived' ? "bg-red-500" : "bg-gray-500"
)

// ─── Filter dropdown (extracted outside component to avoid remount on render) ─

function FilterDropdown({
    label, active, open, onToggle, children,
}: {
    label: string
    active: boolean
    open: boolean
    onToggle: () => void
    children: React.ReactNode
}) {
    return (
        // stopImmediatePropagation on the *native* event prevents the document-level
        // click listener from firing when clicking inside this dropdown.
        // (React's e.stopPropagation() only stops synthetic event bubbling, not native listeners.)
        <div className="relative" onClick={(e) => e.nativeEvent.stopImmediatePropagation()}>
            <button
                onClick={onToggle}
                className={cn(
                    "inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium border transition-colors",
                    active
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : "bg-[#161B22] border-white/5 text-gray-400 hover:text-white"
                )}
            >
                {label} <ChevronDown className={cn("w-3 h-3 transition-transform", open && "rotate-180")} />
            </button>

            {open && (
                <div className="absolute top-full left-0 mt-1 min-w-[150px] bg-[#161B22] border border-white/10 rounded-xl shadow-xl z-50 py-1 animate-in fade-in duration-100 max-h-64 overflow-y-auto">
                    {children}
                </div>
            )}
        </div>
    )
}

function DropItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            className={cn(
                "w-full text-left px-4 py-2.5 text-xs hover:bg-white/5 transition-colors",
                active ? "text-emerald-400 font-bold" : "text-gray-300"
            )}
            onClick={onClick}
        >
            {label}
        </button>
    )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function StudentDirectory() {
    const { t } = useLanguage()

    // Data
    const [students, setStudents] = useState<Student[]>([])
    const [classes, setClasses] = useState<ClassOption[]>([])
    const [loading, setLoading] = useState(true)

    // Filters
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedClass, setSelectedClass] = useState('all')
    const [selectedStatus, setSelectedStatus] = useState('all')
    const [selectedGender, setSelectedGender] = useState('all')
    const [selectedPayment, setSelectedPayment] = useState('all')

    // Which dropdown is open (only one at a time)
    const [openDropdown, setOpenDropdown] = useState<'class' | 'status' | 'gender' | 'payment' | null>(null)

    // View + bulk selection
    const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [bulkClassId, setBulkClassId] = useState('')
    const [bulkAssigning, setBulkAssigning] = useState(false)

    // Dialogs
    const [statusDialog, setStatusDialog] = useState<{ open: boolean; student: Student | null }>({ open: false, student: null })
    const [assignDialog, setAssignDialog] = useState<{ open: boolean; student: Student | null }>({ open: false, student: null })
  
    // ── Fetch ──────────────────────────────────────────────────────────────────

    const fetchStudents = async () => {
        setLoading(true)
        const ctx = await getMySchoolContext()
        if (!ctx) { setLoading(false); return }
        const adminProfile = { school_id: ctx.school_id }
        const supabase = createClient()

        const [{ data: classesData }, { data: studentProfiles }] = await Promise.all([
            supabase
                .from('classes')
                .select('id, name')
                .eq('school_id', adminProfile.school_id)
                .order('name'),
            supabase
                .from('profiles')
                .select('id, full_name, email, status, gender')
                .eq('role', 'student')
                .eq('school_id', adminProfile.school_id)
                .order('full_name'),
        ])

        setClasses(classesData || [])
        if (!studentProfiles?.length) { setLoading(false); return }

        const studentIds = studentProfiles.map(p => p.id)

        // Batch fetch enrollments + payments
        const [{ data: enrollments }, { data: overduePayments }] = await Promise.all([
            supabase
                .from('enrollments')
                .select('student_id, class_id, academic_year_id, academic_years(name), classes(name)')
                .in('student_id', studentIds)
                .eq('school_id', adminProfile.school_id)
                .order('created_at', { ascending: false }),
            supabase
                .from('payments')
                .select('student_id')
                .in('student_id', studentIds)
                .eq('school_id', adminProfile.school_id)
                .eq('status', 'overdue'),
        ])

        // Maps: latest enrollment per student
        const enrollMap = new Map<string, any>()
        ;(enrollments || []).forEach((e: any) => {
            if (!enrollMap.has(e.student_id)) enrollMap.set(e.student_id, e)
        })

        // Set of students with overdue payments
        const overdueSet = new Set((overduePayments || []).map((p: any) => p.student_id))

        const result: Student[] = (studentProfiles as any[]).map(p => {
            const enroll = enrollMap.get(p.id)
            const parts = (p.full_name || 'Élève').split(' ')
            return {
                id: p.id,
                name: p.full_name || 'Élève',
                className: enroll?.classes?.name || 'Non assigné',
                classId: enroll?.class_id || '',
                status: p.status || 'active',
                gender: p.gender ?? null,
                paymentStatus: overdueSet.has(p.id) ? 'overdue' : 'ok',
                academicYear: (enroll?.academic_years as any)?.name ?? null,
                initials: (parts.length >= 2
                    ? `${parts[0][0]}${parts[1][0]}`
                    : parts[0].slice(0, 2)
                ).toUpperCase(),
                email: p.email || '',
            }
        })

        setStudents(result)
        setLoading(false)
    }

    useEffect(() => { fetchStudents() }, [])

    // Close dropdown on outside click
    useEffect(() => {
        const close = () => setOpenDropdown(null)
        document.addEventListener('click', close)
        return () => document.removeEventListener('click', close)
    }, [])

    // ── Filtering ─────────────────────────────────────────────────────────────

    const filteredStudents = useMemo(() => students.filter(s => {
        if (searchTerm) {
            const q = searchTerm.toLowerCase()
            if (!s.name.toLowerCase().includes(q) && !s.className.toLowerCase().includes(q)) return false
        }
        if (selectedClass !== 'all' && s.classId !== selectedClass) return false
        if (selectedStatus !== 'all' && s.status !== selectedStatus) return false
        if (selectedGender !== 'all' && s.gender !== selectedGender) return false
        if (selectedPayment === 'overdue' && s.paymentStatus !== 'overdue') return false
        if (selectedPayment === 'ok' && s.paymentStatus !== 'ok') return false
        return true
    }), [students, searchTerm, selectedClass, selectedStatus, selectedGender, selectedPayment])

    const hasActiveFilter = selectedClass !== 'all' || selectedStatus !== 'all' || selectedGender !== 'all' || selectedPayment !== 'all'

    const clearFilters = () => {
        setSelectedClass('all')
        setSelectedStatus('all')
        setSelectedGender('all')
        setSelectedPayment('all')
        setSearchTerm('')
    }

    // ── Bulk selection ────────────────────────────────────────────────────────

    const toggleSelect = (id: string) => setSelectedIds(prev => {
        const next = new Set(prev)
        next.has(id) ? next.delete(id) : next.add(id)
        return next
    })

    const toggleSelectAll = () => {
        setSelectedIds(selectedIds.size === filteredStudents.length
            ? new Set()
            : new Set(filteredStudents.map(s => s.id))
        )
    }

    const handleBulkAssign = async () => {
        if (!bulkClassId || selectedIds.size === 0) return
        setBulkAssigning(true)
        let ok = 0
        for (const id of selectedIds) {
            const res = await assignStudentToClass(id, bulkClassId)
            if (!res?.error) ok++
        }
        const cls = classes.find(c => c.id === bulkClassId)?.name ?? ''
        toast.success(`${ok} élève${ok > 1 ? 's' : ''} assigné${ok > 1 ? 's' : ''} à ${cls}`)
        setStudents(prev => prev.map(s => selectedIds.has(s.id) ? { ...s, className: cls, classId: bulkClassId } : s))
        setSelectedIds(new Set())
        setBulkClassId('')
        setBulkAssigning(false)
    }

    // ──────────────────────────────────────────────────────────────────────────

    const toggleDropdown = (name: 'class' | 'status' | 'gender' | 'payment') => {
        setOpenDropdown(prev => prev === name ? null : name)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col space-y-4 animate-in fade-in duration-500">

            {/* ── Row 1 : Search + controls + Inscrire ──────────────────────── */}
            <div className="flex gap-2 items-center">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                    <Input
                        placeholder={t('admin.students.searchPlaceholder')}
                        className="pl-10 bg-[#161B22] border-white/5 text-gray-300 focus:border-emerald-500/50 h-10 rounded-xl placeholder:text-gray-600 text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white" onClick={() => setSearchTerm('')}>
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* View toggle */}
                <div className="flex gap-0.5 bg-[#161B22] border border-white/5 rounded-xl p-1 shrink-0">
                    <button
                        onClick={() => setViewMode('cards')}
                        className={cn("p-1.5 rounded-lg transition-colors", viewMode === 'cards' ? "bg-white/10 text-white" : "text-gray-600 hover:text-gray-300")}
                        title="Vue cartes"
                    >
                        <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => setViewMode('table')}
                        className={cn("p-1.5 rounded-lg transition-colors", viewMode === 'table' ? "bg-white/10 text-white" : "text-gray-600 hover:text-gray-300")}
                        title="Vue tableau"
                    >
                        <LayoutList className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Import CSV */}
                <button
                    onClick={() => {;}}
                    className="p-2 rounded-xl bg-[#161B22] border border-white/5 text-gray-500 hover:text-white transition-colors shrink-0"
                    title="Importer depuis CSV"
                >
                    <Upload className="w-4 h-4" />
                </button>

                {/* Inscrire un élève — now in the toolbar, not floating */}
                <Link href="/admin/students/register" className="shrink-0">
                    <Button className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold h-10 rounded-xl px-4 gap-2 text-sm">
                        <UserPlus className="w-4 h-4" />
                        <span className="hidden sm:inline">{t('admin.students.enrollStudent')}</span>
                        <span className="sm:hidden">Inscrire</span>
                    </Button>
                </Link>
            </div>

            {/* ── Row 2 : Filters ───────────────────────────────────────────── */}
            <div className="flex items-center gap-2 flex-wrap">

                {/* Classe */}
                <FilterDropdown
                    label={selectedClass === 'all' ? 'Classe' : classes.find(c => c.id === selectedClass)?.name ?? 'Classe'}
                    active={selectedClass !== 'all'}
                    open={openDropdown === 'class'}
                    onToggle={() => toggleDropdown('class')}
                >
                    <DropItem label="Toutes" active={selectedClass === 'all'} onClick={() => { setSelectedClass('all'); setOpenDropdown(null) }} />
                    {classes.map(cls => (
                        <DropItem key={cls.id} label={cls.name} active={selectedClass === cls.id} onClick={() => { setSelectedClass(cls.id); setOpenDropdown(null) }} />
                    ))}
                </FilterDropdown>

                {/* Statut */}
                <FilterDropdown
                    label={selectedStatus === 'all' ? 'Statut' : STATUS_LABELS[selectedStatus] ?? selectedStatus}
                    active={selectedStatus !== 'all'}
                    open={openDropdown === 'status'}
                    onToggle={() => toggleDropdown('status')}
                >
                    <DropItem label="Tous" active={selectedStatus === 'all'} onClick={() => { setSelectedStatus('all'); setOpenDropdown(null) }} />
                    {Object.entries(STATUS_LABELS).map(([val, label]) => (
                        <DropItem key={val} label={label} active={selectedStatus === val} onClick={() => { setSelectedStatus(val); setOpenDropdown(null) }} />
                    ))}
                </FilterDropdown>

                {/* Genre */}
                <FilterDropdown
                    label={selectedGender === 'all' ? 'Genre' : selectedGender === 'male' ? 'Garçons' : 'Filles'}
                    active={selectedGender !== 'all'}
                    open={openDropdown === 'gender'}
                    onToggle={() => toggleDropdown('gender')}
                >
                    <DropItem label="Tous" active={selectedGender === 'all'} onClick={() => { setSelectedGender('all'); setOpenDropdown(null) }} />
                    <DropItem label="Garçons" active={selectedGender === 'male'} onClick={() => { setSelectedGender('male'); setOpenDropdown(null) }} />
                    <DropItem label="Filles" active={selectedGender === 'female'} onClick={() => { setSelectedGender('female'); setOpenDropdown(null) }} />
                </FilterDropdown>

                {/* Paiement */}
                <FilterDropdown
                    label={selectedPayment === 'all' ? 'Paiement' : selectedPayment === 'overdue' ? 'En retard' : 'À jour'}
                    active={selectedPayment !== 'all'}
                    open={openDropdown === 'payment'}
                    onToggle={() => toggleDropdown('payment')}
                >
                    <DropItem label="Tous" active={selectedPayment === 'all'} onClick={() => { setSelectedPayment('all'); setOpenDropdown(null) }} />
                    <DropItem label="À jour" active={selectedPayment === 'ok'} onClick={() => { setSelectedPayment('ok'); setOpenDropdown(null) }} />
                    <DropItem label="En retard" active={selectedPayment === 'overdue'} onClick={() => { setSelectedPayment('overdue'); setOpenDropdown(null) }} />
                </FilterDropdown>

                {/* Clear */}
                {(hasActiveFilter || searchTerm) && (
                    <button
                        onClick={clearFilters}
                        className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                    >
                        <X className="w-3 h-3" /> Effacer
                    </button>
                )}
            </div>

            {/* ── Results count + select all ────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">
                    <span className="font-bold text-emerald-500 uppercase tracking-widest">
                        {loading ? '…' : `${filteredStudents.length} élève${filteredStudents.length !== 1 ? 's' : ''}`}
                    </span>
                    {selectedIds.size > 0 && (
                        <span className="ml-2">· {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}</span>
                    )}
                </p>
                {!loading && filteredStudents.length > 0 && (
                    <button className="text-xs text-gray-600 hover:text-gray-300 transition-colors" onClick={toggleSelectAll}>
                        {selectedIds.size === filteredStudents.length ? 'Désélectionner tout' : 'Tout sélectionner'}
                    </button>
                )}
            </div>

            {/* ── Content ──────────────────────────────────────────────────── */}
            <div className="pb-6 min-h-0">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-7 h-7 text-emerald-500 animate-spin" />
                    </div>

                ) : filteredStudents.length === 0 ? (
                    <div className="text-center py-16 text-gray-500 text-sm">
                        {hasActiveFilter || searchTerm
                            ? <><p className="font-medium">Aucun résultat</p><button className="text-xs text-emerald-500 mt-2 hover:underline" onClick={clearFilters}>Effacer les filtres</button></>
                            : t('admin.students.noEnrolled')
                        }
                    </div>

                ) : viewMode === 'cards' ? (
                    /* ── Card view ─────────────────────────────────────────── */
                    <div className="space-y-1.5">
                        {filteredStudents.map(student => (
                            <div
                                key={student.id}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all group",
                                    selectedIds.has(student.id)
                                        ? "bg-emerald-500/5 border-emerald-500/30"
                                        : "bg-[#161B22] border-transparent hover:border-white/10"
                                )}
                            >
                                {/* Checkbox — only for unassigned students */}
                                {student.className === 'Non assigné' && (
                                    <button
                                        className="shrink-0 text-gray-700 hover:text-emerald-500 transition-colors"
                                        onClick={() => toggleSelect(student.id)}
                                    >
                                        {selectedIds.has(student.id)
                                            ? <CheckSquare2 className="w-4 h-4 text-emerald-500" />
                                            : <Square className="w-4 h-4" />
                                        }
                                    </button>
                                )}
                                {student.className !== 'Non assigné' && (
                                    <div className="w-4 shrink-0" />
                                )}

                                {/* Profile link */}
                                <Link href={`/admin/students/${student.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className="relative shrink-0">
                                        <Avatar className="h-9 w-9 border-2 border-[#0D1117]">
                                            <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${student.name}`} />
                                            <AvatarFallback className="bg-[#21262d] text-gray-300 font-bold text-xs">{student.initials}</AvatarFallback>
                                        </Avatar>
                                        <div className={statusDotClass(student.status)} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-sm text-white group-hover:text-emerald-400 transition-colors truncate">{student.name}</p>
                                        <p className="text-xs text-gray-500 truncate">
                                            {student.className}
                                            {student.gender && <> · {genderLabel(student.gender)}</>}
                                            {student.paymentStatus === 'overdue' && <span className="text-red-400 ml-1">· En retard</span>}
                                        </p>
                                    </div>
                                    <StatusBadge status={student.status} />
                                </Link>

                                {/* Row actions */}
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                    {student.className === 'Non assigné' && (
                                        <button
                                            className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-500/10 transition-colors"
                                            title="Assigner à une classe"
                                            onClick={(e) => { e.preventDefault(); setAssignDialog({ open: true, student }) }}
                                        >
                                            <GraduationCap className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                    <button
                                        className="p-1.5 rounded-lg text-gray-600 hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
                                        title="Changer le statut"
                                        onClick={(e) => { e.preventDefault(); setStatusDialog({ open: true, student }) }}
                                    >
                                        <ShieldAlert className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                ) : (
                    /* ── Table view ────────────────────────────────────────── */
                    <div className="bg-[#161B22] rounded-2xl border border-white/5 overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/5">
                                    <th className="w-10 p-3 text-center">
                                        <button onClick={toggleSelectAll} className="text-gray-600 hover:text-emerald-500 transition-colors">
                                            {selectedIds.size === filteredStudents.length && filteredStudents.length > 0
                                                ? <CheckSquare2 className="w-4 h-4 text-emerald-500" />
                                                : <Square className="w-4 h-4" />
                                            }
                                        </button>
                                    </th>
                                    <th className="text-left px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Élève</th>
                                    <th className="text-left px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider hidden md:table-cell">Classe</th>
                                    <th className="text-left px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Statut</th>
                                    <th className="text-left px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Genre</th>
                                    <th className="text-left px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Paiement</th>
                                    <th className="w-16"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredStudents.map(student => (
                                    <tr key={student.id} className={cn("group transition-colors", selectedIds.has(student.id) ? "bg-emerald-500/5" : "hover:bg-white/[0.02]")}>
                                        <td className="p-3 text-center">
                                            {student.className === 'Non assigné' && (
                                                <button onClick={() => toggleSelect(student.id)} className="text-gray-600 hover:text-emerald-500 transition-colors">
                                                    {selectedIds.has(student.id)
                                                        ? <CheckSquare2 className="w-4 h-4 text-emerald-500" />
                                                        : <Square className="w-4 h-4" />
                                                    }
                                                </button>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <Link href={`/admin/students/${student.id}`} className="flex items-center gap-2.5 min-w-0 group/link">
                                                <Avatar className="h-8 w-8 shrink-0">
                                                    <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${student.name}`} />
                                                    <AvatarFallback className="bg-[#21262d] text-gray-300 font-bold text-xs">{student.initials}</AvatarFallback>
                                                </Avatar>
                                                <span className="text-sm font-medium text-white group-hover/link:text-emerald-400 transition-colors truncate">{student.name}</span>
                                            </Link>
                                        </td>
                                        <td className="px-3 py-2.5 hidden md:table-cell text-sm text-gray-400">{student.className}</td>
                                        <td className="px-3 py-2.5 hidden sm:table-cell"><StatusBadge status={student.status} /></td>
                                        <td className="px-3 py-2.5 hidden lg:table-cell text-xs text-gray-500">{genderLabel(student.gender)}</td>
                                        <td className="px-3 py-2.5 hidden lg:table-cell">
                                            {student.paymentStatus === 'overdue'
                                                ? <span className="text-xs font-medium text-red-400">En retard</span>
                                                : <span className="text-xs text-gray-600">À jour</span>
                                            }
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {student.className === 'Non assigné' && (
                                                    <button className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-500/10 transition-colors" onClick={() => setAssignDialog({ open: true, student })}>
                                                        <GraduationCap className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                                <button className="p-1.5 rounded-lg text-gray-600 hover:text-orange-400 hover:bg-orange-500/10 transition-colors" onClick={() => setStatusDialog({ open: true, student })}>
                                                    <ShieldAlert className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Bulk action bar ───────────────────────────────────────────── */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#1A2530] border border-white/10 rounded-2xl px-4 py-3 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
                    <span className="text-sm font-bold text-white whitespace-nowrap">
                        {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
                    </span>
                    <div className="h-4 w-px bg-white/10 shrink-0" />
                    <select
                        value={bulkClassId}
                        onChange={(e) => setBulkClassId(e.target.value)}
                        className="bg-[#0F1720] border border-white/10 text-gray-300 text-sm rounded-lg px-3 py-1.5 min-w-[140px] focus:outline-none focus:border-emerald-500/50"
                    >
                        <option value="">Choisir une classe…</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button
                        onClick={handleBulkAssign}
                        disabled={!bulkClassId || bulkAssigning}
                        className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-black font-bold text-sm px-4 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                        {bulkAssigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GraduationCap className="w-3.5 h-3.5" />}
                        Assigner
                    </button>
                    <button className="p-1.5 text-gray-500 hover:text-white transition-colors" onClick={() => setSelectedIds(new Set())}>
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* ── Dialogs ───────────────────────────────────────────────────── */}
            <ChangeStatusDialog
                open={statusDialog.open}
                onOpenChange={(open) => setStatusDialog(s => ({ ...s, open }))}
                userId={statusDialog.student?.id ?? ''}
                currentStatus={statusDialog.student?.status ?? 'active'}
                userName={statusDialog.student?.name ?? ''}
                onSuccess={(newStatus) => {
                    setStudents(prev => prev.map(s => s.id === statusDialog.student?.id ? { ...s, status: newStatus } : s))
                }}
            />

            {assignDialog.student && (
                <AssignClassDialog
                    open={assignDialog.open}
                    onOpenChange={(open) => setAssignDialog(s => ({ ...s, open }))}
                    studentId={assignDialog.student.id}
                    studentName={assignDialog.student.name}
                    currentClassId={assignDialog.student.classId || null}
                    onSuccess={(className) => {
                        setStudents(prev => prev.map(s => s.id === assignDialog.student?.id ? { ...s, className } : s))
                    }}
                />
            )}

            <CsvImportDialog
                open={importOpen}
                onOpenChange={setImportOpen}
                classes={classes}
                onSuccess={(count) => {
                    toast.success(`${count} élève${count > 1 ? 's' : ''} importé${count > 1 ? 's' : ''}`)
                    setImportOpen(false)
                    fetchStudents()
                }}
            />
        </div>
    )
}
