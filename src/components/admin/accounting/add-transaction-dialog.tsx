'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useTransition } from 'react'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n'

interface AddTransactionDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function AddTransactionDialog({ open, onOpenChange, onSuccess }: AddTransactionDialogProps) {
    const supabase = createClient()
    const [isPending, startTransition] = useTransition()
    const [type, setType] = useState<'income' | 'expense'>('income')
    const [amount, setAmount] = useState('')
    const [category, setCategory] = useState('cantine')
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [description, setDescription] = useState('')
    const [studentNni, setStudentNni] = useState('')
    const [nniSearching, setNniSearching] = useState(false)
    const [foundStudent, setFoundStudent] = useState<{ id: string, full_name: string | null } | null>(null)
    const [foundStudents, setFoundStudents] = useState<{ id: string, full_name: string | null, national_id: string | null }[]>([])
    const [nniError, setNniError] = useState('')
    const { t } = useLanguage()

    const handleTypeChange = (newType: 'income' | 'expense') => {
        setType(newType)
        if (newType === 'income') {
            setCategory('cantine')
        } else {
            setCategory('')
        }
        setStudentNni('')
        setFoundStudent(null)
        setFoundStudents([])
        setNniError('')
    }

    const handleNniChange = async (value: string) => {
        setStudentNni(value)
        setFoundStudent(null)
        setNniError('')
        if (value.trim().length < 3) {
            setFoundStudents([])
            return
        }
        setNniSearching(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
            if (!profile?.school_id) return
            const { data } = await supabase
                .from('profiles')
                .select('id, full_name, national_id')
                .or(`national_id.eq.${value.trim()},full_name.ilike.%${value.trim()}%`)
                .eq('school_id', profile.school_id)
                .limit(5)
            if (data && data.length > 0) {
                setFoundStudents(data)
                const exactNniMatch = data.find(s => s.national_id === value.trim())
                if (exactNniMatch) {
                    setFoundStudent(exactNniMatch)
                    setFoundStudents([])
                }
            } else {
                setFoundStudents([])
                setNniError('Aucun élève trouvé')
            }
        } finally {
            setNniSearching(false)
        }
    }

