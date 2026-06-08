'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Wallet, Clock, Trophy, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react'
import { useLanguage } from '@/i18n'
import { createClient } from '@/utils/supabase/client'

export function SalaryDetails({ teacher, onBack, onValidate }: {
    teacher: any
    onBack: () => void
    onValidate: (data: { netSalary: number, baseSalary: number, bonuses: number, deductions: number }) => void
}) {
    const { t } = useLanguage()
    const [overtimeHours, setOvertimeHours] = useState(8)
    const [bonus, setBonus] = useState(5000)
    const [schoolName, setSchoolName] = useState('')
    const [schoolLogo, setSchoolLogo] = useState('')
    const [adminName, setAdminName] = useState('')

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

    const handleDownloadSlip = () => {
        const printWindow = window.open('', '_blank', 'width=720,height=950')
        if (!printWindow) return

        const contractLabel = isHourly ? 'Contrat Horaire / عقد بالساعة' : 'Contrat Temps Plein / عقد دائم'
        const printDate = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

        printWindow.document.write(`
<!DOCTYPE html>
<html dir="ltr">
<head>
  <meta charset="utf-8">
  <title>Bulletin de Paie — ${teacher.name}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 30px; max-width: 650px; margin: 0 auto; color: #333; }
    .receipt-container { border: 2px dashed #10b981; border-radius: 16px; padding: 24px; background: #fff; }
    .header { display: flex; flex-direction: column; align-items: center; text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 16px; margin-bottom: 20px; gap: 8px; }
    .logo-container { width: 70px; height: 70px; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #ecfdf5; border: 2px solid #10b981; }
    .school-logo { width: 100%; height: 100%; object-fit: cover; }
    .school-title { font-size: 20px; font-weight: 800; color: #10b981; margin: 0; }
    .school-subtitle { font-size: 11px; color: #6b7280; margin: 2px 0 0 0; }
    .receipt-title { text-align: center; margin: 15px 0; }
    .receipt-title h2 { margin: 0; font-size: 18px; color: #1f2937; letter-spacing: 0.5px; }
    .receipt-title p { margin: 4px 0 0 0; font-size: 12px; color: #6b7280; }
    .meta-info { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; background: #f9fafb; padding: 12px 16px; border-radius: 8px; font-size: 13px; }
    .meta-row { display: flex; justify-content: space-between; align-items: center; padding: 3px 0; }
    .meta-label { color: #6b7280; }
    .meta-value { font-weight: bold; color: #1f2937; }
    .section-title { font-size: 11px; font-weight: bold; text-transform: uppercase; color: #6b7280; letter-spacing: 0.8px; margin: 16px 0 6px 0; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb; }
    .table-header { display: grid; grid-template-columns: 2.5fr 1fr; font-weight: bold; padding-bottom: 6px; font-size: 12px; color: #4b5563; border-bottom: 2px solid #e5e7eb; }
    .table-row { display: grid; grid-template-columns: 2.5fr 1fr; padding: 9px 0; border-bottom: 1px solid #f3f4f6; align-items: center; font-size: 13px; }
    .item-desc { font-weight: 500; color: #1f2937; }
    .item-amount-green { text-align: right; font-weight: bold; color: #10b981; font-size: 14px; }
    .item-amount-red { text-align: right; font-weight: bold; color: #ef4444; font-size: 14px; }
    .total-section { margin-top: 16px; padding-top: 10px; border-top: 2px solid #e5e7eb; }
    .total-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; font-size: 13px; }
    .total-row.net { margin-top: 10px; padding-top: 10px; border-top: 2px solid #d1fae5; }
    .total-label { color: #4b5563; }
    .total-label-net { font-size: 15px; font-weight: bold; color: #1f2937; }
    .total-value { font-weight: bold; color: #1f2937; }
    .total-value-net { font-size: 22px; font-weight: 800; color: #10b981; }
    .status-badge { background-color: #d1fae5; color: #065f46; font-size: 11px; font-weight: bold; padding: 3px 8px; border-radius: 9999px; display: inline-block; }
    .signatures-section { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 50px; font-size: 13px; text-align: center; }
    .signature-box { border-top: 1px solid #d1d5db; padding-top: 8px; color: #6b7280; }
    .footer { text-align: center; margin-top: 30px; font-size: 11px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 12px; }
    @media print { body { padding: 0; } .receipt-container { border: 2px solid #10b981; } }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="header">
      <div class="logo-container">
        ${schoolLogo ? `<img src="${schoolLogo}" alt="Logo" class="school-logo" />` : `<span style="font-size:32px">🎓</span>`}
      </div>
      <div>
        <h1 class="school-title">${schoolName || 'ECOLE QALAMI / مدرسة قلمي'}</h1>
        <p class="school-subtitle">Système de Gestion Scolaire / نظام إدارة المدارس</p>
      </div>
    </div>

    <div class="receipt-title">
      <h2>BULLETIN DE PAIE / بطاقة الراتب</h2>
      <p>Période / الفترة : <strong>${monthName} ${year}</strong></p>
    </div>

    <div class="meta-info">
      <div>
        <div class="meta-row"><span class="meta-label">Employé / الموظف :</span><span class="meta-value">${teacher.name}</span></div>
        <div class="meta-row"><span class="meta-label">Poste / المنصب :</span><span class="meta-value">${teacher.subject || '—'}</span></div>
        <div class="meta-row"><span class="meta-label">NNI :</span><span class="meta-value" style="font-family:monospace">${teacher.nni || '—'}</span></div>
      </div>
      <div>
        <div class="meta-row"><span class="meta-label">Téléphone / الهاتف :</span><span class="meta-value">${teacher.phone || '—'}</span></div>
        <div class="meta-row"><span class="meta-label">Contrat / العقد :</span><span class="meta-value">${contractLabel}</span></div>
        <div class="meta-row"><span class="meta-label">Date / التاريخ :</span><span class="meta-value">${printDate}</span></div>
        <div class="meta-row"><span class="meta-label">Statut / الحالة :</span><span class="meta-value"><span class="status-badge">PAYÉ / مدفوع</span></span></div>
      </div>
    </div>

    <div class="section-title">RÉMUNÉRATION / الأجر</div>
    <div class="table-header"><div>Désignation / البيان</div><div style="text-align:right">Montant / المبلغ</div></div>
    <div class="table-row"><div class="item-desc">Salaire de base / الراتب الأساسي</div><div class="item-amount-green">${baseSalary.toLocaleString('fr-FR')} MRU</div></div>
    <div class="table-row"><div class="item-desc">Heures supplémentaires / ساعات إضافية<br><small style="color:#6b7280">${overtimeHours}h × ${overtimeRate} MRU/h</small></div><div class="item-amount-green">+${overtimeTotal.toLocaleString('fr-FR')} MRU</div></div>
    <div class="table-row"><div class="item-desc">Prime d'excellence / علاوة التميز</div><div class="item-amount-green">+${bonus.toLocaleString('fr-FR')} MRU</div></div>

    <div class="section-title">RETENUES / الخصومات</div>
    <div class="table-header"><div>Désignation / البيان</div><div style="text-align:right">Montant / المبلغ</div></div>
    <div class="table-row"><div class="item-desc">Absences (2 jours) / الغيابات</div><div class="item-amount-red">-${absences.toLocaleString('fr-FR')} MRU</div></div>
    <div class="table-row"><div class="item-desc">Cotisation sociale CNSS / الضمان الاجتماعي</div><div class="item-amount-red">-${socialCotisation.toLocaleString('fr-FR')} MRU</div></div>

    <div class="total-section">
      <div class="total-row"><span class="total-label">Total Brut / المجموع الإجمالي</span><span class="total-value">${grossSalary.toLocaleString('fr-FR')} MRU</span></div>
      <div class="total-row"><span class="total-label" style="color:#ef4444">Total Retenues / مجموع الخصومات</span><span class="total-value" style="color:#ef4444">-${totalDeductions.toLocaleString('fr-FR')} MRU</span></div>
      <div class="total-row net"><span class="total-label-net">NET À PAYER / الراتب الصافي</span><span class="total-value-net">${netSalary.toLocaleString('fr-FR')} MRU</span></div>
    </div>

    <div class="signatures-section">
      <div class="signature-box">Employé / الموظف<br><strong>${teacher.name}</strong></div>
      <div class="signature-box">Administration / الإدارة<br><strong>${adminName || 'Directeur'}</strong></div>
    </div>

    <div class="footer">
      <p>Merci pour votre confiance / شكراً لثقتكم</p>
      <p style="margin-top:4px">Généré le ${printDate} — ${schoolName || 'Qalami School Manager'}</p>
    </div>
  </div>
</body>
</html>`)
        printWindow.document.close()
        printWindow.focus()
        setTimeout(() => {
            printWindow.print()
            printWindow.close()
        }, 300)
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
                        <Button type="button" variant="outline" onClick={handleDownloadSlip} className="border-white/20 text-white hover:bg-white/10 bg-[#0F1720] h-12 px-6 font-semibold">
                            <FileText className="w-4 h-4 mr-2" /> {t('admin.payroll.slip')}
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
