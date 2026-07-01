import withPWAInit from "@ducanh2912/next-pwa";
import type { NextConfig } from "next";

const withPWA = withPWAInit({
    dest: "public",
    disable: process.env.NODE_ENV === "development",
    register: true,
    workboxOptions: {
        skipWaiting: true,
    },
});

function getSupabaseOrigins() {
    const raw = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!raw) return { http: 'https://*.supabase.co', ws: 'wss://*.supabase.co' }
    const url = new URL(raw)
    const port = url.port ? `:${url.port}` : ''
    const host = `${url.hostname}${port}`
    const wsScheme = url.protocol === 'https:' ? 'wss:' : 'ws:'
    return {
        http: `${url.protocol}//${host}`,
        ws: `${wsScheme}//${host}`,
    }
}

const { http: SUPABASE_HTTP, ws: SUPABASE_WS } = getSupabaseOrigins()

const securityHeaders = [
    { key: 'X-Frame-Options',        value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy',     value: 'camera=(), microphone=(), geolocation=()' },
    {
        key: 'Content-Security-Policy',
        value: [
            "default-src 'self'",
            `connect-src 'self' ${SUPABASE_HTTP} ${SUPABASE_WS}`,
            `img-src 'self' data: blob: ${SUPABASE_HTTP}`,
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "font-src 'self' data:",
            "frame-ancestors 'none'",
        ].join('; '),
    },
]

const nextConfig: NextConfig = {
    output: 'standalone',
    turbopack: {},
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: '**' },
        ],
    },
    typescript: { ignoreBuildErrors: true },
    async headers() {
        if (process.env.NODE_ENV === 'development') return []
        return [{ source: '/(.*)', headers: securityHeaders }]
    },
};

export default withPWA(nextConfig);
