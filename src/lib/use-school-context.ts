'use client'

import { useEffect, useState } from 'react'

export interface SchoolContext {
    user_id: string
    school_id: string
    role: string | null
}

interface UseSchoolContextResult {
    context: SchoolContext | null
    loading: boolean
    error: string | null
}

let cachedContext: SchoolContext | null | undefined = undefined
let activeContextPromise: Promise<SchoolContext | null> | null = null

export function invalidateSchoolContextCache() {
    cachedContext = undefined
    activeContextPromise = null
}

export async function fetchSchoolContext(): Promise<SchoolContext | null> {
    if (typeof window === 'undefined') return null
    if (cachedContext !== undefined) return cachedContext
    if (activeContextPromise) return activeContextPromise

    activeContextPromise = (async () => {
        try {
            const res = await fetch('/api/admin/context')
            if (!res.ok) {
                cachedContext = null
                return null
            }
            const data = await res.json()
            if (data.error) {
                cachedContext = null
                return null
            }
            cachedContext = {
                user_id: data.user_id,
                school_id: data.school_id,
                role: data.role ?? null
            }
            return cachedContext
        } catch {
            cachedContext = null
            return null
        } finally {
            activeContextPromise = null
        }
    })()

    return activeContextPromise
}

export function useSchoolContext(): UseSchoolContextResult {
    const [context, setContext] = useState<SchoolContext | null>(cachedContext ?? null)
    const [loading, setLoading] = useState(cachedContext === undefined)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false

        fetchSchoolContext()
            .then(data => {
                if (cancelled) return
                if (!data) {
                    setError('not_authenticated')
                    setLoading(false)
                    return
                }
                setContext(data)
                setLoading(false)
            })
            .catch(() => {
                if (!cancelled) {
                    setError('not_authenticated')
                    setLoading(false)
                }
            })

        return () => { cancelled = true }
    }, [])

    return { context, loading, error }
}
