'use client'

import React from 'react'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, ArrowUpRight, ArrowDownRight, MoreHorizontal, Download, Loader2, RefreshCw, Calendar, X, Pencil, Trash2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/i18n'
import { toast } from 'sonner'
import { getTransactionsAction, updateTransactionAction, deleteTransactionAction } from '@/app/admin/finance/actions'

interface Transaction {
    id: string
    type: string
    category: string | null
    description: string | null
    amount: number
    status: string
    transaction_date: string
    created_at: string
}

const INCOME_CATEGORIES = ['tuition', 'inscription', 'scolarite', 'other']
const EXPENSE_CATEGORIES = ['salary', 'transport', 'maintenance', 'supplies', 'cantine', 'activites', 'other']

export function TransactionLedger() {
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [expandedId, setExpandedId] = useState<string | null>(null)

    // Edit / delete state
    const [editingId, setEditingId] = useState<string | null>(null)
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
    const [editForm, setEditForm] = useState<Partial<Transaction>>({})
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const { t, language } = useLanguage()

    const fetchTransactions = async (from = dateFrom, to = dateTo) => {
        setLoading(true)
        try {
            const result = await getTransactionsAction({ dateFrom: from || undefined, dateTo: to || undefined })
            if (result.error) {
                console.error('Error fetching transactions:', result.error)
                return
            }
            setTransactions(result.data)
        } catch (error) {
            console.error('Error fetching transactions:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchTransactions(dateFrom, dateTo)
    }, [dateFrom, dateTo])

    const filteredTransactions = transactions.filter(trx => {
        const matchesSearch = !searchQuery ||
            (trx.description?.toLowerCase() ?? '').includes(searchQuery.toLowerCase()) ||
            (trx.category?.toLowerCase() ?? '').includes(searchQuery.toLowerCase())
        return matchesSearch
    })

    const formatDate = (dateStr: string) => {
        const locale = language === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR'
        return new Date(dateStr).toLocaleDateString(locale, {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        })
    }

    const getCategoryLabel = (cat: string | null) => {
        const labels: Record<string, string> = {
            tuition: t('admin.finance.tuition'),
            salary: t('admin.finance.salaries'),
            maintenance: t('admin.finance.maintenance'),
            transport: t('admin.finance.transport'),
            supplies: t('admin.accounting.supplies'),
            other: t('admin.finance.others'),
            inscription: "Inscription",
            scolarite: "Scolarité",
            cantine: "Cantine",
            bus: "Transport",
            activites: "Activités"
        }
        return labels[cat ?? ''] ?? cat ?? 'N/A'
    }

    const openEdit = (trx: Transaction) => {
        setEditForm({
            type: trx.type,
            category: trx.category ?? '',
            description: trx.description ?? '',
            amount: trx.amount,
            status: trx.status,
            transaction_date: trx.transaction_date.slice(0, 10),
        })
        setEditingId(trx.id)
        setDeleteConfirmId(null)
    }

    const cancelEdit = () => {
        setEditingId(null)
        setEditForm({})
    }

    const handleSaveEdit = async (trx: Transaction) => {
        if (!editForm.amount || Number(editForm.amount) <= 0) {
            toast.error(t('admin.accounting.fillRequired'))
            return
        }
        setSaving(true)
        const result = await updateTransactionAction(trx.id, {
            type: editForm.type,
            category: editForm.category ?? undefined,
            description: editForm.description ?? undefined,
            amount: Number(editForm.amount),
            status: editForm.status,
            transaction_date: editForm.transaction_date,
        })
        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success(t('admin.accounting.transactionUpdated'))
            setTransactions(prev => prev.map(t => t.id === trx.id ? { ...t, ...editForm, amount: Number(editForm.amount) } as Transaction : t))
            setEditingId(null)
            setEditForm({})
        }
        setSaving(false)
    }

    const handleDelete = async (id: string) => {
        setDeleting(true)
        const result = await deleteTransactionAction(id)
        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success(t('admin.accounting.transactionDeleted'))
            setTransactions(prev => prev.filter(t => t.id !== id))
            setExpandedId(null)
            setDeleteConfirmId(null)
        }
        setDeleting(false)
    }

    const currentCategories = (editForm.type === 'income' || editForm.type === 'tuition')
        ? INCOME_CATEGORIES
        : EXPENSE_CATEGORIES

    return (
        <div className="bg-[#161B22] border border-white/5 rounded-3xl overflow-hidden flex flex-col h-full">
            {/* Header / Controls */}
            <div className="p-6 border-b border-white/5 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        {t('admin.finance.transactionHistory')}
                        <Badge variant="outline" className="ml-2 bg-white/5 border-white/10 text-gray-400">{filteredTransactions.length}</Badge>
                    </h3>

                    <div className="flex gap-2 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <Input
                                placeholder={t('admin.accounting.searchTransaction')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-[#0D1117] border-white/10 pl-9 text-white placeholder:text-gray-600 focus-visible:ring-emerald-500/50"
                            />
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => fetchTransactions(dateFrom, dateTo)}
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
                                document.body.appendChild(link)
                                link.click()
                                document.body.removeChild(link)
                                URL.revokeObjectURL(url)
                                toast.success(`${filteredTransactions.length} transactions exportées`)
                            }}
                        >
                            <Download className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* Date range filter */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 text-gray-500">
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">{t('admin.accounting.filterByDate')}</span>
                    </div>
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        className="bg-[#0D1117] border border-white/10 text-white text-sm rounded-md h-8 px-3 focus:outline-none focus:border-emerald-500/50 [color-scheme:dark] cursor-pointer"
                    />
                    <span className="text-gray-600 text-xs">{t('admin.accounting.dateTo')}</span>
                    <input
                        type="date"
                        value={dateTo}
                        min={dateFrom || undefined}
                        onChange={e => setDateTo(e.target.value)}
                        className="bg-[#0D1117] border border-white/10 text-white text-sm rounded-md h-8 px-3 focus:outline-none focus:border-emerald-500/50 [color-scheme:dark] cursor-pointer"
                    />
                    {(dateFrom || dateTo) && (
                        <button
                            type="button"
                            onClick={() => { setDateFrom(''); setDateTo('') }}
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-md px-2 h-8 transition-colors"
                        >
                            <X className="w-3 h-3" />
                            {t('admin.accounting.clearDates')}
                        </button>
                    )}
                </div>
            </div>

            {/* List */}
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
                                <th className="px-6 py-4"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredTransactions.map((trx) => (
                                <React.Fragment key={trx.id}>
                                    <tr className="group hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-10 h-10 rounded-full flex items-center justify-center border",
                                                    trx.type === 'income' || trx.type === 'tuition'
                                                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                                                        : "bg-red-500/10 border-red-500/20 text-red-500"
                                                )}>
                                                    {trx.type === 'income' || trx.type === 'tuition' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-white text-sm">{trx.description || 'Transaction'}</p>
                                                    <p className="text-[10px] text-gray-500 font-mono">{trx.id.slice(0, 8).toUpperCase()}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant="secondary" className="bg-white/5 text-gray-400 hover:bg-white/10 border-0 font-medium">
                                                {getCategoryLabel(trx.category)}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-gray-400 font-medium">{formatDate(trx.transaction_date)}</td>
                                        <td className="px-6 py-4">
                                            <Badge className={cn(
                                                "capitalize border-0",
                                                trx.status === 'completed' ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                                            )}>
                                                {trx.status === 'completed' ? t('admin.finance.completed') : t('common.pending')}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <p className={cn(
                                                "font-bold font-mono tracking-tight",
                                                (trx.type === 'income' || trx.type === 'tuition') ? "text-emerald-400" : "text-white"
                                            )}>
                                                {(trx.type === 'income' || trx.type === 'tuition') ? '+' : '-'}{Number(trx.amount).toLocaleString()} <span className="text-xs text-gray-600">MRU</span>
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-gray-500 hover:text-white"
                                                onClick={() => {
                                                    const opening = expandedId !== trx.id
                                                    setExpandedId(opening ? trx.id : null)
                                                    if (!opening) { cancelEdit(); setDeleteConfirmId(null) }
                                                }}
                                            >
                                                <MoreHorizontal className="w-4 h-4" />
                                            </Button>
                                        </td>
                                    </tr>

                                    {expandedId === trx.id && (
                                        <tr className="bg-[#0D1117]">
                                            <td colSpan={6} className="px-6 py-4">
                                                <div className="animate-in fade-in slide-in-from-top-2 duration-200">

                                                    {/* ── Edit form ── */}
                                                    {editingId === trx.id ? (
                                                        <div className="space-y-4">
                                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('admin.accounting.editTransaction')}</p>

                                                            {/* Type toggle */}
                                                            <div className="grid grid-cols-2 gap-2 p-1 bg-[#161B22] rounded-xl border border-white/5 w-fit">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setEditForm(f => ({ ...f, type: 'income', category: 'tuition' }))}
                                                                    className={cn(
                                                                        'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all',
                                                                        editForm.type === 'income' ? 'bg-emerald-500/15 text-emerald-400' : 'text-gray-500 hover:text-gray-300'
                                                                    )}
                                                                >
                                                                    <ArrowUpRight className="w-3.5 h-3.5" /> {t('admin.finance.income')}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setEditForm(f => ({ ...f, type: 'expense', category: 'other' }))}
                                                                    className={cn(
                                                                        'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all',
                                                                        editForm.type === 'expense' ? 'bg-red-500/15 text-red-400' : 'text-gray-500 hover:text-gray-300'
                                                                    )}
                                                                >
                                                                    <ArrowDownRight className="w-3.5 h-3.5" /> {t('admin.finance.expenses')}
                                                                </button>
                                                            </div>

                                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                                {/* Amount */}
                                                                <div>
                                                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">{t('common.amount')} (MRU)</label>
                                                                    <input
                                                                        type="number"
                                                                        value={editForm.amount ?? ''}
                                                                        onChange={e => setEditForm(f => ({ ...f, amount: Number(e.target.value) }))}
                                                                        className="w-full bg-[#161B22] border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500/50"
                                                                    />
                                                                </div>

                                                                {/* Category */}
                                                                <div>
                                                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">{t('admin.accounting.category')}</label>
                                                                    <select
                                                                        value={editForm.category ?? ''}
                                                                        onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                                                                        className="w-full bg-[#161B22] border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500/50"
                                                                    >
                                                                        {currentCategories.map(cat => (
                                                                            <option key={cat} value={cat} className="bg-[#161B22]">{getCategoryLabel(cat)}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>

                                                                {/* Date */}
                                                                <div>
                                                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Date</label>
                                                                    <input
                                                                        type="date"
                                                                        value={editForm.transaction_date ?? ''}
                                                                        onChange={e => setEditForm(f => ({ ...f, transaction_date: e.target.value }))}
                                                                        className="w-full bg-[#161B22] border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500/50 [color-scheme:dark]"
                                                                    />
                                                                </div>

                                                                {/* Status */}
                                                                <div>
                                                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">{t('common.status')}</label>
                                                                    <select
                                                                        value={editForm.status ?? 'completed'}
                                                                        onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                                                                        className="w-full bg-[#161B22] border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500/50"
                                                                    >
                                                                        <option value="completed" className="bg-[#161B22]">{t('admin.finance.completed')}</option>
                                                                        <option value="pending" className="bg-[#161B22]">{t('common.pending')}</option>
                                                                    </select>
                                                                </div>
                                                            </div>

                                                            {/* Description */}
                                                            <div>
                                                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">{t('common.description')}</label>
                                                                <input
                                                                    type="text"
                                                                    value={editForm.description ?? ''}
                                                                    onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                                                                    placeholder={t('admin.accounting.descriptionPlaceholder')}
                                                                    className="w-full bg-[#161B22] border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500/50 placeholder:text-gray-600"
                                                                />
                                                            </div>

                                                            <div className="flex gap-2 pt-1">
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => handleSaveEdit(trx)}
                                                                    disabled={saving}
                                                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                                                                >
                                                                    {saving ? <Loader2 className="w-3.5 h-3.5 me-1.5 animate-spin" /> : <Check className="w-3.5 h-3.5 me-1.5" />}
                                                                    {t('common.save')}
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={cancelEdit}
                                                                    disabled={saving}
                                                                    className="border-white/10 text-gray-400 hover:text-white bg-transparent"
                                                                >
                                                                    {t('common.cancel')}
                                                                </Button>
                                                            </div>
                                                        </div>

                                                    /* ── Delete confirm ── */
                                                    ) : deleteConfirmId === trx.id ? (
                                                        <div className="flex items-center gap-4 p-3 bg-red-500/5 border border-red-500/20 rounded-xl">
                                                            <Trash2 className="w-4 h-4 text-red-400 shrink-0" />
                                                            <p className="text-sm text-red-300 font-medium flex-1">{t('admin.accounting.confirmDelete')}</p>
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleDelete(trx.id)}
                                                                disabled={deleting}
                                                                className="bg-red-600 hover:bg-red-500 text-white font-bold"
                                                            >
                                                                {deleting ? <Loader2 className="w-3.5 h-3.5 me-1.5 animate-spin" /> : null}
                                                                {t('common.confirm')}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => setDeleteConfirmId(null)}
                                                                disabled={deleting}
                                                                className="border-white/10 text-gray-400 hover:text-white bg-transparent"
                                                            >
                                                                {t('common.cancel')}
                                                            </Button>
                                                        </div>

                                                    /* ── Detail view ── */
                                                    ) : (
                                                        <div className="space-y-2">
                                                            <p className="text-sm text-gray-300"><strong>Description:</strong> {trx.description || 'Aucune description'}</p>
                                                            <p className="text-sm text-gray-300"><strong>Catégorie:</strong> {getCategoryLabel(trx.category)}</p>
                                                            <p className="text-sm text-gray-300"><strong>Date:</strong> {formatDate(trx.transaction_date)}</p>
                                                            <p className="text-sm text-gray-300"><strong>Montant:</strong> {Number(trx.amount).toLocaleString()} MRU</p>
                                                            <p className="text-sm text-gray-300"><strong>Statut:</strong> {trx.status === 'completed' ? t('admin.finance.completed') : t('common.pending')}</p>
                                                            <p className="text-xs text-gray-500">ID: {trx.id}</p>
                                                            <div className="flex gap-2 pt-2">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => openEdit(trx)}
                                                                    className="border-white/10 text-gray-300 hover:text-white bg-transparent text-xs"
                                                                >
                                                                    <Pencil className="w-3 h-3 me-1.5" /> {t('admin.accounting.editTransaction')}
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => setDeleteConfirmId(trx.id)}
                                                                    className="border-red-500/20 text-red-400 hover:text-red-300 hover:bg-red-500/10 bg-transparent text-xs"
                                                                >
                                                                    <Trash2 className="w-3 h-3 me-1.5" /> {t('admin.accounting.deleteTransaction')}
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="ms-auto border-white/10 text-gray-400 hover:text-white bg-transparent text-xs"
                                                                    onClick={() => {
                                                                        const receipt = [
                                                                            'RECU DE TRANSACTION',
                                                                            `ID: ${trx.id}`,
                                                                            `Description: ${trx.description || '—'}`,
                                                                            `Categorie: ${getCategoryLabel(trx.category)}`,
                                                                            `Date: ${formatDate(trx.transaction_date)}`,
                                                                            `Montant: ${Number(trx.amount).toLocaleString()} MRU`,
                                                                            `Statut: ${trx.status}`,
                                                                            '', 'Genere par Qalami'
                                                                        ].join('\n')
                                                                        const blob = new Blob([receipt], { type: 'text/plain;charset=utf-8;' })
                                                                        const url = URL.createObjectURL(blob)
                                                                        const a = document.createElement('a')
                                                                        a.href = url
                                                                        a.download = `recu-${trx.id.slice(0, 8)}.txt`
                                                                        document.body.appendChild(a)
                                                                        a.click()
                                                                        document.body.removeChild(a)
                                                                        URL.revokeObjectURL(url)
                                                                        toast.success('Reçu téléchargé')
                                                                    }}
                                                                >
                                                                    <Download className="w-3 h-3 me-1.5" /> Télécharger reçu
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
