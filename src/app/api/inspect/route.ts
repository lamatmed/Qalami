import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const admin = createAdminClient()
        const { data: logs, error: logsErr } = await admin
            .from('activity_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10)

        const { data: profiles, error: profErr } = await admin
            .from('profiles')
            .select('id, full_name, phone, role')
            .limit(10)

        return NextResponse.json({
            logs,
            logsErr,
            profiles,
            profErr
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message })
    }
}
