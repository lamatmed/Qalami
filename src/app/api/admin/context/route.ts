import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET() {
    const supabase = await createClient()

    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
        return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const { data: profile, error: profileErr } = await adminClient
        .from('profiles')
        .select('school_id, role')
        .eq('id', user.id)
        .single()

    if (profileErr || !profile?.school_id) {
        return NextResponse.json({ error: 'no_school' }, { status: 403 })
    }

    return NextResponse.json({
        user_id: user.id,
        school_id: profile.school_id,
        role: profile.role ?? null,
    })
}
