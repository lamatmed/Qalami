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
import { useLanguage } from '@/i18n'

const DOC_TYPE_VALUES = ['course', 'exercise', 'exam', 'devoirs', 'correction', 'resource', 'general'] as const
const CATEGORY_VALUES = ['pedago', 'admin', 'finance', 'hr', 'legal', 'student'] as const

interface UploadDocumentDialogProps {
    isOpen: boolean
    onClose: () => void
    onSuccess?: () => void
    defaultTeacherId?: string
    defaultClassId?: string
    defaultSubjectId?: string
    allowedClassIds?: string[]
    allowedSubjectIds?: string[]
}

export function UploadDocumentDialog({
    isOpen,
    onClose,
    onSuccess,
    defaultTeacherId,
    defaultClassId,
    defaultSubjectId,
    allowedClassIds,
    allowedSubjectIds,
}: UploadDocumentDialogProps) {
    const { t } = useLanguage()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [file, setFile] = useState<File | null>(null)
    const [documentType, setDocumentType] = useState('course')
    const [category, setCategory] = useState('pedago')
    const [subjectId, setSubjectId] = useState(defaultSubjectId || 'none')
    const [classId, setClassId] = useState(defaultClassId || 'none')
    const [teacherId, setTeacherId] = useState(defaultTeacherId || 'none')
    const [academicYear, setAcademicYear] = useState('')
    const [description, setDescription] = useState('')
    const [nni, setNni] = useState('')
    const [uploading, setUploading] = useState(false)

    const [subjects, setSubjects] = useState<{ id: string; name: string; icon: string | null }[]>([])
    const [classes, setClasses] = useState<{ id: string; name: string; school_id?: string; school_name?: string }[]>([])
    const [teachers, setTeachers] = useState<{ id: string; full_name: string }[]>([])

    // Compute current academic year (Sep–Aug)
    const now = new Date()
    const yr = now.getFullYear()
    const currentAcademicYear = now.getMonth() >= 8 ? `${yr}-${yr + 1}` : `${yr - 1}-${yr}`

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

                const subjQuery = (allowedSubjectIds && allowedSubjectIds.length > 0)
                    ? supabase.from('subjects').select('id, name, icon').in('id', allowedSubjectIds).order('name')
                    : supabase.from('subjects').select('id, name, icon').eq('school_id', ctx.school_id).order('name')

                const clsQuery = (allowedClassIds && allowedClassIds.length > 0)
                    ? supabase.from('classes').select('id, name, school_id, schools(name)').in('id', allowedClassIds).order('name')
                    : supabase.from('classes').select('id, name, school_id, schools(name)').eq('school_id', ctx.school_id).order('name')

                const [{ data: subj }, { data: cls }, { data: tch }] = await Promise.all([
                    subjQuery,
                    clsQuery,
                    supabase.from('profiles').select('id, full_name').eq('school_id', ctx.school_id).eq('role', 'teacher').order('full_name'),
                ])
                setSubjects(subj || [])
                setClasses((cls || []).map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    school_id: c.school_id,
                    school_name: c.schools?.name ?? undefined,
                })))
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
        if (!file) { toast.error(t('admin.documents.dialog.selectFileError')); return }

        setUploading(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('documentType', documentType)
            formData.append('category', category)
            formData.append('classId', classId || 'none')
            formData.append('subjectId', subjectId || 'none')
            formData.append('teacherId', teacherId || defaultTeacherId || 'none')
            formData.append('academicYear', academicYear || '')
            formData.append('description', description.trim())
            formData.append('nni', nni.trim())

            const res = await fetch('/api/admin/upload-document', {
                method: 'POST',
                body: formData,
            })

            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Upload failed')

            toast.success(t('admin.documents.dialog.title'), { description: file.name })
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
        setDescription('')
        setNni('')
        if (fileInputRef.current) fileInputRef.current.value = ''
        onClose()
    }

    const classLabel = (c: { name: string; school_name?: string }) =>
        c.school_name ? `${c.school_name} — ${c.name}` : c.name

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-lg bg-[#161B22] border-white/10 text-white">
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                    <Upload className="w-5 h-5 text-cyan-400" /> {t('admin.documents.dialog.title')}
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
                                <p className="text-sm text-gray-400">{t('admin.documents.dialog.chooseFile')}</p>
                                <p className="text-[10px] text-gray-600 mt-1">{t('admin.documents.dialog.fileFormats')}</p>
                            </>
                        )}
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                        <Label className="text-xs text-gray-400 uppercase font-bold">
                            {t('admin.documents.dialog.descriptionLabel')} <span className="normal-case text-gray-600">{t('admin.documents.dialog.optional')}</span>
                        </Label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder={t('admin.documents.dialog.descriptionPlaceholder')}
                            rows={2}
                            className="w-full bg-[#0D1117] border border-white/10 text-white text-sm rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-cyan-500/50 placeholder:text-gray-600"
                        />
                    </div>

                    {/* Type + Category row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs text-gray-400 uppercase font-bold">{t('admin.documents.dialog.docTypeLabel')}</Label>
                            <Select value={documentType} onValueChange={setDocumentType}>
                                <SelectTrigger className="bg-[#0D1117] border-white/10 text-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1A2530] border-white/10 text-white">
                                    {DOC_TYPE_VALUES.map(v => (
                                        <SelectItem key={v} value={v}>{t(`admin.documents.docTypes.${v}`) || v}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-gray-400 uppercase font-bold">{t('admin.documents.dialog.categoryLabel')}</Label>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger className="bg-[#0D1117] border-white/10 text-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1A2530] border-white/10 text-white">
                                    {CATEGORY_VALUES.map(v => (
                                        <SelectItem key={v} value={v}>{t(`admin.documents.categories.${v}`) || v}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {/* Subject */}
                        <div className="space-y-1.5">
                            <Label className="text-xs text-gray-400 uppercase font-bold">
                                {t('admin.documents.dialog.subjectLabel')} <span className="normal-case text-gray-600">{t('admin.documents.dialog.optional')}</span>
                            </Label>
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
                            <Label className="text-xs text-gray-400 uppercase font-bold">
                                {t('admin.documents.dialog.classLabel')} <span className="normal-case text-gray-600">{t('admin.documents.dialog.optional')}</span>
                            </Label>
                            <Select value={classId} onValueChange={setClassId}>
                                <SelectTrigger className="bg-[#0D1117] border-white/10 text-white">
                                    <SelectValue placeholder="—" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1A2530] border-white/10 text-white max-h-48">
                                    <SelectItem value="none">—</SelectItem>
                                    {classes.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{classLabel(c)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Teacher — only shown when not pre-set from parent context */}
                        {!defaultTeacherId && (
                            <div className="space-y-1.5">
                                <Label className="text-xs text-gray-400 uppercase font-bold">
                                    {t('admin.documents.dialog.teacherLabel')} <span className="normal-case text-gray-600">{t('admin.documents.dialog.optional')}</span>
                                </Label>
                                <Select value={teacherId} onValueChange={setTeacherId}>
                                    <SelectTrigger className="bg-[#0D1117] border-white/10 text-white">
                                        <SelectValue placeholder="—" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#1A2530] border-white/10 text-white max-h-48">
                                        <SelectItem value="none">—</SelectItem>
                                        {teachers.map(teacher => (
                                            <SelectItem key={teacher.id} value={teacher.id}>{teacher.full_name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Academic year */}
                        <div className="space-y-1.5">
                            <Label className="text-xs text-gray-400 uppercase font-bold">{t('admin.documents.dialog.academicYearLabel')}</Label>
                            <Input
                                value={academicYear}
                                onChange={e => setAcademicYear(e.target.value)}
                                placeholder="2024-2025"
                                className="bg-[#0D1117] border-white/10 text-white h-9"
                            />
                        </div>

                        {/* NNI */}
                        <div className="space-y-1.5">
                            <Label className="text-xs text-gray-400 uppercase font-bold">
                                {t('admin.documents.dialog.nniLabel')} <span className="normal-case text-gray-600">{t('admin.documents.dialog.optional')}</span>
                            </Label>
                            <Input
                                value={nni}
                                onChange={e => setNni(e.target.value)}
                                placeholder={t('admin.documents.dialog.nniPlaceholder')}
                                className="bg-[#0D1117] border-white/10 text-white h-9 font-mono"
                            />
                        </div>
                    </div>

                    <Button
                        onClick={handleUpload}
                        disabled={!file || uploading}
                        className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold h-11"
                    >
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                        {uploading ? t('admin.documents.dialog.saving') : t('admin.documents.dialog.save')}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
