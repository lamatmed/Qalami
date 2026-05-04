'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
    calculateReportCards,
    publishReportCards,
    validateReportCards,
    getReportCardExtras,
    getAttendanceStatsForTerm,
    saveReportCardDetails,
    saveAttendanceDays,
    type StudentReport,
    type ReportCardExtra,
} from '@/app/admin/reports/actions'
import { Button } from '@/components/ui/button'
import {
    Loader2,
    Calculator,
    Send,
    Printer,
    ChevronDown,
    AlertTriangle,
    GraduationCap,
    CheckCircle2,
    BookOpen,
    Save,
    ShieldCheck,
    Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getMySchoolContext } from '@/app/admin/actions'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AcademicYear { id: string; name: string; is_current: boolean }
interface Term { id: string; name: string; is_current: boolean; academic_year_id: string }
interface Class { id: string; name: string }

type ReportStatus = 'draft' | 'validated' | 'published'

const TERM_LABELS: Record<string, string> = {
    T1: '1er Trimestre',
    T2: '2ème Trimestre',
    T3: '3ème Trimestre',
}

const CONDUCT_OPTIONS = [
    { value: 'TB', label: 'Très Bien' },
    { value: 'B',  label: 'Bien' },
    { value: 'AB', label: 'Assez Bien' },
    { value: 'P',  label: 'Passable' },
]

// ─── Average badge ─────────────────────────────────────────────────────────────

function AvgBadge({ value }: { value: number | null }) {
    if (value === null) return <span className="text-gray-600 font-mono text-xs">—</span>
    const color = value >= 14 ? 'text-emerald-400' : value >= 10 ? 'text-amber-400' : 'text-red-400'
    return <span className={cn('font-mono font-bold text-sm', color)}>{value.toFixed(2)}</span>
}

// ─── Selector dropdown ─────────────────────────────────────────────────────────