    const handleSubmit = () => {
        if (!amount || !category) {
            toast.error(t('admin.accounting.fillRequired'))
            return
        }

        startTransition(async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) throw new Error('Not authenticated')

                // Get user's school_id
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('school_id')
                    .eq('id', user.id)
                    .single()

                if (!profile?.school_id) throw new Error('No school associated')

                let relatedProfileId: string | null = null
                if (type === 'income' && foundStudent) {
                    relatedProfileId = foundStudent.id
                }

                const { error } = await supabase.from('transactions').insert({
                    school_id: profile.school_id,
                    type: type,
                    category: category,
                    amount: parseFloat(amount),
                    description: description,
                    transaction_date: date,
                    created_by: user.id,
                    status: 'completed',
                    ...(relatedProfileId ? { related_profile_id: relatedProfileId } : {})
                })

                if (error) throw error

                toast.success(t('admin.accounting.transactionSaved'))

                // Reset form
                setAmount('')
                setCategory('cantine')
                setType('income')
                setDescription('')
                setDate(new Date().toISOString().split('T')[0])
                setStudentNni('')
                setFoundStudent(null)
                setFoundStudents([])
                setNniError('')

                onOpenChange(false)
                onSuccess?.()
            } catch (error) {
                console.error('Error saving transaction:', error)
                toast.error(t('admin.accounting.saveError'))
            }
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-[#161B22] border-white/10 text-white p-0 gap-0">
                <DialogHeader className="px-6 py-4 border-b border-white/5 bg-[#0D1117]">
                    <DialogTitle className="text-lg font-bold">{t('admin.finance.newTransaction')}</DialogTitle>
                </DialogHeader>

                <div className="p-6 space-y-5">
                    {/* Type Selector */}
                    <div className="grid grid-cols-2 gap-3 p-1 bg-[#0D1117] rounded-xl border border-white/5">
                        <button
                            type="button"
                            onClick={() => handleTypeChange('income')}
                            className={cn(
                                "flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all",
                                type === 'income' ? "bg-emerald-500/10 text-emerald-500 shadow-sm" : "text-gray-400 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <ArrowUpRight className="w-4 h-4" /> {t('admin.finance.income')}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleTypeChange('expense')}
                            className={cn(
                                "flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all",
                                type === 'expense' ? "bg-red-500/10 text-red-500 shadow-sm" : "text-gray-400 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <ArrowDownRight className="w-4 h-4" /> {t('admin.finance.expenses')}
                        </button>
                    </div>

                    {/* Amount */}
                    <div className="space-y-2">
                        <Label className="text-xs text-gray-400 uppercase font-bold">{t('common.amount')} (MRU) *</Label>
                        <Input
                            type="number"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="bg-[#0D1117] border-white/10 h-12 text-lg font-bold text-white placeholder:text-gray-700"
                        />
                    </div>

                    {/* Category & Date */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs text-gray-400 uppercase font-bold">{t('admin.accounting.category')} *</Label>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger className="bg-[#0D1117] border-white/10 h-12 text-white">
                                    <SelectValue placeholder={t('admin.accounting.choose')} />
                                </SelectTrigger>
                                <SelectContent className="bg-[#161B22] border-white/10 text-white">
                                    {type === 'income' ? (
                                        <>
                                            <SelectItem value="cantine">Cantine</SelectItem>
                                            <SelectItem value="transport">Transport</SelectItem>
                                            <SelectItem value="cotisation">Cotisation</SelectItem>
                                            <SelectItem value="activites">Activités</SelectItem>
                                            <SelectItem value="autres">Autres</SelectItem>
                                        </>
                                    ) : (
                                        <>
                                            <SelectItem value="transport">{t('admin.finance.transport')}</SelectItem>
                                            <SelectItem value="maintenance">{t('admin.finance.maintenance')}</SelectItem>
                                            <SelectItem value="supplies">{t('admin.accounting.supplies')}</SelectItem>
                                            <SelectItem value="other">{t('admin.finance.others')}</SelectItem>
                                        </>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs text-gray-400 uppercase font-bold">Date</Label>
                            <div className="relative">
                                <Input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="bg-[#0D1117] border-white/10 h-12 text-white pl-4 pr-4"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label className="text-xs text-gray-400 uppercase font-bold">{t('common.description')}</Label>
                        <Input
                            placeholder={t('admin.accounting.descriptionPlaceholder')}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="bg-[#0D1117] border-white/10 h-12 text-white"
                        />
                    </div>

                    {/* Nom / NNI Élève (income only) */}
                    {type === 'income' && (
                        <div className="space-y-2 relative">
                            <Label className="text-xs text-gray-400 uppercase font-bold">Élève concerné (Nom ou NNI)</Label>
                            <div className="relative">
                                <Input
                                    placeholder="Nom complet ou NNI de l'élève..."
                                    value={studentNni}
                                    onChange={(e) => handleNniChange(e.target.value)}
                                    className="bg-[#0D1117] border-white/10 h-12 text-white pr-10"
                                />
                                {nniSearching && (
                                    <Loader2 className="absolute right-3 top-3.5 w-4 h-4 animate-spin text-gray-400" />
                                )}
                            </div>
                            {/* Autocomplete list */}
                            {foundStudents.length > 0 && !foundStudent && (
                                <div className="absolute left-0 right-0 z-50 bg-[#161B22] border border-white/10 rounded-xl overflow-hidden mt-1 divide-y divide-white/5 max-h-40 overflow-y-auto shadow-xl">
                                    {foundStudents.map(s => (
                                        <button
                                            key={s.id}
                                            type="button"
                                            onClick={() => {
                                                setFoundStudent(s)
                                                setStudentNni(s.full_name || '')
                                                setFoundStudents([])
                                            }}
                                            className="w-full text-left px-3 py-2.5 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                                        >
                                            <span className="font-bold">{s.full_name}</span>
                                            {s.national_id && <span className="text-gray-500 ml-2">(NNI: {s.national_id})</span>}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {foundStudent && (
                                <p className="text-xs text-emerald-400 font-medium px-1 flex items-center gap-1">
                                    <span>✓ {foundStudent.full_name}</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFoundStudent(null)
                                            setStudentNni('')
                                            setFoundStudents([])
                                        }}
                                        className="text-gray-500 hover:text-red-400 ml-2 underline"
                                    >
                                        Effacer
                                    </button>
                                </p>
                            )}
                            {nniError && !nniSearching && studentNni.trim().length >= 3 && foundStudents.length === 0 && (
                                <p className="text-xs text-red-400 px-1">{nniError}</p>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-4 bg-[#0D1117] border-t border-white/5 flex gap-3">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isPending}
                        className="flex-1 bg-transparent border-white/10 text-gray-400 hover:text-white hover:bg-white/5"
                    >
                        {t('common.cancel')}
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isPending}
                        className={cn("flex-1 font-bold text-white gap-2", type === 'income' ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500")}
                    >
                        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                        {t('common.save')}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
