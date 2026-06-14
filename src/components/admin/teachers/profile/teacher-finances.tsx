'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
    Loader2, Banknote, TrendingUp, Calendar, CheckCircle2, Clock, XCircle,
    Plus, X, ArrowDownRight, Eye, Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/i18n'
import { getMySchoolContext } from '@/app/admin/actions'
import { toast } from 'sonner'
import { StaffAdjustments } from './staff-adjustments'
import { TeacherPayrollSection } from './teacher-payroll-section'
import {
    recordTeacherPaymentAction,
    getTeacherTransactionsAction,
} from '@/app/admin/teachers/actions'

interface ContractData {
    monthly_salary: number
    contract_type: 'fixed' | 'hourly'
    position: string | null
}

interface PayrollRecord {
    id: string
    month: number
    year: number
    base_salary: number
    bonuses: number
    deductions: number
    net_salary: number
    status: 'pending' | 'paid' | 'cancelled'
    paid_at: string | null
}

interface TeacherTransaction {
    id: string
    type: string
    category: string | null
    description: string | null
    amount: number
    status: string
    transaction_date: string
    created_at: string
    payment_method: string | null
    reference_number: string | null
}

const MONTH_KEYS = ['january','february','march','april','may','june','july','august','september','october','november','december']

const PAYMENT_CATEGORIES = [
    { value: 'prime',         label: 'Prime / Bonus' },
    { value: 'avance',        label: 'Avance sur salaire' },
    { value: 'remboursement', label: 'Remboursement' },
    { value: 'cotisation',    label: 'Cotisation' },
    { value: 'autre',         label: 'Autre versement' },
]

const PAYMENT_METHODS = [
    { value: 'cash',          label: 'Espèces' },
    { value: 'bank_transfer', label: 'Virement bancaire' },
    { value: 'mobile_money',  label: 'Mobile Money' },
    { value: 'check',         label: 'Chèque' },
]

function getCategoryLabel(cat: string | null) {
    const map: Record<string, string> = {
        prime: 'Prime / Bonus', avance: 'Avance', remboursement: 'Remboursement',
        cotisation: 'Cotisation', autre: 'Autre', salary: 'Salaire',
        'Salaire du personnel': 'Salaire',
    }
    return map[cat ?? ''] ?? cat ?? '—'
}

