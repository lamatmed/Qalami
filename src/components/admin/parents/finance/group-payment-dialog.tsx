'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
// We might need to create this if it doesn't exist, checking dependencies
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Printer, Banknote, CreditCard, Smartphone } from 'lucide-react'

// Checkbox primitive if not exists standardly in dependencies, but Radix usually has it. 
// Assuming @radix-ui/react-checkbox is installed as per package.json.

interface FeeItem {
    id: number
    studentName: string
    type: string
    amount: number
    dueDate: string
}

interface GroupPaymentDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    pendingFees: FeeItem[]
    parentName: string
}

export function GroupPaymentDialog({ open, onOpenChange, pendingFees, parentName }: GroupPaymentDialogProps) {
    const [selectedFees, setSelectedFees] = useState<number[]>([])
    const [amountReceived, setAmountReceived] = useState<string>('')
    const [paymentMethod, setPaymentMethod] = useState('cash')

    const totalSelected = pendingFees
        .filter(f => selectedFees.includes(f.id))
        .reduce((sum, f) => sum + f.amount, 0)

    const toggleFee = (id: number) => {
        setSelectedFees(prev =>
            prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]
        )
    }

    const selectAll = () => {
        if (selectedFees.length === pendingFees.length) {
            setSelectedFees([])
        } else {
            setSelectedFees(pendingFees.map(f => f.id))
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg bg-[#161B22] border-white/10 text-white p-0 overflow-hidden gap-0">
                <DialogHeader className="px-6 py-4 border-b border-white/5 bg-[#0D1117] flex flex-row items-center justify-between">
                    <div>
                        <DialogTitle className="text-lg font-bold">Paiement Groupé</DialogTitle>
                        <p className="text-xs text-gray-500 mt-1">{parentName}</p>
                    </div>
                    <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                        Total Dû: {pendingFees.reduce((a, b) => a + b.amount, 0).toLocaleString()}
                    </Badge>
                </DialogHeader>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {/* Amount Input */}
                    <div className="space-y-3">
                        <Label className="text-xs text-gray-400 uppercase font-bold">Montant Reçu (MRU)</Label>
                        <div className="relative">
                            <Input
                                type="number"
                                placeholder="0.00"
                                className="bg-[#0D1117] border-white/10 pl-4 pr-12 h-14 text-xl font-bold text-white placeholder:text-gray-700 focus-visible:ring-emerald-500/50"
                                value={amountReceived}
                                onChange={(e) => setAmountReceived(e.target.value)}
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                <Banknote className="w-6 h-6 text-gray-600" />
                            </div>
                        </div>
                    </div>

                    {/* Method Selector */}
                    <div className="space-y-3">
                        <Label className="text-xs text-gray-400 uppercase font-bold">Mode de Paiement</Label>
                        <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="grid grid-cols-3 gap-3">
                            <PaymentMethodCard value="cash" icon={Banknote} label="Espèces" />
                            <PaymentMethodCard value="transfer" icon={CreditCard} label="Virement" />
                            <PaymentMethodCard value="mobile" icon={Smartphone} label="Bankily" />
                        </RadioGroup>
                    </div>

                    {/* Fee Selection */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs text-gray-400 uppercase font-bold">Sélectionner les frais</Label>
                            <button onClick={selectAll} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium">
                                {selectedFees.length === pendingFees.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                            </button>
                        </div>

                        <div className="space-y-2">
                            {pendingFees.map((fee) => (
                                <div
                                    key={fee.id}
                                    onClick={() => toggleFee(fee.id)}
                                    className={cn(
                                        "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all",
                                        selectedFees.includes(fee.id)
                                            ? "bg-indigo-500/10 border-indigo-500/50"
                                            : "bg-[#0D1117] border-white/5 hover:border-white/10"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-5 h-5 rounded flex items-center justify-center border transition-colors",
                                            selectedFees.includes(fee.id) ? "bg-indigo-500 border-indigo-500 text-white" : "border-gray-600"
                                        )}>
                                            {selectedFees.includes(fee.id) && <CheckIcon className="w-3 h-3" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-200">{fee.type}</p>
                                            <p className="text-[10px] text-gray-500">{fee.studentName} • Échéance: {fee.dueDate}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-white">{fee.amount.toLocaleString()} MRU</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-[#0D1117] border-t border-white/5 space-y-4">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Total Sélectionné</span>
                        <span className="font-bold text-white">{totalSelected.toLocaleString()} MRU</span>
                    </div>
                    {amountReceived && (
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400">Reste (Balance)</span>
                            <span className={cn(
                                "font-bold",
                                Number(amountReceived) >= totalSelected ? "text-emerald-400" : "text-red-400"
                            )}>
                                {(Number(amountReceived) - totalSelected).toLocaleString()} MRU
                            </span>
                        </div>
                    )}

                    <Button
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-12 rounded-xl"
                        disabled={selectedFees.length === 0}
                    >
                        <Printer className="w-4 h-4 mr-2" />
                        Valider l'Encaissement
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function PaymentMethodCard({ value, icon: Icon, label }: any) {
    return (
        <div>
            <RadioGroupItem value={value} id={value} className="peer sr-only" />
            <Label
                htmlFor={value}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-white/5 bg-[#0D1117] p-3 hover:bg-white/5 peer-data-[state=checked]:border-indigo-500 peer-data-[state=checked]:text-indigo-400 cursor-pointer transition-all h-24"
            >
                <Icon className="w-6 h-6" />
                <span className="text-xs font-bold">{label}</span>
            </Label>
        </div>
    )
}

function CheckIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <polyline points="20 6 9 17 4 12" />
        </svg>
    )
}
