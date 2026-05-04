'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import { useLanguage } from '@/i18n'

export function ThemeToggle({ variant = 'icon' }: { variant?: 'icon' | 'full' }) {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)
    const { t } = useLanguage()

    // Prevent hydration mismatch
    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return variant === 'full' ? (
            <div className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground">
                <div className="w-4 h-4" />
                <span>{t('common.loading')}</span>
            </div>
        ) : (
            <Button variant="ghost" size="icon" className="rounded-full">
                <div className="w-4 h-4" />
            </Button>
        )
    }

    const isDark = theme === 'dark'

    const toggleTheme = () => {
        setTheme(isDark ? 'light' : 'dark')
    }

    if (variant === 'full') {
        return (
            <button
                onClick={toggleTheme}
                className="flex items-center gap-3 w-full px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors"
            >
                {isDark ? (
                    <Sun className="w-4 h-4 text-amber-500" />
                ) : (
                    <Moon className="w-4 h-4 text-indigo-500" />
                )}
                <span>{isDark ? t('common.light') : t('common.dark')}</span>
            </button>
        )
    }

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-full"
        >
            {isDark ? (
                <Sun className="w-4 h-4 text-amber-500" />
            ) : (
                <Moon className="w-4 h-4 text-indigo-500" />
            )}
            <span className="sr-only">Toggle theme</span>
        </Button>
    )
}
