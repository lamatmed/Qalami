'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, Clock, Trophy, Minus, Loader2, ChevronDown, ChevronUp, Layers, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { getStaffAdjustmentsAction, addStaffAdjustmentAction, deleteStaffAdjustmentAction, updateStaffAdjustmentAction } from '@/app/admin/teachers/actions'
import { cn } from '@/lib/utils'

interface Adjustment {
    id: string
    type: 'heures_sup' | 'prime' | 'deduction' | 'autre'
    description: string | null
    hours: number | null
    hourly_rate: number | null
    amount: number
    date: string
    is_included: boolean
    created_at: string
}

const TYPE_CONFIG = {
    heures_sup: { label: 'Heures supp.',   icon: Clock,   color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    prime:      { label: 'Prime',          icon: Trophy,  color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20'   },
    deduction:  { label: 'Déduction',      icon: Minus,   color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20'     },
    autre:      { label: 'Autre',          icon: Layers,  color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20'    },
}

export function StaffAdjustments({ profileId }: { profileId: string }) {
    const [adjustments, setAdjustments] = useState<Adjustment[]>([])
    const [loading, setLoading]         = useState(true)
    const [showForm, setShowForm]       = useState(false)
    const [showHistory, setShowHistory] = useState(false)
    const [submitting, setSubmitting]   = useState(false)
    const [deletingId, setDeletingId]   = useState<string | null>(null)
    const [editingId, setEditingId]     = useState<string | null>(null)

    const [type, setType]               = useState<keyof typeof TYPE_CONFIG>('heures_sup')
    const [description, setDescription] = useState('')
    const [hours, setHours]             = useState('')
    const [rate, setRate]               = useState('400')
    const [amount, setAmount]           = useState('')
    const [date, setDate]               = useState(new Date().toISOString().split('T')[0])

    const load = useCallback(async () => {
        setLoading(true)
        const { data } = await getStaffAdjustmentsAction(profileId)
        setAdjustments((data as Adjustment[]) || [])
        setLoading(false)
    }, [profileId])

    useEffect(() => { load() }, [load])

    // Auto-calculate amount for heures_sup
    useEffect(() => {
        if (type === 'heures_sup') {
            const h = parseFloat(hours) || 0
            const r = parseFloat(rate) || 0
            setAmount(String(Math.round(h * r)))
        }
    }, [type, hours, rate])

    const resetForm = () => {
        setEditingId(null)
        setType('heures_sup')
        setDescription('')
        setHours('')
        setRate('400')
        setAmount('')
        setDate(new Date().toISOString().split('T')[0])
    }

    const handleStartEdit = (adj: Adjustment) => {
        setEditingId(adj.id)
        setType(adj.type)
        setDescription(adj.description || '')
        setDate(adj.date)
        if (adj.type === 'heures_sup') {
            setHours(String(adj.hours || ''))
            setRate(String(adj.hourly_rate || 400))
            setAmount(String(adj.amount))
        } else {
            setAmount(String(adj.amount))
        }
        setShowForm(true)
    }

    const handleAdd = async () => {
        const amt = parseFloat(amount)
        if (!amt || amt <= 0) { toast.error('Montant invalide'); return }
        if (!date)            { toast.error('Date requise'); return }
        setSubmitting(true)
        let error: string | null = null
        if (editingId) {
            const res = await updateStaffAdjustmentAction(editingId, {
                type,
                description,
                hours:      type === 'heures_sup' ? (parseFloat(hours) || null) : null,
                hourlyRate: type === 'heures_sup' ? (parseFloat(rate)  || null) : null,
                amount: amt,
                date,
            })
            error = res.error ?? null
        } else {
            const res = await addStaffAdjustmentAction({
                profileId,
                type,
                description,
                hours:      type === 'heures_sup' ? (parseFloat(hours) || undefined) : undefined,
                hourlyRate: type === 'heures_sup' ? (parseFloat(rate)  || undefined) : undefined,
                amount: amt,
                date,
            })
            error = res.error ?? null
        }
        setSubmitting(false)
        if (error) { toast.error('Erreur: ' + error); return }
        toast.success(editingId ? 'Saisie modifiée' : 'Saisie enregistrée')
        setShowForm(false)
        resetForm()
        load()
    }

    const handleDelete = async (id: string) => {
        setDeletingId(id)
        const { error } = await deleteStaffAdjustmentAction(id)
        setDeletingId(null)
        if (error) { toast.error('Erreur: ' + error); return }
        load()
    }

    const pending  = adjustments.filter(a => !a.is_included)
    const included = adjustments.filter(a =>  a.is_included)

    const pendingTotal = pending.reduce((sum, a) =>
        sum + (a.type === 'deduction' ? -Number(a.amount) : Number(a.amount)), 0)

    if (loading) return (
        <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
        </div>
    )

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="font-bold text-white text-sm">Journal — Heures & Primes</h4>
                    <p className="text-xs text-gray-500 mt-0.5">Saisies en attente d&apos;inclusion dans la paie</p>
                </div>
                {!showForm && (
                    <Button
                        size="sm"
                        onClick={() => setShowForm(true)}
                        className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 h-8 px-3 rounded-xl text-xs font-bold gap-1.5"
                    >
                        <Plus className="w-3.5 h-3.5" /> Ajouter
                    </Button>
                )}
            </div>

            {/* Add / Edit Form */}
            {showForm && (
                <div className="bg-[#0F1720] rounded-2xl border border-white/10 p-4 space-y-4">
                    <p className="text-xs font-bold text-gray-400 uppercase">
                        {editingId ? 'Modifier la saisie' : 'Nouvelle saisie'}
                    </p>
                    {/* Type selector */}
                    <div className="grid grid-cols-4 gap-2">
                        {(Object.keys(TYPE_CONFIG) as (keyof typeof TYPE_CONFIG)[]).map(k => {
                            const cfg = TYPE_CONFIG[k]
                            const Icon = cfg.icon
                            return (
                                <button
                                    key={k}
                                    onClick={() => { setType(k); if (k !== 'heures_sup') setAmount('') }}
                                    className={cn(
                                        'flex flex-col items-center gap-1 p-2 rounded-xl border transition-all text-xs font-bold',
                                        type === k
                                            ? `${cfg.bg} ${cfg.border} ${cfg.color}`
                                            : 'bg-transparent border-white/5 text-gray-500 hover:border-white/20'
                                    )}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span>{cfg.label}</span>
                                </button>
                            )
                        })}
                    </div>

                    {type === 'heures_sup' ? (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Heures</label>
                                    <Input
                                        type="number" min="0" step="0.5"
                                        placeholder="ex: 8"
                                        className="bg-[#1A2530] border-white/10 text-white h-10 rounded-xl"
                                        value={hours}
                                        onChange={e => setHours(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Taux (MRU/h)</label>
                                    <Input
                                        type="number" min="0"
                                        className="bg-[#1A2530] border-white/10 text-white h-10 rounded-xl"
                                        value={rate}
                                        onChange={e => setRate(e.target.value)}
                                    />
                                </div>
                            </div>
                            {parseFloat(hours) > 0 && (
                                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-3 py-2 text-xs text-emerald-400 font-bold">
                                    = {(parseFloat(hours) || 0) * (parseFloat(rate) || 0)} MRU
                                </div>
                            )}
                        </div>
                    ) : (
                        <div>
                            <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">
                                {type === 'deduction' ? 'Montant à déduire (MRU)' : 'Montant (MRU)'}
                            </label>
                            <Input
                                type="number" min="0"
                                placeholder="ex: 5000"
                                className="bg-[#1A2530] border-white/10 text-white h-10 rounded-xl"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Date</label>
                            <Input
                                type="date"
                                className="bg-[#1A2530] border-white/10 text-white h-10 rounded-xl"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Note (optionnel)</label>
                            <Input
                                placeholder="Motif, détail..."
                                className="bg-[#1A2530] border-white/10 text-white h-10 rounded-xl"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                        <Button
                            variant="ghost" size="sm"
                            onClick={() => { setShowForm(false); resetForm() }}
                            className="text-gray-400 hover:text-white h-9 px-3 rounded-xl text-xs"
                        >
                            Annuler
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleAdd}
                            disabled={submitting}
                            className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold h-9 rounded-xl text-xs"
                        >
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer'}
                        </Button>
                    </div>
                </div>
            )}

            {/* Pending list */}
            {pending.length === 0 && !showForm ? (
                <div className="bg-[#1A2530] rounded-2xl border border-white/5 p-6 text-center">
                    <p className="text-gray-600 text-sm">Aucune saisie en attente</p>
                    <p className="text-gray-700 text-xs mt-1">Les saisies seront incluses lors du prochain paiement</p>
                </div>
            ) : pending.length > 0 && (
                <div className="bg-[#1A2530] rounded-2xl border border-white/5 overflow-hidden">
                    <div className="divide-y divide-white/5">
                        {pending.map(adj => {
                            const cfg = TYPE_CONFIG[adj.type]
                            const Icon = cfg.icon
                            const dateStr = new Date(adj.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
                            return (
                                <div key={adj.id} className="flex items-center gap-3 p-3 hover:bg-[#0F1720] transition-colors">
                                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', cfg.bg)}>
                                        <Icon className={cn('w-4 h-4', cfg.color)} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-white">{cfg.label}</p>
                                        <p className="text-xs text-gray-500 truncate">
                                            {dateStr}
                                            {adj.description && ` • ${adj.description}`}
                                            {adj.hours && ` • ${adj.hours}h × ${adj.hourly_rate} MRU/h`}
                                        </p>
                                    </div>
                                    <p className={cn('text-sm font-bold shrink-0', adj.type === 'deduction' ? 'text-red-400' : cfg.color)}>
                                        {adj.type === 'deduction' ? '−' : '+'}{Number(adj.amount).toLocaleString('fr-FR')} MRU
                                    </p>
                                    <button
                                        onClick={() => handleStartEdit(adj)}
                                        disabled={!!deletingId || showForm}
                                        className="p-1.5 rounded-lg text-gray-600 hover:text-blue-400 hover:bg-blue-500/10 transition-colors shrink-0 disabled:opacity-30"
                                        title="Modifier"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(adj.id)}
                                        disabled={!!deletingId || showForm}
                                        className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 disabled:opacity-30"
                                        title="Supprimer"
                                    >
                                        {deletingId === adj.id
                                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            : <Trash2 className="w-3.5 h-3.5" />}
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                    {/* Total */}
                    <div className="flex justify-between items-center px-4 py-3 bg-[#0F1720] border-t border-white/10">
                        <span className="text-xs text-gray-500 font-bold uppercase">Total en attente</span>
                        <span className={cn('font-black text-base', pendingTotal >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                            {pendingTotal >= 0 ? '+' : ''}{pendingTotal.toLocaleString('fr-FR')} MRU
                        </span>
                    </div>
                </div>
            )}

            {/* Included history */}
            {included.length > 0 && (
                <div>
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-400 transition-colors"
                    >
                        {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        Historique inclus dans la paie ({included.length})
                    </button>
                    {showHistory && (
                        <div className="mt-2 bg-[#1A2530]/50 rounded-2xl border border-white/5 overflow-hidden">
                            <div className="divide-y divide-white/5">
                                {included.slice(0, 30).map(adj => {
                                    const cfg = TYPE_CONFIG[adj.type]
                                    const Icon = cfg.icon
                                    const dateStr = new Date(adj.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                                    return (
                                        <div key={adj.id} className="flex items-center gap-3 p-3 opacity-50">
                                            <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', cfg.bg)}>
                                                <Icon className={cn('w-3.5 h-3.5', cfg.color)} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium text-gray-300">{cfg.label}</p>
                                                <p className="text-[10px] text-gray-600 truncate">
                                                    {dateStr}{adj.description && ` • ${adj.description}`}
                                                </p>
                                            </div>
                                            <p className={cn('text-xs font-bold shrink-0', adj.type === 'deduction' ? 'text-red-400/60' : 'text-gray-500')}>
                                                {adj.type === 'deduction' ? '−' : '+'}{Number(adj.amount).toLocaleString('fr-FR')} MRU
                                            </p>
                                            <span className="text-[9px] bg-emerald-500/5 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-500/10 font-bold shrink-0">
                                                INCLUS
                                            </span>
                                        </div>
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
