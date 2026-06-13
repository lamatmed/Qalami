'use client'

import React from 'react'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, ArrowUpRight, ArrowDownRight, Eye, Loader2, RefreshCw, Calendar, X, Download, MessageSquare, Check, Fingerprint } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/i18n'
import { toast } from 'sonner'
import { getTransactionsAction, updateTransactionNotesAction } from '@/app/admin/finance/actions'

interface Transaction {
    id: string
    type: string
    category: string | null
    description: string | null
    amount: number
    status: string
    transaction_date: string
    created_at: string
    related_profile_id?: string | null
    reference_number?: string | null
    notes?: string | null
}

type TypeFilter = '' | 'scolarite' | 'inscription' | 'transport' | 'restauration' | 'cotisation' | 'autres'
type FlowFilter = '' | 'income' | 'expense'

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
    { value: '',            label: 'Tout' },
    { value: 'scolarite',   label: 'Scolarité' },
    { value: 'inscription', label: 'Inscription' },
    { value: 'transport',   label: 'Transport' },
    { value: 'restauration',label: 'Restauration' },
    { value: 'cotisation',  label: 'Cotisation' },
    { value: 'autres',      label: 'Autres' },
]

const SCOLARITE_CATS  = ['scolarite', 'tuition']
const TRANSPORT_CATS  = ['transport', 'bus']
const RESTAURATION_CATS = ['restauration', 'cantine']
const INCOME_TYPES    = ['income', 'tuition']

function matchesTypeFilter(trx: Transaction, filter: TypeFilter): boolean {
    if (!filter) return true
    const cat = trx.category || ''
    if (filter === 'scolarite')    return SCOLARITE_CATS.includes(cat)
    if (filter === 'inscription')  return cat === 'inscription'
    if (filter === 'transport')    return TRANSPORT_CATS.includes(cat)
    if (filter === 'restauration') return RESTAURATION_CATS.includes(cat)
    if (filter === 'cotisation')   return cat === 'cotisation'
    if (filter === 'autres')       return ![...SCOLARITE_CATS, 'inscription', ...TRANSPORT_CATS, ...RESTAURATION_CATS, 'cotisation'].includes(cat)
    return true
}

