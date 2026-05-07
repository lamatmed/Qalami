'use client'

import { useLanguage } from '@/i18n'

export function SuperAdminLayoutWrapper({ children }: { children: React.ReactNode }) {
    const { direction } = useLanguage()
    return (
        <div 
            dir={direction} 
            className="flex h-screen bg-gray-50 dark:bg-slate-950 flex-row w-full overflow-hidden"
        >
            {children}
        </div>
    )
}
