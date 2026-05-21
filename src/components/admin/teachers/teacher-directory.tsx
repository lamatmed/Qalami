/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Plus, ShieldAlert, AlertTriangle, Clock, BookOpen, KeyRound } from 'lucide-react'
import { StatusDot } from '@/components/admin/shared/status-badge'
import { ChangeStatusDialog } from '@/components/admin/shared/change-status-dialog'
import { ChangePasswordDialog } from '@/components/admin/shared/change-password-dialog'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import { useLanguage } from '@/i18n'
import { getMySchoolContext, getSchoolLinkedProfileIds, secureFetchProfiles } from '@/app/admin/actions'

interface Teacher {
    id: string
    name: string
    subjects: string[]
    classes: string[]
    weeklyHours: number
    status: string
    phone: string | null
    email: string | null
    avatar: string | null
    hasAssignment: boolean
    nationalId?: string | null
}

function parseMinutes(t: string): number {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + (m || 0)
}

export function TeacherDirectory() {
    const router = useRouter()
    const { t } = useLanguage()
    const STATUS_LABELS: Record<string, string> = {
        active: t('admin.students.statusActive'),
        suspended: t('admin.students.statusSuspended'),
        inactive: t('admin.students.statusInactive'),
        archived: t('admin.students.statusArchived'),
    }
    const [teachers, setTeachers] = useState<Teacher[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [subjectFilter, setSubjectFilter] = useState('all')
    const [statusDialog, setStatusDialog] = useState<{ open: boolean; teacher: Teacher | null }>({ open: false, teacher: null })
    const [passwordDialog, setPasswordDialog] = useState<{ open: boolean; user: Teacher | null }>({ open: false, user: null })

    useEffect(() => {
        const fetchAll = async () => {
            const ctx = await getMySchoolContext()
            if (!ctx) { setLoading(false); return }
            const adminProfile = { school_id: ctx.school_id }
            const supabase = createClient()

            // ─── DISCOVERY 1: Teachers assigned explicitly to this school
            const { data: directProfiles } = await supabase
                .from('profiles')
                .select('id')
                .eq('role', 'teacher')
                .eq('school_id', adminProfile.school_id)

            // ─── DISCOVERY 2: Teachers holding active assignments within this school's classes
            const { data: assignedRows } = await supabase
                .from('teacher_assignments')
                .select('teacher_id, classes:classes!inner(school_id)')
                .eq('classes.school_id', adminProfile.school_id)

            // ─── DISCOVERY 3: Teachers linked explicitly to this school via profile_schools
            const schoolLinkIds = await getSchoolLinkedProfileIds(adminProfile.school_id, 'teacher')

            // Aggregated Union
            const directIds = (directProfiles || []).map(p => p.id)
            const assignedIds = (assignedRows || []).map((r: any) => r.teacher_id)
            const allTeacherIds = Array.from(new Set([...directIds, ...assignedIds, ...schoolLinkIds]))

            if (!allTeacherIds.length) { setLoading(false); return }

            // Hydrate complete profiles securely
            const profiles = await secureFetchProfiles(allTeacherIds, '*')
            if (!profiles || profiles.length === 0) { setLoading(false); return }
            const ids = profiles.map(p => p.id)

            // Batch fetch — strictly restricted to current school scope
            const [{ data: scheduleRows }, { data: assignRows }] = await Promise.all([
                supabase
                    .from('schedule')
                    .select('teacher_id, start_time, end_time, classes!inner(school_id)')
                    .in('teacher_id', ids)
                    .eq('classes.school_id', adminProfile.school_id),
                supabase
                    .from('teacher_assignments')
                    .select('teacher_id, subject_id, class_id, subjects(name), classes!inner(name, school_id)')
                    .in('teacher_id', ids)
                    .eq('classes.school_id', adminProfile.school_id),
            ])

            // Index by teacher
            const schedByTeacher = new Map<string, typeof scheduleRows>()
            ;(scheduleRows || []).forEach(s => {
                const list = schedByTeacher.get(s.teacher_id) ?? []
                list.push(s)
                schedByTeacher.set(s.teacher_id, list)
            })

            const assignByTeacher = new Map<string, any[]>()
            ;(assignRows || []).forEach(a => {
                const list = assignByTeacher.get(a.teacher_id) ?? []
                list.push(a)
                assignByTeacher.set(a.teacher_id, list)
            })

            const result: Teacher[] = profiles.map(p => {
                const slots = schedByTeacher.get(p.id) ?? []
                const assigns = assignByTeacher.get(p.id) ?? []

                const subjects = [...new Set(assigns.map(a => (a.subjects as any)?.name).filter(Boolean))] as string[]
                const classes  = [...new Set(assigns.map(a => (a.classes  as any)?.name).filter(Boolean))] as string[]

                const weeklyMinutes = slots.reduce((sum, s) => {
                    if (!s.start_time || !s.end_time) return sum
                    return sum + (parseMinutes(s.end_time) - parseMinutes(s.start_time))
                }, 0)

                return {
                    id: p.id,
                    name: p.full_name || 'Enseignant',
                    subjects,
                    classes,
                    weeklyHours: Math.round((weeklyMinutes / 60) * 10) / 10,
                    status: (p as any).status || 'active',
                    phone: p.phone,
                    email: p.email,
                    avatar: p.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.full_name}`,
                    hasAssignment: assigns.length > 0,
                    nationalId: (p as any).national_id || null,
                }
            })

            setTeachers(result)
            setLoading(false)
        }
        fetchAll()
    }, [])

    const allSubjects = useMemo(() => {
        const s = new Set<string>()
        teachers.forEach(tc => tc.subjects.forEach(sub => s.add(sub)))
        return Array.from(s).sort()
    }, [teachers])

    const filtered = useMemo(() => teachers.filter(tc => {
        if (searchTerm) {
            const term = searchTerm.toLowerCase()
            const matchesName = tc.name.toLowerCase().includes(term)
            const matchesNNI = tc.nationalId ? tc.nationalId.toLowerCase().includes(term) : false
            if (!matchesName && !matchesNNI) return false
        }
        if (statusFilter !== 'all' && tc.status !== statusFilter) return false
        if (subjectFilter !== 'all' && !tc.subjects.includes(subjectFilter)) return false
        return true
    }), [teachers, searchTerm, statusFilter, subjectFilter])

    const unassigned = teachers.filter(tc => !tc.hasAssignment)

    return (
        <div className="space-y-5 animate-in fade-in duration-500">

            <div className="flex justify-end">
                <Link href="/admin/teachers/new">
                    <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold">
                        <Plus className="w-3.5 h-3.5 mr-1.5" />{t('admin.teachers.addTeacher')}
                    </Button>
                </Link>
            </div>

            {/* No-assignment alert banner */}
            {!loading && unassigned.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3 flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-amber-400">
                            {unassigned.length > 1 ? t('admin.teachers.noAssignmentAlertPlural', { count: unassigned.length }) : t('admin.teachers.noAssignmentAlert', { count: unassigned.length })}
                        </p>
                        <p className="text-xs text-amber-400/70 mt-0.5 truncate">
                            {unassigned.map(tc => tc.name).join(', ')}
                        </p>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                    <Input
                        placeholder={t('admin.teachers.searchPlaceholder')}
                        className="pl-10 bg-[#161B22] border-white/5 text-gray-300 focus:border-emerald-500/50 h-10 rounded-xl placeholder:text-gray-600 text-sm"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Status pill filter */}
                    <div className="flex bg-[#161B22] border border-white/5 rounded-xl p-1 gap-0.5">
                        <button
                            onClick={() => setStatusFilter('all')}
                            className={cn("px-3 py-1.5 text-xs font-bold rounded-lg transition-all", statusFilter === 'all' ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300")}
                        >
                            {t('admin.teachers.filterAll')}
                        </button>
                        {Object.entries(STATUS_LABELS).map(([val, label]) => (
                            <button
                                key={val}
                                onClick={() => setStatusFilter(val)}
                                className={cn("px-3 py-1.5 text-xs font-bold rounded-lg transition-all", statusFilter === val ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300")}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {allSubjects.length > 0 && (
                        <select
                            value={subjectFilter}
                            onChange={e => setSubjectFilter(e.target.value)}
                            className="bg-[#161B22] border border-white/5 text-gray-300 text-xs rounded-xl px-3 h-10 focus:outline-none focus:border-emerald-500/50"
                        >
                            <option value="all">{t('admin.teachers.allSubjects')}</option>
                            {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    )}
                </div>
            </div>

            {/* Result count */}
            <p className="text-xs text-gray-500">
                <span className="font-bold text-emerald-500 uppercase tracking-widest">
                    {loading ? '…' : filtered.length !== 1 ? t('admin.teachers.teacherCountPlural', { count: filtered.length }) : t('admin.teachers.teacherCount', { count: filtered.length })}
                </span>
            </p>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map(teacher => (
                    <div
                        key={teacher.id}
                        className={cn(
                            "bg-[#1A2530] rounded-2xl border p-5 transition-all group relative cursor-pointer",
                            teacher.hasAssignment
                                ? "border-white/5 hover:border-emerald-500/30"
                                : "border-amber-500/20 hover:border-amber-500/40"
                        )}
                        onClick={() => router.push(`/admin/teachers/${teacher.id}`)}
                    >
                        {/* Top actions */}
                        <div className="absolute top-3 right-3 flex items-center gap-2">
                            {!teacher.hasAssignment && (
                                <span title={t('admin.teachers.noAssignment')} className="inline-flex">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                </span>
                            )}
                            <StatusDot status={teacher.status} />
                            {teacher.phone && (
                                <button
                                    className="text-gray-600 hover:text-emerald-400 transition-colors opacity-0 group-hover:opacity-100"
                                    onClick={e => { e.stopPropagation(); setPasswordDialog({ open: true, user: teacher }) }}
                                    title={t('admin.users.changePassword') || 'Modifier le mot de passe'}
                                >
                                    <KeyRound className="w-3.5 h-3.5" />
                                </button>
                            )}
                            <button
                                className="text-gray-600 hover:text-orange-400 transition-colors opacity-0 group-hover:opacity-100"
                                onClick={e => { e.stopPropagation(); setStatusDialog({ open: true, teacher }) }}
                                title={t('admin.teachers.profile.changeStatus')}
                            >
                                <ShieldAlert className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* Avatar + name */}
                        <div className="flex flex-col items-center text-center mb-4">
                            <div className="h-16 w-16 rounded-full border-2 border-[#0F1720] shadow-xl mb-3 overflow-hidden bg-gray-700">
                                <img
                                    src={teacher.avatar!}
                                    alt={teacher.name}
                                    className="h-full w-full object-cover"
                                />
                            </div>
                            <h3 className="text-white font-bold text-sm truncate w-full">{teacher.name}</h3>

                            {/* Subject pills — up to 3 */}
                            {teacher.subjects.length > 0 ? (
                                <div className="flex flex-wrap justify-center gap-1 mt-2">
                                    {teacher.subjects.slice(0, 3).map(s => (
                                        <span
                                            key={s}
                                            className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full px-2 py-0.5 font-medium"
                                        >
                                            {s}
                                        </span>
                                    ))}
                                    {teacher.subjects.length > 3 && (
                                        <span className="text-[10px] text-gray-500 self-center">+{teacher.subjects.length - 3}</span>
                                    )}
                                </div>
                            ) : (
                                <p className="text-[10px] text-amber-400/70 mt-1.5 font-medium">{t('admin.teachers.noSubjectAssigned')}</p>
                            )}
                        </div>

                        {/* Stats row */}
                        <div className="flex items-center justify-between pt-3 border-t border-white/5 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                                <BookOpen className="w-3 h-3" />
                                <span>{teacher.classes.length !== 1 ? t('admin.teachers.classCountPlural', { count: teacher.classes.length }) : t('admin.teachers.classCount', { count: teacher.classes.length })}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>{teacher.weeklyHours > 0 ? `${teacher.weeklyHours}h/sem` : '—'}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <ChangeStatusDialog
                open={statusDialog.open}
                onOpenChange={open => setStatusDialog(s => ({ ...s, open }))}
                userId={statusDialog.teacher?.id ?? ''}
                currentStatus={statusDialog.teacher?.status ?? 'active'}
                userName={statusDialog.teacher?.name ?? ''}
                onSuccess={newStatus => setTeachers(prev => prev.map(tc =>
                    tc.id === statusDialog.teacher?.id ? { ...tc, status: newStatus } : tc
                ))}
            />
            <ChangePasswordDialog
                open={passwordDialog.open}
                onOpenChange={open => setPasswordDialog(s => ({ ...s, open }))}
                userId={passwordDialog.user?.id ?? ''}
                userName={passwordDialog.user?.name ?? ''}
                userPhone={passwordDialog.user?.phone ?? null}
            />
        </div>
    )
}
