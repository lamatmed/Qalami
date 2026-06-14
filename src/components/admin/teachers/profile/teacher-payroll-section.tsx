'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { getMySchoolContext } from '@/app/admin/actions'
import { confirmPaymentAction } from '@/app/admin/finance/payroll/actions'
import { getStaffAdjustmentsAction, getTeacherTransactionsAction } from '@/app/admin/teachers/actions'
import {
    Loader2, Clock, Trophy, AlertTriangle, CheckCircle2, FileText,
    CreditCard, ChevronDown, ChevronUp, Banknote,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Adjustment {
    id: string
    type: 'heures_sup' | 'prime' | 'deduction' | 'autre'
    description: string | null
    hours: number | null
    hourly_rate: number | null
    amount: number
    date: string
    is_included: boolean
}

const MONTH_FR = ['Janvier','Février','Mars','Avril','Mai','Juin',
    'Juillet','Août','Septembre','Octobre','Novembre','Décembre']

const OVERTIME_RATE = 400

export function TeacherPayrollSection({
    teacherId,
    onPayrollConfirmed,
}: {
    teacherId: string
    onPayrollConfirmed?: () => void
}) {
    const now = new Date()
    const month = now.getMonth() + 1
    const year  = now.getFullYear()
    const monthName = MONTH_FR[now.getMonth()]

    const [loading,       setLoading]       = useState(true)
    const [teacherName,   setTeacherName]   = useState('')
    const [teacherPhone,  setTeacherPhone]  = useState<string | null>(null)
    const [teacherNni,    setTeacherNni]    = useState<string | null>(null)
    const [schoolName,    setSchoolName]    = useState('')
    const [adminName,     setAdminName]     = useState('')
    const [baseSalary,    setBaseSalary]    = useState(0)
    const [contractType,  setContractType]  = useState<'fixed' | 'hourly'>('fixed')
    const [subject,       setSubject]       = useState<string | null>(null)
    const [isPaid,        setIsPaid]        = useState(false)
    const [paidNet,       setPaidNet]       = useState<number | null>(null)

    const [expanded,       setExpanded]       = useState(false)
    const [overtimeHours,  setOvertimeHours]  = useState(0)
    const [bonus,          setBonus]          = useState(0)
    const [adjustments,    setAdjustments]    = useState<Adjustment[]>([])
    const [showAdjDetail,  setShowAdjDetail]  = useState(false)
    const [absenceDays,    setAbsenceDays]    = useState(0)
    const [absencesLoading,setAbsencesLoading]= useState(true)
    const [includeAbsences,setIncludeAbsences]= useState(true)
    const [includeSocial,  setIncludeSocial]  = useState(false)
    const [socialAmount,   setSocialAmount]   = useState(0)
    const [excludedAdjIds,    setExcludedAdjIds]    = useState<Set<string>>(new Set())
    const [advances,          setAdvances]          = useState<{id: string, amount: number, description: string | null, transaction_date: string}[]>([])
    const [excludedAdvanceIds,setExcludedAdvanceIds]= useState<Set<string>>(new Set())
    const [paymentMethod,  setPaymentMethod]  = useState('especes')
    const [paymentNotes,   setPaymentNotes]   = useState('')
    const [confirming,     setConfirming]     = useState(false)
    const [generatingPdf,  setGeneratingPdf]  = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        const supabase = createClient()
        const ctx = await getMySchoolContext()
        const schoolId = ctx?.school_id
        if (!schoolId) { setLoading(false); return }

        const [profileRes, contractRes, payrollRes, settingsRes, authRes] = await Promise.all([
            supabase.from('profiles').select('full_name, phone, national_id').eq('id', teacherId).single(),
            supabase.from('contracts')
                .select('monthly_salary, contract_type, position')
                .eq('employee_id', teacherId).eq('school_id', schoolId).eq('status', 'active').maybeSingle(),
            supabase.from('payroll')
                .select('status, net_salary')
                .eq('employee_id', teacherId).eq('school_id', schoolId)
                .eq('month', month).eq('year', year).maybeSingle(),
            supabase.from('school_settings').select('name').eq('school_id', schoolId).maybeSingle(),
            supabase.auth.getUser(),
        ])

        if (authRes.data.user) {
            const { data: me } = await supabase
                .from('profiles').select('full_name').eq('id', authRes.data.user.id).single()
            if (me?.full_name) setAdminName(me.full_name)
        }
        if (profileRes.data) {
            setTeacherName(profileRes.data.full_name || '')
            setTeacherPhone(profileRes.data.phone || null)
            setTeacherNni(profileRes.data.national_id || null)
        }
        if (contractRes.data) {
            setBaseSalary(contractRes.data.monthly_salary || 0)
            setContractType(contractRes.data.contract_type === 'hourly' ? 'hourly' : 'fixed')
            setSubject(contractRes.data.position || null)
        }
        if (payrollRes.data?.status === 'paid') {
            setIsPaid(true)
            setPaidNet(payrollRes.data.net_salary)
        }
        if (settingsRes.data?.name) setSchoolName(settingsRes.data.name)

        setLoading(false)
    }, [teacherId, month, year])

    useEffect(() => { load() }, [load])

    useEffect(() => {
        getStaffAdjustmentsAction(teacherId).then(({ data }) => {
            const pending = ((data || []) as Adjustment[]).filter(a => !a.is_included)
            setAdjustments(pending)
        })
    }, [teacherId])

    useEffect(() => {
        async function fetchAbsences() {
            const supabase = createClient()
            const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`
            const endOfMonth   = new Date(year, month, 0).toISOString().split('T')[0]
            const { data } = await supabase
                .from('teacher_attendance').select('id')
                .eq('teacher_id', teacherId).eq('justified', false).eq('status', 'absent')
                .gte('date', startOfMonth).lte('date', endOfMonth)
            setAbsenceDays(data?.length ?? 0)
            setAbsencesLoading(false)
        }
        fetchAbsences()
    }, [teacherId, month, year])

    useEffect(() => {
        async function fetchAdvances() {
            const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`
            const endOfMonth   = new Date(year, month, 0).toISOString().split('T')[0]
            const res = await getTeacherTransactionsAction(teacherId)
            if (!res.error) {
                const monthAdvances = (res.data as {id: string, amount: number, category: string | null, description: string | null, transaction_date: string, status: string}[])
                    .filter(tx =>
                        tx.category === 'avance' &&
                        tx.transaction_date >= startOfMonth &&
                        tx.transaction_date <= endOfMonth &&
                        tx.status !== 'cancelled'
                    )
                setAdvances(monthAdvances)
            }
        }
        fetchAdvances()
    }, [teacherId, month, year])

    // ── Calculations ──────────────────────────────────────────────────────────
    const overtimeTotal      = overtimeHours * OVERTIME_RATE
    const adjOvertimeAmt     = adjustments.filter(a => a.type === 'heures_sup').reduce((s, a) => s + Number(a.amount), 0)
    const adjBonusAmt        = adjustments.filter(a => a.type === 'prime' || a.type === 'autre').reduce((s, a) => s + Number(a.amount), 0)
    const adjDeductionTotal  = adjustments
        .filter(a => a.type === 'deduction' && !excludedAdjIds.has(a.id))
        .reduce((s, a) => s + Number(a.amount), 0)
    const advanceTotal       = advances
        .filter(a => !excludedAdvanceIds.has(a.id))
        .reduce((s, a) => s + Number(a.amount), 0)
    const absencePerDay      = baseSalary > 0 ? baseSalary / 30 : 0
    const absenceDeduction   = includeAbsences ? Math.round(absenceDays * absencePerDay) : 0
    const socialDeduction    = includeSocial ? socialAmount : 0
    const grossSalary        = baseSalary + overtimeTotal + bonus + adjOvertimeAmt + adjBonusAmt
    const totalDeductions    = absenceDeduction + socialDeduction + adjDeductionTotal + advanceTotal
    const netSalary          = grossSalary - totalDeductions
    const journalNet         = adjOvertimeAmt + adjBonusAmt - adjDeductionTotal

    const toggleAdjDeduction = (id: string) => {
        setExcludedAdjIds(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    const toggleAdvance = (id: string) => {
        setExcludedAdvanceIds(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    // ── PDF bulletin ──────────────────────────────────────────────────────────
    const handleDownloadSlip = async () => {
        setGeneratingPdf(true)
        try {
            const { jsPDF } = await import('jspdf')
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
            const fmt = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
            const printDate = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
            const E: [number,number,number] = [16, 185, 129]
            const G: [number,number,number] = [107, 114, 128]
            const D: [number,number,number] = [31, 41, 55]
            const R: [number,number,number] = [239, 68, 68]

            doc.setDrawColor(...E); doc.setLineWidth(0.8); doc.rect(10, 10, 190, 275)
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(...E)
            doc.text(schoolName || 'QALAMI', 105, 28, { align: 'center' })
            doc.setFont('Helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...G)
            doc.text('Système de Gestion Scolaire', 105, 34, { align: 'center' })
            doc.setDrawColor(...E); doc.setLineWidth(0.4); doc.line(20, 37, 190, 37)
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...D)
            doc.text('BULLETIN DE PAIE', 105, 47, { align: 'center' })
            doc.setFont('Helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...G)
            doc.text(`Période : ${monthName} ${year}`, 105, 54, { align: 'center' })

            doc.setFillColor(249, 250, 251); doc.roundedRect(15, 59, 180, 44, 2, 2, 'F')
            const meta = (label: string, value: string, x: number, y: number) => {
                doc.setFont('Helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...G); doc.text(label, x, y)
                doc.setFont('Helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...D); doc.text(value, x + 28, y)
            }
            meta('Employé :', teacherName, 20, 68)
            meta('Téléphone :', teacherPhone || '--', 110, 68)
            meta('Poste :', subject || 'Enseignant', 20, 76)
            meta('Contrat :', contractType === 'hourly' ? 'Horaire' : 'Temps Plein', 110, 76)
            meta('NNI :', teacherNni || '--', 20, 84)
            meta('Date :', printDate, 110, 84)

            let y = 113
            const section = (title: string) => {
                doc.setFontSize(8); doc.setFont('Helvetica', 'bold'); doc.setTextColor(...G); doc.text(title, 15, y)
                doc.setDrawColor(229, 231, 235); doc.setLineWidth(0.2); doc.line(15, y + 2, 195, y + 2); y += 9
            }
            const row = (label: string, value: string, color: [number,number,number]) => {
                doc.setFont('Helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...D); doc.text(label, 15, y)
                doc.setFont('Helvetica', 'bold'); doc.setTextColor(...color); doc.text(value, 195, y, { align: 'right' })
                doc.setDrawColor(243, 244, 246); doc.setLineWidth(0.15); doc.line(15, y + 2, 195, y + 2); y += 10
            }

            section('RÉMUNÉRATION')
            row('Salaire de base', `${fmt(baseSalary)} MRU`, E)
            if (overtimeTotal > 0) row(`Heures supp. (${overtimeHours}h × ${OVERTIME_RATE} MRU/h)`, `+${fmt(overtimeTotal)} MRU`, E)
            if (bonus > 0) row('Prime', `+${fmt(bonus)} MRU`, E)
            if (adjOvertimeAmt > 0) row('Heures supp. (journal)', `+${fmt(adjOvertimeAmt)} MRU`, E)
            if (adjBonusAmt > 0) row('Primes (journal)', `+${fmt(adjBonusAmt)} MRU`, E)
            y += 3

            section('RETENUES')
            if (advanceTotal > 0) row(`Avance${advances.filter(a => !excludedAdvanceIds.has(a.id)).length > 1 ? 's' : ''} sur salaire`, `-${fmt(advanceTotal)} MRU`, R)
            if (absenceDeduction > 0) row(`Absences (${absenceDays} j × ${fmt(absencePerDay)} MRU/j)`, `-${fmt(absenceDeduction)} MRU`, R)
            if (socialDeduction > 0) row('Cotisation CNSS', `-${fmt(socialDeduction)} MRU`, R)
            if (adjDeductionTotal > 0) row('Déductions (journal)', `-${fmt(adjDeductionTotal)} MRU`, R)
            if (advanceTotal === 0 && absenceDeduction === 0 && socialDeduction === 0 && adjDeductionTotal === 0) {
                doc.setFont('Helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...G)
                doc.text('Aucune retenue', 15, y); y += 10
            }
            y += 5

            doc.setDrawColor(209, 250, 229); doc.setLineWidth(0.8); doc.line(15, y, 195, y); y += 9
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...D); doc.text('NET À PAYER', 15, y)
            doc.setFontSize(16); doc.setTextColor(...E); doc.text(`${fmt(netSalary)} MRU`, 195, y, { align: 'right' }); y += 20

            doc.setDrawColor(209, 213, 219); doc.setLineWidth(0.4)
            doc.line(20, y, 85, y); doc.line(115, y, 185, y); y += 6
            doc.setFont('Helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...G)
            doc.text('Employé', 52, y, { align: 'center' })
            doc.text('Administration', 150, y, { align: 'center' }); y += 5
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...D)
            doc.text(teacherName, 52, y, { align: 'center' })
            doc.text(adminName || 'Direction', 150, y, { align: 'center' }); y += 18

            doc.setDrawColor(243, 244, 246); doc.setLineWidth(0.2); doc.line(15, y, 195, y); y += 6
            doc.setFont('Helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(156, 163, 175)
            doc.text('Merci pour votre confiance', 105, y, { align: 'center' }); y += 4
            doc.text(`Généré le ${printDate} — ${schoolName || 'Qalami School Manager'}`, 105, y, { align: 'center' })

            const mStr = String(month).padStart(2, '0')
            doc.save(`bulletin-${teacherName.replace(/\s+/g, '-')}-${year}-${mStr}.pdf`)
            toast.success('Bulletin téléchargé')
        } catch {
            toast.error('Erreur lors de la génération du bulletin')
        } finally {
            setGeneratingPdf(false)
        }
    }

    // ── Confirm ───────────────────────────────────────────────────────────────
    const handleConfirm = async () => {
        if (netSalary < 0) { toast.error('Le net ne peut pas être négatif'); return }
        setConfirming(true)
        const ref = `PAY-${Date.now().toString(36).toUpperCase()}`
        const res = await confirmPaymentAction({
            employeeId: teacherId,
            employeeName: teacherName,
            baseSalary,
            bonuses: overtimeTotal + bonus + adjOvertimeAmt + adjBonusAmt,
            deductions: totalDeductions,
            netSalary,
            transactionRef: ref,
            notes: paymentNotes,
            paymentMethod,
        })
        setConfirming(false)
        if (res.error) { toast.error('Erreur : ' + res.error); return }
        toast.success(`Salaire de ${monthName} confirmé — ${netSalary.toLocaleString('fr-FR')} MRU`)
        setIsPaid(true)
        setPaidNet(netSalary)
        setExpanded(false)
        onPayrollConfirmed?.()
    }

    if (loading) return (
        <div className="bg-[#1A2530] rounded-3xl border border-white/5 flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
        </div>
    )

    if (!baseSalary) return null

    return (
        <div className="bg-[#1A2530] rounded-3xl border border-white/5 overflow-hidden">

            {/* ── Summary header ── */}
            <div className="p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                        isPaid ? 'bg-emerald-500/10' : 'bg-amber-500/10'
                    )}>
                        <Banknote className={cn('w-5 h-5', isPaid ? 'text-emerald-400' : 'text-amber-400')} />
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Paie du mois</p>
                        <p className="text-sm font-bold text-white">{monthName} {year}</p>
                        <p className="text-xs text-gray-600">{baseSalary.toLocaleString('fr-FR')} MRU base</p>
                    </div>
                </div>

                {isPaid ? (
                    <div className="flex items-center gap-2 text-right shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <div>
                            <p className="text-[10px] text-emerald-500/70 font-bold uppercase">Payé</p>
                            <p className="text-sm font-black text-emerald-400">{(paidNet || 0).toLocaleString('fr-FR')} MRU</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        {adjustments.length > 0 && (
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
                                Journal {journalNet >= 0 ? '+' : ''}{journalNet.toLocaleString('fr-FR')} MRU
                            </span>
                        )}
                        {advances.length > 0 && (
                            <span className="text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full font-bold">
                                Avance{advances.length > 1 ? 's' : ''} −{advances.reduce((s, a) => s + Number(a.amount), 0).toLocaleString('fr-FR')} MRU
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={() => setExpanded(v => !v)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl text-xs font-bold transition-colors"
                        >
                            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            {expanded ? 'Réduire' : 'Préparer la paie'}
                        </button>
                    </div>
                )}
            </div>

            {/* ── Expanded form ── */}
            {!isPaid && expanded && (
                <div className="border-t border-white/5 divide-y divide-white/5">

                    {/* Journal banner */}
                    {adjustments.length > 0 && (
                        <div className="px-5 py-3 bg-emerald-500/5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                                    <span className="text-xs font-bold text-emerald-400">
                                        Journal — {adjustments.length} entrée{adjustments.length > 1 ? 's' : ''} en attente
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowAdjDetail(v => !v)}
                                    className="text-xs text-emerald-500/60 hover:text-emerald-400 flex items-center gap-1"
                                >
                                    {showAdjDetail ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                    {showAdjDetail ? 'Masquer' : 'Détail'}
                                </button>
                            </div>
                            {showAdjDetail && (
                                <div className="mt-2 space-y-1">
                                    {adjustments.map(a => (
                                        <div key={a.id} className="flex justify-between text-xs">
                                            <span className="text-gray-400">
                                                {a.type === 'heures_sup' ? `Heures supp. (${a.hours}h)` :
                                                 a.type === 'prime'      ? 'Prime' :
                                                 a.type === 'deduction'  ? 'Déduction' : 'Autre'}
                                                {a.description ? ` — ${a.description}` : ''}
                                            </span>
                                            <span className={a.type === 'deduction' ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                                                {a.type === 'deduction' ? '−' : '+'}{Number(a.amount).toLocaleString('fr-FR')} MRU
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Variable components */}
                    <div className="p-5 space-y-3">
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Éléments variables</p>
                        <div className="grid grid-cols-2 gap-3">
                            {/* Overtime */}
                            <div className="bg-[#0F1720] rounded-2xl p-3 border border-white/5">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5 text-emerald-400" />
                                        Heures supp.
                                        {adjustments.some(a => a.type === 'heures_sup') && (
                                            <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1 rounded-full">JOURNAL</span>
                                        )}
                                    </span>
                                    <span className="text-xs font-bold text-emerald-400">+{overtimeTotal.toLocaleString('fr-FR')} MRU</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number" min="0" step="0.5" placeholder="0"
                                        value={overtimeHours === 0 ? '' : overtimeHours}
                                        onChange={e => setOvertimeHours(parseFloat(e.target.value) || 0)}
                                        className="flex-1 min-w-0 bg-[#1A2530] border border-white/10 text-white text-sm font-bold p-2 rounded-lg focus:outline-none focus:border-emerald-500"
                                    />
                                    <span className="text-[10px] text-gray-600 shrink-0">h × {OVERTIME_RATE}</span>
                                </div>
                            </div>
                            {/* Bonus */}
                            <div className="bg-[#0F1720] rounded-2xl p-3 border border-white/5">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
                                        <Trophy className="w-3.5 h-3.5 text-amber-400" /> Prime
                                    </span>
                                    <span className="text-xs font-bold text-emerald-400">+{bonus.toLocaleString('fr-FR')} MRU</span>
                                </div>
                                <input
                                    type="number" min="0" placeholder="0"
                                    value={bonus === 0 ? '' : bonus}
                                    onChange={e => setBonus(parseFloat(e.target.value) || 0)}
                                    className="w-full bg-[#1A2530] border border-white/10 text-white text-sm font-bold p-2 rounded-lg focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Deductions */}
                    <div className="p-5 space-y-3">
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Retenues</p>

                        {/* Absences */}
                        <div className={cn(
                            'flex items-center justify-between p-3 rounded-xl border transition-colors',
                            includeAbsences ? 'border-red-500/20 bg-red-500/5' : 'border-white/5 bg-white/[0.02] opacity-60'
                        )}>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIncludeAbsences(v => !v)}
                                    className={cn(
                                        'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                                        includeAbsences ? 'bg-red-500 border-red-500' : 'border-gray-600'
                                    )}
                                >
                                    {includeAbsences && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                                </button>
                                <div>
                                    <p className="text-sm font-bold text-white">Absences</p>
                                    {absencesLoading
                                        ? <p className="text-xs text-gray-500">Chargement...</p>
                                        : absenceDays === 0
                                        ? <p className="text-xs text-emerald-400">Aucune absence non justifiée</p>
                                        : <p className="text-xs text-gray-500">{absenceDays} j × {Math.round(absencePerDay).toLocaleString('fr-FR')} MRU/j</p>
                                    }
                                </div>
                            </div>
                            <span className={cn('font-bold text-sm shrink-0', includeAbsences && absenceDeduction > 0 ? 'text-red-400' : 'text-gray-600')}>
                                {absenceDeduction > 0 ? `-${absenceDeduction.toLocaleString('fr-FR')} MRU` : '—'}
                            </span>
                        </div>

                        {/* CNSS */}
                        <div className={cn(
                            'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                            includeSocial ? 'border-blue-500/20 bg-blue-500/5' : 'border-white/5 bg-white/[0.02] opacity-60'
                        )}>
                            <button
                                type="button"
                                onClick={() => setIncludeSocial(v => !v)}
                                className={cn(
                                    'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                                    includeSocial ? 'bg-blue-500 border-blue-500' : 'border-gray-600'
                                )}
                            >
                                {includeSocial && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                            </button>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-white">Cotisation CNSS</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <input
                                    type="number" min="0" placeholder="0"
                                    value={socialAmount === 0 ? '' : socialAmount}
                                    onChange={e => setSocialAmount(parseFloat(e.target.value) || 0)}
                                    className="w-20 bg-[#0F1720] border border-white/10 text-red-400 font-bold p-1.5 rounded-lg text-sm text-right focus:outline-none focus:border-blue-500"
                                />
                                <span className="text-gray-600 text-xs">MRU</span>
                            </div>
                        </div>

                        {/* Avances sur salaire du mois */}
                        {advances.map(a => {
                            const excluded = excludedAdvanceIds.has(a.id)
                            return (
                                <div key={a.id} className={cn(
                                    'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                                    !excluded ? 'border-orange-500/20 bg-orange-500/5' : 'border-white/5 bg-white/[0.02] opacity-60'
                                )}>
                                    <button
                                        type="button"
                                        onClick={() => toggleAdvance(a.id)}
                                        className={cn(
                                            'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                                            !excluded ? 'bg-orange-500 border-orange-500' : 'border-gray-600'
                                        )}
                                    >
                                        {!excluded && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-white">Avance sur salaire</p>
                                        <p className="text-xs text-gray-500">
                                            {new Date(a.transaction_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                            {a.description ? ` · ${a.description}` : ''}
                                        </p>
                                    </div>
                                    <span className="text-orange-400 font-bold text-sm shrink-0">−{Number(a.amount).toLocaleString('fr-FR')} MRU</span>
                                </div>
                            )
                        })}

                        {/* Per-journal-deduction toggles */}
                        {adjustments.filter(a => a.type === 'deduction').map(a => {
                            const excluded = excludedAdjIds.has(a.id)
                            return (
                                <div key={a.id} className={cn(
                                    'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                                    !excluded ? 'border-red-500/20 bg-red-500/5' : 'border-white/5 bg-white/[0.02] opacity-60'
                                )}>
                                    <button
                                        type="button"
                                        onClick={() => toggleAdjDeduction(a.id)}
                                        className={cn(
                                            'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                                            !excluded ? 'bg-red-500 border-red-500' : 'border-gray-600'
                                        )}
                                    >
                                        {!excluded && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-white">{a.description || 'Déduction'}</p>
                                        <p className="text-xs text-gray-500">
                                            {new Date(a.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · Journal
                                        </p>
                                    </div>
                                    <span className="text-red-400 font-bold text-sm shrink-0">-{Number(a.amount).toLocaleString('fr-FR')} MRU</span>
                                </div>
                            )
                        })}
                    </div>

                    {/* Payment method + notes */}
                    <div className="p-5 space-y-3">
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5" /> Paiement
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <select
                                value={paymentMethod}
                                onChange={e => setPaymentMethod(e.target.value)}
                                className="bg-[#0F1720] border border-white/10 text-white p-2.5 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                            >
                                <option value="especes">Espèces</option>
                                <option value="virement">Virement bancaire</option>
                                <option value="cheque">Chèque</option>
                                <option value="wave">Wave</option>
                                <option value="bankily">Bankily</option>
                                <option value="masrvi">Masrvi</option>
                            </select>
                            <input
                                type="text"
                                placeholder="Remarque (optionnel)"
                                value={paymentNotes}
                                onChange={e => setPaymentNotes(e.target.value)}
                                className="bg-[#0F1720] border border-white/10 text-white p-2.5 rounded-xl text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500"
                            />
                        </div>
                    </div>

                    {/* Footer — net + actions */}
                    <div className="p-5 bg-[#0F1720]/60">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-500">Brut</span>
                            <span className="text-sm font-bold text-white">{grossSalary.toLocaleString('fr-FR')} MRU</span>
                        </div>
                        <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
                            <span className="text-xs text-red-400">Retenues</span>
                            <span className="text-sm font-bold text-red-400">−{totalDeductions.toLocaleString('fr-FR')} MRU</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase font-bold mb-0.5">Net à payer</p>
                                <p className="text-2xl font-black text-white">
                                    {netSalary.toLocaleString('fr-FR')}
                                    <span className="text-sm text-emerald-400 font-bold ml-1.5">MRU</span>
                                </p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={handleDownloadSlip}
                                    disabled={generatingPdf}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                                >
                                    {generatingPdf
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        : <FileText className="w-3.5 h-3.5" />}
                                    Bulletin PDF
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirm}
                                    disabled={confirming || netSalary < 0}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 shadow-lg shadow-emerald-900/30"
                                >
                                    {confirming
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        : <CheckCircle2 className="w-3.5 h-3.5" />}
                                    Confirmer le versement
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
