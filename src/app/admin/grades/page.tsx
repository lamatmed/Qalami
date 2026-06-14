'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSchoolContext } from '@/lib/use-school-context'
import { useLanguage } from '@/i18n'
import { motion } from 'framer-motion'
import { BookOpen, Search, Filter, Loader2, GraduationCap, FileText, Calendar, Hash } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GradeRecord {
    id: string
    value: number
    max_value: number
    coefficient: number
    assessment_type: string
    created_at: string
    student_id: string
    student_name: string
    student_nni: string
    subject_id: string
    subject_name: string
    term_id: string | null
    term_name: string
    class_id: string | null
    class_name: string
}

export default function AdminGradesPage() {
    const { context, loading: ctxLoading } = useSchoolContext()
    const { t } = useLanguage()
    const supabase = createClient()

    const [grades, setGrades] = useState<GradeRecord[]>([])
    const [loading, setLoading] = useState(true)

    // Filter options
    const [classes, setClasses] = useState<{id: string, name: string}[]>([])
    const [subjects, setSubjects] = useState<{id: string, name: string}[]>([])
    const [terms, setTerms] = useState<{id: string, name: string}[]>([])

    // Active filters
    const [search, setSearch] = useState('')
    const [selClass, setSelClass] = useState<string>('all')
    const [selSubject, setSelSubject] = useState<string>('all')
    const [selTerm, setSelTerm] = useState<string>('all')
    const [selType, setSelType] = useState<string>('all') // 'all', 'devoir', 'examen'

    const fetchAllData = useCallback(async () => {
        if (!context) return
        setLoading(true)
        const sid = context.school_id

        try {
            // 1. Fetch reference data
            const [
                { data: clsData },
                { data: subData },
                { data: termData },
                { data: enrData },
            ] = await Promise.all([
                supabase.from('classes').select('id, name').eq('school_id', sid).order('name'),
                supabase.from('subjects').select('id, name').eq('school_id', sid).order('name'),
                supabase.from('terms').select('id, name').eq('school_id', sid).order('created_at', { ascending: false }),
                supabase.from('enrollments').select('student_id, class_id, classes(name)').eq('school_id', sid).eq('status', 'active'),
            ])

            setClasses(clsData || [])
            setSubjects(subData || [])
            setTerms(termData || [])

            const studentClassMap: Record<string, { id: string, name: string }> = {}
            ;(enrData || []).forEach((e: any) => {
                if (e.student_id && e.class_id && e.classes?.name) {
                    studentClassMap[e.student_id] = { id: e.class_id, name: e.classes.name }
                }
            })

            // 2. Get all student IDs enrolled in this school
            const { data: allStudents } = await supabase
                .from('profiles')
                .select('id')
                .eq('school_id', sid)
                .eq('role', 'student')

            const allStudentIds = (allStudents || []).map((s: any) => s.id)
            if (allStudentIds.length === 0) {
                setGrades([])
                setLoading(false)
                return
            }

            // 3. Fetch grades using correct schema columns and filtering by school
            const { data: gradesRaw, error } = await supabase
                .from('grades')
                .select('id, value, max_value, assessment_type, coefficient, term_id, subject_id, student_id, created_at, terms!inner(school_id)')
                .in('student_id', allStudentIds)
                .eq('terms.school_id', sid)
                .order('created_at', { ascending: false })
                .limit(2000)

            if (error) {
                console.error("Error fetching grades:", error.message, error.details, error.hint)
                setLoading(false)
                return
            }

            // Build subject map
            const subjectMap: Record<string, string> = {}
            ;(subData || []).forEach((s: any) => { subjectMap[s.id] = s.name })

            // Build term map
            const termMap: Record<string, string> = {}
            ;(termData || []).forEach((t: any) => { termMap[t.id] = t.name })

            // Fetch student profiles in bulk
            const studentIds = [...new Set((gradesRaw || []).map((g: any) => g.student_id))]
            const profileMap: Record<string, { name: string; nni: string }> = {}
            if (studentIds.length > 0) {
                const { data: profilesData } = await supabase
                    .from('profiles')
                    .select('id, full_name, national_id')
                    .in('id', studentIds)
                ;(profilesData || []).forEach((p: any) => {
                    profileMap[p.id] = { name: p.full_name || 'Inconnu', nni: p.national_id || '' }
                })
            }

            const formattedGrades: GradeRecord[] = (gradesRaw || []).map((g: any) => {
                const sCls = studentClassMap[g.student_id]
                const prof = profileMap[g.student_id]
                return {
                    id: g.id,
                    value: g.value ?? 0,
                    max_value: g.max_value ?? 20,
                    coefficient: g.coefficient ?? 1,
                    assessment_type: g.assessment_type || 'Évaluation',
                    created_at: g.created_at,
                    student_id: g.student_id,
                    student_name: prof?.name || 'Inconnu',
                    student_nni: prof?.nni || '',
                    subject_id: g.subject_id,
                    subject_name: subjectMap[g.subject_id] || '—',
                    term_id: g.term_id,
                    term_name: g.term_id ? (termMap[g.term_id] || '—') : '—',
                    class_id: sCls?.id || null,
                    class_name: sCls?.name || 'Non assigné'
                }
            })

            setGrades(formattedGrades)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [context])

    useEffect(() => {
        fetchAllData()
    }, [fetchAllData])

    // Filtering logic
    const filteredGrades = useMemo(() => {
        return grades.filter(g => {
            if (selClass !== 'all' && g.class_id !== selClass) return false
            if (selSubject !== 'all' && g.subject_id !== selSubject) return false
            if (selTerm !== 'all' && g.term_id !== selTerm) return false
            
            if (selType === 'devoir' && !g.assessment_type.toLowerCase().includes('devoir')) return false
            if (selType === 'examen' && !g.assessment_type.toLowerCase().includes('examen')) return false

            if (search.trim() !== '') {
                const q = search.toLowerCase().trim()
                const nameMatch = g.student_name.toLowerCase().includes(q)
                const nniMatch = g.student_nni && g.student_nni.toLowerCase().includes(q)
                if (!nameMatch && !nniMatch) return false
            }

            return true
        })
    }, [grades, selClass, selSubject, selTerm, selType, search])


    if (ctxLoading) {
        return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
    }

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto pb-24">
            
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-500/15 flex items-center justify-center">
                        <BookOpen className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white">{t('admin.gradesPage.title')}</h1>
                        <p className="text-xs text-gray-400">{t('admin.gradesPage.subtitle')}</p>
                    </div>
                </div>
                <div className="text-xs font-bold px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-300">
                    {filteredGrades.length} {filteredGrades.length <= 1 ? t('admin.gradesPage.results').replace('{count}', '') : t('admin.gradesPage.resultsPlural').replace('{count}', '')}
                </div>
            </motion.div>

            {/* Filters Bar */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} 
                className="bg-[#1A2530] border border-white/10 rounded-2xl p-4 flex flex-col xl:flex-row gap-4">
                
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input 
                        value={search} 
                        onChange={e => setSearch(e.target.value)} 
                        placeholder={t('admin.gradesPage.searchPlaceholder')}
                        className="w-full pl-9 pr-4 h-10 bg-[#0D1117] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors" 
                    />
                </div>

                {/* Dropdowns */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-[#0D1117] border border-white/10 rounded-xl px-3 h-10">
                        <GraduationCap className="w-3.5 h-3.5 text-gray-400" />
                        <select value={selClass} onChange={e => setSelClass(e.target.value)} className="bg-transparent text-sm text-white focus:outline-none min-w-[120px] cursor-pointer">
                            <option value="all" className="bg-[#1A2530]">{t('admin.gradesPage.allClasses')}</option>
                            {classes.map(c => <option key={c.id} value={c.id} className="bg-[#1A2530]">{c.name}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-[#0D1117] border border-white/10 rounded-xl px-3 h-10">
                        <FileText className="w-3.5 h-3.5 text-gray-400" />
                        <select value={selSubject} onChange={e => setSelSubject(e.target.value)} className="bg-transparent text-sm text-white focus:outline-none min-w-[120px] cursor-pointer">
                            <option value="all" className="bg-[#1A2530]">{t('admin.gradesPage.allSubjects')}</option>
                            {subjects.map(s => <option key={s.id} value={s.id} className="bg-[#1A2530]">{s.name}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-[#0D1117] border border-white/10 rounded-xl px-3 h-10">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <select value={selTerm} onChange={e => setSelTerm(e.target.value)} className="bg-transparent text-sm text-white focus:outline-none min-w-[120px] cursor-pointer">
                            <option value="all" className="bg-[#1A2530]">{t('admin.gradesPage.allTerms')}</option>
                            {terms.map(term => <option key={term.id} value={term.id} className="bg-[#1A2530]">{term.name}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-[#0D1117] border border-white/10 rounded-xl px-3 h-10">
                        <Filter className="w-3.5 h-3.5 text-gray-400" />
                        <select value={selType} onChange={e => setSelType(e.target.value)} className="bg-transparent text-sm text-white focus:outline-none min-w-[120px] cursor-pointer">
                            <option value="all" className="bg-[#1A2530]">{t('admin.gradesPage.allTypes')}</option>
                            <option value="devoir" className="bg-[#1A2530]">{t('admin.gradesPage.devoirsOnly')}</option>
                            <option value="examen" className="bg-[#1A2530]">{t('admin.gradesPage.examensOnly')}</option>
                        </select>
                    </div>
                </div>
            </motion.div>

            {/* Data Table */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="bg-[#1A2530] rounded-2xl border border-white/10 overflow-hidden">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                        <p className="text-sm text-gray-400 font-medium">{t('admin.gradesPage.loading')}</p>
                    </div>
                ) : filteredGrades.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center mb-4 border border-white/10">
                            <BookOpen className="w-6 h-6 text-gray-500" />
                        </div>
                        <p className="text-base font-bold text-white mb-1">{t('admin.gradesPage.noGrades')}</p>
                        <p className="text-sm text-gray-500 max-w-sm">{t('admin.gradesPage.noGradesHint')}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/10 bg-white/5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                    <th className="p-4 rounded-tl-2xl">{t('admin.gradesPage.colStudent')}</th>
                                    <th className="p-4">{t('admin.gradesPage.colClass')}</th>
                                    <th className="p-4">{t('admin.gradesPage.colSubject')}</th>
                                    <th className="p-4">{t('admin.gradesPage.colEvaluation')}</th>
                                    <th className="p-4">{t('admin.gradesPage.colGrade')}</th>
                                    <th className="p-4">{t('admin.gradesPage.colDate')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredGrades.map((g) => {
                                    const pct = Math.round((g.value / g.max_value) * 100)
                                    const colorCls = pct >= 50 ? 'text-emerald-400' : 'text-red-400'
                                    const _d = new Date(g.created_at)
                                    const dateStr = _d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Nouakchott' }) + ' ' + _d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nouakchott' })
                                    
                                    return (
                                        <tr key={g.id} className="hover:bg-white/5 transition-colors group">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                                                        {g.student_name.substring(0,2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-white">{g.student_name}</p>
                                                        {g.student_nni && (
                                                            <p className="text-[10px] text-gray-500 font-mono mt-0.5 flex items-center gap-1">
                                                                <Hash className="w-3 h-3" /> {g.student_nni}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-white/5 text-gray-300 border border-white/10">
                                                    {g.class_name === 'Non assigné' ? t('admin.gradesPage.notAssigned') : g.class_name}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <p className="text-sm text-gray-300 font-medium">{g.subject_name}</p>
                                            </td>
                                            <td className="p-4">
                                                <div>
                                                    <p className="text-sm text-gray-200 font-semibold">{g.assessment_type}</p>
                                                    <p className="text-[10px] text-gray-500 mt-0.5">{g.term_name} • Coef. {g.coefficient}</p>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className={cn('text-sm font-black', colorCls)}>
                                                    {g.value}/{g.max_value}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className="text-xs text-gray-500">{dateStr}</span>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </motion.div>
        </div>
    )
}
