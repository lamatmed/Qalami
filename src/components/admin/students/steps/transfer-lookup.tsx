'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Search, User, ChevronRight, ArrowLeft } from 'lucide-react'
import { RegistrationData } from '../registration-wizard'
import { useLanguage } from '@/i18n'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export interface TransferStudent {
    id: string
    fullName: string
    nationalId: string
    dateOfBirth?: string | null
    gender?: string | null
    placeOfBirth?: string | null
}

interface TransferLookupProps {
    data: RegistrationData
    updateData: (section: keyof RegistrationData, data: any) => void
    onNext: () => void
    onPrev: () => void
    savedCredentials?: any
    onTransferStudentFound: (student: TransferStudent) => void
    transferStudent?: TransferStudent | null
}

function normalizeArabicDigits(str: string): string {
    return str
        .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632))
        .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 1776))
}

export function TransferLookup({ onNext, onPrev, onTransferStudentFound, transferStudent }: TransferLookupProps) {
    const { t, direction } = useLanguage()
    const [nni, setNni] = useState(transferStudent?.nationalId ?? '')
    const [searching, setSearching] = useState(false)
    const [found, setFound] = useState<TransferStudent | null>(transferStudent ?? null)
    const [notFound, setNotFound] = useState(false)

    const handleSearch = async () => {
        if (nni.trim().length !== 10) {
            toast.error(t('admin.students.register.errors.nniLengthError'))
            return
        }
        setSearching(true)
        setNotFound(false)
        setFound(null)
        try {
            const { getStudentByNNI } = await import('@/app/auth/actions')
            const res = await getStudentByNNI(nni.trim())
            if (res.exists) {
                if (res.sameSchool) {
                    toast.error(t('admin.students.register.transferLookup.sameSchoolError').replace('{name}', res.fullName ?? ''))
                    setNotFound(false)
                    setSearching(false)
                    return
                }
                if ('stillEnrolled' in res && res.stillEnrolled) {
                    toast.error(t('admin.students.register.transferLookup.stillEnrolledError').replace('{name}', res.fullName ?? ''))
                    setNotFound(false)
                    setSearching(false)
                    return
                }
                const student: TransferStudent = {
                    id: res.id,
                    fullName: res.fullName,
                    nationalId: nni.trim(),
                    dateOfBirth: res.dateOfBirth,
                    gender: res.gender,
                    placeOfBirth: res.placeOfBirth,
                }
                setFound(student)
                onTransferStudentFound(student)
            } else {
                setNotFound(true)
            }
        } catch {
            toast.error(t('admin.students.register.errors.nniValidationError'))
        } finally {
            setSearching(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {t('admin.students.register.transferLookup.title')}
                </h2>
                <p className="text-gray-400 text-sm">
                    {t('admin.students.register.transferLookup.subtitle')}
                </p>
            </div>

            <div className="space-y-3">
                <Label>{t('admin.students.register.personal.nationalId')}</Label>
                <div className="flex gap-2">
                    <Input
                        value={nni}
                        onChange={e => {
                            const val = normalizeArabicDigits(e.target.value).replace(/\D/g, '').slice(0, 10)
                            setNni(val)
                            setFound(null)
                            setNotFound(false)
                        }}
                        maxLength={10}
                        placeholder={t('admin.students.register.transferLookup.nniPlaceholder')}
                        className="bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5 font-mono tracking-wider"
                        inputMode="numeric"
                        onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
                        dir="ltr"
                    />
                    <Button
                        onClick={handleSearch}
                        disabled={nni.length !== 10 || searching}
                        className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold px-4 shrink-0"
                    >
                        {searching ? (
                            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Search className="w-4 h-4" />
                        )}
                    </Button>
                </div>
            </div>

            {notFound && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                    <p className="text-sm text-red-400">
                        {t('admin.students.register.transferLookup.notFound')}
                    </p>
                </div>
            )}

            {found && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 bg-emerald-500/20 rounded-full flex items-center justify-center shrink-0">
                            <User className="w-6 h-6 text-emerald-500" />
                        </div>
                        <div>
                            <p className="font-bold text-gray-900 dark:text-white">{found.fullName}</p>
                            <p className="text-xs text-gray-500 font-mono">NNI: {found.nationalId}</p>
                        </div>
                    </div>
                    {(found.gender || found.placeOfBirth) && (
                        <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t border-emerald-500/20">
                            {found.gender && (
                                <div>
                                    <span className="text-gray-500">{t('admin.students.register.personal.gender')}: </span>
                                    <span className="text-gray-900 dark:text-white font-medium">
                                        {found.gender === 'male' ? t('common.male') : t('common.female')}
                                    </span>
                                </div>
                            )}
                            {found.placeOfBirth && (
                                <div>
                                    <span className="text-gray-500">{t('admin.students.register.personal.birthPlace')}: </span>
                                    <span className="text-gray-900 dark:text-white font-medium">{found.placeOfBirth}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div className="pt-4 flex gap-3">
                <Button
                    variant="outline"
                    onClick={onPrev}
                    className="flex-1 border-gray-200 dark:border-white/5 bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1A2530]"
                >
                    <ArrowLeft className={cn("w-4 h-4", direction === 'rtl' ? 'ml-2 rotate-180' : 'mr-2')} />
                    {t('common.back')}
                </Button>
                <Button
                    onClick={onNext}
                    disabled={!found}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-bold"
                >
                    {t('common.next')}
                    <ChevronRight className={cn("ml-2 w-4 h-4", direction === 'rtl' && "rotate-180")} />
                </Button>
            </div>
        </div>
    )
}
