import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/supabase'
import { fetchSchoolContext, invalidateSchoolContextCache } from '@/lib/use-school-context'

async function getSessionUserId(): Promise<string | null> {
    const context = await fetchSchoolContext()
    return context?.user_id ?? null
}

export function invalidateUserCache() {
    invalidateSchoolContextCache()
}

export function createClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('Supabase env vars are not configured')

    const base = createBrowserClient<Database>(url, key)

    return new Proxy(base, {
        get(target, prop) {
            if (prop === 'auth') {
                const auth = target.auth
                return new Proxy(auth, {
                    get(authTarget, authProp) {
                        if (authProp === 'getUser') {
                            return async () => {
                                const userId = await getSessionUserId()
                                if (!userId) return { data: { user: null }, error: new Error('Not authenticated') }
                                return {
                                    data: {
                                        user: { id: userId, app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '' } as any,
                                    },
                                    error: null,
                                }
                            }
                        }
                        if (authProp === 'signOut') {
                            return async (opts?: { scope?: string }) => {
                                invalidateUserCache()
                                // Sign out via server-side route so cookies are cleared properly
                                await fetch('/api/auth/signout', { method: 'POST' })
                                return { error: null }
                            }
                        }
                        const val = (authTarget as any)[authProp]
                        return typeof val === 'function' ? val.bind(authTarget) : val
                    },
                })
            }
            const val = (target as any)[prop]
            return typeof val === 'function' ? val.bind(target) : val
        },
    })
}
