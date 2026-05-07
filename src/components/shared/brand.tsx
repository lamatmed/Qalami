'use client'

import { useLanguage } from '@/i18n'

export function Brand() {
    const { t } = useLanguage()
    return <>{t('common.appName')}</>
}
