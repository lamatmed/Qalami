'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Wallet, Clock, Trophy, AlertTriangle, FileText, CheckCircle2, Loader2 } from 'lucide-react'
import { useLanguage } from '@/i18n'
import { createClient } from '@/utils/supabase/client'

export function SalaryDetails({ teacher, onBack, onValidate }: {
    teacher: any
    onBack: () => void
    onValidate: (data: { netSalary: number, baseSalary: number, bonuses: number, deductions: number }) => void
}) {
    const { t } = useLanguage()
    const [overtimeHours, setOvertimeHours] = useState(0)
    const [bonus, setBonus] = useState(0)
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

    // Calculations
    const overtimeRate = 400 // MRU per hour
    const overtimeTotal = overtimeHours * overtimeRate
    const absences = 2800
    const socialCotisation = 1450

    const isHourly = teacher.contractType === 'hourly'
    const baseSalary = teacher.base

    const netSalary = baseSalary + overtimeTotal + bonus - absences - socialCotisation
    const grossSalary = baseSalary + overtimeTotal + bonus
    const totalDeductions = absences + socialCotisation

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
            doc.text('EN COURS', 120, 91.5, { align: 'center' })

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
            tableRow('Salaire de base', `${fmt(baseSalary)} MRU`, E)
            tableRow(`Heures supplementaires (${overtimeHours}h x ${overtimeRate} MRU/h)`, `+${fmt(overtimeTotal)} MRU`, E)
            tableRow("Prime d'excellence", `+${fmt(bonus)} MRU`, E)
            y += 3
            section('RETENUES')
            tableRow('Absences (2 jours)', `-${fmt(absences)} MRU`, R)
            tableRow('Cotisation sociale CNSS', `-${fmt(socialCotisation)} MRU`, R)

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
            doc.text(`-${fmt(totalDeductions)} MRU`, 195, y, { align: 'right' })
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
        <div className="space-y-6 animate-in slide-in-from-right duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={onBack} className="text-gray-400 hover:text-white -ml-2 gap-2">
                    <ArrowLeft className="w-4 h-4" /> {t('admin.payroll.back')}
                </Button>
                <div className="flex items-center gap-2 bg-[#1A2530] px-3 py-1.5 rounded-full border border-white/5">
                    <Calendar className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-xs font-bold text-white">{monthName} {year}</span>
                </div>
            </div>

            {/* Teacher Profile Card */}
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
                    <p className="text-gray-500 text-xs font-mono mt-1">{t('admin.payroll.id')}: QA-2023-089</p>
                </div>
                <div className="sm:ml-auto bg-[#0F1720] rounded-2xl p-4 border border-white/5 min-w-[200px]">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-500">
                            <Wallet className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase font-bold">
                                {teacher.id === 2 ? t('admin.payroll.hourlyRate') : t('admin.payroll.baseSalary')}
                            </p>
                            <p className="text-white font-bold">
                                {teacher.id === 2 ? '500' : teacher.base.toLocaleString()} <span className="text-xs font-normal text-gray-500">MRU{teacher.id === 2 ? '/h' : ''}</span>
                            </p>
                        </div>
                    </div>
                    <Badge variant="outline" className="w-full justify-center bg-white/5 border-white/10 text-gray-400 font-normal py-1">
                        {teacher.id === 2 ? t('admin.payroll.hourlyContract') : t('admin.payroll.fullTimeContract')}
                    </Badge>
                </div>
            </div>

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
                            </div>
                            <span className="text-emerald-500 font-bold">+{overtimeTotal.toLocaleString()} MRU</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <input
                                    type="range"
                                    aria-label={t('admin.payroll.overtime')}
                                    min="0"
                                    max="20"
                                    value={overtimeHours}
                                    onChange={(e) => setOvertimeHours(parseInt(e.target.value))}
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                />
                            </div>
                            <div className="bg-[#1A2530] px-3 py-1.5 rounded-lg border border-white/5 flex items-center gap-2 min-w-[100px] justify-center">
                                <span className="text-white font-mono font-bold">{overtimeHours}</span>
                                <span className="text-gray-500 text-xs text-right">{t('admin.payroll.hours')}</span>
                            </div>
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
                        <div className="flex items-center">
                            <input
                                type="text"
                                aria-label={t('admin.payroll.excellenceBonus')}
                                value={bonus}
                                onChange={(e) => setBonus(parseInt(e.target.value) || 0)}
                                className="w-full bg-[#1A2530] border-white/10 text-white font-bold p-3 rounded-xl focus:ring-emerald-500 focus:border-emerald-500"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Deductions */}
            <div className="bg-[#1A2530] rounded-3xl border border-white/5 overflow-hidden">
                <div className="p-4 bg-[#0F1720]/50 border-b border-white/5">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">{t('admin.payroll.deductions')}</h3>
                </div>
                <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between group cursor-pointer">
                        <div className="flex items-center gap-4">
                            <div className="bg-red-500/10 p-2.5 rounded-xl text-red-500 group-hover:bg-red-500 group-hover:text-black transition-colors">
                                <Calendar className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-white font-bold">{t('admin.payroll.absences')}</p>
                                <p className="text-xs text-gray-500">{t('admin.payroll.absencesSub')}</p>
                            </div>
                        </div>
                        <span className="text-red-400 font-bold">-{absences.toLocaleString()} MRU</span>
                    </div>

                    <div className="flex items-center justify-between group cursor-pointer">
                        <div className="flex items-center gap-4">
                            <div className="bg-blue-500/10 p-2.5 rounded-xl text-blue-500 group-hover:bg-blue-500 group-hover:text-black transition-colors">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-white font-bold">{t('admin.payroll.socialContribution')}</p>
                                <p className="text-xs text-gray-500">{t('admin.payroll.socialContributionSub')}</p>
                            </div>
                        </div>
                        <span className="text-gray-400 font-bold">-{socialCotisation.toLocaleString()} MRU</span>
                    </div>
                </div>
            </div>

            {/* Footer Summary */}
            <div className="bg-[#1A2530] rounded-3xl border border-white/10 p-6 sticky bottom-4 shadow-2xl">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-300 text-sm font-medium">{t('admin.payroll.totalGross')}</span>
                    <span className="text-white font-bold text-sm">{(teacher.base + overtimeTotal + bonus).toLocaleString()} <span className="text-gray-400 font-normal">MRU</span></span>
                </div>
                <div className="flex items-center justify-between mb-5 pb-5 border-b border-white/10">
                    <span className="text-red-400 text-sm font-medium">{t('admin.payroll.totalDeductions')}</span>
                    <span className="text-red-400 font-bold text-sm">-{(absences + socialCotisation).toLocaleString()} <span className="font-normal">MRU</span></span>
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
                            <Button onClick={() => onValidate({ netSalary, baseSalary, bonuses: overtimeTotal + bonus, deductions: absences + socialCotisation })} className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold h-12 px-8 shadow-lg shadow-emerald-900/30">
                                <CheckCircle2 className="w-4 h-4 mr-2" /> {t('admin.payroll.validate')}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

function Calendar(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
        </svg>
    )
}
