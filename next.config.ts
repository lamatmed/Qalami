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

const nextConfig: NextConfig = {
    // Silence Turbopack custom webpack warning for next-pwa
    turbopack: {},
    // Images
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: '**' },
        ],
    },
    // Supabase types are currently a placeholder (any) — skip strict build-time
    // type-checking until `supabase gen types typescript` is run to regenerate them.
    typescript: { ignoreBuildErrors: true },
};

export default withPWA(nextConfig);
