'use client'

import React from 'react'

import { useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, ArrowUpRight, ArrowDownRight, Eye, Loader2, RefreshCw, Calendar, X, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/i18n'
import { toast } from 'sonner'
import { getTransactionsAction } from '@/app/admin/finance/actions'

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
}


export function TransactionLedger({ refreshTrigger }: { refreshTrigger?: number }) {
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null)

    const { t, language } = useLanguage()

    const fetchTransactions = useCallback(async (from = dateFrom, to = dateTo) => {
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
    }, [dateFrom, dateTo])

    useEffect(() => {
        fetchTransactions(dateFrom, dateTo)
    }, [dateFrom, dateTo, refreshTrigger, fetchTransactions])

    const getCategoryLabel = (cat: string | null) => {
        const labels: Record<string, string> = {
            transport: "Transport",
            restauration: "Restauration",
            cotisation: "Cotisation",
            autre: "Autres",
            tuition: t('admin.finance.tuition'),
            salary: t('admin.finance.salaries'),
            maintenance: t('admin.finance.maintenance'),
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

    const formatDateTime = (dateStr: string, timeStr?: string) => {
        const locale = language === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR'
        const datePart = new Date(dateStr).toLocaleDateString(locale, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        })
        if (!timeStr) return datePart
        const timePart = new Date(timeStr).toLocaleTimeString(locale, {
            hour: '2-digit',
            minute: '2-digit',
        })
        return `${datePart} · ${timePart}`
    }

    const handleViewPdf = async (trx: Transaction) => {
        setGeneratingPdfId(trx.id)
        try {
            // Fetch related person info if profile linked
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

            // ── Thermal receipt 80mm — modern, large fonts
            const W = 80
            const ml = 6
            const mr = W - 6
            const cx = W / 2
            const fmt = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

            const isIncome = trx.type === 'income' || trx.type === 'tuition'
            const shortId = trx.id.slice(0, 8).toUpperCase()
            const printDate = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
            const txDate = formatDate(trx.transaction_date)
            const isPaid = trx.status === 'completed'
            const BK: [number,number,number] = [10,  10,  10]
            const GR: [number,number,number] = [150, 150, 150]

            const hline = (yPos: number, thick = 0.3) => {
                doc.setDrawColor(...BK)
                doc.setLineWidth(thick)
                doc.line(ml, yPos, mr, yPos)
            }

            let estimatedH = 210
            if (person) estimatedH += (person.national_id || person.phone) ? 40 : 28

            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [W, estimatedH] })

            let y = 11

            // ─── Header
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...BK)
            doc.text('QALAMI', ml, y); y += 6
            doc.setFont('Helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GR)
            doc.text('School Manager  ·  Gestion Scolaire', ml, y); y += 7

            hline(y, 0.8); y += 5

            doc.setFont('Helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...GR)
            doc.text('RECU DE TRANSACTION', ml, y)
            doc.setFont('Helvetica', 'normal'); doc.setFontSize(8)
            doc.text(printDate, mr, y, { align: 'right' }); y += 5

            hline(y, 0.3); y += 7

            // ─── Description
            const refText = trx.description || getCategoryLabel(trx.category)
            const splitRef = doc.splitTextToSize(refText, mr - ml)
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...BK)
            doc.text(splitRef, ml, y); y += splitRef.length * 6.5 + 2

            doc.setFont('Helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GR)
            doc.text(`REF  ${shortId}`, ml, y); y += 9

            // ─── Amount box
            hline(y, 0.8); y += 6
            doc.setFont('Helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GR)
            doc.text(isIncome ? 'MONTANT RECU' : 'MONTANT REGLE', cx, y, { align: 'center' }); y += 10
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(28); doc.setTextColor(...BK)
            doc.text(fmt(trx.amount), cx, y, { align: 'center' }); y += 6
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(11)
            doc.text('MRU', cx, y, { align: 'center' }); y += 7
            hline(y, 0.8); y += 9

            // ─── Detail rows: label left gray / value right bold
            const row = (label: string, value: string) => {
                doc.setFont('Helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GR)
                doc.text(label, ml, y)
                doc.setFont('Helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...BK)
                doc.text(value, mr, y, { align: 'right' }); y += 7
            }

            row('Categorie', getCategoryLabel(trx.category))
            row('Date', txDate)
            row('Statut', isPaid ? 'COMPLETE' : 'EN ATTENTE')

            // ─── Beneficiary
            if (person) {
                y += 2; hline(y, 0.3); y += 6

                const roleLabel = person.role === 'teacher' ? 'Enseignant' :
                                  person.role === 'student' ? 'Eleve' : 'Personnel'

                doc.setFont('Helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GR)
                doc.text(`BENEFICIAIRE  ·  ${roleLabel.toUpperCase()}`, ml, y); y += 6
                doc.setFont('Helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...BK)
                doc.text(person.full_name || '—', ml, y); y += 8

                if (person.national_id) { row('NNI', person.national_id) }
                if (person.phone)       { row('Tel', person.phone) }
            }

            // ─── Footer
            y += 3; hline(y, 0.3); y += 6
            doc.setFont('Helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GR)
            doc.text(`Genere le ${printDate}`, ml, y)
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...BK)
            doc.text('Qalami School Manager', mr, y, { align: 'right' })

            doc.save(`recu-${shortId}.pdf`)
            toast.success('PDF téléchargé')
        } catch {
            toast.error('Erreur lors de la génération du PDF')
        } finally {
            setGeneratingPdfId(null)
        }
    }


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
                        title={t('admin.accounting.filterByDate')}
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        className="bg-[#0D1117] border border-white/10 text-white text-sm rounded-md h-8 px-3 focus:outline-none focus:border-emerald-500/50 scheme-dark cursor-pointer"
                    />
                    <span className="text-gray-600 text-xs">{t('admin.accounting.dateTo')}</span>
                    <input
                        type="date"
                        title={t('admin.accounting.dateTo')}
                        value={dateTo}
                        min={dateFrom || undefined}
                        onChange={e => setDateTo(e.target.value)}
                        className="bg-[#0D1117] border border-white/10 text-white text-sm rounded-md h-8 px-3 focus:outline-none focus:border-emerald-500/50 scheme-dark cursor-pointer"
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
                                <th className="px-6 py-4"><span className="sr-only">Actions</span></th>
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
                                                    <p className="font-bold text-white text-sm">{buildRef(trx)}</p>
                                                    <p className="text-[10px] text-gray-500 font-mono">{trx.id.slice(0, 8).toUpperCase()}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant="secondary" className="bg-white/5 text-gray-400 hover:bg-white/10 border-0 font-medium">
                                                {getCategoryLabel(trx.category)}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-gray-400 font-medium whitespace-nowrap">{formatDateTime(trx.transaction_date, trx.created_at)}</td>
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
                                                className="h-8 w-8 text-gray-500 hover:text-emerald-400 disabled:opacity-50"
                                                disabled={generatingPdfId === trx.id}
                                                onClick={() => handleViewPdf(trx)}
                                            >
                                                {generatingPdfId === trx.id
                                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                                    : <Eye className="w-4 h-4" />
                                                }
                                            </Button>
                                        </td>
                                    </tr>

                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
