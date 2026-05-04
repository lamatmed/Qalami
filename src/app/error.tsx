'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { useLanguage } from '@/i18n'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    const { t, direction } = useLanguage()

    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error)
    }, [error])

    return (
        <div
            className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 dark:bg-[#09090b] text-center p-4"
            dir={direction}
        >
            <div className="bg-white dark:bg-[#1c1c1e] p-8 rounded-3xl shadow-xl border border-red-200 dark:border-red-900/20 max-w-md w-full">
                <div className="h-20 w-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="h-10 w-10 text-red-600 dark:text-red-500" />
                </div>

                <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
                    {t('errors.serverError')}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm">
                    {t('errors.serverErrorDesc')}
                </p>

                <Button
                    onClick={() => reset()}
                    variant="outline"
                    className="w-full gap-2 border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-red-900/30 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                >
                    <RefreshCw className="h-4 w-4" />
                    {t('errors.tryAgain')}
                </Button>
            </div>
        </div>
    )
}
