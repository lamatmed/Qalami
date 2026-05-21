'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { CheckCircle2, ArrowLeft, FileText, Download, Bell } from 'lucide-react'
import { useLanguage } from '@/i18n'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'

export function PaymentConfirmation({
    teacher,
    netSalary,
    breakdown,
    transactionId,
    onReset,
}: {
    teacher: any
    netSalary: number
    breakdown: { baseSalary: number, bonuses: number, deductions: number }
    transactionId: string
    onReset: () => void
}) {
    const { t } = useLanguage()
    const [notifyEnabled, setNotifyEnabled] = useState(true)
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

    const handlePrintSlip = () => {
        const printWindow = window.open('', '_blank', 'width=720,height=950')
        if (!printWindow) return

        const contractLabel = teacher.contractType === 'hourly'
            ? 'Contrat Horaire / عقد بالساعة'
            : 'Contrat Temps Plein / عقد دائم'
        const printDate = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
        const grossSalary = breakdown.baseSalary + breakdown.bonuses

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
    .ref-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 14px; margin-top: 16px; font-size: 12px; display: flex; justify-content: space-between; }
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
    <div class="table-row"><div class="item-desc">Salaire de base / الراتب الأساسي</div><div class="item-amount-green">${breakdown.baseSalary.toLocaleString('fr-FR')} MRU</div></div>
    <div class="table-row"><div class="item-desc">Éléments variables / العناصر المتغيرة<br><small style="color:#6b7280">Heures supp. + Primes</small></div><div class="item-amount-green">+${breakdown.bonuses.toLocaleString('fr-FR')} MRU</div></div>

    <div class="section-title">RETENUES / الخصومات</div>
    <div class="table-header"><div>Désignation / البيان</div><div style="text-align:right">Montant / المبلغ</div></div>
    <div class="table-row"><div class="item-desc">Total retenues / مجموع الخصومات<br><small style="color:#6b7280">Absences + Cotisation CNSS</small></div><div class="item-amount-red">-${breakdown.deductions.toLocaleString('fr-FR')} MRU</div></div>

    <div class="total-section">
      <div class="total-row"><span class="total-label">Total Brut / المجموع الإجمالي</span><span class="total-value">${grossSalary.toLocaleString('fr-FR')} MRU</span></div>
      <div class="total-row"><span class="total-label" style="color:#ef4444">Total Retenues / مجموع الخصومات</span><span class="total-value" style="color:#ef4444">-${breakdown.deductions.toLocaleString('fr-FR')} MRU</span></div>
      <div class="total-row net"><span class="total-label-net">NET À PAYER / الراتب الصافي</span><span class="total-value-net">${netSalary.toLocaleString('fr-FR')} MRU</span></div>
    </div>

    <div class="ref-box">
      <span style="color:#6b7280">Référence transaction / مرجع المعاملة :</span>
      <span style="font-family:monospace; font-weight:bold; color:#10b981">${transactionId}</span>
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
        setTimeout(() => printWindow.print(), 300)
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

            <div className="space-y-2 max-w-md">
                <h2 className="text-3xl font-bold text-white">{t('admin.payroll.paymentValidated')}</h2>
                <p className="text-gray-400">
                    {t('admin.payroll.paymentSuccessDesc', { name: teacher.name })}
                    {' '}<span className="text-white font-semibold">{monthName} {year}</span>.
                </p>
                <div className="flex flex-col items-center gap-2 mt-4">
                    <div className="bg-[#1A2530] px-5 py-3 rounded-xl border border-white/5 inline-block">
                        <p className="text-xs text-gray-500 font-mono mb-0.5">{t('admin.payroll.transactionId')}</p>
                        <p className="text-sm text-emerald-400 font-mono font-bold tracking-wider">{transactionId}</p>
                    </div>
                    <div className="bg-[#1A2530] px-5 py-2 rounded-xl border border-white/5 inline-block">
                        <p className="text-xs text-gray-500 mb-0.5">{t('admin.payroll.netToPayUpper')}</p>
                        <p className="text-xl font-black text-white">
                            {netSalary.toLocaleString('fr-FR')} <span className="text-sm font-normal text-emerald-500">MRU</span>
                        </p>
                    </div>
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
                        className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold w-full"
                    >
                        <FileText className="w-4 h-4 mr-2" /> {t('admin.payroll.slip')}
                    </Button>
                </div>
            </div>

            <Button type="button" onClick={onReset} variant="ghost" className="text-gray-500 hover:text-white mt-8">
                <ArrowLeft className="w-4 h-4 mr-2" /> {t('admin.payroll.backToManagement')}
            </Button>
        </div>
    )
}
