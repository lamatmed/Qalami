'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Calendar, User, Phone, CreditCard, Home, ShieldAlert, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
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
import { ChangeEnrollmentStatus } from '@/components/admin/students/change-enrollment-status'
import { AssignClassDialog } from '@/components/admin/students/assign-class-dialog'
import { createClient } from '@/utils/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const tabs = [
    { id: 'grades',     label: 'Notes' },
    { id: 'attendance', label: 'Absences' },
    { id: 'schedule',   label: 'Emploi du temps' },
    { id: 'payments',   label: 'Paiements' },
    { id: 'remarks',    label: 'Remarques' },
    { id: 'documents',  label: 'Documents' },
    { id: 'history',    label: 'Historique' },
]

interface StudentProfile {
    full_name: string
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
    parentName: string | null
    parentPhone: string | null
}

export function StudentProfileLayout({ id }: { id: string }) {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState('grades')
    const [student, setStudent] = useState<StudentProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [statusDialogOpen, setStatusDialogOpen] = useState(false)
    const [enrollmentDialogOpen, setEnrollmentDialogOpen] = useState(false)
    const [assignClassOpen, setAssignClassOpen] = useState(false)

    useEffect(() => {
        async function fetchStudent() {
            const supabase = createClient()

            const { data: profile } = await supabase
                .from('profiles')
                .select(`
                    full_name,
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
                        academic_years ( name ),
                        classes ( name )
                    ),
                    parent_student_links!parent_student_links_student_id_fkey (
                        profiles!parent_student_links_parent_id_fkey (
                            full_name,
                            phone
                        )
                    )
                `)
                .eq('id', id)
                .single()

            if (profile) {
                const enrollments = profile.enrollments as any[]
                const links = profile.parent_student_links as any[]
                const firstParent = links?.[0]?.profiles

                const firstEnrollment = enrollments?.[0]
                setStudent({
                    full_name: profile.full_name || 'Élève',
                    status: (profile as any).status || 'active',
                    date_of_birth: (profile as any).date_of_birth || null,
                    gender: (profile as any).gender || null,
                    place_of_birth: (profile as any).place_of_birth || null,
                    national_id: (profile as any).national_id || null,
                    address: (profile as any).address || null,
                    avatar_url: profile.avatar_url || null,
                    className: firstEnrollment?.classes?.name || 'Non assigné',
                    enrollmentId: firstEnrollment?.id || null,
                    enrollmentStatus: firstEnrollment?.status || null,
                    academicYear: (firstEnrollment?.academic_years as any)?.name || null,
                    parentName: firstParent?.full_name || null,
                    parentPhone: firstParent?.phone || null,
                })
            }
            setLoading(false)
        }
        fetchStudent()
    }, [id])

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '—'
        return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }

    const genderLabel = (g: string | null) => {
        if (g === 'male') return 'Masculin'
        if (g === 'female') return 'Féminin'
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

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full max-w-[1600px] mx-auto">
            {/* Left Column */}
            <div className="lg:col-span-1 space-y-6 animate-in slide-in-from-left duration-500">
                {/* Main Profile Card */}
                <div className="bg-[#1A2530] rounded-3xl border border-white/5 p-6 relative overflow-hidden">
                    <div className="flex justify-between items-start mb-6 relative z-10">
                        <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-gray-400 hover:text-white -ml-2">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <h3 className="font-bold text-white mt-2">Dossier Étudiant</h3>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-gray-400 hover:text-orange-400 -mr-2"
                            title="Changer le statut"
                            onClick={() => setStatusDialogOpen(true)}
                        >
                            <ShieldAlert className="w-5 h-5" />
                        </Button>
                    </div>

                    <div className="flex flex-col items-center text-center relative z-10 mb-6">
                        <Avatar className="h-28 w-28 border-4 border-[#0F1720] shadow-2xl mb-4">
                            <AvatarImage src={student?.avatar_url ?? `https://api.dicebear.com/7.x/initials/svg?seed=${student?.full_name}`} />
                            <AvatarFallback className="bg-gray-700 text-white text-2xl font-bold">{initials}</AvatarFallback>
                        </Avatar>
                        <h1 className="text-xl font-bold text-white">{student?.full_name}</h1>
                        <div className="mt-2">
                            <StatusBadge status={student?.status ?? 'active'} />
                        </div>
                        <button
                            className="text-gray-400 text-sm mt-1 hover:text-emerald-400 transition-colors flex items-center gap-1.5 group"
                            onClick={() => setAssignClassOpen(true)}
                            title="Assigner ou changer de classe"
                        >
                            Classe : <span className={cn(
                                "font-medium",
                                student?.className === 'Non assigné' ? "text-amber-400 group-hover:text-emerald-400" : "text-white group-hover:text-emerald-400"
                            )}>{student?.className}</span>
                        </button>
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
                                {student.enrollmentId && (
                                    <button
                                        className="text-[10px] text-gray-500 hover:text-emerald-400 underline transition-colors"
                                        onClick={() => setEnrollmentDialogOpen(true)}
                                    >
                                        Statut
                                    </button>
                                )}
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
                    <h4 className="text-sm font-bold text-white mb-4">Informations Personnelles</h4>

                    <div className="bg-[#0F1720] p-3 rounded-xl flex items-center gap-4 border border-white/5">
                        <div className="h-10 w-10 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-500 shrink-0">
                            <Calendar className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] text-gray-500 uppercase font-bold">Date et Lieu de Naissance</p>
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
                            <p className="text-[10px] text-gray-500 uppercase font-bold">Genre</p>
                            <p className="text-sm text-white font-medium">{genderLabel(student?.gender ?? null)}</p>
                        </div>
                    </div>

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
                                <p className="text-[10px] text-gray-500 uppercase font-bold">Adresse</p>
                                <p className="text-sm text-white font-medium truncate">{student.address}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Emergency Contact */}
                {(student?.parentName || student?.parentPhone) && (
                    <div className="bg-[#1A2530] rounded-3xl border border-white/5 p-6">
                        <h4 className="text-sm font-bold text-white mb-4">Contact d'urgence</h4>
                        <div className="bg-[#0F1720] p-4 rounded-2xl flex items-center justify-between border border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                                    <User className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white">{student?.parentName || '—'}</p>
                                    <p className="text-[10px] text-gray-500">Parent / Tuteur</p>
                                </div>
                            </div>
                            {student?.parentPhone && (
                                <a href={`tel:${student.parentPhone}`}>
                                    <Button size="icon" className="bg-emerald-500 hover:bg-emerald-600 rounded-full text-black h-10 w-10 shadow-lg shadow-emerald-500/20">
                                        <Phone className="w-5 h-5" />
                                    </Button>
                                </a>
                            )}
                        </div>
                        {student?.parentPhone && (
                            <p className="text-center text-gray-500 font-mono text-sm mt-3">{student.parentPhone}</p>
                        )}
                    </div>
                )}
            </div>

            {/* Center/Right Column */}
            <div className="lg:col-span-2 h-full">
                {activeTab === 'grades'     && <StudentGrades     studentId={id} />}
                {activeTab === 'attendance' && <StudentAttendance studentId={id} />}
                {activeTab === 'schedule'   && <StudentSchedule   studentId={id} />}
                {activeTab === 'payments'   && <StudentPayments   studentId={id} />}
                {activeTab === 'remarks'    && <StudentRemarks    studentId={id} />}
                {activeTab === 'documents'  && <StudentDocuments  studentId={id} />}
                {activeTab === 'history'    && <StudentHistory    studentId={id} />}
            </div>

            <ChangeStatusDialog
                open={statusDialogOpen}
                onOpenChange={setStatusDialogOpen}
                userId={id}
                currentStatus={student?.status ?? 'active'}
                userName={student?.full_name ?? ''}
                onSuccess={(newStatus) => setStudent(s => s ? { ...s, status: newStatus } : s)}
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
        </div>
    )
}
