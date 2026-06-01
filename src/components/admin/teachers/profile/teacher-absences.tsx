'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { XCircle, Clock, CheckCircle2, RefreshCw, Loader2, CalendarDays, StickyNote, Plus, X, Check, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/i18n'
import { getMySchoolContext } from '@/app/admin/actions'
import { toast } from 'sonner'
import { updateTeacherAbsenceAction, deleteTeacherAbsenceAction } from '@/app/admin/teachers/actions'

interface AbsenceRecord {
    id: string
    date: string
    status: 'absent' | 'late'
    justified: boolean
    justification_note: string | null
    made_up: boolean
    made_up_date: string | null
    recorder: { full_name: string | null } | null
}

type FilterType = 'all' | 'unjustified' | 'justified' | 'late' | 'made_up'

export function TeacherAbsences({ teacherId }: { teacherId: string }) {
    const { t } = useLanguage()
    const [records, setRecords] = useState<AbsenceRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [tableExists, setTableExists] = useState(true)
    const [filter, setFilter] = useState<FilterType>('all')
    const [schoolId, setSchoolId] = useState<string | null>(null)

    // Add form state
    const [addFormOpen, setAddFormOpen] = useState(false)
    const [addDate, setAddDate] = useState(() => new Date().toISOString().split('T')[0])
    const [addStatus, setAddStatus] = useState<'absent' | 'late'>('absent')
    const [addJustified, setAddJustified] = useState(false)
    const [addNote, setAddNote] = useState('')
    const [adding, setAdding] = useState(false)

    // Justify inline state
    const [justifyId, setJustifyId] = useState<string | null>(null)
    const [justifyNote, setJustifyNote] = useState('')
    const [justifying, setJustifying] = useState(false)

    // Edit inline state
    const [editId, setEditId] = useState<string | null>(null)
    const [editDate, setEditDate] = useState('')
    const [editStatus, setEditStatus] = useState<'absent' | 'late'>('absent')
    const [editJustified, setEditJustified] = useState(false)
    const [editNote, setEditNote] = useState('')
    const [saving, setSaving] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    useEffect(() => {
        async function load() {
            const supabase = createClient()
            const ctx = await getMySchoolContext()
            const currentSchoolId = ctx?.school_id
            setSchoolId(currentSchoolId || null)

            const { data, error } = await supabase
                .from('teacher_attendance' as any)
                .select(`
                    id, date, status, justified, justification_note,
                    made_up, made_up_date,
                    recorder:profiles!teacher_attendance_recorded_by_fkey ( full_name )
                `)
                .eq('teacher_id', teacherId)
                .eq('school_id', currentSchoolId)
                .neq('status', 'present')
                .order('date', { ascending: false })

            if (error) {
                if (error.code === '42P01') setTableExists(false)
                setLoading(false)
                return
            }
            if (data) setRecords(data as unknown as AbsenceRecord[])
            setLoading(false)
        }
        load()
    }, [teacherId])

    const handleAddAbsence = async () => {
        if (!schoolId) return
        setAdding(true)
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()

            const { data, error } = await supabase
                .from('teacher_attendance' as any)
                .insert({
                    teacher_id: teacherId,
                    school_id: schoolId,
                    date: addDate,
                    status: addStatus,
                    justified: addJustified,
                    justification_note: addNote.trim() || null,
                    made_up: false,
                    recorded_by: user?.id || null,
                })
                .select(`
                    id, date, status, justified, justification_note,
                    made_up, made_up_date,
                    recorder:profiles!teacher_attendance_recorded_by_fkey ( full_name )
                `)
                .single()

            if (error) throw error

            setRecords(prev => [data as unknown as AbsenceRecord, ...prev].sort((a, b) => b.date.localeCompare(a.date)))
            setAddFormOpen(false)
            setAddDate(new Date().toISOString().split('T')[0])
            setAddStatus('absent')
            setAddJustified(false)
            setAddNote('')
            toast.success(t('admin.teachers.absences.addSuccess'))
        } catch (err: any) {
            console.error('[TeacherAbsences] add error:', err)
            toast.error(t('admin.teachers.absences.addError'))
        } finally {
            setAdding(false)
        }
    }

    const handleMarkJustified = async (id: string) => {
        setJustifying(true)
        try {
            const supabase = createClient()
            const { error } = await supabase
                .from('teacher_attendance' as any)
                .update({ justified: true, justification_note: justifyNote.trim() || null })
                .eq('id', id)

            if (error) throw error

            setRecords(prev => prev.map(r => r.id === id
                ? { ...r, justified: true, justification_note: justifyNote.trim() || null }
                : r
            ))
            setJustifyId(null)
            setJustifyNote('')
            toast.success(t('admin.teachers.absences.justifySuccess'))
        } catch (err: any) {
            console.error('[TeacherAbsences] justify error:', err)
            toast.error(t('admin.teachers.absences.justifyError'))
        } finally {
            setJustifying(false)
        }
    }

    const startEdit = (r: AbsenceRecord) => {
        setEditId(r.id)
        setEditDate(r.date)
        setEditStatus(r.status)
        setEditJustified(r.justified)
        setEditNote(r.justification_note || '')
    }

    const handleEditSave = async () => {
        if (!editId) return
        setSaving(true)
        const result = await updateTeacherAbsenceAction(editId, {
            date: editDate, status: editStatus, justified: editJustified, justification_note: editNote.trim() || null
        })
        setSaving(false)
        if (result.error) { toast.error(result.error); return }
        setRecords(prev => prev.map(r => r.id === editId
            ? { ...r, date: editDate, status: editStatus, justified: editJustified, justification_note: editNote.trim() || null }
            : r
        ).sort((a, b) => b.date.localeCompare(a.date)))
        setEditId(null)
        toast.success('Absence modifiée')
    }

    const handleDeleteAbsence = async (id: string) => {
        if (!confirm('Supprimer cette absence ?')) return
        setDeletingId(id)
        const result = await deleteTeacherAbsenceAction(id)
        setDeletingId(null)
        if (result.error) { toast.error(result.error); return }
        setRecords(prev => prev.filter(r => r.id !== id))
        toast.success('Absence supprimée')
    }

    const stats = useMemo(() => {
        const unjustified = records.filter(r => r.status === 'absent' && !r.justified)
        const justified   = records.filter(r => r.status === 'absent' && r.justified)
        const late        = records.filter(r => r.status === 'late')
        const made_up     = records.filter(r => r.made_up)
        return {
            total: records.length,
            unjustified: unjustified.length,
            justified: justified.length,
            late: late.length,
            made_up: made_up.length,
        }
    }, [records])

    const filtered = useMemo(() => {
        if (filter === 'unjustified') return records.filter(r => r.status === 'absent' && !r.justified)
        if (filter === 'justified')   return records.filter(r => r.status === 'absent' && r.justified)
        if (filter === 'late')        return records.filter(r => r.status === 'late')
        if (filter === 'made_up')     return records.filter(r => r.made_up)
        return records
    }, [records, filter])

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
        </div>
    )

    if (!tableExists) return (
        <div className="text-center py-16 bg-[#1A2530] rounded-3xl border border-amber-500/20 p-8">
            <CalendarDays className="w-10 h-10 text-amber-500/40 mx-auto mb-3" />
            <p className="text-amber-400 font-bold">{t('admin.teachers.absences.tableError')}</p>
            <p className="text-gray-500 text-sm mt-2 max-w-xs mx-auto">
                {t('admin.teachers.absences.tableErrorDesc')}
            </p>
        </div>
    )

    return (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header with Add button */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-white">{t('admin.teachers.absences.title')}</h3>
                </div>
                <button
                    type="button"
                    onClick={() => { setAddFormOpen(v => !v); setJustifyId(null) }}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                        addFormOpen
                            ? "bg-white/5 border-white/10 text-gray-400 hover:text-red-400"
                            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                    )}
                >
                    {addFormOpen ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    {addFormOpen ? t('common.cancel') : t('admin.teachers.absences.addAbsence')}
                </button>
            </div>

            {/* Add Absence Form */}
            {addFormOpen && (
                <div className="bg-[#1A2530] rounded-2xl border border-emerald-500/20 p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <h4 className="text-sm font-bold text-white">{t('admin.teachers.absences.addAbsenceTitle')}</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] text-gray-500 uppercase font-bold">{t('admin.teachers.absences.formDate')}</label>
                            <input
                                type="date"
                                value={addDate}
                                onChange={e => setAddDate(e.target.value)}
                                className="w-full bg-[#0D1117] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] text-gray-500 uppercase font-bold">{t('admin.teachers.absences.formStatus')}</label>
                            <select
                                value={addStatus}
                                onChange={e => setAddStatus(e.target.value as 'absent' | 'late')}
                                title={t('admin.teachers.absences.formStatus')}
                                className="w-full bg-[#0D1117] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                            >
                                <option value="absent">{t('admin.teachers.absences.absent')}</option>
                                <option value="late">{t('admin.teachers.absences.late')}</option>
                            </select>
                        </div>
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer group">
                        <div
                            onClick={() => setAddJustified(v => !v)}
                            className={cn(
                                "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0",
                                addJustified ? "bg-emerald-500 border-emerald-500" : "border-white/20 bg-white/5 group-hover:border-emerald-500/50"
                            )}
                        >
                            {addJustified && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
                        </div>
                        <span className="text-sm text-gray-300">{t('admin.teachers.absences.formJustified')}</span>
                    </label>

                    <div className="space-y-1.5">
                        <label className="text-[10px] text-gray-500 uppercase font-bold">{t('admin.teachers.absences.formNote')}</label>
                        <textarea
                            value={addNote}
                            onChange={e => setAddNote(e.target.value)}
                            placeholder={t('admin.teachers.absences.formNotePlaceholder')}
                            rows={2}
                            className="w-full bg-[#0D1117] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 resize-none"
                        />
                    </div>

                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setAddFormOpen(false)}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white border border-white/10 hover:bg-white/5 transition-all"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="button"
                            onClick={handleAddAbsence}
                            disabled={adding || !addDate}
                            className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-black transition-all disabled:opacity-50"
                        >
                            {adding && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            {adding ? t('admin.teachers.absences.adding') : t('common.save')}
                        </button>
                    </div>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
                <div className="bg-[#1A2530] rounded-2xl border border-red-500/20 p-4 text-center">
                    <XCircle className="w-4 h-4 text-red-400 mx-auto mb-1.5" />
                    <p className="text-2xl font-black text-red-400">{stats.unjustified}</p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">{t('admin.teachers.absences.unjustified')}</p>
                </div>
                <div className="bg-[#1A2530] rounded-2xl border border-amber-500/20 p-4 text-center">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 mx-auto mb-1.5" />
                    <p className="text-2xl font-black text-amber-400">{stats.justified}</p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">{t('admin.teachers.absences.justified')}</p>
                </div>
                <div className="bg-[#1A2530] rounded-2xl border border-blue-500/20 p-4 text-center">
                    <Clock className="w-4 h-4 text-blue-400 mx-auto mb-1.5" />
                    <p className="text-2xl font-black text-blue-400">{stats.late}</p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">{t('admin.teachers.absences.lates')}</p>
                </div>
                <div className="bg-[#1A2530] rounded-2xl border border-emerald-500/20 p-4 text-center">
                    <RefreshCw className="w-4 h-4 text-emerald-400 mx-auto mb-1.5" />
                    <p className="text-2xl font-black text-emerald-400">{stats.made_up}</p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">{t('admin.teachers.absences.madeUp')}</p>
                </div>
            </div>

            {/* Total */}
            <div className="bg-[#1A2530] rounded-2xl border border-white/5 px-5 py-3 flex justify-between items-center">
                <p className="text-sm text-gray-400">{t('admin.teachers.absences.totalLabel')}</p>
                <p className="text-lg font-black text-white">
                    {t('admin.teachers.absences.eventCount').replace('{count}', stats.total.toString()).replace('{plural}', stats.total !== 1 ? 's' : '')}
                </p>
            </div>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
                {([
                    { key: 'all',         label: t('admin.teachers.absences.all'),          count: stats.total },
                    { key: 'unjustified', label: t('admin.teachers.absences.unjustified'),  count: stats.unjustified },
                    { key: 'justified',   label: t('admin.teachers.absences.justified'),    count: stats.justified },
                    { key: 'late',        label: t('admin.teachers.absences.lates'),        count: stats.late },
                    { key: 'made_up',     label: t('admin.teachers.absences.madeUp'),       count: stats.made_up },
                ] as { key: FilterType; label: string; count: number }[]).map(f => (
                    <button
                        key={f.key}
                        type="button"
                        onClick={() => setFilter(f.key)}
                        className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                            filter === f.key
                                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                                : "bg-white/5 border-white/10 text-gray-500 hover:text-gray-300"
                        )}
                    >
                        {f.label} <span className="opacity-60">({f.count})</span>
                    </button>
                ))}
            </div>

            {/* Timeline */}
            {records.length === 0 ? (
                <div className="text-center py-16 bg-[#1A2530] rounded-3xl border border-white/5">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500/30 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">{t('admin.teachers.absences.noAbsences')}</p>
                    <p className="text-xs text-gray-600 mt-1">{t('admin.teachers.absences.perfectAttendance')}</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-12 bg-[#1A2530] rounded-3xl border border-white/5">
                    <p className="text-gray-500 text-sm">{t('admin.teachers.absences.noFilterResults')}</p>
                </div>
            ) : (
                <div className="bg-[#1A2530] rounded-3xl border border-white/5 overflow-hidden">
                    <div className="divide-y divide-white/5">
                        {filtered.map(r => {
                            const isLate = r.status === 'late'
                            const isJustified = r.status === 'absent' && r.justified
                            const isUnjustified = r.status === 'absent' && !r.justified
                            const cfg = isLate
                                ? { icon: Clock,        color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',     label: t('admin.teachers.absences.lateSingle') }
                                : isJustified
                                ? { icon: CheckCircle2, color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20',   label: t('admin.teachers.absences.justifiedSingle') }
                                : { icon: XCircle,      color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20',       label: t('admin.teachers.absences.unjustifiedSingle') }
                            const Icon = cfg.icon

                            const isJustifying = justifyId === r.id

                            return (
                                <div key={r.id} className="p-4 hover:bg-[#0F1720] transition-colors">
                                    <div className="flex items-start gap-4">
                                        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border mt-0.5", cfg.bg)}>
                                            <Icon className={cn("w-4 h-4", cfg.color)} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className={cn("text-sm font-bold", cfg.color)}>{cfg.label}</p>
                                                    {r.made_up && (
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                                            <RefreshCw className="w-2.5 h-2.5" /> {t('admin.teachers.absences.madeUpLabel')}
                                                            {r.made_up_date && ` ${t('admin.teachers.absences.madeUpOn')} ${new Date(r.made_up_date).toLocaleDateString(t('common.locale') || 'fr-FR', { day: '2-digit', month: 'short' })}`}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                                                    {isUnjustified && !isJustifying && editId !== r.id && (
                                                        <button
                                                            type="button"
                                                            onClick={() => { setJustifyId(r.id); setJustifyNote(''); setAddFormOpen(false) }}
                                                            className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-all"
                                                        >
                                                            {t('admin.teachers.absences.markAsJustified')}
                                                        </button>
                                                    )}
                                                    {editId !== r.id && (
                                                        <button type="button" onClick={() => { startEdit(r); setJustifyId(null) }}
                                                            className="p-1 text-gray-500 hover:text-blue-400 transition-colors rounded-md hover:bg-white/5">
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    <button type="button" onClick={() => handleDeleteAbsence(r.id)}
                                                        disabled={deletingId === r.id}
                                                        className="p-1 text-gray-500 hover:text-red-400 transition-colors rounded-md hover:bg-white/5">
                                                        {deletingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                                    </button>
                                                    <p className="text-xs text-gray-600">
                                                        {new Date(r.date).toLocaleDateString(t('common.locale') || 'fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </p>
                                                </div>
                                            </div>
                                            {r.recorder?.full_name && (
                                                <p className="text-xs text-gray-600 mt-0.5">{t('admin.teachers.absences.recordedBy')} {r.recorder.full_name}</p>
                                            )}
                                            {r.justification_note && (
                                                <div className="mt-2 flex items-start gap-1.5 bg-white/5 rounded-lg px-3 py-2">
                                                    <StickyNote className="w-3 h-3 text-gray-500 shrink-0 mt-0.5" />
                                                    <p className="text-xs text-gray-400 italic">{r.justification_note}</p>
                                                </div>
                                            )}

                                            {/* Inline edit form */}
                                            {editId === r.id && (
                                                <div className="mt-3 bg-[#0D1117] rounded-xl border border-blue-500/20 p-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
                                                    <p className="text-xs font-bold text-blue-400">Modifier l'absence</p>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] text-gray-500 uppercase font-bold">Date</label>
                                                            <input type="date" title="Date de l'absence" value={editDate} onChange={e => setEditDate(e.target.value)}
                                                                className="w-full bg-[#1A2530] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] text-gray-500 uppercase font-bold">Type</label>
                                                            <select title="Type d'absence" value={editStatus} onChange={e => setEditStatus(e.target.value as any)}
                                                                className="w-full bg-[#1A2530] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none">
                                                                <option value="absent">Absent</option>
                                                                <option value="late">Retard</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <div onClick={() => setEditJustified(v => !v)}
                                                            className={cn("w-4 h-4 rounded border-2 flex items-center justify-center transition-all",
                                                                editJustified ? "bg-emerald-500 border-emerald-500" : "border-white/20")}>
                                                            {editJustified && <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />}
                                                        </div>
                                                        <span className="text-xs text-gray-300">Justifiée</span>
                                                    </label>
                                                    <textarea value={editNote} onChange={e => setEditNote(e.target.value)}
                                                        placeholder="Note de justification" rows={2}
                                                        className="w-full bg-[#1A2530] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none resize-none" />
                                                    <div className="flex gap-2 justify-end">
                                                        <button type="button" onClick={() => setEditId(null)}
                                                            className="px-3 py-1.5 text-xs font-bold text-gray-400 hover:text-white border border-white/10 rounded-lg">{t('common.cancel')}</button>
                                                        <button type="button" onClick={handleEditSave} disabled={saving || !editDate}
                                                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50">
                                                            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                                            Enregistrer
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Inline justify form */}
                                            {isJustifying && (
                                                <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
                                                    <textarea
                                                        autoFocus
                                                        value={justifyNote}
                                                        onChange={e => setJustifyNote(e.target.value)}
                                                        placeholder={t('admin.teachers.absences.justifyNotePlaceholder')}
                                                        rows={2}
                                                        className="w-full bg-[#0D1117] border border-amber-500/20 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 resize-none"
                                                    />
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setJustifyId(null)}
                                                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-gray-500 hover:text-white border border-white/10 hover:bg-white/5 transition-all"
                                                        >
                                                            {t('common.cancel')}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleMarkJustified(r.id)}
                                                            disabled={justifying}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30 transition-all disabled:opacity-50"
                                                        >
                                                            {justifying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                                            {justifying ? t('admin.teachers.absences.justifying') : t('admin.teachers.absences.confirmJustify')}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
