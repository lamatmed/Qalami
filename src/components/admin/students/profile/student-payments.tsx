'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { CreditCard, Clock, CheckCircle2, X, Loader2, Send } from 'lucide-react'
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

    const fetchPayments = async () => {
        if (!studentId) {
            setLoading(false)
            return
        }

        const supabase = createClient()
        const { data, error } = await supabase
            .from('payments')
            .select('id, amount, payment_type, payment_status, due_date, paid_at')
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
        fetchPayments()
    }, [studentId])

    const totalDue = payments.reduce((sum, p) => sum + Number(p.amount), 0)
    const totalPaid = payments.filter(p => p.payment_status === 'paid').reduce((sum, p) => sum + Number(p.amount), 0)
    const paidPercentage = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0
    const remaining = totalDue - totalPaid

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
                                    {(payment.payment_status === 'overdue' || payment.payment_status === 'pending') && (
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
