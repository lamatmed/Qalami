/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLanguage } from '@/i18n'
import {
    createAcademicYear,
    setCurrentAcademicYear,
    deleteAcademicYear,
    setCurrentTerm,
    deleteTerm,
    updateTerm,
    closeTerm,
} from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import {
    Loader2, Plus, CalendarRange, CheckCircle2, Pencil, Trash2,
    RefreshCw, Lock, ChevronRight, Star, Users, FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Term {
    id: string
    academic_year_id: string | null
    name: 'T1' | 'T2' | 'T3'
    label_fr: string
    label_ar: string
    start_date: string
    end_date: string
    is_current: boolean
    conseil_date: string | null
    bulletin_date: string | null
}

interface AcademicYear {
    id: string
    name: string
    start_date: string
    end_date: string
    is_current: boolean
    terms: Term[]
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const TERM_ACCENT: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    T1: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-500' },
    T2: { bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/30',    dot: 'bg-blue-500'   },
    T3: { bg: 'bg-purple-500/10',  text: 'text-purple-400',  border: 'border-purple-500/30',  dot: 'bg-purple-500' },
}

const getTermName = (name: string, t: any): string => {
    const keys: Record<string, string> = { T1: 't1', T2: 't2', T3: 't3' }
    return t(`admin.terms.${keys[name]}`)
}

function fmt(d: string | null | undefined) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtShort(d: string | null | undefined) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

// Compute the % left/width for a term on the year timeline
function timelineSegment(yearStart: string, yearEnd: string, termStart: string, termEnd: string) {
    const ys = new Date(yearStart).getTime()
    const ye = new Date(yearEnd).getTime()
    const ts = new Date(termStart).getTime()
    const te = new Date(termEnd).getTime()
    const duration = ye - ys
    if (duration <= 0) return { left: 0, width: 33.3 }
    const left  = Math.max(0, Math.min(100, (ts - ys) / duration * 100))
    const width = Math.max(0, Math.min(100 - left, (te - ts) / duration * 100))
    return { left, width }
}

function todayPct(yearStart: string, yearEnd: string) {
    const ys = new Date(yearStart).getTime()
    const ye = new Date(yearEnd).getTime()
    const now = Date.now()
    return Math.max(0, Math.min(100, (now - ys) / (ye - ys) * 100))
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TermsPage() {
    const { t, direction } = useLanguage()
    const [years, setYears] = useState<AcademicYear[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)
    const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null)

    const [showNewYear, setShowNewYear] = useState(false)
    const [newYear, setNewYear] = useState('')
    const [creating, setCreating] = useState(false)

    const [editTerm, setEditTerm] = useState<{ term: Term; yearName: string } | null>(null)
    const [editData, setEditData] = useState({
        label_fr: '', label_ar: '', start_date: '', end_date: '',
        conseil_date: '', bulletin_date: '',
    })
    const [saving, setSaving] = useState(false)

    const [closingTerm, setClosingTerm] = useState<{ term: Term; nextTerm: Term | null } | null>(null)
    const [closeConfirming, setCloseConfirming] = useState(false)

    const [settingCurrentTerm, setSettingCurrentTerm] = useState<string | null>(null)
    const [settingCurrentYear, setSettingCurrentYear] = useState<string | null>(null)
    const [deletingTerm, setDeletingTerm] = useState<string | null>(null)
    const [deletingYear, setDeletingYear] = useState<string | null>(null)

    const fetchData = useCallback(async () => {
        setLoading(true)
        setError(false)
        setLoadErrorMessage(null)
        try {
            const res = await fetch('/api/admin/terms')
            const json = await res.json()

            if (!res.ok) throw new Error(json.error || 'Erreur serveur')

            const termsByYear = new Map<string, Term[]>()
            for (const term of json.terms || []) {
                const row = term as Term
                const yId = row.academic_year_id
                if (!yId) continue
                const list = termsByYear.get(yId) || []
                list.push(row)
                termsByYear.set(yId, list)
            }

            setYears((json.years || []).map((yr: any) => ({
                ...yr,
                terms: (termsByYear.get(yr.id) || []).sort((a: Term, b: Term) =>
                    a.name.localeCompare(b.name)),
            })))
        } catch (e: unknown) {
            const msg =
                e && typeof e === 'object' && 'message' in e
                    ? String((e as { message: unknown }).message)
                    : null
            setLoadErrorMessage(msg)
            setError(true)
            console.error('[admin/terms] fetchData', e)
        }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    // ── Actions ───────────────────────────────────────────────────────────────

    const handleCreateYear = async () => {
        if (!newYear.trim()) return
        setCreating(true)
        const result = await createAcademicYear(newYear.trim())
        if (result?.error) toast.error(result.error)
        else { toast.success(t('admin.terms.yearCreated', { name: newYear })); setNewYear(''); setShowNewYear(false); fetchData() }
        setCreating(false)
    }

    const handleSetCurrentYear = async (id: string) => {
        setSettingCurrentYear(id)
        const r = await setCurrentAcademicYear(id)
        if (r?.error) toast.error(r.error)
        else { toast.success(t('admin.terms.yearActiveUpdated')); fetchData() }
        setSettingCurrentYear(null)
    }

    const handleDeleteYear = async (id: string) => {
        setDeletingYear(id)
        const r = await deleteAcademicYear(id)
        if (r?.error) toast.error(r.error)
        else { toast.success(t('admin.terms.yearDeleted')); fetchData() }
        setDeletingYear(null)
    }

    const handleSetCurrentTerm = async (id: string) => {
        setSettingCurrentTerm(id)
        const r = await setCurrentTerm(id)
        if (r?.error) toast.error(r.error)
        else { toast.success(t('admin.terms.termCurrentUpdated')); fetchData() }
        setSettingCurrentTerm(null)
    }

    const handleDeleteTerm = async (id: string) => {
        setDeletingTerm(id)
        const r = await deleteTerm(id)
        if (r?.error) toast.error(r.error)
        else { toast.success(t('admin.terms.termDeleted')); fetchData() }
        setDeletingTerm(null)
    }

    const handleSave = async () => {
        if (!editTerm) return
        setSaving(true)
        const r = await updateTerm(editTerm.term.id, {
            label_fr:      editData.label_fr,
            label_ar:      editData.label_ar,
            start_date:    editData.start_date,
            end_date:      editData.end_date,
            conseil_date:  editData.conseil_date  || null,
            bulletin_date: editData.bulletin_date || null,
        })
        if (r?.error) toast.error(r.error)
        else { toast.success(t('admin.terms.termUpdated')); setEditTerm(null); fetchData() }
        setSaving(false)
    }

    const handleCloseTerm = async () => {
        if (!closingTerm) return
        setCloseConfirming(true)
        const r = await closeTerm(closingTerm.term.id, closingTerm.nextTerm?.id)
        if (r?.error) toast.error(r.error)
        else {
            const msg = closingTerm.nextTerm
                ? t('admin.terms.termClosedAndNext', { name: getTermName(closingTerm.term.name, t), next: getTermName(closingTerm.nextTerm.name, t) })
                : t('admin.terms.termClosed', { name: getTermName(closingTerm.term.name, t) })
            toast.success(msg)
            setClosingTerm(null)
            fetchData()
        }
        setCloseConfirming(false)
    }

    // ── Current year/term for the top banner ──────────────────────────────────

    const currentYear = years.find(y => y.is_current)
    const currentTerm = currentYear?.terms.find(t => t.is_current)

    // ──────────────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            <div className="flex justify-end">
                <Button
                    size="sm"
                    onClick={() => setShowNewYear(true)}
                    className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold"
                >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />{t('admin.terms.newYear')}
                </Button>
            </div>

            {/* ── Content ──────────────────────────────────────────────────── */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                </div>
            ) : error ? (
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <p className="text-gray-400">{t('admin.terms.loadingError')}</p>
                    {loadErrorMessage && (
                        <p className="text-xs text-red-400/90 max-w-lg text-center break-words px-2">
                            {loadErrorMessage}
                        </p>
                    )}
                    {loadErrorMessage?.includes('academic_year') && loadErrorMessage?.includes('terms') && (
                        <p className="text-xs text-gray-500 max-w-lg text-center px-4">
                            La base attend encore une colonne texte <code className="text-gray-400">academic_year</code>
                            {' '}sur <code className="text-gray-400">terms</code>, alors que le schéma moderne utilise surtout{' '}
                            <code className="text-gray-400">academic_year_id</code>. Exécutez{' '}
                            <strong>une fois</strong> dans le SQL Editor Supabase le fichier{' '}
                            <code className="text-gray-400">supabase/migrations/20260515120000_terms_academic_year_text_column.sql</code>
                            {' '}(il ajoute <code className="text-gray-400">academic_year</code> et remplit depuis les années), puis rechargez la page.
                        </p>
                    )}
                    <Button variant="outline" onClick={fetchData} className="gap-2">
                        <RefreshCw className="w-4 h-4" /> {t('admin.terms.retry')}
                    </Button>
                </div>
            ) : years.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 border-2 border-dashed border-white/10 rounded-3xl">
                    <CalendarRange className="w-12 h-12 text-gray-600" />
                    <div className="text-center">
                        <p className="font-bold text-white">{t('admin.terms.noYears')}</p>
                        <p className="text-sm text-gray-500 mt-1">{t('admin.terms.noYearsDesc')}</p>
                    </div>
                    <Button onClick={() => setShowNewYear(true)} className="gap-2 bg-emerald-500 hover:bg-emerald-600 text-black font-bold">
                        <Plus className="w-4 h-4" /> {t('admin.terms.createYear')}
                    </Button>
                </div>
            ) : (
                <div className="space-y-10">
                    {years.map(year => {
                        const TERM_ORDER = ['T1', 'T2', 'T3'] as const
                        const nextTerm = (t: Term): Term | null => {
                            const idx = TERM_ORDER.indexOf(t.name)
                            const next = TERM_ORDER[idx + 1]
                            return year.terms.find(x => x.name === next) ?? null
                        }
                        const todayPos = (year.start_date && year.end_date)
                            ? todayPct(year.start_date, year.end_date)
                            : null
                        const isInRange = todayPos !== null && todayPos >= 0 && todayPos <= 100

                        return (
                            <div key={year.id} className={cn(
                                "bg-[#1A2530] rounded-3xl border overflow-hidden",
                                year.is_current ? "border-emerald-500/30" : "border-white/5"
                            )}>
                                {/* ── Year header ─────────────────────────── */}
                                <div className={cn(
                                    "px-6 py-4 flex items-center justify-between",
                                    year.is_current ? "border-b border-emerald-500/20" : "border-b border-white/5"
                                )}>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl font-black text-white tracking-tight">{year.name}</span>
                                        {year.is_current && (
                                            <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full uppercase tracking-wide">
                                                <Star className="w-2.5 h-2.5" />
                                                {t('admin.terms.current')}
                                            </span>
                                        )}
                                        {year.start_date && year.end_date && (
                                            <span className="text-xs text-gray-500">
                                                {fmt(year.start_date)} → {fmt(year.end_date)}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {!year.is_current && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-xs h-8 border-white/10 text-gray-400 hover:text-white"
                                                onClick={() => handleSetCurrentYear(year.id)}
                                                disabled={settingCurrentYear === year.id}
                                            >
                                                {settingCurrentYear === year.id
                                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                                    : t('admin.terms.setActive')
                                                }
                                            </Button>
                                        )}
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon"
                                                    className="h-8 w-8 text-gray-600 hover:text-red-400 hover:bg-red-500/10"
                                                    disabled={deletingYear === year.id}
                                                >
                                                    {deletingYear === year.id
                                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        : <Trash2 className="w-3.5 h-3.5" />
                                                    }
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="bg-[#1A2530] border-white/10 text-white">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>{t('admin.terms.deleteYear', { name: year.name })}</AlertDialogTitle>
                                                    <AlertDialogDescription className="text-gray-400">
                                                        {t('admin.terms.deleteYearDesc', { name: year.name, count: year.terms.length })}
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10">{t('common.cancel')}</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={() => handleDeleteYear(year.id)}
                                                        className="bg-red-600 hover:bg-red-700"
                                                    >
                                                        {t('common.delete')}
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>

                                {/* ── Timeline ────────────────────────────── */}
                                {year.start_date && year.end_date && year.terms.length > 0 && (
                                    <div className="px-6 py-4 border-b border-white/5">
                                        {/* Bar */}
                                        <div className="relative h-6 bg-[#0F1720] rounded-full overflow-hidden">
                                            {year.terms.map(term => {
                                                const { left, width } = timelineSegment(
                                                    year.start_date, year.end_date,
                                                    term.start_date, term.end_date
                                                )
                                                const a = TERM_ACCENT[term.name]
                                                return (
                                                    <div
                                                        key={term.id}
                                                        className={cn(
                                                            "absolute top-0 h-full flex items-center justify-center text-[10px] font-bold transition-all",
                                                            term.is_current
                                                                ? a.dot + " text-white"
                                                                : a.bg + " " + a.text
                                                        )}
                                                        style={{ left: `${left}%`, width: `${width}%` }}
                                                    >
                                                        {width > 8 && term.name}
                                                    </div>
                                                )
                                            })}

                                            {/* Today marker */}
                                            {isInRange && (
                                                <div
                                                    className="absolute top-0 h-full w-0.5 bg-emerald-400 z-10"
                                                    style={{ left: `${todayPos}%` }}
                                                >
                                                    <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 text-[9px] text-emerald-300 font-black whitespace-nowrap bg-[#0F1720] px-1 rounded-sm tracking-wide">
                                                        {t('admin.terms.today')}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Date labels below */}
                                        <div className="relative mt-1 h-4">
                                            {year.terms.map(term => {
                                                const { left } = timelineSegment(
                                                    year.start_date, year.end_date,
                                                    term.start_date, term.end_date
                                                )
                                                return (
                                                    <span
                                                        key={term.id}
                                                        className="absolute text-[9px] text-gray-600 -translate-x-0"
                                                        style={{ left: `${left}%` }}
                                                    >
                                                        {fmtShort(term.start_date)}
                                                    </span>
                                                )
                                            })}
                                            {/* Last end date */}
                                            <span className="absolute text-[9px] text-gray-600 right-0">
                                                {fmtShort(year.end_date)}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* ── Term cards ──────────────────────────── */}
                                <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {TERM_ORDER.map(termName => {
                                        const term = year.terms.find(t => t.name === termName)
                                        if (!term) {
                                            return (
                                                <div
                                                    key={termName}
                                                    className="border border-dashed border-white/5 rounded-2xl p-4 flex items-center justify-center text-gray-700 text-xs"
                                                >
                                                    {getTermName(termName, t)} — {t('admin.terms.notConfigured')}
                                                </div>
                                            )
                                        }

                                        const a = TERM_ACCENT[term.name]

                                        // Progress: days elapsed / total days in term
                                        const tStart = new Date(term.start_date).getTime()
                                        const tEnd   = new Date(term.end_date).getTime()
                                        const now    = Date.now()
                                        const progress = tEnd > tStart
                                            ? Math.max(0, Math.min(100, (now - tStart) / (tEnd - tStart) * 100))
                                            : 0
                                        const isPast = now > tEnd
                                        const isFuture = now < tStart

                                        return (
                                            <div
                                                key={term.id}
                                                className={cn(
                                                    "bg-[#0F1720] rounded-2xl border p-4 flex flex-col gap-3 transition-all",
                                                    term.is_current
                                                        ? "border-emerald-500/40 ring-1 ring-emerald-500/20"
                                                        : "border-white/5"
                                                )}
                                            >
                                                {/* Top row */}
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className={cn(
                                                            "text-[10px] font-black px-2 py-0.5 rounded-md border uppercase tracking-wide",
                                                            a.bg, a.text, a.border
                                                        )}>
                                                            {term.name}
                                                        </span>
                                                        {term.is_current && (
                                                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md uppercase tracking-wide">
                                                                <CheckCircle2 className="w-2.5 h-2.5" />
                                                                {t('admin.terms.current')}
                                                            </span>
                                                        )}
                                                        {isPast && !term.is_current && (
                                                            <span className="text-[10px] text-gray-600 font-medium">{t('admin.terms.finished')}</span>
                                                        )}
                                                        {isFuture && (
                                                            <span className="text-[10px] text-gray-600 font-medium">{t('admin.terms.upcoming')}</span>
                                                        )}
                                                    </div>

                                                    {/* Edit button */}
                                                    <button
                                                        className="text-gray-600 hover:text-gray-300 transition-colors p-1"
                                                        onClick={() => {
                                                            setEditTerm({ term, yearName: year.name })
                                                            setEditData({
                                                                label_fr:      term.label_fr,
                                                                label_ar:      term.label_ar,
                                                                start_date:    term.start_date,
                                                                end_date:      term.end_date,
                                                                conseil_date:  term.conseil_date  ?? '',
                                                                bulletin_date: term.bulletin_date ?? '',
                                                            })
                                                        }}
                                                        title={t('admin.terms.edit')}
                                                    >
                                                        <Pencil className="w-3 h-3" />
                                                    </button>
                                                </div>

                                                {/* Label */}
                                                <p className="text-sm font-semibold text-white">{term.label_fr}</p>

                                                {/* Dates */}
                                                <div className="space-y-1">
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-gray-600">{t('admin.terms.start')}</span>
                                                        <span className="text-gray-300 font-medium">{fmt(term.start_date)}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-gray-600">{t('admin.terms.end')}</span>
                                                        <span className="text-gray-300 font-medium">{fmt(term.end_date)}</span>
                                                    </div>
                                                </div>

                                                {/* Dates importantes */}
                                                {(term.conseil_date || term.bulletin_date) && (
                                                    <div className="space-y-1 border-t border-white/5 pt-2">
                                                        {term.conseil_date && (
                                                            <div className="flex items-center justify-between text-xs">
                                                                <span className="flex items-center gap-1.5 text-gray-500">
                                                                    <Users className="w-3 h-3 text-blue-400/70" />
                                                                    {t('admin.terms.classCouncil')}
                                                                </span>
                                                                <span className="text-blue-300 font-medium">{fmt(term.conseil_date)}</span>
                                                            </div>
                                                        )}
                                                        {term.bulletin_date && (
                                                            <div className="flex items-center justify-between text-xs">
                                                                <span className="flex items-center gap-1.5 text-gray-500">
                                                                    <FileText className="w-3 h-3 text-amber-400/70" />
                                                                    {t('admin.terms.bulletinRelease')}
                                                                </span>
                                                                <span className="text-amber-300 font-medium">{fmt(term.bulletin_date)}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Progress bar */}
                                                {!isFuture && (
                                                    <div className="space-y-1">
                                                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                                            <div
                                                                className={cn("h-full rounded-full transition-all", a.dot)}
                                                                style={{ width: `${progress}%` }}
                                                            />
                                                        </div>
                                                        <p className="text-[9px] text-gray-600 text-right">
                                                            {isPast ? t('admin.terms.finished') : t('admin.terms.elapsed', { percent: Math.round(progress) })}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Actions */}
                                                <div className="flex items-center gap-1.5 pt-1 border-t border-white/5">
                                                    {/* Close term — only on current term */}
                                                    {term.is_current && (
                                                        <Button
                                                            size="sm"
                                                            className="flex-1 h-8 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 gap-1.5"
                                                            onClick={() => setClosingTerm({ term, nextTerm: nextTerm(term) })}
                                                        >
                                                            <Lock className="w-3 h-3" />
                                                            {t('admin.terms.close')}
                                                        </Button>
                                                    )}

                                                    {/* Set current — on non-current terms */}
                                                    {!term.is_current && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="flex-1 h-8 text-xs border-white/10 text-gray-500 hover:text-white hover:border-white/20"
                                                            onClick={() => handleSetCurrentTerm(term.id)}
                                                            disabled={settingCurrentTerm === term.id}
                                                        >
                                                            {settingCurrentTerm === term.id
                                                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                                                : t('admin.terms.setActual')
                                                            }
                                                        </Button>
                                                    )}

                                                    {/* Delete */}
                                                    {!term.is_current && (
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-gray-700 hover:text-red-400 hover:bg-red-500/10"
                                                                    disabled={deletingTerm === term.id}
                                                                >
                                                                    {deletingTerm === term.id
                                                                        ? <Loader2 className="w-3 h-3 animate-spin" />
                                                                        : <Trash2 className="w-3 h-3" />
                                                                    }
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent className="bg-[#1A2530] border-white/10 text-white">
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>{t('admin.terms.deleteTerm')}</AlertDialogTitle>
                                                                    <AlertDialogDescription className="text-gray-400">
                                                                        {t('admin.terms.deleteTermDesc', { name: term.label_fr })}
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10">{t('common.cancel')}</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => handleDeleteTerm(term.id)} className="bg-red-600 hover:bg-red-700">
                                                                        {t('common.delete')}
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* ── New year dialog ───────────────────────────────────────────── */}
            <Dialog open={showNewYear} onOpenChange={setShowNewYear}>
                <DialogContent className="sm:max-w-[400px] bg-[#1A2530] border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle className="text-white">{t('admin.terms.newYearDialogTitle')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <p className="text-sm text-gray-400">
                            {t('admin.terms.newYearDialogDesc')}
                        </p>
                        <div className="space-y-1.5">
                            <Label htmlFor="academic-year" className="text-gray-300">{t('admin.terms.academicYear')}</Label>
                            <Input
                                id="academic-year"
                                placeholder="2025-2026"
                                value={newYear}
                                onChange={e => setNewYear(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCreateYear()}
                                className="bg-[#0F1720] border-white/10 text-white placeholder:text-gray-600"
                            />
                            <p className="text-[11px] text-gray-500">{t('admin.terms.formatYear')}</p>
                        </div>
                        <div className="bg-[#0F1720] rounded-xl p-4 space-y-2 text-xs text-gray-500 border border-white/5">
                            <p className="font-bold text-gray-300 text-sm">{t('admin.terms.defaultDates')}</p>
                            <div className="grid grid-cols-3 gap-2 mt-2">
                                <div><span className="font-bold text-emerald-400">T1</span><p>Oct → Déc</p></div>
                                <div><span className="font-bold text-blue-400">T2</span><p>Jan → Mar</p></div>
                                <div><span className="font-bold text-purple-400">T3</span><p>Avr → Juin</p></div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowNewYear(false)} disabled={creating}
                            className="border-white/10 text-gray-400 hover:text-white">
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleCreateYear} disabled={creating || !newYear.trim()}
                            className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold">
                            {creating && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                            {t('admin.terms.createYear')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Edit term dialog ──────────────────────────────────────────── */}
            {editTerm && (
                <Dialog open={!!editTerm} onOpenChange={open => !open && setEditTerm(null)}>
                    <DialogContent className="sm:max-w-[460px] bg-[#1A2530] border-white/10 text-white">
                        <DialogHeader>
                            <DialogTitle className="text-white">
                                {t('admin.terms.editTermTitle', { name: editTerm.term.label_fr, year: editTerm.yearName })}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-gray-300">{t('admin.terms.labelFr')}</Label>
                                    <Input
                                        value={editData.label_fr}
                                        onChange={e => setEditData(p => ({ ...p, label_fr: e.target.value }))}
                                        className="bg-[#0F1720] border-white/10 text-white"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-gray-300">{t('admin.terms.labelAr')}</Label>
                                    <Input
                                        dir="rtl"
                                        value={editData.label_ar}
                                        onChange={e => setEditData(p => ({ ...p, label_ar: e.target.value }))}
                                        className="bg-[#0F1720] border-white/10 text-white"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-gray-300">{t('admin.terms.startDate')}</Label>
                                    <Input
                                        type="date"
                                        value={editData.start_date}
                                        onChange={e => setEditData(p => ({ ...p, start_date: e.target.value }))}
                                        className="bg-[#0F1720] border-white/10 text-white"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-gray-300">{t('admin.terms.endDate')}</Label>
                                    <Input
                                        type="date"
                                        value={editData.end_date}
                                        min={editData.start_date}
                                        onChange={e => setEditData(p => ({ ...p, end_date: e.target.value }))}
                                        className="bg-[#0F1720] border-white/10 text-white"
                                    />
                                </div>
                            </div>

                            {/* Dates importantes */}
                            <div className="bg-[#0F1720] rounded-xl p-3 border border-white/5 space-y-3">
                                <p className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                                    <Star className="w-3 h-3 text-amber-400" />
                                    {t('admin.terms.importantDates')}
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-gray-400 text-xs flex items-center gap-1.5">
                                            <Users className="w-3 h-3 text-blue-400" />
                                            {t('admin.terms.classCouncil')}
                                        </Label>
                                        <Input
                                            type="date"
                                            value={editData.conseil_date}
                                            onChange={e => setEditData(p => ({ ...p, conseil_date: e.target.value }))}
                                            className="bg-[#161B22] border-white/10 text-white text-xs h-8"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-gray-400 text-xs flex items-center gap-1.5">
                                            <FileText className="w-3 h-3 text-amber-400" />
                                            {t('admin.terms.bulletinRelease')}
                                        </Label>
                                        <Input
                                            type="date"
                                            value={editData.bulletin_date}
                                            onChange={e => setEditData(p => ({ ...p, bulletin_date: e.target.value }))}
                                            className="bg-[#161B22] border-white/10 text-white text-xs h-8"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setEditTerm(null)} disabled={saving}
                                className="border-white/10 text-gray-400 hover:text-white">
                                {t('common.cancel')}
                            </Button>
                            <Button onClick={handleSave} disabled={saving}
                                className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold">
                                {saving && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                                {t('common.save')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {/* ── Close term confirmation dialog ────────────────────────────── */}
            {closingTerm && (
                <AlertDialog open={!!closingTerm} onOpenChange={open => !open && setClosingTerm(null)}>
                    <AlertDialogContent className="bg-[#1A2530] border-white/10 text-white">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="text-white flex items-center gap-2">
                                <Lock className="w-4 h-4 text-amber-400" />
                                {t('admin.terms.closeTermTitle', { name: getTermName(closingTerm.term.name, t) })}
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-gray-400 space-y-2">
                                <span className="block">
                                    {t('admin.terms.closeTermDesc', { name: closingTerm.term.label_fr })}
                                </span>
                                {closingTerm.nextTerm ? (
                                    <span className="bg-[#0F1720] rounded-xl p-3 border border-white/5 flex items-center gap-2 text-sm">
                                        <ChevronRight className="w-4 h-4 text-emerald-400 shrink-0" />
                                        <span>
                                            {t('admin.terms.nextTermActive', { name: getTermName(closingTerm.nextTerm.name, t) })}
                                        </span>
                                    </span>
                                ) : (
                                    <span className="block bg-amber-500/10 rounded-xl p-3 border border-amber-500/20 text-sm text-amber-400">
                                        {t('admin.terms.noNextTermWarning')}
                                    </span>
                                )}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel
                                onClick={() => setClosingTerm(null)}
                                className="bg-white/5 border-white/10 text-white hover:bg-white/10"
                            >
                                Annuler
                            </AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleCloseTerm}
                                disabled={closeConfirming}
                                className="bg-amber-500 hover:bg-amber-600 text-black font-bold"
                            >
                                {closeConfirming && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                                Clôturer
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
    )
}
