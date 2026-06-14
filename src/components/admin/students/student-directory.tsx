/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
    Search, UserPlus, X, Loader2, ShieldAlert, GraduationCap,
    LayoutList, LayoutGrid, Square, CheckSquare2, ChevronDown, Upload, KeyRound, Pencil, ArrowLeftRight
} from 'lucide-react'
import { StatusBadge } from '@/components/admin/shared/status-badge'
import { ChangeStatusDialog } from '@/components/admin/shared/change-status-dialog'
import { ChangePasswordDialog } from '@/components/admin/shared/change-password-dialog'
import { AssignClassDialog } from '@/components/admin/students/assign-class-dialog'
import { CsvImportDialog } from '@/components/admin/students/csv-import-dialog'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { createClient } from '@/utils/supabase/client'
import { useLanguage } from '@/i18n'
import { assignStudentToClass } from '@/app/admin/students/actions'
import { getMySchoolContext, getSchoolLinkedProfileIds } from '@/app/admin/actions'
import { toast } from 'sonner'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Student {
    id: string
    name: string
    className: string
    classId: string
    status: string
    isTransferred: boolean
    gender: string | null
    paymentStatus: 'ok' | 'overdue' | null
    academicYear: string | null
    initials: string
    email: string
    nationalId: string | null
    phone: string | null
}

