import { createClient } from '@/utils/supabase/client'

export type UploadBucket = 'homework-submissions' | 'attachments'

export interface UploadResult {
    path: string
    url: string
}

/**
 * Upload a file to Supabase Storage
 * @param file The file to upload
 * @param bucket The storage bucket name
 * @param folder Optional folder path within the bucket
 * @returns The file path and public URL
 */
export async function uploadFile(
    file: File,
    bucket: UploadBucket,
    folder?: string
): Promise<UploadResult> {
    const supabase = createClient()

    // Generate unique filename with timestamp
    const timestamp = Date.now()
    const extension = file.name.split('.').pop()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filename = `${timestamp}_${sanitizedName}`

    // Build path
    const path = folder ? `${folder}/${filename}` : filename

    const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
            cacheControl: '3600',
            upsert: false
        })

    if (error) {
        console.error('Upload error:', error)
        throw new Error(`Failed to upload file: ${error.message}`)
    }

    // Get the signed URL for private bucket
    const { data: signedData } = await supabase.storage
        .from(bucket)
        .createSignedUrl(data.path, 60 * 60 * 24 * 7) // 7 days expiry

    return {
        path: data.path,
        url: signedData?.signedUrl ?? ''
    }
}

/**
 * Upload multiple files
 */
export async function uploadMultipleFiles(
    files: File[],
    bucket: UploadBucket,
    folder?: string
): Promise<UploadResult[]> {
    const results = await Promise.all(
        files.map(file => uploadFile(file, bucket, folder))
    )
    return results
}

/**
 * Delete a file from storage
 */
export async function deleteFile(path: string, bucket: UploadBucket): Promise<void> {
    const supabase = createClient()

    const { error } = await supabase.storage
        .from(bucket)
        .remove([path])

    if (error) {
        console.error('Delete error:', error)
        throw new Error(`Failed to delete file: ${error.message}`)
    }
}

/**
 * Get a signed URL for a file (for private buckets)
 */
export async function getSignedUrl(
    path: string,
    bucket: UploadBucket,
    expiresIn: number = 60 * 60 // 1 hour default
): Promise<string> {
    const supabase = createClient()

    const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn)

    if (error) {
        throw new Error(`Failed to get signed URL: ${error.message}`)
    }

    return data.signedUrl
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

/**
 * Get file type icon based on MIME type
 */
export function getFileIcon(mimeType: string): 'pdf' | 'image' | 'doc' | 'file' {
    if (mimeType === 'application/pdf') return 'pdf'
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType.includes('document') || mimeType.includes('word')) return 'doc'
    return 'file'
}
