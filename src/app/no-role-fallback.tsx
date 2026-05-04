'use client'

import { Button } from '@/components/ui/button'
import { ShieldAlert } from 'lucide-react'
import { useLanguage } from '@/i18n'

interface NoRoleFallbackProps {
    userId: string
    role?: string | null
    errorMessage?: string | null
    signOutAction: () => Promise<void>
}

export default function NoRoleFallback({
    userId,
    role,
    errorMessage,
    signOutAction,
}: NoRoleFallbackProps) {
    const { t, direction } = useLanguage()

    return (
        <div
            className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-[#09090b] p-8 text-center"
            dir={direction}
        >
            <div className="bg-white dark:bg-[#1c1c1e] p-8 rounded-3xl shadow-xl border border-orange-200 dark:border-orange-900/20 max-w-md w-full">
                <div className="h-20 w-20 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <ShieldAlert className="h-10 w-10 text-orange-500 dark:text-orange-400" />
                </div>

                <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
                    {t('errors.noRole')}
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
                    {t('errors.noRoleDesc')}
                </p>

                <div className="text-xs text-gray-400 dark:text-gray-600 mb-6 space-y-1 font-mono">
                    <p>ID: {userId}</p>
                    <p>Role: {role ?? '—'}</p>
                    {errorMessage && <p>Error: {errorMessage}</p>}
                </div>

                <form action={signOutAction}>
                    <Button variant="outline" className="w-full">
                        {t('errors.signOut')}
                    </Button>
                </form>
            </div>
        </div>
    )
}
