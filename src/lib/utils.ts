import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Converts a Supabase storage public URL to a server-side proxy URL.
// Fixes mixed-content blocking on HTTPS deployments (Vercel) when Supabase is HTTP.
export function proxyStorageUrl(url: string | null | undefined): string | null {
    if (!url) return null
    try {
        // Extract bucket and path from Supabase public URL format:
        // http(s)://<host>/storage/v1/object/public/<bucket>/<path>
        const match = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?|$)/)
        if (match) {
            const bucket = match[1]
            const path = match[2]
            return `/api/img?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`
        }
    } catch {
        // ignore
    }
    return url
}
