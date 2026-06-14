'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Wallet, Clock, Trophy, AlertTriangle, FileText, CheckCircle2, Loader2, ChevronDown, ChevronUp, MessageSquare, CreditCard } from 'lucide-react'
import { useLanguage } from '@/i18n'
import { createClient } from '@/utils/supabase/client'
import { getStaffAdjustmentsAction, getTeacherTransactionsAction } from '@/app/admin/teachers/actions'
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
}

export function SalaryDetails({ teacher, onBack, onValidate }: {
    teacher: any
    onBack: () => void
    onValidate: (data: {
        netSalary: number
        baseSalary: number
        bonuses: number
        deductions: number
        notes: string
        paymentMethod: string
    }) => void
}) {
    const { t } = useLanguage()
    const [overtimeHours, setOvertimeHours]   = useState(0)
    const [bonus, setBonus]                   = useState(0)
    const [schoolName, setSchoolName]         = useState('')
    const [adminName, setAdminName]           = useState('')
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
    const [adjustments, setAdjustments]       = useState<Adjustment[]>([])
    const [showAdjDetail, setShowAdjDetail]   = useState(false)

    // Absence data from DB (current month)
    const [absenceDays, setAbsenceDays]           = useState(0)
    const [absencesLoading, setAbsencesLoading]   = useState(true)

    // Deduction toggles
    const [includeAbsences, setIncludeAbsences]   = useState(true)
    const [includeSocial, setIncludeSocial]       = useState(true)
    const [socialAmount, setSocialAmount]         = useState(0)
    const [excludedAdjIds, setExcludedAdjIds]     = useState<Set<string>>(new Set())

    // Salary advances
    const [advances, setAdvances]                 = useState<{id: string, amount: number, description: string | null, transaction_date: string}[]>([])
    const [excludedAdvanceIds, setExcludedAdvanceIds] = useState<Set<string>>(new Set())

    // Payment details
    const [paymentNotes, setPaymentNotes]         = useState('')
    const [paymentMethod, setPaymentMethod]       = useState('especes')

    const now = new Date()
    const monthKeys = ['january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december']
    const monthName = t(`admin.payroll.months.${monthKeys[now.getMonth()]}`)
    const year = now.getFullYear()

    // The correct profile ID is always employeeId, not id (which may be the payroll record UUID)
    const profileId = teacher?.employeeId || teacher?.id

    useEffect(() => {
        async function loadSchoolInfo() {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const { data: profile } = await supabase.from('profiles').select('school_id, full_name').eq('id', user.id).single()
            if (profile?.full_name) setAdminName(profile.full_name)
            if (!profile?.school_id) return
            const { data: settings } = await supabase.from('school_settings').select('name').eq('school_id', profile.school_id).maybeSingle()
            let sName = settings?.name || null
            if (!sName) {
                const { data: school } = await supabase.from('schools').select('name').eq('id', profile.school_id).maybeSingle()
                sName = school?.name || null
            }
            if (sName) setSchoolName(sName)
        }
        loadSchoolInfo()
    }, [])

    // Load pending journal entries
    useEffect(() => {
        if (!profileId) return
        getStaffAdjustmentsAction(String(profileId)).then(({ data }) => {
            const pending = ((data as Adjustment[]) || []).filter(a => !a.is_included)
            setAdjustments(pending)
            // Default all adj deductions to included
            const deductionIds = new Set(pending.filter(a => a.type === 'deduction').map(a => a.id))
            setExcludedAdjIds(new Set()) // none excluded by default
        })
    }, [profileId])

    // Fetch salary advances for current month
    useEffect(() => {
        if (!profileId) return
        async function fetchAdvances() {
            const startOfMonth = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
            const endOfMonth   = new Date(year, now.getMonth() + 1, 0).toISOString().split('T')[0]
            const res = await getTeacherTransactionsAction(String(profileId))
            if (!res.error) {
                const monthAdvances = (res.data as any[]).filter(tx =>
                    tx.category === 'avance' &&
                    tx.transaction_date >= startOfMonth &&
                    tx.transaction_date <= endOfMonth &&
                    tx.status !== 'cancelled'
                )
                setAdvances(monthAdvances)
            }
        }
        fetchAdvances()
    }, [profileId])

    // Fetch actual unjustified absences for current month
    useEffect(() => {
        async function fetchAbsences() {
            if (!profileId) { setAbsencesLoading(false); return }
            const supabase = createClient()
            const startOfMonth = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
            const endOfMonth = new Date(year, now.getMonth() + 1, 0).toISOString().split('T')[0]
            const { data } = await supabase
                .from('teacher_attendance')
                .select('id')
                .eq('teacher_id', profileId)
                .eq('justified', false)
                .eq('status', 'absent')
                .gte('date', startOfMonth)
                .lte('date', endOfMonth)
            setAbsenceDays(data?.length ?? 0)
            setAbsencesLoading(false)
        }
        fetchAbsences()
    }, [profileId])

    // ─── Calculations ────────────────────────────────────────────────────────────
    const overtimeRate   = 400
    const overtimeTotal  = overtimeHours * overtimeRate

    const adjOvertimeAmount = adjustments.filter(a => a.type === 'heures_sup').reduce((s, a) => s + Number(a.amount), 0)
    const adjBonusAmount    = adjustments.filter(a => a.type === 'prime' || a.type === 'autre').reduce((s, a) => s + Number(a.amount), 0)
    const adjDeductionTotal = adjustments
        .filter(a => a.type === 'deduction' && !excludedAdjIds.has(a.id))
        .reduce((s, a) => s + Number(a.amount), 0)

    const baseSalary       = teacher?.base ?? 0
    const absencePerDay    = baseSalary > 0 ? baseSalary / 30 : 0
    const absenceDeduction = includeAbsences ? Math.round(absenceDays * absencePerDay) : 0
    const socialDeduction  = includeSocial ? socialAmount : 0

    const advanceTotal    = advances
        .filter(a => !excludedAdvanceIds.has(a.id))
        .reduce((s, a) => s + Number(a.amount), 0)

    const grossSalary     = baseSalary + overtimeTotal + bonus + adjOvertimeAmount + adjBonusAmount
    const totalDeductions = absenceDeduction + socialDeduction + adjDeductionTotal + advanceTotal
    const netSalary       = grossSalary - totalDeductions

    const handleDownloadSlip = async () => {
        setIsGeneratingPdf(true)
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
            doc.text(schoolName || 'ECOLE QALAMI', 105, 28, { align: 'center' })
            doc.setFont('Helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...G)
            doc.text('Systeme de Gestion Scolaire', 105, 34, { align: 'center' })
            doc.setDrawColor(...E); doc.setLineWidth(0.4); doc.line(20, 37, 190, 37)
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...D)
            doc.text('BULLETIN DE PAIE', 105, 47, { align: 'center' })
            doc.setFont('Helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...G)
            doc.text(`Periode : ${monthName} ${year}`, 105, 54, { align: 'center' })
            doc.setFillColor(249, 250, 251); doc.roundedRect(15, 59, 180, 44, 2, 2, 'F')
            const metaRow = (label: string, value: string, x: number, y: number) => {
                doc.setFont('Helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...G); doc.text(label, x, y)
                doc.setFont('Helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...D); doc.text(String(value), x + 28, y)
            }
            metaRow('Employe :', teacher.name, 20, 68)
            metaRow('Telephone :', teacher.phone || '--', 110, 68)
            metaRow('Poste :', teacher.subject || '--', 20, 76)
            metaRow('Contrat :', teacher.contractType === 'hourly' ? 'Horaire' : 'Temps Plein', 110, 76)
            metaRow('NNI :', teacher.nni || '--', 20, 84)
            metaRow('Date :', printDate, 110, 84)
            doc.setFillColor(209, 250, 229); doc.roundedRect(110, 87, 20, 6, 1.5, 1.5, 'F')
            doc.setFontSize(7.5); doc.setFont('Helvetica', 'bold'); doc.setTextColor(6, 95, 70)
            doc.text('EN COURS', 120, 91.5, { align: 'center' })
            let y = 113
            const section = (title: string) => {
                doc.setFontSize(8); doc.setFont('Helvetica', 'bold'); doc.setTextColor(...G); doc.text(title, 15, y)
                doc.setDrawColor(229, 231, 235); doc.setLineWidth(0.2); doc.line(15, y + 2, 195, y + 2); y += 9
            }
            const tableRow = (label: string, amount: string, color: [number,number,number]) => {
                doc.setFont('Helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...D); doc.text(label, 15, y)
                doc.setFont('Helvetica', 'bold'); doc.setTextColor(...color); doc.text(amount, 195, y, { align: 'right' })
                doc.setDrawColor(243, 244, 246); doc.setLineWidth(0.15); doc.line(15, y + 2, 195, y + 2); y += 10
            }
            section('REMUNERATION')
            tableRow('Salaire de base', `${fmt(baseSalary)} MRU`, E)
            if (overtimeTotal > 0) tableRow(`Heures supp. (${overtimeHours}h x ${overtimeRate} MRU/h)`, `+${fmt(overtimeTotal)} MRU`, E)
            if (bonus > 0) tableRow("Prime", `+${fmt(bonus)} MRU`, E)
            if (adjOvertimeAmount > 0) tableRow(`Heures supp. journal`, `+${fmt(adjOvertimeAmount)} MRU`, E)
            if (adjBonusAmount > 0) tableRow('Primes journal', `+${fmt(adjBonusAmount)} MRU`, E)
            y += 3
            section('RETENUES')
            if (absenceDeduction > 0) tableRow(`Absences (${absenceDays} j × ${fmt(absencePerDay)} MRU/j)`, `-${fmt(absenceDeduction)} MRU`, R)
            if (socialDeduction > 0) tableRow('Cotisation CNSS', `-${fmt(socialDeduction)} MRU`, R)
            if (adjDeductionTotal > 0) tableRow('Déductions journal', `-${fmt(adjDeductionTotal)} MRU`, R)
            if (advanceTotal > 0) tableRow('Avances sur salaire', `-${fmt(advanceTotal)} MRU`, R)
            if (absenceDeduction === 0 && socialDeduction === 0 && adjDeductionTotal === 0 && advanceTotal === 0) {
                doc.setFont('Helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...G)
                doc.text('Aucune retenue', 15, y); y += 10
            }
            y += 5
            doc.setDrawColor(209, 250, 229); doc.setLineWidth(0.8); doc.line(15, y, 195, y); y += 9
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...D); doc.text('NET A PAYER', 15, y)
            doc.setFontSize(16); doc.setTextColor(...E); doc.text(`${fmt(netSalary)} MRU`, 195, y, { align: 'right' }); y += 20
            doc.setDrawColor(209, 213, 219); doc.setLineWidth(0.4)
            doc.line(20, y, 85, y); doc.line(115, y, 185, y); y += 6
            doc.setFont('Helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...G)
            doc.text('Employe', 52, y, { align: 'center' }); doc.text('Administration', 150, y, { align: 'center' }); y += 5
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...D)
            doc.text(teacher.name, 52, y, { align: 'center' }); doc.text(adminName || 'Directeur', 150, y, { align: 'center' }); y += 18
            doc.setDrawColor(243, 244, 246); doc.setLineWidth(0.2); doc.line(15, y, 195, y); y += 6
            doc.setFont('Helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(156, 163, 175)
            doc.text('Merci pour votre confiance', 105, y, { align: 'center' }); y += 4
            doc.text(`Genere le ${printDate} - ${schoolName || 'Qalami School Manager'}`, 105, y, { align: 'center' })
            const monthNum = String(now.getMonth() + 1).padStart(2, '0')
            doc.save(`bulletin-${teacher.name.replace(/\s+/g, '-')}-${year}-${monthNum}.pdf`)
        } finally {
            setIsGeneratingPdf(false)
        }
    }

    const toggleAdjDeduction = (id: string) => {
        setExcludedAdjIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id); else next.add(id)
            return next
        })
    }

    const toggleAdvance = (id: string) => {
        setExcludedAdvanceIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id); else next.add(id)
            return next
        })
    }

    return (
        <div className="space-y-6 animate-in slide-in-from-right duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={onBack} className="text-gray-400 hover:text-white -ml-2 gap-2">
                    <ArrowLeft className="w-4 h-4" /> {t('admin.payroll.back')}
                </Button>
                <div className="flex items-center gap-2 bg-[#1A2530] px-3 py-1.5 rounded-full border border-white/5">
                    <CalendarIcon className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-xs font-bold text-white">{monthName} {year}</span>
                </div>
            </div>

            {/* Profile Card */}
            <div className="bg-[#1A2530] rounded-3xl border border-white/5 p-6 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                <div className="relative">
                    <div className="h-20 w-20 rounded-full bg-gray-700 flex items-center justify-center text-2xl font-bold text-white shadow-xl border-4 border-[#0F1720]">
                        {teacher.name.charAt(0)}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-[#1A2530] ${teacher.isPaid ? 'bg-emerald-500 text-black' : 'bg-orange-500 text-black'}`}>
                        {teacher.isPaid ? 'PAYÉ' : t('admin.payroll.pendingStatusUpper')}
                    </div>
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-white">{teacher.name}</h2>
                    <p className="text-gray-400 text-sm">{teacher.subject}</p>
                </div>
                <div className="sm:ml-auto bg-[#0F1720] rounded-2xl p-4 border border-white/5 min-w-[200px]">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-500">
                            <Wallet className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase font-bold">{t('admin.payroll.baseSalary')}</p>
                            {baseSalary > 0 ? (
                                <p className="text-white font-bold">{baseSalary.toLocaleString()} <span className="text-xs font-normal text-gray-500">MRU</span></p>
                            ) : (
                                <p className="text-amber-400 font-bold text-sm">Non configuré</p>
                            )}
                        </div>
                    </div>
                    <Badge variant="outline" className="w-full justify-center bg-white/5 border-white/10 text-gray-400 font-normal py-1">
                        {teacher.contractType === 'hourly' ? t('admin.payroll.hourlyContract') : t('admin.payroll.fullTimeContract')}
                    </Badge>
                </div>
            </div>

            {/* Journal summary banner */}
            {adjustments.length > 0 && (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                                Journal pré-chargé — {adjustments.length} entrée{adjustments.length > 1 ? 's' : ''}
                            </span>
                        </div>
                        <button type="button" onClick={() => setShowAdjDetail(!showAdjDetail)} className="flex items-center gap-1 text-xs text-emerald-500/70 hover:text-emerald-400 transition-colors">
                            {showAdjDetail ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            {showAdjDetail ? 'Masquer' : 'Détail'}
                        </button>
                    </div>
                    {showAdjDetail && (
                        <div className="space-y-1 mt-2">
                            {adjustments.map(a => (
                                <div key={a.id} className="flex justify-between text-xs">
                                    <span className="text-gray-400">
                                        {a.type === 'heures_sup' ? `Heures supp. (${a.hours}h)` : a.type === 'prime' ? 'Prime' : a.type === 'deduction' ? 'Déduction' : 'Autre'}
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

            {/* Variable Components */}
            <div className="bg-[#1A2530] rounded-3xl border border-white/5 overflow-hidden">
                <div className="p-4 bg-[#0F1720]/50 border-b border-white/5">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">{t('admin.payroll.variableComponents')}</h3>
                </div>
                <div className="p-6 space-y-6">
                    {/* Overtime */}
                    <div className="bg-[#0F1720] rounded-2xl p-4 border border-white/5 hover:border-emerald-500/30 transition-colors">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-emerald-500" />
                                <span className="font-bold text-white">{t('admin.payroll.overtime')}</span>
                                {adjustments.some(a => a.type === 'heures_sup') && (
                                    <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full font-bold">JOURNAL</span>
                                )}
                            </div>
                            <span className="text-emerald-500 font-bold">+{overtimeTotal.toLocaleString()} MRU</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <input
                                type="number"
                                aria-label={t('admin.payroll.overtime')}
                                min="0"
                                step="any"
                                value={overtimeHours === 0 ? '' : overtimeHours}
                                placeholder="0"
                                onChange={(e) => setOvertimeHours(parseFloat(e.target.value) || 0)}
                                className="flex-1 bg-[#1A2530] border border-white/10 text-white font-bold p-3 rounded-xl focus:outline-none focus:border-emerald-500"
                            />
                            <span className="text-gray-500 text-sm shrink-0">h × {overtimeRate} MRU/h</span>
                        </div>
                    </div>

                    {/* Bonus */}
                    <div className="bg-[#0F1720] rounded-2xl p-4 border border-white/5 hover:border-emerald-500/30 transition-colors">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2">
                                <Trophy className="w-4 h-4 text-emerald-500" />
                                <span className="font-bold text-white">{t('admin.payroll.excellenceBonus')}</span>
                            </div>
                            <span className="text-emerald-500 font-bold">+{bonus.toLocaleString()} MRU</span>
                        </div>
                        <input
                            type="number"
                            aria-label={t('admin.payroll.excellenceBonus')}
                            min="0"
                            step="any"
                            value={bonus === 0 ? '' : bonus}
                            placeholder="0"
                            onChange={(e) => setBonus(parseFloat(e.target.value) || 0)}
                            className="w-full bg-[#1A2530] border border-white/10 text-white font-bold p-3 rounded-xl focus:outline-none focus:border-emerald-500"
                        />
                    </div>
                </div>
            </div>

            {/* Deductions */}
            <div className="bg-[#1A2530] rounded-3xl border border-white/5 overflow-hidden">
                <div className="p-4 bg-[#0F1720]/50 border-b border-white/5">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">{t('admin.payroll.deductions')}</h3>
                    <p className="text-[11px] text-gray-600 mt-0.5">Décochez les éléments à ne pas prendre en compte</p>
                </div>
                <div className="p-6 space-y-4">
                    {/* Absences */}
                    <div className={cn(
                        "flex items-center justify-between p-3 rounded-xl border transition-colors",
                        includeAbsences ? "border-red-500/20 bg-red-500/5" : "border-white/5 bg-white/[0.02] opacity-60"
                    )}>
                        <div className="flex items-center gap-4">
                            <button
                                type="button"
                                onClick={() => setIncludeAbsences(v => !v)}
                                className={cn(
                                    "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                                    includeAbsences ? "bg-red-500 border-red-500" : "border-gray-600"
                                )}
                                title={includeAbsences ? 'Décocher' : 'Cocher'}
                            >
                                {includeAbsences && <CheckCircle2 className="w-3 h-3 text-white" />}
                            </button>
                            <div className="bg-red-500/10 p-2.5 rounded-xl text-red-500">
                                <CalendarIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-white font-bold text-sm">{t('admin.payroll.absences')}</p>
                                {absencesLoading ? (
                                    <p className="text-xs text-gray-500">Chargement...</p>
                                ) : absenceDays === 0 ? (
                                    <p className="text-xs text-emerald-400">Aucune absence ce mois-ci</p>
                                ) : (
                                    <p className="text-xs text-gray-500">{absenceDays} absence{absenceDays > 1 ? 's' : ''} non justifiée{absenceDays > 1 ? 's' : ''} × {Math.round(absencePerDay).toLocaleString('fr-FR')} MRU/j</p>
                                )}
                            </div>
                        </div>
                        <span className={cn("font-bold text-sm", includeAbsences && absenceDeduction > 0 ? "text-red-400" : "text-gray-600")}>
                            {absenceDeduction > 0 ? `-${absenceDeduction.toLocaleString()} MRU` : '—'}
                        </span>
                    </div>

                    {/* Social cotisation */}
                    <div className={cn(
                        "flex items-center gap-4 p-3 rounded-xl border transition-colors",
                        includeSocial ? "border-blue-500/20 bg-blue-500/5" : "border-white/5 bg-white/[0.02] opacity-60"
                    )}>
                        <button
                            type="button"
                            onClick={() => setIncludeSocial(v => !v)}
                            className={cn(
                                "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                                includeSocial ? "bg-blue-500 border-blue-500" : "border-gray-600"
                            )}
                            title={includeSocial ? 'Décocher' : 'Cocher'}
                        >
                            {includeSocial && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </button>
                        <div className="bg-blue-500/10 p-2.5 rounded-xl text-blue-500 shrink-0">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-white font-bold text-sm">{t('admin.payroll.socialContribution')}</p>
                            <p className="text-xs text-gray-500">{t('admin.payroll.socialContributionSub')}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <input
                                type="number"
                                min="0"
                                step="any"
                                value={socialAmount === 0 ? '' : socialAmount}
                                placeholder="0"
                                onChange={(e) => setSocialAmount(parseFloat(e.target.value) || 0)}
                                className="w-24 bg-[#0F1720] border border-white/10 text-red-400 font-bold p-1.5 rounded-lg text-sm text-right focus:outline-none focus:border-blue-500"
                            />
                            <span className="text-gray-600 text-xs">MRU</span>
                        </div>
                    </div>

                    {/* Journal deductions (individually toggleable) */}
                    {adjustments.filter(a => a.type === 'deduction').map(a => {
                        const excluded = excludedAdjIds.has(a.id)
                        return (
                            <div key={a.id} className={cn(
                                "flex items-center gap-4 p-3 rounded-xl border transition-colors",
                                !excluded ? "border-red-500/20 bg-red-500/5" : "border-white/5 bg-white/[0.02] opacity-60"
                            )}>
                                <button
                                    type="button"
                                    onClick={() => toggleAdjDeduction(a.id)}
                                    className={cn(
                                        "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                                        !excluded ? "bg-red-500 border-red-500" : "border-gray-600"
                                    )}
                                    title={excluded ? 'Inclure' : 'Exclure'}
                                >
                                    {!excluded && <CheckCircle2 className="w-3 h-3 text-white" />}
                                </button>
                                <div className="bg-red-500/10 p-2.5 rounded-xl text-red-500 shrink-0">
                                    <AlertTriangle className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-bold text-sm">{a.description || 'Déduction'}</p>
                                    <p className="text-xs text-gray-500">
                                        {new Date(a.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · Journal
                                    </p>
                                </div>
                                <span className="text-red-400 font-bold text-sm shrink-0">-{Number(a.amount).toLocaleString('fr-FR')} MRU</span>
                            </div>
                        )
                    })}

                    {/* Salary advances (individually toggleable) */}
                    {advances.map(a => {
                        const excluded = excludedAdvanceIds.has(a.id)
                        return (
                            <div key={a.id} className={cn(
                                "flex items-center gap-4 p-3 rounded-xl border transition-colors",
                                !excluded ? "border-orange-500/20 bg-orange-500/5" : "border-white/5 bg-white/[0.02] opacity-60"
                            )}>
                                <button
                                    type="button"
                                    onClick={() => toggleAdvance(a.id)}
                                    className={cn(
                                        "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                                        !excluded ? "bg-orange-500 border-orange-500" : "border-gray-600"
                                    )}
                                    title={excluded ? 'Inclure' : 'Exclure'}
                                >
                                    {!excluded && <CheckCircle2 className="w-3 h-3 text-white" />}
                                </button>
                                <div className="bg-orange-500/10 p-2.5 rounded-xl text-orange-500 shrink-0">
                                    <Wallet className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-bold text-sm">{a.description || 'Avance sur salaire'}</p>
                                    <p className="text-xs text-gray-500">
                                        {new Date(a.transaction_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · Avance
                                    </p>
                                </div>
                                <span className="text-orange-400 font-bold text-sm shrink-0">-{Number(a.amount).toLocaleString('fr-FR')} MRU</span>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Payment Details */}
            <div className="bg-[#1A2530] rounded-3xl border border-white/5 overflow-hidden">
                <div className="p-4 bg-[#0F1720]/50 border-b border-white/5">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Détails du paiement</h3>
                </div>
                <div className="p-6 space-y-4">
                    {/* Payment method */}
                    <div>
                        <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider block mb-2">
                            <CreditCard className="w-3.5 h-3.5 inline mr-1.5" />
                            Moyen de paiement
                        </label>
                        <select
                            value={paymentMethod}
                            onChange={e => setPaymentMethod(e.target.value)}
                            className="w-full bg-[#0F1720] border border-white/10 text-white p-3 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                        >
                            <option value="especes">Espèces</option>
                            <option value="virement">Virement bancaire</option>
                            <option value="cheque">Chèque</option>
                            <option value="wave">Wave</option>
                            <option value="bankily">Bankily</option>
                            <option value="masrvi">Masrvi</option>
                            <option value="autre">Autre</option>
                        </select>
                    </div>
                    {/* Notes */}
                    <div>
                        <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider block mb-2">
                            <MessageSquare className="w-3.5 h-3.5 inline mr-1.5" />
                            Remarque / Description
                        </label>
                        <textarea
                            value={paymentNotes}
                            onChange={e => setPaymentNotes(e.target.value)}
                            placeholder="Ajouter une remarque optionnelle sur ce paiement..."
                            rows={3}
                            className="w-full bg-[#0F1720] border border-white/10 text-white p-3 rounded-xl text-sm resize-none focus:outline-none focus:border-emerald-500 placeholder:text-gray-600"
                        />
                    </div>
                </div>
            </div>

            {/* Footer Summary */}
            <div className="bg-[#1A2530] rounded-3xl border border-white/10 p-6 sticky bottom-4 shadow-2xl">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-300 text-sm font-medium">{t('admin.payroll.totalGross')}</span>
                    <span className="text-white font-bold text-sm">{grossSalary.toLocaleString()} <span className="text-gray-400 font-normal">MRU</span></span>
                </div>
                <div className="flex items-center justify-between mb-5 pb-5 border-b border-white/10">
                    <span className="text-red-400 text-sm font-medium">{t('admin.payroll.totalDeductions')}</span>
                    <span className="text-red-400 font-bold text-sm">-{totalDeductions.toLocaleString()} <span className="font-normal">MRU</span></span>
                </div>
                <div className="flex items-center justify-between gap-6">
                    <div>
                        <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">{t('admin.payroll.netToPayUpper')}</p>
                        <h2 className="text-3xl font-black text-white">{netSalary.toLocaleString()} <span className="text-lg text-emerald-400 font-bold">MRU</span></h2>
                    </div>
                    <div className="flex gap-3">
                        <Button type="button" variant="outline" onClick={handleDownloadSlip} disabled={isGeneratingPdf} className="border-white/20 text-white hover:bg-white/10 bg-[#0F1720] h-12 px-6 font-semibold disabled:opacity-70">
                            {isGeneratingPdf
                                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> PDF...</>
                                : <><FileText className="w-4 h-4 mr-2" /> {t('admin.payroll.slip')}</>
                            }
                        </Button>
                        {teacher.isPaid ? (
                            <Button disabled className="bg-emerald-500/20 text-emerald-400 font-bold h-12 px-8 cursor-not-allowed opacity-70">
                                <CheckCircle2 className="w-4 h-4 mr-2" /> Déjà payé ce mois
                            </Button>
                        ) : (
                            <Button
                                onClick={() => onValidate({
                                    netSalary,
                                    baseSalary,
                                    bonuses: overtimeTotal + bonus + adjOvertimeAmount + adjBonusAmount,
                                    deductions: totalDeductions,
                                    notes: paymentNotes,
                                    paymentMethod,
                                })}
                                className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold h-12 px-8 shadow-lg shadow-emerald-900/30"
                            >
                                <CheckCircle2 className="w-4 h-4 mr-2" /> {t('admin.payroll.validate')}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

function CalendarIcon(props: any) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
        </svg>
    )
}
