'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { CreditCard, Clock, CheckCircle2, X, Loader2, Send, Printer, Search, Filter, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { createClient } from '@/utils/supabase/client'
import { useLanguage } from '@/i18n'

interface StudentPaymentsProps {
    studentId?: string
    studentName?: string
    schoolId: string
    isArchived?: boolean
}

interface FinanceItem {
    id: string
    amount: number
    payment_type: string
    payment_status: string
    due_date: string | null
    paid_at: string | null
    description?: string | null
    receipt_number?: string | null
    source: 'payment' | 'transaction'
}

export function StudentPayments({ studentId, studentName, schoolId, isArchived }: StudentPaymentsProps) {
    const { t, language } = useLanguage()
    const [payments, setPayments] = useState<FinanceItem[]>([])
    const [loading, setLoading] = useState(true)
    const [showPaymentForm, setShowPaymentForm] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [sendingReminder, setSendingReminder] = useState(false)

    // Payment form state
    const [paymentAmount, setPaymentAmount] = useState('')
    const [paymentType, setPaymentType] = useState('scolarite')
    const [paymentNote, setPaymentNote] = useState('')

    // History filters
    const [filterSearch, setFilterSearch] = useState('')
    const [filterType, setFilterType] = useState('')
    const [filterStatus, setFilterStatus] = useState('')
    const [filterDateFrom, setFilterDateFrom] = useState('')
    const [filterDateTo, setFilterDateTo] = useState('')
    const [showFilters, setShowFilters] = useState(false)

    const [resolvedStudentName, setResolvedStudentName] = useState(studentName || '')
    const [studentClass, setStudentClass] = useState('')
    const [studentNni, setStudentNni] = useState('')
    const [parentName, setParentName] = useState('')
    const [parentPhone, setParentPhone] = useState('')
    const [schoolName, setSchoolName] = useState('')
    const [schoolLogo, setSchoolLogo] = useState('')

    const fetchPayments = async () => {
        if (!studentId) {
            setLoading(false)
            return
        }

        const supabase = createClient()
        const [paymentsRes, transactionsRes] = await Promise.all([
            supabase
                .from('payments')
                .select('id, amount, payment_type, payment_status, due_date, paid_at, description, receipt_number')
                .eq('student_id', studentId)
                .eq('school_id', schoolId)
                .order('due_date', { ascending: false }),
            supabase
                .from('transactions')
                .select('id, amount, category, description, transaction_date, created_at')
                .eq('related_profile_id', studentId)
                .eq('school_id', schoolId)
                .eq('type', 'income')
                .eq('status', 'completed')
                .order('created_at', { ascending: false })
        ])

        if (paymentsRes.error) console.error('[StudentPayments] Error:', paymentsRes.error)

        const paymentItems: FinanceItem[] = (paymentsRes.data || []).map((p: any) => ({
            ...p,
            source: 'payment' as const
        }))

        const txItems: FinanceItem[] = (transactionsRes.data || []).map((tx: any) => ({
            id: tx.id,
            amount: tx.amount,
            payment_type: tx.category || 'autre',
            payment_status: 'paid',
            due_date: tx.transaction_date || null,
            paid_at: tx.created_at || (tx.transaction_date ? tx.transaction_date : null),
            description: tx.description || null,
            receipt_number: null,
            source: 'transaction' as const
        }))

        const merged = [...paymentItems, ...txItems].sort((a, b) => {
            const da = new Date(a.paid_at || a.due_date || '').getTime()
            const db = new Date(b.paid_at || b.due_date || '').getTime()
            return db - da
        })

        setPayments(merged)
        setLoading(false)
    }

    useEffect(() => {
        const fetchStudentDetails = async () => {
            if (!studentId) return
            try {
                const supabase = createClient()
                const { data, error } = await supabase
                    .from('profiles')
                    .select(`
                        full_name,
                        national_id,
                        school_id,
                        enrollments (
                            classes ( name )
                        )
                    `)
                    .eq('id', studentId)
                    .single()

                if (!error && data) {
                    if (data.full_name) {
                        setResolvedStudentName(data.full_name)
                    }
                    if (data.national_id) {
                        setStudentNni(data.national_id)
                    }
                    const enrollments = data.enrollments as any[]
                    const firstEnrollment = enrollments?.[0]
                    if (firstEnrollment?.classes?.name) {
                        setStudentClass(firstEnrollment.classes.name)
                    }

                    // Fetch parent info
                    const { data: links, error: linkError } = await supabase
                        .from('parent_student_links')
                        .select('parent_id, profiles!parent_student_links_parent_id_fkey (full_name, phone)')
                        .eq('student_id', studentId)

                    if (!linkError && links && links.length > 0) {
                        const parentProfile = links[0]?.profiles as any
                        if (parentProfile) {
                            if (parentProfile.full_name) setParentName(parentProfile.full_name)
                            if (parentProfile.phone) setParentPhone(parentProfile.phone)
                        }
                    }

                    // Fetch school settings / school name and logo
                    if (data.school_id) {
                        const { data: schoolSettings } = await supabase
                            .from('school_settings')
                            .select('name, logo_url')
                            .eq('school_id', data.school_id)
                            .maybeSingle()

                        let sName = schoolSettings?.name || null
                        let sLogo = schoolSettings?.logo_url || null

                        if (!sLogo || !sName) {
                            const { data: schoolRow } = await supabase
                                .from('schools')
                                .select('name, logo_url')
                                .eq('id', data.school_id)
                                .maybeSingle()
                            if (!sLogo) sLogo = schoolRow?.logo_url || null
                            if (!sName) sName = schoolRow?.name || null
                        }

                        if (sName) setSchoolName(sName)
                        if (sLogo) setSchoolLogo(sLogo)
                    }
                }
            } catch (err) {
                console.error('[StudentPayments] Error fetching student details:', err)
            }
        }

        fetchPayments()
        fetchStudentDetails()
    }, [studentId, schoolId])

    const feePayments = payments.filter(p => p.source === 'payment')
    const totalDue = feePayments.reduce((sum, p) => sum + Number(p.amount), 0)
    const totalPaid = feePayments.filter(p => p.payment_status === 'paid').reduce((sum, p) => sum + Number(p.amount), 0)
    const paidPercentage = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0
    const remaining = totalDue - totalPaid

    // Scolarité: fully paid when all rows are paid
    const scolariteRows = feePayments.filter(p => p.payment_type === 'scolarite')
    const scolariteDue = scolariteRows.reduce((sum, p) => sum + Number(p.amount), 0)
    const scolaritePaidAmt = scolariteRows.filter(p => p.payment_status === 'paid').reduce((sum, p) => sum + Number(p.amount), 0)
    const scolariteFullyPaid = scolariteDue > 0 && scolaritePaidAmt >= scolariteDue

    // Inscription: hidden once any paid inscription row exists
    const inscriptionPaid = feePayments.some(p => p.payment_type === 'inscription' && p.payment_status === 'paid')

    const getBilingualTypeLabel = (type: string) => {
        const labels: Record<string, { fr: string; ar: string }> = {
            scolarite: { fr: 'Scolarité', ar: 'الرسوم الدراسية' },
            bus: { fr: 'Transport', ar: 'رسوم النقل' },
            cantine: { fr: 'Cantine', ar: 'رسوم الإطعام' },
            inscription: { fr: 'Inscription', ar: 'رسوم التسجيل' },
            activites: { fr: 'Activités', ar: 'رسوم الأنشطة' },
            transport: { fr: 'Transport', ar: 'رسوم النقل' },
            restauration: { fr: 'Restauration', ar: 'رسوم الإطعام' },
            cotisation: { fr: 'Cotisation', ar: 'الاشتراك' },
            autre: { fr: 'Autres', ar: 'أخرى' },
            autres: { fr: 'Autres', ar: 'أخرى' },
        }
        return labels[type] || { fr: type, ar: type }
    }

    const handlePrintReceipt = async (payment: FinanceItem) => {
        try {
            toast.info(language === 'ar' ? 'جارٍ إنشاء الوصل…' : 'Génération du reçu…')

            const locale = language === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR'
            const paymentDate = payment.paid_at
                ? new Date(payment.paid_at).toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })
                : '—'
            const receiptNo = payment.receipt_number || payment.id.substring(0, 8).toUpperCase()
            const types = getBilingualTypeLabel(payment.payment_type)
            const _now = new Date()
            const printDate = _now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Africa/Nouakchott' })
                + ' à ' + _now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nouakchott' })
            const fmt = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

            // Row helper — renders Arabic correctly because browser handles the font
            const row = (label: string, value: string, shade: boolean) =>
                `<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:5px 6px;${shade ? 'background:#f9fafb;' : ''}border-radius:3px;gap:6px;">
                    <span style="color:#6b7280;font-size:10px;flex-shrink:0;white-space:nowrap;padding-top:1px;">${label}</span>
                    <span style="font-weight:600;font-size:10px;color:#111;text-align:right;direction:auto;min-width:0;flex:1;word-break:break-word;overflow-wrap:anywhere;line-height:1.4;">${value}</span>
                </div>`

            // Preload logo as data URL (html-to-image can't fetch cross-origin URLs)
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

            // Build 80mm receipt as an off-screen DOM element so browser renders Arabic
            const el = document.createElement('div')
            el.style.cssText = 'position:fixed;top:0;left:-9999px;width:302px;background:white;visibility:hidden;'
            el.innerHTML = `
                <div style="width:302px;background:white;font-family:var(--font-arabic),system-ui,sans-serif;color:#111;">
                    <div style="background:#10b981;padding:${logoDataUrl ? '12px' : '14px'} 16px;text-align:center;">
                        ${logoDataUrl ? `<img src="${logoDataUrl}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;margin:0 auto 8px;display:block;border:2px solid rgba(255,255,255,0.35);" />` : ''}
                        <div style="font-size:16px;font-weight:800;color:white;">${schoolName || 'QALAMI'}</div>
                        <div style="font-size:9px;color:#a7f3d0;margin-top:2px;letter-spacing:1px;">RECU DE PAIEMENT / وصل الدفع</div>
                    </div>
                    <div style="background:#f0fdf4;padding:5px 14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px dashed #a7f3d0;">
                        <span style="font-size:9px;color:#6b7280;">Ref / المرجع</span>
                        <span style="font-size:10px;font-family:monospace;font-weight:700;color:#064e3b;">${receiptNo}</span>
                    </div>
                    <div style="padding:14px 16px;text-align:center;border-bottom:1px solid #f3f4f6;">
                        <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">MONTANT PAYE / المبلغ المدفوع</div>
                        <div style="font-size:30px;font-weight:800;color:#10b981;line-height:1.1;">
                            ${fmt(payment.amount)}<span style="font-size:13px;font-weight:600;color:#6b7280;margin-left:4px;">MRU</span>
                        </div>
                        <div style="display:inline-block;margin-top:6px;background:#d1fae5;color:#065f46;font-size:9px;font-weight:700;padding:2px 10px;border-radius:99px;">PAYE</div>
                    </div>
                    <div style="padding:10px 14px;border-bottom:1px solid #f3f4f6;">
                        ${row('Eleve / الطالب', resolvedStudentName, true)}
                        ${studentClass ? row('Classe / القسم', studentClass, false) : ''}
                        ${studentNni   ? row('NNI', studentNni, true) : ''}
                        ${parentName   ? row('Parent / ولي الأمر', parentName, false) : ''}
                        ${parentPhone  ? row('Tel / الهاتف', parentPhone, true) : ''}
                    </div>
                    <div style="padding:10px 14px;border-bottom:1px solid #f3f4f6;">
                        ${row('Type', types.fr + ' / ' + types.ar, true)}
                        ${row('Date / التاريخ', paymentDate, false)}
                        ${payment.description ? row('Note', payment.description, true) : ''}
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
            // Call twice — first call triggers font/layout caching, second gives correct dimensions
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
            doc.save(`recu-${resolvedStudentName.replace(/\s+/g, '-')}-${receiptNo}.pdf`)
            toast.success(language === 'ar' ? 'تم تنزيل الوصل' : 'Recu PDF telecharge')
        } catch (err) {
            console.error(err)
            toast.error(language === 'ar' ? 'خطأ في إنشاء PDF' : 'Erreur lors de la generation du PDF')
        }
    }

    const handleRegisterPayment = async () => {
        const amount = parseFloat(paymentAmount)
        if (!amount || amount <= 0) {
            toast.error(t('admin.students.profile.validAmountRequired'))
            return
        }
        if (!studentId) {
            toast.error(t('admin.students.profile.studentNotIdentified'))
            return
        }

        setSubmitting(true)
        try {
            const supabase = createClient()

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error(t('admin.students.profile.notAuthenticated'))

            const { data: profile } = await supabase
                .from('profiles')
                .select('school_id')
                .eq('id', user.id)
                .single()

            if (!profile?.school_id) throw new Error(t('admin.students.profile.schoolNotFound'))

            const { data: currentYear } = await supabase
                .from('academic_years')
                .select('id, name')
                .eq('school_id', profile.school_id)
                .eq('is_current', true)
                .single()

            const isConstrained = paymentType === 'scolarite' || paymentType === 'inscription'

            if (isConstrained) {
                // Fetch pending/overdue rows for this type
                const { data: pendingPayments, error: fetchPendingError } = await supabase
                    .from('payments')
                    .select('*')
                    .eq('student_id', studentId)
                    .eq('payment_type', paymentType)
                    .in('payment_status', ['pending', 'overdue', 'partial'])
                    .order('due_date', { ascending: true })

                if (fetchPendingError) throw fetchPendingError

                const totalPendingForType = (pendingPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0)

                // Inscription already fully settled
                if (paymentType === 'inscription' && totalPendingForType === 0) {
                    toast.error(language === 'ar' ? 'رسوم التسجيل مدفوعة بالفعل' : "Les frais d'inscription sont déjà réglés")
                    setSubmitting(false)
                    return
                }

                // Cannot exceed what's pending
                if (amount > totalPendingForType) {
                    toast.error(t('admin.students.profile.amountExceedsPending', {
                        amount: amount.toLocaleString(language === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR'),
                        pending: totalPendingForType.toLocaleString(language === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR')
                    }))
                    setSubmitting(false)
                    return
                }

                // Apply amount against pending rows oldest-first
                let remainingAmount = amount
                for (const pending of pendingPayments ?? []) {
                    if (remainingAmount <= 0) break

                    if (remainingAmount >= Number(pending.amount)) {
                        const { error } = await supabase
                            .from('payments')
                            .update({
                                payment_status: 'paid',
                                paid_at: new Date().toISOString(),
                                amount: Number(pending.amount),
                                description: paymentNote || pending.description || `Paiement ${paymentType}`
                            })
                            .eq('id', pending.id)
                        if (error) throw error
                        remainingAmount -= Number(pending.amount)
                    } else {
                        // Partial: shrink current row, create remainder row
                        const diff = Number(pending.amount) - remainingAmount
                        const { error: updateError } = await supabase
                            .from('payments')
                            .update({
                                payment_status: 'paid',
                                paid_at: new Date().toISOString(),
                                amount: remainingAmount,
                                description: paymentNote || pending.description || `Paiement ${paymentType}`
                            })
                            .eq('id', pending.id)
                        if (updateError) throw updateError

                        const { error: insertError } = await supabase
                            .from('payments')
                            .insert({
                                student_id: studentId,
                                school_id: profile.school_id,
                                amount: diff,
                                payment_type: paymentType,
                                payment_status: pending.payment_status === 'overdue' ? 'overdue' : 'pending',
                                due_date: pending.due_date,
                                academic_year_id: pending.academic_year_id,
                                description: pending.description || `Reste - ${paymentType}`
                            })
                        if (insertError) throw insertError
                        remainingAmount = 0
                    }
                }

            } else {
                // Free types (transport, cantine, activités, etc.): insert directly as paid
                const { error } = await supabase
                    .from('payments')
                    .insert({
                        student_id: studentId,
                        school_id: profile.school_id,
                        amount: amount,
                        payment_type: paymentType,
                        payment_status: 'paid',
                        paid_at: new Date().toISOString(),
                        due_date: new Date().toISOString().split('T')[0],
                        academic_year_id: currentYear?.id ?? null,
                        description: paymentNote || `Paiement - ${getTypeLabel(paymentType)}`,
                    })
                if (error) throw error
            }

            toast.success(t('admin.students.profile.paymentRegistered', { amount: amount.toLocaleString(language === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR') }))
            setShowPaymentForm(false)
            setPaymentAmount('')
            setPaymentNote('')
            fetchPayments()
        } catch (err) {
            console.error('Error registering payment:', err)
            toast.error(t('admin.students.profile.paymentRegisterError'))
        } finally {
            setSubmitting(false)
        }
    }

    const handleSendReminder = async () => {
        setSendingReminder(true)
        try {
            const supabase = createClient()

            // Get parent linked to this student
            const { data: links } = await supabase
                .from('parent_student_links')
                .select('parent_id, profiles!parent_student_links_parent_id_fkey (full_name, phone)')
                .eq('student_id', studentId)

            if (!links || links.length === 0) {
                toast.error(t('admin.students.profile.noLinkedParent'))
                return
            }

            // Create an in-app notification/announcement for the parent
            const { data: { user } } = await supabase.auth.getUser()
            const { data: adminProfile } = await supabase
                .from('profiles')
                .select('school_id')
                .eq('id', user?.id || '')
                .single()

            if (adminProfile?.school_id) {
                await supabase.from('announcements').insert({
                    school_id: adminProfile.school_id,
                    title: `${t('admin.students.profile.paymentReminder')} - ${studentName || t('common.student')}`,
                    content: `${t('admin.students.profile.reminderSentFor')} ${studentName || t('admin.students.profile.yourChild')}. ${t('admin.students.profile.remainingAmount')}: ${remaining.toLocaleString(language === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR')} MRU.`,
                    target_audience: ['parent'],
                    priority: 'high',
                    published_at: new Date().toISOString(),
                    created_by: user?.id || ''
                })
            }

            const parentName = (links[0]?.profiles as { full_name?: string })?.full_name || t('common.parent')
            const parentPhone = (links[0]?.profiles as { phone?: string })?.phone

            toast.success(`${t('admin.students.profile.reminderSentTo')} ${parentName}`, {
                description: parentPhone ? `Tél: ${parentPhone}` : undefined,
                action: parentPhone ? {
                    label: 'WhatsApp',
                    onClick: () => {
                        const waNumber = parentPhone.replace(/[\s\-\(\)\+]/g, '')
                        window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(`${t('admin.students.profile.hello')}, ${t('admin.students.profile.paymentReminderFor')} ${studentName}. ${t('admin.students.profile.remainingAmount')}: ${remaining.toLocaleString(language === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR')} MRU.`)}`, '_blank')
                    }
                } : undefined
            })
        } catch (err) {
            console.error('Error sending reminder:', err)
            toast.error(t('admin.students.profile.reminderSendError'))
        } finally {
            setSendingReminder(false)
        }
    }

    const formatDate = (dateStr: string | null, withTime = false) => {
        if (!dateStr) return '—'
        const d = new Date(dateStr)
        const loc = language === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR'
        const base = d.toLocaleDateString(loc, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Nouakchott' })
        return withTime ? base + ' ' + d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nouakchott' }) : base
    }

    const getTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            scolarite: 'Scolarité',
            bus: 'Transport',
            cantine: 'Cantine',
            inscription: 'Inscription',
            activites: 'Activités',
            transport: 'Transport',
            restauration: 'Restauration',
            cotisation: 'Cotisation',
            autre: 'Autres',
            autres: 'Autres',
        }
        return labels[type] || type
    }

    const filteredPayments = payments.filter(p => {
        if (filterSearch) {
            const label = getTypeLabel(p.payment_type).toLowerCase()
            const desc = (p.description || '').toLowerCase()
            if (!label.includes(filterSearch.toLowerCase()) && !desc.includes(filterSearch.toLowerCase())) return false
        }
        if (filterType) {
            if (filterType === 'transaction') {
                if (p.source !== 'transaction') return false
            } else {
                const normalizeType = (t: string) => t === 'bus' ? 'transport' : t === 'autre' ? 'autres' : t
                if (normalizeType(p.payment_type) !== filterType || p.source === 'transaction') return false
            }
        }
        if (filterStatus && p.payment_status !== filterStatus) return false
        if (filterDateFrom) {
            const d = new Date(p.paid_at || p.due_date || '')
            if (isNaN(d.getTime()) || d < new Date(filterDateFrom)) return false
        }
        if (filterDateTo) {
            const d = new Date(p.paid_at || p.due_date || '')
            if (isNaN(d.getTime()) || d > new Date(filterDateTo + 'T23:59:59')) return false
        }
        return true
    })

    const hasActiveFilters = !!(filterSearch || filterType || filterStatus || filterDateFrom || filterDateTo)

    const clearFilters = () => {
        setFilterSearch('')
        setFilterType('')
        setFilterStatus('')
        setFilterDateFrom('')
        setFilterDateTo('')
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Summary Card */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl border border-emerald-200/50 p-6 flex flex-col sm:flex-row justify-between items-center text-center sm:text-left shadow-sm">
                <div className="space-y-2">
                    <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2 justify-center sm:justify-start">
                        <CreditCard className="w-5 h-5 text-emerald-600" />
                        {t('admin.students.profile.tuitionStatus')}
                    </h3>
                    <p className="text-slate-500 text-sm font-medium">{t('common.schoolYear')} {new Date().getFullYear() - 1}-{new Date().getFullYear()}</p>
                </div>
                <div className="mt-4 sm:mt-0">
                    <div className="flex items-end gap-2 justify-center sm:justify-end">
                        <span className="text-4xl font-bold text-slate-900">{loading ? '...' : `${paidPercentage}%`}</span>
                        <span className="text-emerald-600 font-bold mb-2">{t('common.paid')}</span>
                    </div>
                    <Progress value={paidPercentage} className="h-2 w-48 bg-emerald-100/80 mt-2" indicatorClassName="bg-emerald-600" />
                    <p className="text-[10px] text-slate-500 mt-2 text-right font-medium">
                        {loading ? '...' : `${t('admin.students.profile.remainingToPay')}: ${remaining.toLocaleString(language === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR')} MRU`}
                    </p>
                </div>
            </div>

            {/* Payment Form (inline) */}
            {showPaymentForm && (
                <div className="bg-[#1A2530] rounded-3xl border border-emerald-500/20 p-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-white">{t('admin.students.profile.registerPayment')}</h3>
                        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white" onClick={() => setShowPaymentForm(false)}>
                            <X className="w-4 h-4" />
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs text-gray-400 font-bold">{t('common.amount')} (MRU)</label>
                                {paymentType === 'scolarite' && (
                                    <span className="text-[10px] text-emerald-400/70 font-medium">
                                        max {(scolariteDue - scolaritePaidAmt).toLocaleString('fr-FR')} MRU
                                    </span>
                                )}
                            </div>
                            <Input
                                type="number"
                                placeholder={t('admin.students.profile.amountPlaceholder')}
                                className="bg-[#0D1117] border-white/10 text-white h-11 rounded-xl"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 font-bold mb-1.5 block">{t('common.type')}</label>
                            <select
                                title={t('common.type')}
                                className="w-full h-11 bg-[#0D1117] border border-white/10 rounded-xl px-3 text-white text-sm"
                                value={paymentType}
                                onChange={(e) => setPaymentType(e.target.value)}
                            >
                                {!scolariteFullyPaid && <option value="scolarite">Scolarité</option>}
                                {!inscriptionPaid && <option value="inscription">Inscription</option>}
                                <option value="cantine">Cantine</option>
                                <option value="transport">Transport</option>
                                <option value="cotisation">Cotisation</option>
                                <option value="activites">Activités</option>
                                <option value="autres">Autres</option>
                            </select>
                        </div>
                    </div>

                    <div>
                            <label className="text-xs text-gray-400 font-bold mb-1.5 block">{t('admin.students.profile.noteOptional')}</label>
                        <Input
                            placeholder={t('admin.students.profile.notePlaceholder')}
                            className="bg-[#0D1117] border-white/10 text-white h-11 rounded-xl"
                            value={paymentNote}
                            onChange={(e) => setPaymentNote(e.target.value)}
                        />
                    </div>

                    <Button
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold h-12 rounded-xl"
                        onClick={handleRegisterPayment}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('admin.students.profile.saving')}</>
                        ) : (
                            <><CheckCircle2 className="w-4 h-4 mr-2" /> {t('admin.students.profile.confirmPayment')}</>
                        )}
                    </Button>
                </div>
            )}

            {/* Action Bar */}
            {!isArchived && (
                <div className="grid grid-cols-2 gap-4">
                    <Button
                        className="bg-[#1A2530] hover:bg-[#253545] text-white border border-white/5 h-12 rounded-xl"
                        onClick={() => {
                            const defaultType = !scolariteFullyPaid ? 'scolarite' : !inscriptionPaid ? 'inscription' : 'cantine'
                            setPaymentType(defaultType)
                            setShowPaymentForm(true)
                        }}
                    >
                        <CreditCard className="w-4 h-4 mr-2 text-emerald-500" /> {t('admin.students.profile.registerPayment')}
                    </Button>
                    <Button
                        className="bg-[#1A2530] hover:bg-[#253545] text-white border border-white/5 h-12 rounded-xl"
                        onClick={handleSendReminder}
                        disabled={sendingReminder}
                    >
                        {sendingReminder ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('admin.students.profile.sending')}</>
                        ) : (
                            <><Send className="w-4 h-4 mr-2 text-orange-500" /> {t('admin.students.profile.sendReminder')}</>
                        )}
                    </Button>
                </div>
            )}

            {/* History List */}
            <div className="bg-[#1A2530] rounded-3xl border border-white/5 overflow-hidden">
                {/* Header + Filter Toggle */}
                <div className="p-4 sm:p-6 border-b border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-white">{t('admin.students.profile.paymentHistory')}</h3>
                        <div className="flex items-center gap-2">
                            {hasActiveFilters && (
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="text-[10px] text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                                >
                                    <X className="w-3 h-3" /> Effacer filtres
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setShowFilters(f => !f)}
                                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                                    showFilters || hasActiveFilters
                                        ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                                        : 'text-gray-400 border-white/10 hover:text-white hover:border-white/20'
                                }`}
                            >
                                <Filter className="w-3.5 h-3.5" />
                                Filtrer
                                {hasActiveFilters && (
                                    <span className="w-4 h-4 rounded-full bg-emerald-500 text-black text-[9px] font-black flex items-center justify-center">
                                        {[filterSearch, filterType, filterStatus, filterDateFrom, filterDateTo].filter(Boolean).length}
                                    </span>
                                )}
                                <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Search bar — always visible */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                        <input
                            type="text"
                            value={filterSearch}
                            onChange={e => setFilterSearch(e.target.value)}
                            placeholder="Rechercher dans l'historique…"
                            className="w-full pl-8 pr-3 py-2 bg-[#0D1117] border border-white/10 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/40"
                        />
                        {filterSearch && (
                            <button type="button" title="Effacer la recherche" onClick={() => setFilterSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                                <X className="w-3.5 h-3.5 text-gray-500 hover:text-white" />
                            </button>
                        )}
                    </div>

                    {/* Extended filters */}
                    {showFilters && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                            <div>
                                <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Type</label>
                                <select
                                    title="Type"
                                    value={filterType}
                                    onChange={e => setFilterType(e.target.value)}
                                    className="w-full h-8 bg-[#0D1117] border border-white/10 rounded-lg px-2 text-xs text-white focus:outline-none focus:border-emerald-500/40"
                                >
                                    <option value="">Tous</option>
                                    <option value="scolarite">Scolarité</option>
                                    <option value="inscription">Inscription</option>
                                    <option value="cantine">Cantine</option>
                                    <option value="transport">Transport</option>
                                    <option value="cotisation">Cotisation</option>
                                    <option value="activites">Activités</option>
                                    <option value="autres">Autres</option>
                                    <option value="transaction">Comptabilité</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Statut</label>
                                <select
                                    title="Statut"
                                    value={filterStatus}
                                    onChange={e => setFilterStatus(e.target.value)}
                                    className="w-full h-8 bg-[#0D1117] border border-white/10 rounded-lg px-2 text-xs text-white focus:outline-none focus:border-emerald-500/40"
                                >
                                    <option value="">Tous</option>
                                    <option value="paid">Payé</option>
                                    <option value="pending">En attente</option>
                                    <option value="overdue">En retard</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Du</label>
                                <input
                                    type="date"
                                    title="Date de début"
                                    placeholder="Date de début"
                                    value={filterDateFrom}
                                    onChange={e => setFilterDateFrom(e.target.value)}
                                    className="w-full h-8 bg-[#0D1117] border border-white/10 rounded-lg px-2 text-xs text-white focus:outline-none focus:border-emerald-500/40"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Au</label>
                                <input
                                    type="date"
                                    title="Date de fin"
                                    placeholder="Date de fin"
                                    value={filterDateTo}
                                    onChange={e => setFilterDateTo(e.target.value)}
                                    className="w-full h-8 bg-[#0D1117] border border-white/10 rounded-lg px-2 text-xs text-white focus:outline-none focus:border-emerald-500/40"
                                />
                            </div>
                        </div>
                    )}

                    {/* Results count when filters active */}
                    {hasActiveFilters && !loading && (
                        <p className="text-[10px] text-gray-500">
                            {filteredPayments.length} résultat{filteredPayments.length !== 1 ? 's' : ''} sur {payments.length}
                        </p>
                    )}
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                    </div>
                ) : filteredPayments.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p>{hasActiveFilters ? 'Aucun résultat pour ces filtres' : t('admin.students.profile.noPayment')}</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {filteredPayments.map((payment) => (
                            <div key={payment.id} className="p-4 sm:p-6 flex items-center justify-between hover:bg-[#0F1720] transition-colors group">
                                <div className="flex items-center gap-4">
                                    <div className={cn("h-10 w-10 rounded-full flex items-center justify-center border-2",
                                        payment.payment_status === 'paid'
                                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                                            : "bg-red-500/10 border-red-500/30 text-red-500"
                                    )}>
                                        {payment.payment_status === 'paid' ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                                    </div>

                                    <div>
                                        <h4 className="font-bold text-white text-sm flex items-center gap-2">
                                            {getTypeLabel(payment.payment_type)}
                                            {payment.source === 'transaction' && (
                                                <span className="text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                                    Comptabilité
                                                </span>
                                            )}
                                        </h4>
                                        <div className="flex items-center gap-2 text-xs">
                                            <span className="text-emerald-500 font-bold">{Number(payment.amount).toLocaleString('fr-FR')} MRU</span>
                                            <span className="text-gray-500">•</span>
                                            <span className="text-gray-400">{payment.paid_at ? formatDate(payment.paid_at, true) : formatDate(payment.due_date)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    {payment.payment_status === 'paid' ? (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-gray-400 hover:text-emerald-400 hover:bg-white/5 h-9 w-9 rounded-xl transition-all"
                                            onClick={() => handlePrintReceipt(payment)}
                                            title={language === 'ar' ? 'طباعة الوصل' : 'Imprimer le reçu'}
                                        >
                                            <Printer className="w-4 h-4" />
                                        </Button>
                                    ) : (
                                        <Badge className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20 text-[10px]">
                                            {payment.payment_status === 'overdue' ? 'EN RETARD' : 'EN ATTENTE'}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
