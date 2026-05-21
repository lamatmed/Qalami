'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { DollarSign, Building, CreditCard, Save, Loader2, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/i18n'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'

export function TeacherContract({ teacherId }: { teacherId?: string }) {
    const { t } = useLanguage()

    // Form state
    const [contractType, setContractType] = useState('fixed') // fixed | hourly
    const [salary, setSalary] = useState('')
    const [hourlyRate, setHourlyRate] = useState('')
    const [cnss, setCnss] = useState(false)
    const [paymentMethod, setPaymentMethod] = useState('bank')
    const [bankName, setBankName] = useState('')
    const [accountNumber, setAccountNumber] = useState('')
    const [walletApp, setWalletApp] = useState('')
    const [walletPhone, setWalletPhone] = useState('')
    const [position, setPosition] = useState('')

    // Meta state
    const [contractId, setContractId] = useState<string | null>(null)
    const [schoolId, setSchoolId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    // Load existing contract on mount
    useEffect(() => {
        if (!teacherId) { setLoading(false); return }

        async function loadContract() {
            setLoading(true)
            const supabase = createClient()

            // Get admin's school_id
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setLoading(false); return }

            const { data: me } = await supabase
                .from('profiles')
                .select('school_id')
                .eq('id', user.id)
                .single()

            if (!me?.school_id) { setLoading(false); return }
            setSchoolId(me.school_id)

            // Fetch existing contract for this teacher
            const { data: contract } = await supabase
                .from('contracts')
                .select('*')
                .eq('employee_id', teacherId)
                .eq('school_id', me.school_id)
                .eq('status', 'active')
                .maybeSingle()

            if (contract) {
                setContractId(contract.id)
                setPosition(contract.position || '')
                const isHourly = contract.contract_type === 'hourly'
                setContractType(isHourly ? 'hourly' : 'fixed')
                if (isHourly) {
                    setHourlyRate(contract.monthly_salary?.toString() || '')
                } else {
                    setSalary(contract.monthly_salary?.toString() || '')
                }
                setCnss(contract.cnss ?? false)
                setPaymentMethod(contract.payment_method || 'bank')
                setBankName(contract.bank_name || '')
                setAccountNumber(contract.account_number || '')
                setWalletApp(contract.wallet_app || '')
                setWalletPhone(contract.wallet_phone || '')
            }

            setLoading(false)
        }

        loadContract()
    }, [teacherId])

    const handleSave = async () => {
        if (!teacherId || !schoolId) {
            toast.error(t('admin.teachers.contract.saveError') || 'Enseignant non identifié')
            return
        }

        const monthlySalary = contractType === 'fixed'
            ? parseFloat(salary) || 0
            : parseFloat(hourlyRate) || 0

        setSaving(true)
        setSaved(false)
        try {
            const supabase = createClient()

            const payload = {
                school_id: schoolId,
                employee_id: teacherId,
                contract_type: contractType === 'fixed' ? 'CDI' : 'hourly',
                position: position || 'Enseignant',
                monthly_salary: monthlySalary,
                start_date: new Date().toISOString().split('T')[0],
                status: 'active',
            }

            let error
            if (contractId) {
                // Update existing
                const { error: updateError } = await supabase
                    .from('contracts')
                    .update(payload)
                    .eq('id', contractId)
                error = updateError
            } else {
                // Insert new and save the id
                const { data: inserted, error: insertError } = await supabase
                    .from('contracts')
                    .insert(payload)
                    .select('id')
                    .single()
                error = insertError
                if (inserted?.id) setContractId(inserted.id)
            }

            if (error) throw error

            setSaved(true)
            toast.success(t('admin.teachers.contract.saveSuccess') || 'Contrat enregistré avec succès')
            setTimeout(() => setSaved(false), 3000)
        } catch (err: any) {
            console.error('[TeacherContract] save error:', err)
            toast.error(t('admin.teachers.contract.saveError') || 'Erreur lors de l\'enregistrement', {
                description: err.message
            })
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <Skeleton className="h-8 w-48" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Skeleton className="h-64 rounded-2xl" />
                    <Skeleton className="h-64 rounded-2xl" />
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h3 className="text-xl font-bold text-white">{t('admin.teachers.contract.title')}</h3>
                <p className="text-gray-400 text-sm">{t('admin.teachers.contract.subtitle')}</p>
            </div>

            {/* Position */}
            <div className="space-y-2">
                <Label className="text-xs text-gray-500 uppercase font-bold">
                    {t('admin.teachers.contract.position') || 'Poste / Fonction'}
                </Label>
                <Input
                    placeholder="Ex: Enseignant de Mathématiques"
                    value={position}
                    onChange={e => setPosition(e.target.value)}
                    className="bg-[#0F1720] border-white/10 text-white h-11"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Contract Type & Rate */}
                <Card className="bg-[#1A2530] border-white/5 p-6 space-y-6">
                    <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                        <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-500">
                            <DollarSign className="w-5 h-5" />
                        </div>
                        <h4 className="font-bold text-white">{t('admin.teachers.contract.typeTitle')}</h4>
                    </div>

                    <RadioGroup value={contractType} onValueChange={setContractType} className="grid grid-cols-2 gap-4">
                        <div>
                            <RadioGroupItem value="fixed" id="fixed" className="peer sr-only" />
                            <Label
                                htmlFor="fixed"
                                className={cn(
                                    "flex flex-col items-center justify-between rounded-xl border-2 border-white/5 bg-[#0F1720] p-4 hover:bg-white/5 hover:text-white cursor-pointer transition-all",
                                    contractType === 'fixed' ? "border-emerald-500 bg-emerald-500/5 text-white" : "text-gray-400"
                                )}
                            >
                                <Building className="mb-3 h-6 w-6" />
                                <span className="text-sm font-bold">{t('admin.teachers.contract.fixedSalary')}</span>
                            </Label>
                        </div>
                        <div>
                            <RadioGroupItem value="hourly" id="hourly" className="peer sr-only" />
                            <Label
                                htmlFor="hourly"
                                className={cn(
                                    "flex flex-col items-center justify-between rounded-xl border-2 border-white/5 bg-[#0F1720] p-4 hover:bg-white/5 hover:text-white cursor-pointer transition-all",
                                    contractType === 'hourly' ? "border-emerald-500 bg-emerald-500/5 text-white" : "text-gray-400"
                                )}
                            >
                                <ClockIcon className="mb-3 h-6 w-6" />
                                <span className="text-sm font-bold">{t('admin.teachers.contract.hourlySalary')}</span>
                            </Label>
                        </div>
                    </RadioGroup>

                    <div className="space-y-4 pt-2">
                        {contractType === 'fixed' ? (
                            <div className="space-y-2">
                                <Label className="text-xs text-gray-500 uppercase font-bold">{t('admin.teachers.contract.fixedSalaryLabel')}</Label>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        placeholder="Ex: 45000"
                                        value={salary}
                                        onChange={e => setSalary(e.target.value)}
                                        className="bg-[#0F1720] border-white/10 h-12 text-lg font-bold text-white pl-4 pr-16"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-bold">MRU</span>
                                </div>
                                <p className="text-[10px] text-gray-500">{t('admin.teachers.contract.fixedSalaryDesc')}</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label className="text-xs text-gray-500 uppercase font-bold">{t('admin.teachers.contract.hourlySalaryLabel')}</Label>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        placeholder="Ex: 500"
                                        value={hourlyRate}
                                        onChange={e => setHourlyRate(e.target.value)}
                                        className="bg-[#0F1720] border-white/10 h-12 text-lg font-bold text-white pl-4 pr-20"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-bold">MRU / h</span>
                                </div>
                                <p className="text-[10px] text-gray-500">{t('admin.teachers.contract.hourlySalaryDesc')}</p>
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-2">
                            <Label className="text-sm font-bold text-gray-300">{t('admin.teachers.contract.cnss')}</Label>
                            <Switch
                                checked={cnss}
                                onCheckedChange={setCnss}
                                className="data-[state=checked]:bg-emerald-500"
                            />
                        </div>
                    </div>
                </Card>

                {/* Payment Information */}
                <Card className="bg-[#1A2530] border-white/5 p-6 space-y-6">
                    <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                        <div className="bg-blue-500/10 p-2 rounded-lg text-blue-500">
                            <CreditCard className="w-5 h-5" />
                        </div>
                        <h4 className="font-bold text-white">{t('admin.teachers.contract.paymentMethodTitle')}</h4>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-xs text-gray-500 uppercase font-bold">{t('admin.teachers.contract.paymentMethodLabel')}</Label>
                            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                <SelectTrigger className="bg-[#0F1720] border-white/10 h-12 text-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1A2530] border-white/10 text-white">
                                    <SelectItem value="bank">{t('admin.teachers.contract.bankTransfer')}</SelectItem>
                                    <SelectItem value="wallet">{t('admin.teachers.contract.digitalWallet')}</SelectItem>
                                    <SelectItem value="cash">{t('admin.teachers.contract.cash')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {paymentMethod === 'bank' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                <div className="space-y-2">
                                    <Label className="text-xs text-gray-500 uppercase font-bold">{t('admin.teachers.contract.bankName')}</Label>
                                    <Input
                                        placeholder="Ex: Banque Populaire de Mauritanie"
                                        value={bankName}
                                        onChange={e => setBankName(e.target.value)}
                                        className="bg-[#0F1720] border-white/10 text-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-gray-500 uppercase font-bold">{t('admin.teachers.contract.accountNumber')}</Label>
                                    <Input
                                        placeholder="MR12 3456 ..."
                                        value={accountNumber}
                                        onChange={e => setAccountNumber(e.target.value)}
                                        className="bg-[#0F1720] border-white/10 text-white font-mono"
                                    />
                                </div>
                            </div>
                        )}

                        {paymentMethod === 'wallet' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs text-gray-500 uppercase font-bold">Application / Wallet</Label>
                                        <Select value={walletApp} onValueChange={setWalletApp}>
                                            <SelectTrigger className="bg-[#0F1720] border-white/10 h-10 text-white">
                                                <SelectValue placeholder={t('admin.teachers.contract.choose')} />
                                            </SelectTrigger>
                                            <SelectContent className="bg-[#1A2530] border-white/10 text-white">
                                                <SelectItem value="bankily">Bankily</SelectItem>
                                                <SelectItem value="masrvi">Masrvi</SelectItem>
                                                <SelectItem value="sedad">Sedad</SelectItem>
                                                <SelectItem value="click">Click</SelectItem>
                                                <SelectItem value="other">{t('admin.teachers.contract.other')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs text-gray-500 uppercase font-bold">{t('admin.teachers.contract.phoneNumber')}</Label>
                                        <Input
                                            placeholder="Ex: 36 12 34 56"
                                            value={walletPhone}
                                            onChange={e => setWalletPhone(e.target.value)}
                                            className="bg-[#0F1720] border-white/10 text-white"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {paymentMethod === 'cash' && (
                            <div className="animate-in fade-in slide-in-from-top-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                                <p className="text-amber-400 text-sm font-medium">
                                    {t('admin.teachers.contract.cashNote') || 'Le paiement sera effectué en espèces directement à l\'enseignant.'}
                                </p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            <div className="flex justify-end pt-4">
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    className={cn(
                        "h-12 px-8 shadow-lg font-bold transition-all",
                        saved
                            ? "bg-emerald-400 hover:bg-emerald-400 text-black shadow-emerald-900/20"
                            : "bg-emerald-600 hover:bg-emerald-500 text-black shadow-emerald-900/20"
                    )}
                >
                    {saving ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : saved ? (
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                    ) : (
                        <Save className="w-4 h-4 mr-2" />
                    )}
                    {saving
                        ? (t('common.saving') || 'Enregistrement...')
                        : saved
                            ? (t('common.saved') || 'Enregistré !')
                            : t('admin.teachers.contract.saveChanges')
                    }
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
