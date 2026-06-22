'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ArrowRight, UserPlus, ArrowLeftRight } from 'lucide-react'
import { PersonalInfo } from './steps/personal-info'
import { ParentDetails } from './steps/parent-details'
import { AcademicFinance } from './steps/academic-finance'
import { Confirmation } from './steps/confirmation'
import { TransferLookup, TransferStudent } from './steps/transfer-lookup'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n'
import { cn } from '@/lib/utils'

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

const newSteps = [
    { id: 1, titleKey: '1' },
    { id: 2, titleKey: '2' },
    { id: 3, titleKey: '3' },
    { id: 4, titleKey: '4' },
]

const transferStepCount = 3

export function RegistrationWizard() {
    const { t, direction: langDirection } = useLanguage()
    const [registrationMode, setRegistrationMode] = useState<'new' | 'transfer' | null>(null)
    const [currentStep, setCurrentStep] = useState(1)
    const [formData, setFormData] = useState<RegistrationData>(initialData)
    const [direction, setDirection] = useState(0)
    const [saving, setSaving] = useState(false)
    const [savedCredentials, setSavedCredentials] = useState<{ fullName: string; hasPhone: boolean; password: string | null; className: string } | null>(null)
    const [transferStudent, setTransferStudent] = useState<TransferStudent | null>(null)

    const updateFormData = (section: keyof RegistrationData, data: any) => {
        setFormData(prev => ({ ...prev, [section]: { ...prev[section], ...data } }))
    }

    const selectMode = (mode: 'new' | 'transfer') => {
        setRegistrationMode(mode)
        setCurrentStep(1)
        setDirection(0)
    }

    const nextStep = async () => {
        if (registrationMode === 'new') {
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
                        toast.error(t(result.error, (result as any).params))
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

            if (currentStep < 4) {
                setDirection(1)
                setCurrentStep(c => c + 1)
            }
        } else if (registrationMode === 'transfer') {
            if (currentStep === 2) {
                if (!transferStudent) {
                    toast.error('Aucun élève sélectionné')
                    return
                }
                setSaving(true)
                try {
                    const { enrollExistingStudent } = await import('@/app/auth/actions')
                    const result = await enrollExistingStudent({
                        studentId: transferStudent.id,
                        academic: formData.academic,
                        parentIds: [
                            formData.parents.parent1Id,
                            formData.parents.parent2Id,
                        ].filter(Boolean) as string[],
                    })

                    if (result.error) {
                        toast.error(t(result.error, (result as any).params))
                        setSaving(false)
                        return
                    }

                    if (result.success) {
                        setSavedCredentials({
                            fullName: result.fullName ?? transferStudent.fullName,
                            hasPhone: false,
                            password: null,
                            className: formData.academic.className,
                        })
                    }
                } catch (err: any) {
                    toast.error(`${t('admin.students.register.errors.registrationFailed')}: ${err.message}`)
                    setSaving(false)
                    return
                }
                setSaving(false)
            }

            if (currentStep < transferStepCount) {
                setDirection(1)
                setCurrentStep(c => c + 1)
            }
        }
    }

    const prevStep = () => {
        if (currentStep > 1) {
            setDirection(-1)
            setCurrentStep(c => c - 1)
        } else {
            // Back to mode selection
            setRegistrationMode(null)
            setCurrentStep(1)
        }
    }

    // Mode selection screen
    if (registrationMode === null) {
        return (
            <div className="max-w-2xl mx-auto" dir={langDirection}>
                <div className="bg-white dark:bg-[#0F1720] border border-gray-200 dark:border-white/5 rounded-3xl p-8 shadow-lg dark:shadow-2xl">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        {t('admin.students.register.mode.title')}
                    </h2>
                    <p className="text-gray-400 text-sm mb-8">
                        {t('admin.students.register.mode.subtitle')}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                            onClick={() => selectMode('new')}
                            className="flex flex-col items-start gap-3 p-6 rounded-2xl border-2 border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#1A2530] hover:border-emerald-500 hover:bg-emerald-500/5 transition-all group text-left"
                        >
                            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                                <UserPlus className="w-6 h-6 text-emerald-500" />
                            </div>
                            <div>
                                <p className="font-bold text-gray-900 dark:text-white text-base">
                                    {t('admin.students.register.mode.new.label')}
                                </p>
                                <p className="text-sm text-gray-500 mt-1">
                                    {t('admin.students.register.mode.new.desc')}
                                </p>
                            </div>
                            <ArrowRight className={cn("w-5 h-5 text-emerald-500 mt-auto opacity-0 group-hover:opacity-100 transition-opacity", langDirection === 'rtl' && "rotate-180")} />
                        </button>

                        <button
                            onClick={() => selectMode('transfer')}
                            className="flex flex-col items-start gap-3 p-6 rounded-2xl border-2 border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#1A2530] hover:border-blue-500 hover:bg-blue-500/5 transition-all group text-left"
                        >
                            <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                                <ArrowLeftRight className="w-6 h-6 text-blue-500" />
                            </div>
                            <div>
                                <p className="font-bold text-gray-900 dark:text-white text-base">
                                    {t('admin.students.register.mode.transfer.label')}
                                </p>
                                <p className="text-sm text-gray-500 mt-1">
                                    {t('admin.students.register.mode.transfer.desc')}
                                </p>
                            </div>
                            <ArrowRight className={cn("w-5 h-5 text-blue-500 mt-auto opacity-0 group-hover:opacity-100 transition-opacity", langDirection === 'rtl' && "rotate-180")} />
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    const isTransfer = registrationMode === 'transfer'
    const totalSteps = isTransfer ? transferStepCount : 4
    const stepKeys = isTransfer
        ? ['transferSteps.1', 'transferSteps.2', 'transferSteps.3']
        : ['steps.1', 'steps.2', 'steps.3', 'steps.4']

    const renderStep = () => {
        if (isTransfer) {
            if (currentStep === 1) {
                return (
                    <TransferLookup
                        data={formData}
                        updateData={updateFormData}
                        onNext={nextStep}
                        onPrev={prevStep}
                        onTransferStudentFound={setTransferStudent}
                        transferStudent={transferStudent}
                    />
                )
            }
            if (currentStep === 2) {
                return (
                    <AcademicFinance
                        data={formData}
                        updateData={updateFormData}
                        onNext={nextStep}
                        onPrev={prevStep}
                    />
                )
            }
            return (
                <Confirmation
                    data={formData}
                    updateData={updateFormData}
                    onNext={nextStep}
                    onPrev={prevStep}
                    savedCredentials={savedCredentials}
                />
            )
        }

        // New student flow
        if (currentStep === 1) return <PersonalInfo data={formData} updateData={updateFormData} onNext={nextStep} onPrev={prevStep} />
        if (currentStep === 2) return <ParentDetails data={formData} updateData={updateFormData} onNext={nextStep} onPrev={prevStep} />
        if (currentStep === 3) return <AcademicFinance data={formData} updateData={updateFormData} onNext={nextStep} onPrev={prevStep} />
        return <Confirmation data={formData} updateData={updateFormData} onNext={nextStep} onPrev={prevStep} savedCredentials={savedCredentials} />
    }

    return (
        <div className="max-w-2xl mx-auto" dir={langDirection}>
            {/* Progress Header */}
            <div className="mb-8">
                <div className="relative flex justify-between items-center mb-4 px-2" dir={langDirection}>
                    {Array.from({ length: totalSteps }, (_, i) => i + 1).map((stepId) => (
                        <div key={stepId} className="flex flex-col items-center relative z-10 group cursor-default">
                            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-all duration-300 ${currentStep > stepId ? 'bg-emerald-500 text-black' :
                                currentStep === stepId ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/30 ring-4 ring-emerald-500/20' :
                                    'bg-gray-100 dark:bg-[#1A2530] text-gray-500 border border-gray-200 dark:border-white/5'
                                }`}>
                                {currentStep > stepId ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : stepId}
                            </div>
                            <span className={`text-[10px] sm:text-xs mt-2 font-medium text-center max-w-[65px] sm:max-w-[100px] truncate transition-colors duration-300 ${currentStep >= stepId ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-600'
                                }`}>
                                {t(`admin.students.register.${stepKeys[stepId - 1]}`)}
                            </span>
                        </div>
                    ))}
                    <div className="absolute top-[18px] sm:top-5 left-4 right-4 h-[2px] bg-gray-200 dark:bg-[#1A2530] -z-0 hidden sm:block" />
                </div>
            </div>

            {/* Step Content */}
            <div className="bg-white dark:bg-[#0F1720] border border-gray-200 dark:border-white/5 rounded-3xl p-6 sm:p-8 shadow-lg dark:shadow-2xl relative overflow-hidden min-h-[500px] flex flex-col" dir={langDirection}>
                {saving && (
                    <div className="absolute inset-0 z-20 bg-white/80 dark:bg-[#0F1720]/80 flex items-center justify-center backdrop-blur-sm rounded-3xl">
                        <div className="text-center space-y-3">
                            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                                {isTransfer ? t('admin.students.register.transferSaving') : t('admin.students.register.saving')}
                            </p>
                        </div>
                    </div>
                )}
                <div className="flex-1">
                    <AnimatePresence mode="wait" custom={direction}>
                        <motion.div
                            key={`${registrationMode}-${currentStep}`}
                            custom={direction}
                            initial={{ x: direction > 0 ? 20 : -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: direction > 0 ? -20 : 20, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="h-full"
                        >
                            {renderStep()}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    )
}
