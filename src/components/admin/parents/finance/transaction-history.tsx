'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Download, ArrowUpRight, Loader2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

interface TransactionHistoryProps {
    parentId?: string
    childIds?: string[]
}

export function TransactionHistory({ parentId, childIds }: TransactionHistoryProps) {
    const [transactions, setTransactions] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            if (!childIds || childIds.length === 0) { setLoading(false); return }
            const supabase = createClient()
            const { data } = await supabase
                .from('payments')
                .select('*, profiles!payments_student_id_fkey(full_name)')
                .in('student_id', childIds)
                .order('created_at', { ascending: false })
                .limit(10)

            setTransactions((data || []).map((p: any) => ({
                id: p.id?.substring(0, 8) || '',
                date: p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
                amount: p.amount || 0,
                type: p.type || 'Paiement',
                children: [p.profiles?.full_name || ''].filter(Boolean),
                status: p.status || 'completed'
            })))
            setLoading(false)
        }
        load()
    }, [childIds])

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
        )
    }

    if (transactions.length === 0) {
        return (
            <div className="text-center p-8 text-gray-500 text-sm">
                Aucun paiement enregistr&eacute;
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-400 pl-1 uppercase tracking-wider">Historique des paiements</h3>
                <Button variant="ghost" size="sm" className="text-xs text-indigo-400 hover:text-indigo-300">
                    Voir tout
                </Button>
            </div>

            <div className="bg-[#161B22] rounded-2xl border border-white/5 divide-y divide-white/5">
                {transactions.map((tx) => (
                    <div key={tx.id} className="p-4 flex items-center justify-between group hover:bg-white/5 transition-colors">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
                                <ArrowUpRight className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-white">{tx.type}</h4>
                                <p className="text-[10px] text-gray-500 font-mono mt-0.5">Ref: #{tx.id}</p>
                                <div className="flex gap-1 mt-1.5">
                                    {tx.children.map((c: string) => (
                                        <Badge key={c} variant="secondary" className="text-[8px] h-4 px-1 bg-white/5 text-gray-400 border-0">{c}</Badge>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="text-right">
                            <p className="text-sm font-bold text-white">{tx.amount.toLocaleString()} MRU</p>
                            <div className="flex items-center justify-end gap-2 mt-1">
                                <span className="text-[10px] text-gray-500">{tx.date}</span>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500 hover:text-indigo-400">
                                    <Download className="w-3 h-3" />
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
