import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user
        if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        const db = createAdminClient()
        const { data: profile } = await db
            .from('profiles')
            .select('school_id')
            .eq('id', user.id)
            .maybeSingle()

        if (!profile?.school_id) return NextResponse.json({ error: 'no_school' }, { status: 403 })

        const { data, error } = await db
            .from('subjects')
            .select('*')
            .eq('school_id', profile.school_id)
            .order('name')

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        return NextResponse.json({ subjects: data ?? [] })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Erreur serveur' }, { status: 500 })
    }
}
