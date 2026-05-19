'use client'

import { useLanguage } from '@/i18n'

export function SuperAdminLayoutWrapper({ children }: { children: React.ReactNode }) {
    const { direction } = useLanguage()
    return (
        <div 
            dir={direction} 
            className="relative flex h-screen bg-slate-50 dark:bg-slate-950 flex-row w-full overflow-hidden font-sans selection:bg-purple-500/30 selection:text-purple-900 dark:selection:text-purple-100"
        >
            {/* Dynamic Background Glow Elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none pointer-events-none z-0 opacity-20 dark:opacity-40">
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-purple-500 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-soft-light animate-pulse" style={{ animationDuration: '8s' }} />
                <div className="absolute top-1/2 -left-24 w-64 h-64 bg-indigo-500 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-soft-light animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
            </div>

            <div className="relative flex flex-row w-full z-10 h-full">
                {children}
            </div>
        </div>
    )
}

