'use client'

import { Badge } from '@/components/ui/badge'
import { User, MapPin, Briefcase, Award } from 'lucide-react'
import { useLanguage } from '@/i18n'

export function TeacherInfo({ teacherId }: { teacherId?: string }) {
    const { t } = useLanguage()

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Professional Info */}
            <div className="bg-[#1A2530] rounded-3xl border border-white/5 overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-white/5">
                    <h3 className="font-bold text-white flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-emerald-500" /> {t('admin.teachers.info.professionalTitle')}
                    </h3>
                </div>

                <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                        <p className="text-xs text-gray-500 uppercase font-bold">{t('admin.teachers.info.subjectLabel')}</p>
                        <div className="text-white font-medium flex items-center gap-2">
                            {t('admin.teachers.info.math')} <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]">{t('admin.teachers.info.levels')}</Badge>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <p className="text-xs text-gray-500 uppercase font-bold">{t('admin.teachers.info.statusLabel')}</p>
                        <p className="text-white font-medium flex items-center gap-2">
                            {t('admin.teachers.info.statusValue')} <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                        </p>
                    </div>

                    <div className="space-y-1">
                        <p className="text-xs text-gray-500 uppercase font-bold">{t('admin.teachers.info.hireDateLabel')}</p>
                        <p className="text-white font-medium">{t('admin.teachers.info.hireDateValue')}</p>
                    </div>

                    <div className="space-y-1">
                        <p className="text-xs text-gray-500 uppercase font-bold">{t('admin.teachers.info.diplomaLabel')}</p>
                        <p className="text-white font-medium flex items-center gap-2">
                            <Award className="w-4 h-4 text-purple-400" /> {t('admin.teachers.info.diplomaValue')}
                        </p>
                    </div>
                </div>
            </div>

            {/* Personal Info */}
            <div className="bg-[#1A2530] rounded-3xl border border-white/5 overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-white/5">
                    <h3 className="font-bold text-white flex items-center gap-2">
                        <User className="w-5 h-5 text-blue-500" /> {t('admin.teachers.info.personalTitle')}
                    </h3>
                </div>

                <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                        <p className="text-xs text-gray-500 uppercase font-bold">{t('admin.teachers.info.nniLabel')}</p>
                        <p className="text-white font-mono bg-[#0F1720] px-2 py-1 rounded inline-block">1234567890</p>
                    </div>

                    <div className="space-y-1">
                        <p className="text-xs text-gray-500 uppercase font-bold">{t('admin.teachers.info.birthDateLabel')}</p>
                        <p className="text-white font-medium">{t('admin.teachers.info.birthDateValue').replace('{age}', '39')}</p>
                    </div>

                    <div className="space-y-1 md:col-span-2">
                        <p className="text-xs text-gray-500 uppercase font-bold">{t('admin.teachers.info.addressLabel')}</p>
                        <p className="text-white font-medium flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-400" /> {t('admin.teachers.info.addressValue')}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
