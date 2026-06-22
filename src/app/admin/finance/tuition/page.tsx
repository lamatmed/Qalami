'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { Loader2, Search, Download, AlertCircle, CheckCircle, Clock, TrendingUp, Users, CreditCard, Bell, Calendar, Eye, Plus, X, UserSearch, BadgeCheck } from 'lucide-react'
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
import { searchStudentByNniAction, markPaymentsPaidAction } from './actions'

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
        return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Nouakchott' })
            + ' · '
            + d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nouakchott' })
    }

    const formatDateOnly = (dateStr: string) => {
        const locale = language === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR'
        return new Date(dateStr).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Nouakchott' })
    }
    const [payments, setPayments] = useState<PaymentRow[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filterStatus, setFilterStatus] = useState('all')
    const [filterType, setFilterType] = useState('all')
    const [filterClass, setFilterClass] = useState('all')
    const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
    const [currentAcademicYear, setCurrentAcademicYear] = useState<string | null>(null)
    const [schoolName, setSchoolName] = useState('')
    const [schoolLogo, setSchoolLogo] = useState('')
    
    const [activeTab, setActiveTab] = useState<'all' | 'late'>('all')
    const [notifyingIds, setNotifyingIds] = useState<Record<string, boolean>>({})
    const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null)

    // NNI payment modal
    const [showPayModal, setShowPayModal]           = useState(false)
    const [nniInput, setNniInput]                   = useState('')
    const [nniLoading, setNniLoading]               = useState(false)
    const [nniStudent, setNniStudent]               = useState<{id: string, full_name: string, phone?: string, national_id: string} | null>(null)
    const [nniPayments, setNniPayments]             = useState<{id: string, payment_type: string, amount: number, payment_status: string, due_date: string | null, paid_at: string | null}[]>([])
    const [nniNotFound, setNniNotFound]             = useState(false)
    const [selectedPayIds, setSelectedPayIds]       = useState<Set<string>>(new Set())
    const [paying, setPaying]                       = useState(false)

    const MONTH_NAMES_FR: Record<number, string> = {
        1:'Janvier',2:'Février',3:'Mars',4:'Avril',5:'Mai',6:'Juin',
        7:'Juillet',8:'Août',9:'Septembre',10:'Octobre',11:'Novembre',12:'Décembre',
    }
    const TYPE_LABELS: Record<string, string> = {
        scolarite:'Scolarité', inscription:'Inscription', bus:'Transport',
        cantine:'Cantine', activites:'Activités', cotisation:'Cotisation', autres:'Autres',
    }

    const openPayModal = () => {
        setShowPayModal(true)
        setNniInput('')
        setNniStudent(null)
        setNniPayments([])
        setNniNotFound(false)
        setSelectedPayIds(new Set())
    }

    const handleNniSearch = async () => {
        if (!nniInput.trim()) return
        setNniLoading(true)
        setNniStudent(null)
        setNniPayments([])
        setNniNotFound(false)
        setSelectedPayIds(new Set())
        const res = await searchStudentByNniAction(nniInput.trim())
        setNniLoading(false)
        if (res.error) { toast.error(res.error); return }
        if (!res.student) { setNniNotFound(true); return }
        setNniStudent(res.student)
        setNniPayments(res.payments)
        // Pre-select unpaid rows only
        setSelectedPayIds(new Set(res.payments.filter((p: any) => p.payment_status !== 'paid').map((p: any) => p.id)))
    }

    const togglePayId = (id: string) => {
        setSelectedPayIds(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    const generateNniReceipt = async (
        student: { full_name: string; national_id: string; phone?: string },
        paidRows: { payment_type: string; amount: number; due_date: string | null }[],
        allPaidTotal: number
    ) => {
        try {
            toast.info(language === 'ar' ? 'جارٍ إنشاء الوصل…' : 'Génération du reçu…')
            const locale = language === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR'
            const printDate = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Africa/Nouakchott' })
                + ' à ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nouakchott' })
            const totalAmount = paidRows.reduce((s, p) => s + Number(p.amount), 0)
            const shortId = Math.random().toString(36).slice(2, 10).toUpperCase()
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
                        <div style="font-size:9px;color:#a7f3d0;margin-top:2px;letter-spacing:1px;">RECU DE PAIEMENT / وصل الدفع</div>
                    </div>
                    <div style="background:#f0fdf4;padding:5px 14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px dashed #a7f3d0;">
                        <span style="font-size:9px;color:#6b7280;">Ref / المرجع</span>
                        <span style="font-size:10px;font-family:monospace;font-weight:700;color:#064e3b;">${shortId}</span>
                    </div>
                    <div style="padding:14px 16px;text-align:center;border-bottom:1px solid #f3f4f6;">
                        <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">MONTANT TOTAL PAYE / إجمالي المبلغ المدفوع</div>
                        <div style="font-size:30px;font-weight:800;color:#10b981;line-height:1.1;">
                            ${fmt(totalAmount)}<span style="font-size:13px;font-weight:600;color:#6b7280;margin-left:4px;">MRU</span>
                        </div>
                        <div style="display:inline-block;margin-top:6px;background:#d1fae5;color:#065f46;font-size:9px;font-weight:700;padding:2px 10px;border-radius:99px;">PAYE</div>
                    </div>
                    <div style="padding:10px 14px;border-bottom:1px solid #f3f4f6;">
                        ${row('Eleve / الطالب', student.full_name, true)}
                        ${student.national_id ? row('NNI', student.national_id, false) : ''}
                        ${student.phone ? row('Tel / الهاتف', `<span dir="ltr">${student.phone}</span>`, true) : ''}
                    </div>
                    <div style="padding:10px 14px;border-bottom:1px solid #f3f4f6;">
                        <div style="font-size:9px;color:#6b7280;font-weight:700;margin-bottom:6px;text-align:left;">DETAILS / التفاصيل</div>
                        ${paidRows.map((p, idx) => {
                            const monthNum = p.due_date ? new Date(p.due_date).getMonth() + 1 : null
                            const yearNum  = p.due_date ? new Date(p.due_date).getFullYear() : null
                            const monthNameFr = monthNum ? MONTH_NAMES_FR[monthNum] : ''
                            const monthNameAr = monthNum ? (({
                                1: 'يناير', 2: 'فبراير', 3: 'مارس', 4: 'أبريل',
                                5: 'مايو', 6: 'يونيو', 7: 'يوليو', 8: 'أغسطس',
                                9: 'سبتمبر', 10: 'أكتوبر', 11: 'نوفمبر', 12: 'ديسمبر'
                            } as Record<number, string>)[monthNum] || '') : ''
                            const monthLabel = (monthNum && yearNum)
                                ? (language === 'ar' ? `${monthNameAr} ${yearNum} / ${monthNameFr} ${yearNum}` : `${monthNameFr} ${yearNum}`)
                                : 'Divers'
                            const typeLabel  = TYPE_LABELS[p.payment_type] ?? p.payment_type
                            return row(`${monthLabel} — ${typeLabel}`, `${fmt(p.amount)} MRU`, idx % 2 === 0)
                        }).join('')}
                    </div>
                    ${allPaidTotal > totalAmount ? `
                    <div style="padding:10px 14px;border-bottom:1px solid #f3f4f6;background:#f0fdf4;">
                        ${row('Total payé (tous mois) / إجمالي المدفوع', `${fmt(allPaidTotal)} MRU`, false)}
                    </div>` : ''}
                    <div style="display:flex;gap:10px;padding:10px 14px 14px;font-size:9px;color:#9ca3af;text-align:center;">
                        <div style="flex:1;border-top:1px solid #d1d5db;padding-top:4px;">Parent / ولي الأمر</div>
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
            doc.save(`recu-${student.full_name.replace(/\s+/g, '-')}-${shortId}.pdf`)
            toast.success(language === 'ar' ? 'تم تنزيل الوصل' : 'Reçu PDF téléchargé')
        } catch (err) {
            console.error(err)
            toast.error(language === 'ar' ? 'خطأ في إنشاء PDF' : 'Erreur lors de la génération du reçu')
        }
    }

    const handleConfirmPayment = async () => {
        if (!selectedPayIds.size) return
        setPaying(true)
        const paidRows = nniPayments.filter(p => selectedPayIds.has(p.id))
        const alreadyPaidTotal = nniPayments
            .filter(p => p.payment_status === 'paid')
            .reduce((s, p) => s + Number(p.amount), 0)
        const thisTotal = paidRows.reduce((s, p) => s + Number(p.amount), 0)
        const allPaidTotal = alreadyPaidTotal + thisTotal
        const res = await markPaymentsPaidAction([...selectedPayIds])
        setPaying(false)
        if (res.error) { toast.error(res.error); return }
        toast.success(`${selectedPayIds.size} paiement${selectedPayIds.size > 1 ? 's' : ''} enregistré${selectedPayIds.size > 1 ? 's' : ''}`)
        setShowPayModal(false)
        fetchData()
        if (nniStudent) generateNniReceipt(nniStudent, paidRows, allPaidTotal)
    }

    const handleViewPdf = async (p: PaymentRow) => {
        setGeneratingPdfId(p.id)
        try {
            const supabase = createClient()
            const { data: profile } = await supabase
                .from('profiles')
                .select('national_id, phone')
                .eq('id', p.student_id)
                .maybeSingle()

            const locale = language === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR'
            const paymentDate = p.paid_at
                ? new Date(p.paid_at).toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })
                : '—'
            const printDate = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Africa/Nouakchott' })
                + ' à ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nouakchott' })
            const shortId = p.id.slice(0, 8).toUpperCase()
            const remaining = p.amount - p.amount_paid
            const fmt = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

            const typeLabel = TYPE_LABELS[p.payment_type] ?? p.payment_type
            const statusLabel =
                p.status === 'paid'    ? (language === 'ar' ? 'payé / مدفوع' : 'Payé') :
                p.status === 'partial' ? (language === 'ar' ? 'partiel / جزئي' : 'Partiel') :
                p.status === 'overdue' ? (language === 'ar' ? 'en retard / متأخر' : 'En retard') : (language === 'ar' ? 'en attente / في الانتظار' : 'En attente')

            const monthNum = p.due_date ? new Date(p.due_date).getMonth() + 1 : null
            const yearNum = p.due_date ? new Date(p.due_date).getFullYear() : null
            let monthLabel = ''
            if (monthNum && yearNum) {
                const monthNameFr = MONTH_NAMES_FR[monthNum] || ''
                const monthNameAr = ({
                    1: 'يناير', 2: 'فبراير', 3: 'مارس', 4: 'أبريل',
                    5: 'مايو', 6: 'يونيو', 7: 'يوليو', 8: 'أغسطس',
                    9: 'سبتمبر', 10: 'أكتوبر', 11: 'نوفمبر', 12: 'ديسمبر'
                } as Record<number, string>)[monthNum] || ''
                monthLabel = language === 'ar'
                    ? `${monthNameAr} ${yearNum} / ${monthNameFr} ${yearNum}`
                    : `${monthNameFr} ${yearNum}`
            }

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
                        <div style="font-size:9px;color:#a7f3d0;margin-top:2px;letter-spacing:1px;">RECU DE PAIEMENT / وصل الدفع</div>
                    </div>
                    <div style="background:#f0fdf4;padding:5px 14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px dashed #a7f3d0;">
                        <span style="font-size:9px;color:#6b7280;">Ref / المرجع</span>
                        <span style="font-size:10px;font-family:monospace;font-weight:700;color:#064e3b;">${shortId}</span>
                    </div>
                    <div style="padding:14px 16px;text-align:center;border-bottom:1px solid #f3f4f6;">
                        <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">MONTANT PAYE / المبلغ المدفوع</div>
                        <div style="font-size:30px;font-weight:800;color:#10b981;line-height:1.1;">
                            ${fmt(p.amount_paid)}<span style="font-size:13px;font-weight:600;color:#6b7280;margin-left:4px;">MRU</span>
                        </div>
                        <div style="display:inline-block;margin-top:6px;background:${p.status === 'paid' ? '#d1fae5' : '#fef3c7'};color:${p.status === 'paid' ? '#065f46' : '#92400e'};font-size:9px;font-weight:700;padding:2px 10px;border-radius:99px;text-transform:uppercase;">
                            ${statusLabel}
                        </div>
                    </div>
                    <div style="padding:10px 14px;border-bottom:1px solid #f3f4f6;">
                        ${row('Eleve / الطالب', p.student_name, true)}
                        ${p.class_name ? row('Classe / القسم', p.class_name, false) : ''}
                        ${profile?.national_id ? row('NNI', profile.national_id, true) : ''}
                        ${profile?.phone ? row('Tel / الهاتف', `<span dir="ltr">${profile.phone}</span>`, !profile.national_id) : ''}
                    </div>
                    <div style="padding:10px 14px;border-bottom:1px solid #f3f4f6;">
                        ${row('Type', typeLabel, true)}
                        ${monthLabel ? row('Période / الفترة', monthLabel, false) : ''}
                        ${row('Date / التاريخ', paymentDate, !!monthLabel)}
                        ${row('Montant total / المبلغ الإجمالي', `${fmt(p.amount)} MRU`, !monthLabel)}
                        ${remaining > 0 ? row('Reste à payer / المتبقي', `${fmt(remaining)} MRU`, !monthLabel) : ''}
                    </div>
                    <div style="display:flex;gap:10px;padding:10px 14px 14px;font-size:9px;color:#9ca3af;text-align:center;">
                        <div style="flex:1;border-top:1px solid #d1d5db;padding-top:4px;">Parent / ولي الأمر</div>
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
            doc.save(`recu-${p.student_name.replace(/\s+/g, '-')}-${shortId}.pdf`)
            toast.success(language === 'ar' ? 'تم تنزيل الوصل' : 'PDF téléchargé avec succès')
        } catch (err) {
            console.error(err)
            toast.error(language === 'ar' ? 'خطأ في إنشاء PDF' : 'Erreur lors de la génération du PDF')
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

        // Fetch school settings / school name and logo
        const { data: schoolSettings } = await supabase
            .from('school_settings')
            .select('name, logo_url')
            .eq('school_id', profile.school_id)
            .maybeSingle()

        let sName = schoolSettings?.name || null
        let sLogo = schoolSettings?.logo_url || null

        if (!sLogo || !sName) {
            const { data: schoolRow } = await supabase
                .from('schools')
                .select('name, logo_url')
                .eq('id', profile.school_id)
                .maybeSingle()
            if (!sLogo) sLogo = schoolRow?.logo_url || null
            if (!sName) sName = schoolRow?.name || null
        }

        if (sName) setSchoolName(sName)
        if (sLogo) setSchoolLogo(sLogo)

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
        const effectivePartialMap = new Map<string, number>() // payment id → tx-covered amount
        ;[...(paymentsData || [])]
            .filter((p: any) => p.payment_status !== 'paid')
            .sort((a: any, b: any) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
            .forEach((p: any) => {
                const bal = txBalance.get(p.student_id) ?? 0
                if (bal >= Number(p.amount)) {
                    effectivelyPaidIds.add(p.id)
                    effectivePartialMap.set(p.id, Number(p.amount))
                    txBalance.set(p.student_id, bal - Number(p.amount))
                } else if (bal > 0) {
                    effectivePartialMap.set(p.id, bal)
                    txBalance.set(p.student_id, 0)
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
            const txAmountPaid = effectivePartialMap.get(p.id) ?? 0
            const effectiveAmountPaid = isPaid ? numericAmt : txAmountPaid
            const isPartial = !isPaid && effectiveAmountPaid > 0
            return {
                id: p.id,
                student_id: p.student_id,
                student_name: p.profiles?.full_name ?? '—',
                class_name: enrollmentMap[p.student_id] ?? null,
                payment_type: p.payment_type ?? 'scolarite',
                amount: numericAmt,
                amount_paid: effectiveAmountPaid,
                status: isPaid ? 'paid' : (isPartial ? 'partial' : (p.payment_status ?? 'pending')),
                due_date: p.due_date,
                paid_at: isPaid ? (p.paid_at ?? new Date().toISOString()) : null,
                academic_year_id: p.academic_year_id,
            }
        })

        // Detect split partial payments:
        // When a partial payment is recorded via the student profile, the original row is
        // shrunk+paid and a remainder row is created with the same student+type+due_date.
        // We consolidate them: hide the split paid rows, show one merged 'partial' row
        // with the original total (remainder + paid) and correct amount_paid.

        // Step 1 – find signatures that have a pending/overdue sibling
        const pendingSigs = new Set<string>()
        rows.forEach(r => {
            if ((r.status === 'pending' || r.status === 'overdue') && r.due_date)
                pendingSigs.add(`${r.student_id}|${r.payment_type}|${r.due_date}`)
        })

        // Step 2 – accumulate paid amounts only for those signatures, mark their row IDs
        const paidAmountBySig = new Map<string, number>()
        const splitPaidIds = new Set<string>()
        rows.forEach(r => {
            if (r.status === 'paid' && r.due_date) {
                const sig = `${r.student_id}|${r.payment_type}|${r.due_date}`
                if (pendingSigs.has(sig)) {
                    paidAmountBySig.set(sig, (paidAmountBySig.get(sig) ?? 0) + r.amount)
                    splitPaidIds.add(r.id)
                }
            }
        })

        // Step 3 – build final rows: drop split paid rows, merge info into partial row
        const finalRows = rows
            .filter(r => !splitPaidIds.has(r.id))
            .map(r => {
                if ((r.status === 'pending' || r.status === 'overdue') && r.due_date) {
                    const sig = `${r.student_id}|${r.payment_type}|${r.due_date}`
                    const paidAmt = paidAmountBySig.get(sig)
                    if (paidAmt) {
                        return { ...r, status: 'partial', amount: r.amount + paidAmt, amount_paid: paidAmt }
                    }
                }
                return r
            })

        setPayments(finalRows)
        setLoading(false)
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    // ── Filters ──────────────────────────────────────────────────────────────
    const todayStr = new Date().toISOString().split('T')[0]
    // "En retard" = due date is in a PAST month (strictly before current month's first day)
    const startOfCurrentMonthStr = todayStr.slice(0, 7) + '-01'

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
    }).sort((a, b) => {
        // Most recent first: use paid_at for paid items, due_date for pending
        const dateA = a.paid_at ?? a.due_date ?? ''
        const dateB = b.paid_at ?? b.due_date ?? ''
        return dateB.localeCompare(dateA)
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
        // A payment is "En retard" only if its due_date falls in a PAST month (not the current month)
        const isLate = p.status !== 'paid' && p.due_date != null && p.due_date < startOfCurrentMonthStr
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
    const overduePayments = knownPayments.filter(p => p.status !== 'paid' && p.due_date != null && p.due_date < startOfCurrentMonthStr)

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
            <div className="flex justify-end gap-3">
                <Button
                    variant="outline"
                    className="border-white/10 bg-[#161B22] text-gray-300 hover:text-white hover:bg-white/5"
                    onClick={handleExport}
                >
                    <Download className="w-4 h-4 mr-2" />
                    {t('admin.tuition.exportCsv')}
                </Button>
                <Button
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-900/30"
                    onClick={openPayModal}
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Enregistrer un paiement
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
                        style={{ '--bar-width': `${recoveryRate}%` } as React.CSSProperties}
                        className={cn(
                            "h-full rounded-full transition-all duration-700 w-[var(--bar-width)]",
                            recoveryRate >= 80 ? "bg-emerald-500" :
                                recoveryRate >= 50 ? "bg-amber-500" : "bg-red-500"
                        )}
                    />
                </div>
            </div>

            {/* Tabs Navigation */}
            <div className="flex border-b border-white/5 gap-6">
                <button
                    type="button"
                    onClick={() => setActiveTab('all')}
                    className={cn(
                        "pb-3 text-sm font-bold transition-all relative px-1 outline-none",
                        activeTab === 'all' ? "text-emerald-400 border-b-2 border-emerald-400" : "text-gray-400 hover:text-gray-300"
                    )}
                >
                    Toutes les Échéances ({filtered.length})
                </button>
                <button
                    type="button"
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
                                                        <Link href={`/admin/students/${p.student_id}`} className="flex items-center gap-3 group/link">
                                                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 flex items-center justify-center text-emerald-500 font-bold text-xs shrink-0">
                                                                {p.student_name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
                                                            </div>
                                                            <span className="font-medium text-white text-sm group-hover/link:text-emerald-400 transition-colors">{p.student_name}</span>
                                                        </Link>
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
                                                        <Link href={`/admin/students/${s.studentId}?tab=payments`} className="flex items-center gap-3 group/link">
                                                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500/20 to-red-500/20 flex items-center justify-center text-amber-500 font-bold text-xs shrink-0">
                                                                {s.studentName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
                                                            </div>
                                                            <span className="font-semibold text-white text-sm group-hover/link:text-emerald-400 transition-colors">{s.studentName}</span>
                                                        </Link>
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
            {/* ── NNI Payment Modal ── */}
            {showPayModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPayModal(false)} />
                    <div className="relative z-10 bg-[#0F1720] border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">

                        {/* Modal header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                    <UserSearch className="w-4 h-4 text-emerald-400" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-white">Paiement par NNI</h2>
                                    <p className="text-xs text-gray-500">Recherchez un élève par son numéro national</p>
                                </div>
                            </div>
                            <button type="button" title="Fermer" onClick={() => setShowPayModal(false)} className="text-gray-500 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* NNI search input */}
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input
                                        type="text"
                                        placeholder="Numéro NNI de l'élève..."
                                        value={nniInput}
                                        onChange={e => setNniInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleNniSearch()}
                                        className="w-full pl-9 pr-3 py-2.5 bg-[#1A2530] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleNniSearch}
                                    disabled={nniLoading || !nniInput.trim()}
                                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2"
                                >
                                    {nniLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                    Chercher
                                </button>
                            </div>

                            {/* Not found */}
                            {nniNotFound && (
                                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3">
                                    <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                                    <div>
                                        <p className="text-sm font-bold text-amber-400">Aucun élève trouvé</p>
                                        <p className="text-xs text-gray-500 mt-0.5">Aucun profil ne correspond à ce NNI dans votre école</p>
                                    </div>
                                </div>
                            )}

                            {/* Student found */}
                            {nniStudent && (
                                <>
                                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-black text-sm shrink-0">
                                            {nniStudent.full_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-white text-sm">{nniStudent.full_name}</p>
                                            <div className="flex items-center gap-3 mt-0.5">
                                                <span className="text-xs text-gray-500">NNI : {nniStudent.national_id}</span>
                                                {nniStudent.phone && <span className="text-xs text-gray-500" dir="ltr">{nniStudent.phone}</span>}
                                            </div>
                                        </div>
                                        <BadgeCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                                    </div>

                                    {/* Unpaid months */}
                                    {nniPayments.length === 0 ? (
                                        <div className="bg-[#1A2530] rounded-2xl border border-white/5 p-6 text-center">
                                            <CheckCircle className="w-8 h-8 text-emerald-500/40 mx-auto mb-2" />
                                            <p className="text-sm font-bold text-emerald-400">Aucun paiement enregistré</p>
                                        </div>
                                    ) : (() => {
                                        const unpaidRows = nniPayments.filter(p => p.payment_status !== 'paid')
                                        const paidRows   = nniPayments.filter(p => p.payment_status === 'paid')
                                        const nowStr = new Date().toISOString().slice(0, 7) + '-01'
                                        const paidTotal = paidRows.reduce((s, p) => s + Number(p.amount), 0)
                                        return (
                                            <div className="space-y-2">
                                                {/* Header row */}
                                                <div className="flex items-center justify-between">
                                                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">
                                                        {nniPayments.length} mois · {paidRows.length} payé{paidRows.length > 1 ? 's' : ''}, {unpaidRows.length} restant{unpaidRows.length > 1 ? 's' : ''}
                                                    </p>
                                                    {unpaidRows.length > 0 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const allUnpaidIds = unpaidRows.map(p => p.id)
                                                                setSelectedPayIds(prev =>
                                                                    prev.size === unpaidRows.length
                                                                        ? new Set()
                                                                        : new Set(allUnpaidIds)
                                                                )
                                                            }}
                                                            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
                                                        >
                                                            {selectedPayIds.size === unpaidRows.length ? 'Désélectionner' : 'Tout sélectionner'}
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                                                    {nniPayments.map(p => {
                                                        const isPaid     = p.payment_status === 'paid'
                                                        const selected   = selectedPayIds.has(p.id)
                                                        const monthNum   = p.due_date ? new Date(p.due_date).getMonth() + 1 : null
                                                        const yearNum    = p.due_date ? new Date(p.due_date).getFullYear() : null
                                                        const monthLabel = monthNum ? `${MONTH_NAMES_FR[monthNum]} ${yearNum}` : 'Date inconnue'
                                                        const typeLabel  = TYPE_LABELS[p.payment_type] ?? p.payment_type
                                                        const isLate     = !isPaid && p.due_date && p.due_date < nowStr

                                                        if (isPaid) {
                                                            return (
                                                                <div key={p.id} className="flex items-center gap-3 p-3.5 rounded-xl border border-violet-400/40 bg-violet-500/10">
                                                                    <CheckCircle className="w-4 h-4 text-violet-300 shrink-0" />
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-sm font-bold text-white">{monthLabel}</p>
                                                                        <p className="text-xs text-violet-300/70">{typeLabel}</p>
                                                                    </div>
                                                                    <div className="text-right shrink-0">
                                                                        <p className="text-sm font-black text-violet-300">{Number(p.amount).toLocaleString('fr-FR')} <span className="text-xs font-normal text-violet-400/60">MRU</span></p>
                                                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-white bg-violet-500 px-2 py-0.5 rounded-full">✓ Payé</span>
                                                                    </div>
                                                                </div>
                                                            )
                                                        }

                                                        return (
                                                            <button
                                                                key={p.id}
                                                                type="button"
                                                                onClick={() => togglePayId(p.id)}
                                                                className={cn(
                                                                    "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                                                                    selected
                                                                        ? "border-emerald-500/30 bg-emerald-500/5"
                                                                        : "border-white/5 bg-[#1A2530] hover:border-white/10"
                                                                )}
                                                            >
                                                                <div className={cn(
                                                                    "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                                                                    selected ? "bg-emerald-500 border-emerald-500" : "border-gray-600"
                                                                )}>
                                                                    {selected && <CheckCircle className="w-2.5 h-2.5 text-white" />}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-bold text-white">{monthLabel}</p>
                                                                    <p className="text-xs text-gray-500">{typeLabel}</p>
                                                                </div>
                                                                <div className="text-right shrink-0">
                                                                    <p className="text-sm font-black text-white">{Number(p.amount).toLocaleString('fr-FR')} <span className="text-[10px] text-gray-500 font-normal">MRU</span></p>
                                                                    {isLate && <span className="text-[10px] text-red-400 font-bold">En retard</span>}
                                                                </div>
                                                            </button>
                                                        )
                                                    })}
                                                </div>

                                                {/* Already paid summary */}
                                                {paidTotal > 0 && (
                                                    <div className="flex items-center justify-between px-3.5 py-2.5 bg-violet-500/10 rounded-xl border border-violet-400/30">
                                                        <span className="text-xs font-semibold text-violet-300">Total déjà payé</span>
                                                        <span className="text-sm font-black text-violet-300">{paidTotal.toLocaleString('fr-FR')} <span className="text-xs font-normal text-violet-400/60">MRU</span></span>
                                                    </div>
                                                )}

                                                {/* Confirm section */}
                                                {selectedPayIds.size > 0 ? (
                                                    <div className="pt-3 border-t border-white/5 space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-gray-400">{selectedPayIds.size} mois à payer</span>
                                                            <span className="text-base font-black text-white">
                                                                {nniPayments.filter(p => selectedPayIds.has(p.id)).reduce((s, p) => s + Number(p.amount), 0).toLocaleString('fr-FR')}{' '}
                                                                <span className="text-xs text-gray-400 font-normal">MRU</span>
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={handleConfirmPayment}
                                                            disabled={paying}
                                                            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
                                                        >
                                                            {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                                            Confirmer et télécharger le reçu
                                                        </button>
                                                    </div>
                                                ) : unpaidRows.length === 0 ? (
                                                    <div className="pt-2 text-center">
                                                        <p className="text-sm font-bold text-emerald-400">✓ Tous les mois sont payés</p>
                                                    </div>
                                                ) : null}
                                            </div>
                                        )
                                    })()}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
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
