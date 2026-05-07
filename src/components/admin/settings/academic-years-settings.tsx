'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
    createAcademicYear,
    setCurrentAcademicYear,
    deleteAcademicYear,
} from '@/app/admin/terms/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Loader2, CheckCircle2, Star, Trash2, Calendar, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getMySchoolContext } from '@/app/admin/actions'
import { useLanguage } from '@/i18n'

interface Term { id: string; name: string; is_current: boolean }
interface AcademicYear {
    id: string
    name: string
    is_current: boolean
    start_date: string
    end_date: string
    terms: Term[]
}

const TERM_COLORS: Record<string, string> = {
    T1: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    T2: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    T3: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

export function AcademicYearsSettings() {
    const { t } = useLanguage()
    const [years, setYears] = useState<AcademicYear[]>([])
    const [loading, setLoading] = useState(true)
    const [newYear, setNewYear] = useState('')
    const [adding, setAdding] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [settingId, setSettingId] = useState<string | null>(null)

    async function fetchYears() {
        const supabase = createClient()
        const ctx = await getMySchoolContext()
        if (!ctx) return
        const profile = { school_id: ctx.school_id }

        const [{ data: yearsData }, { data: termsData }] = await Promise.all([
            supabase.from('academic_years')
                .select('id, name, is_current, start_date, end_date')
                .eq('school_id', profile.school_id)
                .order('name', { ascending: false }),
            supabase.from('terms')
                .select('id, name, is_current, academic_year_id')
                .eq('school_id', profile.school_id)
                .order('name'),
        ])

        const termsByYear = new Map<string, Term[]>()
        ;(termsData || []).forEach((t: { id: string; name: string; is_current: boolean; academic_year_id: string }) => {
            const list = termsByYear.get(t.academic_year_id) || []
            list.push({ id: t.id, name: t.name, is_current: t.is_current })
            termsByYear.set(t.academic_year_id, list)
        })

        setYears((yearsData || []).map((y: { id: string; name: string; is_current: boolean; start_date: string; end_date: string }) => ({
            ...y,
            terms: termsByYear.get(y.id) || [],
        })))
         
        setLoading(false)
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { fetchYears() }, [])

    const handleAdd = async () => {
        const trimmed = newYear.trim()
        if (!trimmed) return
        setAdding(true)
        const result = await createAcademicYear(trimmed)
        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success(t('admin.settings.academic.createSuccess').replace('{trimmed}', trimmed))
            setNewYear('')
            fetchYears()
        }
        setAdding(false)
    }

    const handleSetCurrent = async (yearId: string) => {
        setSettingId(yearId)
        const result = await setCurrentAcademicYear(yearId)
        if (result.error) toast.error(result.error)
        else { toast.success(t('admin.settings.academic.updateSuccess')); fetchYears() }
        setSettingId(null)
    }

    const handleDelete = async (yearId: string, yearName: string) => {
        if (!confirm(t('admin.settings.academic.confirmDelete').replace('{yearName}', yearName))) return
        setDeletingId(yearId)
        const result = await deleteAcademicYear(yearId)
        if (result.error) toast.error(result.error)
        else { toast.success(t('admin.settings.academic.deleteSuccess')); fetchYears() }
        setDeletingId(null)
    }

    // Auto-suggest next year
    const suggestYear = () => {
        if (years.length === 0) return
        const latest = years[0].name
        const [, end] = latest.split('-').map(Number)
        setNewYear(`${end}-${end + 1}`)
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            <div>
                <h3 className="text-xl font-bold text-white">{t('admin.settings.academic.title')}</h3>
                <p className="text-gray-400 text-sm mt-1">
                    {t('admin.settings.academic.subtitle')}
                </p>
            </div>

            {/* Add new year */}
            <div className="bg-[#1A2530] rounded-2xl border border-white/5 p-5">
                <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-4">{t('admin.settings.academic.newYear')}</h4>
                <div className="flex gap-3">
                    <div className="flex-1">
                        <Input
                            placeholder="2026-2027"
                            value={newYear}
                            onChange={e => setNewYear(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAdd()}
                            className="bg-[#0F1720] border-white/10 text-white placeholder:text-gray-600 font-mono"
                        />
                        <p className="text-[11px] text-gray-600 mt-1.5">{t('admin.settings.academic.formatDesc')}</p>
                    </div>
                    {years.length > 0 && (
                        <Button variant="outline" onClick={suggestYear} className="border-white/10 text-gray-400 hover:text-white shrink-0">
                            {t('admin.settings.academic.suggest')}
                        </Button>
                    )}
                    <Button
                        onClick={handleAdd}
                        disabled={adding || !newYear.trim()}
                        className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold shrink-0"
                    >
                        {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        {t('admin.settings.academic.create')}
                    </Button>
                </div>
            </div>

            {/* Years list */}
            <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" />
                    {loading ? t('admin.settings.academic.loading') : t(years.length === 1 ? 'admin.settings.academic.yearsCount' : 'admin.settings.academic.yearsCountPlural').replace('{count}', years.length.toString())}
                </h4>

                {loading ? (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
                    </div>
                ) : years.length === 0 ? (
                    <div className="text-center py-10 text-gray-500 text-sm bg-[#1A2530] rounded-2xl border border-white/5">
                        {t('admin.settings.academic.noYears')}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {years.map(year => (
                            <div
                                key={year.id}
                                className={cn(
                                    "flex items-center gap-4 p-4 rounded-2xl border transition-colors",
                                    year.is_current
                                        ? "bg-emerald-500/5 border-emerald-500/30"
                                        : "bg-[#1A2530] border-white/5 hover:border-white/10"
                                )}
                            >
                                {/* Year name + badge */}
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={cn(
                                        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                                        year.is_current ? "bg-emerald-500/20" : "bg-white/5"
                                    )}>
                                        <Calendar className={cn("w-4 h-4", year.is_current ? "text-emerald-400" : "text-gray-500")} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-white font-mono">{year.name}</span>
                                            {year.is_current && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                                    {t('admin.settings.academic.current')}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            {year.start_date && new Date(year.start_date).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                                            {' — '}
                                            {year.end_date && new Date(year.end_date).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                                        </p>
                                    </div>
                                </div>

                                {/* Terms */}
                                <div className="flex gap-1.5 flex-1 flex-wrap">
                                    {year.terms.map(term => (
                                        <span
                                            key={term.id}
                                            className={cn(
                                                "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                                                term.is_current
                                                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                                    : (TERM_COLORS[term.name] || 'bg-white/5 text-gray-400 border-white/10')
                                            )}
                                        >
                                            {term.name}
                                            {term.is_current && ' ●'}
                                        </span>
                                    ))}
                                    {year.terms.length === 0 && (
                                        <span className="text-[11px] text-gray-600 italic">{t('admin.settings.academic.noTerms')}</span>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 shrink-0">
                                    {!year.is_current && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleSetCurrent(year.id)}
                                            disabled={settingId === year.id}
                                            className="border-white/10 text-gray-400 hover:text-emerald-400 hover:border-emerald-500/30 text-xs h-8"
                                        >
                                            {settingId === year.id
                                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                                : <Star className="w-3 h-3 me-1" />}
                                            {t('admin.settings.academic.setCurrent')}
                                        </Button>
                                    )}
                                    {!year.is_current && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleDelete(year.id, year.name)}
                                            disabled={deletingId === year.id}
                                            className="text-gray-600 hover:text-red-400 hover:bg-red-500/10 h-8 w-8 p-0"
                                        >
                                            {deletingId === year.id
                                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                : <Trash2 className="w-3.5 h-3.5" />}
                                        </Button>
                                    )}
                                    {year.is_current && (
                                        <div className="flex items-center gap-1 text-xs text-emerald-500">
                                            <CheckCircle2 className="w-4 h-4" /> {t('admin.settings.academic.active')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-400">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{t('admin.settings.academic.noteDesc')}</span>
            </div>
        </div>
    )
}
