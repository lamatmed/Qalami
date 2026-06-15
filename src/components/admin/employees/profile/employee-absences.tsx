'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Check, Loader2, StickyNote, Trash2, CalendarX } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
    addStaffAbsenceAction,
    getStaffAbsencesAction,
    deleteStaffAbsenceAction,
} from '@/app/admin/settings/actions'
import { useLanguage } from '@/i18n'

interface Absence {
    id: string
    date: string
    justified: boolean
    justification_note: string | null
}

interface Props {
    employeeId: string
    salary: number
}

export function EmployeeAbsences({ employeeId, salary }: Props) {
    const { t } = useLanguage()
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    const [absences, setAbsences] = useState<Absence[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [adding, setAdding] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [date, setDate] = useState(now.toISOString().split('T')[0])
    const [justified, setJustified] = useState(false)
    const [note, setNote] = useState('')

    const load = useCallback(async () => {
        setLoading(true)
        const res = await getStaffAbsencesAction(employeeId, currentMonth, currentYear)
        if (!res.error) setAbsences(res.absences)
        setLoading(false)
    }, [employeeId, currentMonth, currentYear])

    useEffect(() => { load() }, [load])

    const handleAdd = async () => {
        if (!date) return
        setAdding(true)
        const res = await addStaffAbsenceAction({ staffId: employeeId, date, justified, note: note.trim() || null })
        if (res.error) { toast.error(res.error) }
        else {
            toast.success(t('admin.employees.absences.added'))
            setShowForm(false)
            setDate(now.toISOString().split('T')[0])
            setJustified(false)
            setNote('')
            await load()
        }
        setAdding(false)
    }

    const handleDelete = async (id: string) => {
        setDeletingId(id)
        const res = await deleteStaffAbsenceAction(id)
        if (res.error) toast.error(res.error)
        else await load()
        setDeletingId(null)
    }

    const unjustified = absences.filter(a => !a.justified)
    const dailySalary = salary > 0 ? salary / 30 : 0
    const deduction = unjustified.length * dailySalary
    const monthLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

    return (
        <div className="space-y-3">

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#161B22] rounded-2xl border border-white/5 p-4">
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">
                        {t('admin.employees.absences.title').replace('{month}', monthLabel)}
                    </p>
                    <p className="text-3xl font-bold text-white">{absences.length}</p>
                    <p className="text-xs mt-1.5">
                        {unjustified.length > 0
                            ? <span className="text-amber-400">{unjustified.length} non justifiée{unjustified.length > 1 ? 's' : ''}</span>
                            : absences.length > 0
                                ? <span className="text-emerald-400">Toutes justifiées</span>
                                : <span className="text-gray-700">Ce mois-ci</span>
                        }
                    </p>
                </div>

                <div className={cn(
                    "rounded-2xl border p-4",
                    deduction > 0
                        ? "bg-[#1C1410] border-amber-500/15"
                        : "bg-[#161B22] border-white/5"
                )}>
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">
                        {t('admin.employees.absences.deduction')}
                    </p>
                    {deduction > 0 ? (
                        <>
                            <p className="text-3xl font-bold text-amber-400">
                                -{Math.round(deduction).toLocaleString('fr-FR')}
                            </p>
                            <p className="text-xs text-amber-500/50 mt-1.5">MRU ce mois</p>
                        </>
                    ) : (
                        <>
                            <p className="text-3xl font-bold text-white/10">0</p>
                            <p className="text-xs text-gray-700 mt-1.5">Aucune déduction</p>
                        </>
                    )}
                </div>
            </div>

            {/* Add */}
            <div className="bg-[#161B22] rounded-2xl border border-white/5 overflow-hidden">
                {!showForm ? (
                    <button type="button" onClick={() => setShowForm(true)}
                        className="flex items-center gap-3 w-full px-4 py-3.5 text-sm text-gray-500 hover:text-white hover:bg-white/5 transition-all group">
                        <div className="w-6 h-6 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                            <Plus className="w-3.5 h-3.5" />
                        </div>
                        {t('admin.employees.absences.addAbsence')}
                    </button>
                ) : (
                    <div className="p-4 space-y-3.5">
                        <p className="text-xs text-gray-500">{t('admin.employees.absences.addAbsence')}</p>
                        <div className="grid grid-cols-2 gap-2.5">
                            <div>
                                <label className="text-[10px] text-gray-600 uppercase tracking-widest mb-1.5 block">
                                    {t('admin.employees.absences.date')}
                                </label>
                                <input
                                    type="date"
                                    title={t('admin.employees.absences.date')}
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                    className="w-full bg-[#0F1720] border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/15 transition-colors scheme-dark"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-600 uppercase tracking-widest mb-1.5 block">
                                    {t('admin.employees.absences.note')}
                                </label>
                                <input
                                    type="text"
                                    title={t('admin.employees.absences.note')}
                                    placeholder={t('admin.employees.absences.optional')}
                                    value={note}
                                    onChange={e => setNote(e.target.value)}
                                    className="w-full bg-[#0F1720] border border-white/5 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/15 transition-colors"
                                />
                            </div>
                        </div>

                        <label className="flex items-center gap-2.5 cursor-pointer">
                            <div
                                onClick={() => setJustified(v => !v)}
                                className={cn(
                                    "w-4 h-4 rounded border-2 flex items-center justify-center transition-all shrink-0 cursor-pointer",
                                    justified
                                        ? "bg-emerald-500 border-emerald-500"
                                        : "border-white/20"
                                )}
                            >
                                {justified && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                            </div>
                            <span className="text-sm text-gray-400">{t('admin.employees.absences.justifiedHint')}</span>
                        </label>

                        <div className="flex gap-2">
                            <button type="button" onClick={() => setShowForm(false)}
                                className="px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-white border border-white/5 hover:bg-white/5 transition-all">
                                {t('common.cancel')}
                            </button>
                            <button type="button" onClick={handleAdd} disabled={adding || !date}
                                className="flex items-center gap-1.5 flex-1 justify-center px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-all">
                                {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                {t('common.save')}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* List */}
            {loading ? (
                <div className="flex justify-center py-10">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                </div>
            ) : absences.length === 0 ? (
                <div className="flex flex-col items-center py-14 gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#161B22] border border-white/5 flex items-center justify-center">
                        <CalendarX className="w-5 h-5 text-white/15" />
                    </div>
                    <p className="text-gray-600 text-sm">{t('admin.employees.absences.noAbsence')}</p>
                </div>
            ) : (
                <div className="bg-[#161B22] rounded-2xl border border-white/5 overflow-hidden">
                    <div className="divide-y divide-white/5">
                        {absences.map(ab => (
                            <div key={ab.id}
                                className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-white/5 transition-colors group">
                                <div className={cn(
                                    "w-1 h-8 rounded-full shrink-0",
                                    ab.justified ? "bg-white/10" : "bg-amber-500"
                                )} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-white capitalize">
                                        {new Date(ab.date + 'T12:00:00').toLocaleDateString('fr-FR', {
                                            weekday: 'long', day: '2-digit', month: 'long',
                                        })}
                                    </p>
                                    {ab.justification_note && (
                                        <p className="text-xs text-gray-600 flex items-center gap-1 mt-0.5">
                                            <StickyNote className="w-3 h-3" />
                                            {ab.justification_note}
                                        </p>
                                    )}
                                </div>
                                <span className={cn(
                                    "text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0",
                                    ab.justified
                                        ? "text-gray-500 bg-white/5"
                                        : "text-amber-400 bg-amber-500/10"
                                )}>
                                    {ab.justified
                                        ? t('admin.employees.absences.justifiedLabel')
                                        : dailySalary > 0
                                            ? `-${Math.round(dailySalary).toLocaleString('fr-FR')} MRU`
                                            : t('admin.employees.absences.unjustifiedLabel')}
                                </span>
                                <button
                                    type="button"
                                    title={t('common.delete')}
                                    onClick={() => handleDelete(ab.id)}
                                    disabled={!!deletingId}
                                    className="p-1.5 text-white/10 hover:text-red-400 rounded-lg transition-all disabled:opacity-50 shrink-0 opacity-0 group-hover:opacity-100"
                                >
                                    {deletingId === ab.id
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        : <Trash2 className="w-3.5 h-3.5" />}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
