'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Search, FileText, RotateCcw, Loader2, Calendar, CreditCard, Phone } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { createClient } from '@/utils/supabase/client'
import { useLanguage } from '@/i18n'
import { reintegrateExternalStudent } from '@/app/admin/students/actions'
import { getMySchoolContext } from '@/app/admin/actions'
import { generateTransferPDF } from '@/utils/pdf-generator'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface TransferredStudent {
    id: string
    name: string
    className: string
    academicYear: string
    gender: string | null
    nationalId: string | null
    phone: string | null
    dateOfBirth: string | null
    placeOfBirth: string | null
    initials: string
}

export default function TransferredStudentsPage() {
    const { t, language } = useLanguage()
    const isRtl = language === 'ar'

    const [students, setStudents] = useState<TransferredStudent[]>([])
    const [schoolName, setSchoolName] = useState("Établissement Qalami")
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [revertingId, setRevertingId] = useState<string | null>(null)

    const fetchTransferredStudents = async () => {
        setLoading(true)
        try {
            const ctx = await getMySchoolContext()
            if (!ctx) { setLoading(false); return }
            
            const supabase = createClient()

            // Fetch school name
            const { data: school } = await supabase
                .from('schools')
                .select('name')
                .eq('id', ctx.school_id)
                .single()
            if (school?.name) setSchoolName(school.name)

            // Fetch enrollments with status = 'transferred'
            const { data: enrollments } = await supabase
                .from('enrollments')
                .select('student_id, class_id, academic_year_id, academic_years(name), classes(name)')
                .eq('school_id', ctx.school_id)
                .eq('status', 'transferred')
                .order('created_at', { ascending: false })

            if (!enrollments || enrollments.length === 0) {
                setStudents([])
                setLoading(false)
                return
            }

            const studentIds = [...new Set(enrollments.map(e => e.student_id))]

            // Fetch student profiles
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, gender, national_id, phone, date_of_birth, place_of_birth')
                .in('id', studentIds)

            if (!profiles) {
                setStudents([])
                setLoading(false)
                return
            }

            const enrollMap = new Map<string, any>()
            enrollments.forEach(e => {
                if (!enrollMap.has(e.student_id)) enrollMap.set(e.student_id, e)
            })

            const result: TransferredStudent[] = profiles.map(p => {
                const enroll = enrollMap.get(p.id)
                const parts = (p.full_name || 'Élève').split(' ')
                return {
                    id: p.id,
                    name: p.full_name || 'Élève',
                    className: enroll?.classes?.name || t('admin.students.transferredPage.sansClasse'),
                    academicYear: enroll?.academic_years?.name || '—',
                    gender: p.gender || null,
                    nationalId: p.national_id || null,
                    phone: p.phone || null,
                    dateOfBirth: p.date_of_birth || null,
                    placeOfBirth: p.place_of_birth || null,
                    initials: (parts.length >= 2
                        ? `${parts[0][0]}${parts[1][0]}`
                        : parts[0].slice(0, 2)
                    ).toUpperCase(),
                }
            })

            setStudents(result)
        } catch (err) {
            console.error(err)
            toast.error(t('admin.students.transferredPage.loadError'))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchTransferredStudents()
    }, [])

    const handleReintegrate = async (studentId: string, studentName: string) => {
        if (!confirm(t('admin.students.transferredPage.reintegrateConfirm').replace('{name}', studentName))) return
        setRevertingId(studentId)
        try {
            const res = await reintegrateExternalStudent(studentId)
            if (res.error) {
                toast.error(res.error)
            } else {
                toast.success(t('admin.students.transferredPage.reintegrateSuccess').replace('{name}', studentName))
                fetchTransferredStudents()
            }
        } catch (err: any) {
            toast.error(err.message || t('admin.students.transferredPage.reintegrateError'))
        } finally {
            setRevertingId(null)
        }
    }

    const handleDownloadCertificate = (s: TransferredStudent) => {
        const birthDateFormatted = s.dateOfBirth
            ? new Date(s.dateOfBirth).toLocaleDateString('fr-FR')
            : '—'
        generateTransferPDF({
            schoolName,
            studentName: s.name,
            birthDate: birthDateFormatted,
            birthPlace: s.placeOfBirth || '',
            nni: s.nationalId || '',
            className: s.className,
            academicYear: s.academicYear,
            transferDate: new Date().toLocaleDateString('fr-FR')
        })
    }

    const filteredStudents = useMemo(() => {
        return students.filter(s => {
            if (!searchTerm) return true
            const q = searchTerm.toLowerCase()
            return s.name.toLowerCase().includes(q) || 
                   s.className.toLowerCase().includes(q) || 
                   (s.nationalId ? s.nationalId.toLowerCase().includes(q) : false)
        })
    }, [students, searchTerm])

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto h-[calc(100vh-80px)] flex flex-col space-y-4 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Link href="/admin/students" className="p-2 rounded-xl bg-[#161B22] border border-white/5 text-gray-400 hover:text-white transition-colors shrink-0">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-xl font-bold text-white">{t('admin.students.transferredPage.title')}</h1>
                    <p className="text-xs text-gray-500">{t('admin.students.transferredPage.subtitle')}</p>
                </div>
            </div>

            {/* Toolbar */}
            <div className="relative">
                <Search className={cn("absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none", isRtl ? "right-3" : "left-3")} />
                <Input
                    dir={isRtl ? 'rtl' : 'ltr'}
                    placeholder={t('admin.students.transferredPage.searchPlaceholder')}
                    className={cn(
                        "bg-[#161B22] border-white/5 text-gray-300 focus:border-emerald-500/50 h-10 rounded-xl placeholder:text-gray-600 text-sm",
                        isRtl ? "text-right pr-10 pl-8" : "pl-10 pr-8"
                    )}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Content list */}
            <div className="flex-1 overflow-y-auto pb-6">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                    </div>
                ) : filteredStudents.length === 0 ? (
                    <div className="text-center py-20 text-gray-500 text-sm bg-[#161B22] border border-white/5 rounded-2xl">
                        {t('admin.students.transferredPage.noStudents')}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredStudents.map(s => (
                            <div key={s.id} className="bg-[#161B22] border border-white/5 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-white/10 transition-all">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-12 w-12 border-2 border-white/5 shadow-md">
                                            <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${s.name}`} />
                                            <AvatarFallback className="bg-gray-700 text-white font-bold text-sm">{s.initials}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <Link href={`/admin/students/${s.id}`} className="font-bold text-white hover:text-emerald-400 transition-colors block text-sm">
                                                {s.name}
                                            </Link>
                                            <span className="inline-block mt-1 text-[10px] font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                                                {t('admin.students.transferredPage.classLabel').replace('{className}', s.className)}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-orange-400 font-bold bg-orange-500/10 border border-orange-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                        {t('admin.students.transferredPage.statusLabel')}
                                    </span>
                                </div>

                                <div className="space-y-1.5 text-xs text-gray-400 border-t border-white/5 pt-3">
                                    {s.dateOfBirth && (
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                                            <span>
                                                {t('admin.students.transferredPage.bornOn').replace('{date}', new Date(s.dateOfBirth).toLocaleDateString(language === 'ar' ? 'ar-MR' : 'fr-FR'))}
                                                {s.placeOfBirth ? t('admin.students.transferredPage.bornAt').replace('{place}', s.placeOfBirth) : ''}
                                            </span>
                                        </div>
                                    )}
                                    {s.nationalId && (
                                        <div className="flex items-center gap-2">
                                            <CreditCard className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                                            <span>{t('admin.students.transferredPage.nniLabel')} <span className="font-mono text-gray-300">{s.nationalId}</span></span>
                                        </div>
                                    )}
                                    {s.phone && (
                                        <div className="flex items-center gap-2" dir="ltr">
                                            <Phone className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                                            <span className="font-mono text-gray-300">{s.phone}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2 pt-2 border-t border-white/5">
                                    <Button
                                        onClick={() => handleDownloadCertificate(s)}
                                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs h-9 rounded-xl flex items-center justify-center gap-1.5"
                                    >
                                        <FileText className="w-4 h-4" />
                                        {t('admin.students.transferredPage.certificateButton')}
                                    </Button>
                                    <Button
                                        onClick={() => handleReintegrate(s.id, s.name)}
                                        variant="outline"
                                        className="flex-1 border-white/10 bg-[#1A2530] text-gray-300 hover:text-white text-xs h-9 rounded-xl flex items-center justify-center gap-1.5"
                                        disabled={revertingId !== null}
                                    >
                                        {revertingId === s.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <RotateCcw className="w-4 h-4" />
                                        )}
                                        {t('admin.students.transferredPage.reintegrateButton')}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
