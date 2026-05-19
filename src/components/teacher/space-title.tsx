'use client'

import { useLanguage } from '@/i18n'

export function TeacherSpaceTitle() {
    const { t } = useLanguage()
    return (
        <div className="flex items-center gap-2.5 select-none">
            <div className="w-2 h-6 rounded-full bg-gradient-to-b from-indigo-600 to-purple-600 shadow-[0_2px_8px_rgba(79,70,229,0.35)] shrink-0" />
            <h2 className="text-xl font-black tracking-tight text-slate-800 dark:text-white">
                {t('teacher.spaceTitle') || 'Espace Enseignant'}
            </h2>
        </div>
    )
}
