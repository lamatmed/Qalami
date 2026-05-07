'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Camera, User, Phone, Mail, Briefcase, KeyRound, Loader2, UserPlus } from 'lucide-react'
import { useLanguage } from '@/i18n'

interface PersonalInfoStepProps {
    data: any
    onUpdate: (data: any) => void
    onNext: () => void
    isSubmitting?: boolean
}

export function PersonalInfoStep({ data, onUpdate, onNext, isSubmitting }: PersonalInfoStepProps) {
    const { t } = useLanguage()
    return (
        <div className="space-y-6">
            {/* Photo Upload */}
            <div className="flex flex-col items-center justify-center mb-8">
                <div className="relative group cursor-pointer">
                    <div className="h-28 w-28 rounded-full border-4 border-[#0F1720] bg-gray-700 flex items-center justify-center overflow-hidden">
                        {data.photo ? (
                            <img src={data.photo} alt="Profile" className="h-full w-full object-cover" />
                        ) : (
                            <User className="w-12 h-12 text-gray-500" />
                        )}
                    </div>
                    <div className="absolute bottom-0 right-0 bg-emerald-500 rounded-full p-2 border-4 border-[#1A2530] text-black shadow-lg group-hover:bg-emerald-400 transition-colors">
                        <Camera className="w-4 h-4" />
                    </div>
                </div>
                <p className="text-xs text-gray-400 mt-2 font-medium uppercase tracking-wider">{t('admin.teachers.profilePhoto')}</p>
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <Label className="text-gray-300">{t('admin.teachers.fullName')}</Label>
                    <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <Input
                            placeholder={t('admin.teachers.fullNamePlaceholder')}
                            className="pl-10 bg-[#0F1720] border-white/10 text-white focus:ring-emerald-500/50"
                            defaultValue={data.name}
                            onChange={(e) => onUpdate({ ...data, name: e.target.value })}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-gray-300">{t('admin.teachers.phone')}</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-bold">+222</span>
                            <Input
                                placeholder={t('admin.teachers.phonePlaceholder')}
                                className="pl-14 bg-[#0F1720] border-white/10 text-white focus:ring-emerald-500/50"
                                defaultValue={data.phone}
                                onChange={(e) => onUpdate({ ...data, phone: e.target.value })}
                            />
                            <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-gray-300">{t('admin.teachers.email')}</Label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <Input
                                placeholder={t('admin.teachers.emailPlaceholder')}
                                className="pl-10 bg-[#0F1720] border-white/10 text-white focus:ring-emerald-500/50"
                                defaultValue={data.email}
                                onChange={(e) => onUpdate({ ...data, email: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-gray-300">{t('admin.teachers.nni')}</Label>
                    <div className="relative">
                        <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <Input
                            placeholder={t('admin.teachers.nniPlaceholder')}
                            className="pl-10 bg-[#0F1720] border-white/10 text-white focus:ring-emerald-500/50"
                            defaultValue={data.nni}
                            onChange={(e) => onUpdate({ ...data, nni: e.target.value })}
                        />
                    </div>
                    <p className="text-[10px] text-gray-500 italic">{t('admin.teachers.nniHint')}</p>
                </div>

                <div className="space-y-2">
                    <Label className="text-gray-300">{t('admin.teachers.tempPassword')}</Label>
                    <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <Input
                            placeholder={t('admin.teachers.tempPasswordPlaceholder')}
                            className="pl-10 bg-[#0F1720] border-white/10 text-white focus:ring-emerald-500/50"
                            defaultValue={data.password}
                            onChange={(e) => onUpdate({ ...data, password: e.target.value })}
                        />
                    </div>
                    <p className="text-[10px] text-gray-500 italic">{t('admin.teachers.tempPasswordHint')}</p>
                </div>
            </div>

            <div className="pt-6">
                <Button
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold h-12 text-lg shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                    onClick={onNext}
                    disabled={!data.name?.trim() || !data.password?.trim() || isSubmitting}
                >
                    {isSubmitting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <><UserPlus className="w-5 h-5 mr-2" /> {t('admin.teachers.saveTeacher')}</>
                    )}
                </Button>
            </div>
        </div>
    )
}