interface ClassOption {
    id: string
    name: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function genderLabel(g: string | null) {
    if (g === 'male') return 'common.male'
    if (g === 'female') return 'common.female'
    return null
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
    const { t, language } = useLanguage()
    const isRtl = language === 'ar'

    const STATUS_LABELS: Record<string, string> = {
        active: t('admin.students.statusActive'),
        suspended: t('admin.students.statusSuspended'),
        inactive: t('admin.students.statusInactive'),
        archived: t('admin.students.statusArchived'),
    }

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
    const [passwordDialog, setPasswordDialog] = useState<{ open: boolean; student: Student | null }>({ open: false, student: null })
    const [assignDialog, setAssignDialog] = useState<{ open: boolean; student: Student | null }>({ open: false, student: null })
    const [importOpen, setImportOpen] = useState(false)

    // ── Fetch ──────────────────────────────────────────────────────────────────

    const fetchStudents = async () => {
        setLoading(true)
        const ctx = await getMySchoolContext()
        if (!ctx) { setLoading(false); return }
        const adminProfile = { school_id: ctx.school_id }
        const supabase = createClient()

        const [{ data: classesData }, { data: directProfiles }] = await Promise.all([
            supabase
                .from('classes')
                .select('id, name')
                .eq('school_id', adminProfile.school_id)
                .order('name'),
            supabase
                .from('profiles')
                .select('id, full_name, email, status, gender, national_id, phone, school_id')
                .eq('role', 'student')
                .eq('school_id', adminProfile.school_id)
                .order('full_name'),
        ])

        const linkedIds = await getSchoolLinkedProfileIds(adminProfile.school_id, 'student')
        let linkedProfiles: any[] = []
        if (linkedIds.length > 0) {
            const { data: linkedData } = await supabase
                .from('profiles')
                .select('id, full_name, email, status, gender, national_id, phone, school_id')
                .eq('role', 'student')
                .in('id', linkedIds)
            if (linkedData) {
                linkedProfiles = linkedData
            }
        }

        // Merge and de-duplicate profiles
        const profileMap = new Map<string, any>()
        ;(directProfiles || []).forEach(p => {
            profileMap.set(p.id, p)
        })
        ;(linkedProfiles || []).forEach(p => {
            if (!profileMap.has(p.id)) {
                profileMap.set(p.id, p)
            }
        })
        const mergedProfiles = Array.from(profileMap.values())

        setClasses(classesData || [])
        if (!mergedProfiles.length) { setStudents([]); setLoading(false); return }

        const studentIds = mergedProfiles.map(p => p.id)

        // Batch fetch enrollments + payments
        const [{ data: enrollments }, { data: overduePayments }] = await Promise.all([
            supabase
                .from('enrollments')
                .select('student_id, class_id, academic_year_id, academic_years(name), classes(name), status')
                .in('student_id', studentIds)
                .eq('school_id', adminProfile.school_id)
                .order('created_at', { ascending: false }),
            supabase
                .from('payments')
                .select('student_id, payment_status, due_date')
                .in('student_id', studentIds)
                .eq('school_id', adminProfile.school_id)
                .in('payment_status', ['pending', 'overdue']),
        ])

        // Maps: latest enrollment per student
        const enrollMap = new Map<string, any>()
        ;(enrollments || []).forEach((e: any) => {
            if (!enrollMap.has(e.student_id)) enrollMap.set(e.student_id, e)
        })

        // Set of students with overdue payments — current month not yet paid is NOT overdue
        const now = new Date()
        const startOfMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
        const overdueSet = new Set(
            (overduePayments || [])
                .filter((p: any) => p.payment_status === 'overdue' || (p.due_date && p.due_date < startOfMonthStr))
                .map((p: any) => p.student_id)
        )

        const result: Student[] = mergedProfiles
            .filter(p => {
                const enroll = enrollMap.get(p.id)
                const isTransferred = p.school_id !== adminProfile.school_id || enroll?.status === 'transferred'
                return !isTransferred
            })
            .map(p => {
                const enroll = enrollMap.get(p.id)
                const parts = (p.full_name || t('common.student')).split(' ')
                const displayStatus = p.status || 'active'
                return {
                    id: p.id,
                    name: p.full_name || t('common.student'),
                    className: enroll?.classes?.name || '',
                    classId: enroll?.class_id || '',
                    status: displayStatus,
                    isTransferred: false,
                    gender: p.gender ?? null,
                    paymentStatus: overdueSet.has(p.id) ? 'overdue' : 'ok',
                    academicYear: (enroll?.academic_years as any)?.name ?? null,
                    initials: (parts.length >= 2
                        ? `${parts[0][0]}${parts[1][0]}`
                        : parts[0].slice(0, 2)
                    ).toUpperCase(),
                    email: p.email || '',
                    nationalId: p.national_id ?? null,
                    phone: p.phone ?? null,
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
            const matchesName = s.name.toLowerCase().includes(q)
            const matchesClass = s.className.toLowerCase().includes(q)
            const matchesNNI = s.nationalId ? s.nationalId.toLowerCase().includes(q) : false
            if (!matchesName && !matchesClass && !matchesNNI) return false
        }
        if (selectedClass === 'unassigned') {
            if (s.classId) return false
            if (s.status === 'archived') return false
        } else if (selectedClass !== 'all') {
            if (s.classId !== selectedClass) return false
        }
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
        toast.success(t('admin.students.assignedToClass', { count: ok, className: cls }))
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
                    <Search className={cn("absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none", isRtl ? "right-3" : "left-3")} />
                    <Input
                        dir={isRtl ? 'rtl' : 'ltr'}
                        placeholder={t('admin.students.searchPlaceholder')}
                        className={cn(
                            "bg-[#161B22] border-white/5 text-gray-300 focus:border-emerald-500/50 h-10 rounded-xl placeholder:text-gray-600 text-sm",
                            isRtl ? "text-right pr-10 pl-8" : "pl-10 pr-8"
                        )}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button className={cn("absolute top-1/2 -translate-y-1/2 text-gray-500 hover:text-white", isRtl ? "left-3" : "right-3")} onClick={() => setSearchTerm('')}>
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* View toggle */}
                <div className="flex gap-0.5 bg-[#161B22] border border-white/5 rounded-xl p-1 shrink-0">
                    <button
                        onClick={() => setViewMode('cards')}
                        className={cn("p-1.5 rounded-lg transition-colors", viewMode === 'cards' ? "bg-white/10 text-white" : "text-gray-600 hover:text-gray-300")}
                        title={t('admin.students.cardsView')}
                    >
                        <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => setViewMode('table')}
                        className={cn("p-1.5 rounded-lg transition-colors", viewMode === 'table' ? "bg-white/10 text-white" : "text-gray-600 hover:text-gray-300")}
                        title={t('admin.students.tableView')}
                    >
                        <LayoutList className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Import CSV */}
                <button
                    onClick={() => setImportOpen(true)}
                    className="p-2 rounded-xl bg-[#161B22] border border-white/5 text-gray-500 hover:text-white transition-colors shrink-0"
                    title={t('admin.students.importCsv')}
                >
                    <Upload className="w-4 h-4" />
                </button>

                {/* Élèves transférés */}
                <Link href="/admin/students/transferred" className="shrink-0">
                    <Button variant="outline" className="border-white/10 bg-[#161B22] text-gray-300 hover:text-white hover:bg-white/5 h-10 rounded-xl px-4 gap-2 text-sm">
                        <ArrowLeftRight className="w-4 h-4 text-emerald-500" />
                        <span>{t('admin.sidebar.transferredStudents')}</span>
                    </Button>
                </Link>

                {/* Inscrire un élève — now in the toolbar, not floating */}
                <Link href="/admin/students/register" className="shrink-0">
                    <Button className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold h-10 rounded-xl px-4 gap-2 text-sm">
                        <UserPlus className="w-4 h-4" />
                        <span className="hidden sm:inline">{t('admin.students.enrollStudent')}</span>
                        <span className="sm:hidden">{t('admin.students.enrollShort')}</span>
                    </Button>
                </Link>
            </div>

            {/* ── Row 2 : Filters ───────────────────────────────────────────── */}
            <div className="flex items-center gap-2 flex-wrap">

                {/* Classe */}
                <FilterDropdown
                    label={
                        selectedClass === 'all' ? t('admin.students.class') :
                        selectedClass === 'unassigned' ? t('admin.students.list.unassigned') :
                        classes.find(c => c.id === selectedClass)?.name ?? t('admin.students.class')
                    }
                    active={selectedClass !== 'all'}
                    open={openDropdown === 'class'}
                    onToggle={() => toggleDropdown('class')}
                >
                    <DropItem label={t('admin.students.allClasses')} active={selectedClass === 'all'} onClick={() => { setSelectedClass('all'); setOpenDropdown(null) }} />
                    <DropItem label={t('admin.students.list.unassigned')} active={selectedClass === 'unassigned'} onClick={() => { setSelectedClass('unassigned'); setOpenDropdown(null) }} />
                    {classes.length > 0 && <div className="mx-3 my-1 h-px bg-white/5" />}
                    {classes.map(cls => (
                        <DropItem key={cls.id} label={cls.name} active={selectedClass === cls.id} onClick={() => { setSelectedClass(cls.id); setOpenDropdown(null) }} />
                    ))}
                </FilterDropdown>

                {/* Statut */}
                <FilterDropdown
                    label={selectedStatus === 'all' ? t('common.status') : STATUS_LABELS[selectedStatus] ?? selectedStatus}
                    active={selectedStatus !== 'all'}
                    open={openDropdown === 'status'}
                    onToggle={() => toggleDropdown('status')}
                >
                    <DropItem label={t('common.all')} active={selectedStatus === 'all'} onClick={() => { setSelectedStatus('all'); setOpenDropdown(null) }} />
                    {Object.entries(STATUS_LABELS).map(([val, label]) => (
                        <DropItem key={val} label={label} active={selectedStatus === val} onClick={() => { setSelectedStatus(val); setOpenDropdown(null) }} />
                    ))}
                </FilterDropdown>

                {/* Genre */}
                <FilterDropdown
                    label={selectedGender === 'all' ? t('admin.students.gender') : selectedGender === 'male' ? t('admin.students.boys') : t('admin.students.girls')}
                    active={selectedGender !== 'all'}
                    open={openDropdown === 'gender'}
                    onToggle={() => toggleDropdown('gender')}
                >
                    <DropItem label={t('common.all')} active={selectedGender === 'all'} onClick={() => { setSelectedGender('all'); setOpenDropdown(null) }} />
                    <DropItem label={t('admin.students.boys')} active={selectedGender === 'male'} onClick={() => { setSelectedGender('male'); setOpenDropdown(null) }} />
                    <DropItem label={t('admin.students.girls')} active={selectedGender === 'female'} onClick={() => { setSelectedGender('female'); setOpenDropdown(null) }} />
                </FilterDropdown>

                {/* Paiement */}
                <FilterDropdown
                    label={selectedPayment === 'all' ? t('admin.students.payment') : selectedPayment === 'overdue' ? t('common.overdue') : t('admin.students.paidUp')}
                    active={selectedPayment !== 'all'}
                    open={openDropdown === 'payment'}
                    onToggle={() => toggleDropdown('payment')}
                >
                    <DropItem label={t('common.all')} active={selectedPayment === 'all'} onClick={() => { setSelectedPayment('all'); setOpenDropdown(null) }} />
                    <DropItem label={t('admin.students.paidUp')} active={selectedPayment === 'ok'} onClick={() => { setSelectedPayment('ok'); setOpenDropdown(null) }} />
                    <DropItem label={t('common.overdue')} active={selectedPayment === 'overdue'} onClick={() => { setSelectedPayment('overdue'); setOpenDropdown(null) }} />
                </FilterDropdown>

                {/* Filtre rapide : élèves non assignés */}
                <button
                    onClick={() => { setSelectedClass(selectedClass === 'unassigned' ? 'all' : 'unassigned'); setOpenDropdown(null) }}
                    className={cn(
                        "inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-bold transition-colors border",
                        selectedClass === 'unassigned'
                            ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                            : "bg-[#1A2530] border-white/10 text-amber-400/70 hover:text-amber-400 hover:border-amber-500/30"
                    )}
                >
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                    {t('admin.students.list.unassigned')}
                </button>

                {/* Clear */}
                {(hasActiveFilter || searchTerm) && (
                    <button
                        onClick={clearFilters}
                        className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                    >
                        <X className="w-3 h-3" /> {t('admin.students.clear')}
                    </button>
                )}
            </div>

            {/* ── Results count + select all ────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">
                    <span className="font-bold text-emerald-500 uppercase tracking-widest">
                        {loading ? '…' : t('admin.students.resultsCount', { count: filteredStudents.length })}
                    </span>
                    {selectedIds.size > 0 && (
                        <span className="ml-2">· {t('admin.students.selectedCount', { count: selectedIds.size })}</span>
                    )}
                </p>
                {!loading && filteredStudents.length > 0 && (
                    <button className="text-xs text-gray-600 hover:text-gray-300 transition-colors" onClick={toggleSelectAll}>
                        {selectedIds.size === filteredStudents.length ? t('admin.students.deselectAll') : t('admin.students.selectAll')}
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
                            ? <><p className="font-medium">{t('common.noResults')}</p><button className="text-xs text-emerald-500 mt-2 hover:underline" onClick={clearFilters}>{t('admin.students.clearFilters')}</button></>
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
                                {!student.classId && student.status !== 'archived' && (
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
                                {(student.classId || student.status === 'archived') && (
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
                                        <p className="text-xs text-gray-500 truncate flex flex-wrap gap-x-1 items-center">
                                            {student.status !== 'archived' ? (
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAssignDialog({ open: true, student }) }}
                                                    className="flex items-center gap-0.5 hover:text-emerald-400 transition-colors group/cls"
                                                    title={t('admin.students.assignClassDialog.changeClass')}
                                                >
                                                    <span className={cn(!student.classId && "text-amber-400 group-hover/cls:text-emerald-400")}>
                                                        {student.className || t('admin.students.unassigned')}
                                                    </span>
                                                    <Pencil className="w-2.5 h-2.5 opacity-0 group-hover/cls:opacity-100 transition-opacity shrink-0" />
                                                </button>
                                            ) : (
                                                <span>{student.className || t('admin.students.unassigned')}</span>
                                            )}
                                            {student.gender && genderLabel(student.gender) && <><span>·</span> <span>{t(genderLabel(student.gender) as string)}</span></>}
                                            {student.nationalId && <><span>·</span> <span className="font-mono bg-white/5 px-1 rounded text-[10px]">{student.nationalId}</span></>}
                                            {student.paymentStatus === 'overdue' && <><span>·</span> <span className="text-red-400">{t('common.overdue')}</span></>}
                                        </p>
                                    </div>
                                    <StatusBadge status={student.status} />
                                </Link>

                                {/* Row actions */}
                                <div className={cn(
                                    "flex items-center gap-0.5 shrink-0 transition-opacity",
                                    selectedClass === 'unassigned' ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                )}>
                                    {student.status !== 'archived' && (
                                        <>
                                            {!student.classId && (
                                                <button
                                                    className={cn(
                                                        "rounded-lg text-amber-500 hover:bg-amber-500/10 transition-colors flex items-center gap-1.5",
                                                        selectedClass === 'unassigned'
                                                            ? "px-2.5 py-1.5 border border-amber-500/30 bg-amber-500/10 text-xs font-semibold"
                                                            : "p-1.5"
                                                    )}
                                                    title={t('admin.students.assignToClass')}
                                                    onClick={(e) => { e.preventDefault(); setAssignDialog({ open: true, student }) }}
                                                >
                                                    <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                                                    {selectedClass === 'unassigned' && (
                                                        <span>{t('admin.students.assign')}</span>
                                                    )}
                                                </button>
                                            )}
                                             {student.phone && (
                                                 <button
                                                     className="p-1.5 rounded-lg text-gray-600 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                                                     title={t('admin.users.changePassword') || 'Modifier le mot de passe'}
                                                     onClick={(e) => { e.preventDefault(); setPasswordDialog({ open: true, student }) }}
                                                 >
                                                     <KeyRound className="w-3.5 h-3.5" />
                                                 </button>
                                             )}
                                        </>
                                    )}
                                    {!student.isTransferred && selectedClass !== 'unassigned' && (
                                        <button
                                            className="p-1.5 rounded-lg text-gray-600 hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
                                            title={t('admin.students.changeStatus')}
                                            onClick={(e) => { e.preventDefault(); setStatusDialog({ open: true, student }) }}
                                        >
                                            <ShieldAlert className="w-3.5 h-3.5" />
                                        </button>
                                    )}
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
                                    <th className="text-left px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('common.student')}</th>
                                    <th className="text-left px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider hidden md:table-cell">{t('admin.students.class')}</th>
                                    <th className="text-left px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider hidden sm:table-cell">{t('common.status')}</th>
                                    <th className="text-left px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider hidden lg:table-cell">{t('admin.students.gender')}</th>
                                    <th className="text-left px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider hidden lg:table-cell">{t('admin.students.payment')}</th>
                                    <th className="w-16"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredStudents.map(student => (
                                    <tr key={student.id} className={cn("group transition-colors", selectedIds.has(student.id) ? "bg-emerald-500/5" : "hover:bg-white/[0.02]")}>
                                        <td className="p-3 text-center">
                                            {!student.classId && student.status !== 'archived' && (
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
                                        <td className="px-3 py-2.5 hidden md:table-cell">
                                            {student.status !== 'archived' ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setAssignDialog({ open: true, student })}
                                                    className="flex items-center gap-1 text-sm text-gray-400 hover:text-emerald-400 transition-colors group/cls"
                                                    title={t('admin.students.assignClassDialog.changeClass')}
                                                >
                                                    <span className={cn(!student.classId && "text-amber-400 group-hover/cls:text-emerald-400")}>
                                                        {student.className || t('admin.students.unassigned')}
                                                    </span>
                                                    <Pencil className="w-3 h-3 opacity-0 group-hover/cls:opacity-100 transition-opacity shrink-0" />
                                                </button>
                                            ) : (
                                                <span className="text-sm text-gray-400">{student.className || t('admin.students.unassigned')}</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5 hidden sm:table-cell"><StatusBadge status={student.status} /></td>
                                        <td className="px-3 py-2.5 hidden lg:table-cell text-xs text-gray-500">{genderLabel(student.gender) ? t(genderLabel(student.gender) as string) : '—'}</td>
                                        <td className="px-3 py-2.5 hidden lg:table-cell">
                                            {student.paymentStatus === 'overdue'
                                                ? <span className="text-xs font-medium text-red-400">{t('common.overdue')}</span>
                                                : <span className="text-xs text-gray-600">{t('admin.students.paidUp')}</span>
                                            }
                                        </td>
                                         <td className="px-3 py-2.5">
                                             <div className={cn(
                                                 "flex items-center gap-0.5 transition-opacity",
                                                 selectedClass === 'unassigned' ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                             )}>
                                                 {student.status !== 'archived' && (
                                                     <>
                                                         {!student.classId && (
                                                             <button
                                                                 className={cn(
                                                                     "rounded-lg text-amber-500 hover:bg-amber-500/10 transition-colors flex items-center gap-1.5",
                                                                     selectedClass === 'unassigned'
                                                                         ? "px-2.5 py-1.5 border border-amber-500/30 bg-amber-500/10 text-xs font-semibold"
                                                                         : "p-1.5"
                                                                 )}
                                                                 onClick={() => setAssignDialog({ open: true, student })}
                                                             >
                                                                 <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                                                                 {selectedClass === 'unassigned' && (
                                                                     <span>{t('admin.students.assign')}</span>
                                                                 )}
                                                             </button>
                                                         )}
                                                         {student.phone && (
                                                             <button
                                                                 className="p-1.5 rounded-lg text-gray-600 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                                                                 title={t('admin.users.changePassword') || 'Modifier le mot de passe'}
                                                                 onClick={() => setPasswordDialog({ open: true, student })}
                                                             >
                                                                 <KeyRound className="w-3.5 h-3.5" />
                                                             </button>
                                                         )}
                                                     </>
                                                 )}
                                                 {!student.isTransferred && selectedClass !== 'unassigned' && (
                                                     <button
                                                         className="p-1.5 rounded-lg text-gray-600 hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
                                                         title={t('admin.students.changeStatus')}
                                                         onClick={() => setStatusDialog({ open: true, student })}
                                                     >
                                                         <ShieldAlert className="w-3.5 h-3.5" />
                                                     </button>
                                                 )}
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
                        {t('admin.students.selectedCount', { count: selectedIds.size })}
                    </span>
                    <div className="h-4 w-px bg-white/10 shrink-0" />
                    <select
                        value={bulkClassId}
                        onChange={(e) => setBulkClassId(e.target.value)}
                        className="bg-[#0F1720] border border-white/10 text-gray-300 text-sm rounded-lg px-3 py-1.5 min-w-[140px] focus:outline-none focus:border-emerald-500/50"
                    >
                        <option value="">{t('admin.students.chooseClass')}</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button
                        onClick={handleBulkAssign}
                        disabled={!bulkClassId || bulkAssigning}
                        className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-black font-bold text-sm px-4 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                        {bulkAssigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GraduationCap className="w-3.5 h-3.5" />}
                        {t('admin.students.assign')}
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
            <ChangePasswordDialog
                open={passwordDialog.open}
                onOpenChange={(open) => setPasswordDialog(s => ({ ...s, open }))}
                userId={passwordDialog.student?.id ?? ''}
                userName={passwordDialog.student?.name ?? ''}
                userPhone={passwordDialog.student?.phone ?? null}
            />

            {assignDialog.student && (
                <AssignClassDialog
                    open={assignDialog.open}
                    onOpenChange={(open) => setAssignDialog(s => ({ ...s, open }))}
                    studentId={assignDialog.student.id}
                    studentName={assignDialog.student.name}
                    currentClassId={assignDialog.student.classId || null}
                    onSuccess={(className, classId) => {
                        setStudents(prev => prev.map(s => s.id === assignDialog.student?.id ? { ...s, className, classId } : s))
                    }}
                />
            )}

            <CsvImportDialog
                open={importOpen}
                onOpenChange={setImportOpen}
                classes={classes}
                onSuccess={(count) => {
                    toast.success(t('admin.students.importedCount', { count }))
                    setImportOpen(false)
                    fetchStudents()
                }}
            />
        </div>
    )
}
