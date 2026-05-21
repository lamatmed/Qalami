'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { CreditCard, Clock, CheckCircle2, X, Loader2, Send, Printer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { createClient } from '@/utils/supabase/client'
import { useLanguage } from '@/i18n'

interface StudentPaymentsProps {
    studentId?: string
    studentName?: string
}

interface Payment {
    id: string
    amount: number
    payment_type: string
    payment_status: string
    due_date: string | null
    paid_at: string | null
    description?: string | null
    receipt_number?: string | null
}

export function StudentPayments({ studentId, studentName }: StudentPaymentsProps) {
    const { t, language } = useLanguage()
    const [payments, setPayments] = useState<Payment[]>([])
    const [loading, setLoading] = useState(true)
    const [showPaymentForm, setShowPaymentForm] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [sendingReminder, setSendingReminder] = useState(false)

    // Payment form state
    const [paymentAmount, setPaymentAmount] = useState('')
    const [paymentType, setPaymentType] = useState('scolarite')
    const [paymentNote, setPaymentNote] = useState('')

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
        const { data, error } = await supabase
            .from('payments')
            .select('id, amount, payment_type, payment_status, due_date, paid_at, description, receipt_number')
            .eq('student_id', studentId)
            .order('due_date', { ascending: false })

        if (error) {
            console.error('[StudentPayments] Error:', error)
        } else {
            setPayments(data || [])
        }
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
    }, [studentId])

    const totalDue = payments.reduce((sum, p) => sum + Number(p.amount), 0)
    const totalPaid = payments.filter(p => p.payment_status === 'paid').reduce((sum, p) => sum + Number(p.amount), 0)
    const paidPercentage = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0
    const remaining = totalDue - totalPaid

    const getBilingualTypeLabel = (type: string) => {
        const labels: Record<string, { fr: string; ar: string }> = {
            scolarite: { fr: 'Scolarité', ar: 'الرسوم الدراسية' },
            bus: { fr: 'Transport', ar: 'رسوم النقل' },
            cantine: { fr: 'Cantine', ar: 'رسوم الإطعام' },
            inscription: { fr: 'Inscription', ar: 'رسوم التسجيل' },
            activites: { fr: 'Activités', ar: 'رسوم الأنشطة' }
        }
        return labels[type] || { fr: type, ar: type }
    }

    const handlePrintReceipt = (payment: Payment) => {
        const printWindow = window.open('', '_blank', 'width=700,height=850')
        if (!printWindow) {
            toast.error(t('admin.students.register.confirmation.printOpenError'))
            return
        }

        const locale = language === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR'
        const paymentDate = payment.paid_at ? new Date(payment.paid_at).toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' }) : '—'
        const receiptNo = payment.receipt_number || payment.id.substring(0, 8).toUpperCase()
        const types = getBilingualTypeLabel(payment.payment_type)

        printWindow.document.write(`
            <!DOCTYPE html>
            <html dir="ltr">
            <head>
                <meta charset="utf-8">
                <title>Reçu / وصل - ${receiptNo}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        padding: 30px;
                        max-width: 650px;
                        margin: 0 auto;
                        color: #333;
                        direction: ltr;
                    }
                    .receipt-container {
                        border: 2px dashed #10b981;
                        border-radius: 16px;
                        padding: 24px;
                        background: #fff;
                    }
                    .header {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        text-align: center;
                        border-bottom: 2px solid #10b981;
                        padding-bottom: 16px;
                        margin-bottom: 20px;
                        gap: 8px;
                    }
                    .logo-container {
                        width: 70px;
                        height: 70px;
                        border-radius: 50%;
                        overflow: hidden;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: #ecfdf5;
                        border: 2px solid #10b981;
                    }
                    .school-logo {
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                    }
                    .school-title {
                        font-size: 20px;
                        font-weight: 800;
                        color: #10b981;
                        margin: 0;
                    }
                    .school-subtitle {
                        font-size: 11px;
                        color: #6b7280;
                        margin: 2px 0 0 0;
                    }
                    .receipt-title {
                        text-align: center;
                        margin: 15px 0;
                    }
                    .receipt-title h2 {
                        margin: 0;
                        font-size: 20px;
                        color: #1f2937;
                        letter-spacing: 0.5px;
                    }
                    .receipt-title p {
                        margin: 4px 0 0 0;
                        font-size: 13px;
                        color: #6b7280;
                    }
                    .meta-info {
                        display: grid;
                        grid-template-cols: 1fr 1fr;
                        gap: 15px;
                        margin-bottom: 25px;
                        background: #f9fafb;
                        padding: 12px 16px;
                        border-radius: 8px;
                        font-size: 13px;
                    }
                    .meta-row {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 4px 0;
                    }
                    .meta-label {
                        color: #6b7280;
                    }
                    .meta-value {
                        font-weight: bold;
                        color: #1f2937;
                    }
                    .table-header {
                        display: grid;
                        grid-template-cols: 2.5fr 1fr;
                        font-weight: bold;
                        border-bottom: 2px solid #e5e7eb;
                        padding-bottom: 8px;
                        font-size: 13px;
                        color: #4b5563;
                    }
                    .table-row {
                        display: grid;
                        grid-template-cols: 2.5fr 1fr;
                        padding: 12px 0;
                        border-bottom: 1px solid #f3f4f6;
                        align-items: center;
                        font-size: 14px;
                    }
                    .item-desc {
                        font-weight: 500;
                        color: #1f2937;
                    }
                    .item-desc p {
                        margin: 2px 0 0 0;
                        font-size: 11px;
                        color: #6b7280;
                    }
                    .item-amount {
                        text-align: right;
                        font-weight: bold;
                        color: #10b981;
                        font-size: 16px;
                    }
                    .total-section {
                        margin-top: 20px;
                        padding-top: 12px;
                        border-top: 2px solid #e5e7eb;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .total-label {
                        font-size: 15px;
                        font-weight: bold;
                        color: #1f2937;
                    }
                    .total-amount {
                        font-size: 20px;
                        font-weight: 800;
                        color: #10b981;
                    }
                    .status-badge {
                        background-color: #d1fae5;
                        color: #065f46;
                        font-size: 11px;
                        font-weight: bold;
                        padding: 4px 8px;
                        border-radius: 9999px;
                        display: inline-block;
                    }
                    .signatures-section {
                        display: grid;
                        grid-template-cols: 1fr 1fr;
                        gap: 40px;
                        margin-top: 50px;
                        font-size: 13px;
                        text-align: center;
                    }
                    .signature-box {
                        border-top: 1px solid #d1d5db;
                        padding-top: 8px;
                        color: #6b7280;
                    }
                    .footer {
                        text-align: center;
                        margin-top: 35px;
                        font-size: 11px;
                        color: #9ca3af;
                        border-top: 1px solid #f3f4f6;
                        padding-top: 12px;
                    }
                    @media print {
                        body {
                            padding: 0;
                        }
                        .receipt-container {
                            border: 2px solid #10b981;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="receipt-container">
                    <div class="header">
                        <div class="logo-container">
                            ${schoolLogo ? `<img src="${schoolLogo}" alt="Logo" class="school-logo" />` : `<span style="font-size: 32px;">🎓</span>`}
                        </div>
                        <div>
                            <h1 class="school-title">${schoolName || 'ECOLE QALAMI / مدرسة قلمي'}</h1>
                            <p class="school-subtitle">Système de Gestion Scolaire / نظام إدارة المدارس</p>
                        </div>
                    </div>

                    <div class="receipt-title">
                        <h2>REÇU DE PAIEMENT / وصل الدفع</h2>
                        <p>N° / الرقم: <span style="font-family: monospace; font-weight: bold; color: #1f2937;">${receiptNo}</span></p>
                    </div>

                    <div class="meta-info">
                        <div>
                            <div class="meta-row">
                                <span class="meta-label">Élève / الطالب:</span>
                                <span class="meta-value">${resolvedStudentName}</span>
                            </div>
                            <div class="meta-row">
                                <span class="meta-label">NNI / الرقم الوطني:</span>
                                <span class="meta-value" style="font-family: monospace;">${studentNni || '—'}</span>
                            </div>
                            <div class="meta-row">
                                <span class="meta-label">Classe / القسم:</span>
                                <span class="meta-value">${studentClass || '—'}</span>
                            </div>
                        </div>
                        <div>
                            <div class="meta-row">
                                <span class="meta-label">Parent / ولي الأمر:</span>
                                <span class="meta-value">${parentName || '—'}</span>
                            </div>
                            <div class="meta-row">
                                <span class="meta-label">Téléphone / الهاتف:</span>
                                <span class="meta-value">${parentPhone || '—'}</span>
                            </div>
                            <div class="meta-row">
                                <span class="meta-label">Date / التاريخ:</span>
                                <span class="meta-value">${paymentDate}</span>
                            </div>
                            <div class="meta-row">
                                <span class="meta-label">Statut / الحالة:</span>
                                <span class="meta-value"><span class="status-badge">PAYÉ / مدفوع</span></span>
                            </div>
                        </div>
                    </div>

                    <div class="table-header">
                        <div>Désignation / البيان</div>
                        <div style="text-align: right;">Montant / المبلغ</div>
                    </div>

                    <div class="table-row">
                        <div class="item-desc">
                            ${types.fr} / ${types.ar}
                            <p>${payment.description || ''}</p>
                        </div>
                        <div class="item-amount">
                            ${Number(payment.amount).toLocaleString('fr-FR')} MRU
                        </div>
                    </div>

                    <div class="total-section">
                        <div class="total-label">TOTAL PAYÉ / المجموع المدفوع</div>
                        <div class="total-amount">${Number(payment.amount).toLocaleString('fr-FR')} MRU</div>
                    </div>

                    <div class="signatures-section">
                        <div class="signature-box">
                            Parent / ولي الأمر
                        </div>
                        <div class="signature-box">
                            Administration / الإدارة
                        </div>
                    </div>

                    <div class="footer">
                        <p>Merci pour votre confiance / شكراً لثقتكم</p>
                    </div>
                </div>
            </body>
            </html>
        `)
        printWindow.document.close()
        printWindow.focus()
        setTimeout(() => {
            printWindow.print()
        }, 300)
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

            // Get school_id from admin
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error(t('admin.students.profile.notAuthenticated'))

            const { data: profile } = await supabase
                .from('profiles')
                .select('school_id')
                .eq('id', user.id)
                .single()

            if (!profile?.school_id) throw new Error(t('admin.students.profile.schoolNotFound'))

            // Resolve current academic year
            const { data: currentYear } = await supabase
                .from('academic_years')
                .select('id, name')
                .eq('school_id', profile.school_id)
                .eq('is_current', true)
                .single()

            // Find the oldest pending payment of the selected type
            const { data: pendingPayments, error: fetchPendingError } = await supabase
                .from('payments')
                .select('*')
                .eq('student_id', studentId)
                .eq('payment_type', paymentType)
                .in('payment_status', ['pending', 'overdue'])
                .order('due_date', { ascending: true })

            if (fetchPendingError) throw fetchPendingError

            const totalPendingForType = pendingPayments ? pendingPayments.reduce((sum, p) => sum + Number(p.amount), 0) : 0

            if (amount > totalPendingForType) {
                toast.error(t('admin.students.profile.amountExceedsPending', {
                    amount: amount.toLocaleString(language === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR'),
                    pending: totalPendingForType.toLocaleString(language === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR')
                }))
                setSubmitting(false)
                return
            }

            let remainingAmount = amount

            if (pendingPayments && pendingPayments.length > 0) {
                for (const pending of pendingPayments) {
                    if (remainingAmount <= 0) break

                    if (remainingAmount >= Number(pending.amount)) {
                        // Mark this pending payment as fully paid
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
                        // Partial payment for this month: update current row and create a new pending row for the remainder
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
                                payment_status: pending.payment_status || 'pending',
                                due_date: pending.due_date,
                                academic_year_id: pending.academic_year_id,
                                academic_year: pending.academic_year,
                                description: pending.description || `Reste paiement ${paymentType}`
                            })

                        if (insertError) throw insertError

                        remainingAmount = 0
                    }
                }
            }

            if (remainingAmount > 0) {
                // Insert a new payment for surplus/advance payment
                const { error } = await supabase
                    .from('payments')
                    .insert({
                        student_id: studentId,
                        school_id: profile.school_id,
                        amount: remainingAmount,
                        payment_type: paymentType,
                        payment_status: 'paid',
                        paid_at: new Date().toISOString(),
                        due_date: new Date().toISOString(),
                        academic_year_id: currentYear?.id ?? null,
                        academic_year: currentYear?.name ?? '2024-2025',
                        description: paymentNote || (pendingPayments && pendingPayments.length > 0 ? `Surplus paiement ${paymentType}` : `Paiement ${paymentType}`)
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

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '—'
        return new Date(dateStr).toLocaleDateString(language === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
    }

    const getTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            scolarite: 'Scolarité',
            bus: 'Transport',
            cantine: 'Cantine',
            inscription: 'Inscription',
            activites: 'Activités'
        }
        return labels[type] || type
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
                            <label className="text-xs text-gray-400 font-bold mb-1.5 block">{t('common.amount')} (MRU)</label>
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
                                className="w-full h-11 bg-[#0D1117] border border-white/10 rounded-xl px-3 text-white text-sm"
                                value={paymentType}
                                onChange={(e) => setPaymentType(e.target.value)}
                            >
                                <option value="scolarite">Scolarité</option>
                                <option value="inscription">Inscription</option>
                                <option value="bus">Transport</option>
                                <option value="cantine">Cantine</option>
                                <option value="activites">Activités</option>
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
            <div className="grid grid-cols-2 gap-4">
                <Button
                    className="bg-[#1A2530] hover:bg-[#253545] text-white border border-white/5 h-12 rounded-xl"
                    onClick={() => setShowPaymentForm(true)}
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

            {/* History List */}
            <div className="bg-[#1A2530] rounded-3xl border border-white/5 overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-white/5">
                    <h3 className="font-bold text-white">{t('admin.students.profile.paymentHistory')}</h3>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                    </div>
                ) : payments.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p>{t('admin.students.profile.noPayment')}</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {payments.map((payment) => (
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
                                        <h4 className="font-bold text-white text-sm">{getTypeLabel(payment.payment_type)}</h4>
                                        <div className="flex items-center gap-2 text-xs">
                                            <span className="text-emerald-500 font-bold">{Number(payment.amount).toLocaleString('fr-FR')} MRU</span>
                                            <span className="text-gray-500">•</span>
                                            <span className="text-gray-400">{formatDate(payment.paid_at || payment.due_date)}</span>
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
