'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
    Loader2, Banknote, TrendingUp, Calendar, CheckCircle2, Clock, XCircle,
    Plus, X, ArrowDownRight, Eye, Check,
} from 'lucide-react'
import { cn, proxyStorageUrl } from '@/lib/utils'
import { getMySchoolContext } from '@/app/admin/actions'
import { toast } from 'sonner'
import { StaffAdjustments } from '@/components/admin/teachers/profile/staff-adjustments'
import { TeacherPayrollSection } from '@/components/admin/teachers/profile/teacher-payroll-section'
import {
    recordTeacherPaymentAction,
    getTeacherTransactionsAction,
} from '@/app/admin/teachers/actions'
import { useLanguage } from '@/i18n'

interface ContractData {
    monthly_salary: number
    contract_type: string
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

interface EmployeeTransaction {
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

const getBilingualCategoryLabel = (cat: string | null) => {
    const map: Record<string, { fr: string; ar: string }> = {
        prime:         { fr: 'Prime / Bonus', ar: 'مكافأة / علاوة' },
        avance:        { fr: 'Avance sur salaire', ar: 'سلفة على الراتب' },
        remboursement: { fr: 'Remboursement', ar: 'استرداد' },
        cotisation:    { fr: 'Cotisation', ar: 'اشتراك' },
        autre:         { fr: 'Autre versement', ar: 'دفعة أخرى' },
        salary:        { fr: 'Salaire', ar: 'الراتب' },
        'Salaire du personnel': { fr: 'Salaire', ar: 'الراتب' },
    }
    return map[cat ?? ''] || { fr: cat ?? 'Autre', ar: cat ?? 'أخرى' }
}

const getBilingualMethodLabel = (method: string | null) => {
    if (!method) return null
    const map: Record<string, { fr: string; ar: string }> = {
        cash:          { fr: 'Espèces', ar: 'نقداً' },
        bank_transfer: { fr: 'Virement bancaire', ar: 'تحويل بنكي' },
        mobile_money:  { fr: 'Mobile Money', ar: 'الدفع عبر الهاتف' },
        check:         { fr: 'Chèque', ar: 'شيك' },
    }
    return map[method] || { fr: method, ar: method }
}

export function EmployeeFinances({ employeeId }: { employeeId: string }) {
    const { t, language } = useLanguage()

    const PAYMENT_CATEGORIES = [
        { value: 'prime',         label: t('admin.employees.finances.categories.prime') },
        { value: 'avance',        label: t('admin.employees.finances.categories.avance') },
        { value: 'remboursement', label: t('admin.employees.finances.categories.remboursement') },
        { value: 'cotisation',    label: t('admin.employees.finances.categories.cotisation') },
        { value: 'autre',         label: t('admin.employees.finances.categories.autre') },
    ]

    const PAYMENT_METHODS = [
        { value: 'cash',          label: t('admin.employees.finances.methods.cash') },
        { value: 'bank_transfer', label: t('admin.employees.finances.methods.bank_transfer') },
        { value: 'mobile_money',  label: t('admin.employees.finances.methods.mobile_money') },
        { value: 'check',         label: t('admin.employees.finances.methods.check') },
    ]

    const getCategoryLabel = (cat: string | null) => {
        const map: Record<string, string> = {
            prime:                  t('admin.employees.finances.categories.prime'),
            avance:                 t('admin.employees.finances.categories.avance'),
            remboursement:          t('admin.employees.finances.categories.remboursement'),
            cotisation:             t('admin.employees.finances.categories.cotisation'),
            autre:                  t('admin.employees.finances.categories.autre'),
            salary:                 t('admin.employees.finances.categories.salary'),
            'Salaire du personnel': t('admin.employees.finances.categories.salary'),
        }
        return map[cat ?? ''] ?? cat ?? '—'
    }

    const getMethodLabel = (method: string) => {
        const map: Record<string, string> = {
            cash:          t('admin.employees.finances.methods.cash'),
            bank_transfer: t('admin.employees.finances.methods.bank_transfer'),
            mobile_money:  t('admin.employees.finances.methods.mobile_money'),
            check:         t('admin.employees.finances.methods.check'),
        }
        return map[method] || method
    }

    const [loading, setLoading]               = useState(true)
    const [contract, setContract]             = useState<ContractData | null>(null)
    const [payments, setPayments]             = useState<PayrollRecord[]>([])
    const [transactions, setTransactions]     = useState<EmployeeTransaction[]>([])
    const [txLoading, setTxLoading]           = useState(true)
    const [payrollRefreshTick, setPayrollRefreshTick] = useState(0)

    // Employee profile and school details
    const [employeeName, setEmployeeName]     = useState('')
    const [employeePhone, setEmployeePhone]   = useState('')
    const [employeeNni, setEmployeeNni]       = useState('')
    const [schoolName, setSchoolName]         = useState('')
    const [schoolLogo, setSchoolLogo]         = useState('')

    const [showForm, setShowForm]             = useState(false)
    const [payAmount, setPayAmount]           = useState('')
    const [payCategory, setPayCategory]       = useState('prime')
    const [payDescription, setPayDescription] = useState('')
    const [payDate, setPayDate]               = useState(new Date().toISOString().split('T')[0])
    const [payMethod, setPayMethod]           = useState('cash')
    const [submitting, setSubmitting]         = useState(false)
    const [generatingReceiptId, setGeneratingReceiptId] = useState<string | null>(null)
    const [generatingPayrollReceiptId, setGeneratingPayrollReceiptId] = useState<string | null>(null)

    const fetchTransactions = useCallback(async () => {
        setTxLoading(true)
        const res = await getTeacherTransactionsAction(employeeId)
        if (!res.error) setTransactions(res.data as EmployeeTransaction[])
        setTxLoading(false)
    }, [employeeId])

    useEffect(() => {
        async function load() {
            const supabase = createClient()
            const ctx = await getMySchoolContext()
            const schoolId = ctx?.school_id
            if (!schoolId) { setLoading(false); return }

            const [contractRes, payrollRes, profileRes] = await Promise.all([
                supabase
                    .from('contracts')
                    .select('monthly_salary, contract_type, position')
                    .eq('employee_id', employeeId)
                    .eq('school_id', schoolId)
                    .eq('status', 'active')
                    .maybeSingle(),
                supabase
                    .from('payroll')
                    .select('id, month, year, base_salary, bonuses, deductions, net_salary, status, paid_at')
                    .eq('employee_id', employeeId)
                    .eq('school_id', schoolId)
                    .order('year', { ascending: false })
                    .order('month', { ascending: false })
                    .limit(24),
                supabase
                    .from('profiles')
                    .select('full_name, national_id, phone')
                    .eq('id', employeeId)
                    .single()
            ])

            if (contractRes.data) setContract(contractRes.data as ContractData)
            if (payrollRes.data) setPayments(payrollRes.data as PayrollRecord[])
            if (profileRes.data) {
                setEmployeeName(profileRes.data.full_name || '')
                setEmployeeNni(profileRes.data.national_id || '')
                setEmployeePhone(profileRes.data.phone || '')
            }

            // Fetch school settings / school name and logo
            const { data: schoolSettings } = await supabase
                .from('school_settings')
                .select('name, logo_url')
                .eq('school_id', schoolId)
                .maybeSingle()

            let sName = schoolSettings?.name || null
            let sLogo = schoolSettings?.logo_url || null

            if (!sLogo || !sName) {
                const { data: schoolRow } = await supabase
                    .from('schools')
                    .select('name, logo_url')
                    .eq('id', schoolId)
                    .maybeSingle()
                if (!sLogo) sLogo = schoolRow?.logo_url || null
                if (!sName) sName = schoolRow?.name || null
            }

            if (sName) setSchoolName(sName)
            if (sLogo) setSchoolLogo(proxyStorageUrl(sLogo) || sLogo)

            setLoading(false)
        }
        load()
        fetchTransactions()
    }, [employeeId, fetchTransactions, payrollRefreshTick])

    const handleAddPayment = async () => {
        const amount = parseFloat(payAmount)
        if (!amount || amount <= 0) { toast.error(t('admin.employees.finances.invalidAmount')); return }
        setSubmitting(true)
        const res = await recordTeacherPaymentAction({
            teacherId: employeeId,
            amount,
            category: payCategory,
            description: payDescription.trim() || PAYMENT_CATEGORIES.find(c => c.value === payCategory)?.label || payCategory,
            date: payDate,
            paymentMethod: payMethod,
        })
        setSubmitting(false)
        if (res.error) { toast.error(res.error); return }
        toast.success(t('admin.employees.finances.paymentSaved'))
        setShowForm(false)
        setPayAmount('')
        setPayDescription('')
        setPayDate(new Date().toISOString().split('T')[0])
        await fetchTransactions()
    }

    const handleGenerateReceipt = async (trx: EmployeeTransaction) => {
        setGeneratingReceiptId(trx.id)
        try {
            toast.info(language === 'ar' ? 'جارٍ إنشاء الوصل…' : 'Génération du reçu…')

            const locale = language === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR'
            const paymentDate = trx.transaction_date
                ? new Date(trx.transaction_date).toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })
                : '—'
            const receiptNo = trx.id.slice(0, 8).toUpperCase()
            const catBilingual = getBilingualCategoryLabel(trx.category)
            const methodBilingual = getBilingualMethodLabel(trx.payment_method)
            const _now = new Date()
            const printDate = _now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Africa/Nouakchott' })
                + ' à ' + _now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nouakchott' })
            const fmt = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

            const row = (label: string, value: string, shade: boolean) =>
                `<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:5px 6px;${shade ? 'background:#f9fafb;' : ''}border-radius:3px;gap:6px;">
                    <span style="color:#6b7280;font-size:10px;flex-shrink:0;white-space:nowrap;padding-top:1px;">${label}</span>
                    <span style="font-weight:600;font-size:10px;color:#111;text-align:right;direction:auto;min-width:0;flex:1;word-break:break-word;overflow-wrap:anywhere;line-height:1.4;">${value}</span>
                </div>`

            // Preload logo as data URL
            let logoDataUrl = ''
            if (schoolLogo) {
                try {
                    const resp = await fetch(schoolLogo)
                    const blob = await resp.blob()
                    logoDataUrl = await new Promise<string>((res, rej) => {
                        const reader = new FileReader()
                        reader.onload = () => res(reader.result as string)
                        reader.onerror = rej
                        reader.readAsDataURL(blob)
                    })
                } catch { /* logo not critical */ }
            }

            // Build 80mm receipt as an off-screen DOM element
            const el = document.createElement('div')
            el.style.cssText = 'position:fixed;top:0;left:-9999px;width:302px;background:white;'
            el.innerHTML = `
                <div style="width:302px;background:white;font-family:var(--font-arabic),system-ui,sans-serif;color:#111;">
                    <div style="background:#10b981;padding:${logoDataUrl ? '12px' : '14px'} 16px;text-align:center;">
                        ${logoDataUrl ? `<img src="${logoDataUrl}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;margin:0 auto 8px;display:block;border:2px solid rgba(255,255,255,0.35);" />` : ''}
                        <div style="font-size:16px;font-weight:800;color:white;">${schoolName || 'QALAMI'}</div>
                        <div style="font-size:9px;color:#a7f3d0;margin-top:2px;letter-spacing:1px;">RECU DE VERSEMENT / وصل الدفع</div>
                    </div>
                    <div style="background:#f0fdf4;padding:5px 14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px dashed #a7f3d0;">
                        <span style="font-size:9px;color:#6b7280;">Ref / المرجع</span>
                        <span style="font-size:10px;font-family:monospace;font-weight:700;color:#064e3b;">${receiptNo}</span>
                    </div>
                    <div style="padding:14px 16px;text-align:center;border-bottom:1px solid #f3f4f6;">
                        <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">MONTANT VERSE / المبلغ المدفوع</div>
                        <div style="font-size:30px;font-weight:800;color:#10b981;line-height:1.1;">
                            ${fmt(trx.amount)}<span style="font-size:13px;font-weight:600;color:#6b7280;margin-left:4px;">MRU</span>
                        </div>
                        <div style="display:inline-block;margin-top:6px;background:#d1fae5;color:#065f46;font-size:9px;font-weight:700;padding:2px 10px;border-radius:99px;">PAYE</div>
                    </div>
                    <div style="padding:10px 14px;border-bottom:1px solid #f3f4f6;">
                        ${row('Bénéficiaire / المستفيد', employeeName, true)}
                        ${row('Type / الصفة', language === 'ar' ? 'employé / موظف' : 'Employé', false)}
                        ${employeeNni ? row('NNI / الرقم الوطني', employeeNni, true) : ''}
                        ${employeePhone ? row('Tel / الهاتف', `<span dir="ltr">${employeePhone}</span>`, !employeeNni) : ''}
                    </div>
                    <div style="padding:10px 14px;border-bottom:1px solid #f3f4f6;">
                        ${row('Catégorie / الفئة', catBilingual.fr + ' / ' + catBilingual.ar, true)}
                        ${row('Date / التاريخ', paymentDate, false)}
                        ${methodBilingual ? row('Méthode / طريقة الدفع', methodBilingual.fr + ' / ' + methodBilingual.ar, true) : ''}
                        ${trx.description && trx.description !== trx.category ? row('Note', trx.description, !methodBilingual) : ''}
                    </div>
                    <div style="display:flex;gap:10px;padding:10px 14px 14px;font-size:9px;color:#9ca3af;text-align:center;">
                        <div style="flex:1;border-top:1px solid #d1d5db;padding-top:4px;">Bénéficiaire / المستفيد</div>
                        <div style="flex:1;border-top:1px solid #d1d5db;padding-top:4px;">Administration / الإدارة</div>
                    </div>
                    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:5px 14px;display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-size:8px;color:#9ca3af;">${printDate}</span>
                        <span style="font-size:8px;font-weight:700;color:#10b981;">Qalami School Manager</span>
                    </div>
                </div>
            `
            document.body.appendChild(el)
            await document.fonts.ready
            await new Promise(r => setTimeout(r, 250))

            const { toJpeg } = await import('html-to-image')
            const { jsPDF }  = await import('jspdf')

            const target = el.firstElementChild as HTMLElement
            await toJpeg(target, { quality: 0.5, pixelRatio: 1 })
            const imgData = await toJpeg(target, {
                quality: 0.96,
                backgroundColor: '#ffffff',
                pixelRatio: 3,
                width: target.offsetWidth,
                height: target.offsetHeight,
            })
            document.body.removeChild(el)

            const img      = new Image()
            img.src        = imgData
            await new Promise(r => { img.onload = r })
            const mmWidth  = 80
            const mmHeight = (img.height / img.width) * mmWidth

            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [mmWidth, mmHeight] })
            doc.addImage(imgData, 'JPEG', 0, 0, mmWidth, mmHeight)
            doc.save(`recu-${employeeName.replace(/\s+/g, '-')}-${receiptNo}.pdf`)
            toast.success(t('admin.employees.finances.receiptDownloaded'))
        } catch (err) {
            console.error(err)
            toast.error(t('admin.employees.finances.receiptError'))
        } finally {
            setGeneratingReceiptId(null)
        }
    }

    const handleGeneratePayrollReceipt = async (p: PayrollRecord) => {
        setGeneratingPayrollReceiptId(p.id)
        try {
            toast.info(language === 'ar' ? 'جارٍ إنشاء الوصل…' : 'Génération du reçu…')

            const locale = language === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR'
            const paymentDate = p.paid_at
                ? new Date(p.paid_at).toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })
                : '—'
            const receiptNo = p.id.slice(0, 8).toUpperCase()
            const monthName = t(`admin.employees.months.${p.month}`) || `Mois ${p.month}`
            const periodLabel = `${monthName} ${p.year}`
            
            const _now = new Date()
            const printDate = _now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Africa/Nouakchott' })
                + ' à ' + _now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nouakchott' })
            const fmt = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

            const row = (label: string, value: string, shade: boolean) =>
                `<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:5px 6px;${shade ? 'background:#f9fafb;' : ''}border-radius:3px;gap:6px;">
                    <span style="color:#6b7280;font-size:10px;flex-shrink:0;white-space:nowrap;padding-top:1px;">${label}</span>
                    <span style="font-weight:600;font-size:10px;color:#111;text-align:right;direction:auto;min-width:0;flex:1;word-break:break-word;overflow-wrap:anywhere;line-height:1.4;">${value}</span>
                </div>`

            // Preload logo as data URL
            let logoDataUrl = ''
            if (schoolLogo) {
                try {
                    const resp = await fetch(schoolLogo)
                    const blob = await resp.blob()
                    logoDataUrl = await new Promise<string>((res, rej) => {
                        const reader = new FileReader()
                        reader.onload = () => res(reader.result as string)
                        reader.onerror = rej
                        reader.readAsDataURL(blob)
                    })
                } catch { /* logo not critical */ }
            }

            // Build 80mm receipt as an off-screen DOM element
            const el = document.createElement('div')
            el.style.cssText = 'position:fixed;top:0;left:-9999px;width:302px;background:white;'
            el.innerHTML = `
                <div style="width:302px;background:white;font-family:var(--font-arabic),system-ui,sans-serif;color:#111;">
                    <div style="background:#10b981;padding:${logoDataUrl ? '12px' : '14px'} 16px;text-align:center;">
                        ${logoDataUrl ? `<img src="${logoDataUrl}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;margin:0 auto 8px;display:block;border:2px solid rgba(255,255,255,0.35);" />` : ''}
                        <div style="font-size:16px;font-weight:800;color:white;">${schoolName || 'QALAMI'}</div>
                        <div style="font-size:9px;color:#a7f3d0;margin-top:2px;letter-spacing:1px;">RECU DE SALAIRE / وصل الراتب</div>
                    </div>
                    <div style="background:#f0fdf4;padding:5px 14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px dashed #a7f3d0;">
                        <span style="font-size:9px;color:#6b7280;">Ref / المرجع</span>
                        <span style="font-size:10px;font-family:monospace;font-weight:700;color:#064e3b;">${receiptNo}</span>
                    </div>
                    <div style="padding:14px 16px;text-align:center;border-bottom:1px solid #f3f4f6;">
                        <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">SALAIRE NET / صافي الراتب</div>
                        <div style="font-size:30px;font-weight:800;color:#10b981;line-height:1.1;">
                            ${fmt(p.net_salary)}<span style="font-size:13px;font-weight:600;color:#6b7280;margin-left:4px;">MRU</span>
                        </div>
                        <div style="display:inline-block;margin-top:6px;background:#d1fae5;color:#065f46;font-size:9px;font-weight:700;padding:2px 10px;border-radius:99px;">PAYE</div>
                    </div>
                    <div style="padding:10px 14px;border-bottom:1px solid #f3f4f6;">
                        ${row('Bénéficiaire / المستفيد', employeeName, true)}
                        ${row('Type / الصفة', language === 'ar' ? 'employé / موظف' : 'Employé', false)}
                        ${employeeNni ? row('NNI / الرقم الوطني', employeeNni, true) : ''}
                        ${employeePhone ? row('Tel / الهاتف', `<span dir="ltr">${employeePhone}</span>`, !employeeNni) : ''}
                    </div>
                    <div style="padding:10px 14px;border-bottom:1px solid #f3f4f6;">
                        ${row('Période / الفترة', periodLabel, true)}
                        ${row('Salaire de base / الراتب الأساسي', `${fmt(p.base_salary)} MRU`, false)}
                        ${Number(p.bonuses) > 0 ? row('Primes / العلاوات', `+${fmt(p.bonuses)} MRU`, true) : ''}
                        ${Number(p.deductions) > 0 ? row('Retenues / الخصومات', `-${fmt(p.deductions)} MRU`, !p.bonuses) : ''}
                        ${row('Date de paiement / تاريخ الدفع', paymentDate, false)}
                    </div>
                    <div style="display:flex;gap:10px;padding:10px 14px 14px;font-size:9px;color:#9ca3af;text-align:center;">
                        <div style="flex:1;border-top:1px solid #d1d5db;padding-top:4px;">Bénéficiaire / المستفيد</div>
                        <div style="flex:1;border-top:1px solid #d1d5db;padding-top:4px;">Administration / الإدارة</div>
                    </div>
                    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:5px 14px;display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-size:8px;color:#9ca3af;">${printDate}</span>
                        <span style="font-size:8px;font-weight:700;color:#10b981;">Qalami School Manager</span>
                    </div>
                </div>
            `
            document.body.appendChild(el)
            await document.fonts.ready
            await new Promise(r => setTimeout(r, 250))

            const { toJpeg } = await import('html-to-image')
            const { jsPDF }  = await import('jspdf')

            const target = el.firstElementChild as HTMLElement
            await toJpeg(target, { quality: 0.5, pixelRatio: 1 })
            const imgData = await toJpeg(target, {
                quality: 0.96,
                backgroundColor: '#ffffff',
                pixelRatio: 3,
                width: target.offsetWidth,
                height: target.offsetHeight,
            })
            document.body.removeChild(el)

            const img      = new Image()
            img.src        = imgData
            await new Promise(r => { img.onload = r })
            const mmWidth  = 80
            const mmHeight = (img.height / img.width) * mmWidth

            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [mmWidth, mmHeight] })
            doc.addImage(imgData, 'JPEG', 0, 0, mmWidth, mmHeight)
            doc.save(`fiche-paie-${employeeName.replace(/\s+/g, '-')}-${receiptNo}.pdf`)
            toast.success(t('admin.employees.finances.receiptDownloaded'))
        } catch (err) {
            console.error(err)
            toast.error(t('admin.employees.finances.receiptError'))
        } finally {
            setGeneratingPayrollReceiptId(null)
        }
    }

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
        </div>
    )

    const totalPaid = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.net_salary || 0), 0)
    const totalTransactions = transactions.reduce((sum, t) => sum + (t.amount || 0), 0)

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-400">

            {/* Header + add button */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-base font-bold text-white">{t('admin.employees.finances.title')}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{t('admin.employees.finances.subtitle')}</p>
                </div>
                <button
                    type="button"
                    onClick={() => setShowForm(v => !v)}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all",
                        showForm
                            ? "text-slate-400 hover:text-white border border-white/5 hover:bg-white/5"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                    )}
                >
                    {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    {showForm ? t('common.cancel') : t('admin.employees.finances.addPayment')}
                </button>
            </div>

            {/* Payment form */}
            {showForm && (
                <div className="bg-[#161B22] rounded-2xl border border-white/5 p-5 space-y-4 animate-in slide-in-from-top-2 duration-300">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                        {t('admin.employees.finances.newPayment')}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 block">
                                {t('admin.employees.finances.amount')}
                            </label>
                            <input
                                type="number"
                                min="1"
                                title={t('admin.employees.finances.amount')}
                                placeholder="0"
                                value={payAmount}
                                onChange={e => setPayAmount(e.target.value)}
                                className="w-full bg-[#0F1720] border border-white/5 rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/5 transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 block">
                                {t('common.date')}
                            </label>
                            <input
                                type="date"
                                title={t('common.date')}
                                value={payDate}
                                onChange={e => setPayDate(e.target.value)}
                                className="w-full bg-[#0F1720] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all scheme-dark"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 block">
                                {t('admin.employees.finances.category')}
                            </label>
                            <select
                                title={t('admin.employees.finances.category')}
                                value={payCategory}
                                onChange={e => setPayCategory(e.target.value)}
                                className="w-full bg-[#0F1720] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                            >
                                {PAYMENT_CATEGORIES.map(c => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 block">
                                {t('admin.employees.finances.method')}
                            </label>
                            <select
                                title={t('admin.employees.finances.method')}
                                value={payMethod}
                                onChange={e => setPayMethod(e.target.value)}
                                className="w-full bg-[#0F1720] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                            >
                                {PAYMENT_METHODS.map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 block">
                            {t('admin.employees.finances.descriptionLabel')}
                        </label>
                        <input
                            type="text"
                            title={t('admin.employees.finances.descriptionLabel')}
                            placeholder={t('admin.employees.finances.descriptionPlaceholder')}
                            value={payDescription}
                            onChange={e => setPayDescription(e.target.value)}
                            className="w-full bg-[#0F1720] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/50 transition-all"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleAddPayment}
                        disabled={submitting || !payAmount}
                        className="flex items-center gap-2 w-full justify-center py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/20"
                    >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        {t('admin.employees.finances.confirmPayment')}
                    </button>
                </div>
            )}

            {/* Contract summary */}
            {!contract ? (
                <div className="bg-[#161B22] rounded-2xl border border-white/5 p-10 text-center">
                    <Banknote className="w-8 h-8 text-white/10 mx-auto mb-3" />
                    <p className="text-sm font-medium text-white/30">{t('admin.employees.finances.noContract')}</p>
                    <p className="text-xs text-slate-700 mt-1 max-w-xs mx-auto">{t('admin.employees.finances.noContractHint')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 bg-[#161B22] rounded-2xl border border-white/5 p-5 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center shrink-0">
                            <Banknote className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5">
                                {t('admin.employees.finances.monthlySalary')}
                            </p>
                            <p className="text-2xl font-bold text-white">
                                {(contract.monthly_salary || 0).toLocaleString('fr-FR')}
                                <span className="text-sm text-slate-500 ms-1.5">MRU</span>
                            </p>
                            {contract.position && <p className="text-xs text-slate-600 mt-0.5">{contract.position}</p>}
                        </div>
                    </div>
                    <div className="bg-[#161B22] rounded-2xl border border-white/5 p-5 flex flex-col items-center justify-center text-center">
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">
                            {t('admin.employees.finances.contractType')}
                        </p>
                        <p className="text-sm font-bold text-white">{contract.contract_type || 'CDI'}</p>
                    </div>
                </div>
            )}

            {/* Total paid */}
            {payments.filter(p => p.status === 'paid').length > 0 && (
                <div className="bg-[#161B22] rounded-2xl border border-white/5 px-5 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-2.5">
                        <TrendingUp className="w-4 h-4 text-slate-500" />
                        <p className="text-sm text-slate-400">{t('admin.employees.finances.totalPaidHistory')}</p>
                    </div>
                    <p className="text-base font-bold text-white">
                        {totalPaid.toLocaleString('fr-FR')}
                        <span className="text-xs text-slate-500 ms-1">MRU</span>
                    </p>
                </div>
            )}

            {/* Payroll section */}
            <TeacherPayrollSection
                teacherId={employeeId}
                onPayrollConfirmed={() => {
                    setPayrollRefreshTick(n => n + 1)
                    fetchTransactions()
                }}
            />

            {/* Staff adjustments */}
            <div className="bg-[#161B22] rounded-2xl border border-white/5 p-5">
                <StaffAdjustments profileId={employeeId} />
            </div>

            {/* Operations */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                        {t('admin.employees.finances.operations')}
                    </p>
                    {transactions.length > 0 && (
                        <span className="text-xs text-slate-600">
                            {transactions.length !== 1
                                ? t('admin.employees.finances.operationsCountPlural').replace('{count}', String(transactions.length))
                                : t('admin.employees.finances.operationsCount').replace('{count}', String(transactions.length))}
                        </span>
                    )}
                </div>

                {txLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                    </div>
                ) : transactions.length === 0 ? (
                    <div className="bg-[#161B22] rounded-2xl border border-white/5 p-10 text-center">
                        <ArrowDownRight className="w-8 h-8 text-white/10 mx-auto mb-3" />
                        <p className="text-sm text-white/20 font-medium">{t('admin.employees.finances.noOperations')}</p>
                        <p className="text-xs text-slate-700 mt-1">{t('admin.employees.finances.noOperationsHint')}</p>
                    </div>
                ) : (
                    <div className="bg-[#161B22] rounded-2xl border border-white/5 overflow-hidden">
                        <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between bg-white/2">
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                                {t('admin.employees.finances.totalPaidExcl')}
                            </p>
                            <p className="text-sm font-bold text-white">
                                {totalTransactions.toLocaleString('fr-FR')}
                                <span className="text-xs text-slate-500 ms-1">MRU</span>
                            </p>
                        </div>
                        <div className="divide-y divide-white/10">
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
                                    <div key={trx.id} className="flex items-start gap-4 px-5 py-4 hover:bg-white/5 transition-colors">
                                        <div className={cn(
                                            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border mt-0.5",
                                            isSalary
                                                ? "bg-white/5 border-white/5 text-slate-400"
                                                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                        )}>
                                            <ArrowDownRight className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-white truncate">{trx.description || catLabel}</p>
                                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                <span className="text-[10px] text-slate-600">{dateStr} · {timeStr}</span>
                                                <span className="text-[10px] bg-white/5 text-slate-400 px-2 py-0.5 rounded-full border border-white/5">{catLabel}</span>
                                                {trx.payment_method && (
                                                    <span className="text-[10px] text-slate-600">{getMethodLabel(trx.payment_method)}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <div className="text-end">
                                                <p className="text-sm font-bold text-white">
                                                    {Number(trx.amount).toLocaleString('fr-FR')}
                                                </p>
                                                <p className="text-[10px] text-slate-600">MRU</p>
                                            </div>
                                            <button
                                                type="button"
                                                title={t('admin.employees.finances.downloadReceipt')}
                                                disabled={generatingReceiptId === trx.id}
                                                onClick={() => handleGenerateReceipt(trx)}
                                                className="p-1.5 text-slate-600 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors disabled:opacity-50"
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

            {/* Payroll history */}
            <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">
                    {t('admin.employees.finances.payrollHistory')}
                </p>
                {payments.length === 0 ? (
                    <div className="bg-[#161B22] rounded-2xl border border-white/5 p-10 text-center">
                        <Calendar className="w-8 h-8 text-white/10 mx-auto mb-3" />
                        <p className="text-sm text-white/20 font-medium">{t('admin.employees.finances.noPayroll')}</p>
                        <p className="text-xs text-slate-700 mt-1">{t('admin.employees.finances.noPayrollHint')}</p>
                    </div>
                ) : (
                    <div className="bg-[#161B22] rounded-2xl border border-white/5 overflow-hidden">
                        <div className="divide-y divide-white/10">
                            {payments.map(p => {
                                const isPaid = p.status === 'paid'
                                const isCancelled = p.status === 'cancelled'
                                const monthName = t(`admin.employees.months.${p.month}`) || `Mois ${p.month}`
                                return (
                                    <div key={p.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors">
                                        <div className={cn(
                                            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border",
                                            isPaid
                                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                                : isCancelled
                                                ? "bg-red-500/10 border-red-500/20 text-red-400"
                                                : "bg-white/5 border-white/5 text-slate-500"
                                        )}>
                                            {isPaid
                                                ? <CheckCircle2 className="w-4 h-4" />
                                                : isCancelled
                                                ? <XCircle className="w-4 h-4" />
                                                : <Clock className="w-4 h-4" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-white">{monthName} {p.year}</p>
                                            <div className="flex items-center gap-3 mt-0.5">
                                                <span className="text-[10px] text-slate-600">
                                                    {t('admin.employees.finances.base')}: {Number(p.base_salary || 0).toLocaleString('fr-FR')} MRU
                                                </span>
                                                {Number(p.bonuses) > 0 && (
                                                    <span className="text-[10px] text-emerald-400/60">+{Number(p.bonuses).toLocaleString('fr-FR')}</span>
                                                )}
                                                {Number(p.deductions) > 0 && (
                                                    <span className="text-[10px] text-red-400/60">-{Number(p.deductions).toLocaleString('fr-FR')}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <div className="text-end">
                                                <p className={cn(
                                                    "text-base font-bold",
                                                    isPaid ? "text-emerald-400"
                                                        : isCancelled ? "text-white/20 line-through"
                                                        : "text-white/40"
                                                )}>
                                                    {Number(p.net_salary || 0).toLocaleString('fr-FR')}
                                                    <span className="text-[10px] text-slate-600 ms-1">MRU</span>
                                                </p>
                                                <p className={cn(
                                                    "text-[10px] uppercase tracking-widest mt-0.5",
                                                    isPaid ? "text-emerald-500/50"
                                                        : isCancelled ? "text-red-500/40"
                                                        : "text-slate-600"
                                                )}>
                                                    {isPaid
                                                        ? t('admin.employees.finances.paid')
                                                        : isCancelled
                                                        ? t('admin.employees.finances.cancelled')
                                                        : t('admin.employees.finances.pending')}
                                                </p>
                                            </div>
                                            {isPaid && (
                                                <button
                                                    type="button"
                                                    title={t('admin.employees.finances.downloadReceipt')}
                                                    disabled={generatingPayrollReceiptId === p.id}
                                                    onClick={() => handleGeneratePayrollReceipt(p)}
                                                    className="p-1.5 text-slate-600 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors disabled:opacity-50"
                                                >
                                                    {generatingPayrollReceiptId === p.id
                                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                                        : <Eye className="w-4 h-4" />
                                                    }
                                                </button>
                                            )}
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