function Selector<T extends { id: string; name: string }>({
    label, value, options, onChange, placeholder, disabled,
}: {
    label: string
    value: string
    options: T[]
    onChange: (id: string) => void
    placeholder: string
    disabled?: boolean
}) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
    const selected = options.find(o => o.id === value)

    useEffect(() => {
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    return (
        <div ref={ref} className="relative">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">{label}</p>
            <button
                disabled={disabled}
                onClick={() => setOpen(o => !o)}
                className={cn(
                    'flex items-center justify-between gap-3 w-full px-3 py-2.5 rounded-xl border text-sm transition-colors',
                    'bg-[#1A2530] border-white/10 text-white hover:border-white/20',
                    disabled && 'opacity-40 cursor-not-allowed'
                )}
            >
                <span className={selected ? 'text-white' : 'text-gray-500'}>
                    {selected ? selected.name : placeholder}
                </span>
                <ChevronDown className={cn('w-4 h-4 text-gray-500 transition-transform', open && 'rotate-180')} />
            </button>

            {open && options.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-[#1A2530] border border-white/10 rounded-xl shadow-xl overflow-hidden">
                    {options.map(opt => (
                        <button
                            key={opt.id}
                            onClick={() => { onChange(opt.id); setOpen(false) }}
                            className={cn(
                                'w-full text-left px-3 py-2.5 text-sm transition-colors',
                                value === opt.id
                                    ? 'bg-emerald-500/15 text-emerald-400 font-semibold'
                                    : 'text-gray-300 hover:bg-white/5'
                            )}
                        >
                            {opt.name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── Status stepper ────────────────────────────────────────────────────────────

function StatusStepper({ status }: { status: ReportStatus }) {
    const steps: { key: ReportStatus; label: string; icon: React.ElementType }[] = [
        { key: 'draft',     label: 'Brouillon', icon: Clock },
        { key: 'validated', label: 'Validé',    icon: ShieldCheck },
        { key: 'published', label: 'Publié',    icon: Send },
    ]
    const currentIdx = steps.findIndex(s => s.key === status)

    return (
        <div className="flex items-center gap-1">
            {steps.map((step, i) => {
                const done = i < currentIdx
                const active = i === currentIdx
                const Icon = step.icon
                return (
                    <div key={step.key} className="flex items-center">
                        <div className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all',
                            done   ? 'bg-emerald-500/15 text-emerald-400' :
                            active ? 'bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/30' :
                                     'bg-white/5 text-gray-600'
                        )}>
                            <Icon className="w-3 h-3" />
                            {step.label}
                        </div>
                        {i < steps.length - 1 && (
                            <div className={cn('w-4 h-px mx-1', done ? 'bg-emerald-500/40' : 'bg-white/10')} />
                        )}
                    </div>
                )
            })}
        </div>
    )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function ReportCards() {
    const [years, setYears] = useState<AcademicYear[]>([])
    const [terms, setTerms] = useState<Term[]>([])
    const [classes, setClasses] = useState<Class[]>([])
    const [schoolName, setSchoolName] = useState<string>('')

    const [selectedYear, setSelectedYear] = useState('')
    const [selectedTerm, setSelectedTerm] = useState('')
    const [selectedClass, setSelectedClass] = useState('')

    const [reports, setReports] = useState<StudentReport[]>([])
    const [extras, setExtras] = useState<Map<string, ReportCardExtra>>(new Map())
    const [attendanceStats, setAttendanceStats] = useState<
        Record<string, { present: number; absent: number; late: number; total: number }>
    >({})

    // Per-student editable state
    const [conductGrades, setConductGrades] = useState<Map<string, string>>(new Map())
    const [generalComments, setGeneralComments] = useState<Map<string, string>>(new Map())

    // Workflow status
    const [reportStatus, setReportStatus] = useState<ReportStatus>('draft')

    const [calculating, setCalculating] = useState(false)
    const [loading, setLoading] = useState(true)
    const [isPending, startTransition] = useTransition()
    const [savingDetails, setSavingDetails] = useState(false)
    const [validating, setValidating] = useState(false)
    const [publishing, setPublishing] = useState(false)
    const [printing, setPrinting] = useState(false)

    // Load selectors
    useEffect(() => {
        async function load() {
            const ctx = await getMySchoolContext()
            if (!ctx) { setLoading(false); return }
            const profile = { school_id: ctx.school_id }
            const supabase = createClient()

            const [{ data: yearsData }, { data: termsData }, { data: classesData }, { data: schoolData }] =
                await Promise.all([
                    supabase.from('academic_years')
                        .select('id, name, is_current')
                        .eq('school_id', profile.school_id)
                        .order('name', { ascending: false }),
                    supabase.from('terms')
                        .select('id, name, is_current, academic_year_id')
                        .eq('school_id', profile.school_id)
                        .order('name'),
                    supabase.from('classes')
                        .select('id, name')
                        .eq('school_id', profile.school_id)
                        .order('name'),
                    supabase.from('schools')
                        .select('name')
                        .eq('id', profile.school_id)
                        .single(),
                ])

            setYears(yearsData || [])
            setTerms(termsData || [])
            setClasses(classesData || [])
            setSchoolName((schoolData as any)?.name ?? '')

            const currentYear = (yearsData || []).find(y => y.is_current)
            if (currentYear) setSelectedYear(currentYear.id)
            const currentTerm = (termsData || []).find(t => t.is_current)
            if (currentTerm) setSelectedTerm(currentTerm.id)

            setLoading(false)
        }
        load()
    }, [])

    const filteredTerms = terms.filter(t => t.academic_year_id === selectedYear)
    const selectedTermName = terms.find(t => t.id === selectedTerm)?.name ?? ''
    const selectedClassName = classes.find(c => c.id === selectedClass)?.name ?? ''

    const canCalculate = !!(selectedTerm && selectedClass)

    // Reset state when selectors change
    function resetReports() {
        setReports([])
        setExtras(new Map())
        setAttendanceStats({})
        setConductGrades(new Map())
        setGeneralComments(new Map())
        setReportStatus('draft')
    }

    const handleCalculate = async () => {
        if (!canCalculate) return
        setCalculating(true)
        resetReports()

        const result = await calculateReportCards(selectedClass, selectedTerm)
        if (result.error) {
            toast.error(result.error)
            setCalculating(false)
            return
        }

        if (result.reports) {
            setReports(result.reports)

            // Load extras (conduct grades, comments, attendance, status)
            const [extrasData, attStats] = await Promise.all([
                getReportCardExtras(selectedClass, selectedTerm),
                getAttendanceStatsForTerm(selectedClass, selectedTerm),
            ])

            const extrasMap = new Map<string, ReportCardExtra>()
            const conductMap = new Map<string, string>()
            const commentMap = new Map<string, string>()
            let overallStatus: ReportStatus = 'draft'

            extrasData.forEach(e => {
                extrasMap.set(e.studentId, e)
                if (e.conductGrade) conductMap.set(e.studentId, e.conductGrade)
                if (e.generalComment) commentMap.set(e.studentId, e.generalComment)
                // Use most advanced status found
                if (e.status === 'published') overallStatus = 'published'
                else if (e.status === 'validated' && overallStatus === 'draft') overallStatus = 'validated'
            })

            setExtras(extrasMap)
            setConductGrades(conductMap)
            setGeneralComments(commentMap)
            setAttendanceStats(attStats)
            setReportStatus(overallStatus)

            // Auto-save attendance stats
            if (Object.keys(attStats).length > 0) {
                saveAttendanceDays(selectedClass, selectedTerm, attStats).catch(() => {})
            }

            toast.success(`Moyennes calculées — ${result.reports.length} élève${result.reports.length !== 1 ? 's' : ''}`)
        }
        setCalculating(false)
    }

    const handleSaveDetails = async () => {
        if (reports.length === 0) return
        setSavingDetails(true)

        const details = reports.map(r => ({
            studentId: r.studentId,
            conductGrade: conductGrades.get(r.studentId) ?? '',
            generalComment: generalComments.get(r.studentId) ?? '',
        }))

        const result = await saveReportCardDetails(selectedClass, selectedTerm, details)
        if (result.error) toast.error(result.error)
        else toast.success('Appréciations enregistrées')

        setSavingDetails(false)
    }

    const handleValidate = async () => {
        if (reports.length === 0 || reportStatus !== 'draft') return
        setValidating(true)

        // Save details first
        const details = reports.map(r => ({
            studentId: r.studentId,
            conductGrade: conductGrades.get(r.studentId) ?? '',
            generalComment: generalComments.get(r.studentId) ?? '',
        }))
        await saveReportCardDetails(selectedClass, selectedTerm, details)

        const result = await validateReportCards(selectedClass, selectedTerm)
        if (result.error) toast.error(result.error)
        else {
            setReportStatus('validated')
            toast.success('Bulletins validés', { description: 'Prêts à être publiés' })
        }
        setValidating(false)
    }

    const handlePublish = async () => {
        if (reports.length === 0 || reportStatus !== 'validated') return
        setPublishing(true)

        const result = await publishReportCards(selectedClass, selectedTerm)
        if (result.error) toast.error(result.error)
        else {
            setReportStatus('published')
            toast.success('Bulletins publiés', { description: 'Visibles par les parents et élèves' })
        }
        setPublishing(false)
    }

    const handlePrint = () => {
        if (reports.length === 0) return
        setPrinting(true)
        setTimeout(() => {
            window.print()
            setPrinting(false)
        }, 300)
    }

    // Collect all unique subjects
    const allSubjects = (() => {
        const map = new Map<string, { name: string; coefficient: number }>()
        reports.forEach(r => {
            r.subjects.forEach(s => {
                if (!map.has(s.subjectId)) map.set(s.subjectId, { name: s.subjectName, coefficient: s.coefficient })
            })
        })
        return Array.from(map.entries()).map(([id, s]) => ({ id, ...s }))
    })()

    const classAvg = (() => {
        const valid = reports.filter(r => r.generalAverage !== null)
        if (valid.length === 0) return null
        return valid.reduce((s, r) => s + (r.generalAverage ?? 0), 0) / valid.length
    })()

    const termLabel = TERM_LABELS[selectedTermName] ?? selectedTermName

    if (loading) {
        return (
            <div className="flex items-center justify-center py-32">
                <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
            </div>
        )
    }

    return (
        <>
            {/* ── Print styles (injected via style tag) ─────────────────────── */}
            <style>{`
                @media print {
                    body * { visibility: hidden !important; }
                    .print-area, .print-area * { visibility: visible !important; }
                    .print-area { position: fixed; inset: 0; background: white; padding: 0; }
                    .no-print { display: none !important; }

                    .bulletin-card {
                        page-break-after: always;
                        padding: 24px 32px;
                        font-family: 'Segoe UI', system-ui, sans-serif;
                        color: #1a1a1a;
                        background: white;
                    }
                    .bulletin-card:last-child { page-break-after: auto; }

                    .bulletin-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        border-bottom: 2px solid #e5e7eb;
                        padding-bottom: 14px;
                        margin-bottom: 16px;
                    }
                    .bulletin-school { font-size: 13px; font-weight: 700; color: #111; }
                    .bulletin-title { font-size: 18px; font-weight: 900; color: #059669; text-align: right; }
                    .bulletin-meta { font-size: 11px; color: #6b7280; text-align: right; margin-top: 2px; }

                    .bulletin-student-name {
                        font-size: 16px; font-weight: 800; color: #111;
                        margin-bottom: 4px;
                    }
                    .bulletin-rank {
                        font-size: 11px; color: #6b7280;
                        margin-bottom: 16px;
                    }

                    .bulletin-table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 11px;
                        margin-bottom: 16px;
                    }
                    .bulletin-table th {
                        background: #f9fafb;
                        padding: 6px 10px;
                        text-align: left;
                        font-weight: 700;
                        color: #374151;
                        border: 1px solid #e5e7eb;
                        font-size: 10px;
                        text-transform: uppercase;
                        letter-spacing: 0.04em;
                    }
                    .bulletin-table td {
                        padding: 6px 10px;
                        border: 1px solid #e5e7eb;
                        color: #1f2937;
                    }
                    .bulletin-table .avg-good { color: #059669; font-weight: 700; }
                    .bulletin-table .avg-ok   { color: #d97706; font-weight: 700; }
                    .bulletin-table .avg-fail { color: #dc2626; font-weight: 700; }

                    .bulletin-footer {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 16px;
                        margin-top: 12px;
                        border-top: 1px solid #e5e7eb;
                        padding-top: 12px;
                    }
                    .bulletin-field-label { font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
                    .bulletin-field-value { font-size: 12px; color: #111; }
                    .bulletin-general-avg { font-size: 22px; font-weight: 900; }
                }
            `}</style>

            <div className="space-y-8 animate-in fade-in duration-300">

                {/* ── Header actions ──────────────────────────────────────── */}
                {reports.length > 0 && (
                    <div className="no-print flex flex-wrap gap-2 items-center justify-end">
                        <StatusStepper status={reportStatus} />
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handlePrint}
                            disabled={printing}
                            className="border-white/10 text-gray-400 hover:text-white bg-transparent"
                        >
                            {printing ? <Loader2 className="w-3.5 h-3.5 me-1.5 animate-spin" /> : <Printer className="w-3.5 h-3.5 me-1.5" />}
                            Imprimer
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleSaveDetails}
                            disabled={savingDetails || reportStatus === 'published'}
                            className="border-white/10 text-gray-400 hover:text-white bg-transparent"
                        >
                            {savingDetails ? <Loader2 className="w-3.5 h-3.5 me-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 me-1.5" />}
                            Enregistrer
                        </Button>
                        {reportStatus === 'draft' && (
                            <Button size="sm" onClick={handleValidate} disabled={validating} className="bg-indigo-500 hover:bg-indigo-400 text-white font-semibold">
                                {validating ? <Loader2 className="w-3.5 h-3.5 me-1.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 me-1.5" />}
                                Valider
                            </Button>
                        )}
                        {reportStatus === 'validated' && (
                            <Button size="sm" onClick={handlePublish} disabled={publishing} className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold">
                                {publishing ? <Loader2 className="w-3.5 h-3.5 me-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 me-1.5" />}
                                Publier
                            </Button>
                        )}
                        {reportStatus === 'published' && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" />Publiés
                            </div>
                        )}
                    </div>
                )}

                {/* ── Selectors ──────────────────────────────────────────────── */}
                <div className="bg-[#0F1720] border border-white/5 rounded-2xl p-5 no-print">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Selector
                            label="Année scolaire"
                            value={selectedYear}
                            options={years}
                            onChange={id => { setSelectedYear(id); setSelectedTerm(''); resetReports() }}
                            placeholder="Sélectionner une année…"
                        />
                        <Selector
                            label="Trimestre"
                            value={selectedTerm}
                            options={filteredTerms.map(t => ({ id: t.id, name: TERM_LABELS[t.name] ?? t.name }))}
                            onChange={id => { setSelectedTerm(id); resetReports() }}
                            placeholder="Sélectionner un trimestre…"
                            disabled={!selectedYear}
                        />
                        <Selector
                            label="Classe"
                            value={selectedClass}
                            options={classes}
                            onChange={id => { setSelectedClass(id); resetReports() }}
                            placeholder="Sélectionner une classe…"
                        />
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                        <Button
                            onClick={handleCalculate}
                            disabled={!canCalculate || calculating}
                            className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold"
                        >
                            {calculating
                                ? <Loader2 className="w-4 h-4 me-2 animate-spin" />
                                : <Calculator className="w-4 h-4 me-2" />}
                            Calculer les moyennes
                        </Button>

                        {!canCalculate && (
                            <p className="text-xs text-gray-600">
                                Sélectionnez un trimestre et une classe pour commencer.
                            </p>
                        )}
                    </div>
                </div>

                {/* ── Context pills ───────────────────────────────────────────── */}
                {reports.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 no-print">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold">
                            <BookOpen className="w-3.5 h-3.5" />
                            {selectedClassName}
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-bold">
                            {termLabel}
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-gray-400 text-xs font-bold">
                            <GraduationCap className="w-3.5 h-3.5" />
                            {reports.length} élève{reports.length !== 1 ? 's' : ''}
                        </div>
                        {classAvg !== null && (
                            <div className={cn(
                                'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border',
                                classAvg >= 14 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                                classAvg >= 10 ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                                                 'bg-red-500/10 border-red-500/20 text-red-400'
                            )}>
                                Moy. classe : {classAvg.toFixed(2)}/20
                            </div>
                        )}
                    </div>
                )}

                {/* ── Results table ───────────────────────────────────────────── */}
                {reports.length > 0 && (
                    <div className="bg-[#0F1720] border border-white/5 rounded-2xl overflow-hidden no-print">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/5 bg-[#0A0F15]">
                                        <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider sticky left-0 bg-[#0A0F15] z-10 min-w-[180px]">
                                            Élève
                                        </th>
                                        {allSubjects.map(s => (
                                            <th key={s.id} className="px-4 py-3 text-center min-w-[100px]">
                                                <div>
                                                    <p className="text-xs font-bold text-gray-300 truncate max-w-[90px] mx-auto">{s.name}</p>
                                                    <p className="text-[10px] text-gray-600 font-normal">Coef. {s.coefficient}</p>
                                                </div>
                                            </th>
                                        ))}
                                        <th className="px-4 py-3 text-center min-w-[90px]">
                                            <p className="text-xs font-bold text-white uppercase tracking-wider">Moy. Gén.</p>
                                            <p className="text-[10px] text-gray-600 font-normal">/20</p>
                                        </th>
                                        <th className="px-4 py-3 text-center min-w-[60px]">
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Rang</p>
                                        </th>
                                        <th className="px-3 py-3 text-center min-w-[60px]">
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Présents</p>
                                        </th>
                                        <th className="px-3 py-3 text-center min-w-[60px]">
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Absences</p>
                                        </th>
                                        <th className="px-3 py-3 text-center min-w-[100px]">
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Comportement</p>
                                        </th>
                                        <th className="px-3 py-3 text-left min-w-[200px]">
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Appréciation</p>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reports.map((report, index) => {
                                        const rank = index + 1
                                        const att = attendanceStats[report.studentId]
                                        const ext = extras.get(report.studentId)
                                        const isReadOnly = reportStatus === 'published'

                                        return (
                                            <tr
                                                key={report.studentId}
                                                className={cn(
                                                    'border-t border-white/5 transition-colors hover:bg-white/[0.02]',
                                                    rank === 1 && 'bg-amber-500/[0.03]'
                                                )}
                                            >
                                                {/* Name */}
                                                <td className="px-5 py-3 sticky left-0 bg-[#0F1720] z-10">
                                                    <div className="flex items-center gap-2.5">
                                                        {rank <= 3 && (
                                                            <span className={cn(
                                                                'text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shrink-0',
                                                                rank === 1 ? 'bg-amber-500/20 text-amber-400' :
                                                                rank === 2 ? 'bg-gray-400/20 text-gray-400' :
                                                                'bg-orange-700/20 text-orange-600'
                                                            )}>
                                                                {rank}
                                                            </span>
                                                        )}
                                                        <span className="font-medium text-gray-200 truncate max-w-[140px]">
                                                            {report.studentName}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Subject averages */}
                                                {allSubjects.map(subj => {
                                                    const found = report.subjects.find(s => s.subjectId === subj.id)
                                                    return (
                                                        <td key={subj.id} className="px-4 py-3 text-center">
                                                            <AvgBadge value={found?.average ?? null} />
                                                        </td>
                                                    )
                                                })}

                                                {/* General average */}
                                                <td className="px-4 py-3 text-center">
                                                    <div className={cn(
                                                        'inline-flex items-center justify-center px-2.5 py-1 rounded-full text-sm font-black font-mono',
                                                        report.generalAverage === null ? 'text-gray-600' :
                                                        report.generalAverage >= 14 ? 'bg-emerald-500/15 text-emerald-400' :
                                                        report.generalAverage >= 10 ? 'bg-amber-500/15 text-amber-400' :
                                                        'bg-red-500/15 text-red-400'
                                                    )}>
                                                        {report.generalAverage !== null ? report.generalAverage.toFixed(2) : '—'}
                                                    </div>
                                                </td>

                                                {/* Rank */}
                                                <td className="px-4 py-3 text-center">
                                                    <span className="text-xs font-bold text-gray-500">#{rank}</span>
                                                </td>

                                                {/* Attendance */}
                                                <td className="px-3 py-3 text-center">
                                                    <span className="text-xs text-emerald-400 font-bold">
                                                        {att ? (att.present + att.late) : (ext?.attendanceDays ?? '—')}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-center">
                                                    <span className="text-xs text-red-400 font-bold">
                                                        {att ? att.absent : (ext?.absenceDays ?? '—')}
                                                    </span>
                                                </td>

                                                {/* Conduct grade */}
                                                <td className="px-3 py-3 text-center">
                                                    {isReadOnly ? (
                                                        <span className="text-xs font-bold text-gray-300">
                                                            {conductGrades.get(report.studentId) || '—'}
                                                        </span>
                                                    ) : (
                                                        <select
                                                            value={conductGrades.get(report.studentId) ?? ''}
                                                            onChange={e => {
                                                                const m = new Map(conductGrades)
                                                                m.set(report.studentId, e.target.value)
                                                                setConductGrades(m)
                                                            }}
                                                            className="bg-[#1A2530] border border-white/10 rounded-lg text-xs text-gray-300 px-2 py-1.5 w-full focus:outline-none focus:border-indigo-500/50"
                                                        >
                                                            <option value="">—</option>
                                                            {CONDUCT_OPTIONS.map(o => (
                                                                <option key={o.value} value={o.value}>{o.value} – {o.label}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </td>

                                                {/* General comment */}
                                                <td className="px-3 py-3">
                                                    {isReadOnly ? (
                                                        <span className="text-xs text-gray-400 italic">
                                                            {generalComments.get(report.studentId) || '—'}
                                                        </span>
                                                    ) : (
                                                        <textarea
                                                            rows={1}
                                                            value={generalComments.get(report.studentId) ?? ''}
                                                            onChange={e => {
                                                                const m = new Map(generalComments)
                                                                m.set(report.studentId, e.target.value)
                                                                setGeneralComments(m)
                                                            }}
                                                            placeholder="Appréciation…"
                                                            className="bg-[#1A2530] border border-white/10 rounded-lg text-xs text-gray-300 px-2.5 py-1.5 w-full resize-none focus:outline-none focus:border-indigo-500/50 placeholder-gray-700"
                                                        />
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>

                                {/* Class average footer */}
                                <tfoot>
                                    <tr className="border-t-2 border-white/10 bg-[#0A0F15]">
                                        <td className="px-5 py-3 sticky left-0 bg-[#0A0F15] z-10">
                                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                                Moyenne de la classe
                                            </span>
                                        </td>
                                        {allSubjects.map(subj => {
                                            const valid = reports.filter(r => {
                                                const s = r.subjects.find(s => s.subjectId === subj.id)
                                                return s?.average !== null && s?.average !== undefined
                                            })
                                            const avg = valid.length > 0
                                                ? valid.reduce((sum, r) => {
                                                    const s = r.subjects.find(s => s.subjectId === subj.id)
                                                    return sum + (s?.average ?? 0)
                                                }, 0) / valid.length
                                                : null
                                            return (
                                                <td key={subj.id} className="px-4 py-3 text-center">
                                                    <AvgBadge value={avg} />
                                                </td>
                                            )
                                        })}
                                        <td className="px-4 py-3 text-center">
                                            <span className={cn(
                                                'font-mono font-black text-sm',
                                                classAvg === null ? 'text-gray-600' :
                                                classAvg >= 14 ? 'text-emerald-400' :
                                                classAvg >= 10 ? 'text-amber-400' : 'text-red-400'
                                            )}>
                                                {classAvg !== null ? classAvg.toFixed(2) : '—'}
                                            </span>
                                        </td>
                                        <td colSpan={5} />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}

                {/* ── Empty state ─────────────────────────────────────────────── */}
                {!calculating && reports.length === 0 && canCalculate && (
                    <div className="text-center py-16 bg-[#0F1720] border border-white/5 rounded-2xl no-print">
                        <Calculator className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm font-medium">Aucune donnée calculée</p>
                        <p className="text-gray-600 text-xs mt-1">
                            Cliquez sur <strong className="text-gray-500">Calculer les moyennes</strong> pour générer les bulletins.
                        </p>
                    </div>
                )}

                {/* ── Info notice ─────────────────────────────────────────────── */}
                {reports.length === 0 && !canCalculate && (
                    <div className="flex items-start gap-3 bg-[#1A2530] border border-white/5 rounded-xl p-4 no-print">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                        <p className="text-xs text-gray-500">
                            Sélectionnez une année scolaire, un trimestre et une classe, puis cliquez sur <strong className="text-gray-400">Calculer les moyennes</strong>.
                        </p>
                    </div>
                )}
            </div>

            {/* ── Print area (hidden on screen, visible when printing) ─────── */}
            <div className="print-area hidden">
                {reports.map((report, index) => {
                    const rank = index + 1
                    const att = attendanceStats[report.studentId]
                    const ext = extras.get(report.studentId)
                    const conduct = conductGrades.get(report.studentId) || ext?.conductGrade
                    const comment = generalComments.get(report.studentId) || ext?.generalComment
                    const attendDays = att ? (att.present + att.late) : (ext?.attendanceDays ?? null)
                    const absenceDays = att ? att.absent : (ext?.absenceDays ?? null)

                    return (
                        <div key={report.studentId} className="bulletin-card">
                            {/* Header */}
                            <div className="bulletin-header">
                                <div>
                                    <div className="bulletin-school">{schoolName || 'Établissement'}</div>
                                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{selectedClassName}</div>
                                </div>
                                <div>
                                    <div className="bulletin-title">Bulletin Scolaire</div>
                                    <div className="bulletin-meta">{termLabel} — Rang : {rank}/{reports.length}</div>
                                </div>
                            </div>

                            {/* Student info */}
                            <div className="bulletin-student-name">{report.studentName}</div>
                            <div className="bulletin-rank">
                                Rang : {rank}/{reports.length}
                                {classAvg !== null && ` · Moyenne classe : ${classAvg.toFixed(2)}/20`}
                            </div>

                            {/* Subjects table */}
                            <table className="bulletin-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '40%' }}>Matière</th>
                                        <th style={{ width: '15%', textAlign: 'center' }}>Coef.</th>
                                        <th style={{ width: '20%', textAlign: 'center' }}>Moyenne</th>
                                        <th style={{ width: '25%', textAlign: 'center' }}>Appréciation</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.subjects.map(subj => {
                                        const avgClass = subj.average === null ? '' :
                                            subj.average >= 14 ? 'avg-good' :
                                            subj.average >= 10 ? 'avg-ok' : 'avg-fail'
                                        return (
                                            <tr key={subj.subjectId}>
                                                <td>{subj.subjectName}</td>
                                                <td style={{ textAlign: 'center' }}>{subj.coefficient}</td>
                                                <td className={avgClass} style={{ textAlign: 'center' }}>
                                                    {subj.average !== null ? subj.average.toFixed(2) : '—'}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>—</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr style={{ borderTop: '2px solid #d1d5db' }}>
                                        <td style={{ fontWeight: 700 }}>Moyenne Générale</td>
                                        <td />
                                        <td className={
                                            report.generalAverage === null ? '' :
                                            report.generalAverage >= 14 ? 'avg-good' :
                                            report.generalAverage >= 10 ? 'avg-ok' : 'avg-fail'
                                        } style={{ textAlign: 'center', fontWeight: 900, fontSize: 14 }}>
                                            {report.generalAverage !== null ? report.generalAverage.toFixed(2) : '—'}/20
                                        </td>
                                        <td />
                                    </tr>
                                </tfoot>
                            </table>

                            {/* Footer: conduct + attendance + comment */}
                            <div className="bulletin-footer">
                                <div>
                                    <div className="bulletin-field-label">Comportement</div>
                                    <div className="bulletin-field-value">
                                        {conduct
                                            ? `${conduct} — ${CONDUCT_OPTIONS.find(o => o.value === conduct)?.label ?? conduct}`
                                            : '—'}
                                    </div>
                                </div>
                                <div>
                                    <div className="bulletin-field-label">Présences / Absences</div>
                                    <div className="bulletin-field-value">
                                        {attendDays !== null ? `${attendDays} j présent` : '—'}
                                        {absenceDays !== null ? ` · ${absenceDays} j absent` : ''}
                                    </div>
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <div className="bulletin-field-label">Appréciation générale</div>
                                    <div className="bulletin-field-value" style={{ fontStyle: comment ? 'italic' : 'normal', color: comment ? '#111' : '#9ca3af' }}>
                                        {comment || 'Aucune appréciation saisie.'}
                                    </div>
                                </div>
                                <div>
                                    <div className="bulletin-field-label">Signature du directeur</div>
                                    <div style={{ height: 40, borderBottom: '1px solid #d1d5db', marginTop: 4 }} />
                                </div>
                                <div>
                                    <div className="bulletin-field-label">Signature du parent</div>
                                    <div style={{ height: 40, borderBottom: '1px solid #d1d5db', marginTop: 4 }} />
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </>
    )
}
