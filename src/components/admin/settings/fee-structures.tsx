'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Loader2, Save, Info, Bus, Utensils, GraduationCap, Zap, DollarSign, Calendar, BookOpen, School, Layers
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getFeeStructuresAction, saveFeeStructuresAction } from '@/app/admin/settings/actions'
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

interface CycleConfig {
    registration: string
    tuition: string
}

type CycleState = Record<'fondamental' | 'college' | 'lycee', CycleConfig>

const FEE_TYPES: FeeType[] = [
    { id: 'bus',       label: 'Transport',   icon: Bus,            color: 'text-blue-400  bg-blue-500/10  border-blue-500/20',   description: 'Transport scolaire' },
    { id: 'cantine',   label: 'Cantine',     icon: Utensils,       color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', description: 'Restauration scolaire' },
    { id: 'activites', label: 'Activités',   icon: Zap,            color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', description: 'Activités parascolaires' },
]

const CYCLE_METADATA = [
    { id: 'fondamental', label: 'Cycle Fondamental', icon: BookOpen, color: 'border-blue-500/20 text-blue-400 bg-blue-500/5 hover:border-blue-500/40' },
    { id: 'college',     label: 'Cycle Collège',     icon: School,   color: 'border-indigo-500/20 text-indigo-400 bg-indigo-500/5 hover:border-indigo-500/40' },
    { id: 'lycee',       label: 'Cycle Lycée',       icon: GraduationCap, color: 'border-violet-500/20 text-violet-400 bg-violet-500/5 hover:border-violet-500/40' },
] as const

const STORAGE_KEY_PREFIX = 'qalami_fee_structures_'

// ─── Default values ────────────────────────────────────────────────────────────

function defaultFees(): FeeState {
    return {
        bus:       { amount: '', frequency: 'monthly',   due_day: '5',  enabled: false },
        cantine:   { amount: '', frequency: 'monthly',   due_day: '5',  enabled: false },
        activites: { amount: '', frequency: 'trimester', due_day: '15', enabled: false },
    }
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function FeeStructures() {
    const { t } = useLanguage()
    const [fees, setFees] = useState<FeeState>(defaultFees())
    const [cycles, setCycles] = useState<CycleState>({
        fondamental: { registration: '', tuition: '' },
        college: { registration: '', tuition: '' },
        lycee: { registration: '', tuition: '' }
    })
    
    const [currentYear, setCurrentYear] = useState<{ id: string; name: string } | null>(null)
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(true)
    const [schoolId, setSchoolId] = useState<string | null>(null)

    // Load school context + saved fees + cycle structures via server action (bypasses RLS)
    useEffect(() => {
        async function load() {
            try {
                const result = await getFeeStructuresAction()
                if ('error' in result && result.error) {
                    console.error("Failed to load fee configurations:", result.error)
                    setLoading(false)
                    return
                }

                setSchoolId(result.schoolId)
                setCurrentYear(result.year ?? null)

                if (result.cycleFees.length > 0) {
                    const loadedCycles: CycleState = {
                        fondamental: { registration: '', tuition: '' },
                        college:     { registration: '', tuition: '' },
                        lycee:       { registration: '', tuition: '' },
                    }
                    result.cycleFees.forEach((row: any) => {
                        if (row.cycle in loadedCycles) {
                            loadedCycles[row.cycle as keyof CycleState] = {
                                registration: row.default_registration_fee?.toString() || '',
                                tuition:      row.default_monthly_tuition?.toString()  || '',
                            }
                        }
                    })
                    setCycles(loadedCycles)
                }

                if (result.feeStructures.length > 0) {
                    const loadedFees = defaultFees()
                    result.feeStructures.forEach((row: any) => {
                        if (row.fee_type in loadedFees) {
                            loadedFees[row.fee_type] = {
                                amount:    row.amount?.toString() || '',
                                frequency: row.frequency,
                                due_day:   row.due_day?.toString() || '5',
                                enabled:   true,
                            }
                        }
                    })
                    setFees(loadedFees)
                }

                // Fallback: localStorage when no academic year configured
                if (!result.year) {
                    const key = `${STORAGE_KEY_PREFIX}${result.schoolId}`
                    const stored = localStorage.getItem(key)
                    if (stored) {
                        try { setFees(JSON.parse(stored)) } catch { /* ignore */ }
                    }
                }
            } catch (err) {
                console.error("Failed to load fee configurations:", err)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    const updateFee = (id: string, field: keyof FeeValues, value: string | boolean) => {
        setFees(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
    }

    const updateCycle = (id: keyof CycleState, field: keyof CycleConfig, value: string) => {
        setCycles(prev => ({
            ...prev,
            [id]: { ...prev[id], [field]: value }
        }))
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            // Guard for academic year
            if (!currentYear?.id || !schoolId) {
                const key = `${STORAGE_KEY_PREFIX}${schoolId}`
                localStorage.setItem(key, JSON.stringify(fees))
                toast.success("Config. locale enregistrée !", {
                    description: "Veuillez d'abord configurer l'année académique en cours.",
                })
                setSaving(false)
                return
            }

            const cycleList = Object.entries(cycles).map(([cName, cVals]) => ({
                cycle: cName,
                default_registration_fee: parseFloat(cVals.registration) || 0,
                default_monthly_tuition: parseFloat(cVals.tuition) || 0,
            }))

            const activeFees = FEE_TYPES
                .filter(t_item => fees[t_item.id].enabled && fees[t_item.id].amount)
                .map(t_item => ({
                    fee_type: t_item.id,
                    name: `${t('admin.settings.fees.types.' + t_item.id + '.label')} ${currentYear.name}`,
                    amount: parseFloat(fees[t_item.id].amount) || 0,
                    frequency: fees[t_item.id].frequency,
                    due_day: parseInt(fees[t_item.id].due_day) || 5,
                }))

            const disabledFeeTypes = FEE_TYPES
                .filter(t_item => !fees[t_item.id].enabled)
                .map(t_item => t_item.id)

            const result = await saveFeeStructuresAction({
                schoolId,
                academicYearId: currentYear.id,
                cycles: cycleList,
                activeFees,
                disabledFeeTypes,
            })

            if (result.error) throw new Error(result.error)

            toast.success(t('admin.settings.fees.toastSuccess') || "Configuration enregistrée avec succès !")
        } catch (err) {
            console.error("Save error:", err)
            const msg = err instanceof Error ? err.message : String(err)
            toast.error(`${t('admin.settings.fees.toastError') || "Erreur lors de la sauvegarde"} — ${msg}`)
        } finally {
            setSaving(false)
        }
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
        <div className="space-y-8 animate-in fade-in duration-300 pb-10">
            
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h3 className="text-xl font-bold text-white">{t('admin.settings.fees.title') || "Frais et Structures Tarifaires"}</h3>
                    <p className="text-gray-400 text-sm mt-1">
                        {t('admin.settings.fees.subtitle') || "Définissez les frais d'inscription, scolarité et services de l'établissement."}
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
            <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-sm text-emerald-300">
                <Layers className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                    <p className="font-semibold">Nouveau : Structuration financière par Cycle</p>
                    <p className="text-xs text-emerald-400/80 mt-0.5">
                        Configurez ci-dessous les tarifs de base par cycle (Fondamental, Collège, Lycée). Ils s'appliqueront automatiquement à l'ajout des élèves.
                    </p>
                </div>
            </div>

            {/* 🏆 1. CYCLE TARIFS GRID (PRIMARY BLOCK) */}
            <div className="space-y-4">
                <div>
                    <h4 className="text-sm font-bold text-gray-300 flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-emerald-500" />
                        Scolarité de base par Cycle Éducatif
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5">Ces montants serviront de base pour chaque élève inscrit dans ces cycles.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {CYCLE_METADATA.map((c) => {
                        const Icon = c.icon
                        const currentVals = cycles[c.id]
                        
                        return (
                            <div 
                                key={c.id} 
                                className={cn(
                                    "p-5 rounded-2xl border bg-[#1A2530] transition-all duration-200 group relative overflow-hidden",
                                    c.color
                                )}
                            >
                                {/* Top highlight gradient */}
                                <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-white/5 blur-2xl group-hover:bg-white/10 transition-all duration-300" />
                                
                                <div className="flex items-center gap-3 mb-4 relative z-10">
                                    <div className="h-9 w-9 rounded-xl bg-[#0F1720] flex items-center justify-center shadow-inner border border-white/5">
                                        <Icon className="w-5 h-5 text-white/80" />
                                    </div>
                                    <span className="text-sm font-bold text-white">{c.label}</span>
                                </div>

                                <div className="space-y-3 relative z-10">
                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Frais d'Inscription</Label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                                            <Input 
                                                type="number"
                                                placeholder="0"
                                                value={currentVals.registration}
                                                onChange={(e) => updateCycle(c.id, 'registration', e.target.value)}
                                                className="bg-[#0F1720] border-white/10 text-white text-sm pl-7 font-mono h-9 focus:border-emerald-500/50"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Mensualité Scolarité</Label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                                            <Input 
                                                type="number"
                                                placeholder="0"
                                                value={currentVals.tuition}
                                                onChange={(e) => updateCycle(c.id, 'tuition', e.target.value)}
                                                className="bg-[#0F1720] border-white/10 text-white text-sm pl-7 font-mono h-9 focus:border-emerald-500/50"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            <hr className="border-white/5 my-2" />

            {/* 📦 2. ADDITIONAL SERVICES (SECONDARY BLOCK) */}
            <div className="space-y-4">
                <div>
                    <h4 className="text-sm font-bold text-gray-300 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-emerald-500" />
                        Services Optionnels & Complémentaires
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5">Frais additionnels pouvant être facturés aux élèves (Transport, cantine, etc.).</p>
                </div>

                <div className="space-y-3">
                    {FEE_TYPES.map(type => {
                        const fee = fees[type.id]
                        const Icon = type.icon
                        const annual = annualEquivalent(fee)

                        return (
                            <div
                                key={type.id}
                                className={cn(
                                    "rounded-2xl border transition-all duration-300",
                                    fee.enabled
                                        ? "bg-[#1A2530] border-white/10 shadow-lg shadow-black/10"
                                        : "bg-[#0F1720] border-white/5 opacity-60 hover:opacity-80"
                                )}
                            >
                                {/* Header row */}
                                <div className="flex items-center gap-4 p-4">
                                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 transition-transform duration-300 group-hover:scale-105", type.color)}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-white text-sm">{t('admin.settings.fees.types.' + type.id + '.label') || type.label}</p>
                                        <p className="text-xs text-gray-500">{t('admin.settings.fees.types.' + type.id + '.desc') || type.description}</p>
                                    </div>

                                    {/* Enabled toggle */}
                                    <button
                                        type="button"
                                        aria-label={fee.enabled ? "Désactiver" : "Activer"}
                                        onClick={() => updateFee(type.id, 'enabled', !fee.enabled)}
                                        className={cn(
                                            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                                            fee.enabled ? "bg-emerald-500" : "bg-white/10"
                                        )}
                                    >
                                        <span className={cn(
                                            "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transform transition duration-200 ease-in-out",
                                            fee.enabled ? "translate-x-4" : "translate-x-0"
                                        )} />
                                    </button>
                                </div>

                                {/* Config row */}
                                {fee.enabled && (
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-4 pb-4 border-t border-white/5 pt-4 animate-in slide-in-from-top-2 duration-200">
                                        <div className="space-y-1.5">
                                            <Label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{t('admin.settings.fees.amountLabel') || "Montant"}</Label>
                                            <div className="relative">
                                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                                                <Input
                                                    type="number"
                                                    value={fee.amount}
                                                    onChange={e => updateFee(type.id, 'amount', e.target.value)}
                                                    placeholder="0"
                                                    className="pl-8 bg-[#0F1720] border-white/10 text-white font-mono h-10 focus:border-emerald-500/50"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{t('admin.settings.fees.frequencyLabel') || "Fréquence"}</Label>
                                            <div className="flex gap-1 flex-wrap bg-[#0F1720] p-1 rounded-xl border border-white/5">
                                                {(['monthly', 'trimester', 'annual'] as const).map(f => (
                                                    <button
                                                        type="button"
                                                        key={f}
                                                        onClick={() => updateFee(type.id, 'frequency', f)}
                                                        className={cn(
                                                            "flex-1 text-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                                            fee.frequency === f
                                                                ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
                                                                : "text-gray-400 hover:text-white hover:bg-white/5"
                                                        )}
                                                    >
                                                        {t('admin.settings.fees.frequencies.' + f) || (f === 'monthly' ? 'Mensuel' : f === 'trimester' ? 'Trimestriel' : 'Annuel')}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{t('admin.settings.fees.dueDayLabel') || "Jour d'échéance"}</Label>
                                            <Input
                                                type="number"
                                                min="1"
                                                max="28"
                                                value={fee.due_day}
                                                onChange={e => updateFee(type.id, 'due_day', e.target.value)}
                                                placeholder="5"
                                                className="bg-[#0F1720] border-white/10 text-white font-mono h-10 focus:border-emerald-500/50"
                                            />
                                            {annual > 0 && (
                                                <p className="text-[11px] text-emerald-400 font-semibold mt-1 animate-in fade-in">
                                                    ✨ {t('admin.settings.fees.annualEquivalent')?.replace('{amount}', annual.toLocaleString('fr-FR')) || `Équivalent annuel : ${annual.toLocaleString('fr-FR')} MRU`}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* 📝 Annual summary of optional services */}
            {FEE_TYPES.some(t_item => fees[t_item.id].enabled && fees[t_item.id].amount) && (
                <div className="bg-[#1A2530] rounded-2xl border border-white/5 p-5 animate-in slide-in-from-bottom-2 duration-300">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Info className="w-3.5 h-3.5 text-gray-500" />
                        {t('admin.settings.fees.annualSummaryTitle') || "Récapitulatif Annuel (Services Complémentaires)"}
                    </h4>
                    <div className="space-y-3">
                        {FEE_TYPES.filter(t_item => fees[t_item.id].enabled && fees[t_item.id].amount).map(type => {
                            const annual = annualEquivalent(fees[type.id])
                            return (
                                <div key={type.id} className="flex justify-between items-center text-sm">
                                    <span className="text-gray-400 flex items-center gap-2">
                                        <div className={cn("w-2 h-2 rounded-full", type.color.split(" ")[0])} />
                                        {t('admin.settings.fees.types.' + type.id + '.label') || type.label}
                                    </span>
                                    <span className="font-mono font-bold text-white">{annual.toLocaleString('fr-FR')} <span className="text-gray-500 text-[10px] font-normal">MRU / an</span></span>
                                </div>
                            )
                        })}
                        <div className="pt-3 border-t border-white/10 flex justify-between items-center text-sm font-bold">
                             <span className="text-white">{t('admin.settings.fees.totalAnnual') || "Total Compléments Annuel"}</span>
                             <span className="font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
                                 {FEE_TYPES
                                     .filter(t_item => fees[t_item.id].enabled && fees[t_item.id].amount)
                                     .reduce((s, t_item) => s + annualEquivalent(fees[t_item.id]), 0)
                                     .toLocaleString('fr-FR')}{' '}
                                 <span className="text-gray-500 text-[10px] font-normal">MRU</span>
                             </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Action Row */}
            <div className="flex justify-end pt-4">
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold tracking-wide px-6 py-5 rounded-xl text-sm hover:shadow-lg hover:shadow-emerald-500/20 transition-all"
                >
                    {saving ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Save className="w-4 h-4 me-2" />}
                    {saving ? (t('admin.settings.fees.saving') || "Enregistrement...") : (t('admin.settings.fees.saveButton') || "Sauvegarder la Configuration")}
                </Button>
            </div>
        </div>
    )
}
