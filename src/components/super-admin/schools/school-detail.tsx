'use client'

import { useState, useEffect } from 'react'
import { Building2, ArrowLeft, ArrowRight, Users, GraduationCap, Eye, ToggleLeft, ToggleRight, Loader2, Mail, Phone, MapPin, Calendar, CreditCard, Shield, Edit2, Save, X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n'
import { updateSchool } from '@/app/super-admin/schools/actions'

interface SchoolDetailProps {
    schoolId: string
}

export function SchoolDetail({ schoolId }: SchoolDetailProps) {
    const { t, direction } = useLanguage()
    const supabase = createClient()
    const router = useRouter()
    const [school, setSchool] = useState<any>(null)
    const [stats, setStats] = useState({ students: 0, teachers: 0, parents: 0, admins: 0 })
    const [loading, setLoading] = useState(true)
    const [toggling, setToggling] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [form, setForm] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        subscription_plan: '',
        max_students: 100
    })

    useEffect(() => {
        const fetchSchool = async () => {
            try {
                const [schoolRes, settingsRes] = await Promise.all([
                    supabase.from('schools').select('*').eq('id', schoolId).single(),
                    supabase.from('school_settings').select('*').eq('school_id', schoolId).maybeSingle()
                ])

                const base = schoolRes.data
                const overrides = settingsRes.data
                
                if (!base) {
                    setLoading(false)
                    return
                }

                // Merge logic ensuring newest override propagates instantly
                const data = {
                    ...base,
                    name: overrides?.name || base.name,
                    email: overrides?.email || base.email,
                    address: overrides?.address || base.address,
                    logo_url: overrides?.logo_url || base.logo_url,
                }

                setSchool(data)
                if (data) {
                    setForm({
                        name: data.name || '',
                        email: data.email || '',
                        phone: data.phone || '',
                        address: data.address || '',
                        subscription_plan: data.subscription_plan || 'free',
                        max_students: data.max_students || 100
                    })
                }

                // Fetch user counts with accurate multi-level association unions
                const [
                    studentsRes, 
                    adminsRes,
                    // Teachers Union Components
                    directTeachersRes,
                    assignedTeachersRes,
                    schoolLinkTeachersRes,
                    // Parents Union Components
                    directParentsRes,
                    linkedParentsRes,
                    schoolLinkParentsRes
                ] = await Promise.all([
                    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('role', 'student'),
                    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('role', 'admin'),
                    
                    // Teachers
                    supabase.from('profiles').select('id').eq('school_id', schoolId).eq('role', 'teacher'),
                    supabase.from('teacher_assignments').select('teacher_id, classes!inner(school_id)').eq('classes.school_id', schoolId),
                    supabase.from('profile_schools').select('profile_id').eq('school_id', schoolId).eq('role', 'teacher'),
                    
                    // Parents
                    supabase.from('profiles').select('id').eq('school_id', schoolId).eq('role', 'parent'),
                    supabase.from('parent_student_links').select('parent_id, students:profiles!parent_student_links_student_id_fkey!inner(school_id)').eq('students.school_id', schoolId),
                    supabase.from('profile_schools').select('profile_id').eq('school_id', schoolId).eq('role', 'parent')
                ])

                const uniqueTeacherIds = new Set([
                    ...(directTeachersRes.data || []).map((t: any) => t.id),
                    ...(assignedTeachersRes.data || []).map((t: any) => t.teacher_id),
                    ...(schoolLinkTeachersRes.data || []).map((t: any) => t.profile_id)
                ].filter(Boolean))

                const uniqueParentIds = new Set([
                    ...(directParentsRes.data || []).map((p: any) => p.id),
                    ...(linkedParentsRes.data || []).map((p: any) => p.parent_id),
                    ...(schoolLinkParentsRes.data || []).map((p: any) => p.profile_id)
                ].filter(Boolean))

                setStats({
                    students: studentsRes.count ?? 0,
                    teachers: uniqueTeacherIds.size,
                    parents: uniqueParentIds.size,
                    admins: adminsRes.count ?? 0,
                })
            } catch (error) {
                console.error('Error fetching school:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchSchool()
    }, [schoolId])

    const handleSave = async () => {
        if (!form.name.trim()) {
            toast.error("Le nom de l'école est requis")
            return
        }

        setIsSaving(true)
        try {
            const response = await updateSchool({
                id: schoolId,
                name: form.name,
                email: form.email,
                phone: form.phone,
                address: form.address,
                subscriptionPlan: form.subscription_plan,
                maxStudents: form.max_students
            })

            if (response.error) {
                toast.error(response.error)
            } else {
                toast.success("Informations mises à jour avec succès !")
                setSchool({
                    ...school,
                    name: form.name,
                    email: form.email,
                    phone: form.phone,
                    address: form.address,
                    subscription_plan: form.subscription_plan,
                    max_students: form.max_students
                })
                setIsEditing(false)
            }
        } catch (err) {
            toast.error("Une erreur inattendue s'est produite.")
        } finally {
            setIsSaving(false)
        }
    }

    const toggleActive = async () => {
        if (!school) return
        setToggling(true)
        try {
            const { error } = await supabase
                .from('schools')
                .update({ is_active: !school.is_active })
                .eq('id', schoolId)

            if (error) throw error

            setSchool({ ...school, is_active: !school.is_active })
            toast.success(school.is_active ? t('superAdmin.schoolDetail.desactivationSuccess') : t('superAdmin.schoolDetail.activationSuccess'))
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setToggling(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24 bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-3xl shadow-sm animate-pulse">
                <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
            </div>
        )
    }

    if (!school) {
        return (
            <div className="text-center py-24 bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-3xl shadow-sm text-gray-400">
                <Building2 className="w-16 h-16 mx-auto mb-4 opacity-30 text-purple-600 animate-bounce" />
                <p className="font-bold text-gray-500">{t('superAdmin.schoolDetail.notFound')}</p>
            </div>
        )
    }

    const getPlanBadge = (plan: string) => {
        switch (plan) {
            case 'enterprise': return 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20'
            case 'pro': return 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20'
            default: return 'bg-gray-50 text-gray-600 border-gray-100 dark:bg-gray-500/10 dark:text-gray-400 dark:border-gray-500/20'
        }
    }

    const BackIcon = direction === 'rtl' ? ArrowRight : ArrowLeft

    return (
        <div className="space-y-8 pb-12 animate-in fade-in duration-500" dir={direction}>
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex items-center gap-4.5">
                    <Link href="/super-admin/schools">
                        <Button variant="ghost" size="icon" className="h-11 w-11 rounded-2xl text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-100 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 shadow-sm transition-all duration-300">
                            <BackIcon className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div className="flex items-center gap-4">
                        <div className="h-15 w-15 rounded-2xl bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 border border-purple-100 dark:border-purple-500/20 flex items-center justify-center shrink-0 overflow-hidden">
                            {school.logo_url ? (
                                <img src={school.logo_url} alt={school.name} className="w-full h-full object-cover" />
                            ) : (
                                <Building2 className="w-8 h-8" />
                            )}
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight leading-tight">{school.name}</h1>
                            <p className="text-sm font-semibold text-gray-400 mt-0.5">/{school.slug}</p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3.5 self-start md:self-auto">
                    {isEditing ? (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIsEditing(false)
                                    setForm({
                                        name: school.name,
                                        email: school.email || '',
                                        phone: school.phone || '',
                                        address: school.address || '',
                                        subscription_plan: school.subscription_plan,
                                        max_students: school.max_students
                                    })
                                }}
                                disabled={isSaving}
                                className="h-12 rounded-2xl border-gray-200 font-bold text-gray-600 px-5 shadow-sm"
                            >
                                <X className="w-4 h-4 mr-2" /> {t('common.cancel') || 'Annuler'}
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl px-6 shadow-lg shadow-emerald-600/20"
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                {t('common.save') || 'Enregistrer'}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => setIsEditing(true)}
                                className="h-12 rounded-2xl border-gray-200 hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5 font-bold text-purple-600 px-5 shadow-sm"
                            >
                                <Edit2 className="w-4 h-4 mr-2" /> {t('common.edit') || 'Modifier'}
                            </Button>
                            
                            <Button
                                variant="outline"
                                onClick={toggleActive}
                                disabled={toggling}
                                className={cn(
                                    "h-12 rounded-2xl border-gray-200 dark:border-white/10 font-bold px-5 shadow-sm transition-all duration-300",
                                    school.is_active 
                                        ? "text-emerald-600 bg-emerald-50/50 hover:bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20" 
                                        : "text-red-600 bg-red-50/50 hover:bg-red-50 dark:text-red-400 dark:bg-red-500/10 dark:hover:bg-red-500/20"
                                )}
                            >
                                {toggling ? (
                                    <Loader2 className="w-4.5 h-4.5 animate-spin mr-2" />
                                ) : school.is_active ? (
                                    <ToggleRight className={cn("w-5.5 h-5.5", direction === 'rtl' ? 'ml-2' : 'mr-2')} />
                                ) : (
                                    <ToggleLeft className={cn("w-5.5 h-5.5", direction === 'rtl' ? 'ml-2' : 'mr-2')} />
                                )}
                                {school.is_active ? t('superAdmin.schoolDetail.active') : t('superAdmin.schoolDetail.inactive')}
                            </Button>
                            
                            <Link href={`/super-admin/schools/${schoolId}/access`}>
                                <Button className="h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black rounded-2xl px-6 shadow-lg shadow-purple-600/20 transition-all duration-300">
                                    <Eye className={cn("w-4.5 h-4.5", direction === 'rtl' ? 'ml-2' : 'mr-2')} /> {t('superAdmin.schoolDetail.accessAdmin')}
                                </Button>
                            </Link>
                        </>
                    )}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4.5">
                {[
                    { label: t('superAdmin.schoolDetail.students'), value: stats.students, max: school.max_students, icon: GraduationCap, color: 'blue' },
                    { label: t('superAdmin.schoolDetail.teachers'), value: stats.teachers, icon: Users, color: 'indigo' },
                    { label: t('superAdmin.schoolDetail.parents'), value: stats.parents, icon: Users, color: 'amber' },
                    { label: t('superAdmin.schoolDetail.admins'), value: stats.admins, icon: Shield, color: 'purple' },
                ].map((stat, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-3xl p-5 shadow-sm transition-transform hover:scale-[1.03] duration-300">
                        <div className={cn(
                            "h-11 w-11 rounded-2xl flex items-center justify-center mb-4 border shrink-0",
                            stat.color === 'blue' && "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
                            stat.color === 'indigo' && "bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20",
                            stat.color === 'amber' && "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
                            stat.color === 'purple' && "bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20"
                        )}>
                            <stat.icon className="w-5.5 h-5.5" />
                        </div>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-black tracking-wider">{stat.label}</p>
                        <p className="text-3xl font-black text-gray-900 dark:text-white mt-1.5 leading-none">
                            {stat.value}
                            {stat.max && <span className="text-sm text-gray-400 dark:text-gray-500 font-bold"> / {stat.max}</span>}
                        </p>
                    </div>
                ))}
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* General Info Card */}
                <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-3xl p-8 shadow-sm space-y-6">
                    <div className="flex items-center gap-4 pb-4 border-b border-gray-100 dark:border-white/5">
                        <div className="h-12 w-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500 shrink-0">
                            <Building2 className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="font-bold text-gray-900 dark:text-white text-lg">
                                {t('superAdmin.schoolDetail.infoTitle')}
                            </h2>
                        </div>
                    </div>

                    <div className="space-y-4 font-semibold text-sm">
                        {isEditing ? (
                            <>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-gray-400 uppercase">{t('superAdmin.schools.new.schoolName') || "Nom de l'école"}</Label>
                                    <Input 
                                        value={form.name} 
                                        onChange={e => setForm({...form, name: e.target.value})}
                                        className="bg-gray-50 dark:bg-slate-950 border-gray-200 dark:border-white/10 rounded-xl h-11" 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-gray-400 uppercase">{t('superAdmin.schoolDetail.email')}</Label>
                                    <Input 
                                        value={form.email} 
                                        onChange={e => setForm({...form, email: e.target.value})}
                                        className="bg-gray-50 dark:bg-slate-950 border-gray-200 dark:border-white/10 rounded-xl h-11" 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-gray-400 uppercase">{t('superAdmin.schoolDetail.phone')}</Label>
                                    <Input 
                                        value={form.phone} 
                                        onChange={e => setForm({...form, phone: e.target.value})}
                                        className="bg-gray-50 dark:bg-slate-950 border-gray-200 dark:border-white/10 rounded-xl h-11" 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-gray-400 uppercase">{t('superAdmin.schoolDetail.address')}</Label>
                                    <Input 
                                        value={form.address} 
                                        onChange={e => setForm({...form, address: e.target.value})}
                                        className="bg-gray-50 dark:bg-slate-950 border-gray-200 dark:border-white/10 rounded-xl h-11" 
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex items-center justify-between p-4.5 bg-gray-50/50 dark:bg-slate-950/40 rounded-2xl border border-gray-100 dark:border-white/5">
                                    <div className="flex items-center gap-3">
                                        <Mail className="w-4.5 h-4.5 text-gray-400" />
                                        <span className="text-gray-400 font-bold text-xs uppercase tracking-wider">{t('superAdmin.schoolDetail.email')}</span>
                                    </div>
                                    <span className="text-gray-800 dark:text-gray-200">{school.email || '-'}</span>
                                </div>
                                <div className="flex items-center justify-between p-4.5 bg-gray-50/50 dark:bg-slate-950/40 rounded-2xl border border-gray-100 dark:border-white/5">
                                    <div className="flex items-center gap-3">
                                        <Phone className="w-4.5 h-4.5 text-gray-400" />
                                        <span className="text-gray-400 font-bold text-xs uppercase tracking-wider">{t('superAdmin.schoolDetail.phone')}</span>
                                    </div>
                                    <span className="text-gray-800 dark:text-gray-200" dir="ltr">{school.phone || '-'}</span>
                                </div>
                                <div className="flex items-center justify-between p-4.5 bg-gray-50/50 dark:bg-slate-950/40 rounded-2xl border border-gray-100 dark:border-white/5">
                                    <div className="flex items-center gap-3">
                                        <MapPin className="w-4.5 h-4.5 text-gray-400" />
                                        <span className="text-gray-400 font-bold text-xs uppercase tracking-wider">{t('superAdmin.schoolDetail.address')}</span>
                                    </div>
                                    <span className="text-gray-800 dark:text-gray-200">{school.address || '-'}</span>
                                </div>
                                <div className="flex items-center justify-between p-4.5 bg-gray-50/50 dark:bg-slate-950/40 rounded-2xl border border-gray-100 dark:border-white/5">
                                    <div className="flex items-center gap-3">
                                        <Calendar className="w-4.5 h-4.5 text-gray-400" />
                                        <span className="text-gray-400 font-bold text-xs uppercase tracking-wider">{t('superAdmin.schoolDetail.createdAt')}</span>
                                    </div>
                                    <span className="text-gray-800 dark:text-gray-200">
                                        {new Date(school.created_at).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'fr-FR', {
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric'
                                        })}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Subscription Card */}
                <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-3xl p-8 shadow-sm space-y-6">
                    <div className="flex items-center gap-4 pb-4 border-b border-gray-100 dark:border-white/5">
                        <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                            <CreditCard className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="font-bold text-gray-900 dark:text-white text-lg">
                                {t('superAdmin.schoolDetail.subTitle')}
                            </h2>
                        </div>
                    </div>

                    <div className="space-y-4 font-semibold text-sm">
                        {isEditing ? (
                            <>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1.5">
                                        <Sparkles className="w-3 h-3 text-purple-500" />
                                        {t('superAdmin.schoolDetail.plan')}
                                    </Label>
                                    <select
                                        value={form.subscription_plan}
                                        onChange={e => setForm({...form, subscription_plan: e.target.value})}
                                        className="w-full h-11 px-3 rounded-xl bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500/20 transition-all outline-none"
                                    >
                                        <option value="free">Free</option>
                                        <option value="pro">Pro</option>
                                        <option value="enterprise">Enterprise</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-gray-400 uppercase">{t('superAdmin.schoolDetail.studentLimit')}</Label>
                                    <Input 
                                        type="number"
                                        value={form.max_students} 
                                        onChange={e => setForm({...form, max_students: parseInt(e.target.value) || 0})}
                                        className="bg-gray-50 dark:bg-slate-950 border-gray-200 dark:border-white/10 rounded-xl h-11" 
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex items-center justify-between p-4.5 bg-gray-50/50 dark:bg-slate-950/40 rounded-2xl border border-gray-100 dark:border-white/5">
                                    <div className="flex items-center gap-3">
                                        <CreditCard className="w-4.5 h-4.5 text-gray-400" />
                                        <span className="text-gray-400 font-bold text-xs uppercase tracking-wider">{t('superAdmin.schoolDetail.plan')}</span>
                                    </div>
                                    <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase border tracking-wider", getPlanBadge(school.subscription_plan))}>
                                        {school.subscription_plan}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between p-4.5 bg-gray-50/50 dark:bg-slate-950/40 rounded-2xl border border-gray-100 dark:border-white/5">
                                    <div className="flex items-center gap-3">
                                        <GraduationCap className="w-4.5 h-4.5 text-gray-400" />
                                        <span className="text-gray-400 font-bold text-xs uppercase tracking-wider">{t('superAdmin.schoolDetail.studentLimit')}</span>
                                    </div>
                                    <span className="text-gray-800 dark:text-gray-200 font-bold">{school.max_students}</span>
                                </div>
                                <div className="flex items-center justify-between p-4.5 bg-gray-50/50 dark:bg-slate-950/40 rounded-2xl border border-gray-100 dark:border-white/5">
                                    <div className="flex items-center gap-3">
                                        <Building2 className="w-4.5 h-4.5 text-gray-400" />
                                        <span className="text-gray-400 font-bold text-xs uppercase tracking-wider">{t('superAdmin.schoolDetail.status')}</span>
                                    </div>
                                    <span className={cn(
                                        "inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                                        school.is_active !== false
                                            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                                            : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                                    )}>
                                        {school.is_active !== false ? t('superAdmin.schoolDetail.active') : t('superAdmin.schoolDetail.inactive')}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
