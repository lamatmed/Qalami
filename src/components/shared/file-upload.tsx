'use client'

import { useState, useRef, useCallback } from 'react'
import { X, FileText, Image as ImageIcon, File, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { uploadFile, formatFileSize, getFileIcon, type UploadBucket, type UploadResult } from '@/lib/upload'
import { toast } from 'sonner'

interface UploadedFile {
    file: File
    preview?: string
    uploading: boolean
    uploaded: boolean
    result?: UploadResult
    error?: string
}

interface Props {
    bucket: UploadBucket
    folder?: string
    maxFiles?: number
    maxSize?: number // in bytes
    accept?: string
    onUploadComplete?: (results: UploadResult[]) => void
    className?: string
}

export function FileUpload({
    bucket,
    folder,
    maxFiles = 5,
    maxSize = 10 * 1024 * 1024, // 10MB default
    accept = 'image/*,.pdf,.doc,.docx',
    onUploadComplete,
    className
}: Props) {
    const [files, setFiles] = useState<UploadedFile[]>([])
    const [isDragging, setIsDragging] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    const handleFileSelect = useCallback(async (selectedFiles: FileList | null) => {
        if (!selectedFiles) return

        const newFiles: UploadedFile[] = []

        for (let i = 0; i < selectedFiles.length; i++) {
            if (files.length + newFiles.length >= maxFiles) {
                toast.error(`Maximum ${maxFiles} fichiers autorisés`)
                break
            }

            const file = selectedFiles[i]

            if (file.size > maxSize) {
                toast.error(`${file.name} dépasse la taille maximale (${formatFileSize(maxSize)})`)
                continue
            }

            const uploadedFile: UploadedFile = {
                file,
                uploading: true,
                uploaded: false,
                preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
            }

            newFiles.push(uploadedFile)
        }

        setFiles(prev => [...prev, ...newFiles])

        // Upload files
        const results: UploadResult[] = []

        for (let i = 0; i < newFiles.length; i++) {
            const uploadedFile = newFiles[i]
            try {
                const result = await uploadFile(uploadedFile.file, bucket, folder)
                results.push(result)

                setFiles(prev => prev.map(f =>
                    f.file === uploadedFile.file
                        ? { ...f, uploading: false, uploaded: true, result }
                        : f
                ))
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Erreur d\'upload'
                setFiles(prev => prev.map(f =>
                    f.file === uploadedFile.file
                        ? { ...f, uploading: false, error: errorMessage }
                        : f
                ))
                toast.error(`Erreur: ${uploadedFile.file.name}`)
            }
        }

        if (results.length > 0 && onUploadComplete) {
            onUploadComplete(results)
        }
    }, [files.length, maxFiles, maxSize, bucket, folder, onUploadComplete])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        handleFileSelect(e.dataTransfer.files)
    }, [handleFileSelect])

    const removeFile = (file: File) => {
        setFiles(prev => {
            const fileToRemove = prev.find(f => f.file === file)
            if (fileToRemove?.preview) {
                URL.revokeObjectURL(fileToRemove.preview)
            }
            return prev.filter(f => f.file !== file)
        })
    }

    const getIconForFile = (file: UploadedFile) => {
        const type = getFileIcon(file.file.type)
        switch (type) {
            case 'pdf':
                return <FileText className="w-5 h-5 text-red-500" />
            case 'image':
                return <ImageIcon className="w-5 h-5 text-blue-500" />
            case 'doc':
                return <FileText className="w-5 h-5 text-blue-600" />
            default:
                return <File className="w-5 h-5 text-gray-500" />
        }
    }

    return (
        <div className={cn("space-y-4", className)}>
            {/* Drop Zone */}
            <div
                className={cn(
                    "border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer",
                    isDragging
                        ? "border-cyan-500 bg-cyan-500/10"
                        : "border-white/20 hover:border-cyan-500/50 bg-white/5"
                )}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
            >
                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept={accept}
                    onChange={(e) => handleFileSelect(e.target.files)}
                    className="hidden"
                />

                <div className="flex flex-col items-center gap-3">
                    <div className="flex gap-3">
                        <div className="h-10 w-10 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-500">
                            <File className="w-5 h-5" />
                        </div>
                        <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
                            <ImageIcon className="w-5 h-5" />
                        </div>
                        <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                            <FileText className="w-5 h-5" />
                        </div>
                    </div>
                    <div>
                        <p className="font-bold text-white">
                            {isDragging ? 'Déposez les fichiers ici' : 'Glissez ou cliquez pour ajouter'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            PDF, Images, Documents (Max {formatFileSize(maxSize)})
                        </p>
                    </div>
                </div>
            </div>

            {/* File List */}
            {files.length > 0 && (
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-400">
                            Fichiers ({files.length}/{maxFiles})
                        </span>
                        {files.length > 0 && (
                            <button
                                onClick={() => setFiles([])}
                                className="text-xs text-red-500 hover:underline"
                            >
                                Tout supprimer
                            </button>
                        )}
                    </div>

                    {files.map((file, index) => (
                        <div
                            key={index}
                            className={cn(
                                "flex items-center gap-3 p-3 rounded-xl border transition-all",
                                file.error
                                    ? "bg-red-500/10 border-red-500/30"
                                    : file.uploaded
                                        ? "bg-green-500/10 border-green-500/30"
                                        : "bg-card border-white/5"
                            )}
                        >
                            {/* Preview or Icon */}
                            {file.preview ? (
                                <img
                                    src={file.preview}
                                    alt={file.file.name}
                                    className="h-10 w-10 rounded-lg object-cover"
                                />
                            ) : (
                                <div className="h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center">
                                    {getIconForFile(file)}
                                </div>
                            )}

                            {/* File Info */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{file.file.name}</p>
                                <p className="text-xs text-gray-500">
                                    {formatFileSize(file.file.size)}
                                    {file.error && <span className="text-red-500 ml-2">{file.error}</span>}
                                    {file.uploaded && <span className="text-green-500 ml-2">✓ Uploadé</span>}
                                </p>
                            </div>

                            {/* Status/Action */}
                            {file.uploading ? (
                                <Loader2 className="w-5 h-5 animate-spin text-cyan-500" />
                            ) : (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-gray-500 hover:text-red-500 hover:bg-red-500/10"
                                    onClick={(e) => { e.stopPropagation(); removeFile(file.file) }}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// Get all uploaded file paths
export function getUploadedPaths(files: UploadedFile[]): string[] {
    return files
        .filter(f => f.uploaded && f.result)
        .map(f => f.result!.path)
}