export function TeacherFinances({ teacherId }: { teacherId: string }) {
    const { t } = useLanguage()
    const [loading, setLoading] = useState(true)
    const [contract, setContract] = useState<ContractData | null>(null)
    const [payments, setPayments] = useState<PayrollRecord[]>([])
    const [transactions, setTransactions] = useState<TeacherTransaction[]>([])
    const [txLoading, setTxLoading] = useState(true)
    const [payrollRefreshTick, setPayrollRefreshTick] = useState(0)

    // Payment form state
    const [showForm, setShowForm] = useState(false)
    const [payAmount, setPayAmount] = useState('')
    const [payCategory, setPayCategory] = useState('prime')
    const [payDescription, setPayDescription] = useState('')
    const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
    const [payMethod, setPayMethod] = useState('cash')
    const [submitting, setSubmitting] = useState(false)

    // Receipt generation
    const [generatingReceiptId, setGeneratingReceiptId] = useState<string | null>(null)

    const fetchTransactions = useCallback(async () => {
        setTxLoading(true)
        const res = await getTeacherTransactionsAction(teacherId)
        if (!res.error) setTransactions(res.data as TeacherTransaction[])
        setTxLoading(false)
    }, [teacherId])

    useEffect(() => {
        async function load() {
            const supabase = createClient()
            const ctx = await getMySchoolContext()
            const schoolId = ctx?.school_id
            if (!schoolId) { setLoading(false); return }

            const [contractRes, payrollRes] = await Promise.all([
                supabase
                    .from('contracts')
                    .select('monthly_salary, contract_type, position')
                    .eq('employee_id', teacherId)
                    .eq('school_id', schoolId)
                    .eq('status', 'active')
                    .maybeSingle(),
                supabase
                    .from('payroll')
                    .select('id, month, year, base_salary, bonuses, deductions, net_salary, status, paid_at')
                    .eq('employee_id', teacherId)
                    .eq('school_id', schoolId)
                    .order('year', { ascending: false })
                    .order('month', { ascending: false })
                    .limit(24),
            ])

            if (contractRes.data) setContract(contractRes.data as ContractData)
            if (payrollRes.data) setPayments(payrollRes.data as PayrollRecord[])
            setLoading(false)
        }
        load()
        fetchTransactions()
    }, [teacherId, fetchTransactions, payrollRefreshTick])

    const handleAddPayment = async () => {
        const amount = parseFloat(payAmount)
        if (!amount || amount <= 0) { toast.error('Montant invalide'); return }
        setSubmitting(true)
        const res = await recordTeacherPaymentAction({
            teacherId,
            amount,
            category: payCategory,
            description: payDescription.trim() || PAYMENT_CATEGORIES.find(c => c.value === payCategory)?.label || payCategory,
            date: payDate,
            paymentMethod: payMethod,
        })
        setSubmitting(false)
        if (res.error) { toast.error(res.error); return }
        toast.success('Paiement enregistré')
        setShowForm(false)
        setPayAmount('')
        setPayDescription('')
        setPayDate(new Date().toISOString().split('T')[0])
        await fetchTransactions()
    }

    const handleGenerateReceipt = async (trx: TeacherTransaction, teacherName?: string) => {
        setGeneratingReceiptId(trx.id)
        try {
            const { jsPDF } = await import('jspdf')
            const W = 80, ml = 6, mr = W - 6, cx = W / 2
            const fmt = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
            const shortId = trx.id.slice(0, 8).toUpperCase()
            const printDate = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
            const txDate = new Date(trx.transaction_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
            const BK: [number,number,number] = [10, 10, 10]
            const GR: [number,number,number] = [150, 150, 150]

            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [W, 200] })

            const hline = (yPos: number, thick = 0.3) => {
                doc.setDrawColor(...BK); doc.setLineWidth(thick); doc.line(ml, yPos, mr, yPos)
            }
            const row = (label: string, value: string) => {
                doc.setFont('Helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GR); doc.text(label, ml, y)
                doc.setFont('Helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...BK); doc.text(value, mr, y, { align: 'right' }); y += 7
            }

            let y = 11
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...BK); doc.text('QALAMI', ml, y); y += 6
            doc.setFont('Helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GR); doc.text('School Manager  ·  Gestion Scolaire', ml, y); y += 7
            hline(y, 0.8); y += 5
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...GR); doc.text('RECU DE VERSEMENT', ml, y)
            doc.setFont('Helvetica', 'normal'); doc.setFontSize(8); doc.text(printDate, mr, y, { align: 'right' }); y += 5
            hline(y, 0.3); y += 7

            const refText = trx.description || getCategoryLabel(trx.category)
            const splitRef = doc.splitTextToSize(refText, mr - ml)
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...BK); doc.text(splitRef, ml, y); y += splitRef.length * 6.5 + 2
            doc.setFont('Helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GR); doc.text(`REF  ${shortId}`, ml, y); y += 9

            hline(y, 0.8); y += 6
            doc.setFont('Helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GR); doc.text('MONTANT VERSE', cx, y, { align: 'center' }); y += 10
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(28); doc.setTextColor(...BK); doc.text(fmt(trx.amount), cx, y, { align: 'center' }); y += 6
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(11); doc.text('MRU', cx, y, { align: 'center' }); y += 7
            hline(y, 0.8); y += 9

            row('Catégorie', getCategoryLabel(trx.category))
            row('Date', txDate)
            if (trx.payment_method) {
                const methods: Record<string, string> = { cash: 'Espèces', bank_transfer: 'Virement', mobile_money: 'Mobile Money', check: 'Chèque' }
                row('Méthode', methods[trx.payment_method] || trx.payment_method)
            }
            row('Statut', 'COMPLÉTÉ')

            // Beneficiary
            if (teacherName) {
                y += 2; hline(y, 0.3); y += 6
                doc.setFont('Helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GR); doc.text('BÉNÉFICIAIRE  ·  ENSEIGNANT', ml, y); y += 6
                doc.setFont('Helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...BK); doc.text(teacherName, ml, y); y += 8
            }

            y += 3; hline(y, 0.3); y += 6
            doc.setFont('Helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GR); doc.text(`Généré le ${printDate}`, ml, y)
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...BK); doc.text('Qalami School Manager', mr, y, { align: 'right' })

            doc.save(`recu-${shortId}.pdf`)
            toast.success('Reçu téléchargé')
        } catch {
            toast.error('Erreur lors de la génération du reçu')
        } finally {
            setGeneratingReceiptId(null)
        }
    }

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
        </div>
    )

    const totalPaid = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.net_salary || 0), 0)
    const totalTransactions = transactions.reduce((sum, t) => sum + (t.amount || 0), 0)

    return (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-white">{t('admin.teachers.finances.title')}</h3>
                    <p className="text-gray-400 text-sm">{t('admin.teachers.finances.subtitle')}</p>
                </div>
                <button
                    type="button"
                    onClick={() => setShowForm(v => !v)}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all",
                        showForm
                            ? "bg-white/10 text-gray-400 hover:bg-white/15"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30"
                    )}
                >
                    {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {showForm ? 'Annuler' : 'Enregistrer un paiement'}
                </button>
            </div>

            {/* ── Payment form ── */}
            {showForm && (
                <div className="bg-[#1A2530] rounded-3xl border border-emerald-500/20 p-5 space-y-4 animate-in slide-in-from-top-2 duration-300">
                    <h4 className="font-bold text-white text-sm">Nouveau versement</h4>
                    <div className="grid grid-cols-2 gap-3">
                        {/* Amount */}
                        <div>
                            <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Montant (MRU)</label>
                            <input
                                type="number"
                                min="1"
                                placeholder="0"
                                value={payAmount}
                                onChange={e => setPayAmount(e.target.value)}
                                className="w-full bg-[#0F1720] border border-white/10 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-emerald-500/50"
                            />
                        </div>
                        {/* Date */}
                        <div>
                            <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Date</label>
                            <input
                                type="date"
                                title="Date du paiement"
                                value={payDate}
                                onChange={e => setPayDate(e.target.value)}
                                className="w-full bg-[#0F1720] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 scheme-dark"
                            />
                        </div>
                        {/* Category */}
                        <div>
                            <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Catégorie</label>
                            <select
                                value={payCategory}
                                onChange={e => setPayCategory(e.target.value)}
                                className="w-full bg-[#0F1720] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                            >
                                {PAYMENT_CATEGORIES.map(c => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>
                        </div>
                        {/* Payment method */}
                        <div>
                            <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Méthode</label>
                            <select
                                value={payMethod}
                                onChange={e => setPayMethod(e.target.value)}
                                className="w-full bg-[#0F1720] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                            >
                                {PAYMENT_METHODS.map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    {/* Description */}
                    <div>
                        <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Description (optionnel)</label>
                        <input
                            type="text"
                            placeholder={`Ex: Prime de performance – juin 2026`}
                            value={payDescription}
                            onChange={e => setPayDescription(e.target.value)}
                            className="w-full bg-[#0F1720] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleAddPayment}
                        disabled={submitting || !payAmount}
                        className="flex items-center gap-2 w-full justify-center py-2.5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-all"
                    >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Confirmer le versement
                    </button>
                </div>
            )}

            {/* ── Contract summary ── */}
            {!contract ? (
                <div className="bg-[#1A2530] rounded-3xl border border-amber-500/20 p-10 text-center">
                    <Banknote className="w-10 h-10 text-amber-500/30 mx-auto mb-3" />
                    <p className="text-amber-400 font-bold">{t('admin.teachers.finances.noContract')}</p>
                    <p className="text-gray-500 text-sm mt-2 max-w-xs mx-auto">{t('admin.teachers.finances.noContractDesc')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 bg-[#1A2530] rounded-2xl border border-emerald-500/20 p-5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <Banknote className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">
                                {contract.contract_type === 'hourly'
                                    ? t('admin.teachers.finances.hourlyRateLabel')
                                    : t('admin.teachers.finances.baseSalaryLabel')}
                            </p>
                            <p className="text-2xl font-black text-white">
                                {(contract.monthly_salary || 0).toLocaleString('fr-FR')}
                                <span className="text-sm text-gray-400 ml-1.5">
                                    {contract.contract_type === 'hourly' ? 'MRU/h' : 'MRU'}
                                </span>
                            </p>
                            {contract.position && <p className="text-xs text-gray-500 mt-0.5">{contract.position}</p>}
                        </div>
                    </div>
                    <div className="bg-[#1A2530] rounded-2xl border border-white/5 p-5 flex flex-col items-center justify-center text-center">
                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">{t('admin.teachers.finances.contractType')}</p>
                        <p className="text-sm font-bold text-white">
                            {contract.contract_type === 'hourly'
                                ? t('admin.teachers.finances.hourlyLabel')
                                : t('admin.teachers.finances.fixedLabel')}
                        </p>
                    </div>
                </div>
            )}

            {/* ── Total paid bar ── */}
            {payments.filter(p => p.status === 'paid').length > 0 && (
                <div className="bg-[#1A2530] rounded-2xl border border-white/5 px-5 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-gray-400" />
                        <p className="text-sm text-gray-400">{t('admin.teachers.finances.totalPaid')}</p>
                    </div>
                    <p className="text-lg font-black text-emerald-400">{totalPaid.toLocaleString('fr-FR')} MRU</p>
                </div>
            )}

            {/* ── Payroll section ── */}
            <TeacherPayrollSection
                teacherId={teacherId}
                onPayrollConfirmed={() => {
                    setPayrollRefreshTick(n => n + 1)
                    fetchTransactions()
                }}
            />

            {/* ── Staff adjustments log ── */}
            <div className="bg-[#1A2530] rounded-3xl border border-white/5 p-5">
                <StaffAdjustments profileId={teacherId} />
            </div>

            {/* ── Operations (transactions) ── */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-white">Opérations & Reçus</h4>
                    {transactions.length > 0 && (
                        <span className="text-xs text-gray-500">{transactions.length} opération{transactions.length !== 1 ? 's' : ''}</span>
                    )}
                </div>

                {txLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                    </div>
                ) : transactions.length === 0 ? (
                    <div className="bg-[#1A2530] rounded-3xl border border-white/5 p-10 text-center">
                        <ArrowDownRight className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">Aucune opération enregistrée</p>
                        <p className="text-xs text-gray-600 mt-1">Les paiements enregistrés apparaîtront ici</p>
                    </div>
                ) : (
                    <div className="bg-[#1A2530] rounded-3xl border border-white/5 overflow-hidden">
                        {/* Total */}
                        <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between bg-[#0F1720]">
                            <p className="text-xs text-gray-500">Total versé (hors paie)</p>
                            <p className="text-sm font-black text-white">{totalTransactions.toLocaleString('fr-FR')} MRU</p>
                        </div>
                        <div className="divide-y divide-white/5">
                            {transactions.map(trx => {
                                const catLabel = getCategoryLabel(trx.category)
                                const dateStr = new Date(trx.transaction_date).toLocaleDateString('fr-FR', {
                                    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Nouakchott'
                                })
                                const timeStr = new Date(trx.created_at).toLocaleTimeString('fr-FR', {
                                    hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nouakchott'
                                })
                                const isSalary = trx.type === 'salary' || trx.category === 'salary' || trx.category === 'Salaire du personnel'

                                return (
                                    <div key={trx.id} className="flex items-start gap-4 p-4 hover:bg-[#0F1720] transition-colors">
                                        <div className={cn(
                                            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border mt-0.5",
                                            isSalary
                                                ? "bg-blue-500/10 border-blue-500/20"
                                                : "bg-emerald-500/10 border-emerald-500/20"
                                        )}>
                                            <ArrowDownRight className={cn("w-4 h-4", isSalary ? "text-blue-400" : "text-emerald-400")} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-white">{trx.description || catLabel}</p>
                                            <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                                <span className="text-[10px] text-gray-500">{dateStr} · {timeStr}</span>
                                                <span className="text-[10px] bg-white/5 text-gray-400 px-2 py-0.5 rounded-full">{catLabel}</span>
                                                {trx.payment_method && (
                                                    <span className="text-[10px] text-gray-600">
                                                        {({ cash: 'Espèces', bank_transfer: 'Virement', mobile_money: 'Mobile Money', check: 'Chèque' } as Record<string, string>)[trx.payment_method] || trx.payment_method}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <p className="text-base font-black text-white">
                                                {Number(trx.amount).toLocaleString('fr-FR')}
                                                <span className="text-[10px] text-gray-600 ml-1">MRU</span>
                                            </p>
                                            <button
                                                type="button"
                                                title="Télécharger le reçu"
                                                disabled={generatingReceiptId === trx.id}
                                                onClick={() => handleGenerateReceipt(trx)}
                                                className="p-1.5 text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors disabled:opacity-50"
                                            >
                                                {generatingReceiptId === trx.id
                                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                                    : <Eye className="w-4 h-4" />
                                                }
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Payroll history ── */}
            <div>
                <h4 className="text-sm font-bold text-white mb-3">{t('admin.teachers.finances.paymentHistory')}</h4>
                {payments.length === 0 ? (
                    <div className="bg-[#1A2530] rounded-3xl border border-white/5 p-12 text-center">
                        <Calendar className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">{t('admin.teachers.finances.noPayments')}</p>
                        <p className="text-xs text-gray-600 mt-1">{t('admin.teachers.finances.noPaymentsDesc')}</p>
                    </div>
                ) : (
                    <div className="bg-[#1A2530] rounded-3xl border border-white/5 overflow-hidden">
                        <div className="divide-y divide-white/5">
                            {payments.map(p => {
                                const isPaid = p.status === 'paid'
                                const isCancelled = p.status === 'cancelled'
                                const monthKey = MONTH_KEYS[(p.month || 1) - 1]
                                const monthName = t(`admin.payroll.months.${monthKey}`) || `Mois ${p.month}`

                                return (
                                    <div key={p.id} className="flex items-center gap-4 p-4 hover:bg-[#0F1720] transition-colors">
                                        <div className={cn(
                                            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border",
                                            isPaid ? "bg-emerald-500/10 border-emerald-500/20"
                                                : isCancelled ? "bg-red-500/10 border-red-500/20"
                                                : "bg-amber-500/10 border-amber-500/20"
                                        )}>
                                            {isPaid
                                                ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                                : isCancelled
                                                ? <XCircle className="w-4 h-4 text-red-400" />
                                                : <Clock className="w-4 h-4 text-amber-400" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-white capitalize">{monthName} {p.year}</p>
                                            <div className="flex items-center gap-3 mt-0.5">
                                                <span className="text-[10px] text-gray-500">
                                                    {t('admin.teachers.finances.base')}: {(p.base_salary || 0).toLocaleString('fr-FR')} MRU
                                                </span>
                                                {(p.bonuses || 0) > 0 && (
                                                    <span className="text-[10px] text-emerald-400">+{p.bonuses.toLocaleString('fr-FR')} {t('admin.teachers.finances.bonuses')}</span>
                                                )}
                                                {(p.deductions || 0) > 0 && (
                                                    <span className="text-[10px] text-red-400">-{p.deductions.toLocaleString('fr-FR')} {t('admin.teachers.finances.deductions')}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className={cn(
                                                "text-base font-black",
                                                isPaid ? "text-emerald-400" : isCancelled ? "text-red-400/60 line-through" : "text-amber-400"
                                            )}>
                                                {(p.net_salary || 0).toLocaleString('fr-FR')} MRU
                                            </p>
                                            <p className={cn(
                                                "text-[10px] font-bold uppercase",
                                                isPaid ? "text-emerald-500/70" : isCancelled ? "text-red-500/70" : "text-amber-500/70"
                                            )}>
                                                {t(`admin.teachers.finances.status_${p.status}`)}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
