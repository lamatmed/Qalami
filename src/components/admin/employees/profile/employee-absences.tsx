'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Check, Loader2, StickyNote, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
    addStaffAbsenceAction,
    getStaffAbsencesAction,
    deleteStaffAbsenceAction,
} from '@/app/admin/settings/actions'

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
            toast.success('Absence enregistrée')
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

    return (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-[#1A2530] rounded-3xl border border-white/5 p-5">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="font-bold text-white">
                            Absences — {now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {absences.length} absence{absences.length !== 1 ? 's' : ''} ce mois
                        </p>
                    </div>
                    {deduction > 0 && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-2 text-center">
                            <p className="text-[10px] text-gray-500 uppercase font-bold mb-0.5">Déduction</p>
                            <p className="text-base font-black text-red-400">
                                −{Math.round(deduction).toLocaleString('fr-FR')} MRU
                            </p>
                        </div>
                    )}
                </div>

                {!showForm ? (
                    <button type="button" onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 w-full justify-center px-4 py-2.5 rounded-xl text-xs font-bold bg-pink-500/10 border border-pink-500/20 text-pink-400 hover:bg-pink-500/20 transition-all">
                        <Plus className="w-3.5 h-3.5" /> Ajouter une absence
                    </button>
                ) : (
                    <div className="bg-[#0F1720] rounded-2xl border border-pink-500/20 p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Date</label>
                                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                                    className="w-full bg-[#1A2530] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none" />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Note</label>
                                <input type="text" placeholder="Optionnel" value={note} onChange={e => setNote(e.target.value)}
                                    className="w-full bg-[#1A2530] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none" />
                            </div>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <div onClick={() => setJustified(v => !v)}
                                className={cn("w-4 h-4 rounded border-2 flex items-center justify-center transition-all shrink-0 cursor-pointer",
                                    justified ? "bg-emerald-500 border-emerald-500" : "border-white/20"
                                )}>
                                {justified && <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />}
                            </div>
                            <span className="text-xs text-gray-400">Justifiée (pas déduite du salaire)</span>
                        </label>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setShowForm(false)}
                                className="px-3 py-2 rounded-lg text-xs font-bold text-gray-400 hover:text-white border border-white/10 hover:bg-white/5 transition-all">
                                Annuler
                            </button>
                            <button type="button" onClick={handleAdd} disabled={adding || !date}
                                className="flex items-center gap-2 flex-1 justify-center px-4 py-2 rounded-lg text-xs font-bold bg-pink-600 hover:bg-pink-500 text-white disabled:opacity-50 transition-all">
                                {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                Enregistrer
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-pink-500" />
                </div>
            ) : absences.length === 0 ? (
                <div className="bg-[#1A2530] rounded-3xl border border-white/5 p-10 text-center">
                    <p className="text-gray-600">Aucune absence ce mois-ci</p>
                </div>
            ) : (
                <div className="bg-[#1A2530] rounded-3xl border border-white/5 overflow-hidden">
                    <div className="divide-y divide-white/5">
                        {absences.map(ab => (
                            <div key={ab.id} className="flex items-center gap-3 p-4 hover:bg-[#0F1720] transition-colors">
                                <span className={cn("w-2 h-2 rounded-full shrink-0", ab.justified ? "bg-amber-400" : "bg-red-500")} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white">
                                        {new Date(ab.date + 'T12:00:00').toLocaleDateString('fr-FR', {
                                            weekday: 'long', day: '2-digit', month: 'long',
                                        })}
                                    </p>
                                    {ab.justification_note && (
                                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                            <StickyNote className="w-3 h-3" />
                                            {ab.justification_note}
                                        </p>
                                    )}
                                </div>
                                <span className={cn("text-xs font-bold px-2.5 py-1 rounded-full border",
                                    ab.justified
                                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                        : "bg-red-500/10 text-red-400 border-red-500/20"
                                )}>
                                    {ab.justified ? 'Justifiée' : dailySalary > 0 ? `−${Math.round(dailySalary).toLocaleString('fr-FR')} MRU` : 'Non justifiée'}
                                </span>
                                <button type="button" onClick={() => handleDelete(ab.id)} disabled={!!deletingId}
                                    className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50">
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
