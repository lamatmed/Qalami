'use client'

import { useState } from 'react'
import { Building2, ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'

export function SchoolForm() {
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
            toast.error('Veuillez remplir les champs obligatoires')
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

            toast.success('École créée avec succès!')
            router.push(`/super-admin/schools/${data.id}`)
        } catch (error: any) {
            console.error('Error creating school:', error)
            toast.error(error.message || 'Erreur lors de la création')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-2xl">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <Link href="/super-admin/schools">
                    <Button variant="ghost" size="icon" className="rounded-xl text-gray-400 hover:text-white">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-black text-white">Nouvelle école</h1>
                    <p className="text-gray-500">Créer une nouvelle école sur la plateforme</p>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-slate-800/50 border border-white/5 rounded-2xl p-6 space-y-6">
                    <div className="flex items-center gap-4 pb-4 border-b border-white/5">
                        <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                            <Building2 className="w-6 h-6" />
                        </div>
                        <h2 className="font-bold text-white">Informations générales</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-gray-400">Nom de l'école *</Label>
                            <Input
                                value={form.name}
                                onChange={(e) => {
                                    setForm({
                                        ...form,
                                        name: e.target.value,
                                        slug: handleSlugify(e.target.value)
                                    })
                                }}
                                placeholder="École Al-Nour"
                                className="bg-slate-900/50 border-white/10 text-white rounded-xl"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-gray-400">Slug (URL) *</Label>
                            <Input
                                value={form.slug}
                                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                                placeholder="al-nour"
                                className="bg-slate-900/50 border-white/10 text-white rounded-xl"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-gray-400">Email</Label>
                            <Input
                                type="email"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                placeholder="contact@ecole.mr"
                                className="bg-slate-900/50 border-white/10 text-white rounded-xl"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-gray-400">Téléphone</Label>
                            <Input
                                value={form.phone}
                                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                placeholder="+222 XX XX XX XX"
                                className="bg-slate-900/50 border-white/10 text-white rounded-xl"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-gray-400">Adresse</Label>
                        <Input
                            value={form.address}
                            onChange={(e) => setForm({ ...form, address: e.target.value })}
                            placeholder="Nouakchott, Mauritanie"
                            className="bg-slate-900/50 border-white/10 text-white rounded-xl"
                        />
                    </div>
                </div>

                <div className="bg-slate-800/50 border border-white/5 rounded-2xl p-6 space-y-6">
                    <h2 className="font-bold text-white">Abonnement</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-gray-400">Plan</Label>
                            <select
                                value={form.subscription_plan}
                                onChange={(e) => setForm({ ...form, subscription_plan: e.target.value })}
                                className="w-full h-10 px-3 rounded-xl bg-slate-900/50 border border-white/10 text-white"
                            >
                                <option value="free">Free</option>
                                <option value="pro">Pro</option>
                                <option value="enterprise">Enterprise</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-gray-400">Limite d'élèves</Label>
                            <Input
                                type="number"
                                value={form.max_students}
                                onChange={(e) => setForm({ ...form, max_students: parseInt(e.target.value) || 100 })}
                                className="bg-slate-900/50 border-white/10 text-white rounded-xl"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex gap-3">
                    <Link href="/super-admin/schools" className="flex-1">
                        <Button type="button" variant="outline" className="w-full border-white/10 text-white hover:bg-white/5 rounded-xl h-12">
                            Annuler
                        </Button>
                    </Link>
                    <Button
                        type="submit"
                        disabled={loading}
                        className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl h-12"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Création...
                            </>
                        ) : (
                            'Créer l\'école'
                        )}
                    </Button>
                </div>
            </form>
        </div>
    )
}
