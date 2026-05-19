'use client'

import { useState } from 'react'
import { Building2, ArrowLeft, Loader2, Sparkles, Phone, Mail, MapPin, Layers, Users2, ChevronDown, KeyRound, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n'
import { cn } from '@/lib/utils'
import { createSchoolWithAdmin } from '@/app/super-admin/schools/actions'

const COUNTRY_CODES = [
    { code: '+222', flag: '🇲🇷', name: 'Mauritanie' },
    { code: '+221', flag: '🇸🇳', name: 'Sénégal' },
    { code: '+223', flag: '🇲🇱', name: 'Mali' },
    { code: '+212', flag: '🇲🇦', name: 'Maroc' },
    { code: '+213', flag: '🇩🇿', name: 'Algérie' },
    { code: '+216', flag: '🇹🇳', name: 'Tunisie' },
    { code: '+33', flag: '🇫🇷', name: 'France' },
    { code: '+1', flag: '🇺🇸', name: 'USA' },
]

const PLAN_LIMITS: Record<string, number> = {
    free: 100,
    pro: 1000,
    enterprise: 5000,
}

export function SchoolForm() {
    const { t, direction } = useLanguage()
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    
    const [countryCode, setCountryCode] = useState(COUNTRY_CODES[0])
    const [showCountryDropdown, setShowCountryDropdown] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    const [form, setForm] = useState({
        name: '',
        slug: '',
        email: '',
        phone: '',
        address: '',
        subscription_plan: 'free',
        max_students: PLAN_LIMITS.free,
        admin_password: '000000',
    })

    const handleSlugify = (name: string) => {
        return name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
    }

    const handlePlanChange = (plan: string) => {
        setForm({
            ...form,
            subscription_plan: plan,
            max_students: PLAN_LIMITS[plan] || 100
        })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.name || !form.slug) {
            toast.error(t('superAdmin.schools.new.fillRequired'))
            return
        }

        setLoading(true)
        try {
            const fullPhone = form.phone 
                ? countryCode.code + form.phone.replace(/^0+/, '').trim()
                : ''

            const result = await createSchoolWithAdmin({
                name: form.name,
                slug: form.slug,
                email: form.email,
                phone: fullPhone,
                address: form.address,
                subscriptionPlan: form.subscription_plan,
                maxStudents: form.max_students,
                adminPassword: form.admin_password,
            })

            if (result.error) {
                toast.error(result.error)
            } else {
                if (result.warning) {
                    toast.warning(result.warning, { duration: 6000 })
                } else {
                    toast.success(t('superAdmin.schools.new.createSuccess'))
                }
                router.push(`/super-admin/schools/${result.schoolId}`)
            }
        } catch (error: any) {
            console.error('Error creating school:', error)
            toast.error(t('superAdmin.schools.new.createError'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-3xl mx-auto pb-12 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <Link href="/super-admin/schools">
                    <Button variant="outline" size="icon" className="rounded-2xl border-gray-200 dark:border-white/10 text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 bg-white dark:bg-slate-900 shadow-sm">
                        <ArrowLeft className={cn("w-5 h-5", direction === 'rtl' && 'rotate-180')} />
                    </Button>
                </Link>
                <div>
                    <div className="flex items-center gap-2">
                        <span className="p-1 px-2.5 rounded-full bg-purple-500/10 text-purple-600 text-[10px] font-black tracking-wider uppercase mb-1">
                            {t('common.superAdmin')}
                        </span>
                    </div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                        {t('superAdmin.schools.new.title')}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {t('superAdmin.schools.new.subtitle')}
                    </p>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Section 1: Informations Générales */}
                <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-3xl p-8 shadow-sm space-y-6">
                    <div className="flex items-center gap-4 pb-4 border-b border-gray-100 dark:border-white/5">
                        <div className="h-12 w-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500 shrink-0">
                            <Building2 className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="font-bold text-gray-900 dark:text-white text-lg">
                                {t('superAdmin.schools.new.generalInfo')}
                            </h2>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-gray-600 dark:text-gray-400 font-bold text-xs uppercase tracking-wider">
                                {t('superAdmin.schools.new.schoolName')}
                            </Label>
                            <div className="relative">
                                <Input
                                    value={form.name}
                                    onChange={(e) => {
                                        setForm({
                                            ...form,
                                            name: e.target.value,
                                            slug: handleSlugify(e.target.value)
                                        })
                                    }}
                                    placeholder={t('superAdmin.schools.new.schoolNamePlaceholder')}
                                    className="bg-gray-50/60 dark:bg-slate-950/50 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-2xl h-12 transition-all focus:bg-white focus:ring-2 focus:ring-purple-500/20"
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-gray-600 dark:text-gray-400 font-bold text-xs uppercase tracking-wider">
                                {t('superAdmin.schools.new.slug')}
                            </Label>
                            <Input
                                value={form.slug}
                                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                                placeholder={t('superAdmin.schools.new.slugPlaceholder')}
                                className="bg-gray-50/60 dark:bg-slate-950/50 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-2xl h-12 transition-all focus:bg-white focus:ring-2 focus:ring-purple-500/20"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-gray-600 dark:text-gray-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                                <Mail className="w-3.5 h-3.5 text-gray-400" />
                                {t('superAdmin.schools.new.email')}
                            </Label>
                            <Input
                                type="email"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                placeholder={t('superAdmin.schools.new.emailPlaceholder')}
                                className="bg-gray-50/60 dark:bg-slate-950/50 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-2xl h-12 transition-all focus:bg-white focus:ring-2 focus:ring-purple-500/20"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-gray-600 dark:text-gray-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-gray-400" />
                                {t('superAdmin.schools.new.phone')}
                            </Label>
                            
                            <div className="relative flex items-center group">
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setShowCountryDropdown(v => !v)}
                                        className={cn(
                                            "h-12 flex items-center gap-1.5 px-3 bg-gray-50/60 dark:bg-slate-950/50 border border-gray-200 dark:border-white/10 text-sm font-bold hover:bg-gray-100 dark:hover:bg-slate-900 transition-all",
                                            direction === 'rtl' ? "rounded-r-2xl border-l-0" : "rounded-l-2xl border-r-0"
                                        )}
                                    >
                                        <span className="text-lg">{countryCode.flag}</span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">{countryCode.code}</span>
                                        <ChevronDown className={cn("w-3.5 h-3.5 text-gray-400 transition-transform", showCountryDropdown && "rotate-180")} />
                                    </button>
                                    
                                    {showCountryDropdown && (
                                        <>
                                            <div className="fixed inset-0 z-20" onClick={() => setShowCountryDropdown(false)} />
                                            <div className={cn(
                                                "absolute top-full mt-1 bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/10 rounded-2xl shadow-xl z-30 py-2 min-w-[200px] max-h-64 overflow-y-auto scrollbar-thin animate-in fade-in slide-in-from-top-2",
                                                direction === 'rtl' ? "right-0" : "left-0"
                                            )}>
                                                {COUNTRY_CODES.map(cc => (
                                                    <button
                                                        key={cc.code}
                                                        type="button"
                                                        onClick={() => { setCountryCode(cc); setShowCountryDropdown(false) }}
                                                        className={cn(
                                                            "w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left",
                                                            cc.code === countryCode.code && "bg-purple-50/50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold"
                                                        )}
                                                    >
                                                        <span className="text-lg">{cc.flag}</span>
                                                        <span className="flex-1 text-gray-700 dark:text-gray-300">{cc.name}</span>
                                                        <span className="text-gray-400 dark:text-gray-500 text-xs ml-auto">{cc.code}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                                
                                <Input
                                    value={form.phone}
                                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                    placeholder="36 12 34 56"
                                    dir="ltr"
                                    className={cn(
                                        "bg-gray-50/60 dark:bg-slate-950/50 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white h-12 transition-all focus:bg-white focus:ring-2 focus:ring-purple-500/20 flex-1",
                                        direction === 'rtl' ? "rounded-l-2xl" : "rounded-r-2xl"
                                    )}
                                />
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <Label className="text-gray-600 dark:text-gray-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                                <KeyRound className="w-3.5 h-3.5 text-gray-400" />
                                {t('admin.users.password')}
                            </Label>
                            <div className="relative">
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    value={form.admin_password}
                                    onChange={(e) => setForm({ ...form, admin_password: e.target.value })}
                                    placeholder={t('admin.users.passwordPlaceholder')}
                                    className="bg-gray-50/60 dark:bg-slate-950/50 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-2xl h-12 pr-12 transition-all focus:bg-white focus:ring-2 focus:ring-purple-500/20"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-purple-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-gray-600 dark:text-gray-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-gray-400" />
                            {t('superAdmin.schools.new.address')}
                        </Label>
                        <Input
                            value={form.address}
                            onChange={(e) => setForm({ ...form, address: e.target.value })}
                            placeholder={t('superAdmin.schools.new.addressPlaceholder')}
                            className="bg-gray-50/60 dark:bg-slate-950/50 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-2xl h-12 transition-all focus:bg-white focus:ring-2 focus:ring-purple-500/20"
                        />
                    </div>
                </div>

                {/* Section 2: Abonnement */}
                <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-3xl p-8 shadow-sm space-y-6">
                    <div className="flex items-center gap-4 pb-4 border-b border-gray-100 dark:border-white/5">
                        <div className="h-12 w-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500 shrink-0">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="font-bold text-gray-900 dark:text-white text-lg">
                                {t('superAdmin.schools.new.subscription')}
                            </h2>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-gray-600 dark:text-gray-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-gray-400" />
                                {t('superAdmin.schools.new.plan')}
                            </Label>
                            <select
                                value={form.subscription_plan}
                                onChange={(e) => handlePlanChange(e.target.value)}
                                className="w-full h-12 px-4 rounded-2xl bg-gray-50/60 dark:bg-slate-950/50 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:bg-white focus:ring-2 focus:ring-purple-500/20 transition-all font-semibold outline-none"
                            >
                                <option value="free">Free (100 max)</option>
                                <option value="pro">Pro (1000 max)</option>
                                <option value="enterprise">Enterprise (5000 max)</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-gray-600 dark:text-gray-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                                <Users2 className="w-3.5 h-3.5 text-gray-400" />
                                {t('superAdmin.schools.new.limitStudents')}
                            </Label>
                            <Input
                                type="number"
                                value={form.max_students}
                                onChange={(e) => setForm({ ...form, max_students: parseInt(e.target.value) || 100 })}
                                className="bg-gray-50/60 dark:bg-slate-950/50 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-2xl h-12 transition-all focus:bg-white focus:ring-2 focus:ring-purple-500/20"
                            />
                        </div>
                    </div>
                </div>

                {/* Submit and Cancel Buttons */}
                <div className="flex gap-4">
                    <Link href="/super-admin/schools" className="flex-1">
                        <Button type="button" variant="outline" className="w-full border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-2xl h-12 font-bold">
                            {t('superAdmin.schools.new.cancel')}
                        </Button>
                    </Link>
                    <Button
                        type="submit"
                        disabled={loading}
                        className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-2xl h-12 shadow-lg shadow-purple-600/20 transition-all duration-300"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                {t('superAdmin.schools.new.creating')}
                            </>
                        ) : (
                            t('superAdmin.schools.new.create')
                        )}
                    </Button>
                </div>
            </form>
        </div>
    )
}
