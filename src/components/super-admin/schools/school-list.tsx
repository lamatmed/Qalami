'use client'

import { useState, useEffect } from 'react'
import { Building2, Plus, Search, MoreHorizontal, Eye, Settings, Loader2, Trash2, AlertTriangle, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { useLanguage } from '@/i18n'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { deleteSchoolCascade, updateSchoolAdminPassword } from '@/app/super-admin/schools/actions'
import { toast } from 'sonner'

interface School {
    id: string
    name: string
    slug: string
    is_active: boolean
    subscription_plan: string
    max_students: number
    created_at: string
    logo_url?: string | null
    studentCount?: number
    teacherCount?: number
}

export function SchoolList() {
    const { t } = useLanguage()
    const supabase = createClient()
    const [schools, setSchools] = useState<School[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    const [schoolToDelete, setSchoolToDelete] = useState<School | null>(null)
    const [deleteConfirmInput, setDeleteConfirmInput] = useState('')
    const [isDeleting, setIsDeleting] = useState(false)

    const [passwordSchool, setPasswordSchool] = useState<School | null>(null)
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [updatingPassword, setUpdatingPassword] = useState(false)

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!passwordSchool) return

        if (newPassword.length < 6) {
            toast.error("Le mot de passe doit contenir au moins 6 caractères.")
            return
        }

        if (newPassword !== confirmPassword) {
            toast.error("Les mots de passe ne correspondent pas.")
            return
        }

        setUpdatingPassword(true)
        try {
            const res = await updateSchoolAdminPassword(passwordSchool.id, newPassword)
            if (res.error) {
                toast.error(res.error)
            } else {
                toast.success(`Le mot de passe de l'administrateur (${res.adminName || res.adminEmail}) a été mis à jour.`)
                setPasswordSchool(null)
                setNewPassword('')
                setConfirmPassword('')
            }
        } catch (error) {
            console.error('Error changing admin password:', error)
            toast.error("Une erreur est survenue lors de la mise à jour.")
        } finally {
            setUpdatingPassword(false)
        }
    }

    useEffect(() => {
        if (!schoolToDelete) {
            setDeleteConfirmInput('')
            setIsDeleting(false)
        }
    }, [schoolToDelete])

    const handleDeleteConfirm = async () => {
        if (!schoolToDelete) return
        setIsDeleting(true)
        try {
            const res = await deleteSchoolCascade(schoolToDelete.id)
            if (res.error) {
                toast.error(res.error)
            } else {
                toast.success("L'école a été supprimée avec succès.")
                setSchools(prev => prev.filter(s => s.id !== schoolToDelete.id))
                setSchoolToDelete(null)
            }
        } catch (err) {
            console.error(err)
            toast.error("Une erreur inattendue s'est produite.")
        } finally {
            setIsDeleting(false)
        }
    }

    useEffect(() => {
        const fetchSchools = async () => {
            try {
                const { data } = await supabase
                    .from('schools')
                    .select('*')
                    .order('created_at', { ascending: false })

                if (data) {
                    // Fetch counts for each school
                    // Fetch counts for each school using accurate 3-way union logic
                    const schoolsWithCounts = await Promise.all(
                        data.map(async (school) => {
                            const [
                                studentsRes, 
                                directTeachersRes, 
                                assignedTeachersRes, 
                                schoolLinkTeachersRes, 
                                settingsRes
                            ] = await Promise.all([
                                supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', school.id).eq('role', 'student'),
                                supabase.from('profiles').select('id').eq('school_id', school.id).eq('role', 'teacher'),
                                supabase.from('teacher_assignments').select('teacher_id, classes!inner(school_id)').eq('classes.school_id', school.id),
                                supabase.from('profile_schools').select('profile_id').eq('school_id', school.id).eq('role', 'teacher'),
                                supabase.from('school_settings').select('name, logo_url').eq('school_id', school.id).maybeSingle()
                            ])
                            
                            // Build exact union count for Teachers
                            const uniqueTeacherIds = new Set([
                                ...(directTeachersRes.data || []).map((t: any) => t.id),
                                ...(assignedTeachersRes.data || []).map((t: any) => t.teacher_id),
                                ...(schoolLinkTeachersRes.data || []).map((t: any) => t.profile_id)
                            ].filter(Boolean))

                            const settings = settingsRes.data

                            return {
                                ...school,
                                name: settings?.name || school.name,
                                logo_url: settings?.logo_url || school.logo_url,
                                studentCount: studentsRes.count ?? 0,
                                teacherCount: uniqueTeacherIds.size,
                            }
                        })
                    )
                    setSchools(schoolsWithCounts)
                }
            } catch (error) {
                console.error('Error fetching schools:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchSchools()
    }, [])

    const filteredSchools = schools.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.slug.toLowerCase().includes(search.toLowerCase())
    )

    const getPlanBadge = (plan: string) => {
        switch (plan) {
            case 'enterprise':
                return 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20'
            case 'pro':
                return 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20'
            default:
                return 'bg-gray-50 dark:bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-500/20'
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white">{t('superAdmin.schoolsList.title')}</h1>
                    <p className="text-gray-500">{t('superAdmin.schoolsList.count').replace('{count}', schools.length.toString())}</p>
                </div>
                <Link href="/super-admin/schools/new">
                    <Button className="bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-lg shadow-purple-600/20">
                        <Plus className="w-4 h-4 mr-2" /> {t('superAdmin.schoolsList.newSchool')}
                    </Button>
                </Link>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                <Input
                    placeholder={t('superAdmin.schoolsList.searchPlaceholder')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-12 bg-white dark:bg-slate-800/50 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl h-12 shadow-sm"
                />
            </div>

            {/* Schools Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                </div>
            ) : filteredSchools.length === 0 ? (
                <div className="text-center py-20 text-gray-400 dark:text-gray-500">
                    <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>{search ? t('superAdmin.schoolsList.noResults') : t('superAdmin.schoolsList.noSchools')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredSchools.map(school => (
                        <div
                            key={school.id}
                            className="bg-white dark:bg-slate-800/50 border border-gray-150 dark:border-white/5 rounded-2xl p-5 hover:scale-[1.02] hover:shadow-xl dark:hover:border-purple-500/30 transition-all group shadow-sm"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0 overflow-hidden border border-purple-100 dark:border-purple-500/20">
                                        {school.logo_url ? (
                                            <img src={school.logo_url} alt={school.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <Building2 className="w-6 h-6" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors truncate">{school.name}</h3>
                                        <p className="text-xs text-gray-400 dark:text-gray-500">/{school.slug}</p>
                                    </div>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-900 dark:hover:text-white">
                                            <MoreHorizontal className="w-4 h-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-white dark:bg-slate-900 border-gray-200 dark:border-white/10">
                                        <DropdownMenuItem asChild>
                                            <Link href={`/super-admin/schools/${school.id}`} className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                                <Eye className="w-4 h-4" /> {t('superAdmin.schoolsList.viewDetails')}
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                            <Link href={`/super-admin/schools/${school.id}/access`} className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-medium">
                                                <Settings className="w-4 h-4" /> {t('superAdmin.schoolsList.accessAdmin')}
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem 
                                            onClick={() => setPasswordSchool(school)}
                                            className="flex items-center gap-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 font-medium cursor-pointer"
                                        >
                                            <KeyRound className="w-4 h-4 text-amber-500" /> {t('superAdmin.schoolsList.changeAdminPassword') || 'Modifier mot de passe admin'}
                                        </DropdownMenuItem>
                                        <div className="h-px bg-gray-100 dark:bg-white/5 my-1" />
                                        <DropdownMenuItem 
                                            onClick={() => setSchoolToDelete(school)}
                                            className="flex items-center gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 font-medium cursor-pointer"
                                        >
                                            <Trash2 className="w-4 h-4" /> {t('superAdmin.schoolsList.deleteSchool') || "Supprimer l'école"}
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className="flex items-center gap-2 mb-4">
                                <span className={cn(
                                    "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border",
                                    school.is_active
                                        ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                                        : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20"
                                )}>
                                    {school.is_active ? t('superAdmin.dashboard.activeLabel') : t('superAdmin.dashboard.inactiveLabel')}
                                </span>
                                <span className={cn(
                                    "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border",
                                    getPlanBadge(school.subscription_plan)
                                )}>
                                    {school.subscription_plan}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="bg-gray-50 dark:bg-slate-900/50 rounded-lg p-3 border border-gray-100 dark:border-white/5">
                                    <p className="text-gray-400 dark:text-gray-500 text-xs font-medium">{t('superAdmin.schoolsList.students')}</p>
                                    <p className="font-bold text-gray-900 dark:text-white mt-0.5">{school.studentCount} / {school.max_students}</p>
                                </div>
                                <div className="bg-gray-50 dark:bg-slate-900/50 rounded-lg p-3 border border-gray-100 dark:border-white/5">
                                    <p className="text-gray-400 dark:text-gray-500 text-xs font-medium">{t('superAdmin.schoolsList.teachers')}</p>
                                    <p className="font-bold text-gray-900 dark:text-white mt-0.5">{school.teacherCount}</p>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5 flex gap-2">
                                <Link href={`/super-admin/schools/${school.id}`} className="flex-1">
                                    <Button variant="outline" className="w-full border-gray-200 dark:border-white/10 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl transition-colors font-semibold">
                                        {t('superAdmin.schoolsList.detailsButton')}
                                    </Button>
                                </Link>
                                <Link href={`/super-admin/schools/${school.id}/access`}>
                                    <Button className="bg-purple-600 hover:bg-purple-500 text-white rounded-xl px-4 shadow-lg shadow-purple-600/10">
                                        <Eye className="w-4 h-4" />
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Delete Cascade Dialog */}
            <Dialog open={!!schoolToDelete} onOpenChange={(open) => { if (!open) setSchoolToDelete(null) }}>
                <DialogContent className="bg-white dark:bg-slate-900 border-gray-200 dark:border-white/10 max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black text-red-600 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" /> {t('superAdmin.schoolsList.deleteTitle') || "Action Irréversible"}
                        </DialogTitle>
                        <DialogDescription asChild>
                            <div className="text-gray-500 dark:text-gray-400 pt-3 text-sm leading-relaxed">
                                {t('superAdmin.schoolsList.deleteDesc').replace('{name}', schoolToDelete?.name || '')}
                                <ul className="list-disc list-inside my-3 space-y-1 text-xs font-semibold text-red-600/90 bg-red-500/5 border border-red-500/10 p-2.5 rounded-lg">
                                    <li>{t('superAdmin.schoolsList.deleteUsers')}</li>
                                    <li>{t('superAdmin.schoolsList.deleteSchedules')}</li>
                                    <li>{t('superAdmin.schoolsList.deleteGrades')}</li>
                                    <li>{t('superAdmin.schoolsList.deleteFinance')}</li>
                                </ul>
                                {t('superAdmin.schoolsList.deleteConfirmSlug').replace('{slug}', '')} <code className="font-bold text-red-600 dark:text-red-400 font-mono bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">{schoolToDelete?.slug}</code> :
                            </div>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        <Input
                            placeholder={t('superAdmin.schoolsList.deletePlaceholder') || "Saisissez le slug ici"}
                            value={deleteConfirmInput}
                            onChange={(e) => setDeleteConfirmInput(e.target.value)}
                            className="bg-transparent border-red-200 dark:border-red-900/50 focus-visible:ring-red-500 text-gray-900 dark:text-white rounded-xl"
                            disabled={isDeleting}
                        />
                    </div>
                    <DialogFooter className="gap-2 pt-2 sm:gap-0 flex flex-col-reverse sm:flex-row">
                        <Button variant="ghost" onClick={() => setSchoolToDelete(null)} disabled={isDeleting} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl w-full sm:w-auto">
                            Annuler
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteConfirm}
                            disabled={isDeleting || deleteConfirmInput !== schoolToDelete?.slug}
                            className="bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-600/10 w-full sm:w-auto"
                        >
                            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : <Trash2 className="w-4 h-4 me-2" />}
                            {t('superAdmin.schoolsList.deleteBtn') || "Supprimer définitivement"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* School Admin Password Dialog */}
            <Dialog open={!!passwordSchool} onOpenChange={(open) => {
                if (!open) {
                    setPasswordSchool(null)
                    setNewPassword('')
                    setConfirmPassword('')
                }
            }}>
                <DialogContent className="bg-white dark:bg-slate-900 border-gray-200 dark:border-white/10 max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                            <KeyRound className="w-5 h-5 text-purple-600 dark:text-purple-400" /> {t('superAdmin.schoolsList.changeAdminPassword') || 'Modifier mot de passe admin'}
                        </DialogTitle>
                        <DialogDescription>
                            {t('superAdmin.schoolsList.changeAdminPasswordDesc').replace('{name}', passwordSchool?.name || '')}
                        </DialogDescription>
                    </DialogHeader>

                    {passwordSchool && (
                        <form onSubmit={handleUpdatePassword} className="space-y-4 mt-2">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase">
                                    {t('superAdmin.usersList.newPassword') || 'Nouveau mot de passe'}
                                </label>
                                <Input
                                    type="password"
                                    required
                                    placeholder="••••••••"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="bg-transparent border-gray-200 dark:border-white/10 focus-visible:ring-purple-500 text-gray-900 dark:text-white rounded-xl"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase">
                                    {t('superAdmin.usersList.confirmPassword') || 'Confirmer le mot de passe'}
                                </label>
                                <Input
                                    type="password"
                                    required
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="bg-transparent border-gray-200 dark:border-white/10 focus-visible:ring-purple-500 text-gray-900 dark:text-white rounded-xl"
                                />
                            </div>

                            <DialogFooter className="gap-2 pt-2 sm:gap-0 flex flex-col-reverse sm:flex-row">
                                <Button type="button" variant="ghost" onClick={() => setPasswordSchool(null)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl w-full sm:w-auto">
                                    {t('common.cancel') || 'Annuler'}
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={updatingPassword}
                                    className="bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-lg shadow-purple-600/10 w-full sm:w-auto"
                                >
                                    {updatingPassword ? (
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    ) : (
                                        <KeyRound className="w-4 h-4 mr-2" />
                                    )}
                                    {t('common.save') || 'Enregistrer'}
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
