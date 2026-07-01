import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST() {
    const supabase = await createClient()
    await supabase.auth.signOut({ scope: 'local' })
    return NextResponse.json({ ok: true })
}
