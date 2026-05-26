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
    saveSubjectAppreciations,
    saveAttendanceDays,
    getStudentInfoByNNI,
    getStudentsByName,
    type StudentReport,
    type ReportCardExtra,
} from '@/app/admin/reports/actions'
import { Button } from '@/components/ui/button'
import {
    Loader2,
    Calculator,
    Send,
    ChevronDown,
    AlertTriangle,
    GraduationCap,
    CheckCircle2,
    BookOpen,
    Save,
    ShieldCheck,
    Clock,
    FileText,
    Search
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getMySchoolContext } from '@/app/admin/actions'
import { useLanguage } from '@/i18n/language-context'

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
    { value: 'TB' },
    { value: 'B' },
    { value: 'AB' },
    { value: 'P' },
]

const CONDUCT_LABELS: Record<string, Record<string, string>> = {
    fr: {
        TB: 'Très Bien',
        B: 'Bien',
        AB: 'Assez Bien',
        P: 'Passable',
    },
    ar: {
        TB: 'ممتاز',
        B: 'جيد',
        AB: 'مستحسن',
        P: 'مقبول',
    }
}

// ─── Average badge ─────────────────────────────────────────────────────────────

function AvgBadge({ value }: { value: number | null }) {
    if (value === null) return <span className="text-slate-400 font-mono text-xs font-bold">—</span>
    const style = 'bg-zinc-100 text-zinc-950 border-white shadow-sm'
    return (
        <span className={cn('font-mono font-black text-xs px-2.5 py-1 rounded-lg border inline-block', style)}>
            {value.toFixed(2)}
        </span>
    )
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
    const { t } = useLanguage()
    const steps: { key: ReportStatus; label: string; icon: React.ElementType }[] = [
        { key: 'draft',     label: t('reports.draft'), icon: Clock },
        { key: 'validated', label: t('reports.validated'),    icon: ShieldCheck },
        { key: 'published', label: t('reports.published'),    icon: Send },
    ]
    const currentIdx = steps.findIndex(s => s.key === status)

    return (
        <div className="flex items-center gap-1">
            {steps.map((step, i) => {
                const reached = i <= currentIdx
                const active = i === currentIdx
                const Icon = step.icon
                return (
                    <div key={step.key} className="flex items-center">
                        <div className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all',
                            reached && active  ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50' :
                            reached && !active ? 'bg-emerald-500/15 text-emerald-400' :
                                                 'bg-white/5 text-gray-600'
                        )}>
                            <Icon className="w-3 h-3" />
                            {step.label}
                        </div>
                        {i < steps.length - 1 && (
                            <div className={cn('w-4 h-px mx-1', reached ? 'bg-emerald-500/40' : 'bg-white/10')} />
                        )}
                    </div>
                )
            })}
        </div>
    )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function ReportCards() {
    const { t, language } = useLanguage()
    const [years, setYears] = useState<AcademicYear[]>([])
    const [terms, setTerms] = useState<Term[]>([])
    const [classes, setClasses] = useState<Class[]>([])
    const [schoolName, setSchoolName] = useState<string>('')
    const [schoolLogo, setSchoolLogo] = useState<string>('')

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

    // Search state
    const [searchMode, setSearchMode] = useState<'nni' | 'name'>('nni')
    const [nniQuery, setNniQuery] = useState('')
    const [isSearchingNni, setIsSearchingNni] = useState(false)
    const [nameQuery, setNameQuery] = useState('')
    const [isSearchingName, setIsSearchingName] = useState(false)
    const [nameResults, setNameResults] = useState<{
        profile: { id: string; full_name: string; national_id?: string }
        enrollment: { class_id: string; academic_year_id: string } | null
    }[]>([])
    const [filteredStudentId, setFilteredStudentId] = useState<string | null>(null)

    // Per-subject appreciations: Map<studentId, Map<subjectId, string>>
    const [subjectAppreciations, setSubjectAppreciations] = useState<Map<string, Map<string, string>>>(new Map())

    // Workflow status
    const [reportStatus, setReportStatus] = useState<ReportStatus>('draft')

    const isAr = language === 'ar'

    const [calculating, setCalculating] = useState(false)
    const [loading, setLoading] = useState(true)
    const [isPending, startTransition] = useTransition()
    const [savingDetails, setSavingDetails] = useState(false)
    const [validating, setValidating] = useState(false)
    const [publishing, setPublishing] = useState(false)
    const [exporting, setExporting] = useState(false)

    // Load selectors
    useEffect(() => {
        async function load() {
            const ctx = await getMySchoolContext()
            if (!ctx) { setLoading(false); return }
            const profile = { school_id: ctx.school_id }
            const supabase = createClient()

            const [{ data: yearsData }, { data: termsData }, { data: classesData }, { data: schoolData }, { data: settingsData }] =
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
                    supabase.from('school_settings')
                        .select('name, logo_url')
                        .eq('school_id', profile.school_id)
                        .single(),
                ])

            setYears(yearsData || [])
            setTerms(termsData || [])
            setClasses(classesData || [])
            
            // Prioritize the customized settings name over the raw DB school name
            const finalName = (settingsData as any)?.name || (schoolData as any)?.name || ''
            setSchoolName(finalName)
            setSchoolLogo((settingsData as any)?.logo_url || '')

            const currentYear = (yearsData || []).find(y => y.is_current)
            if (currentYear) setSelectedYear(currentYear.id)
            const currentTerm = (termsData || []).find(t => t.is_current)
            if (currentTerm) setSelectedTerm(currentTerm.id)

            setLoading(false)
        }
        load()
    }, [])

    const filteredTerms = (() => {
        const yearTerms = terms.filter(t => t.academic_year_id === selectedYear)
        const seen = new Set<string>()
        return yearTerms.filter(t => {
            if (seen.has(t.name)) return false
            seen.add(t.name)
            return true
        })
    })()
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
        setSubjectAppreciations(new Map())
        setReportStatus('draft')
        setNameResults([])
    }

    useEffect(() => {
        if (selectedClass && selectedTerm) {
            handleCalculate()
        }
    }, [selectedClass, selectedTerm])

    const handleCalculate = async () => {
        if (!canCalculate) return
        setCalculating(true)
        
        // Clear general state but keep filter context temporarily if set by search
        setReports([])
        setExtras(new Map())
        setAttendanceStats({})
        setConductGrades(new Map())
        setGeneralComments(new Map())
        setReportStatus('draft')

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
            const subjApprMap = new Map<string, Map<string, string>>()
            let overallStatus: ReportStatus = 'draft'

            extrasData.forEach(e => {
                extrasMap.set(e.studentId, e)
                if (e.conductGrade) conductMap.set(e.studentId, e.conductGrade)
                if (e.generalComment) commentMap.set(e.studentId, e.generalComment)
                if (e.subjectAppreciations.length > 0) {
                    subjApprMap.set(e.studentId, new Map(e.subjectAppreciations.map(s => [s.subjectId, s.appreciation])))
                }
                if (e.status === 'published') overallStatus = 'published'
                else if (e.status === 'validated' && overallStatus === 'draft') overallStatus = 'validated'
            })

            setExtras(extrasMap)
            setConductGrades(conductMap)
            setGeneralComments(commentMap)
            setSubjectAppreciations(subjApprMap)
            setAttendanceStats(attStats)
            setReportStatus(overallStatus)

            // Auto-save attendance stats
            if (Object.keys(attStats).length > 0) {
                saveAttendanceDays(selectedClass, selectedTerm, attStats).catch(() => {})
            }

            toast.success(t('reports.calcSuccess'))
        }
        setCalculating(false)
    }

    const handleSearchNNI = async (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        if (!nniQuery.trim()) return

        setIsSearchingNni(true)
        try {
            const res = await getStudentInfoByNNI(nniQuery.trim())
            if ('error' in res) {
                toast.error(res.error)
                setFilteredStudentId(null)
            } else {
                const { student, enrollment } = res
                
                // Step 1: Set proper selectors based on student enrollment
                if (enrollment.academic_year_id) {
                    setSelectedYear(enrollment.academic_year_id)
                }
                
                setSelectedClass(enrollment.class_id)
                setFilteredStudentId(student.id)
                
                toast.success(`${t('reports.eleveFound')} ${student.full_name}`)
                
                // We wait for state changes? 
                // The useEffect handles the [selectedClass, selectedTerm] change if selectedTerm exists
                // But we should remind user to select term if not set
                if (!selectedTerm) {
                    // Try to find current term of that year
                    const currentForYear = terms.find(t => t.academic_year_id === enrollment.academic_year_id && t.is_current)
                    if (currentForYear) setSelectedTerm(currentForYear.id)
                    else toast.info(t('reports.selectTermPrompt'))
                }
            }
        } catch (err) {
            toast.error(t('reports.searchError'))
        } finally {
            setIsSearchingNni(false)
        }
    }

    const handleSearchName = async (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        if (!nameQuery.trim()) return
        setIsSearchingName(true)
        setNameResults([])
        try {
            const res = await getStudentsByName(nameQuery.trim())
            if ('error' in res) {
                toast.error(res.error)
            } else if (res.students.length === 0) {
                toast.error(t('reports.noStudentFound'))
            } else if (res.students.length === 1) {
                selectNameResult(res.students[0] as any)
            } else {
                setNameResults(res.students as any)
            }
        } catch {
            toast.error(t('reports.searchError'))
        } finally {
            setIsSearchingName(false)
        }
    }

    const selectNameResult = (student: { profile: { id: string; full_name: string; national_id?: string }; enrollment: { class_id: string; academic_year_id: string } | null }) => {
        if (!student.enrollment) return
        if (student.enrollment.academic_year_id) setSelectedYear(student.enrollment.academic_year_id)
        setSelectedClass(student.enrollment.class_id)
        setFilteredStudentId(student.profile.id)
        setNameResults([])
        toast.success(`${t('reports.eleveFound')} ${student.profile.full_name}`)
        if (!selectedTerm) {
            const currentForYear = terms.find(t => t.academic_year_id === student.enrollment!.academic_year_id && t.is_current)
            if (currentForYear) setSelectedTerm(currentForYear.id)
            else toast.info(t('reports.selectTermPrompt'))
        }
    }

    const handleClearFilter = () => {
        setFilteredStudentId(null)
        setNniQuery('')
        setNameQuery('')
        setNameResults([])
    }

    const displayReports = filteredStudentId 
        ? reports.filter(r => r.studentId === filteredStudentId)
        : reports

    const collectSubjectAppreciations = () => {
        const list: { studentId: string; subjectId: string; appreciation: string }[] = []
        subjectAppreciations.forEach((subjMap, studentId) => {
            subjMap.forEach((appreciation, subjectId) => {
                list.push({ studentId, subjectId, appreciation })
            })
        })
        return list
    }

    const handleSaveDetails = async () => {
        if (reports.length === 0) return
        setSavingDetails(true)

        const details = reports.map(r => ({
            studentId: r.studentId,
            conductGrade: conductGrades.get(r.studentId) ?? '',
            generalComment: generalComments.get(r.studentId) ?? '',
        }))

        const appreciations = collectSubjectAppreciations()

        const [detailsResult, apprResult] = await Promise.all([
            saveReportCardDetails(selectedClass, selectedTerm, details),
            appreciations.length > 0
                ? saveSubjectAppreciations(selectedClass, selectedTerm, appreciations)
                : Promise.resolve({ success: true }),
        ])

        if (detailsResult.error) toast.error(detailsResult.error)
        else if (apprResult && 'error' in apprResult && apprResult.error) toast.error(apprResult.error)
        else toast.success(t('reports.saveSuccess'))

        setSavingDetails(false)
    }

    const handleValidate = async () => {
        if (reports.length === 0 || reportStatus !== 'draft') return
        setValidating(true)

        // Save details first for all reports
        const details = reports.map(r => ({
            studentId: r.studentId,
            conductGrade: conductGrades.get(r.studentId) ?? '',
            generalComment: generalComments.get(r.studentId) ?? '',
        }))
        const appreciations = collectSubjectAppreciations()
        await Promise.all([
            saveReportCardDetails(selectedClass, selectedTerm, details),
            appreciations.length > 0 ? saveSubjectAppreciations(selectedClass, selectedTerm, appreciations) : Promise.resolve(),
        ])

        const result = await validateReportCards(selectedClass, selectedTerm)
        if (result.error) toast.error(result.error)
        else {
            setReportStatus('validated')
            toast.success(t('reports.validateSuccess'))
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
            toast.success(t('reports.publishSuccess'))
        }
        setPublishing(false)
    }

    const handleExportPDFA = async () => {
        if (displayReports.length === 0) return
        setExporting(true)

        if (language === 'ar') {
            // Native print for Arabic ensures perfect shaping & single-page enforcement
            setTimeout(() => {
                window.print()
                setExporting(false)
            }, 300)
            return
        }

        toast.info("Génération du document PDF vectoriel en cours...")

        try {
            // Helper to convert any source URL (even AVIF) into a standard JPEG for jsPDF safely
            const getBase64Image = async (imgUrl: string): Promise<string | null> => {
                return new Promise((resolve) => {
                    const img = new Image()
                    img.crossOrigin = 'Anonymous'
                    img.onload = () => {
                        const canvas = document.createElement('canvas')
                        canvas.width = img.naturalWidth
                        canvas.height = img.naturalHeight
                        const ctx = canvas.getContext('2d')
                        if (!ctx) return resolve(null)
                        ctx.drawImage(img, 0, 0)
                        // Convert explicitly to JPEG so jsPDF always supports it perfectly
                        resolve(canvas.toDataURL('image/jpeg', 0.9))
                    }
                    img.onerror = () => resolve(null)
                    img.src = imgUrl
                })
            }

            // Preload image once before loop starts to optimize memory & speed
            const logoBase64 = schoolLogo ? await getBase64Image(schoolLogo) : null

            const { jsPDF } = await import('jspdf')

            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4',
                compress: true
            })

            displayReports.forEach((report, index) => {
                const academicYear = years.find(y => y.id === selectedYear)?.name ?? '—'
                
                // Logic for Mentions and Observations
                let observation = '—'
                if (report.generalAverage !== null) {
                    if (report.generalAverage >= 16) observation = 'Excellent'
                    else if (report.generalAverage >= 14) observation = 'Très Bien'
                    else if (report.generalAverage >= 12) observation = 'Bien'
                    else if (report.generalAverage >= 10) observation = 'Satisfaisant'
                    else observation = 'À Revoir'
                }

                const conductVal = conductGrades.get(report.studentId) || extras.get(report.studentId)?.conductGrade
                const conductStr = conductVal ? (CONDUCT_LABELS[language]?.[conductVal] ?? conductVal) : t('reports.nonDefinie')

                const hasAverage = report.generalAverage !== null
                const originalIndex = reports.findIndex(r => r.studentId === report.studentId)
                const rank = hasAverage && originalIndex !== -1 ? originalIndex + 1 : null
                const att = attendanceStats[report.studentId]
                const ext = extras.get(report.studentId)
                const comment = generalComments.get(report.studentId) || ext?.generalComment
                
                const attendDaysVal = att ? (att.present + att.late) : (ext?.attendanceDays ?? null)
                const absenceDaysVal = att ? att.absent : (ext?.absenceDays ?? null)
                const attendDays = attendDaysVal !== null ? `${attendDaysVal} j` : '—'
                const absenceDays = absenceDaysVal !== null ? `${absenceDaysVal} j` : '—'

                const genAvgVal = report.generalAverage
                let decision = 'Ajourné(e)'
                if (genAvgVal !== null) {
                    if (genAvgVal >= 14) decision = 'Admis(e) (Félicitations)'
                    else if (genAvgVal >= 12) decision = 'Admis(e) (T. d\'Honneur)'
                    else if (genAvgVal >= 10) decision = 'Admis(e) (En Classe Sup.)'
                } else {
                    decision = 'Non définie'
                }

                if (index > 0) doc.addPage()

                // Header Section
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(11)
                doc.setTextColor(20, 20, 20)
                doc.text(schoolName || "ÉCOLE AL-MANAR", 20, 18)
                
                doc.setFontSize(7)
                doc.setTextColor(80, 80, 80)
                doc.text("EXCELLENCE & RIGUEUR PROFESSIONNELLE", 20, 22)
                doc.text("MINISTÈRE DE L'ÉDUCATION NATIONALE", 20, 26)

                // Logo Center top (Dynamic or Fallback)
                if (logoBase64) {
                    try {
                        // Center logo: 105 - 6 = 99mm. Center Y: 22 - 6 = 16mm.
                        doc.addImage(logoBase64, 'JPEG', 99, 16, 12, 12)
                    } catch (err) {
                        // Fallback in case addImage fails for any reason
                        doc.setFillColor(79, 70, 229); doc.circle(105, 22, 5, 'F')
                    }
                } else {
                    doc.setDrawColor(79, 70, 229) // indigo-600
                    doc.setLineWidth(0.5)
                    doc.circle(105, 22, 6.5, 'S')
                    doc.setFillColor(79, 70, 229)
                    doc.circle(105, 22, 5, 'F')
                    doc.setFontSize(9)
                    doc.setTextColor(255, 255, 255)
                    doc.text("A", 105, 25.2, { align: 'center' })
                }

                // Emit Date
                doc.setFontSize(8)
                doc.setTextColor(100, 100, 100)
                const todayStr = new Date().toLocaleDateString('fr-FR')
                doc.text(`Émis le : ${todayStr}`, 190, 22, { align: 'right' })

                // Title Area
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(15)
                doc.setTextColor(15, 15, 15)
                doc.text("BULLETIN SCOLAIRE", 105, 36, { align: 'center' })
                doc.setFontSize(10)
                doc.setTextColor(79, 70, 229)
                doc.text(termLabel.toUpperCase(), 105, 41, { align: 'center' })
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(8.5)
                doc.setTextColor(60, 60, 60)
                doc.text(`Année Académique : ${academicYear}`, 105, 46, { align: 'center' })

                // HR Line
                doc.setDrawColor(200, 200, 200)
                doc.setLineWidth(0.3)
                doc.line(20, 50, 190, 50)

                // IDENTITY BOX
                doc.setFillColor(248, 250, 252)
                doc.rect(20, 54, 170, 28, 'F')
                doc.setDrawColor(220, 225, 230)
                doc.rect(20, 54, 170, 28, 'S')

                doc.setFontSize(9)
                doc.setFont('helvetica', 'bold')
                doc.setTextColor(100, 100, 100)
                
                // Row 1
                doc.text("Élève :", 25, 61)
                doc.setTextColor(0, 0, 0)
                const studentNameText = report.studentName + (report.enrollmentStatus === 'transferred' ? ' (Archivé)' : '')
                doc.text(studentNameText, 40, 61)

                doc.setTextColor(100, 100, 100)
                doc.text("Classe :", 110, 61)
                doc.setTextColor(0, 0, 0)
                doc.text(selectedClassName, 125, 61)

                // Row 2
                doc.setTextColor(100, 100, 100)
                doc.text("NNI :", 25, 67)
                doc.setTextColor(0, 0, 0)
                doc.text(report.studentNNI || '—', 40, 67)

                doc.setTextColor(100, 100, 100)
                doc.text("Moyenne Classe :", 110, 67)
                doc.setTextColor(0, 0, 0)
                const classAvgStr = classAvg !== null ? `${classAvg.toFixed(2)} / 20` : '— / 20'
                doc.text(classAvgStr, 140, 67)

                // Row 3
                doc.setTextColor(100, 100, 100)
                doc.text("Moyenne Générale :", 25, 73)
                doc.setFont('helvetica', 'bold')
                doc.setTextColor(0, 0, 0)
                const genAvgStr = genAvgVal !== null ? `${genAvgVal.toFixed(2)} / 20` : '— / 20'
                doc.text(genAvgStr, 58, 73)

                doc.setFont('helvetica', 'bold')
                doc.setTextColor(100, 100, 100)
                doc.text("Rang :", 110, 73)
                doc.setTextColor(79, 70, 229)
                const rankLabel = rank !== null ? (rank === 1 ? '1er' : `${rank}e`) : '—'
                doc.text(rankLabel, 120, 73)

                // Row 4
                doc.setTextColor(100, 100, 100)
                doc.text("Décision :", 25, 79)
                if (decision.includes('Admis')) doc.setTextColor(16, 120, 80)
                else doc.setTextColor(200, 0, 0)
                doc.text(decision, 42, 79)

                // 📊 Table Section
                let currY = 90
                doc.setFillColor(30, 41, 59) // Slate-800
                doc.rect(20, currY, 170, 8, 'F')
                doc.setFontSize(8)
                doc.setTextColor(255, 255, 255)
                doc.setFont('helvetica', 'bold')
                doc.text("MATIÈRES D'ENSEIGNEMENT", 25, currY + 5.5)
                doc.text("COEF", 100, currY + 5.5, { align: 'center' })
                doc.text("MOYENNE", 130, currY + 5.5, { align: 'center' })
                doc.text("APPRÉCIATION PAR MATIÈRE", 170, currY + 5.5, { align: 'center' })

                currY += 8
                doc.setFont('helvetica', 'normal')
                doc.setTextColor(30, 30, 30)

                report.subjects.forEach((subj, i) => {
                    if (i % 2 !== 0) {
                        doc.setFillColor(248, 250, 252)
                        doc.rect(20, currY, 170, 7, 'F')
                    }
                    doc.setFont('helvetica', 'bold')
                    doc.text(subj.subjectName, 25, currY + 5)
                    doc.setFont('helvetica', 'normal')
                    doc.text(subj.coefficient.toString(), 100, currY + 5, { align: 'center' })
                    
                    doc.setFont('helvetica', 'bold')
                    doc.text(subj.average !== null ? subj.average.toFixed(2) : '—', 130, currY + 5, { align: 'center' })

                    let subjObs = '—'
                    if (subj.average !== null) {
                        if (subj.average >= 16) subjObs = 'Excellent'
                        else if (subj.average >= 14) subjObs = 'Très Bien'
                        else if (subj.average >= 12) subjObs = 'Bien'
                        else if (subj.average >= 10) subjObs = 'Satisfaisant'
                        else subjObs = 'À Revoir'
                    }
                    doc.setFont('helvetica', 'normal')
                    doc.setTextColor(80, 80, 80)
                    doc.text(subjObs, 170, currY + 5, { align: 'center' })
                    doc.setTextColor(30, 30, 30)

                    doc.setDrawColor(230, 230, 230)
                    doc.line(20, currY + 7, 190, currY + 7)
                    currY += 7
                })

                // Total Line
                doc.setFillColor(241, 245, 249)
                doc.rect(20, currY, 170, 8, 'F')
                doc.setDrawColor(15, 23, 42)
                doc.setLineWidth(0.4)
                doc.line(20, currY, 190, currY)
                doc.line(20, currY + 8, 190, currY + 8)
                
                doc.setFontSize(8.5)
                doc.setFont('helvetica', 'bold')
                doc.text("MOYENNE GÉNÉRALE", 25, currY + 5.5)
                
                const totalCoef = report.subjects.reduce((a, b) => a + b.coefficient, 0)
                doc.text(totalCoef.toString(), 100, currY + 5.5, { align: 'center' })
                doc.text(genAvgVal !== null ? `${genAvgVal.toFixed(2)} / 20` : '— / 20', 130, currY + 5.5, { align: 'center' })
                
                const honorMention = genAvgVal !== null && genAvgVal >= 14 ? "Tableau d'Honneur" : genAvgVal !== null && genAvgVal >= 12 ? "Encouragements" : "—"
                doc.setTextColor(79, 70, 229)
                doc.text(honorMention, 170, currY + 5.5, { align: 'center' })
                doc.setTextColor(0, 0, 0)

                currY += 20

                // Assiduité Section
                doc.setFontSize(9)
                doc.setFont('helvetica', 'bold')
                doc.text("ASSIDUITÉ & COMPORTEMENT", 20, currY)
                doc.setDrawColor(200, 200, 200)
                doc.setLineWidth(0.25)
                doc.line(20, currY + 2, 190, currY + 2)
                
                currY += 8
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(8.5)
                doc.setTextColor(100, 100, 100)
                doc.text("Conduite générale :", 20, currY)
                doc.setTextColor(0, 0, 0)
                doc.setFont('helvetica', 'bold')
                doc.text(conductStr, 50, currY)
                
                doc.setFont('helvetica', 'normal')
                doc.setTextColor(100, 100, 100)
                doc.text("Présences :", 85, currY)
                doc.setTextColor(0, 0, 0)
                doc.text(attendDays, 102, currY)

                doc.setTextColor(100, 100, 100)
                doc.text("Absences :", 140, currY)
                doc.setTextColor(180, 0, 0)
                doc.text(absenceDays, 156, currY)

                currY += 15
                
                // Appreciation
                doc.setFontSize(9)
                doc.setTextColor(0, 0, 0)
                doc.setFont('helvetica', 'bold')
                doc.text("APPRÉCIATION DU CONSEIL DE CLASSE", 20, currY)
                doc.line(20, currY + 2, 190, currY + 2)
                
                currY += 8
                doc.setFont('helvetica', 'italic')
                doc.setFontSize(8.5)
                doc.setTextColor(60, 60, 60)
                doc.text(comment || "Aucune appréciation saisie pour ce trimestre.", 20, currY)

                currY += 25
                
                // Signature Block
                doc.setFont('helvetica', 'bold')
                doc.setTextColor(0, 0, 0)
                doc.text("LE DIRECTEUR DE L'ÉTABLISSEMENT", 105, currY, { align: 'center' })
                
                doc.setDrawColor(220, 38, 38)
                doc.setLineWidth(0.4)
                doc.rect(75, currY + 4, 60, 20, 'S')
                doc.setFontSize(8)
                doc.setTextColor(220, 38, 38)
                doc.text(schoolName || "ÉCOLE AL-MANAR", 105, currY + 9, { align: 'center' })
                doc.text("DIRECTION", 105, currY + 13, { align: 'center' })
                doc.text("ARCHIVAGE", 105, currY + 17, { align: 'center' })

                // Overwritten font text
                doc.setFont('courier', 'bolditalic')
                doc.setFontSize(12)
                doc.setTextColor(30, 58, 138)
                doc.text("Directeur", 105, currY + 14, { align: 'center' })
                
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(7)
                doc.setTextColor(100, 100, 100)
                doc.text("Sceau de l'établissement & Cachet d'archivage", 105, currY + 28, { align: 'center' })
            })

            const cleanClass = selectedClassName.replace(/\s+/g, '_')
            const cleanTerm = termLabel.replace(/\s+/g, '_')
            const filename = `bulletins-${cleanClass}-${cleanTerm}.pdf`
            doc.save(filename)
            toast.success("PDF généré avec succès.")

        } catch (err) {
            console.error("PDF rebuild failure:", err)
            toast.error("Erreur lors de l'exportation PDF.")
        } finally {
            setExporting(false)
        }
    }


    // Collect all unique subjects
    const allSubjects = (() => {
        const map = new Map<string, { name: string; coefficient: number }>()
        displayReports.forEach(r => {
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
            {/* ── Print & Capturable styles ───────────────────────────────── */}
            <style id="bulletin-pdf-styles">{`
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&family=Inter:wght@400;500;600;700;800;900&display=swap');

                @media print {
                    body * { visibility: hidden !important; }
                    .print-area, .print-area * { visibility: visible !important; }
                    .print-area { 
                        display: block !important; 
                        position: absolute !important; 
                        left: 0 !important; 
                        top: 0 !important; 
                        width: 100% !important;
                        height: auto !important;
                        background: white !important; 
                        overflow: visible !important;
                    }
                    .no-print { display: none !important; }
                    
                    @page {
                        size: A4;
                        margin: 0;
                    }
                }

                .bulletin-page {
                    width: 210mm;
                    height: 297mm;
                    padding: 15mm 20mm;
                    background: white;
                    box-sizing: border-box;
                    page-break-after: always;
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    color: #111;
                }
                
                /* Replicating specific PDF elements */
                .pdf-logo-circle {
                    width: 11mm;
                    height: 11mm;
                    border-radius: 50%;
                    background: #4f46e5;
                    border: 1px solid #4f46e5;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-family: sans-serif;
                    font-weight: bold;
                    font-size: 18px;
                    box-shadow: 0 0 0 1.5px white, 0 0 0 2px #4f46e5;
                    margin: 0 auto;
                }

                .bulletin-header-grid {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                }

                .bulletin-id-box {
                    background-color: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 4px;
                    padding: 12px 20px;
                    margin: 15px 0;
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px 40px;
                }

                .id-box-row {
                    display: flex;
                    justify-content: space-between;
                    font-size: 12px;
                    border-bottom: 1px dashed #e2e8f0;
                    padding-bottom: 4px;
                }
                
                .id-box-label {
                    color: #64748b;
                    font-weight: 600;
                }
                
                .id-box-val {
                    font-weight: 900;
                    color: #000;
                }

                .bulletin-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12px;
                    margin: 15px 0;
                }
                
                .bulletin-table th {
                    background: #1e293b;
                    color: white;
                    padding: 8px 12px;
                    text-align: center;
                    font-weight: 700;
                    border: none;
                }
                
                .bulletin-table td {
                    padding: 8px 12px;
                    border-bottom: 1px solid #e2e8f0;
                    text-align: center;
                }
                
                .table-row-alt td {
                    background-color: #f8fafc;
                }
                
                .table-footer-row td {
                    background: #f1f5f9;
                    border-top: 2px solid #0f172a;
                    border-bottom: 2px solid #0f172a;
                    font-weight: 900;
                    font-size: 13px;
                }

                .director-stamp {
                    margin: 30px auto 0 auto;
                    text-align: center;
                    width: 200px;
                    position: relative;
                }
                
                .stamp-box {
                    border: 2px solid #ef4444;
                    color: #ef4444;
                    font-weight: 900;
                    text-transform: uppercase;
                    padding: 10px;
                    font-size: 11px;
                    letter-spacing: 1px;
                    margin: 10px auto;
                    transform: rotate(-2deg);
                }
                
                .script-signature {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -30%);
                    font-family: 'Courier New', Courier, monospace;
                    font-style: italic;
                    font-weight: bold;
                    font-size: 22px;
                    color: #1e3a8a;
                    opacity: 0.8;
                    pointer-events: none;
                }
            `}</style>

            <div className="space-y-8 animate-in fade-in duration-300">

                {/* ── Header actions ──────────────────────────────────────── */}
                {displayReports.length > 0 && (
                    <div className="no-print flex flex-wrap gap-2 items-center justify-end">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleExportPDFA}
                            disabled={exporting}
                            className="border-white/10 text-gray-400 hover:text-white bg-transparent"
                        >
                            {exporting ? <Loader2 className="w-3.5 h-3.5 me-1.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 me-1.5" />}
                            {t('common.export')}
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleSaveDetails}
                            disabled={savingDetails || reportStatus === 'published'}
                            className="border-white/10 text-gray-400 hover:text-white bg-transparent"
                        >
                            {savingDetails ? <Loader2 className="w-3.5 h-3.5 me-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 me-1.5" />}
                            {t('common.save')}
                        </Button>
                        {reportStatus === 'draft' && (
                            <Button size="sm" onClick={handleValidate} disabled={validating} className="bg-indigo-500 hover:bg-indigo-400 text-white font-semibold">
                                {validating ? <Loader2 className="w-3.5 h-3.5 me-1.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 me-1.5" />}
                                {t('reports.validate')}
                            </Button>
                        )}
                        {reportStatus === 'validated' && (
                            <Button size="sm" onClick={handlePublish} disabled={publishing} className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold">
                                {publishing ? <Loader2 className="w-3.5 h-3.5 me-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 me-1.5" />}
                                {t('reports.publish')}
                            </Button>
                        )}
                        {reportStatus === 'published' && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" />{t('reports.published')}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Selectors ──────────────────────────────────────────────── */}
                <div className="bg-[#0F1720] border border-white/5 rounded-2xl p-5 no-print space-y-5">
                    {/* Quick student search (NNI or Name) */}
                    <form onSubmit={searchMode === 'nni' ? handleSearchNNI : handleSearchName} className="flex flex-col sm:flex-row sm:items-end gap-3 border-b border-white/5 pb-5 mb-1">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1.5">
                                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{t('reports.searchQuick')}</p>
                                <div className="flex rounded-lg overflow-hidden border border-white/10 text-[11px]">
                                    <button
                                        type="button"
                                        onClick={() => { setSearchMode('nni'); setNameResults([]) }}
                                        className={cn('px-2.5 py-1 font-bold transition-colors', searchMode === 'nni' ? 'bg-indigo-500 text-white' : 'bg-[#1A2530] text-gray-500 hover:text-gray-300')}
                                    >NNI</button>
                                    <button
                                        type="button"
                                        onClick={() => { setSearchMode('name'); setNameResults([]) }}
                                        className={cn('px-2.5 py-1 font-bold transition-colors', searchMode === 'name' ? 'bg-indigo-500 text-white' : 'bg-[#1A2530] text-gray-500 hover:text-gray-300')}
                                    >{t('reports.searchByName')}</button>
                                </div>
                            </div>
                            <div className="relative">
                                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                {searchMode === 'nni' ? (
                                    <input
                                        type="text"
                                        placeholder={t('reports.nniSearchPlaceholder')}
                                        value={nniQuery}
                                        onChange={e => setNniQuery(e.target.value)}
                                        className="w-full ps-9 pe-3 py-2.5 rounded-xl bg-[#1A2530] border border-white/10 text-white text-sm focus:border-indigo-500/50 outline-none placeholder:text-gray-600 transition-colors"
                                    />
                                ) : (
                                    <input
                                        type="text"
                                        placeholder={t('reports.nameSearchPlaceholder')}
                                        value={nameQuery}
                                        onChange={e => setNameQuery(e.target.value)}
                                        className="w-full ps-9 pe-3 py-2.5 rounded-xl bg-[#1A2530] border border-white/10 text-white text-sm focus:border-indigo-500/50 outline-none placeholder:text-gray-600 transition-colors"
                                    />
                                )}
                                {/* Name search results dropdown */}
                                {nameResults.length > 0 && (
                                    <div className="absolute top-full start-0 end-0 mt-1.5 z-50 bg-[#1A2530] border border-white/10 rounded-xl shadow-xl overflow-hidden">
                                        {nameResults.map(item => (
                                            <button
                                                key={item.profile.id}
                                                type="button"
                                                onClick={() => selectNameResult(item)}
                                                className="w-full text-start px-3 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                                            >
                                                <div className="font-semibold text-white">{item.profile.full_name}</div>
                                                <div className="text-[11px] text-gray-500">NNI: {item.profile.national_id || '—'}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <Button
                            type="submit"
                            disabled={(searchMode === 'nni' ? (isSearchingNni || !nniQuery.trim()) : (isSearchingName || !nameQuery.trim()))}
                            className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-medium shadow-none"
                        >
                            {(searchMode === 'nni' ? isSearchingNni : isSearchingName) ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Search className="w-4 h-4 me-2" />}
                            {t('reports.nniSearchBtn')}
                        </Button>
                    </form>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Selector
                            label={t('reports.selectYear')}
                            value={selectedYear}
                            options={years}
                            onChange={id => { setSelectedYear(id); setSelectedTerm(''); resetReports() }}
                            placeholder={t('reports.placeholderYear')}
                        />
                        <Selector
                            label={t('reports.selectTerm')}
                            value={selectedTerm}
                            options={filteredTerms.map(t => ({ id: t.id, name: TERM_LABELS[t.name] ?? t.name }))}
                            onChange={id => { setSelectedTerm(id); resetReports() }}
                            placeholder={t('reports.placeholderTerm')}
                            disabled={!selectedYear}
                        />
                        <Selector
                            label={t('reports.selectClass')}
                            value={selectedClass}
                            options={classes}
                            onChange={id => { setSelectedClass(id); resetReports() }}
                            placeholder={t('reports.placeholderClass')}
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
                            {t('reports.calculate')}
                        </Button>

                        {!canCalculate && (
                            <p className="text-xs text-gray-600">
                                {t('reports.subtitle')}
                            </p>
                        )}
                    </div>
                </div>

                {/* ── Context pills ───────────────────────────────────────────── */}
                {reports.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-4 no-print bg-[#0F1720] p-3 rounded-xl border border-white/5">
                        <div className="flex flex-wrap items-center gap-2">
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
                                    {t('reports.classAvgShort')} : {classAvg.toFixed(2)}/20
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <StatusStepper status={reportStatus} />
                            {filteredStudentId && (
                                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5">
                                    <span className="text-xs text-amber-400 font-medium">{t('reports.nniModeFilter')}</span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleClearFilter}
                                        className="h-6 py-0 px-2 text-[10px] text-amber-200 hover:text-white hover:bg-amber-500/20 font-bold"
                                    >
                                        {t('reports.viewWholeClass')}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Results table ───────────────────────────────────────────── */}
                {displayReports.length > 0 && (
                    <div className="bg-[#0F1720] border border-white/5 rounded-2xl overflow-hidden no-print">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                 <thead>
                                     <tr className="border-b border-white/10 bg-[#0F1720]">
                                         <th className="text-left px-5 py-4 text-xs font-black text-white uppercase tracking-wider sticky left-0 bg-[#0F1720] border-r border-white/5 z-10 min-w-[200px]">
                                             {t('reports.student')}
                                         </th>
                                         {allSubjects.map(s => (
                                             <th key={s.id} className="px-4 py-4 text-center min-w-[150px]">
                                                 <div className="flex flex-col items-center gap-1.5">
                                                     <p className="text-xs font-black text-white tracking-wide leading-tight uppercase whitespace-normal break-words max-w-[130px] mx-auto">
                                                         {s.name}
                                                     </p>
                                                     <span className="inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-500 text-white border border-indigo-400 shadow-sm uppercase tracking-wider">
                                                         Coef. {s.coefficient}
                                                     </span>
                                                 </div>
                                             </th>
                                         ))}
                                         <th className="px-4 py-4 text-center min-w-[95px] bg-[#0F1720]">
                                             <p className="text-xs font-black text-white uppercase tracking-wider">{t('reports.generalAvg')}</p>
                                             <p className="text-[10px] text-slate-300 font-bold">/20</p>
                                         </th>
                                         <th className="px-4 py-4 text-center min-w-[65px]">
                                             <p className="text-[10px] font-black text-white uppercase tracking-wider">{t('reports.rank')}</p>
                                         </th>
                                         <th className="px-3 py-4 text-center min-w-[65px]">
                                             <p className="text-[10px] font-black text-white uppercase tracking-wider">{t('reports.presents')}</p>
                                         </th>
                                         <th className="px-3 py-4 text-center min-w-[65px]">
                                             <p className="text-[10px] font-black text-white uppercase tracking-wider">{t('reports.absences')}</p>
                                         </th>
                                         <th className="px-3 py-4 text-center min-w-[110px]">
                                             <p className="text-[10px] font-black text-white uppercase tracking-wider">{t('reports.behavior')}</p>
                                         </th>
                                         <th className="px-3 py-4 text-left min-w-[210px]">
                                             <p className="text-[10px] font-black text-white uppercase tracking-wider">{t('reports.appreciation')}</p>
                                         </th>
                                     </tr>
                                 </thead>
                                 <tbody>
                                     {displayReports.map((report) => {
                                         const hasAverage = report.generalAverage !== null
                                         const originalIndex = reports.findIndex(r => r.studentId === report.studentId)
                                         const rank = hasAverage && originalIndex !== -1 ? originalIndex + 1 : null
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
                                                <td className="px-5 py-4 sticky left-0 bg-[#0F1720] border-r border-white/5 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                                                    <div className="flex items-center gap-2.5">
                                                        {hasAverage && rank !== null && rank <= 3 && (
                                                            <span className={cn(
                                                                'text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shrink-0 shadow-sm',
                                                                rank === 1 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/45' :
                                                                rank === 2 ? 'bg-slate-400/20 text-slate-100 border border-slate-400/45' :
                                                                'bg-orange-700/20 text-orange-400 border border-orange-700/45'
                                                            )}>
                                                                {rank}
                                                            </span>
                                                        )}
                                                        <div className="flex flex-col gap-0.5">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-extrabold text-white tracking-wide truncate max-w-[160px] hover:text-indigo-200 transition-colors">
                                                                    {report.studentName}
                                                                </span>
                                                                {report.enrollmentStatus === 'transferred' && (
                                                                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-wide">
                                                                        {language === 'ar' ? 'مؤرشف' : 'Archivé'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] text-gray-500 font-mono">
                                                                NNI: {report.studentNNI || '—'}
                                                            </span>
                                                            {/* Per-student status badge */}
                                                            {(() => {
                                                                const studentStatus = ext?.status ?? 'draft'
                                                                return (
                                                                    <span className={cn(
                                                                        'self-start text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide',
                                                                        studentStatus === 'published' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                                                        studentStatus === 'validated' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
                                                                        'bg-white/5 text-gray-600 border border-white/10'
                                                                    )}>
                                                                        {t(`reports.${studentStatus}`)}
                                                                    </span>
                                                                )
                                                            })()}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Subject averages + per-subject appreciations */}
                                                {allSubjects.map(subj => {
                                                    const found = report.subjects.find(s => s.subjectId === subj.id)
                                                    const appr = subjectAppreciations.get(report.studentId)?.get(subj.id) ?? ''
                                                    return (
                                                        <td key={subj.id} className="px-3 py-3 text-center align-top">
                                                            <div className="flex flex-col items-center gap-1.5">
                                                                <AvgBadge value={found?.average ?? null} />
                                                                {!isReadOnly ? (
                                                                    <textarea
                                                                        rows={2}
                                                                        value={appr}
                                                                        onChange={e => {
                                                                            const outer = new Map(subjectAppreciations)
                                                                            const inner = new Map(outer.get(report.studentId) ?? [])
                                                                            inner.set(subj.id, e.target.value)
                                                                            outer.set(report.studentId, inner)
                                                                            setSubjectAppreciations(outer)
                                                                        }}
                                                                        placeholder={t('reports.subjectApprPlaceholder')}
                                                                        className="w-full bg-[#121B24] border border-white/10 hover:border-indigo-500/30 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all rounded-lg text-[10px] text-gray-300 px-2 py-1.5 resize-none outline-none placeholder:text-slate-700"
                                                                    />
                                                                ) : appr ? (
                                                                    <span className="text-[10px] text-gray-400 italic text-center block leading-tight">{appr}</span>
                                                                ) : null}
                                                            </div>
                                                        </td>
                                                    )
                                                })}

                                                {/* General average */}
                                                <td className="px-4 py-4 text-center bg-[#0F1720]">
                                                    <div className={cn(
                                                        'inline-flex items-center justify-center px-3 py-1 rounded-xl text-xs font-black font-mono border shadow-md tracking-wider',
                                                        report.generalAverage === null ? 'bg-slate-800 text-slate-400 border-slate-700' :
                                                        'bg-white text-zinc-950 border-white shadow-md ring-2 ring-white/10'
                                                    )}>
                                                        {report.generalAverage !== null ? `${report.generalAverage.toFixed(2)} / 20` : '—'}
                                                    </div>
                                                </td>

                                                {/* Rank */}
                                                <td className="px-4 py-4 text-center">
                                                    <span className={cn(
                                                         'inline-block text-[11px] font-black px-2.5 py-1 rounded-lg shadow-sm border bg-zinc-100 text-zinc-950 border-zinc-200'
                                                     )}>
                                                        #{rank}
                                                    </span>
                                                </td>

                                                {/* Attendance */}
                                                <td className="px-3 py-4 text-center">
                                                    <span className="inline-block text-[11px] font-black px-2 py-0.5 rounded-md bg-zinc-100 border border-zinc-200 text-zinc-950 font-mono shadow-sm">
                                                        {att ? (att.present + att.late) : (ext?.attendanceDays ?? '—')}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-4 text-center">
                                                    <span className="inline-block text-[11px] font-black px-2 py-0.5 rounded-md bg-zinc-100 border border-zinc-200 text-zinc-950 font-mono shadow-sm">
                                                        {att ? att.absent : (ext?.absenceDays ?? '—')}
                                                    </span>
                                                </td>

                                                {/* Conduct grade */}
                                                <td className="px-3 py-4 text-center">
                                                    {isReadOnly ? (
                                                        <span className="text-xs font-black text-white">
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
                                                            className="bg-[#1A2530] border border-white/20 hover:border-indigo-500/40 transition-all rounded-xl text-xs text-white px-2.5 py-2 w-full focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 shadow-inner font-bold"
                                                        >
                                                            <option value="" className="text-slate-900 bg-white">—</option>
                                                            {CONDUCT_OPTIONS.map(o => (
                                                                <option key={o.value} value={o.value} className="text-slate-900 bg-white">
                                                                     {o.value} – {CONDUCT_LABELS[language]?.[o.value] || o.value}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </td>

                                                {/* General comment */}
                                                <td className="px-3 py-4">
                                                    {isReadOnly ? (
                                                        <span className="text-xs text-slate-100 font-bold italic">
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
                                                            placeholder={t('reports.appreciationPlaceholder')}
                                                            className="bg-[#121B24] border border-white/20 hover:border-indigo-500/40 transition-all rounded-xl text-xs text-white px-3 py-2 w-full resize-none focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 placeholder-slate-400 shadow-inner font-bold"
                                                        />
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>

                                {/* Class average footer */}
                                <tfoot>
                                    <tr className="border-t-2 border-white/10 bg-[#0F1720]">
                                        <td className="px-5 py-3 sticky left-0 bg-[#0F1720] z-10">
                                            <span className="text-xs font-bold text-white font-black uppercase tracking-wider">
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
                                            <div className={cn(
                                                'inline-flex items-center justify-center px-3 py-1.5 rounded-xl text-xs font-black font-mono border shadow-md tracking-wider',
                                                classAvg === null ? 'bg-slate-800 text-slate-400 border-slate-700' :
                                                'bg-white text-zinc-950 border-white shadow-md ring-2 ring-white/10'
                                            )}>
                                                {classAvg !== null ? classAvg.toFixed(2) : '—'}
                                            </div>
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
                        <p className="text-gray-500 text-sm font-medium">{t('common.noResults')}</p>
                        <p className="text-gray-600 text-xs mt-1">
                            {t('reports.subtitle')}
                        </p>
                    </div>
                )}

                {/* ── Info notice ─────────────────────────────────────────────── */}
                {reports.length === 0 && !canCalculate && (
                    <div className="flex items-start gap-3 bg-[#1A2530] border border-white/5 rounded-xl p-4 no-print">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                        <p className="text-xs text-gray-500">
                            {t('reports.subtitle')}
                        </p>
                    </div>
                )}
            </div>

            <div className="print-area opacity-0 pointer-events-none absolute -z-50 h-0 w-0 overflow-hidden">
                {displayReports.map((report) => {
                    const hasAverage = report.generalAverage !== null
                    const globalIndex = reports.findIndex(r => r.studentId === report.studentId)
                    const rank = hasAverage && globalIndex !== -1 ? globalIndex + 1 : null
                    const isAr = language === 'ar'
                    const att = attendanceStats[report.studentId]
                    const ext = extras.get(report.studentId)
                    const conductVal = conductGrades.get(report.studentId) || ext?.conductGrade
                    const conductStr = conductVal ? (CONDUCT_LABELS[language]?.[conductVal] ?? conductVal) : t('reports.nonDefinie')
                    const comment = generalComments.get(report.studentId) || ext?.generalComment
                    
                    const academicYear = years.find(y => y.id === selectedYear)?.name ?? '—'
                    let observation = ''
                    if (report.generalAverage !== null) {
                        if (report.generalAverage >= 16) observation = t('reports.obsExcellent')
                        else if (report.generalAverage >= 14) observation = t('reports.obsTresBien')
                        else if (report.generalAverage >= 12) observation = t('reports.obsBien')
                        else if (report.generalAverage >= 10) observation = t('reports.obsSatisfaisant')
                        else observation = t('reports.obsRedoubler')
                    }

                    return (
                        <div 
                            key={report.studentId} 
                            className={cn("bulletin-page relative overflow-hidden", isAr && "is-arabic")} 
                            dir={isAr ? "rtl" : "ltr"}
                        >
                            {/* Replicated Header Structure */}
                            <div className="bulletin-header-grid">
                                <div>
                                    <div style={{ fontWeight: 900, fontSize: '14px', color: '#111' }}>{schoolName || (isAr ? 'مدرسة المنار' : 'ÉCOLE AL-MANAR')}</div>
                                    <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700 }}>{t('reports.schoolSubHeader')}</div>
                                    <div style={{ fontSize: '9px', color: '#64748b' }}>{t('reports.ministereLabel')}</div>
                                </div>
                                
                                {/* Center Logo (Dynamic or Fallback) */}
                                {schoolLogo ? (
                                    <div style={{ width: '12mm', height: '12mm', borderRadius: '50%', border: '1px solid #E2E8F0', overflow: 'hidden', background: '#fff', margin: '0 auto', display: 'flex', alignItems: 'center', justifyItems: 'center' }}>
                                        <img src={schoolLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    </div>
                                ) : (
                                    <div className="pdf-logo-circle">A</div>
                                )}
                                
                                <div style={{ textAlign: isAr ? 'left' : 'right', fontSize: '10px', color: '#64748b' }}>
                                    {isAr ? 'صدر في' : 'Émis le'} : {new Date().toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR')}
                                </div>
                            </div>

                            {/* Title Block */}
                            <div style={{ textAlign: 'center', marginTop: '10px' }}>
                                <h1 style={{ fontWeight: 900, fontSize: '24px', color: '#0f172a', margin: 0 }}>{t('reports.bulletinScolaire')}</h1>
                                <h3 style={{ fontWeight: 900, color: '#4f46e5', fontSize: '15px', margin: '2px 0' }}>{termLabel.toUpperCase()}</h3>
                                <p style={{ fontSize: '11px', color: '#475569', margin: 0 }}>{t('reports.academicYearLabel')} : {academicYear}</p>
                            </div>

                            <div style={{ borderBottom: '1px solid #cbd5e1', margin: '10px 0' }}></div>

                            {/* Replicated 2x4 Identity Box Matrix */}
                            <div className="bulletin-id-box">
                                {/* Row 1 */}
                                <div className="id-box-row">
                                    <span className="id-box-label">{t('reports.student')} :</span>
                                    <span className="id-box-val" style={{ fontSize: '14px' }}>
                                        {report.studentName} {report.enrollmentStatus === 'transferred' && (isAr ? ' (مؤرشف)' : ' (Archivé)')}
                                    </span>
                                </div>
                                <div className="id-box-row">
                                    <span className="id-box-label">{t('reports.selectClass')} :</span>
                                    <span className="id-box-val">{selectedClassName}</span>
                                </div>
                                
                                {/* Row 2 */}
                                <div className="id-box-row">
                                    <span className="id-box-label">{isAr ? 'الرقم الوطني' : 'NNI'} :</span>
                                    <span className="id-box-val">{report.studentNNI || '—'}</span>
                                </div>
                                <div className="id-box-row">
                                    <span className="id-box-label">{t('reports.classAvg')} :</span>
                                    <span className="id-box-val">{classAvg !== null ? `${classAvg.toFixed(2)} / 20` : '— / 20'}</span>
                                </div>
                                
                                {/* Row 3 */}
                                <div className="id-box-row">
                                    <span className="id-box-label">{t('reports.generalAvg')} :</span>
                                    <span className="id-box-val" style={{ color: '#4f46e5', fontSize: '14px' }}>
                                        {report.generalAverage !== null ? `${report.generalAverage.toFixed(2)} / 20` : '— / 20'}
                                    </span>
                                </div>
                                <div className="id-box-row">
                                    <span className="id-box-label">{t('reports.rank')} :</span>
                                    <span className="id-box-val" style={{ color: '#4f46e5' }}>
                                        {rank !== null ? (isAr ? `الـ ${rank}` : `${rank}${rank === 1 ? 'er' : 'e'}`) : '—'}
                                    </span>
                                </div>
                                
                                {/* Row 4 */}
                                <div className="id-box-row" style={{ border: 'none' }}>
                                    <span className="id-box-label">{isAr ? 'القرار' : 'Décision'} :</span>
                                    <span className="id-box-val" style={{ color: report.generalAverage && report.generalAverage >= 10 ? '#059669' : '#dc2626' }}>
                                        {report.generalAverage !== null ? (report.generalAverage >= 10 ? (isAr ? 'ناجح(ة)' : 'Admis(e)') : (isAr ? 'مؤجل(ة)' : 'Ajourné(e)')) : '—'}
                                    </span>
                                </div>
                                <div className="id-box-row" style={{ border: 'none' }}>
                                    <span className="id-box-label">{isAr ? 'التقدير' : 'Mention'} :</span>
                                    <span className="id-box-val">{observation || '—'}</span>
                                </div>
                            </div>

                            {/* Exact Table Reproduction */}
                            <table className="bulletin-table">
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: isAr ? 'right' : 'left' }}>{t('reports.subjectsHeader')}</th>
                                        <th style={{ width: '70px' }}>{t('reports.coeffHeader')}</th>
                                        <th style={{ width: '90px' }}>{t('reports.moyenneHeader')}</th>
                                        <th>{t('reports.apprMatiereHeader')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.subjects.map((subj, sIndex) => {
                                        let subjObs = ''
                                        if (subj.average !== null) {
                                            if (subj.average >= 16) subjObs = t('reports.obsExcellent')
                                            else if (subj.average >= 14) subjObs = t('reports.obsTresBien')
                                            else if (subj.average >= 12) subjObs = t('reports.obsBien')
                                            else if (subj.average >= 10) subjObs = t('reports.obsSatisfaisant')
                                            else subjObs = t('reports.obsRedoubler')
                                        }
                                        return (
                                            <tr key={subj.subjectId} className={sIndex % 2 !== 0 ? "table-row-alt" : ""}>
                                                <td style={{ textAlign: isAr ? 'right' : 'left', fontWeight: 900 }}>{subj.subjectName}</td>
                                                <td>{subj.coefficient}</td>
                                                <td style={{ fontWeight: 900 }}>{subj.average !== null ? subj.average.toFixed(2) : '—'}</td>
                                                <td style={{ color: '#4b5563', fontSize: '11px' }}>{subjObs}</td>
                                            </tr>
                                        )
                                    })}
                                    {/* Table Total Footer Line */}
                                    <tr className="table-footer-row">
                                        <td style={{ textAlign: isAr ? 'right' : 'left' }}>{t('reports.generalAvg')}</td>
                                        <td>{report.subjects.reduce((a, b) => a + b.coefficient, 0)}</td>
                                        <td>{report.generalAverage !== null ? `${report.generalAverage.toFixed(2)} / 20` : '—'}</td>
                                        <td style={{ color: '#4f46e5' }}>
                                            {report.generalAverage !== null && report.generalAverage >= 14 ? (isAr ? 'لوحة الشرف' : "Tableau d'Honneur") :
                                             report.generalAverage !== null && report.generalAverage >= 12 ? (isAr ? 'تشجيعات' : "Encouragements") : "—"}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Extra Info section */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '20px' }}>
                                {/* Behavior & Attendance */}
                                <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '15px' }}>
                                    <h4 style={{ margin: '0 0 10px 0', fontSize: '11px', fontWeight: 900, color: '#334155', borderBottom: '1px solid #cbd5e1', paddingBottom: '5px' }}>
                                        {t('reports.assiduiteTitle')}
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#64748b' }}>{t('reports.conducteLabel')} :</span>
                                            <span style={{ fontWeight: 900 }}>{conductStr}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#64748b' }}>{t('reports.presencesLabel')} :</span>
                                            <span>{(att ? (att.present + att.late) : (ext?.attendanceDays ?? 0)) || 0}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#64748b' }}>{t('reports.absencesLabel')} :</span>
                                            <span style={{ color: '#dc2626', fontWeight: 700 }}>{(att ? att.absent : (ext?.absenceDays ?? 0)) || 0}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Council Comment */}
                                <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '15px', background: '#f8fafc' }}>
                                    <h4 style={{ margin: '0 0 10px 0', fontSize: '11px', fontWeight: 900, color: '#334155', borderBottom: '1px solid #cbd5e1', paddingBottom: '5px' }}>
                                        {t('reports.appreciationConseilTitle')}
                                    </h4>
                                    <p style={{ fontSize: '12px', fontStyle: 'italic', color: '#475569', minHeight: '50px', margin: 0 }}>
                                        {comment || t('reports.noAppreciationMsg')}
                                    </p>
                                </div>
                            </div>

                            {/* Center Red Directorate Stamp */}
                            <div className="director-stamp">
                                <div style={{ fontWeight: 900, fontSize: '12px', marginBottom: '5px' }}>{t('reports.directeurTitle')}</div>
                                <div className="stamp-box">
                                    {t('reports.ecoleLabel')}<br />
                                    {t('reports.direction')}<br />
                                    {t('reports.archivage')}
                                </div>
                                <div className="script-signature">Directeur</div>
                                <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, marginTop: '10px' }}>{t('reports.sceauLabel')}</div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </>
    )
}
