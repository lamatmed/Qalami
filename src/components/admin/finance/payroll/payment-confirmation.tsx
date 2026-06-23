'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CheckCircle2, ArrowLeft, FileText, Download, Bell, Loader2 } from 'lucide-react'
import { useLanguage } from '@/i18n'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'

const METHOD_LABELS: Record<string, string> = {
    especes: 'Espèces',
    virement: 'Virement bancaire',
    cheque: 'Chèque',
    wave: 'Wave',
    bankily: 'Bankily',
    masrvi: 'Masrvi',
    autre: 'Autre',
}

export function PaymentConfirmation({
    teacher,
    netSalary,
    breakdown,
    transactionId,
    notes,
    paymentMethod,
    onReset,
}: {
    teacher: any
    netSalary: number
    breakdown: { baseSalary: number, bonuses: number, deductions: number }
    transactionId: string
    notes?: string
    paymentMethod?: string
    onReset: () => void
}) {
    const { t } = useLanguage()
    const [notifyEnabled, setNotifyEnabled] = useState(true)
    const [schoolName, setSchoolName] = useState('')
    const [schoolLogo, setSchoolLogo] = useState('')
    const [adminName, setAdminName] = useState('')
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

    const now = new Date()
    const monthKeys = ['january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december']
    const monthName = t(`admin.payroll.months.${monthKeys[now.getMonth()]}`)
    const year = now.getFullYear()

    useEffect(() => {
        async function loadSchoolInfo() {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase
                .from('profiles')
                .select('school_id, full_name')
                .eq('id', user.id)
                .single()

            if (profile?.full_name) setAdminName(profile.full_name)
            if (!profile?.school_id) return

            const { data: settings } = await supabase
                .from('school_settings')
                .select('name, logo_url')
                .eq('school_id', profile.school_id)
                .maybeSingle()

            let sName = settings?.name || null
            let sLogo = settings?.logo_url || null

            if (!sName || !sLogo) {
                const { data: school } = await supabase
                    .from('schools')
                    .select('name, logo_url')
                    .eq('id', profile.school_id)
                    .maybeSingle()
                if (!sName) sName = school?.name || null
                if (!sLogo) sLogo = school?.logo_url || null
            }

            if (sName) setSchoolName(sName)
            if (sLogo) setSchoolLogo(sLogo)
        }
        loadSchoolInfo()
    }, [])

    const handleDownloadReceipt = () => {
        const lines = [
            'RECU DE PAIEMENT',
            '─────────────────────────────────',
            `Employé  : ${teacher.name}`,
            `Poste    : ${teacher.subject || teacher.position || '—'}`,
            `Mois     : ${monthName} ${year}`,
            `Montant  : ${netSalary.toLocaleString('fr-FR')} MRU`,
            `ID Trans : ${transactionId}`,
            '─────────────────────────────────',
            'Généré par Qalami School Manager',
        ].join('\n')
        const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `recu-${teacher.name.replace(/\s+/g, '-')}-${year}-${String(now.getMonth() + 1).padStart(2, '0')}.txt`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const handlePrintSlip = async () => {
        setIsGeneratingPdf(true)
        try {
            const { jsPDF } = await import('jspdf')
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
            const fmt = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

            const isHourly = teacher.contractType === 'hourly'
            const printDate = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
            const grossSalary = breakdown.baseSalary + breakdown.bonuses

            const E: [number,number,number] = [16, 185, 129]
            const G: [number,number,number] = [107, 114, 128]
            const D: [number,number,number] = [31, 41, 55]
            const R: [number,number,number] = [239, 68, 68]

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
            doc.text(`Periode : ${monthName} ${year}`, 105, 54, { align: 'center' })

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
            metaRow('Employe :', teacher.name, 20, 68)
            metaRow('Telephone :', teacher.phone || '--', 110, 68)
            metaRow('Poste :', teacher.subject || '--', 20, 76)
            metaRow('Contrat :', isHourly ? 'Horaire' : 'Temps Plein', 110, 76)
            metaRow('NNI :', teacher.nni || '--', 20, 84)
            metaRow('Date :', printDate, 110, 84)

            doc.setFillColor(209, 250, 229)
            doc.roundedRect(110, 87, 20, 6, 1.5, 1.5, 'F')
            doc.setFontSize(7.5)
            doc.setFont('Helvetica', 'bold')
            doc.setTextColor(6, 95, 70)
            doc.text('PAYE', 120, 91.5, { align: 'center' })

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
            tableRow('Salaire de base', `${fmt(breakdown.baseSalary)} MRU`, E)
            tableRow('Elements variables (Heures supp. + Primes)', `+${fmt(breakdown.bonuses)} MRU`, E)
            y += 3
            section('RETENUES')
            tableRow('Total retenues (Absences + Cotisation CNSS)', `-${fmt(breakdown.deductions)} MRU`, R)

            y += 5
            doc.setDrawColor(209, 213, 219)
            doc.setLineWidth(0.4)
            doc.line(15, y - 3, 195, y - 3)

            doc.setFont('Helvetica', 'normal')
            doc.setFontSize(10)
            doc.setTextColor(75, 85, 99)
            doc.text('Total Brut', 15, y)
            doc.setFont('Helvetica', 'bold')
            doc.setTextColor(...D)
            doc.text(`${fmt(grossSalary)} MRU`, 195, y, { align: 'right' })
            y += 8

            doc.setFont('Helvetica', 'normal')
            doc.setTextColor(75, 85, 99)
            doc.text('Total Retenues', 15, y)
            doc.setFont('Helvetica', 'bold')
            doc.setTextColor(...R)
            doc.text(`-${fmt(breakdown.deductions)} MRU`, 195, y, { align: 'right' })
            y += 6

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
            doc.text(`${fmt(netSalary)} MRU`, 195, y, { align: 'right' })
            y += 14

            doc.setFillColor(249, 250, 251)
            doc.roundedRect(15, y - 4, 180, 11, 1.5, 1.5, 'F')
            doc.setFontSize(8.5)
            doc.setFont('Helvetica', 'normal')
            doc.setTextColor(...G)
            doc.text('Ref. transaction :', 20, y + 3)
            doc.setFont('Helvetica', 'bold')
            doc.setTextColor(...E)
            doc.text(transactionId, 65, y + 3)
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
            doc.text(teacher.name, 52, y, { align: 'center' })
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

            const monthNum = String(now.getMonth() + 1).padStart(2, '0')
            doc.save(`bulletin-${teacher.name.replace(/\s+/g, '-')}-${year}-${monthNum}.pdf`)
        } finally {
            setIsGeneratingPdf(false)
        }
    }

    return (
        <div className="h-full flex flex-col items-center justify-center text-center space-y-8 animate-in zoom-in-50 duration-500 p-6">

            <div className="relative">
                <div className="bg-emerald-500/10 h-32 w-32 rounded-full flex items-center justify-center animate-pulse">
                    <div className="bg-emerald-500 h-20 w-20 rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/30">
                        <CheckCircle2 className="w-10 h-10 text-black" />
                    </div>
                </div>
                <div className="absolute top-0 right-0 h-3 w-3 bg-emerald-400 rounded-full animate-bounce delay-100" />
                <div className="absolute bottom-4 left-0 h-2 w-2 bg-purple-400 rounded-full animate-bounce delay-300" />
            </div>

            <div className="space-y-2 max-w-md w-full">
                <h2 className="text-3xl font-bold text-white text-center">{t('admin.payroll.paymentValidated')}</h2>
                <p className="text-gray-400 text-center">
                    {(() => {
                        const rawText = t('admin.payroll.paymentSuccessDesc', { name: 'PLACEHOLDER_NAME' })
                        const parts = rawText.split('PLACEHOLDER_NAME')
                        if (parts.length === 2) {
                            return (
                                <>
                                    {parts[0]}
                                    <Link
                                        href={teacher.role === 'teacher' ? `/admin/teachers/${teacher.employeeId}` : `/admin/employees/${teacher.employeeId}`}
                                        className="text-white font-semibold underline hover:text-emerald-400 transition-colors"
                                    >
                                        {teacher.name}
                                    </Link>
                                    {parts[1]}
                                </>
                            )
                        }
                        return t('admin.payroll.paymentSuccessDesc', { name: teacher.name })
                    })()}
                    {' '}<span className="text-white font-semibold">{monthName} {year}</span>.
                </p>

                {/* Validation code — show to employee as receipt */}
                <div className="mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-center">
                    <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mb-1">Code de validation / réception</p>
                    <p className="text-2xl text-emerald-400 font-mono font-black tracking-[0.3em]">{transactionId.slice(-6).toUpperCase()}</p>
                    <p className="text-[10px] text-gray-500 mt-1">Montrer ce code à l'employé pour confirmer la réception</p>
                    <p className="text-[10px] text-gray-600 font-mono mt-0.5">Réf complète : {transactionId}</p>
                </div>

                <div className="bg-[#1A2530] px-5 py-3 rounded-xl border border-white/5">
                    <p className="text-xs text-gray-500 mb-0.5">{t('admin.payroll.netToPayUpper')}</p>
                    <p className="text-xl font-black text-white">
                        {netSalary.toLocaleString('fr-FR')} <span className="text-sm font-normal text-emerald-500">MRU</span>
                    </p>
                    {paymentMethod && (
                        <p className="text-xs text-gray-500 mt-1">
                            Moyen : <span className="text-white font-semibold">{METHOD_LABELS[paymentMethod] ?? paymentMethod}</span>
                        </p>
                    )}
                    {notes && (
                        <p className="text-xs text-gray-400 mt-1 italic">« {notes} »</p>
                    )}
                </div>
            </div>

            <div className="bg-[#1A2530] p-6 rounded-3xl border border-white/5 w-full max-w-sm space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-amber-400" />
                        <span className="text-white font-bold text-sm">{t('admin.payroll.sendNotice')}</span>
                    </div>
                    <button
                        type="button"
                        aria-label={notifyEnabled ? 'Désactiver la notification' : 'Activer la notification'}
                        onClick={() => setNotifyEnabled(v => !v)}
                        className={cn(
                            'h-5 w-9 rounded-full relative transition-colors',
                            notifyEnabled ? 'bg-emerald-500' : 'bg-white/10'
                        )}
                    >
                        <span className={cn(
                            'absolute top-1 h-3 w-3 bg-white rounded-full shadow-sm transition-transform',
                            notifyEnabled ? 'translate-x-5' : 'translate-x-1'
                        )} />
                    </button>
                </div>
                <p className="text-xs text-gray-500 text-left">{t('admin.payroll.sendNoticeDesc')}</p>

                <div className="pt-4 border-t border-white/5 grid grid-cols-2 gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleDownloadReceipt}
                        className="border-white/10 hover:bg-white/5 text-white w-full"
                    >
                        <Download className="w-4 h-4 mr-2" /> {t('admin.payroll.receipt')}
                    </Button>
                    <Button
                        type="button"
                        onClick={handlePrintSlip}
                        disabled={isGeneratingPdf}
                        className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold w-full disabled:opacity-70"
                    >
                        {isGeneratingPdf
                            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> PDF...</>
                            : <><FileText className="w-4 h-4 mr-2" /> {t('admin.payroll.slip')}</>
                        }
                    </Button>
                </div>
            </div>

            <Button type="button" onClick={onReset} variant="ghost" className="text-gray-500 hover:text-white mt-8">
                <ArrowLeft className="w-4 h-4 mr-2" /> {t('admin.payroll.backToManagement')}
            </Button>
        </div>
    )
}
