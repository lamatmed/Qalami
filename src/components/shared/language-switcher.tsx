'use client'

import { useLanguage } from '@/i18n'
import { Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LanguageSwitcherProps {
    variant?: 'icon' | 'full' | 'compact'
    className?: string
}

export function LanguageSwitcher({ variant = 'compact', className }: LanguageSwitcherProps) {
    const { language, setLanguage } = useLanguage()

    const toggleLanguage = () => {
        setLanguage(language === 'fr' ? 'ar' : 'fr')
    }

    if (variant === 'icon') {
        return (
            <button
                onClick={toggleLanguage}
                className={cn(
                    "flex items-center justify-center w-9 h-9 rounded-lg transition-colors",
                    "hover:bg-accent text-muted-foreground hover:text-foreground",
                    className
                )}
                title={language === 'fr' ? 'العربية' : 'Français'}
            >
                <Globe className="h-5 w-5" />
            </button>
        )
    }

    if (variant === 'full') {
        return (
            <button
                onClick={toggleLanguage}
                className={cn(
                    "flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-colors",
                    "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    className
                )}
            >
                <Globe className="h-5 w-5" />
                <span className="text-sm font-medium">
                    {language === 'fr' ? 'العربية' : 'Français'}
                </span>
                <span className="ms-auto text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                    {language === 'fr' ? 'AR' : 'FR'}
                </span>
            </button>
        )
    }

    // compact variant
    return (
        <button
            onClick={toggleLanguage}
            className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                "bg-accent/50 hover:bg-accent text-muted-foreground hover:text-foreground",
                className
            )}
        >
            <Globe className="h-4 w-4" />
            <span>{language === 'fr' ? 'AR' : 'FR'}</span>
        </button>
    )
}
