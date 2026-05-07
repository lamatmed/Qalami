'use client'

import { useLanguage } from '@/i18n'

export function TeacherSpaceTitle() {
    const { t } = useLanguage()
    return (
        <h2 className="text-xl font-bold text-gray-800 dark:text-foreground">
            {t('teacher.spaceTitle') || 'Espace Enseignant'}
        </h2>
    )
}
