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

const SUPABASE_HOSTNAME = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
    : '*.supabase.co'

const securityHeaders = [
    { key: 'X-Frame-Options',        value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy',     value: 'camera=(), microphone=(), geolocation=()' },
    {
        key: 'Content-Security-Policy',
        value: [
            "default-src 'self'",
            `connect-src 'self' https://${SUPABASE_HOSTNAME} wss://${SUPABASE_HOSTNAME}`,
            `img-src 'self' data: blob: https://${SUPABASE_HOSTNAME}`,
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "font-src 'self'",
            "frame-ancestors 'none'",
        ].join('; '),
    },
]

const nextConfig: NextConfig = {
    turbopack: {},
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: '**' },
        ],
    },
    typescript: { ignoreBuildErrors: true },
    async headers() {
        return [{ source: '/(.*)', headers: securityHeaders }]
    },
};

export default withPWA(nextConfig);
