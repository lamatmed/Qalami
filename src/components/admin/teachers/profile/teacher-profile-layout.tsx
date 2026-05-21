'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Phone, Mail, CheckCircle2, ShieldAlert, KeyRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { TeacherSchedule } from './teacher-schedule'
import { TeacherClasses } from './teacher-classes'
import { TeacherInfo } from './teacher-info'
import { TeacherDocuments } from './teacher-documents'
import { TeacherContract } from './teacher-contract'
import { TeacherAbsences } from './teacher-absences'
import { TeacherEvaluations } from './teacher-evaluations'
import { TeacherClassAverages } from './teacher-class-averages'
import { TeacherRemarksList } from './teacher-remarks-list'
import { createClient } from '@/utils/supabase/client'
import { getMySchoolContext, secureFetchProfiles } from '@/app/admin/actions'
import { Skeleton } from '@/components/ui/skeleton'
import { useLanguage } from '@/i18n'
import { StatusBadge } from '@/components/admin/shared/status-badge'
import { ChangeStatusDialog } from '@/components/admin/shared/change-status-dialog'
import { ChangePasswordDialog } from '@/components/admin/shared/change-password-dialog'

const tabs = [
    { id: 'schedule',  label: 'Emploi du temps' },
    { id: 'classes',   label: 'Classes' },
    { id: 'averages',  label: 'Moyennes' },
    { id: 'absences',  label: 'Présences' },
    { id: 'remarks',   label: 'Remarques' },
    { id: 'evaluations', label: 'Évaluations' },
    { id: 'documents', label: 'Documents' },
    { id: 'infos',     label: 'Infos' },
    { id: 'contract',  label: 'Contrat' },
]

interface TeacherProfile {
    id: string
    full_name: string
    email: string | null
    phone: string | null
    avatar_url: string | null
    subject: string
    classCount: number
    weeklyHours: number
    status: string
}

