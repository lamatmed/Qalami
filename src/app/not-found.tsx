'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FileQuestion, ArrowLeft } from 'lucide-react'
import { useLanguage } from '@/i18n'

export default function NotFound() {
    const { t, direction } = useLanguage()

    return (
        <div
            className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 dark:bg-[#09090b] text-center p-4"
            dir={direction}
        >
            <div className="bg-white dark:bg-[#1c1c1e] p-8 rounded-3xl shadow-xl border border-gray-200 dark:border-white/5 max-w-md w-full">
                <div className="h-20 w-20 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FileQuestion className="h-10 w-10 text-gray-500 dark:text-gray-400" />
                </div>

                <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
                    {t('errors.notFound')}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mb-8">
                    {t('errors.notFoundDesc')}
                </p>

                <Link href="/">
                    <Button className="w-full gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        {t('errors.goHome')}
                    </Button>
                </Link>
            </div>
        </div>
    )
}
