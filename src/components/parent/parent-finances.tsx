'use client'

import { useState, useEffect } from 'react'
import { Bell, CreditCard, Download, GraduationCap, Bus, Utensils, CheckCircle2, Loader2, Activity } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { useParent } from '@/context/parent-context'
import { createClient } from '@/utils/supabase/client'
import { useLanguage } from '@/i18n'

interface Payment {
    id: string
    amount: number
    payment_type: string
    payment_status: string
    due_date: string
    paid_at: string | null
    description: string | null
}

export function ParentFinances() {
    const { selectedChild, loading } = useParent()
    const { t, locale } = useLanguage()
    const [pendingPayments, setPendingPayments] = useState<Payment[]>([])
    const [paidHistory, setPaidHistory] = useState<Payment[]>([])
    const [loadingData, setLoadingData] = useState(false)
    const [totalPending, setTotalPending] = useState(0)

    useEffect(() => {
        async function fetchPayments() {
            if (!selectedChild?.id) return

            setLoadingData(true)
            const supabase = createClient()

            try {
                // Fetch pending/overdue payments
                const { data: pending, error: pendingError } = await supabase
                    .from('payments')
                    .select('id, amount, payment_type, payment_status, due_date, paid_at, description')
                    .eq('student_id', selectedChild.id)
                    .in('payment_status', ['pending', 'overdue'])
                    .order('due_date', { ascending: true })

                if (!pendingError && pending) {
                    setPendingPayments(pending)
                    setTotalPending(pending.reduce((sum, p) => sum + Number(p.amount), 0))
                }

                // Fetch paid history
                const { data: paid, error: paidError } = await supabase
                    .from('payments')
                    .select('id, amount, payment_type, payment_status, due_date, paid_at, description')
                    .eq('student_id', selectedChild.id)
                    .eq('payment_status', 'paid')
                    .order('paid_at', { ascending: false })
                    .limit(5)

                if (!paidError && paid) {
                    setPaidHistory(paid)
                }
            } catch (err) {
                console.error('Error fetching payments:', err)
            }

            setLoadingData(false)
        }

        fetchPayments()
    }, [selectedChild?.id])

    const getPaymentIcon = (type: string) => {
        const icons: Record<string, { icon: typeof GraduationCap, color: string, bg: string }> = {
            'scolarite': { icon: GraduationCap, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
            'bus': { icon: Bus, color: 'text-blue-400', bg: 'bg-blue-400/10' },
            'cantine': { icon: Utensils, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
            'activites': { icon: Activity, color: 'text-purple-400', bg: 'bg-purple-400/10' },
        }
        return icons[type] || { icon: CreditCard, color: 'text-gray-400', bg: 'bg-gray-400/10' }
    }

    const getPaymentLabel = (type: string) => {
        const labels: Record<string, string> = {
            'scolarite': t('parent.finances.scolarite'),
            'bus': t('parent.finances.bus'),
            'cantine': t('parent.finances.cantine'),
            'activites': t('parent.finances.activites'),
        }
        return labels[type] || type
    }

    const formatAmount = (amount: number) => {
        return new Intl.NumberFormat(locale === 'ar' ? 'ar-MR' : 'fr-FR').format(amount) + ' ' + t('parent.finances.mru')
    }

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!selectedChild) {
        return (
            <div className="max-w-md mx-auto lg:max-w-3xl lg:ms-12 lg:me-auto p-4">
                <div className="bg-card border border-border rounded-3xl p-6 text-center">
                    <p className="text-muted-foreground">{t('parent.finances.noChild')}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-md mx-auto lg:max-w-3xl lg:ms-12 lg:me-auto pb-24 space-y-6 p-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-border">
                        <AvatarImage src="" />
                        <AvatarFallback>{selectedChild.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="font-bold text-lg">{t('parent.finances.title')}</span>
                        <span className="text-xs text-muted-foreground">{selectedChild.name}</span>
                    </div>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full">
                    <Bell className="w-5 h-5" />
                </Button>
            </div>

            {/* Virtual Card */}
            <div className="h-48 w-full rounded-3xl bg-gradient-to-br from-cyan-900 via-cyan-950 to-black border border-cyan-500/20 p-6 flex flex-col justify-between relative overflow-hidden shadow-2xl">
                {/* Decor */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/20 blur-3xl rounded-full translate-x-10 -translate-y-10" />

                <div className="flex justify-center">
                    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                        <CreditCard className="w-6 h-6 text-cyan-400" />
                    </div>
                </div>

                <div className="space-y-1 relative z-10">
                    <p className="text-xs text-cyan-200/70 uppercase tracking-widest font-medium">{t('parent.finances.remainingBalance')}</p>
                    <h2 className="text-3xl font-bold text-white">
                        {loadingData ? <Loader2 className="h-6 w-6 animate-spin" /> : formatAmount(totalPending)}
                    </h2>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-cyan-400/80 font-medium">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    {t('parent.finances.securePayment')}
                </div>
            </div>

            {/* Fees to Pay */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <h2 className="text-lg font-bold">{t('parent.finances.feesToPay')}</h2>
                    {pendingPayments.filter(p => p.payment_status === 'overdue').length > 0 && (
                        <span className="bg-red-500/10 text-red-500 text-[10px] font-bold px-2 py-0.5 rounded border border-red-500/20">
                            {pendingPayments.filter(p => p.payment_status === 'overdue').length} {pendingPayments.filter(p => p.payment_status === 'overdue').length > 1 ? t('parent.finances.urgents') : t('parent.finances.urgent')}
                        </span>
                    )}
                </div>

                {loadingData ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : pendingPayments.length === 0 ? (
                    <div className="bg-card border border-border rounded-3xl p-6 text-center">
                        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                        <p className="text-muted-foreground">{t('parent.finances.noPending')}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {pendingPayments.map((item) => {
                            const iconData = getPaymentIcon(item.payment_type)
                            const IconComponent = iconData.icon
                            return (
                                <div key={item.id} className="bg-card border border-border/50 p-4 rounded-3xl flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", iconData.bg, iconData.color)}>
                                            <IconComponent className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-sm">{getPaymentLabel(item.payment_type)}</h3>
                                            <p className="text-xs text-muted-foreground">
                                                {item.payment_status === 'overdue' ? (
                                                    <span className="text-red-400">{t('parent.finances.overdue')} - {formatDate(item.due_date)}</span>
                                                ) : (
                                                    <>{t('parent.finances.dueDate')}: {formatDate(item.due_date)}</>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold text-sm">{formatAmount(item.amount)}</span>
                                        <Button size="sm" className="bg-cyan-500 hover:bg-cyan-600 text-black font-bold rounded-xl h-9 px-5">
                                            {t('parent.finances.pay')}
                                        </Button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* History */}
            <div className="space-y-4">
                <h2 className="text-lg font-bold px-1">{t('parent.finances.paymentHistory')}</h2>
                {loadingData ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : paidHistory.length === 0 ? (
                    <div className="bg-card/30 p-4 rounded-2xl text-center">
                        <p className="text-muted-foreground text-sm">{t('parent.finances.noPayments')}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {paidHistory.map((item) => (
                            <div key={item.id} className="bg-card/30 p-4 rounded-2xl flex items-center justify-between hover:bg-card/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-sm text-gray-200">{getPaymentLabel(item.payment_type)}</h3>
                                        <p className="text-[10px] text-muted-foreground">
                                            {item.paid_at ? formatDate(item.paid_at) : formatDate(item.due_date)} • {formatAmount(item.amount)}
                                        </p>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                    <Download className="w-4 h-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </div>
    )
}