export function TransactionLedger({ refreshTrigger }: { refreshTrigger?: number }) {
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [nniQuery, setNniQuery] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('')
    const [flowFilter, setFlowFilter] = useState<FlowFilter>('')
    const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null)
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
    const [noteText, setNoteText] = useState('')
    const [savingNote, setSavingNote] = useState(false)
    const nniDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

    const { t, language } = useLanguage()

    const fetchTransactions = useCallback(async (from: string, to: string, nni: string) => {
        setLoading(true)
        try {
            const result = await getTransactionsAction({
                dateFrom: from || undefined,
                dateTo: to || undefined,
                nni: nni.trim() || undefined,
            })
            if (result.error) { console.error(result.error); return }
            setTransactions(result.data)
        } finally {
            setLoading(false)
        }
    }, [])

    // Date / refresh triggers immediate fetch
    useEffect(() => {
        clearTimeout(nniDebounceRef.current)
        fetchTransactions(dateFrom, dateTo, nniQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateFrom, dateTo, refreshTrigger, fetchTransactions])

    // NNI field: debounced fetch
    const handleNniChange = (value: string) => {
        setNniQuery(value)
        clearTimeout(nniDebounceRef.current)
        nniDebounceRef.current = setTimeout(() => {
            fetchTransactions(dateFrom, dateTo, value)
        }, 500)
    }

    const getCategoryLabel = (cat: string | null) => {
        const labels: Record<string, string> = {
            transport: 'Transport', restauration: 'Restauration', cotisation: 'Cotisation',
            autre: 'Autres', tuition: t('admin.finance.tuition'), salary: t('admin.finance.salaries'),
            maintenance: t('admin.finance.maintenance'), supplies: t('admin.accounting.supplies'),
            other: t('admin.finance.others'), inscription: 'Inscription', scolarite: 'Scolarité',
            cantine: 'Cantine', bus: 'Transport', activites: 'Activités',
        }
        return labels[cat ?? ''] ?? cat ?? 'N/A'
    }

    const buildRef = (trx: Transaction) => {
        const d = new Date(trx.transaction_date)
        const m = d.getMonth() + 1
        const y = d.getFullYear()
        const cat = getCategoryLabel(trx.category)
        return trx.description ? `${cat} ${m}/${y} — ${trx.description}` : `${cat} ${m}/${y}`
    }

    const filteredTransactions = transactions.filter(trx => {
        const q = searchQuery.toLowerCase()
        const matchesSearch = !q ||
            (trx.description?.toLowerCase() ?? '').includes(q) ||
            (trx.category?.toLowerCase() ?? '').includes(q) ||
            (trx.reference_number?.toLowerCase() ?? '').includes(q) ||
            trx.id.slice(0, 8).toLowerCase().includes(q) ||
            buildRef(trx).toLowerCase().includes(q)

        const matchesType = matchesTypeFilter(trx, typeFilter)

        const isIncome = INCOME_TYPES.includes(trx.type)
        const matchesFlow = !flowFilter ||
            (flowFilter === 'income' && isIncome) ||
            (flowFilter === 'expense' && !isIncome)

        return matchesSearch && matchesType && matchesFlow
    })

    const hasAnyFilter = searchQuery || nniQuery || dateFrom || dateTo || typeFilter || flowFilter

    const formatDate = (dateStr: string) => {
        const locale = language === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR'
        return new Date(dateStr).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
    }

    const formatDateTime = (dateStr: string, timeStr?: string) => {
        const locale = language === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR'
        const datePart = new Date(dateStr).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
        if (!timeStr) return datePart
        const timePart = new Date(timeStr).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
        return `${datePart} · ${timePart}`
    }

    const startEditNote = (trx: Transaction) => {
        setEditingNoteId(trx.id)
        setNoteText(trx.notes || '')
    }

    const cancelEditNote = () => {
        setEditingNoteId(null)
        setNoteText('')
    }

    const saveNote = async (id: string) => {
        setSavingNote(true)
        const res = await updateTransactionNotesAction(id, noteText)
        if (res.error) {
            toast.error(res.error)
        } else {
            toast.success('Remarque enregistrée')
            setTransactions(prev => prev.map(t => t.id === id ? { ...t, notes: noteText.trim() || null } : t))
            setEditingNoteId(null)
        }
        setSavingNote(false)
    }

    const handleViewPdf = async (trx: Transaction) => {
        setGeneratingPdfId(trx.id)
        try {
            let person: { full_name: string | null, national_id: string | null, phone: string | null, role: string | null } | null = null
            if (trx.related_profile_id) {
                const { createClient } = await import('@/utils/supabase/client')
                const supabase = createClient()
                const { data } = await supabase
                    .from('profiles')
                    .select('full_name, national_id, phone, role')
                    .eq('id', trx.related_profile_id)
                    .maybeSingle()
                if (data) person = data
            }

            const { jsPDF } = await import('jspdf')
            const W = 80, ml = 6, mr = W - 6, cx = W / 2
            const fmt = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
            const isIncome = trx.type === 'income' || trx.type === 'tuition'
            const shortId = trx.id.slice(0, 8).toUpperCase()
            const printDate = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
            const txDate = formatDate(trx.transaction_date)
            const isPaid = trx.status === 'completed'
            const BK: [number,number,number] = [10, 10, 10]
            const GR: [number,number,number] = [150, 150, 150]

            let estimatedH = 210
            if (person) estimatedH += (person.national_id || person.phone) ? 40 : 28
            if (trx.notes) estimatedH += 20

            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [W, estimatedH] })

            const hline = (yPos: number, thick = 0.3) => { doc.setDrawColor(...BK); doc.setLineWidth(thick); doc.line(ml, yPos, mr, yPos) }
            const row = (label: string, value: string) => {
                doc.setFont('Helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GR); doc.text(label, ml, y)
                doc.setFont('Helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...BK); doc.text(value, mr, y, { align: 'right' }); y += 7
            }

            let y = 11
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...BK); doc.text('QALAMI', ml, y); y += 6
            doc.setFont('Helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GR); doc.text('School Manager  ·  Gestion Scolaire', ml, y); y += 7
            hline(y, 0.8); y += 5
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...GR); doc.text('RECU DE TRANSACTION', ml, y)
            doc.setFont('Helvetica', 'normal'); doc.setFontSize(8); doc.text(printDate, mr, y, { align: 'right' }); y += 5
            hline(y, 0.3); y += 7

            const refText = trx.description || getCategoryLabel(trx.category)
            const splitRef = doc.splitTextToSize(refText, mr - ml)
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...BK); doc.text(splitRef, ml, y); y += splitRef.length * 6.5 + 2
            doc.setFont('Helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GR); doc.text(`REF  ${shortId}`, ml, y); y += 9

            hline(y, 0.8); y += 6
            doc.setFont('Helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GR)
            doc.text(isIncome ? 'MONTANT RECU' : 'MONTANT REGLE', cx, y, { align: 'center' }); y += 10
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(28); doc.setTextColor(...BK); doc.text(fmt(trx.amount), cx, y, { align: 'center' }); y += 6
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(11); doc.text('MRU', cx, y, { align: 'center' }); y += 7
            hline(y, 0.8); y += 9

            row('Categorie', getCategoryLabel(trx.category))
            row('Date', txDate)
            row('Statut', isPaid ? 'COMPLETE' : 'EN ATTENTE')

            if (person) {
                y += 2; hline(y, 0.3); y += 6
                const roleLabel = person.role === 'teacher' ? 'Enseignant' : person.role === 'student' ? 'Eleve' : 'Personnel'
                doc.setFont('Helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GR)
                doc.text(`BENEFICIAIRE  ·  ${roleLabel.toUpperCase()}`, ml, y); y += 6
                doc.setFont('Helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...BK)
                doc.text(person.full_name || '—', ml, y); y += 8
                if (person.national_id) row('NNI', person.national_id)
                if (person.phone)       row('Tel', person.phone)
            }

            if (trx.notes) {
                y += 2; hline(y, 0.3); y += 6
                doc.setFont('Helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GR); doc.text('REMARQUE', ml, y); y += 5
                const splitNotes = doc.splitTextToSize(trx.notes, mr - ml)
                doc.setFont('Helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...BK); doc.text(splitNotes, ml, y); y += splitNotes.length * 5 + 3
            }

            y += 3; hline(y, 0.3); y += 6
            doc.setFont('Helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GR); doc.text(`Genere le ${printDate}`, ml, y)
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...BK); doc.text('Qalami School Manager', mr, y, { align: 'right' })

            doc.save(`recu-${shortId}.pdf`)
            toast.success('PDF téléchargé')
        } catch {
            toast.error('Erreur lors de la génération du PDF')
        } finally {
            setGeneratingPdfId(null)
        }
    }

    const clearAllFilters = () => {
        setSearchQuery(''); setNniQuery(''); setDateFrom(''); setDateTo('')
        setTypeFilter(''); setFlowFilter('')
        clearTimeout(nniDebounceRef.current)
        fetchTransactions('', '', '')
    }

    return (
        <div className="bg-[#161B22] border border-white/5 rounded-3xl overflow-hidden flex flex-col h-full">
            {/* ── Header / Controls ── */}
            <div className="p-6 border-b border-white/5 flex flex-col gap-4">

                {/* Row 1: title + search + actions */}
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        {t('admin.finance.transactionHistory')}
                        <Badge variant="outline" className="ml-2 bg-white/5 border-white/10 text-gray-400">
                            {filteredTransactions.length}
                        </Badge>
                    </h3>

                    <div className="flex gap-2 w-full sm:w-auto">
                        {/* Text search */}
                        <div className="relative flex-1 sm:w-56">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <Input
                                placeholder={t('admin.accounting.searchTransaction')}
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="bg-[#0D1117] border-white/10 pl-9 text-white placeholder:text-gray-600 focus-visible:ring-emerald-500/50"
                            />
                        </div>
                        {/* NNI search */}
                        <div className="relative w-36">
                            <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <Input
                                placeholder="NNI..."
                                value={nniQuery}
                                onChange={e => handleNniChange(e.target.value)}
                                className="bg-[#0D1117] border-white/10 pl-9 text-white placeholder:text-gray-600 focus-visible:ring-emerald-500/50 font-mono"
                            />
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => fetchTransactions(dateFrom, dateTo, nniQuery)}
                            className="border-white/10 bg-[#0D1117] text-gray-400 hover:text-white hover:bg-white/5"
                        >
                            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                        </Button>
                        <Button
                            variant="outline"
                            className="border-white/10 bg-[#0D1117] text-gray-400 hover:text-white hover:bg-white/5"
                            onClick={() => {
                                if (filteredTransactions.length === 0) { toast.info('Aucune transaction à exporter'); return }
                                let csv = `Description,Catégorie,Date,Statut,Montant (MRU),Type\n`
                                filteredTransactions.forEach(trx => {
                                    csv += `"${trx.description || 'Transaction'}",${getCategoryLabel(trx.category)},${formatDate(trx.transaction_date)},${trx.status},${trx.amount},${trx.type}\n`
                                })
                                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                                const url = URL.createObjectURL(blob)
                                const link = document.createElement('a')
                                link.href = url
                                link.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`
                                document.body.appendChild(link); link.click(); document.body.removeChild(link)
                                URL.revokeObjectURL(url)
                                toast.success(`${filteredTransactions.length} transactions exportées`)
                            }}
                        >
                            <Download className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* Row 2: Date range */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 text-gray-500">
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">{t('admin.accounting.filterByDate')}</span>
                    </div>
                    <input type="date" title="Date de début" placeholder="Date de début" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                        className="bg-[#0D1117] border border-white/10 text-white text-sm rounded-md h-8 px-3 focus:outline-none focus:border-emerald-500/50 scheme-dark cursor-pointer" />
                    <span className="text-gray-600 text-xs">{t('admin.accounting.dateTo')}</span>
                    <input type="date" title="Date de fin" placeholder="Date de fin" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)}
                        className="bg-[#0D1117] border border-white/10 text-white text-sm rounded-md h-8 px-3 focus:outline-none focus:border-emerald-500/50 scheme-dark cursor-pointer" />
                    {hasAnyFilter && (
                        <button type="button" onClick={clearAllFilters}
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-md px-2 h-8 transition-colors">
                            <X className="w-3 h-3" /> Réinitialiser
                        </button>
                    )}
                </div>

                {/* Row 3: Category chips + flow filter */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* Type chips */}
                    <div className="flex flex-wrap gap-1">
                        {TYPE_OPTIONS.map(opt => (
                            <button key={opt.value} type="button"
                                onClick={() => setTypeFilter(opt.value)}
                                className={cn(
                                    "px-3 py-1 rounded-full text-xs font-bold border transition-all",
                                    typeFilter === opt.value
                                        ? "bg-emerald-600 text-white border-emerald-600"
                                        : "bg-white/5 text-gray-400 border-white/10 hover:text-white hover:bg-white/10"
                                )}>
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* Separator */}
                    <div className="w-px h-5 bg-white/10 hidden sm:block" />

                    {/* Entrées / Sorties */}
                    <div className="flex gap-1">
                        {[
                            { value: '' as FlowFilter,       label: 'Tout',     icon: null },
                            { value: 'income' as FlowFilter,  label: 'Entrées',  icon: ArrowUpRight },
                            { value: 'expense' as FlowFilter, label: 'Sorties',  icon: ArrowDownRight },
                        ].map(opt => (
                            <button key={opt.value} type="button"
                                onClick={() => setFlowFilter(opt.value)}
                                className={cn(
                                    "flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border transition-all",
                                    flowFilter === opt.value
                                        ? opt.value === 'income'
                                            ? "bg-emerald-600 text-white border-emerald-600"
                                            : opt.value === 'expense'
                                            ? "bg-red-600 text-white border-red-600"
                                            : "bg-white/20 text-white border-white/20"
                                        : "bg-white/5 text-gray-400 border-white/10 hover:text-white hover:bg-white/10"
                                )}>
                                {opt.icon && <opt.icon className="w-3 h-3" />}
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── List ── */}
            <div className="flex-1 overflow-x-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
                    </div>
                ) : filteredTransactions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                        <p className="text-lg font-medium">{t('admin.finance.noTransactions')}</p>
                        <p className="text-sm">{t('admin.accounting.transactionsWillAppear')}</p>
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-[#0D1117] text-gray-500 uppercase font-bold text-xs tracking-wider">
                            <tr>
                                <th className="px-6 py-4">{t('admin.finance.transaction')}</th>
                                <th className="px-6 py-4">{t('admin.accounting.category')}</th>
                                <th className="px-6 py-4">{t('common.date')}</th>
                                <th className="px-6 py-4">{t('common.status')}</th>
                                <th className="px-6 py-4 text-right">{t('common.amount')}</th>
                                <th className="px-6 py-4"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredTransactions.map(trx => {
                                const isIncome = trx.type === 'income' || trx.type === 'tuition'
                                const hasNote = !!trx.notes
                                const isEditingNote = editingNoteId === trx.id

                                return (
                                    <React.Fragment key={trx.id}>
                                        <tr className="group hover:bg-white/5 transition-colors">
                                            {/* Transaction */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-start gap-3">
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-full flex items-center justify-center border shrink-0",
                                                        isIncome
                                                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                                                            : "bg-red-500/10 border-red-500/20 text-red-500"
                                                    )}>
                                                        {isIncome ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-white text-sm">{buildRef(trx)}</p>
                                                        <p className="text-[10px] text-gray-500 font-mono">{trx.id.slice(0, 8).toUpperCase()}</p>
                                                        {hasNote && !isEditingNote && (
                                                            <div className="flex items-start gap-1 mt-1">
                                                                <MessageSquare className="w-3 h-3 text-amber-500/70 shrink-0 mt-0.5" />
                                                                <p className="text-xs text-amber-500/70 italic leading-tight">{trx.notes}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Category */}
                                            <td className="px-6 py-4">
                                                <Badge variant="secondary" className="bg-white/5 text-gray-400 hover:bg-white/10 border-0 font-medium">
                                                    {getCategoryLabel(trx.category)}
                                                </Badge>
                                            </td>

                                            {/* Date */}
                                            <td className="px-6 py-4 text-gray-400 font-medium whitespace-nowrap">
                                                {formatDateTime(trx.transaction_date, trx.created_at)}
                                            </td>

                                            {/* Status */}
                                            <td className="px-6 py-4">
                                                <Badge className={cn(
                                                    "capitalize border-0",
                                                    trx.status === 'completed' ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                                                )}>
                                                    {trx.status === 'completed' ? t('admin.finance.completed') : t('common.pending')}
                                                </Badge>
                                            </td>

                                            {/* Amount */}
                                            <td className="px-6 py-4 text-right">
                                                <p className={cn(
                                                    "font-bold font-mono tracking-tight",
                                                    isIncome ? "text-emerald-400" : "text-white"
                                                )}>
                                                    {isIncome ? '+' : '-'}{Number(trx.amount).toLocaleString()} <span className="text-xs text-gray-600">MRU</span>
                                                </p>
                                            </td>

                                            {/* Actions */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1 justify-end">
                                                    {/* Note button */}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className={cn(
                                                            "h-8 w-8",
                                                            hasNote ? "text-amber-500 hover:text-amber-400" : "text-gray-600 hover:text-amber-400",
                                                            isEditingNote && "bg-amber-500/10"
                                                        )}
                                                        title={hasNote ? "Modifier la remarque" : "Ajouter une remarque"}
                                                        onClick={() => isEditingNote ? cancelEditNote() : startEditNote(trx)}
                                                    >
                                                        <MessageSquare className="w-4 h-4" />
                                                    </Button>
                                                    {/* PDF button */}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-gray-500 hover:text-emerald-400 disabled:opacity-50"
                                                        disabled={generatingPdfId === trx.id}
                                                        onClick={() => handleViewPdf(trx)}
                                                    >
                                                        {generatingPdfId === trx.id
                                                            ? <Loader2 className="w-4 h-4 animate-spin" />
                                                            : <Eye className="w-4 h-4" />}
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Note editing row */}
                                        {isEditingNote && (
                                            <tr className="bg-amber-500/5">
                                                <td colSpan={6} className="px-6 pb-4 pt-2">
                                                    <div className="flex gap-2 items-start">
                                                        <MessageSquare className="w-4 h-4 text-amber-500/70 mt-2.5 shrink-0" />
                                                        <textarea
                                                            value={noteText}
                                                            onChange={e => setNoteText(e.target.value)}
                                                            placeholder="Ajouter une remarque sur cette transaction (erreur, clarification, correction…)"
                                                            autoFocus
                                                            rows={2}
                                                            className="flex-1 bg-[#0D1117] border border-amber-500/30 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/60 resize-none"
                                                        />
                                                        <button type="button" onClick={() => saveNote(trx.id)} disabled={savingNote}
                                                            className="mt-1 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50 transition-all">
                                                            {savingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                                            Sauvegarder
                                                        </button>
                                                        <button type="button" onClick={cancelEditNote} title="Annuler"
                                                            className="mt-1 p-2 rounded-xl text-gray-500 hover:text-white hover:bg-white/10 transition-all">
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
