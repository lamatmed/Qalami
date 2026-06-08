'use client'

import { useState } from 'react'
import { PersonalInfoStep } from './steps/personal-info-step'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n'

export function TeacherFormWizard() {
    const { t } = useLanguage()
    const router = useRouter()
    const [formData, setFormData] = useState<{ name?: string; phone?: string; email?: string; nni?: string; address?: string; password?: string }>({})
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async () => {
        setIsSubmitting(true)
        try {
            const { createTeacher } = await import('@/app/auth/actions')
            const result = await createTeacher({
                fullName: formData.name || '',
                phone: formData.phone || undefined,
                email: formData.email || undefined,
                nni: formData.nni || undefined,
                address: formData.address || undefined,
                password: formData.password || undefined,
            })

            if (result.error) {
                toast.error(result.error)
                return
            }

            if (result.success && result.credentials) {
                const cred = result.credentials
                if ((result as any).isExisting) {
                    toast.success(t('common.success') || "Succès", {
                        description: `Cet enseignant (${cred.fullName}) est prêt. Vous pouvez l'assigner à vos classes dès maintenant.`,
                        duration: 6000,
                    })
                } else {
                    toast.success(t('admin.teachers.teacherAddedSuccess', { name: cred.fullName }), {
                        description: t('admin.teachers.passwordIs', { password: cred.password }),
                        duration: 10000,
                    })
                }
            }

            router.push('/admin/teachers')
        } catch (err: any) {
            toast.error(t('admin.teachers.creationError', { error: err.message }))
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Header with Back Button */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-gray-400 hover:text-white">
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-white">{t('admin.teachers.addTeacher')}</h1>
                    <p className="text-gray-400 text-sm">{t('admin.teachers.addTeacherDesc')}</p>
                </div>
            </div>

            {/* Form Content */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#1A2530] rounded-3xl border border-white/5 p-6 md:p-8"
            >
                <PersonalInfoStep
                    data={formData}
                    onUpdate={setFormData}
                    onNext={handleSubmit}
                    isSubmitting={isSubmitting}
                />
            </motion.div>
        </div>
    )
}
