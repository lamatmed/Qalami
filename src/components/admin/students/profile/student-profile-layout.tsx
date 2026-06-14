'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Calendar, User, Phone, CreditCard, Home, ShieldAlert, Loader2, KeyRound, ArrowLeftRight, RotateCcw, Pencil, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { StudentDocuments } from './student-documents'
import { StudentHistory } from './student-history'
import { StudentGrades } from './student-grades'
import { StudentPayments } from './student-payments'
import { StudentRemarks } from './student-remarks'
import { StudentAttendance } from './student-attendance'
import { StudentSchedule } from './student-schedule'
import { StatusBadge } from '@/components/admin/shared/status-badge'
import { ChangeStatusDialog } from '@/components/admin/shared/change-status-dialog'
import { ChangePasswordDialog } from '@/components/admin/shared/change-password-dialog'
import { ChangeEnrollmentStatus } from '@/components/admin/students/change-enrollment-status'
import { AssignClassDialog } from '@/components/admin/students/assign-class-dialog'
import { AssignParentsDialog } from '@/components/admin/students/assign-parents-dialog'
import { TransferStudentDialog } from '@/components/admin/students/transfer-student-dialog'
import { EditStudentDialog } from '@/components/admin/students/edit-student-dialog'
import { revertStudentTransfer, deleteStudentPermanently, reintegrateExternalStudent } from '@/app/admin/students/actions'
import { updateProfileStatus } from '@/app/auth/actions'
import { createClient } from '@/utils/supabase/client'
import { generateTransferPDF } from '@/utils/pdf-generator'
import { useLanguage } from '@/i18n'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'

interface ParentInfo {
    id: string
    full_name: string
    phone: string | null
}

interface StudentProfile {
    school_id: string | null
    full_name: string
    phone: string | null
    status: string
    date_of_birth: string | null
    gender: string | null
    place_of_birth: string | null
    national_id: string | null
    address: string | null
    avatar_url: string | null
    className: string
    enrollmentId: string | null
    enrollmentStatus: string | null
    academicYear: string | null
    enrollmentDate: string | null
    parents: ParentInfo[]
}


