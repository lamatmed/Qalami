'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check } from 'lucide-react'
import { PersonalInfo } from './steps/personal-info'
import { ParentDetails } from './steps/parent-details'
import { AcademicFinance } from './steps/academic-finance'
import { Confirmation } from './steps/confirmation'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n'

export type RegistrationData = {
    personal: {
        firstName: string
        lastName: string
        dateOfBirth: string
        gender: 'male' | 'female' | ''
        placeOfBirth: string
        nationalId?: string
        address?: string
        photo?: File
        hasPhone: boolean
        phone?: string
        password?: string
    }
    parents: {
        parent1Id?: string
        parent1Name?: string
        parent2Id?: string
        parent2Name?: string
    }
    academic: {
        level: string
        levelId?: string
        className: string
        academicYear: string
        registrationFee: number
        monthlyTuition: number
        tuitionFee: number
        isPaid: boolean
        advanceMonths: number
    }
}

// Compute current academic year: Sep–Aug cycle
const now = new Date()
const currentAcademicYear = now.getMonth() >= 8
    ? `${now.getFullYear()}-${now.getFullYear() + 1}`
    : `${now.getFullYear() - 1}-${now.getFullYear()}`

const initialData: RegistrationData = {
    personal: { firstName: '', lastName: '', dateOfBirth: '', gender: '', placeOfBirth: '', nationalId: '', address: '', hasPhone: false },
    parents: {},
    academic: { level: '', className: '', academicYear: currentAcademicYear, registrationFee: 500, monthlyTuition: 1200, tuitionFee: 11300, isPaid: true, advanceMonths: 0 }
}

const steps = [
    { id: 1, title: 'Infos', component: PersonalInfo },
    { id: 2, title: 'Parents', component: ParentDetails },
    { id: 3, title: 'Classe', component: AcademicFinance },
    { id: 4, title: 'Confirmation', component: Confirmation }
]

export function RegistrationWizard() {
    const { t, direction: langDirection } = useLanguage()
    const [currentStep, setCurrentStep] = useState(1)
    const [formData, setFormData] = useState<RegistrationData>(initialData)
    const [direction, setDirection] = useState(0)
    const [saving, setSaving] = useState(false)
    const [savedCredentials, setSavedCredentials] = useState<{ fullName: string; hasPhone: boolean; password: string | null; className: string } | null>(null)

    const updateFormData = (section: keyof RegistrationData, data: any) => {
        setFormData(prev => ({ ...prev, [section]: { ...prev[section], ...data } }))
    }

    const nextStep = async () => {
        // When moving from Step 3 to Step 4, save to DB
        if (currentStep === 3) {
            setSaving(true)
            try {
                const { createStudent } = await import('@/app/auth/actions')
                const result = await createStudent({
                    personal: {
                        firstName: formData.personal.firstName,
                        lastName: formData.personal.lastName,
                        dateOfBirth: formData.personal.dateOfBirth,
                        gender: formData.personal.gender,
                        placeOfBirth: formData.personal.placeOfBirth,
                        nationalId: formData.personal.nationalId,
                        address: formData.personal.address,
                    },
                    hasPhone: formData.personal.hasPhone,
                    phone: formData.personal.hasPhone ? formData.personal.phone : undefined,
                    password: formData.personal.hasPhone ? formData.personal.password : undefined,
                    parentIds: [
                        formData.parents.parent1Id,
                        formData.parents.parent2Id,
                    ].filter(Boolean) as string[],
                    academic: formData.academic,
                })

                if (result.error) {
                    toast.error(result.error)
                    setSaving(false)
                    return
                }

                if (result.success && result.credentials) {
                    setSavedCredentials(result.credentials)
                }
            } catch (err: any) {
                toast.error(`${t('admin.students.register.errors.registrationFailed')}: ${err.message}`)
                setSaving(false)
                return
            }
            setSaving(false)
        }

        if (currentStep < steps.length) {
            setDirection(1)
            setCurrentStep(c => c + 1)
        }
    }

    const prevStep = () => {
        if (currentStep > 1) {
            setDirection(-1)
            setCurrentStep(c => c - 1)
        }
    }

    const CurrentComponent = steps[currentStep - 1].component

    return (
        <div className="max-w-2xl mx-auto" dir={langDirection}>
            {/* Progress Header */}
            <div className="mb-8">
                <div className="flex justify-between items-center mb-4 px-2" dir={langDirection}>
                                {steps.map((step) => (
                        <div key={step.id} className="flex flex-col items-center relative z-10 group cursor-default">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${currentStep > step.id ? 'bg-emerald-500 text-black' :
                                currentStep === step.id ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/30 ring-4 ring-emerald-500/20' :
                                    'bg-gray-100 dark:bg-[#1A2530] text-gray-500 border border-gray-200 dark:border-white/5'
                                }`}>
                                {currentStep > step.id ? <Check className="w-5 h-5" /> : step.id}
                            </div>
                            <span className={`text-xs mt-2 font-medium transition-colors duration-300 ${currentStep >= step.id ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-600'
                                }`}>
                                {t(`admin.students.register.steps.${step.id}`)}
                            </span>
                        </div>
                    ))}
                    {/* Progress Bar Background */}
                    <div className="absolute top-5 left-0 w-full h-[2px] bg-gray-200 dark:bg-[#1A2530] -z-0 hidden sm:block" />
                </div>
            </div>

            {/* Step Content */}
            <div className="bg-white dark:bg-[#0F1720] border border-gray-200 dark:border-white/5 rounded-3xl p-6 sm:p-8 shadow-lg dark:shadow-2xl relative overflow-hidden min-h-[500px] flex flex-col" dir={langDirection}>
                {saving && (
                    <div className="absolute inset-0 z-20 bg-white/80 dark:bg-[#0F1720]/80 flex items-center justify-center backdrop-blur-sm rounded-3xl">
                        <div className="text-center space-y-3">
                            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">{t('admin.students.register.saving')}</p>
                        </div>
                    </div>
                )}
                <div className="flex-1">
                    <AnimatePresence mode="wait" custom={direction}>
                        <motion.div
                            key={currentStep}
                            custom={direction}
                            initial={{ x: direction > 0 ? 20 : -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: direction > 0 ? -20 : 20, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="h-full"
                        >
                            <CurrentComponent
                                data={formData}
                                updateData={updateFormData}
                                onNext={nextStep}
                                onPrev={prevStep}
                                savedCredentials={savedCredentials}
                            />
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    )
}
