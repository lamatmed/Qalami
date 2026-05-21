'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { User, Lock, Camera, KeyRound, AlertCircle, Save, ArrowLeft, Loader2, Phone } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n'
import { getTeacherProfileAction, updateTeacherProfile } from '../actions'

export default function TeacherSettingsPage() {
    const { t, direction } = useLanguage()
    const router = useRouter()
    const isRtl = direction === 'rtl'

    // Form States
    const [profile, setProfile] = useState<any>(null)
    const [fullName, setFullName] = useState('')
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [phone, setPhone] = useState('')

    // UX States
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Fetch initial profile data
    useEffect(() => {
        async function loadProfile() {
            try {
                const data = await getTeacherProfileAction()
                if (data) {
                    setProfile(data)
                    setFullName(data.full_name || '')
                    setAvatarUrl(data.avatar_url || null)
                    setPhone(data.phone || '')
                }
            } catch (error) {
                console.error('Error loading teacher profile:', error)
                toast.error(t('teacher.settings.loadError') || "Impossible de charger vos informations.")
            } finally {
                setLoading(false)
            }
        }
        loadProfile()
    }, [t])

    // Handle instant Avatar upload to Storage
    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 2 * 1024 * 1024) {
            toast.error(t('teacher.settings.avatarSizeError') || "L'image doit faire moins de 2 Mo.")
            return
        }

        setUploading(true)
        const formData = new FormData()
        formData.append('file', file)

        try {
            const response = await fetch('/api/teacher/upload-avatar', {
                method: 'POST',
                body: formData,
            })

            const result = await response.json()
            if (result.success && result.publicUrl) {
                setAvatarUrl(result.publicUrl)
                toast.success(t('teacher.settings.avatarUploadSuccess') || "Photo de profil chargée !")
            } else {
                throw new Error(result.error || 'Failed to upload')
            }
        } catch (error: any) {
            console.error('Upload failed:', error)
            toast.error(t('teacher.settings.avatarUploadError') || "Erreur lors du téléchargement de l'image.")
        } finally {
            setUploading(false)
        }
    }

    // Save all modifications
    const handleSave = async () => {
        if (!fullName.trim()) {
            toast.error(t('teacher.settings.nameRequired') || "Le nom complet est obligatoire.")
            return
        }

        if (!phone.trim()) {
            toast.error("Le numéro de téléphone est obligatoire.")
            return
        }

        if (newPassword) {
            if (newPassword.length < 6) {
                toast.error(t('teacher.settings.passwordMinLength') || "Le mot de passe doit contenir au moins 6 caractères.")
                return
            }
            if (newPassword !== confirmPassword) {
                toast.error(t('teacher.settings.passwordsMismatch') || "Les mots de passe ne correspondent pas.")
                return
            }
        }

        setSaving(true)
        try {
            const result = await updateTeacherProfile({
                fullName: fullName.trim(),
                avatarUrl: avatarUrl ?? undefined,
                newPassword: newPassword || undefined,
                phone: phone.trim(),
            })

            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success(t('teacher.settings.saveSuccess') || "Vos modifications ont été enregistrées avec succès !")
                setNewPassword('')
                setConfirmPassword('')
                router.refresh()
                setTimeout(() => {
                    router.push('/teacher')
                }, 500)
            }
        } catch (error) {
            console.error('Error updating teacher profile:', error)
            toast.error(t('common.error') || "Une erreur s'est produite.")
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-400 font-medium">
                    {t('teacher.settings.loadingText') || "Chargement de vos paramètres..."}
                </p>
            </div>
        )
    }

    const initials = fullName
        ? fullName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
        : '?'

    return (
        <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8" dir={direction}>
            {/* Sub-Header */}
            <div className="flex items-center gap-4 mb-8">
                <Button
                    variant="ghost"
                    size="icon"
                    className="text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900/40 border border-slate-100 dark:border-white/5 rounded-xl"
                    onClick={() => router.push('/teacher')}
                >
                    <ArrowLeft className={`w-5 h-5 ${isRtl ? 'rotate-180' : ''}`} />
                </Button>
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                        {t('teacher.sidebar.settings') || 'Mon Profil'}
                    </h1>
                    <p className="text-slate-400 text-sm font-medium">
                        {t('teacher.settings.subtitle') || 'Gérez les paramètres de votre compte et votre sécurité'}
                    </p>
                </div>
            </div>

            <div className="space-y-6">
                {/* Profile Information Section */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
                    <div className="flex items-center gap-3 mb-6 border-b border-slate-50 dark:border-white/5 pb-4">
                        <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                            {t('teacher.settings.personalInfo') || 'Informations Personnelles'}
                        </h2>
                    </div>

                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        {/* Avatar Selector Widget */}
                        <div className="flex flex-col items-center gap-3 shrink-0 mx-auto md:mx-0">
                            <div className="relative group">
                                <div className="w-28 h-28 rounded-3xl bg-slate-50 dark:bg-slate-800 border-2 border-indigo-100 dark:border-indigo-500/20 overflow-hidden shadow-md flex items-center justify-center">
                                    {uploading ? (
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm z-10">
                                            <Loader2 className="w-6 h-6 text-white animate-spin" />
                                        </div>
                                    ) : null}
                                    
                                    {avatarUrl ? (
                                        <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
                                            {initials}
                                        </div>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                    className="absolute -bottom-2 -right-2 bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-xl shadow-lg transition-all transform hover:scale-110 active:scale-95 border-2 border-white dark:border-slate-900"
                                    title={t('teacher.settings.changePhoto') || "Changer la photo"}
                                >
                                    <Camera className="w-4 h-4" />
                                </button>
                                
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleAvatarChange}
                                    accept="image/png, image/jpeg, image/webp"
                                    className="hidden"
                                />
                            </div>
                            <span className="text-[11px] text-slate-400 font-medium text-center">
                                {t('teacher.settings.avatarFormatHint') || 'PNG, JPG jusqu\'à 2 Mo'}
                            </span>
                        </div>

                        {/* Form fields */}
                        <div className="flex-1 w-full space-y-5">
                            <div className="space-y-2">
                                <Label className="text-slate-700 dark:text-slate-300 font-semibold">
                                    {t('teacher.settings.fullName') || 'Nom Complet'}
                                </Label>
                                <div className="relative">
                                    <User className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
                                    <Input
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className={`${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-white/5 h-11 rounded-xl focus-visible:ring-indigo-500`}
                                        placeholder={t('teacher.settings.fullNamePlaceholder') || 'Votre nom et prénom'}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-slate-700 dark:text-slate-300 font-semibold">
                                    {t('teacher.settings.phone') || 'Numéro de téléphone'}
                                </Label>
                                <div className="relative">
                                    <Phone className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
                                    <Input
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className={`${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-white/5 h-11 rounded-xl focus-visible:ring-indigo-500`}
                                        dir="ltr"
                                        placeholder="+222 XXXXXXXX"
                                    />
                                </div>
                                <p className="text-[11px] text-slate-400 italic">
                                    {t('teacher.settings.phoneHint') || "Ce numéro sert d'identifiant pour vous connecter."}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Security Section (Change Password) */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-3xl p-6 sm:p-8 shadow-sm">
                    <div className="flex items-center gap-3 mb-6 border-b border-slate-50 dark:border-white/5 pb-4">
                        <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                            {t('teacher.settings.security') || 'Sécurité du Compte'}
                        </h2>
                    </div>

                    <div className="space-y-5 max-w-lg">
                        <p className="text-sm text-slate-400 font-medium mb-2">
                            {t('teacher.settings.securityHint') || "Laissez ces champs vides si vous ne souhaitez pas modifier votre mot de passe actuel."}
                        </p>

                        <div className="space-y-2">
                            <Label className="text-slate-700 dark:text-slate-300 font-semibold">
                                {t('teacher.settings.newPassword') || 'Nouveau mot de passe'}
                            </Label>
                            <div className="relative">
                                <KeyRound className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
                                <Input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="••••••••"
                                    autoComplete="new-password"
                                    className={`${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-white/5 h-11 rounded-xl focus-visible:ring-indigo-500`}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-slate-700 dark:text-slate-300 font-semibold">
                                {t('teacher.settings.confirmPassword') || 'Confirmer le mot de passe'}
                            </Label>
                            <div className="relative">
                                <Lock className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
                                <Input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    autoComplete="new-password"
                                    className={`${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-white/5 h-11 rounded-xl focus-visible:ring-indigo-500`}
                                />
                            </div>
                            {newPassword && confirmPassword && newPassword !== confirmPassword && (
                                <p className="flex items-center gap-1.5 text-xs text-red-500 mt-1 font-medium">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    {t('teacher.settings.passwordsMismatch') || 'Les mots de passe ne correspondent pas'}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Actions Bar */}
                <div className="pt-4 flex justify-end">
                    <Button
                        onClick={handleSave}
                        disabled={saving || uploading}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 h-12 rounded-2xl font-bold shadow-lg shadow-indigo-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 w-full sm:w-auto"
                    >
                        {saving ? (
                            <>
                                <Loader2 className={`w-4 h-4 animate-spin ${isRtl ? 'ml-2' : 'mr-2'}`} />
                                {t('teacher.settings.saving') || 'Enregistrement...'}
                            </>
                        ) : (
                            <>
                                <Save className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'}`} />
                                {t('teacher.settings.saveChanges') || 'Enregistrer les modifications'}
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    )
}