export function StudentProfileLayout({ id }: { id: string }) {
    const { t, language } = useLanguage()
    const router = useRouter()
    const searchParams = useSearchParams()
    const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'attendance')
    const [student, setStudent] = useState<StudentProfile | null>(null)
    const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [statusDialogOpen, setStatusDialogOpen] = useState(false)
    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
    const [enrollmentDialogOpen, setEnrollmentDialogOpen] = useState(false)
    const [assignClassOpen, setAssignClassOpen] = useState(false)
    const [assignParentsOpen, setAssignParentsOpen] = useState(false)
    const [transferDialogOpen, setTransferDialogOpen] = useState(false)
    const [editStudentOpen, setEditStudentOpen] = useState(false)
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [reverting, setReverting] = useState(false)
    const [schoolName, setSchoolName] = useState("Établissement Qalami")
    const tabs = [
        { id: 'grades', label: t('admin.students.profile.gradesTabLabel') },
        { id: 'attendance', label: t('common.attendance') },
        { id: 'schedule', label: t('common.schedule') },
        { id: 'payments', label: t('parent.finances.title') },
        { id: 'remarks', label: t('admin.students.profile.remarks') },
        { id: 'documents', label: t('common.documents') },
        { id: 'history', label: t('admin.students.profile.history') },
    ]

    useEffect(() => {
        async function fetchStudent() {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setLoading(false); return }

            const { data: adminProfile } = await supabase
                .from('profiles')
                .select('school_id')
                .eq('id', user.id)
                .single()

            const activeSchoolId = adminProfile?.school_id
            if (!activeSchoolId) { setLoading(false); return }
            setCurrentSchoolId(activeSchoolId)

            const { data: school } = await supabase
                .from('schools')
                .select('name')
                .eq('id', activeSchoolId)
                .single()
            if (school?.name) setSchoolName(school.name)

            const { data: profile } = await supabase
                .from('profiles')
                .select(`
                    school_id,
                    full_name,
                    phone,
                    status,
                    date_of_birth,
                    gender,
                    place_of_birth,
                    national_id,
                    address,
                    avatar_url,
                    enrollments (
                        id,
                        status,
                        academic_year_id,
                        school_id,
                        created_at,
                        academic_years ( name ),
                        classes ( name )
                    ),
                    parent_student_links!parent_student_links_student_id_fkey (
                        profiles!parent_student_links_parent_id_fkey (
                            id,
                            full_name,
                            phone
                        )
                    )
                `)
                .eq('id', id)
                .single()

            if (profile) {
                const rawEnrollments = profile.enrollments as any[] || []
                const enrollments = rawEnrollments.filter(e => e.school_id === activeSchoolId)
                const links = profile.parent_student_links as any[]
                const parents: ParentInfo[] = (links || [])
                    .map(link => link.profiles)
                    .filter(Boolean)
                    .map((p: any) => ({
                        id: p.id,
                        full_name: p.full_name,
                        phone: p.phone,
                    }))

                const firstEnrollment = enrollments?.[0]
                setStudent({
                    school_id: profile.school_id,
                    full_name: profile.full_name || t('common.student'),
                    phone: (profile as any).phone || null,
                    status: (profile as any).status || 'active',
                    date_of_birth: (profile as any).date_of_birth || null,
                    gender: (profile as any).gender || null,
                    place_of_birth: (profile as any).place_of_birth || null,
                    national_id: (profile as any).national_id || null,
                    address: (profile as any).address || null,
                    avatar_url: profile.avatar_url || null,
                    className: firstEnrollment?.classes?.name || '',
                    enrollmentId: firstEnrollment?.id || null,
                    enrollmentStatus: firstEnrollment?.status || null,
                    academicYear: (firstEnrollment?.academic_years as any)?.name || null,
                    enrollmentDate: firstEnrollment?.created_at || null,
                    parents,
                })
            }
            setLoading(false)
        }
        fetchStudent()
    }, [id])

    const handleRevertTransfer = async () => {
        if (!confirm(t('admin.students.transferDialog.revertConfirmMessage'))) return
        setReverting(true)
        const result = await revertStudentTransfer(id)
        setReverting(false)
        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success(t('admin.students.transferDialog.revertSuccessMessage'))
            window.location.reload()
        }
    }

    const handleUnarchive = async () => {
        if (!confirm(t('admin.students.transferDialog.unarchiveConfirmMessage') || 'Voulez-vous désarchiver cet élève et le réactiver ?')) return
        setReverting(true)
        const result = await updateProfileStatus({
            userId: id,
            status: 'active',
            reason: 'Annulation de l\'archivage',
        })
        setReverting(false)
        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success(t('admin.students.transferDialog.unarchiveSuccessMessage') || 'L\'élève a été désarchivé avec succès.')
            window.location.reload()
        }
    }

    const handleReintegrateExternal = async () => {
        if (!confirm("Voulez-vous réintégrer cet élève ? Son statut repassera à Actif et il rejoindra sa classe.")) return
        setReverting(true)
        const result = await reintegrateExternalStudent(id)
        setReverting(false)
        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success("L'élève a été réintégré avec succès.")
            window.location.reload()
        }
    }

    const handleDownloadCertificate = () => {
        if (!student) return
        const birthDateFormatted = student.date_of_birth
            ? new Date(student.date_of_birth).toLocaleDateString('fr-FR')
            : '—'
        generateTransferPDF({
            schoolName,
            studentName: student.full_name,
            birthDate: birthDateFormatted,
            birthPlace: student.place_of_birth || '',
            nni: student.national_id || '',
            className: student.className || 'Non affecté',
            academicYear: student.academicYear || '2025-2026',
            transferDate: new Date().toLocaleDateString('fr-FR')
        })
    }

    const handleDeleteStudent = async () => {
        setDeleting(true)
        const result = await deleteStudentPermanently(id)
        setDeleting(false)
        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success(t('admin.students.profile.deleteStudentSuccess'))
            router.push('/admin/students')
        }
    }

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '—'
        return new Date(dateStr).toLocaleDateString(language === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }

    const genderLabel = (g: string | null) => {
        if (g === 'male') return t('common.male')
        if (g === 'female') return t('common.female')
        return '—'
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
        )
    }

    const initials = student?.full_name
        ? student.full_name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
        : 'EL'

    const isArchived = student && currentSchoolId ? (student.school_id !== currentSchoolId) : false

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full max-w-[1600px] mx-auto">
            {student?.enrollmentStatus === 'transferred' && !isArchived && (
                <div className="lg:col-span-3 bg-amber-500/10 border border-amber-500/20 rounded-3xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in slide-in-from-top duration-500">
                    <div className="flex items-center gap-3">
                        <ArrowLeftRight className="w-6 h-6 text-amber-500 shrink-0" />
                        <div>
                            <p className="text-sm font-bold text-white">{t('admin.students.profile.transferredBanner.title')}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{t('admin.students.profile.transferredBanner.subtitle')}</p>
                        </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <Button
                            onClick={handleDownloadCertificate}
                            className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs h-9 rounded-xl"
                        >
                            {t('admin.students.profile.transferredBanner.downloadBtn')}
                        </Button>
                        <Button
                            onClick={handleReintegrateExternal}
                            variant="outline"
                            className="border-white/10 bg-[#161B22] text-gray-300 hover:text-white text-xs h-9 rounded-xl"
                            disabled={reverting}
                        >
                            {reverting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RotateCcw className="w-3.5 h-3.5 mr-1.5" />}
                            {t('admin.students.profile.transferredBanner.reintegrateBtn')}
                        </Button>
                    </div>
                </div>
            )}
            {/* Left Column */}
            <div className="lg:col-span-1 space-y-6 animate-in slide-in-from-left duration-500">
                {/* Main Profile Card */}
                <div className="bg-[#1A2530] rounded-3xl border border-white/5 p-6 relative overflow-hidden">
                    <div className="flex justify-between items-start mb-6 relative z-10">
                        <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-gray-400 hover:text-white -ml-2">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <h3 className="font-bold text-white mt-2">{t('admin.students.profile.studentFile')}</h3>
                        <div className="flex items-center gap-1 -mr-2">
                            {isArchived ? (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-gray-400 hover:text-emerald-400"
                                    title={t('admin.students.transferDialog.revertTransfer') || 'Annuler le transfert'}
                                    onClick={handleRevertTransfer}
                                    disabled={reverting}
                                >
                                    {reverting ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <RotateCcw className="w-5 h-5" />
                                    )}
                                </Button>
                            ) : (
                                <>
                                    {student?.status === 'archived' && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-gray-400 hover:text-emerald-400"
                                            title={t('admin.students.transferDialog.unarchive') || 'Désarchiver'}
                                            onClick={handleUnarchive}
                                            disabled={reverting}
                                        >
                                            {reverting ? (
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                            ) : (
                                                <RotateCcw className="w-5 h-5" />
                                            )}
                                        </Button>
                                    )}
                                    {student?.status === 'active' && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-gray-400 hover:text-emerald-400"
                                            title={t('admin.students.transferDialog.transfer') || 'Transférer'}
                                            onClick={() => setTransferDialogOpen(true)}
                                        >
                                            <ArrowLeftRight className="w-5 h-5" />
                                        </Button>
                                    )}
                                    {student?.phone && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-gray-400 hover:text-emerald-400"
                                            title={t('admin.users.changePassword') || 'Modifier le mot de passe'}
                                            onClick={() => setPasswordDialogOpen(true)}
                                        >
                                            <KeyRound className="w-5 h-5" />
                                        </Button>
                                    )}
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="text-gray-400 hover:text-orange-400"
                                        title={t('admin.students.changeStatus')}
                                        onClick={() => setStatusDialogOpen(true)}
                                    >
                                        <ShieldAlert className="w-5 h-5" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="text-gray-400 hover:text-blue-400"
                                        title="Modifier les informations"
                                        onClick={() => setEditStudentOpen(true)}
                                    >
                                        <Pencil className="w-5 h-5" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="text-gray-400 hover:text-red-500"
                                        title="Supprimer définitivement"
                                        onClick={() => setDeleteConfirmOpen(true)}
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col items-center text-center relative z-10 mb-6">
                        <Avatar className="h-28 w-28 border-4 border-[#0F1720] shadow-2xl mb-4">
                            <AvatarImage src={student?.avatar_url ?? `https://api.dicebear.com/7.x/initials/svg?seed=${student?.full_name}`} />
                            <AvatarFallback className="bg-gray-700 text-white text-2xl font-bold">{initials}</AvatarFallback>
                        </Avatar>
                        <h1 className="text-xl font-bold text-white">{student?.full_name}</h1>
                        <div className="mt-2">
                            <StatusBadge status={isArchived ? 'archived' : (student?.status ?? 'active')} />
                        </div>
                        {isArchived ? (
                            <div className="text-gray-400 text-sm mt-1 flex items-center gap-1.5">
                                {t('admin.students.class')} : <span className="font-medium text-white">{student?.className || t('admin.students.unassigned')}</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 mt-1">
                                <span className={cn(
                                    "text-sm font-medium",
                                    !student?.className ? "text-amber-400" : "text-white"
                                )}>{student?.className || t('admin.students.unassigned')}</span>
                                <button
                                    type="button"
                                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-emerald-400 transition-colors border border-white/10 hover:border-emerald-500/30 rounded-md px-2 py-0.5"
                                    onClick={() => setAssignClassOpen(true)}
                                >
                                    <Pencil className="w-3 h-3" /> {t('admin.students.profile.modifyClass')}
                                </button>
                            </div>
                        )}
                        {student?.academicYear && (
                            <div className="mt-2 flex items-center gap-2">
                                <span className="text-[10px] font-mono text-gray-500 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                                    {student.academicYear}
                                </span>
                                {student.enrollmentStatus && student.enrollmentStatus !== 'active' && (
                                    <span className="text-[10px] font-bold text-orange-400 uppercase">
                                        {student.enrollmentStatus}
                                    </span>
                                )}
                                {student.enrollmentId && !isArchived && (
                                    <button
                                        className="text-[10px] text-gray-500 hover:text-emerald-400 underline transition-colors"
                                        onClick={() => setEnrollmentDialogOpen(true)}
                                    >
                                        {t('common.status')}
                                    </button>
                                )}
                            </div>
                        )}
                        {student?.enrollmentDate && (
                            <div className="mt-1.5 flex items-center gap-1 text-[10px] text-gray-500">
                                <Calendar className="w-3 h-3 text-emerald-500/70 shrink-0" />
                                <span>
                                    {language === 'ar' ? 'تاريخ التسجيل:' : 'Inscrit le'}{' '}
                                    <span className="font-semibold text-gray-400">
                                        {new Date(student.enrollmentDate).toLocaleDateString(
                                            language === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR',
                                            { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Nouakchott' }
                                        )}
                                    </span>
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Navigation Tabs */}
                    <div className="relative z-10 flex justify-between border-b border-white/5 pb-1 gap-1 overflow-x-auto">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "text-xs font-bold pb-3 px-1 transition-all whitespace-nowrap",
                                    activeTab === tab.id ? "text-emerald-500 border-b-2 border-emerald-500" : "text-gray-500 hover:text-white"
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Personal Info Widget */}
                <div className="bg-[#1A2530] rounded-3xl border border-white/5 p-6 space-y-3">
                    <h4 className="text-sm font-bold text-white mb-4">{t('admin.students.profile.personalInfo')}</h4>

                    <div className="bg-[#0F1720] p-3 rounded-xl flex items-center gap-4 border border-white/5">
                        <div className="h-10 w-10 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-500 shrink-0">
                            <Calendar className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] text-gray-500 uppercase font-bold">{t('admin.students.profile.birthDatePlace')}</p>
                            <p className="text-sm text-white font-medium truncate">
                                {formatDate(student?.date_of_birth ?? null)}
                                {student?.place_of_birth ? ` — ${student.place_of_birth}` : ''}
                            </p>
                        </div>
                    </div>

                    <div className="bg-[#0F1720] p-3 rounded-xl flex items-center gap-4 border border-white/5">
                        <div className="h-10 w-10 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400 shrink-0">
                            <User className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase font-bold">{t('admin.students.register.personal.gender')}</p>
                            <p className="text-sm text-white font-medium">{genderLabel(student?.gender ?? null)}</p>
                        </div>
                    </div>

                    {student?.phone && (
                        <div className="bg-[#0F1720] p-3 rounded-xl flex items-center gap-4 border border-white/5">
                            <div className="h-10 w-10 bg-cyan-500/10 rounded-lg flex items-center justify-center text-cyan-400 shrink-0">
                                <Phone className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase font-bold">{t('admin.students.register.personal.phone') || 'Téléphone'}</p>
                                <p className="text-sm text-white font-mono">{student.phone}</p>
                            </div>
                        </div>
                    )}

                    {student?.national_id && (
                        <div className="bg-[#0F1720] p-3 rounded-xl flex items-center gap-4 border border-white/5">
                            <div className="h-10 w-10 bg-purple-500/10 rounded-lg flex items-center justify-center text-purple-400 shrink-0">
                                <CreditCard className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase font-bold">NNI</p>
                                <p className="text-sm text-white font-mono">{student.national_id}</p>
                            </div>
                        </div>
                    )}

                    {student?.address && (
                        <div className="bg-[#0F1720] p-3 rounded-xl flex items-center gap-4 border border-white/5">
                            <div className="h-10 w-10 bg-amber-500/10 rounded-lg flex items-center justify-center text-amber-400 shrink-0">
                                <Home className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] text-gray-500 uppercase font-bold">{t('common.address')}</p>
                                <p className="text-sm text-white font-medium truncate">{student.address}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Parents/Responsables Section */}
                <div className="bg-[#1A2530] rounded-3xl border border-white/5 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white">
                                {t('admin.students.register.parents.title') || 'Contacts parents'}
                            </h4>
                            <span className={cn(
                                'text-[10px] font-bold px-1.5 py-0.5 rounded-full border',
                                (student?.parents?.length ?? 0) >= 2
                                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                    : 'text-gray-500 bg-white/5 border-white/10'
                            )}>
                                {student?.parents?.length ?? 0}/2
                            </span>
                        </div>
                        {!isArchived && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setAssignParentsOpen(true)}
                                className={cn(
                                    'font-semibold text-xs h-7 px-2',
                                    (student?.parents?.length ?? 0) < 2
                                        ? 'text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                )}
                            >
                                {(student?.parents?.length ?? 0) === 0
                                    ? (t('admin.students.assignParentsDialog.addParent') || '+ Ajouter')
                                    : (student?.parents?.length ?? 0) < 2
                                        ? (t('admin.students.assignParentsDialog.addSecondParent') || '+ 2e parent')
                                        : (t('common.edit') || 'Modifier')}
                            </Button>
                        )}
                    </div>

                    {(!student?.parents || student.parents.length === 0) ? (
                        <button
                            type="button"
                            onClick={() => !isArchived && setAssignParentsOpen(true)}
                            disabled={isArchived}
                            className={cn(
                                'w-full text-center py-6 text-gray-500 text-xs border border-dashed border-white/10 rounded-2xl bg-[#0F1720]/30 transition-colors',
                                !isArchived && 'hover:border-emerald-500/30 hover:text-emerald-500 cursor-pointer'
                            )}
                        >
                            {t('admin.students.register.parents.noContact') || 'Aucun contact associé'}
                            {!isArchived && <span className="block text-[11px] mt-1 opacity-60">Cliquez pour ajouter</span>}
                        </button>
                    ) : (
                        <div className="space-y-3">
                            {student.parents.map((p, index) => (
                                <div key={p.id} className="bg-[#0F1720] p-4 rounded-2xl border border-white/5 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                                                <User className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <Link
                                                    href={`/admin/parents?id=${p.id}&from_student=${id}`}
                                                    className="text-sm font-bold text-white hover:text-emerald-400 transition-colors"
                                                >
                                                    {p.full_name}
                                                </Link>
                                                <p className="text-[10px] text-gray-500">
                                                    {index === 0
                                                        ? (t('admin.students.register.parents.primaryParent') || 'Parent principal')
                                                        : (t('admin.students.register.parents.secondaryParent') || 'Parent secondaire')}
                                                </p>
                                            </div>
                                        </div>
                                        {p.phone && (
                                            <a href={`tel:${p.phone}`} title={p.phone} aria-label={p.phone}>
                                                <Button size="icon" className="bg-emerald-500 hover:bg-emerald-600 rounded-full text-black h-10 w-10 shadow-lg shadow-emerald-500/20 shrink-0">
                                                    <Phone className="w-5 h-5" />
                                                </Button>
                                            </a>
                                        )}
                                    </div>
                                    {p.phone && (
                                        <p className="text-center text-gray-500 font-mono text-sm mt-1">{p.phone}</p>
                                    )}
                                </div>
                            ))}

                            {/* Second parent slot — show add prompt if only 1 parent */}
                            {student.parents.length === 1 && !isArchived && (
                                <button
                                    type="button"
                                    onClick={() => setAssignParentsOpen(true)}
                                    className="w-full flex items-center gap-3 bg-[#0F1720]/50 border border-dashed border-white/10 hover:border-emerald-500/30 rounded-2xl px-4 py-3 text-left transition-colors group"
                                >
                                    <div className="h-10 w-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10 group-hover:border-emerald-500/30 shrink-0">
                                        <span className="text-gray-500 group-hover:text-emerald-500 text-lg leading-none">+</span>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-gray-500 group-hover:text-emerald-400 transition-colors">
                                            {t('admin.students.register.parents.secondaryParent') || 'Parent secondaire'}
                                        </p>
                                        <p className="text-[10px] text-gray-600">
                                            {t('admin.students.assignParentsDialog.addSecondParentHint') || 'Cliquez pour ajouter un 2e parent'}
                                        </p>
                                    </div>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Center/Right Column */}
            <div className="lg:col-span-2 h-full">
                {activeTab === 'grades'     && <StudentGrades     studentId={id} schoolId={currentSchoolId!} />}
                {activeTab === 'attendance' && <StudentAttendance studentId={id} schoolId={currentSchoolId!} />}
                {activeTab === 'schedule'   && <StudentSchedule   studentId={id} schoolId={currentSchoolId!} />}
                {activeTab === 'payments'   && <StudentPayments   studentId={id} schoolId={currentSchoolId!} isArchived={isArchived} studentName={student?.full_name} />}
                {activeTab === 'remarks'    && <StudentRemarks    studentId={id} schoolId={currentSchoolId!} isArchived={isArchived} />}
                {activeTab === 'documents'  && <StudentDocuments  studentId={id} schoolId={currentSchoolId!} isArchived={isArchived} />}
                {activeTab === 'history'    && <StudentHistory    studentId={id} schoolId={currentSchoolId!} />}
            </div>

            <ChangeStatusDialog
                open={statusDialogOpen}
                onOpenChange={setStatusDialogOpen}
                userId={id}
                currentStatus={student?.status ?? 'active'}
                userName={student?.full_name ?? ''}
                onSuccess={(newStatus) => setStudent(s => s ? { ...s, status: newStatus } : s)}
            />
            <ChangePasswordDialog
                open={passwordDialogOpen}
                onOpenChange={setPasswordDialogOpen}
                userId={id}
                userName={student?.full_name ?? ''}
                userPhone={student?.phone ?? null}
            />

            {student?.enrollmentId && (
                <ChangeEnrollmentStatus
                    open={enrollmentDialogOpen}
                    onOpenChange={setEnrollmentDialogOpen}
                    enrollmentId={student.enrollmentId}
                    currentStatus={student.enrollmentStatus ?? 'active'}
                    studentName={student.full_name}
                    onSuccess={(newStatus) => setStudent(s => s ? { ...s, enrollmentStatus: newStatus } : s)}
                />
            )}

            <AssignClassDialog
                open={assignClassOpen}
                onOpenChange={setAssignClassOpen}
                studentId={id}
                studentName={student?.full_name ?? ''}
                currentClassId={student?.enrollmentId ? undefined : null}
                onSuccess={(className) => setStudent(s => s ? { ...s, className } : s)}
            />

            <AssignParentsDialog
                open={assignParentsOpen}
                onOpenChange={setAssignParentsOpen}
                studentId={id}
                studentName={student?.full_name ?? ''}
                currentParents={student?.parents ?? []}
                onSuccess={(newParents) => setStudent(s => s ? { ...s, parents: newParents } : s)}
            />

            {transferDialogOpen && student && (
                <TransferStudentDialog
                    open={transferDialogOpen}
                    onOpenChange={setTransferDialogOpen}
                    studentId={id}
                    studentName={student.full_name}
                    onSuccess={() => window.location.reload()}
                />
            )}

            {editStudentOpen && student && (
                <EditStudentDialog
                    open={editStudentOpen}
                    onOpenChange={setEditStudentOpen}
                    studentId={id}
                    initialData={{
                        full_name: student.full_name,
                        date_of_birth: student.date_of_birth,
                        place_of_birth: student.place_of_birth,
                        address: student.address,
                        gender: student.gender,
                    }}
                    onSuccess={() => window.location.reload()}
                />
            )}

            {/* Confirmation suppression définitive */}
            {deleteConfirmOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !deleting && setDeleteConfirmOpen(false)} />
                    <div className="relative w-full max-w-sm bg-[#161B22] rounded-2xl border border-red-500/30 shadow-2xl p-6 space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                                <Trash2 className="w-5 h-5 text-red-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white">{t('admin.students.profile.deleteStudentTitle')}</h3>
                                <p className="text-sm text-gray-400 mt-1">{t('admin.students.profile.deleteStudentConfirm')}</p>
                                <p className="text-sm font-bold text-white mt-2">{student?.full_name}</p>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button type="button" variant="outline" className="flex-1 border-white/10 text-gray-400 hover:text-white"
                                onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>
                                {t('common.cancel')}
                            </Button>
                            <Button type="button" className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold"
                                onClick={handleDeleteStudent} disabled={deleting}>
                                {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                                {t('admin.students.profile.deleteStudentButton')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
