'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, FileText, Loader2, X } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const DOCUMENT_TYPES = [
    { value: 'course', label: 'Cours' },
    { value: 'exercise', label: 'Exercice' },
    { value: 'exam', label: 'Examen' },
    { value: 'devoirs', label: 'Devoirs' },
    { value: 'correction', label: 'Correction' },
    { value: 'resource', label: 'Ressource' },
    { value: 'general', label: 'Général' },
]

const CATEGORIES = [
    { value: 'pedago',  label: 'Pédagogie' },
    { value: 'admin',   label: 'Administration' },
    { value: 'finance', label: 'Finance' },
    { value: 'hr',      label: 'RH' },
    { value: 'legal',   label: 'Juridique' },
    { value: 'student', label: 'Élèves' },
]

interface UploadDocumentDialogProps {
    isOpen: boolean
    onClose: () => void
    onSuccess?: () => void
    defaultTeacherId?: string
    defaultClassId?: string
    defaultSubjectId?: string
}

export function UploadDocumentDialog({
    isOpen,
    onClose,
    onSuccess,
    defaultTeacherId,
    defaultClassId,
    defaultSubjectId,
}: UploadDocumentDialogProps) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [file, setFile] = useState<File | null>(null)
    const [documentType, setDocumentType] = useState('course')
    const [category, setCategory] = useState('pedago')
    const [subjectId, setSubjectId] = useState(defaultSubjectId || 'none')
    const [classId, setClassId] = useState(defaultClassId || 'none')
    const [teacherId, setTeacherId] = useState(defaultTeacherId || 'none')
    const [academicYear, setAcademicYear] = useState('')
    const [uploading, setUploading] = useState(false)

    const [subjects, setSubjects] = useState<{ id: string; name: string; icon: string | null }[]>([])
    const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
    const [teachers, setTeachers] = useState<{ id: string; full_name: string }[]>([])

    // Compute current academic year (Sep–Aug)
    const now = new Date()
    const yr = now.getFullYear()
    const currentAcademicYear = now.getMonth() >= 8 ? `${yr}-${yr + 1}` : `${yr - 1}-${yr}`

    /**
     * Fetches school context fully client-side using the anon Supabase client.
     * This replaces the previous `getMySchoolContext` server action call that was
     * causing a fatal "Application error" crash on Vercel when called from a
     * client component.
     */
    const getSchoolContext = async () => {
        const supabase = createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) return null

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('school_id')
            .eq('id', user.id)
            .single()

        if (profileError || !profile?.school_id) return null
        return { school_id: profile.school_id, user_id: user.id }
    }

    useEffect(() => {
        if (!isOpen) return
        setAcademicYear(currentAcademicYear)
        setSubjectId(defaultSubjectId || 'none')
        setClassId(defaultClassId || 'none')
        setTeacherId(defaultTeacherId || 'none')
        async function loadOptions() {
            try {
                const ctx = await getSchoolContext()
                if (!ctx) return
                const supabase = createClient()

                const [{ data: subj }, { data: cls }, { data: tch }] = await Promise.all([
                    supabase.from('subjects').select('id, name, icon').eq('school_id', ctx.school_id).order('name'),
                    supabase.from('classes').select('id, name').eq('school_id', ctx.school_id).order('name'),
                    supabase.from('profiles').select('id, full_name').eq('school_id', ctx.school_id).eq('role', 'teacher').order('full_name'),
                ])
                setSubjects(subj || [])
                setClasses(cls || [])
                setTeachers(tch || [])
            } catch (err) {
                console.error('[UploadDocumentDialog] loadOptions error:', err)
            }
        }
        loadOptions()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFile(e.target.files?.[0] || null)
    }

    const handleUpload = async () => {
        if (!file) { toast.error('Sélectionnez un fichier'); return }

        setUploading(true)
        try {
            const ctx = await getSchoolContext()
            if (!ctx) throw new Error('Non authentifié')
            const supabase = createClient()

            const fileExt = file.name.split('.').pop()
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
            const filePath = `school_${ctx.school_id}/${documentType}/${Date.now()}_${safeName}`

            const { error: storageError } = await supabase.storage
                .from('documents')
                .upload(filePath, file, { cacheControl: '3600', upsert: false })

            if (storageError) {
                if (storageError.message?.includes('Bucket')) {
                    toast.error('Bucket "documents" non configuré dans Supabase Storage.')
                    return
                }
                throw storageError
            }

            const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath)

            const { error: dbError } = await supabase.from('documents').insert({
                school_id: ctx.school_id,
                name: file.name,
                file_url: urlData.publicUrl,
                file_type: fileExt?.toUpperCase() || 'PDF',
                file_size_bytes: file.size,
                document_type: documentType,
                category: category,
                subject_id: (subjectId && subjectId !== 'none') ? subjectId : null,
                class_id: (classId && classId !== 'none') ? classId : null,
                teacher_id: (teacherId && teacherId !== 'none') ? teacherId : (defaultTeacherId || null),
                academic_year: academicYear || null,
                uploaded_by: ctx.user_id,
            })

            if (dbError) throw dbError

            toast.success('Document uploadé', { description: file.name })
            onSuccess?.()
            handleClose()
        } catch (err: any) {
            console.error(err)
            toast.error('Erreur upload', { description: err.message })
        } finally {
            setUploading(false)
        }
    }

    const handleClose = () => {
        setFile(null)
        setDocumentType('course')
        setCategory('pedago')
        setSubjectId(defaultSubjectId || 'none')
        setClassId(defaultClassId || 'none')
        setTeacherId(defaultTeacherId || 'none')
        if (fileInputRef.current) fileInputRef.current.value = ''
        onClose()
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-lg bg-[#161B22] border-white/10 text-white">
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                    <Upload className="w-5 h-5 text-cyan-400" /> Ajouter un document
                </DialogTitle>

                <div className="space-y-4 mt-2">
                    {/* File picker */}
                    <div
                        className={cn(
                            "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors",
                            file ? "border-cyan-500/50 bg-cyan-500/5" : "border-white/10 hover:border-white/20"
                        )}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png" />
                        {file ? (
                            <div className="flex items-center justify-center gap-3">
                                <FileText className="w-6 h-6 text-cyan-400 shrink-0" />
                                <div className="text-left">
                                    <p className="text-sm font-bold text-white truncate max-w-[200px]">{file.name}</p>
                                    <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</p>
                                </div>
                                <button className="ml-auto" onClick={e => { e.stopPropagation(); setFile(null) }}>
                                    <X className="w-4 h-4 text-gray-500 hover:text-white" />
                                </button>
                            </div>
                        ) : (
                            <>
                                <Upload className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                                <p className="text-sm text-gray-400">Cliquer pour choisir un fichier</p>
                                <p className="text-[10px] text-gray-600 mt-1">PDF, Word, PowerPoint, Excel, Image</p>
                            </>
                        )}
                    </div>

                    {/* Type + Category row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs text-gray-400 uppercase font-bold">Type de document</Label>
                            <Select value={documentType} onValueChange={setDocumentType}>
                                <SelectTrigger className="bg-[#0D1117] border-white/10 text-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1A2530] border-white/10 text-white">
                                    {DOCUMENT_TYPES.map(t => (
                                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-gray-400 uppercase font-bold">Catégorie</Label>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger className="bg-[#0D1117] border-white/10 text-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1A2530] border-white/10 text-white">
                                    {CATEGORIES.map(c => (
                                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {/* Subject */}
                        <div className="space-y-1.5">
                            <Label className="text-xs text-gray-400 uppercase font-bold">Matière (optionnel)</Label>
                            <Select value={subjectId} onValueChange={setSubjectId}>
                                <SelectTrigger className="bg-[#0D1117] border-white/10 text-white">
                                    <SelectValue placeholder="—" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1A2530] border-white/10 text-white max-h-48">
                                    <SelectItem value="none">—</SelectItem>
                                    {subjects.map(s => (
                                        <SelectItem key={s.id} value={s.id}>
                                            {s.icon ? `${s.icon} ` : ''}{s.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Class */}
                        <div className="space-y-1.5">
                            <Label className="text-xs text-gray-400 uppercase font-bold">Classe (optionnel)</Label>
                            <Select value={classId} onValueChange={setClassId}>
                                <SelectTrigger className="bg-[#0D1117] border-white/10 text-white">
                                    <SelectValue placeholder="—" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1A2530] border-white/10 text-white max-h-48">
                                    <SelectItem value="none">—</SelectItem>
                                    {classes.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Teacher — only shown when not pre-set from parent context */}
                        {!defaultTeacherId && (
                            <div className="space-y-1.5">
                                <Label className="text-xs text-gray-400 uppercase font-bold">Enseignant (optionnel)</Label>
                                <Select value={teacherId} onValueChange={setTeacherId}>
                                    <SelectTrigger className="bg-[#0D1117] border-white/10 text-white">
                                        <SelectValue placeholder="—" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#1A2530] border-white/10 text-white max-h-48">
                                        <SelectItem value="none">—</SelectItem>
                                        {teachers.map(t => (
                                            <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Academic year */}
                        <div className="space-y-1.5">
                            <Label className="text-xs text-gray-400 uppercase font-bold">Année académique</Label>
                            <Input
                                value={academicYear}
                                onChange={e => setAcademicYear(e.target.value)}
                                placeholder="2024-2025"
                                className="bg-[#0D1117] border-white/10 text-white h-9"
                            />
                        </div>
                    </div>

                    <Button
                        onClick={handleUpload}
                        disabled={!file || uploading}
                        className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold h-11"
                    >
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                        {uploading ? 'Upload en cours...' : 'Enregistrer'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
