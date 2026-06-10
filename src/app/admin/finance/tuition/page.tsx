'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Loader2, Search, Download, AlertCircle, CheckCircle, Clock, TrendingUp, Users, CreditCard, Bell, Calendar, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n'
import { notifyLateParentAction } from '@/app/admin/actions'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaymentRow {
    id: string
    student_id: string
    student_name: string
    class_name: string | null
    payment_type: string
    amount: number
    amount_paid: number
    status: string
    due_date: string | null
    paid_at: string | null
    academic_year_id: string | null
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ElementType }> = {
    paid: { color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle },
    partial: { color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', icon: Clock },
    pending: { color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', icon: Clock },
    overdue: { color: 'text-red-400 bg-red-500/10 border-red-500/20', icon: AlertCircle },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TuitionPage() {
    const { t, language } = useLanguage()

    const formatDateTime = (dateStr: string) => {
        const locale = language === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR'
        const d = new Date(dateStr)
        return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
            + ' · '
            + d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    }

    const formatDateOnly = (dateStr: string) => {
        const locale = language === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR'
        return new Date(dateStr).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
    }
    const [payments, setPayments] = useState<PaymentRow[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filterStatus, setFilterStatus] = useState('all')
    const [filterType, setFilterType] = useState('all')
    const [filterClass, setFilterClass] = useState('all')
    const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
    const [currentAcademicYear, setCurrentAcademicYear] = useState<string | null>(null)
    
    const [activeTab, setActiveTab] = useState<'all' | 'late'>('all')
    const [notifyingIds, setNotifyingIds] = useState<Record<string, boolean>>({})
    const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null)

    const handleViewPdf = async (p: PaymentRow) => {
        setGeneratingPdfId(p.id)
        try {
            // Fetch student NNI + phone
            const supabase = createClient()
            const { data: profile } = await supabase
                .from('profiles')
                .select('national_id, phone')
                .eq('id', p.student_id)
                .maybeSingle()

            const { jsPDF } = await import('jspdf')

            const W = 80
            const ml = 6
            const mr = W - 6
            const cx = W / 2
            const fmt = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
            const BK: [number,number,number] = [10, 10, 10]
            const GR: [number,number,number] = [150, 150, 150]

            const hline = (yPos: number, thick = 0.3) => {
                doc.setDrawColor(...BK); doc.setLineWidth(thick)
                doc.line(ml, yPos, mr, yPos)
            }

            const statusLabel = p.status === 'paid' ? 'PAYE' :
                                p.status === 'partial' ? 'PARTIEL' :
                                p.status === 'overdue' ? 'EN RETARD' : 'EN ATTENTE'

            const paymentTypeLabel: Record<string, string> = {
                scolarite: 'Scolarité', inscription: 'Inscription', bus: 'Transport',
                cantine: 'Cantine', activites: 'Activités'
            }
            const typeLabel = paymentTypeLabel[p.payment_type] ?? p.payment_type
            const printDate = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
            const shortId = p.id.slice(0, 8).toUpperCase()
            const remaining = p.amount - p.amount_paid

            let estimatedH = 215
            if (profile?.national_id || profile?.phone) estimatedH += 20

            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [W, estimatedH] })
            let y = 11

            // ─── Header
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...BK)
            doc.text('QALAMI', ml, y); y += 6
            doc.setFont('Helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GR)
            doc.text('School Manager  ·  Gestion Scolaire', ml, y); y += 7

            hline(y, 0.8); y += 5
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...GR)
            doc.text('RECU DE PAIEMENT', ml, y)
            doc.setFont('Helvetica', 'normal'); doc.setFontSize(8)
            doc.text(printDate, mr, y, { align: 'right' }); y += 5
            hline(y, 0.3); y += 7

            // ─── Title
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...BK)
            const titleLines = doc.splitTextToSize(typeLabel, mr - ml)
            doc.text(titleLines, ml, y); y += titleLines.length * 6.5 + 2
            doc.setFont('Helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GR)
            doc.text(`REF  ${shortId}`, ml, y); y += 9

            // ─── Amount box
            hline(y, 0.8); y += 6
            doc.setFont('Helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GR)
            doc.text('MONTANT PAYE', cx, y, { align: 'center' }); y += 10
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(28); doc.setTextColor(...BK)
            doc.text(fmt(p.amount_paid), cx, y, { align: 'center' }); y += 6
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(11)
            doc.text('MRU', cx, y, { align: 'center' }); y += 7
            hline(y, 0.8); y += 9

            // ─── Details
            const row = (label: string, value: string) => {
                doc.setFont('Helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GR)
                doc.text(label, ml, y)
                doc.setFont('Helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...BK)
                doc.text(value, mr, y, { align: 'right' }); y += 7
            }

            row('Type', typeLabel)
            row('Montant total', `${fmt(p.amount)} MRU`)
            if (remaining > 0) row('Reste a payer', `${fmt(remaining)} MRU`)
            row('Statut', statusLabel)
            if (p.paid_at) row('Date paiement', formatDateTime(p.paid_at))
            else if (p.due_date) row('Date echeance', formatDateOnly(p.due_date))

            // ─── Student
            y += 2; hline(y, 0.3); y += 6
            doc.setFont('Helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GR)
            doc.text('ELEVE', ml, y); y += 6
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...BK)
            doc.text(p.student_name, ml, y); y += 8
            if (p.class_name) { row('Classe', p.class_name) }
            if (profile?.national_id) { row('NNI', profile.national_id) }
            if (profile?.phone) { row('Tel', profile.phone) }

            // ─── Footer
            y += 3; hline(y, 0.3); y += 6
            doc.setFont('Helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GR)
            doc.text(`Genere le ${printDate}`, ml, y)
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...BK)
            doc.text('Qalami School Manager', mr, y, { align: 'right' })

            doc.save(`recu-${p.student_name.replace(/\s+/g, '-')}-${shortId}.pdf`)
            toast.success('PDF téléchargé')
        } catch {
            toast.error('Erreur lors de la génération du PDF')
        } finally {
            setGeneratingPdfId(null)
        }
    }

    const handleNotify = async (studentId: string, overdueCount: number, totalOwed: number, studentName: string) => {
        setNotifyingIds(prev => ({ ...prev, [studentId]: true }))
        try {
            const res = await notifyLateParentAction(studentId, overdueCount, totalOwed)
            if (res.error) {
                toast.error(res.error)
            } else {
                toast.success(`Rappel envoyé avec succès aux parents de ${studentName} !`)
            }
        } catch (err: any) {
            toast.error(err.message || "Erreur lors de l'envoi de la notification")
        } finally {
            setNotifyingIds(prev => ({ ...prev, [studentId]: false }))
        }
    }

    const fetchData = useCallback(async () => {
        setLoading(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }

        const { data: profile } = await supabase
            .from('profiles')
            .select('school_id')
            .eq('id', user.id)
            .single()
        if (!profile?.school_id) { setLoading(false); return }

        // Fetch current academic year name
        const { data: yearData } = await supabase
            .from('academic_years')
            .select('name')
            .eq('school_id', profile.school_id)
            .eq('is_current', true)
            .single()
        setCurrentAcademicYear(yearData?.name ?? null)

        // Fetch classes for filter
        const { data: classData } = await supabase
            .from('classes')
            .select('id, name')
            .eq('school_id', profile.school_id)
            .order('name')
        setClasses(classData || [])

        // Fetch payments + transactions in parallel
        const [
            { data: paymentsData, error },
            { data: txData },
            { data: enrollments },
        ] = await Promise.all([
            supabase
                .from('payments')
                .select(`
                    id, student_id, payment_type, amount,
                    payment_status, due_date, paid_at, academic_year_id,
                    profiles!payments_student_id_fkey(full_name)
                `)
                .eq('school_id', profile.school_id)
                .order('created_at', { ascending: false }),
            // Completed income transactions linked to a student
            supabase
                .from('transactions')
                .select('related_profile_id, amount')
                .eq('school_id', profile.school_id)
                .eq('type', 'income')
                .eq('status', 'completed')
                .not('related_profile_id', 'is', null),
            supabase
                .from('enrollments')
                .select('student_id, class_id, classes(name)')
                .eq('school_id', profile.school_id)
                .eq('status', 'active'),
        ])

        if (error) {
            console.error("Tuition load error:", error)
            toast.error(t('admin.tuition.loadError') || "Erreur de chargement des paiements")
            setLoading(false)
            return
        }

        // ── Credit balance per student from transactions ───────────────────────
        const txBalance = new Map<string, number>()
        ;(txData || []).forEach((tx: any) => {
            const id = tx.related_profile_id
            if (!id) return
            txBalance.set(id, (txBalance.get(id) ?? 0) + Number(tx.amount))
        })

        // Deduct already-paid payments so we don't double-count
        ;(paymentsData || [])
            .filter((p: any) => p.payment_status === 'paid')
            .forEach((p: any) => {
                const cur = txBalance.get(p.student_id) ?? 0
                txBalance.set(p.student_id, Math.max(0, cur - Number(p.amount)))
            })

        // Consume the transaction balance oldest-due-date first (regardless of display order)
        const effectivelyPaidIds = new Set<string>()
        ;[...(paymentsData || [])]
            .filter((p: any) => p.payment_status !== 'paid')
            .sort((a: any, b: any) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
            .forEach((p: any) => {
                const bal = txBalance.get(p.student_id) ?? 0
                if (bal >= Number(p.amount)) {
                    effectivelyPaidIds.add(p.id)
                    txBalance.set(p.student_id, bal - Number(p.amount))
                }
            })

        // ── Class names map ────────────────────────────────────────────────────
        const enrollmentMap: Record<string, string> = {}
        ;(enrollments || []).forEach((e: any) => {
            enrollmentMap[e.student_id] = e.classes?.name ?? null
        })

        const rows: PaymentRow[] = (paymentsData || []).map((p: any) => {
            const isPaid = p.payment_status === 'paid' || effectivelyPaidIds.has(p.id)
            const numericAmt = Number(p.amount) || 0
            return {
                id: p.id,
                student_id: p.student_id,
                student_name: p.profiles?.full_name ?? '—',
                class_name: enrollmentMap[p.student_id] ?? null,
                payment_type: p.payment_type ?? 'scolarite',
                amount: numericAmt,
                amount_paid: isPaid ? numericAmt : 0,
                status: isPaid ? 'paid' : (p.payment_status ?? 'pending'),
                due_date: p.due_date,
                paid_at: isPaid ? (p.paid_at ?? new Date().toISOString()) : null,
                academic_year_id: p.academic_year_id,
            }
        })

        setPayments(rows)
        setLoading(false)
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    // ── Filters ──────────────────────────────────────────────────────────────
    const todayStr = new Date().toISOString().split('T')[0]

    // Unique payment types present in the data — ensures filter options always cover every record
    const uniquePaymentTypes = Array.from(new Set(payments.map(p => p.payment_type))).sort()

    const filtered = payments.filter(p => {
        if (!p.class_name) return false
        const q = search.toLowerCase()
        const matchSearch = q === '' ||
            p.student_name.toLowerCase().includes(q) ||
            (p.class_name?.toLowerCase() ?? '').includes(q) ||
            p.id.slice(0, 8).toLowerCase().includes(q)
        // 'pending' filter also captures DB records stored with status='overdue'
        const matchStatus = filterStatus === 'all'
            ? true
            : filterStatus === 'pending'
                ? (p.status === 'pending' || p.status === 'overdue')
                : p.status === filterStatus
        const matchType = filterType === 'all' || p.payment_type === filterType
        const matchClass = filterClass === 'all' || p.class_name === filterClass
        return matchSearch && matchStatus && matchType && matchClass
    })

    // ── Compute Late Students Grouped ──────────────────────────────────────────
    const lateStudentsMap: Record<string, {
        studentId: string,
        studentName: string,
        className: string | null,
        totalOwed: number,
        monthsLate: number,
        oldestDueDate: string | null
    }> = {}

    payments.forEach(p => {
        // A payment is late if status is not 'paid' AND (it's explicitly 'overdue' OR the due_date has passed)
        const isLate = p.status !== 'paid' && (p.status === 'overdue' || (p.due_date && p.due_date < todayStr))
        if (isLate) {
            if (!lateStudentsMap[p.student_id]) {
                lateStudentsMap[p.student_id] = {
                    studentId: p.student_id,
                    studentName: p.student_name,
                    className: p.class_name,
                    totalOwed: 0,
                    monthsLate: 0,
                    oldestDueDate: p.due_date
                }
            }
            const record = lateStudentsMap[p.student_id]
            record.totalOwed += p.amount
            record.monthsLate += 1
            if (p.due_date && (!record.oldestDueDate || p.due_date < record.oldestDueDate)) {
                record.oldestDueDate = p.due_date
            }
        }
    })

    const lateStudentsList = Object.values(lateStudentsMap)
        .filter(s => !!s.className)
        .sort((a, b) => b.monthsLate - a.monthsLate)
        .filter(s => {
            if (search === '') return true
            return s.studentName.toLowerCase().includes(search.toLowerCase()) ||
                   s.className!.toLowerCase().includes(search.toLowerCase())
        })

    // ── Stats ─────────────────────────────────────────────────────────────────
    const knownPayments = payments.filter(p => !!p.class_name)
    const overduePayments = knownPayments.filter(p => p.status !== 'paid' && (p.status === 'overdue' || (p.due_date && p.due_date < todayStr)))

    const totalExpected = knownPayments.reduce((s, p) => s + p.amount, 0)
    const totalReceived = knownPayments.reduce((s, p) => s + p.amount_paid, 0)
    const totalOverdue = overduePayments.reduce((s, p) => s + (p.amount - p.amount_paid), 0)
    const totalStudents = new Set(knownPayments.map(p => p.student_id)).size
    const recoveryRate = totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0

    // ── CSV Export ────────────────────────────────────────────────────────────
    const handleExport = () => {
        let csv = `${t('admin.tuition.table.student')},${t('admin.tuition.table.class')},${t('admin.tuition.table.type')},${t('admin.tuition.table.amount')},${t('admin.tuition.table.paid')},${t('admin.tuition.table.remaining')},${t('admin.tuition.table.status')},${t('admin.tuition.table.dueDate')}\n`
        filtered.forEach(p => {
            csv += `"${p.student_name}","${p.class_name ?? '—'}","${t(`admin.tuition.paymentTypes.${p.payment_type}`)}",${p.amount},${p.amount_paid},${p.amount - p.amount_paid},${t(`admin.tuition.status.${p.status}`)},"${p.due_date ?? '—'}"\n`
        })
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `scolarite-${currentAcademicYear ?? 'export'}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        toast.success(t('admin.tuition.exportDownloaded'))
    }

    // ─── Render ───────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        )
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">

            {/* Actions */}
            <div className="flex justify-end">
                <Button
                    variant="outline"
                    className="border-white/10 bg-[#161B22] text-gray-300 hover:text-white hover:bg-white/5"
                    onClick={handleExport}
                >
                    <Download className="w-4 h-4 mr-2" />
                    {t('admin.tuition.exportCsv')}
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label={t('admin.tuition.totalExpected')}
                    value={`${totalExpected.toLocaleString('fr-FR')} MRU`}
                    icon={CreditCard}
                    color="text-blue-400"
                    bg="bg-blue-500/10 border-blue-500/20"
                />
                <StatCard
                    label={t('admin.tuition.totalReceived')}
                    value={`${totalReceived.toLocaleString('fr-FR')} MRU`}
                    icon={TrendingUp}
                    color="text-emerald-400"
                    bg="bg-emerald-500/10 border-emerald-500/20"
                    sub={t('admin.tuition.recoveryRateSub', { rate: recoveryRate })}
                />
                <StatCard
                    label={t('admin.tuition.overdue')}
                    value={`${totalOverdue.toLocaleString('fr-FR')} MRU`}
                    icon={AlertCircle}
                    color="text-red-400"
                    bg="bg-red-500/10 border-red-500/20"
                    sub={t('admin.tuition.overdueSub', { count: overduePayments.length })}
                />
                <StatCard
                    label={t('admin.tuition.concernedStudents')}
                    value={String(totalStudents)}
                    icon={Users}
                    color="text-purple-400"
                    bg="bg-purple-500/10 border-purple-500/20"
                    sub={t('admin.tuition.concernedStudentsSub', { count: payments.length })}
                />
            </div>

            {/* Recovery bar */}
            <div className="bg-[#1A2530] rounded-2xl border border-white/5 p-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('admin.tuition.globalRecoveryRate')}</span>
                    <span className="text-sm font-bold text-white">{recoveryRate}%</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                        className={cn(
                            "h-full rounded-full transition-all duration-700",
                            recoveryRate >= 80 ? "bg-emerald-500" :
                                recoveryRate >= 50 ? "bg-amber-500" : "bg-red-500"
                        )}
                        style={{ width: `${recoveryRate}%` }}
                    />
                </div>
            </div>

            {/* Tabs Navigation */}
            <div className="flex border-b border-white/5 gap-6">
                <button
                    onClick={() => setActiveTab('all')}
                    className={cn(
                        "pb-3 text-sm font-bold transition-all relative px-1 outline-none",
                        activeTab === 'all' ? "text-emerald-400 border-b-2 border-emerald-400" : "text-gray-400 hover:text-gray-300"
                    )}
                >
                    Toutes les Échéances ({filtered.length})
                </button>
                <button
                    onClick={() => setActiveTab('late')}
                    className={cn(
                        "pb-3 text-sm font-bold transition-all relative px-1 flex items-center gap-2 outline-none",
                        activeTab === 'late' ? "text-amber-400 border-b-2 border-amber-400" : "text-gray-400 hover:text-gray-300"
                    )}
                >
                    <AlertCircle className={cn("w-4 h-4", activeTab === 'late' ? "text-amber-400" : "text-amber-500/60")} />
                    Retardataires ({lateStudentsList.length})
                </button>
            </div>

            {/* Filters Row */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                        placeholder={activeTab === 'all' ? t('admin.tuition.searchPlaceholder') : "Rechercher un élève en retard..."}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9 bg-[#1A2530] border-white/10 text-white placeholder:text-gray-500"
                    />
                </div>

                {activeTab === 'all' && (
                    <>
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="w-44 bg-[#1A2530] border-white/10 text-white">
                                <SelectValue placeholder={t('admin.tuition.filters.status')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('admin.tuition.filters.allStatus')}</SelectItem>
                                <SelectItem value="paid">{t('admin.tuition.status.paid')}</SelectItem>
                                <SelectItem value="partial">{t('admin.tuition.status.partial')}</SelectItem>
                                <SelectItem value="pending">{t('admin.tuition.status.pending')}</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={filterType} onValueChange={setFilterType}>
                            <SelectTrigger className="w-44 bg-[#1A2530] border-white/10 text-white">
                                <SelectValue placeholder={t('admin.tuition.filters.type')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('admin.tuition.filters.allTypes')}</SelectItem>
                                {uniquePaymentTypes.map(type => (
                                    <SelectItem key={type} value={type}>
                                        {t(`admin.tuition.paymentTypes.${type}`) || type}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={filterClass} onValueChange={setFilterClass}>
                            <SelectTrigger className="w-44 bg-[#1A2530] border-white/10 text-white">
                                <SelectValue placeholder={t('admin.tuition.filters.class')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('admin.tuition.filters.allClasses')}</SelectItem>
                                {classes.map(c => (
                                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                                ))}
                                {payments.some(p => !p.class_name) && (
                                    <SelectItem value="__none__">{t('admin.tuition.filters.noClass')}</SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                    </>
                )}
            </div>

            {/* Main Table Content */}
            <div className="bg-[#1A2530] rounded-3xl border border-white/5 overflow-hidden shadow-sm">
                {activeTab === 'all' ? (
                    <>
                        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                {t('admin.tuition.recordsCount', { count: filtered.length })}
                            </h3>
                        </div>

                        {filtered.length === 0 ? (
                            <div className="text-center py-16 text-gray-500 text-sm">
                                {t('admin.tuition.noPaymentFound')}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-white/5">
                                            <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{t('admin.tuition.table.student')}</th>
                                            <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{t('admin.tuition.table.class')}</th>
                                            <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{t('admin.tuition.table.type')}</th>
                                            <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{t('admin.tuition.table.amount')}</th>
                                            <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{t('admin.tuition.table.paid')}</th>
                                            <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{t('admin.tuition.table.remaining')}</th>
                                            <th className="text-center px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{t('admin.tuition.table.status')}</th>
                                            <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Date</th>
                                            <th className="px-4 py-3"><span className="sr-only">PDF</span></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {filtered.map(p => {
                                            const remaining = p.amount - p.amount_paid
                                            const statusCfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.pending
                                            const StatusIcon = statusCfg.icon
                                            return (
                                                <tr key={p.id} className="hover:bg-white/[0.02] transition-colors group">
                                                    <td className="px-6 py-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 flex items-center justify-center text-emerald-500 font-bold text-xs shrink-0">
                                                                {p.student_name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
                                                            </div>
                                                            <span className="font-medium text-white text-sm">{p.student_name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {p.class_name ? (
                                                            <span className="text-xs bg-white/5 text-gray-300 px-2 py-1 rounded-lg border border-white/5">
                                                                {p.class_name}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-gray-600">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-400 text-xs">
                                                        {t(`admin.tuition.paymentTypes.${p.payment_type}`)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-white text-sm">
                                                        {p.amount.toLocaleString('fr-FR')}
                                                        <span className="text-[10px] text-gray-500 ml-1">MRU</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-emerald-400 text-sm">
                                                        {p.amount_paid.toLocaleString('fr-FR')}
                                                        <span className="text-[10px] text-gray-500 ml-1">MRU</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-sm">
                                                        <span className={remaining > 0 ? 'text-red-400' : 'text-gray-600'}>
                                                            {remaining > 0 ? remaining.toLocaleString('fr-FR') : '—'}
                                                            {remaining > 0 && <span className="text-[10px] text-gray-500 ml-1">MRU</span>}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={cn(
                                                            "inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full border",
                                                            statusCfg.color
                                                        )}>
                                                            <StatusIcon className="w-3 h-3" />
                                                            {t(`admin.tuition.status.${p.status}`)}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                                                        {p.status === 'paid' && p.paid_at ? (
                                                            <span className="text-emerald-400">
                                                                {formatDateTime(p.paid_at)}
                                                            </span>
                                                        ) : p.due_date ? (
                                                            <span className="text-gray-500">
                                                                {formatDateOnly(p.due_date)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-600">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleViewPdf(p)}
                                                            disabled={generatingPdfId === p.id}
                                                            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                                                        >
                                                            {generatingPdfId === p.id
                                                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                                                : <Eye className="w-4 h-4" />
                                                            }
                                                        </button>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-amber-500/5">
                            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                                <AlertCircle className="w-3.5 h-3.5" />
                                {lateStudentsList.length} {lateStudentsList.length > 1 ? "Élèves en défaut de paiement" : "Élève en défaut de paiement"}
                            </h3>
                        </div>

                        {lateStudentsList.length === 0 ? (
                            <div className="text-center py-16 text-gray-500 text-sm">
                                Aucun élève n'est en retard de paiement. Félicitations ! 🎉
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-white/5">
                                            <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Élève</th>
                                            <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Classe</th>
                                            <th className="text-center px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Durée Retard</th>
                                            <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Dette Totale</th>
                                            <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Plus Ancien</th>
                                            <th className="text-center px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {lateStudentsList.map(s => {
                                            const isNotifying = notifyingIds[s.studentId]
                                            return (
                                                <tr key={s.studentId} className="hover:bg-white/[0.02] transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500/20 to-red-500/20 flex items-center justify-center text-amber-500 font-bold text-xs shrink-0">
                                                                {s.studentName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
                                                            </div>
                                                            <span className="font-semibold text-white text-sm">{s.studentName}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        {s.className ? (
                                                            <span className="text-xs bg-white/5 text-gray-300 px-2 py-1 rounded-lg border border-white/5">
                                                                {s.className}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-gray-600">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <span className="inline-flex items-center gap-1 bg-red-500/10 text-red-400 text-xs font-bold px-2.5 py-1 rounded-full border border-red-500/20">
                                                            {s.monthsLate} {s.monthsLate > 1 ? 'mois' : 'mois'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4 text-right font-mono text-amber-400 font-black text-sm">
                                                        {s.totalOwed.toLocaleString('fr-FR')}
                                                        <span className="text-[10px] text-gray-500 ml-1 font-normal">MRU</span>
                                                    </td>
                                                    <td className="px-4 py-4 text-xs text-gray-500">
                                                        {s.oldestDueDate ? (
                                                            <span className="flex items-center gap-1 text-red-400/70">
                                                                <Calendar className="w-3 h-3" />
                                                                {new Date(s.oldestDueDate).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                                                            </span>
                                                        ) : '—'}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            disabled={isNotifying}
                                                            onClick={() => handleNotify(s.studentId, s.monthsLate, s.totalOwed, s.studentName)}
                                                            className={cn(
                                                                "bg-amber-500/5 hover:bg-amber-500 text-amber-400 hover:text-black text-xs font-bold border border-amber-500/10 hover:border-amber-500 h-8 px-3 transition-all flex items-center gap-2 mx-auto rounded-xl",
                                                                isNotifying && "opacity-50 cursor-not-allowed"
                                                            )}
                                                        >
                                                            {isNotifying ? (
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            ) : (
                                                                <Bell className="w-3.5 h-3.5" />
                                                            )}
                                                            Envoyer Rappel
                                                        </Button>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color, bg, sub }: {
    label: string
    value: string
    icon: React.ElementType
    color: string
    bg: string
    sub?: string
}) {
    return (
        <div className="bg-[#1A2530] rounded-2xl border border-white/5 p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center border", bg)}>
                    <Icon className={cn("w-4 h-4", color)} />
                </div>
            </div>
            <p className="text-xl font-black text-white leading-none">{value}</p>
            {sub && <p className="text-[11px] text-gray-500">{sub}</p>}
        </div>
    )
}
