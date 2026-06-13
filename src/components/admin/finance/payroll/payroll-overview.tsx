'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Search, ChevronRight, CheckCircle2, Download, Printer, Wallet, ArrowUpRight, Clock, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { createClient } from '@/utils/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'
import { useLanguage } from '@/i18n'
import { toast } from 'sonner'
import { confirmPaymentAction } from '@/app/admin/finance/payroll/actions'

interface PayrollEmployee {
    id: string
    employeeId: string
    employeeName: string
    position: string
    contractType: string
    role: string
    status: 'pending' | 'paid' | 'cancelled'
    baseSalary: number
    bonuses: number
    deductions: number
    netSalary: number
    initials: string
    phone?: string
    nni?: string
    avatarUrl?: string
    salaryConfigured: boolean
}

export function PayrollOverview({ onSelectTeacher, refreshKey }: { onSelectTeacher: (teacher: any) => void, refreshKey?: number }) {
    const { t } = useLanguage()
    const [employees, setEmployees] = useState<PayrollEmployee[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')
    const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
    const [searchQuery, setSearchQuery] = useState('')

    // Get current month and year
    const currentMonth = new Date().getMonth() + 1
    const currentYear = new Date().getFullYear()
    const monthKeys = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
    const monthName = t(`admin.payroll.months.${monthKeys[currentMonth - 1]}`)

    // Fetch payroll data
    useEffect(() => {
        async function fetchPayroll() {
            setLoading(true)
            const supabase = createClient()

            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) {
                    setLoading(false)
                    return
                }

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('school_id')
                    .eq('id', user.id)
                    .single()

                if (!profile?.school_id) {
                    setLoading(false)
                    return
                }

                // 1. Fetch active contracts WITH their linked profile information
                const { data: contractData, error: contractErr } = await supabase
                    .from('contracts')
                    .select(`
                        employee_id,
                        position,
                        monthly_salary,
                        contract_type,
                        profiles (
                            id,
                            full_name,
                            role,
                            phone,
                            national_id,
                            avatar_url
                        )
                    `)
                    .eq('school_id', profile.school_id)
                    .eq('status', 'active')

                if (contractErr) {
                    console.error('Payroll contracts load error:', contractErr)
                    setLoading(false)
                    return
                }

                // 2. Fetch standard payroll ledger records for CURRENT month and year
                const queryMonth = new Date().getMonth() + 1
                const queryYear = new Date().getFullYear()

                const { data: payrollEntries, error: payrollErr } = await supabase
                    .from('payroll')
                    .select('*, profiles(id, full_name, role)')
                    .eq('school_id', profile.school_id)
                    .eq('month', queryMonth)
                    .eq('year', queryYear)

                if (payrollErr) {
                    console.error('Payroll ledger load error:', payrollErr)
                }

                // 3. Fetch ALL active staff profiles (teachers + employees + school_staff) to catch people without contracts
                const { data: staffProfiles } = await supabase
                    .from('profiles')
                    .select('id, full_name, role, phone, national_id, avatar_url')
                    .eq('school_id', profile.school_id)
                    .in('role', ['teacher', 'employee', 'staff', 'school_staff'])

                // 4. Merge: union of contract holders + payroll entries + all staff profiles
                const employeeIds = new Set([
                    ...(contractData || []).map(c => c.employee_id),
                    ...(payrollEntries || []).map(p => p.employee_id),
                    ...(staffProfiles || []).map(p => p.id),
                ])

                const processedData: PayrollEmployee[] = Array.from(employeeIds).map(empId => {
                    const contract = (contractData || []).find(c => c.employee_id === empId)
                    const payroll  = (payrollEntries || []).find(p => p.employee_id === empId)
                    const staffP   = (staffProfiles || []).find(p => p.id === empId)

                    const profileObj = (contract?.profiles || payroll?.profiles || staffP) as any
                    const fullName   = profileObj?.full_name || 'Employé'
                    const initials   = fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

                    const defaultSalary = contract ? (parseFloat(contract.monthly_salary) || 0) : 0
                    const defaultPosition = contract?.position || (profileObj?.role === 'teacher' ? 'Enseignant' : 'Employé')
                    const salaryConfigured = defaultSalary > 0

                    return {
                        id: payroll?.id || empId,
                        employeeId: empId,
                        employeeName: fullName,
                        position: defaultPosition,
                        contractType: (contract as any)?.contract_type || 'CDI',
                        role: profileObj?.role || 'employee',
                        status: (payroll?.status as 'pending'|'paid'|'cancelled') || 'pending',
                        baseSalary: payroll ? (parseFloat(payroll.base_salary) || 0) : defaultSalary,
                        bonuses: payroll ? (parseFloat(payroll.bonuses) || 0) : 0,
                        deductions: payroll ? (parseFloat(payroll.deductions) || 0) : 0,
                        netSalary: payroll ? (parseFloat(payroll.net_salary) || 0) : defaultSalary,
                        initials,
                        phone: profileObj?.phone || undefined,
                        nni: profileObj?.national_id || undefined,
                        avatarUrl: profileObj?.avatar_url || undefined,
                        salaryConfigured,
                    }
                })

                setEmployees(processedData)
            } catch (err) {
                console.error('Payroll unexpected error:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchPayroll()
    }, [refreshKey])


    const filteredEmployees = employees.filter(e => {
        const matchesFilter = filter === 'all' || e.status === filter
        const matchesSearch = searchQuery === '' || e.employeeName.toLowerCase().includes(searchQuery.toLowerCase())
        return matchesFilter && matchesSearch
    })

    const totalPayroll = employees.reduce((acc, curr) => acc + curr.netSalary, 0)
    const pendingAmount = employees.filter(e => e.status === 'pending').reduce((acc, curr) => acc + curr.netSalary, 0)
    const paidAmount = employees.filter(e => e.status === 'paid').reduce((acc, curr) => acc + curr.netSalary, 0)

    const toggleSelectAll = () => {
        if (selectedEmployees.length === filteredEmployees.length) {
            setSelectedEmployees([])
        } else {
            setSelectedEmployees(filteredEmployees.map(e => e.id))
        }
    }

    const toggleSelectEmployee = (id: string) => {
        if (selectedEmployees.includes(id)) {
            setSelectedEmployees(selectedEmployees.filter(e => e !== id))
        } else {
            setSelectedEmployees([...selectedEmployees, id])
        }
    }

    const [bulkPaying, setBulkPaying] = useState(false)
    const [bulkGenerating, setBulkGenerating] = useState(false)

    const generateTxId = () => {
        const now = new Date()
        const y = now.getFullYear()
        const m = String(now.getMonth() + 1).padStart(2, '0')
        const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
        return `PAY-${y}-${m}-${rand}`
    }

    const handleBulkPay = async () => {
        const targets = employees.filter(e => selectedEmployees.includes(e.id) && e.status !== 'paid')
        if (!targets.length) {
            toast.info('Tous les employés sélectionnés ont déjà été payés ce mois-ci.')
            return
        }
        setBulkPaying(true)
        let success = 0
        let failed = 0
        for (const emp of targets) {
            const result = await confirmPaymentAction({
                employeeId: emp.employeeId,
                employeeName: emp.employeeName,
                baseSalary: emp.baseSalary,
                bonuses: emp.bonuses,
                deductions: emp.deductions,
                netSalary: emp.netSalary,
                transactionRef: generateTxId(),
            })
            if (result?.error) { failed++ } else { success++ }
        }
        setBulkPaying(false)
        if (success > 0) {
            setEmployees(prev => prev.map(e =>
                selectedEmployees.includes(e.id) ? { ...e, status: 'paid' as const } : e
            ))
            setSelectedEmployees([])
        }
        if (failed > 0) toast.error(`${failed} paiement(s) ont échoué`)
        if (success > 0) toast.success(`${success} paiement(s) confirmé(s) avec succès`)
    }

    const handleBulkBulletins = async () => {
        const targets = employees.filter(e => selectedEmployees.includes(e.id))
        if (!targets.length) return

        setBulkGenerating(true)
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            let schoolName = '', adminName = ''
            if (user) {
                const { data: profile } = await supabase.from('profiles').select('school_id, full_name').eq('id', user.id).single()
                if (profile?.full_name) adminName = profile.full_name
                if (profile?.school_id) {
                    const { data: settings } = await supabase.from('school_settings').select('name').eq('school_id', profile.school_id).maybeSingle()
                    schoolName = settings?.name || ''
                    if (!schoolName) {
                        const { data: school } = await supabase.from('schools').select('name').eq('id', profile.school_id).maybeSingle()
                        schoolName = school?.name || ''
                    }
                }
            }

            const { jsPDF } = await import('jspdf')
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

            const printDate = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
            const E: [number,number,number] = [16, 185, 129]
            const G: [number,number,number] = [107, 114, 128]
            const D: [number,number,number] = [31, 41, 55]
            const R: [number,number,number] = [239, 68, 68]
            const fmt = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

            const drawPage = (emp: typeof targets[0]) => {
                doc.setDrawColor(...E)
                doc.setLineWidth(0.8)
                doc.rect(10, 10, 190, 275)

                doc.setFont('Helvetica', 'bold')
                doc.setFontSize(17)
                doc.setTextColor(...E)
                doc.text(schoolName || 'ECOLE QALAMI', 105, 28, { align: 'center' })
                doc.setFont('Helvetica', 'normal')
                doc.setFontSize(8)
                doc.setTextColor(...G)
                doc.text('Systeme de Gestion Scolaire', 105, 34, { align: 'center' })
                doc.setDrawColor(...E)
                doc.setLineWidth(0.4)
                doc.line(20, 37, 190, 37)

                doc.setFont('Helvetica', 'bold')
                doc.setFontSize(14)
                doc.setTextColor(...D)
                doc.text('BULLETIN DE PAIE', 105, 47, { align: 'center' })
                doc.setFont('Helvetica', 'normal')
                doc.setFontSize(10)
                doc.setTextColor(...G)
                doc.text(`Periode : ${monthName} ${currentYear}`, 105, 54, { align: 'center' })

                doc.setFillColor(249, 250, 251)
                doc.roundedRect(15, 59, 180, 44, 2, 2, 'F')

                const metaRow = (label: string, value: string, x: number, y: number) => {
                    doc.setFont('Helvetica', 'normal')
                    doc.setFontSize(8.5)
                    doc.setTextColor(...G)
                    doc.text(label, x, y)
                    doc.setFont('Helvetica', 'bold')
                    doc.setFontSize(9.5)
                    doc.setTextColor(...D)
                    doc.text(String(value), x + 28, y)
                }
                metaRow('Employe :', emp.employeeName, 20, 68)
                metaRow('Telephone :', emp.phone || '--', 110, 68)
                metaRow('Poste :', emp.position, 20, 76)
                metaRow('Contrat :', emp.contractType === 'hourly' ? 'Horaire' : 'Temps Plein', 110, 76)
                metaRow('NNI :', emp.nni || '--', 20, 84)
                metaRow('Date :', printDate, 110, 84)

                const isPaid = emp.status === 'paid'
                doc.setFillColor(isPaid ? 209 : 254, isPaid ? 250 : 243, isPaid ? 229 : 199)
                doc.roundedRect(110, 87, isPaid ? 20 : 30, 6, 1.5, 1.5, 'F')
                doc.setFontSize(7.5)
                doc.setFont('Helvetica', 'bold')
                doc.setTextColor(isPaid ? 6 : 133, isPaid ? 95 : 77, isPaid ? 70 : 14)
                doc.text(isPaid ? 'PAYE' : 'EN ATTENTE', isPaid ? 120 : 125, 91.5, { align: 'center' })

                let y = 113
                const section = (title: string) => {
                    doc.setFontSize(8)
                    doc.setFont('Helvetica', 'bold')
                    doc.setTextColor(...G)
                    doc.text(title, 15, y)
                    doc.setDrawColor(229, 231, 235)
                    doc.setLineWidth(0.2)
                    doc.line(15, y + 2, 195, y + 2)
                    y += 9
                }
                const tableRow = (label: string, amount: string, color: [number,number,number]) => {
                    doc.setFont('Helvetica', 'normal')
                    doc.setFontSize(9.5)
                    doc.setTextColor(...D)
                    doc.text(label, 15, y)
                    doc.setFont('Helvetica', 'bold')
                    doc.setTextColor(...color)
                    doc.text(amount, 195, y, { align: 'right' })
                    doc.setDrawColor(243, 244, 246)
                    doc.setLineWidth(0.15)
                    doc.line(15, y + 2, 195, y + 2)
                    y += 10
                }

                section('REMUNERATION')
                tableRow('Salaire de base', `${fmt(emp.baseSalary)} MRU`, E)
                if (emp.bonuses > 0) tableRow('Primes et elements variables', `+${fmt(emp.bonuses)} MRU`, E)
                y += 3
                section('RETENUES')
                if (emp.deductions > 0) tableRow('Deductions', `-${fmt(emp.deductions)} MRU`, R)
                else { doc.setFont('Helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...G); doc.text('Aucune retenue', 15, y); y += 10 }

                y += 5
                doc.setDrawColor(209, 250, 229)
                doc.setLineWidth(0.8)
                doc.line(15, y, 195, y)
                y += 9

                doc.setFont('Helvetica', 'bold')
                doc.setFontSize(11)
                doc.setTextColor(...D)
                doc.text('NET A PAYER', 15, y)
                doc.setFontSize(16)
                doc.setTextColor(...E)
                doc.text(`${fmt(emp.netSalary)} MRU`, 195, y, { align: 'right' })
                y += 20

                doc.setDrawColor(209, 213, 219)
                doc.setLineWidth(0.4)
                doc.line(20, y, 85, y)
                doc.line(115, y, 185, y)
                y += 6
                doc.setFont('Helvetica', 'normal')
                doc.setFontSize(8.5)
                doc.setTextColor(...G)
                doc.text('Employe', 52, y, { align: 'center' })
                doc.text('Administration', 150, y, { align: 'center' })
                y += 5
                doc.setFont('Helvetica', 'bold')
                doc.setFontSize(9.5)
                doc.setTextColor(...D)
                doc.text(emp.employeeName, 52, y, { align: 'center' })
                doc.text(adminName || 'Directeur', 150, y, { align: 'center' })
                y += 18

                doc.setDrawColor(243, 244, 246)
                doc.setLineWidth(0.2)
                doc.line(15, y, 195, y)
                y += 6
                doc.setFont('Helvetica', 'normal')
                doc.setFontSize(7.5)
                doc.setTextColor(156, 163, 175)
                doc.text('Merci pour votre confiance', 105, y, { align: 'center' })
                y += 4
                doc.text(`Genere le ${printDate} - ${schoolName || 'Qalami School Manager'}`, 105, y, { align: 'center' })
            }

            targets.forEach((emp, i) => {
                if (i > 0) doc.addPage()
                drawPage(emp)
            })

            const monthNum = String(new Date().getMonth() + 1).padStart(2, '0')
            doc.save(`bulletins-${monthName}-${currentYear}-${monthNum}.pdf`)
        } finally {
            setBulkGenerating(false)
        }
    }

    const handleExport = () => {
        const rows = filteredEmployees
        if (rows.length === 0) {
            toast.error(t('admin.payroll.noEmployeeFound'))
            return
        }
        const headers = ['Nom', 'Poste', 'Type de contrat', 'Statut', 'Salaire de base (MRU)', 'Primes (MRU)', 'Déductions (MRU)', 'Salaire net (MRU)']
        const csvRows = [
            headers.join(','),
            ...rows.map(e => [
                `"${e.employeeName}"`,
                `"${e.position}"`,
                `"${e.contractType}"`,
                e.status === 'paid' ? 'Payé' : e.status === 'cancelled' ? 'Annulé' : 'En attente',
                e.baseSalary,
                e.bonuses,
                e.deductions,
                e.netSalary,
            ].join(','))
        ]
        const csvContent = '﻿' + csvRows.join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `paie-${monthName}-${currentYear}.csv`
        a.click()
        URL.revokeObjectURL(url)
        toast.success(t('admin.payroll.exportSuccess'))
    }

    const handlePrint = () => {
        const rows = filteredEmployees
        if (rows.length === 0) {
            toast.error(t('admin.payroll.noEmployeeFound'))
            return
        }
        const tableRows = rows.map(e => `
            <tr>
                <td>${e.employeeName}</td>
                <td>${e.position}</td>
                <td>${e.contractType}</td>
                <td class="${e.status === 'paid' ? 'paid' : 'pending'}">${e.status === 'paid' ? 'Payé' : e.status === 'cancelled' ? 'Annulé' : 'En attente'}</td>
                <td class="num">${e.baseSalary.toLocaleString()}</td>
                <td class="num">${e.bonuses.toLocaleString()}</td>
                <td class="num">${e.deductions.toLocaleString()}</td>
                <td class="num bold">${e.netSalary.toLocaleString()}</td>
            </tr>
        `).join('')
        const totalNet = rows.reduce((s, e) => s + e.netSalary, 0)
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fiche de paie — ${monthName} ${currentYear}</title>
        <style>
            body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 24px; }
            h1 { font-size: 16px; margin-bottom: 4px; }
            p.sub { font-size: 11px; color: #555; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #1a1a2e; color: #fff; padding: 8px 10px; text-align: left; font-size: 11px; }
            td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
            tr:nth-child(even) td { background: #f9fafb; }
            .num { text-align: right; }
            .bold { font-weight: bold; }
            .paid { color: #059669; font-weight: bold; }
            .pending { color: #d97706; font-weight: bold; }
            tfoot td { font-weight: bold; background: #f3f4f6; border-top: 2px solid #d1d5db; }
            @media print { body { margin: 0; } }
        </style></head><body>
        <h1>Fiche de paie — ${monthName} ${currentYear}</h1>
        <p class="sub">Généré le ${new Date().toLocaleDateString('fr-FR')} · ${rows.length} employé(s)</p>
        <table>
            <thead><tr>
                <th>Nom</th><th>Poste</th><th>Contrat</th><th>Statut</th>
                <th style="text-align:right">Base (MRU)</th>
                <th style="text-align:right">Primes (MRU)</th>
                <th style="text-align:right">Déductions (MRU)</th>
                <th style="text-align:right">Net (MRU)</th>
            </tr></thead>
            <tbody>${tableRows}</tbody>
            <tfoot><tr>
                <td colspan="7" style="text-align:right">Total net</td>
                <td class="num">${totalNet.toLocaleString()} MRU</td>
            </tr></tfoot>
        </table>
        </body></html>`
        const win = window.open('', '_blank', 'width=900,height=650')
        if (!win) {
            toast.error('Le navigateur a bloqué la fenêtre popup. Autorisez les popups pour ce site.')
            return
        }
        win.document.write(html)
        win.document.close()
        setTimeout(() => { 
            win.focus()
            win.print()
            win.close()
        }, 400)
    }

    if (loading) {
        return (
            <div className="space-y-6 animate-in fade-in duration-500 pb-20">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Skeleton className="h-32 rounded-3xl" />
                    <Skeleton className="h-32 rounded-3xl" />
                    <Skeleton className="h-32 rounded-3xl" />
                </div>
                <Skeleton className="h-12 rounded-xl" />
                <Skeleton className="h-64 rounded-3xl" />
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            {/* Header Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Total Budget */}
                <Card className="bg-[#161B22] border-white/5 p-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Wallet className="w-24 h-24 text-emerald-500" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">{t('admin.payroll.budgetTotal', { month: monthName })}</p>
                        <h2 className="text-3xl font-black text-white mb-2">{totalPayroll.toLocaleString()} <span className="text-sm text-gray-500 font-medium">MRU</span></h2>
                        <div className="flex items-center gap-2 text-xs text-emerald-500 bg-emerald-500/10 w-fit px-2 py-1 rounded-md">
                            <ArrowUpRight className="w-3 h-3" /> {t('admin.payroll.activeEmployeesCount', { count: employees.length })}
                        </div>
                    </div>
                </Card>

                {/* Paid */}
                <Card className="bg-[#161B22] border-white/5 p-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <CheckCircle2 className="w-24 h-24 text-blue-500" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">{t('admin.payroll.paid')}</p>
                        <h2 className="text-3xl font-black text-white mb-2">{paidAmount.toLocaleString()} <span className="text-sm text-gray-500 font-medium">MRU</span></h2>
                        <div className="w-full bg-gray-800 h-1.5 rounded-full mt-2 overflow-hidden">
                            <div className="bg-blue-500 h-full rounded-full" style={{ width: `${totalPayroll > 0 ? (paidAmount / totalPayroll) * 100 : 0}%` }} />
                        </div>
                        <p className="text-[10px] text-gray-500 mt-2 text-right">{t('admin.payroll.percentCompleted', { percent: totalPayroll > 0 ? Math.round((paidAmount / totalPayroll) * 100) : 0 })}</p>
                    </div>
                </Card>

                {/* Pending */}
                <Card className="bg-[#161B22] border-white/5 p-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Clock className="w-24 h-24 text-orange-500" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">{t('admin.payroll.pending')}</p>
                        <h2 className="text-3xl font-black text-white mb-2">{pendingAmount.toLocaleString()} <span className="text-sm text-gray-500 font-medium">MRU</span></h2>
                        <div className="flex items-center gap-2 text-xs text-orange-500 bg-orange-500/10 w-fit px-2 py-1 rounded-md mt-1">
                            {t('admin.payroll.pendingToPay', { count: employees.filter(e => e.status === 'pending').length })}
                        </div>
                    </div>
                </Card>
            </div>

            {/* Actions Toolbar */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex gap-2 bg-[#161B22] p-1 rounded-xl border border-white/5 w-full sm:w-auto">
                    {['all', 'paid', 'pending'].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={cn(
                                "flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all",
                                filter === f
                                    ? "bg-white/10 text-white shadow-sm"
                                    : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                            )}
                        >
                            {f === 'all' ? t('admin.payroll.all') : f === 'paid' ? t('admin.payroll.paidStatus') : t('admin.payroll.pendingStatus')}
                        </button>
                    ))}
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                    <Button onClick={handlePrint} variant="outline" className="bg-[#161B22] border-white/5 text-gray-400 hover:text-white flex-1 sm:flex-none gap-2">
                        <Printer className="w-4 h-4" /> <span className="hidden sm:inline">{t('admin.payroll.print')}</span>
                    </Button>
                    <Button onClick={handleExport} variant="outline" className="bg-[#161B22] border-white/5 text-gray-400 hover:text-white flex-1 sm:flex-none gap-2">
                        <Download className="w-4 h-4" /> <span className="hidden sm:inline">{t('admin.payroll.export')}</span>
                    </Button>
                </div>
            </div>

            {/* Bulk Action Bar */}
            {selectedEmployees.length > 0 && (
                <div className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 bg-emerald-500 text-black px-6 py-3 rounded-full shadow-2xl shadow-emerald-500/20 flex items-center gap-4 animate-in slide-in-from-bottom-5">
                    <span className="font-bold text-sm">{t('admin.payroll.selectedCount', { count: selectedEmployees.length })}</span>
                    <div className="h-4 w-px bg-black/20" />
                    <button
                        type="button"
                        onClick={handleBulkPay}
                        disabled={bulkPaying}
                        className="font-bold text-sm hover:bg-emerald-600 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-60"
                    >
                        {bulkPaying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        {t('admin.payroll.payAll')}
                    </button>
                    <button
                        type="button"
                        onClick={handleBulkBulletins}
                        disabled={bulkGenerating}
                        className="font-bold text-sm hover:bg-emerald-600 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {bulkGenerating
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> PDF...</>
                            : <><Download className="w-4 h-4" /> {t('admin.payroll.slipBulletins')}</>
                        }
                    </button>
                </div>
            )}

            {/* Employee List */}
            <div className="bg-[#161B22] rounded-3xl border border-white/5 overflow-hidden">
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Checkbox
                            checked={selectedEmployees.length === filteredEmployees.length && filteredEmployees.length > 0}
                            onCheckedChange={toggleSelectAll}
                            className="border-white/20 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                        />
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{t('admin.payroll.employeesLabel', { count: filteredEmployees.length })}</span>
                    </div>
                    <div className="relative w-48 hidden sm:block">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                        <Input
                            placeholder={t('admin.payroll.searchPlaceholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8 bg-[#0D1117] border-white/5 text-xs h-8 focus-visible:ring-emerald-500/50 rounded-lg"
                        />
                    </div>
                </div>

                <div className="divide-y divide-white/5">
                    {filteredEmployees.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            <Wallet className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>{t('admin.payroll.noEmployeeFound')}</p>
                        </div>
                    ) : (
                        filteredEmployees.map((employee) => (
                            <div
                                key={employee.id}
                                className={cn(
                                    "p-4 flex flex-col sm:flex-row items-center gap-4 hover:bg-white/[0.02] transition-colors group",
                                    selectedEmployees.includes(employee.id) && "bg-emerald-500/5"
                                )}
                            >
                                <div className="flex items-center gap-4 w-full sm:w-auto">
                                    <Checkbox
                                        checked={selectedEmployees.includes(employee.id)}
                                        onCheckedChange={() => toggleSelectEmployee(employee.id)}
                                        className="border-white/20 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                                    />
                                    <Avatar className="h-12 w-12 border border-white/10 shrink-0">
                                        <AvatarImage src={employee.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${employee.employeeName}`} className="object-cover" />
                                        <AvatarFallback className="bg-[#21262d] text-gray-400 text-xs font-bold">{employee.initials}</AvatarFallback>
                                    </Avatar>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Link
                                                href={employee.role === 'teacher' ? `/admin/teachers/${employee.employeeId}` : `/admin/employees/${employee.employeeId}`}
                                                className="font-bold text-white text-sm truncate hover:text-emerald-400 transition-colors"
                                                onClick={e => e.stopPropagation()}
                                            >
                                                {employee.employeeName}
                                            </Link>
                                            {employee.status === 'paid' && (
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                            )}
                                            {!employee.salaryConfigured && (
                                                <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full font-bold shrink-0">
                                                    <AlertCircle className="w-2.5 h-2.5" /> Salaire non configuré
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-gray-500 text-xs truncate">{employee.position}</p>
                                        <div className="flex items-center gap-3 mt-0.5">
                                            {employee.phone && (
                                                <span className="text-gray-600 text-[10px] font-mono">{employee.phone}</span>
                                            )}
                                            {employee.nni && (
                                                <span className="text-gray-600 text-[10px] font-mono">NNI: {employee.nni}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 w-full sm:w-auto sm:ml-auto justify-between sm:justify-end">
                                    <Badge className={cn(
                                        "border-0 text-[10px] px-2 h-5",
                                        employee.status === 'paid'
                                            ? "bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500/20"
                                            : "bg-orange-500/10 text-orange-500 group-hover:bg-orange-500/20"
                                    )}>
                                        {employee.status === 'paid' ? t('admin.payroll.paidStatus').toUpperCase() : t('admin.payroll.pendingStatusUpper')}
                                    </Badge>

                                    <div className="text-right min-w-[80px]">
                                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-0.5">{t('admin.payroll.netToPay')}</p>
                                        {employee.salaryConfigured ? (
                                            <p className="text-sm font-bold text-white">
                                                {employee.netSalary.toLocaleString()} <span className="text-[10px] text-gray-600 font-normal">MRU</span>
                                            </p>
                                        ) : (
                                            <p className="text-sm font-bold text-amber-400">—</p>
                                        )}
                                    </div>

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => onSelectTeacher({
                                            ...employee,
                                            base: employee.baseSalary,
                                            variable: employee.bonuses - employee.deductions,
                                            name: employee.employeeName,
                                            subject: employee.position,
                                            contractType: employee.contractType,
                                            phone: employee.phone,
                                            nni: employee.nni,
                                            avatarUrl: employee.avatarUrl,
                                            isPaid: employee.status === 'paid',
                                        })}
                                        className="text-gray-500 hover:text-white hover:bg-white/5 rounded-lg h-8 w-8"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
