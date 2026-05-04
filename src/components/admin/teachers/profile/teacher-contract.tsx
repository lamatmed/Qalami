'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { DollarSign, Building, CreditCard, Save } from 'lucide-react'
import { cn } from '@/lib/utils'

export function TeacherContract({ teacherId }: { teacherId?: string }) {
    const [contractType, setContractType] = useState('fixed') // fixed | hourly
    const [paymentMethod, setPaymentMethod] = useState('bank') // bank | wallet | cash

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h3 className="text-xl font-bold text-white">Contrat & Financier</h3>
                <p className="text-gray-400 text-sm">Gérez le type de contrat et les informations de paiement.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Contract Type & Rate */}
                <Card className="bg-[#1A2530] border-white/5 p-6 space-y-6">
                    <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                        <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-500">
                            <DollarSign className="w-5 h-5" />
                        </div>
                        <h4 className="font-bold text-white">Type de Contrat</h4>
                    </div>

                    <RadioGroup value={contractType} onValueChange={setContractType} className="grid grid-cols-2 gap-4">
                        <div>
                            <RadioGroupItem value="fixed" id="fixed" className="peer sr-only" />
                            <Label
                                htmlFor="fixed"
                                className={cn(
                                    "flex flex-col items-center justify-between rounded-xl border-2 border-white/5 bg-[#0F1720] p-4 hover:bg-white/5 hover:text-white peer-data-[state=checked]:border-emerald-500 [&:has([data-state=checked])]:border-emerald-500 cursor-pointer transition-all",
                                    contractType === 'fixed' ? "border-emerald-500 bg-emerald-500/5" : "text-gray-400"
                                )}
                            >
                                <Building className="mb-3 h-6 w-6" />
                                <span className="text-sm font-bold">Salaire Fixe (Mensuel)</span>
                            </Label>
                        </div>
                        <div>
                            <RadioGroupItem value="hourly" id="hourly" className="peer sr-only" />
                            <Label
                                htmlFor="hourly"
                                className={cn(
                                    "flex flex-col items-center justify-between rounded-xl border-2 border-white/5 bg-[#0F1720] p-4 hover:bg-white/5 hover:text-white peer-data-[state=checked]:border-emerald-500 [&:has([data-state=checked])]:border-emerald-500 cursor-pointer transition-all",
                                    contractType === 'hourly' ? "border-emerald-500 bg-emerald-500/5" : "text-gray-400"
                                )}
                            >
                                <ClockIcon className="mb-3 h-6 w-6" />
                                <span className="text-sm font-bold">Vacataire (Horaire)</span>
                            </Label>
                        </div>
                    </RadioGroup>

                    <div className="space-y-4 pt-2">
                        {contractType === 'fixed' ? (
                            <div className="space-y-2">
                                <Label className="text-xs text-gray-500 uppercase font-bold">Salaire Mensuel de Base (MRU)</Label>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        placeholder="Ex: 45000"
                                        className="bg-[#0F1720] border-white/10 h-12 text-lg font-bold text-white pl-4"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-bold">MRU</span>
                                </div>
                                <p className="text-[10px] text-gray-500">Montant fixe versé chaque mois avant primes.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label className="text-xs text-gray-500 uppercase font-bold">Taux Horaire (MRU/h)</Label>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        placeholder="Ex: 500"
                                        className="bg-[#0F1720] border-white/10 h-12 text-lg font-bold text-white pl-4"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-bold">MRU / h</span>
                                </div>
                                <p className="text-[10px] text-gray-500">Le salaire sera calculé automatiquement : Heures x Taux.</p>
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-2">
                            <Label className="text-sm font-bold text-gray-300">Cotisation CNSS</Label>
                            <Switch className="data-[state=checked]:bg-emerald-500" />
                        </div>
                    </div>
                </Card>

                {/* Payment Information */}
                <Card className="bg-[#1A2530] border-white/5 p-6 space-y-6">
                    <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                        <div className="bg-blue-500/10 p-2 rounded-lg text-blue-500">
                            <CreditCard className="w-5 h-5" />
                        </div>
                        <h4 className="font-bold text-white">Méthode de Paiement</h4>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-xs text-gray-500 uppercase font-bold">Moyen de virement</Label>
                            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                <SelectTrigger className="bg-[#0F1720] border-white/10 h-12 text-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1A2530] border-white/10 text-white">
                                    <SelectItem value="bank">Virement Bancaire</SelectItem>
                                    <SelectItem value="wallet">Portefeuille Digital (Bankily, Masrvi...)</SelectItem>
                                    <SelectItem value="cash">Espèces</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {paymentMethod === 'bank' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                <div className="space-y-2">
                                    <Label className="text-xs text-gray-500 uppercase font-bold">Nom de la Banque</Label>
                                    <Input placeholder="Ex: Banque Populaire de Mauritanie" className="bg-[#0F1720] border-white/10 text-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-gray-500 uppercase font-bold">Numéro de Compte / IBAN</Label>
                                    <Input placeholder="MR12 3456 ..." className="bg-[#0F1720] border-white/10 text-white font-mono" />
                                </div>
                            </div>
                        )}

                        {paymentMethod === 'wallet' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs text-gray-500 uppercase font-bold">Application</Label>
                                        <Select>
                                            <SelectTrigger className="bg-[#0F1720] border-white/10 h-10 text-white">
                                                <SelectValue placeholder="Choisir..." />
                                            </SelectTrigger>
                                            <SelectContent className="bg-[#1A2530] border-white/10 text-white">
                                                <SelectItem value="bankily">Bankily</SelectItem>
                                                <SelectItem value="masrvi">Masrvi</SelectItem>
                                                <SelectItem value="sedad">Sedad</SelectItem>
                                                <SelectItem value="click">Click</SelectItem>
                                                <SelectItem value="other">Autre</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs text-gray-500 uppercase font-bold">Numéro Tél.</Label>
                                        <Input placeholder="Ex: 36 12 34 56" className="bg-[#0F1720] border-white/10 text-white" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            <div className="flex justify-end pt-4">
                <Button className="bg-emerald-600 hover:bg-emerald-500 text-black font-bold h-12 px-8 shadow-lg shadow-emerald-900/20">
                    <Save className="w-4 h-4 mr-2" />
                    Enregistrer les modifications
                </Button>
            </div>
        </div>
    )
}

function ClockIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    )
}
