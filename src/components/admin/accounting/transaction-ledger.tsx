'use client'

import React from 'react'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, ArrowUpRight, ArrowDownRight, MoreHorizontal, Download, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import { useLanguage } from '@/i18n'
import { toast } from 'sonner'

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

export function TransactionLedger() {
    const supabase = createClient()
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const { t, language } = useLanguage()

    const fetchTransactions = async () => {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase
                .from('profiles')
                .select('school_id')
                .eq('id', user.id)
                .single()

            if (!profile?.school_id) return

            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('school_id', profile.school_id)
                .order('transaction_date', { ascending: false })
                .limit(50)

            if (error) throw error
            setTransactions(data ?? [])
        } catch (error) {
            console.error('Error fetching transactions:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchTransactions()
    }, [])

    // Filter by search
    const filteredTransactions = transactions.filter(trx =>
        (trx.description?.toLowerCase() ?? '').includes(searchQuery.toLowerCase()) ||
        (trx.category?.toLowerCase() ?? '').includes(searchQuery.toLowerCase())
    )

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
            transport: 'Transport',
            supplies: t('admin.accounting.supplies'),
            other: t('admin.finance.others')
        }
        return labels[cat ?? ''] ?? cat ?? 'N/A'
    }

    return (
        <div className="bg-[#161B22] border border-white/5 rounded-3xl overflow-hidden flex flex-col h-full">
            {/* Header / Controls */}
            <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
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
                        onClick={() => fetchTransactions()}
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
                                <th className="px-6 py-4">Transaction</th>
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
                                                onClick={() => setExpandedId(expandedId === trx.id ? null : trx.id)}
                                            >
                                                <MoreHorizontal className="w-4 h-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                    {expandedId === trx.id && (
                                        <tr className="bg-[#0D1117]">
                                            <td colSpan={6} className="px-6 py-4">
                                                <div className="animate-in fade-in slide-in-from-top-2 duration-200 space-y-2">
                                                    <p className="text-sm text-gray-300"><strong>Description:</strong> {trx.description || 'Aucune description'}</p>
                                                    <p className="text-sm text-gray-300"><strong>Cat&eacute;gorie:</strong> {getCategoryLabel(trx.category)}</p>
                                                    <p className="text-sm text-gray-300"><strong>Date:</strong> {formatDate(trx.transaction_date)}</p>
                                                    <p className="text-sm text-gray-300"><strong>Montant:</strong> {Number(trx.amount).toLocaleString()} MRU</p>
                                                    <p className="text-sm text-gray-300"><strong>Statut:</strong> {trx.status === 'completed' ? 'Compl\u00e9t\u00e9' : 'En attente'}</p>
                                                    <p className="text-xs text-gray-500">ID: {trx.id}</p>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="mt-2 text-xs border-white/10 text-gray-400 hover:text-white"
                                                        onClick={() => {
                                                            const receipt = [
                                                                'RECU DE TRANSACTION',
                                                                `ID: ${trx.id}`,
                                                                `Description: ${trx.description || '\u2014'}`,
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
                                                            toast.success('Recu telecharge')
                                                        }}
                                                    >
                                                        <Download className="w-3 h-3 mr-1" /> Telecharger recu
                                                    </Button>
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