export function TeacherProfileLayout({ id }: { id: string }) {
    const router = useRouter()
    const { t } = useLanguage()
    const [activeTab, setActiveTab] = useState('averages')
    const [teacher, setTeacher] = useState<TeacherProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [statusDialogOpen, setStatusDialogOpen] = useState(false)
    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)

    useEffect(() => {
        async function fetchTeacher() {
            setLoading(true)
            const supabase = createClient()

            // Fetch teacher profile
            // Fetch teacher profile securely via server action bypassing client-side RLS
            const profiles = await secureFetchProfiles([id], 'id, full_name, email, phone, avatar_url, status')
            const profile = profiles?.[0] || null

            if (!profile) {
                setLoading(false)
                return
            }

            const ctx = await getMySchoolContext()
            const currentSchoolId = ctx?.school_id

            // Batch: assignments + schedule for weekly hours (strictly scoped to current school)
            const [{ data: assignments }, { data: scheduleSlots }] = await Promise.all([
                supabase
                    .from('teacher_assignments')
                    .select('subject_id, subjects(name), class_id, classes!inner(school_id)')
                    .eq('teacher_id', id)
                    .eq('classes.school_id', currentSchoolId),
                supabase
                    .from('schedule')
                    .select('start_time, end_time, classes!inner(school_id)')
                    .eq('teacher_id', id)
                    .eq('classes.school_id', currentSchoolId),
            ])

            const subjectNames = [...new Set(
                (assignments || [])
                    .map(a => (a.subjects as any)?.name)
                    .filter(Boolean)
            )]

            const classIds = [...new Set(
                (assignments || []).map(a => a.class_id)
            )]

            const weeklyMinutes = (scheduleSlots || []).reduce((sum, s) => {
                if (!s.start_time || !s.end_time) return sum
                const [sh, sm] = s.start_time.split(':').map(Number)
                const [eh, em] = s.end_time.split(':').map(Number)
                return sum + (eh * 60 + em - (sh * 60 + sm))
            }, 0)

            setTeacher({
                id: profile.id,
                full_name: profile.full_name || 'Enseignant',
                email: profile.email,
                phone: profile.phone,
                avatar_url: profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.full_name}`,
                subject: subjectNames[0] || t('admin.teachers.notAssigned') || 'Non assigné',
                classCount: classIds.length,
                weeklyHours: Math.round((weeklyMinutes / 60) * 10) / 10,
                status: (profile as any).status || 'active',
            })

            setLoading(false)
        }

        fetchTeacher()
    }, [id])

    if (loading) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full max-w-[1600px] mx-auto animate-in fade-in duration-500">
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-[#161B22] rounded-2xl border border-white/5 p-6">
                        <Skeleton className="h-28 w-28 rounded-full mx-auto mb-4" />
                        <Skeleton className="h-6 w-40 mx-auto mb-2" />
                        <Skeleton className="h-4 w-24 mx-auto" />
                    </div>
                </div>
                <div className="lg:col-span-2">
                    <Skeleton className="h-96 rounded-3xl" />
                </div>
            </div>
        )
    }

    if (!teacher) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <p>{t('admin.teachers.profile.notFound')}</p>
                <Button variant="ghost" onClick={() => router.back()} className="mt-4">{t('admin.teachers.profile.back')}</Button>
            </div>
        )
    }

    return (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full max-w-[1600px] mx-auto animate-in fade-in duration-500">
            {/* Left Column: Profile Card & Personal Info */}
            <div className="lg:col-span-1 space-y-6">
                {/* Main Profile Card */}
                <div className="bg-[#161B22] rounded-2xl border border-white/5 p-6 relative overflow-hidden">
                    <div className="flex justify-between items-start mb-6 relative z-10">
                        <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-muted-foreground hover:text-foreground -ms-2 rtl:-me-2">
                            <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
                        </Button>
                        <h3 className="font-bold text-foreground mt-2">{t('admin.teachers.teacherProfile') || 'Profil Enseignant'}</h3>
                        <div className="w-9" />
                    </div>

                    <div className="flex flex-col items-center text-center relative z-10 mb-6">
                        <div className="h-28 w-28 rounded-full border-4 border-muted shadow-2xl mb-4 relative">
                            <div className="h-full w-full rounded-full bg-muted bg-cover bg-center" style={{ backgroundImage: `url('${teacher.avatar_url}')` }}></div>
                            <div className="absolute bottom-1 right-1 h-6 w-6 bg-primary rounded-full border-2 border-card flex items-center justify-center">
                                <CheckCircle2 className="w-3 h-3 text-primary-foreground" />
                            </div>
                        </div>
                        <h1 className="text-xl font-bold text-foreground">{teacher.full_name}</h1>
                        <p className="text-primary font-mono text-xs font-bold mt-1 uppercase">{t('admin.teachers.profile.speciality')} {teacher.subject}</p>
                        <div className="mt-2">
                            <StatusBadge status={teacher.status} />
                        </div>
                    </div>

                    {/* Bouton changement de statut */}
                    <div className="relative z-10 mb-4 flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 border-white/10 text-gray-400 hover:text-orange-400 hover:border-orange-500/30 hover:bg-orange-500/5 gap-2"
                            onClick={() => setStatusDialogOpen(true)}
                        >
                            <ShieldAlert className="w-4 h-4" />
                            {t('admin.teachers.profile.changeStatus')}
                        </Button>
                        {teacher.phone && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 border-white/10 text-gray-400 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/5 gap-2"
                                onClick={() => setPasswordDialogOpen(true)}
                            >
                                <KeyRound className="w-4 h-4" />
                                {t('admin.users.changePassword') || 'Modifier le mot de passe'}
                            </Button>
                        )}
                    </div>

                    {/* Navigation Tabs */}
                    <div className="relative z-10 flex justify-between border-b border-border pb-1 gap-4 overflow-x-auto">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "text-xs font-bold pb-3 px-1 transition-all whitespace-nowrap",
                                    activeTab === tab.id ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {t(`admin.teachers.profile.${tab.id}`)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Contact Widget */}
                <div className="bg-[#161B22] rounded-2xl border border-white/5 p-6 space-y-4">
                    <h4 className="text-sm font-bold text-foreground mb-4">{t('admin.teachers.contact') || 'Coordonnées'}</h4>

                    <div className="bg-muted p-3 rounded-xl flex items-center gap-4 border border-border hover:border-primary/30 transition-colors group cursor-pointer">
                        <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                            <Phone className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">{t('admin.teachers.profile.phone')}</p>
                            <p className="text-sm text-foreground font-medium ltr-content">{teacher.phone || t('admin.teachers.profile.noPhone')}</p>
                        </div>
                    </div>

                    <div className="bg-muted p-3 rounded-xl flex items-center gap-4 border border-border hover:border-primary/30 transition-colors group cursor-pointer">
                        <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                            <Mail className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">{t('admin.teachers.profile.email')}</p>
                            <p className="text-sm text-foreground font-medium">{teacher.email || t('admin.teachers.profile.noEmail')}</p>
                        </div>
                    </div>
                </div>

                {/* Stats Widget */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#161B22] rounded-2xl border border-white/5 p-5 text-center">
                        <h4 className="text-3xl font-bold text-foreground mb-1">
                            {teacher.weeklyHours > 0 ? `${teacher.weeklyHours}h` : '—'}
                        </h4>
                        <p className="text-xs text-muted-foreground font-medium uppercase">{t('admin.teachers.profile.weeklyVolume')}</p>
                    </div>
                    <div className="bg-[#161B22] rounded-2xl border border-white/5 p-5 text-center">
                        <h4 className="text-3xl font-bold text-foreground mb-1">{teacher.classCount}</h4>
                        <p className="text-xs text-muted-foreground font-medium uppercase">{t('admin.teachers.profile.classesLabel')}</p>
                    </div>
                </div>
            </div>

            {/* Center/Right Column */}
            <div className="lg:col-span-2 h-full">
                {activeTab === 'infos'       && <TeacherInfo teacherId={id} />}
                {activeTab === 'schedule'    && <TeacherSchedule teacherId={id} />}
                {activeTab === 'classes'     && <TeacherClasses teacherId={id} />}
                {activeTab === 'averages'    && <TeacherClassAverages teacherId={id} />}
                {activeTab === 'absences'    && <TeacherAbsences teacherId={id} />}
                {activeTab === 'remarks'     && <TeacherRemarksList teacherId={id} />}
                {activeTab === 'evaluations' && <TeacherEvaluations teacherId={id} />}
                {activeTab === 'documents'   && <TeacherDocuments teacherId={id} />}
                {activeTab === 'contract'    && <TeacherContract teacherId={id} />}
            </div>
        </div>
        <ChangeStatusDialog
            open={statusDialogOpen}
            onOpenChange={setStatusDialogOpen}
            userId={teacher.id}
            currentStatus={teacher.status}
            userName={teacher.full_name}
            onSuccess={(newStatus) => setTeacher(prev => prev ? { ...prev, status: newStatus } : prev)}
        />
        <ChangePasswordDialog
            open={passwordDialogOpen}
            onOpenChange={setPasswordDialogOpen}
            userId={teacher.id}
            userName={teacher.full_name}
            userPhone={teacher.phone}
        />
        </>
    )
}
