'use client'

import { useState, useEffect } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Phone, MessageSquare, Mail, MapPin, X, Banknote, User, ShieldAlert, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n'
import { FinanceOverview } from './finance/finance-overview'
import { FeeBreakdown } from './finance/fee-breakdown'
import { GroupPaymentDialog } from './finance/group-payment-dialog'
import { TransactionHistory } from './finance/transaction-history'
import { createClient } from '@/utils/supabase/client'
import { StatusBadge } from '@/components/admin/shared/status-badge'
import { ChangeStatusDialog } from '@/components/admin/shared/change-status-dialog'

interface ParentProfileProps {
    parent: any
    onClose?: () => void
    onParentUpdated?: () => void
}




export function ParentProfile({ parent, onClose, onParentUpdated }: ParentProfileProps) {
    const { t } = useLanguage()
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
    const [statusDialogOpen, setStatusDialogOpen] = useState(false)
    const [currentStatus, setCurrentStatus] = useState<string>(parent?.status || 'active')
    const [activeTab, setActiveTab] = useState<'info' | 'finance'>('info')
    const [financeSummary, setFinanceSummary] = useState({ totalOutstanding: 0, totalPaid: 0, totalDue: 0, byCategory: { tuition: 0, transport: 0, canteen: 0 } })
    const [childFees, setChildFees] = useState<any[]>([])
    const [pendingFees, setPendingFees] = useState<any[]>([])
    const [financeLoaded, setFinanceLoaded] = useState(false)

    useEffect(() => {
        if (activeTab !== 'finance' || financeLoaded || !parent) return
        async function loadFinance() {
            const supabase = createClient()
            // Get payments for this parent's children
            const childIds = (parent.children || []).map((c: any) => c.id)
            if (childIds.length === 0) { setFinanceLoaded(true); return }

            const { data: payments } = await supabase
                .from('payments')
                .select('*')
                .in('student_id', childIds)
                .order('created_at', { ascending: false })

            const allPayments = payments || []
            const totalPaid = allPayments.filter((p: any) => p.status === 'completed').reduce((s: number, p: any) => s + (p.amount || 0), 0)
            const totalDue = allPayments.reduce((s: number, p: any) => s + (p.amount || 0), 0)
            setFinanceSummary({ totalOutstanding: totalDue - totalPaid, totalPaid, totalDue, byCategory: { tuition: totalPaid, transport: 0, canteen: 0 } })

            // Build child fees
            const fees = (parent.children || []).map((child: any) => {
                const cPayments = allPayments.filter((p: any) => p.student_id === child.id)
                return {
                    studentId: child.id,
                    name: child.name,
                    class: child.class_name || '',
                    fees: cPayments.map((p: any) => ({
                        id: p.id, type: p.type || 'Paiement', amount: p.amount || 0,
                        paidAmount: p.status === 'completed' ? p.amount : 0,
                        dueDate: p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR') : '',
                        status: p.status === 'completed' ? 'paid' as const : 'overdue' as const
                    }))
                }
            })
            setChildFees(fees)

            const pending = allPayments.filter((p: any) => p.status !== 'completed').map((p: any) => {
                const child = (parent.children || []).find((c: any) => c.id === p.student_id)
                return { id: p.id, studentName: child?.name || '', type: p.type || 'Paiement', amount: p.amount || 0, dueDate: p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR') : '' }
            })
            setPendingFees(pending)
            setFinanceLoaded(true)
        }
        loadFinance()
    }, [activeTab, financeLoaded, parent])

    if (!parent) return null

    // Format phone for links (remove spaces, ensure country code)
    const formatPhoneForLink = (phone: string) => {
        const cleaned = phone?.replace(/[\s\-\(\)]/g, '') || ''
        // If starts with 0, replace with +222 (Mauritania)
        if (cleaned.startsWith('0')) return '+222' + cleaned.substring(1)
        // If no country code, add +222
        if (!cleaned.startsWith('+')) return '+222' + cleaned
        return cleaned
    }

    const parentPhone = parent.phone || parent.father_phone || ''
    const phoneLink = formatPhoneForLink(parentPhone)

    const handleCall = () => {
        if (!parentPhone) {
            toast.error(t('admin.parents.noPhoneRecorded'))
            return
        }
        window.open(`tel:${phoneLink}`, '_self')
    }

    const handleWhatsApp = () => {
        if (!parentPhone) {
            toast.error(t('admin.parents.noPhoneRecorded'))
            return
        }
        // Remove + for wa.me link
        const waNumber = phoneLink.replace('+', '')
        window.open(`https://wa.me/${waNumber}`, '_blank')
    }

    const handleMessage = () => {
        const email = parent.email || parent.mother_email || ''
        if (!email) {
            toast.error(t('admin.parents.noEmailRecorded'))
            return
        }
        window.open(`mailto:${email}`, '_self')
    }

    return (
        <div className="h-full flex flex-col bg-[#161B22] rounded-3xl border border-white/5 overflow-hidden animate-in fade-in duration-300">
            {/* Header / Cover */}
            <div className={cn(
                "relative transition-all duration-300",
                activeTab === 'finance' ? "h-24 bg-indigo-900/20" : "h-32 bg-gray-900/40"
            )}>
                <div className="absolute top-4 right-4 flex gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-400 hover:text-white bg-black/20 backdrop-blur-sm rounded-full lg:hidden"
                        onClick={onClose}
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Profile Info - Compact in Finance View */}
            <div className={cn("px-6 -mt-12 flex flex-col items-center transition-all", activeTab === 'finance' && "-mt-8")}>
                <div className="relative">
                    <Avatar className={cn("border-4 border-[#161B22] shadow-xl transition-all", activeTab === 'finance' ? "w-16 h-16" : "w-24 h-24")}>
                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${parent.name}`} />
                        <AvatarFallback>{parent.name.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                </div>

                <div className="mt-2 text-center space-y-1">
                    <h2 className={cn("font-bold text-white transition-all", activeTab === 'finance' ? "text-lg" : "text-xl")}>{parent.name}</h2>
                    {parentPhone && (
                        <p className="text-xs text-gray-400 font-mono">{parentPhone}</p>
                    )}
                    <div className="flex items-center justify-center gap-2 pt-1">
                        <StatusBadge status={currentStatus} />
                        <button
                            onClick={() => setStatusDialogOpen(true)}
                            className="text-gray-500 hover:text-orange-400 transition-colors"
                            title="Changer le statut"
                        >
                            <ShieldAlert className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex p-1 bg-[#0D1117] rounded-xl border border-white/5 mt-4 mb-2">
                    <TabButton
                        active={activeTab === 'info'}
                        label={t('admin.parents.information')}
                        icon={User}
                        onClick={() => setActiveTab('info')}
                    />
                    <TabButton
                        active={activeTab === 'finance'}
                        label={t('admin.parents.finances')}
                        icon={Banknote}
                        onClick={() => setActiveTab('finance')}
                    />
                </div>

                {/* Actions Grid - Only Show Call/Msg in Info Tab */}
                {activeTab === 'info' && (
                    <div className="grid grid-cols-3 gap-3 w-full max-w-sm mt-4">
                        <ActionBtn icon={Phone} label={t('admin.parents.call')} color="text-emerald-400" bg="bg-emerald-500/5 group-hover:bg-emerald-500/10" onClick={handleCall} />
                        <ActionBtn icon={MessageSquare} label="WhatsApp" color="text-green-400" bg="bg-green-500/5 group-hover:bg-green-500/10" onClick={handleWhatsApp} />
                        <ActionBtn icon={Mail} label={t('admin.parents.message')} color="text-blue-400" bg="bg-blue-500/5 group-hover:bg-blue-500/10" onClick={handleMessage} />
                    </div>
                )}
                {activeTab === 'finance' && (
                    <Button
                        onClick={() => setIsPaymentModalOpen(true)}
                        className="mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-10 px-6 rounded-xl shadow-lg shadow-indigo-500/20"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        {t('admin.parents.newPayment')}
                    </Button>
                )}
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

                {activeTab === 'info' ? (
                    <>
                        {/* Linked Children */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-white">{t('admin.parents.linkedChildrenTitle')}</h3>
                                <Badge variant="outline" className="text-[10px] border-white/10">{parent.children.length} {t('admin.parents.children')}</Badge>
                            </div>

                            <div className="space-y-2">
                                {parent.children.length === 0 ? (
                                    <div className="py-6 text-center rounded-xl bg-[#0D1117] border border-white/5">
                                        <p className="text-xs text-gray-500">{t('admin.parents.noStudentsLinked')}</p>
                                        <p className="text-[11px] text-gray-600 mt-1">{t('admin.parents.studentsLinkedHint')}</p>
                                    </div>
                                ) : (
                                    parent.children.map((child: any) => (
                                        <div key={child.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#0D1117] border border-white/5 hover:border-white/10 transition-colors group">
                                            <Avatar className="w-10 h-10 rounded-lg border border-white/5">
                                                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${child.name}`} />
                                                <AvatarFallback>{child.name[0]}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-semibold text-gray-200">{child.name}</h4>
                                                {child.class_name && (
                                                    <p className="text-xs text-gray-500 truncate">{child.class_name}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Info Section */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-white">{t('admin.parents.information')}</h3>
                            <div className="p-4 rounded-xl bg-[#0D1117] border border-white/5 space-y-4">
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                                        <MapPin className="w-4 h-4 text-gray-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-0.5">{t('admin.parents.address')}</p>
                                        <p className="text-sm text-gray-300">
                                            {parent.address || <span className="italic text-gray-500">{t('admin.parents.addressNotProvided')}</span>}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <FinanceOverview summary={financeSummary} />
                        <FeeBreakdown data={childFees} onStatementGenerate={() => { }} />
                        <TransactionHistory parentId={parent.id} childIds={(parent.children || []).map((c: any) => c.id)} />
                    </div>
                )}
            </div>

            <GroupPaymentDialog
                open={isPaymentModalOpen}
                onOpenChange={setIsPaymentModalOpen}
                pendingFees={pendingFees}
                parentName={parent.name}
            />

            <ChangeStatusDialog
                open={statusDialogOpen}
                onOpenChange={setStatusDialogOpen}
                userId={parent.id}
                currentStatus={currentStatus}
                userName={parent.name}
                onSuccess={(newStatus) => setCurrentStatus(newStatus)}
            />
        </div>
    )
}

function ActionBtn({ icon: Icon, label, color, bg, onClick }: { icon: any, label: string, color: string, bg: string, onClick: () => void }) {
    return (
        <button className="group flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-[#0D1117] border border-white/5 hover:border-white/10 transition-all" onClick={onClick}>
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center transition-colors", bg, color)}>
                <Icon className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-gray-400 group-hover:text-gray-200 transition-colors">{label}</span>
        </button>
    )
}

function TabButton({ active, label, icon: Icon, onClick }: any) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                active
                    ? "bg-[#161B22] text-white shadow-sm border border-white/5"
                    : "text-gray-500 hover:text-gray-300"
            )}
        >
            <Icon className="w-3.5 h-3.5" />
            {label}
        </button>
    )
}
