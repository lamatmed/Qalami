'use client'

import { useState } from 'react'
import { Building2, ArrowLeft, Loader2, Sparkles, Phone, Mail, MapPin, Layers, Users2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n'
import { cn } from '@/lib/utils'

export function SchoolForm() {
    const { t, direction } = useLanguage()
    const supabase = createClient()
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({
        name: '',
        slug: '',
        email: '',
        phone: '',
        address: '',
        subscription_plan: 'free',
        max_students: 100,
    })

    const handleSlugify = (name: string) => {
        return name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.name || !form.slug) {
            toast.error(t('superAdmin.schools.new.fillRequired'))
            return
        }

        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('schools')
                .insert({
                    name: form.name,
                    slug: form.slug,
                    email: form.email || null,
                    phone: form.phone || null,
                    address: form.address || null,
                    subscription_plan: form.subscription_plan,
                    max_students: form.max_students,
                    is_active: true,
                })
                .select()
                .single()

            if (error) throw error

            toast.success(t('superAdmin.schools.new.createSuccess'))
            router.push(`/super-admin/schools/${data.id}`)
        } catch (error: any) {
            console.error('Error creating school:', error)
            toast.error(error.message || t('superAdmin.schools.new.createError'))
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
                            <Input
                                value={form.phone}
                                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                placeholder={t('superAdmin.schools.new.phonePlaceholder')}
                                className="bg-gray-50/60 dark:bg-slate-950/50 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-2xl h-12 transition-all focus:bg-white focus:ring-2 focus:ring-purple-500/20"
                            />
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
                                onChange={(e) => setForm({ ...form, subscription_plan: e.target.value })}
                                className="w-full h-12 px-4 rounded-2xl bg-gray-50/60 dark:bg-slate-950/50 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:bg-white focus:ring-2 focus:ring-purple-500/20 transition-all font-semibold outline-none"
                            >
                                <option value="free">Free</option>
                                <option value="pro">Pro</option>
                                <option value="enterprise">Enterprise</option>
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
