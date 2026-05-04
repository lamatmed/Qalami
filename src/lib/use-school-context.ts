'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

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

/**
 * Client-side equivalent of the server action `getMySchoolContext()`.
 * Fetches the authenticated user, their school_id and role, and caches them.
 */
export function useSchoolContext(): UseSchoolContextResult {
    const [context, setContext] = useState<SchoolContext | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        async function load() {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                if (!cancelled) { setError('not_authenticated'); setLoading(false) }
                return
            }
            const { data: profile } = await supabase
                .from('profiles')
                .select('school_id, role')
                .eq('id', user.id)
                .single()
            if (cancelled) return
            if (!profile?.school_id) {
                setError('no_school')
                setLoading(false)
                return
            }
            setContext({ user_id: user.id, school_id: profile.school_id, role: profile.role ?? null })
            setLoading(false)
        }
        load()
        return () => { cancelled = true }
    }, [])

    return { context, loading, error }
}
