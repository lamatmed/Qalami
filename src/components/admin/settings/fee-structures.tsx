'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Loader2, Save, Info, Bus, Utensils, GraduationCap, Zap, DollarSign, Calendar,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getMySchoolContext } from '@/app/admin/actions'
import { useLanguage } from '@/i18n'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface FeeType {
    id: string
    label: string
    icon: React.ElementType
    color: string
    description: string
}

interface FeeValues {
    amount: string
    frequency: 'monthly' | 'trimester' | 'annual'
    due_day: string
    enabled: boolean
}

type FeeState = Record<string, FeeValues>

const FEE_TYPES: FeeType[] = [
    { id: 'scolarite', label: 'Scolarité',   icon: GraduationCap, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20', description: 'Frais de scolarité de base' },
    { id: 'bus',       label: 'Transport',   icon: Bus,            color: 'text-blue-400  bg-blue-500/10  border-blue-500/20',   description: 'Transport scolaire' },
    { id: 'cantine',   label: 'Cantine',     icon: Utensils,       color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', description: 'Restauration scolaire' },
    { id: 'activites', label: 'Activités',   icon: Zap,            color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', description: 'Activités parascolaires' },
]

const FREQ_LABELS: Record<string, string> = {
    monthly: 'Mensuel',
    trimester: 'Par trimestre',
    annual: 'Annuel',
}

const STORAGE_KEY_PREFIX = 'qalami_fee_structures_'

// ─── Default values ────────────────────────────────────────────────────────────

function defaultFees(): FeeState {
    return {
        scolarite: { amount: '', frequency: 'monthly',   due_day: '5',  enabled: true  },
        bus:       { amount: '', frequency: 'monthly',   due_day: '5',  enabled: false },
        cantine:   { amount: '', frequency: 'monthly',   due_day: '5',  enabled: false },
        activites: { amount: '', frequency: 'trimester', due_day: '15', enabled: false },
    }
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function FeeStructures() {
    const { t } = useLanguage()
    const [fees, setFees] = useState<FeeState>(defaultFees())
    const [currentYear, setCurrentYear] = useState<{ id: string; name: string } | null>(null)
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(true)
    const [schoolId, setSchoolId] = useState<string | null>(null)

    // Load school context + saved fees
    useEffect(() => {
        async function load() {
            const supabase = createClient()
            const ctx = await getMySchoolContext()
            if (!ctx) { setLoading(false); return }
            const profile = { school_id: ctx.school_id }

            setSchoolId(profile.school_id)

            const { data: year } = await supabase
                .from('academic_years')
                .select('id, name')
                .eq('school_id', profile.school_id)
                .eq('is_current', true)
                .single()
            setCurrentYear(year ?? null)

            // Load from localStorage
            const key = `${STORAGE_KEY_PREFIX}${profile.school_id}`
            const stored = localStorage.getItem(key)
            if (stored) {
                try { setFees(JSON.parse(stored)) } catch { /* ignore */ }
            }

            setLoading(false)
        }
        load()
    }, [])

    const updateFee = (id: string, field: keyof FeeValues, value: string | boolean) => {
        setFees(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            // Persist locally (localStorage for now)
            const key = `${STORAGE_KEY_PREFIX}${schoolId}`
            localStorage.setItem(key, JSON.stringify(fees))

            // Upsert to fee_structures table
            const supabase = createClient()

            if (!currentYear?.id) {
                toast.success(t('admin.settings.fees.toastLocalSuccess'), {
                    description: t('admin.settings.fees.toastLocalDesc'),
                })
                setSaving(false)
                return
            }

            const activeFees = FEE_TYPES
                .filter(t_item => fees[t_item.id].enabled && fees[t_item.id].amount)
                .map(t_item => ({
                    school_id: schoolId,
                    academic_year_id: currentYear.id,
                    name: `${t('admin.settings.fees.types.' + t_item.id + '.label')} ${currentYear.name}`,
                    fee_type: t_item.id,
                    amount: parseFloat(fees[t_item.id].amount) || 0,
                    frequency: fees[t_item.id].frequency,
                    due_day: parseInt(fees[t_item.id].due_day) || 5,
                    is_active: true,
                }))

            if (activeFees.length > 0) {
                const { error } = await supabase
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .from('fee_structures' as any)
                    .upsert(activeFees, { onConflict: 'school_id,academic_year_id,fee_type' })
                    .select()

                if (error) {
                    // Fallback to local-only if table or constraint is missing
                    toast.success(t('admin.settings.fees.toastLocalSuccess'))
                } else {
                    toast.success(t('admin.settings.fees.toastSuccess'))
                }
            } else {
                toast.success(t('admin.settings.fees.toastSuccess'))
            }
        } catch {
            toast.error(t('admin.settings.fees.toastError'))
        }
        setSaving(false)
    }

    // Compute annual equivalent for display
    function annualEquivalent(fee: FeeValues): number {
        const amount = parseFloat(fee.amount) || 0
        if (fee.frequency === 'monthly') return amount * 10
        if (fee.frequency === 'trimester') return amount * 3
        return amount
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h3 className="text-xl font-bold text-white">{t('admin.settings.fees.title')}</h3>
                    <p className="text-gray-400 text-sm mt-1">
                        {t('admin.settings.fees.subtitle')}
                    </p>
                </div>
                {currentYear && (
                    <div className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                        <Calendar className="w-3.5 h-3.5" />
                        {currentYear.name}
                    </div>
                )}
            </div>

            {/* Info banner */}
            <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-300">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                    <p className="font-semibold">{t('admin.settings.fees.infoTitle')}</p>
                    <p className="text-xs text-blue-400 mt-0.5">
                        {t('admin.settings.fees.infoDesc')}
                    </p>
                </div>
            </div>

            {/* Fee cards */}
            <div className="space-y-3">
                {FEE_TYPES.map(type => {
                    const fee = fees[type.id]
                    const Icon = type.icon
                    const annual = annualEquivalent(fee)

                    return (
                        <div
                            key={type.id}
                            className={cn(
                                "rounded-2xl border transition-all",
                                fee.enabled
                                    ? "bg-[#1A2530] border-white/10"
                                    : "bg-[#0F1720] border-white/5 opacity-60"
                            )}
                        >
                            {/* Header row */}
                            <div className="flex items-center gap-4 p-4">
                                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border shrink-0", type.color)}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-white text-sm">{t('admin.settings.fees.types.' + type.id + '.label')}</p>
                                    <p className="text-xs text-gray-500">{t('admin.settings.fees.types.' + type.id + '.desc')}</p>
                                </div>

                                {/* Enabled toggle */}
                                <button
                                    onClick={() => updateFee(type.id, 'enabled', !fee.enabled)}
                                    className={cn(
                                        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
                                        fee.enabled ? "bg-emerald-500" : "bg-white/10"
                                    )}
                                >
                                    <span className={cn(
                                        "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200",
                                        fee.enabled ? "translate-x-4" : "translate-x-0"
                                    )} />
                                </button>
                            </div>

                            {/* Config row */}
                            {fee.enabled && (
                                <div className="grid grid-cols-3 gap-3 px-4 pb-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{t('admin.settings.fees.amountLabel')}</Label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                                            <Input
                                                type="number"
                                                value={fee.amount}
                                                onChange={e => updateFee(type.id, 'amount', e.target.value)}
                                                placeholder="0"
                                                className="pl-8 bg-[#0F1720] border-white/10 text-white font-mono"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{t('admin.settings.fees.frequencyLabel')}</Label>
                                        <div className="flex flex-col gap-1">
                                            {(['monthly', 'trimester', 'annual'] as const).map(f => (
                                                <button
                                                    key={f}
                                                    onClick={() => updateFee(type.id, 'frequency', f)}
                                                    className={cn(
                                                        "text-left px-2 py-1 rounded-lg text-xs font-medium transition-colors",
                                                        fee.frequency === f
                                                            ? "bg-emerald-500/20 text-emerald-400"
                                                            : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                                                    )}
                                                >
                                                    {t('admin.settings.fees.frequencies.' + f)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{t('admin.settings.fees.dueDayLabel')}</Label>
                                        <Input
                                            type="number"
                                            min="1"
                                            max="28"
                                            value={fee.due_day}
                                            onChange={e => updateFee(type.id, 'due_day', e.target.value)}
                                            placeholder="5"
                                            className="bg-[#0F1720] border-white/10 text-white font-mono"
                                        />
                                        {annual > 0 && (
                                            <p className="text-[11px] text-emerald-400 font-semibold">
                                                {t('admin.settings.fees.annualEquivalent').replace('{amount}', annual.toLocaleString('fr-FR'))}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Annual summary */}
            {FEE_TYPES.some(t_item => fees[t_item.id].enabled && fees[t_item.id].amount) && (
                <div className="bg-[#1A2530] rounded-2xl border border-white/5 p-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">{t('admin.settings.fees.annualSummaryTitle')}</h4>
                    <div className="space-y-2">
                        {FEE_TYPES.filter(t_item => fees[t_item.id].enabled && fees[t_item.id].amount).map(type => {
                            const annual = annualEquivalent(fees[type.id])
                            return (
                                <div key={type.id} className="flex justify-between text-sm">
                                    <span className="text-gray-400">{t('admin.settings.fees.types.' + type.id + '.label')}</span>
                                    <span className="font-mono font-bold text-white">{annual.toLocaleString('fr-FR')} <span className="text-gray-500 text-xs">MRU</span></span>
                                </div>
                            )
                        })}
                        <div className="pt-2 border-t border-white/5 flex justify-between text-sm font-bold">
                             <span className="text-white">{t('admin.settings.fees.totalAnnual')}</span>
                             <span className="font-mono text-emerald-400">
                                 {FEE_TYPES
                                     .filter(t_item => fees[t_item.id].enabled && fees[t_item.id].amount)
                                     .reduce((s, t_item) => s + annualEquivalent(fees[t_item.id]), 0)
                                     .toLocaleString('fr-FR')}{' '}
                                 <span className="text-gray-500 text-xs font-normal">MRU</span>
                             </span>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-end">
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold"
                >
                    {saving ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Save className="w-4 h-4 me-2" />}
                    {saving ? t('admin.settings.fees.saving') : t('admin.settings.fees.saveButton')}
                </Button>
            </div>
        </div>
    )
}
