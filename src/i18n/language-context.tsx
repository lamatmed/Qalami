'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import frDict from './dictionaries/fr.json'
import arDict from './dictionaries/ar.json'

// Forced dictionary reload trigger comment (V10 - Teacher Schedule Translations Included)

export type Language = 'fr' | 'ar'
export type Direction = 'ltr' | 'rtl'

type Dictionary = typeof frDict

const dictionaries: Record<Language, Dictionary> = {
    fr: frDict,
    ar: arDict as Dictionary,
}

interface LanguageContextType {
    language: Language
    direction: Direction
    setLanguage: (lang: Language) => void
    t: (key: string, params?: Record<string, string | number>) => string
    dict: Dictionary
    mounted: boolean
}

const LanguageContext = createContext<LanguageContextType | null>(null)

function getNestedValue(obj: any, path: string): string {
    const keys = path.split('.')
    let current = obj
    for (const key of keys) {
        if (current === undefined || current === null) return path
        current = current[key]
    }
    if (typeof current !== 'string') return path
    return current
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = useState<Language>('fr')
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        const saved = localStorage.getItem('qalami-language')
        if (saved === 'ar' || saved === 'fr') {
            setLanguageState(saved)
        }
    }, [])

    useEffect(() => {
        if (!mounted) return
        const dir: Direction = language === 'ar' ? 'rtl' : 'ltr'
        document.documentElement.lang = language
        document.documentElement.dir = dir
        document.documentElement.classList.toggle('font-arabic', language === 'ar')
    }, [language, mounted])

    const setLanguage = useCallback((lang: Language) => {
        setLanguageState(lang)
        localStorage.setItem('qalami-language', lang)
    }, [])

    const t = useCallback((key: string, params?: Record<string, string | number>): string => {
        let value = getNestedValue(dictionaries[language], key)
        if (params) {
            Object.entries(params).forEach(([k, v]) => {
                value = value.replace(`{${k}}`, String(v))
            })
        }
        return value
    }, [language])

    const dict = dictionaries[language]
    const direction: Direction = language === 'ar' ? 'rtl' : 'ltr'

    return (
        <LanguageContext.Provider value={{ language, direction, setLanguage, t, dict, mounted }}>
            {children}
        </LanguageContext.Provider>
    )
}

export function useLanguage() {
    const context = useContext(LanguageContext)
    if (!context) {
        return {
            language: 'fr',
            direction: 'ltr',
            setLanguage: () => {},
            t: (key: string) => key,
            dict: {},
            mounted: false
        }
    }
    return context
}
