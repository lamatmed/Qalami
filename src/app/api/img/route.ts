import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

// Proxy Supabase storage images through HTTPS to avoid mixed-content blocking on Vercel
export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl
    const bucket = searchParams.get('bucket')
    const path = searchParams.get('path')

    if (!bucket || !path) {
        return new NextResponse('Missing bucket or path', { status: 400 })
    }

    try {
        const db = createAdminClient()
        const { data, error } = await db.storage.from(bucket).download(path)
        if (error || !data) {
            return new NextResponse('Image not found', { status: 404 })
        }

        const bytes = await data.arrayBuffer()
        const contentType = data.type || 'image/png'

        return new NextResponse(bytes, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
            },
        })
    } catch {
        return new NextResponse('Server error', { status: 500 })
    }
}
