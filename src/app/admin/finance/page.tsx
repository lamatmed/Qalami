'use client'

import { useState } from 'react'
import { AccountingStats } from '@/components/admin/accounting/accounting-stats'
import { TransactionLedger } from '@/components/admin/accounting/transaction-ledger'
import { AddTransactionDialog } from '@/components/admin/accounting/add-transaction-dialog'
import { Button } from '@/components/ui/button'
import { Plus, Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/utils/supabase/client'

export default function AccountingPage() {
    const [isAddTxOpen, setIsAddTxOpen] = useState(false)
    const [generating, setGenerating] = useState(false)

    const handleMonthlyReport = async () => {
        setGenerating(true)
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Non authentifié')

            const { data: profile } = await supabase
                .from('profiles')
                .select('school_id')
                .eq('id', user.id)
                .single()

            if (!profile?.school_id) throw new Error('École non trouvée')

            // Get current month range
            const now = new Date()
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

            // Fetch all payments for this month
            const { data: payments, error } = await supabase
                .from('payments')
                .select('*, profiles!payments_student_id_fkey(full_name)')
                .eq('school_id', profile.school_id)
                .gte('created_at', startOfMonth)
                .lte('created_at', endOfMonth)
                .order('created_at', { ascending: false })

            if (error) throw error

            const monthName = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

            if (!payments || payments.length === 0) {
                toast.info(`Aucune transaction pour ${monthName}`)
                return
            }

            // Generate CSV report
            const totalRevenue = payments.filter(p => p.payment_status === 'paid').reduce((s, p) => s + Number(p.amount), 0)
            const totalPending = payments.filter(p => p.payment_status !== 'paid').reduce((s, p) => s + Number(p.amount), 0)

            let csv = `Rapport Mensuel - ${monthName}\n`
            csv += `Total encaissé: ${totalRevenue.toLocaleString('fr-FR')} MRU\n`
            csv += `Total en attente: ${totalPending.toLocaleString('fr-FR')} MRU\n`
            csv += `Nombre de transactions: ${payments.length}\n\n`
            csv += `Date,Élève,Type,Montant (MRU),Statut,Description\n`

            payments.forEach(p => {
                const studentName = (p.profiles as { full_name?: string })?.full_name || '—'
                const date = new Date(p.created_at).toLocaleDateString('fr-FR')
                csv += `${date},"${studentName}",${p.payment_type || '—'},${p.amount},${p.payment_status},"${p.description || ''}"\n`
            })

            // Download CSV
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `rapport-financier-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.csv`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)

            toast.success(`Rapport de ${monthName} téléchargé`, {
                description: `${payments.length} transactions · ${totalRevenue.toLocaleString('fr-FR')} MRU encaissés`
            })
        } catch (err) {
            console.error('Report error:', err)
            toast.error('Erreur lors de la génération du rapport')
        } finally {
            setGenerating(false)
        }
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 max-w-[1600px] mx-auto min-h-screen animate-in fade-in duration-500">
            <div className="flex justify-end gap-2">
                <Button
                    size="sm"
                    variant="outline"
                    className="border-white/10 text-gray-400 hover:text-white bg-transparent"
                    onClick={handleMonthlyReport}
                    disabled={generating}
                >
                    {generating
                        ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Génération...</>
                        : <><Download className="w-3.5 h-3.5 mr-1.5" />Rapport</>
                    }
                </Button>
                <Button
                    size="sm"
                    onClick={() => setIsAddTxOpen(true)}
                    className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold"
                >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />Transaction
                </Button>
            </div>

            {/* KPI & Charts Section */}
            <AccountingStats />

            {/* Main Ledger Section */}
            <div className="h-[600px]">
                <TransactionLedger />
            </div>

            {/* Dialogs */}
            <AddTransactionDialog open={isAddTxOpen} onOpenChange={setIsAddTxOpen} />
        </div>
    )
}
