'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, FileText, Loader2, X, ChevronDown, Search } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/i18n'

const DOC_TYPE_VALUES = ['course', 'exercise', 'exam', 'devoirs', 'correction', 'resource', 'general'] as const
const CATEGORY_VALUES = ['pedago', 'admin', 'finance', 'hr', 'legal', 'student'] as const

function SearchableSelect({
    value, onChange, options, placeholder = '—', searchPlaceholder = '…', noResultsText = '—',
}: {
    value: string
    onChange: (val: string) => void
    options: { value: string; label: string }[]
    placeholder?: string
    searchPlaceholder?: string
    noResultsText?: string
}) {
    const [query, setQuery] = useState('')
    const [open, setOpen] = useState(false)
    const [rect, setRect] = useState<DOMRect | null>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    const selectedLabel = options.find(o => o.value === value)?.label
    const filtered = query
        ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
        : options

    const handleOpen = () => {
        if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect())
        setOpen(true)
        setQuery('')
        setTimeout(() => inputRef.current?.focus(), 0)
    }

    useEffect(() => {
        if (!open) return
        const handler = (e: MouseEvent) => {
            const t = e.target as Node
            if (triggerRef.current?.contains(t) || dropdownRef.current?.contains(t)) return
            setOpen(false); setQuery('')
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [open])

    const dropdown = open && rect ? (
        <div
            ref={dropdownRef}
            style={{ '--dd-top': `${rect.bottom + 4}px`, '--dd-left': `${rect.left}px`, '--dd-w': `${rect.width}px` } as React.CSSProperties}
            className="fixed top-[var(--dd-top)] left-[var(--dd-left)] w-[var(--dd-w)] z-[9999] bg-[#1A2530] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
        >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
                <Search className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                <input
                    ref={inputRef}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-600"
                />
                {query && (
                    <button type="button" title="clear" onClick={() => setQuery('')}>
                        <X className="w-3.5 h-3.5 text-gray-500 hover:text-white" />
                    </button>
                )}
            </div>
            <div className="max-h-44 overflow-y-auto">
                <button type="button"
                    onClick={() => { onChange('none'); setOpen(false); setQuery('') }}
                    className={cn('w-full text-left px-3 py-2 text-sm hover:bg-white/5', !value || value === 'none' ? 'text-cyan-400 font-semibold' : 'text-gray-500')}
                >—</button>
                {filtered.length === 0 ? (
                    <p className="text-xs text-gray-600 text-center py-3">{noResultsText}</p>
                ) : filtered.map(o => (
                    <button key={o.value} type="button"
                        onClick={() => { onChange(o.value); setOpen(false); setQuery('') }}
                        className={cn('w-full text-left px-3 py-2 text-sm hover:bg-white/5 truncate', value === o.value ? 'text-cyan-400 font-semibold' : 'text-white')}
                    >{o.label}</button>
                ))}
            </div>
        </div>
    ) : null

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={handleOpen}
                className={cn(
                    'w-full flex items-center justify-between bg-[#0D1117] border rounded-lg px-3 h-9 text-sm transition-colors text-left',
                    open ? 'border-cyan-500/50' : 'border-white/10'
                )}
            >
                <span className={cn('truncate flex-1', value && value !== 'none' ? 'text-white' : 'text-gray-500')}>
                    {value && value !== 'none' ? (selectedLabel ?? placeholder) : placeholder}
                </span>
                <ChevronDown className={cn('w-4 h-4 text-gray-500 shrink-0 ml-1 transition-transform', open && 'rotate-180')} />
            </button>
            {typeof window !== 'undefined' && createPortal(dropdown, document.body)}
        </>
    )
}

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
            toast.error(t('admin.documents.dialog.uploadError'), { description: err.message })
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
        if (fileInputRef.current) fileInputRef.current.value = ''
        onClose()
    }

    const classLabel = (c: { name: string; school_name?: string }) =>
        c.school_name ? `${c.school_name} — ${c.name}` : c.name

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-lg bg-[#161B22] border-white/10 text-white max-h-[90vh] overflow-y-auto">
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
                            <SearchableSelect
                                value={subjectId}
                                onChange={setSubjectId}
                                options={subjects.map(s => ({ value: s.id, label: (s.icon ? s.icon + ' ' : '') + s.name }))}
                                placeholder="—"
                                searchPlaceholder={t('admin.documents.dialog.searchPlaceholder')}
                                noResultsText={t('admin.documents.dialog.noResults')}
                            />
                        </div>

                        {/* Class */}
                        <div className="space-y-1.5">
                            <Label className="text-xs text-gray-400 uppercase font-bold">
                                {t('admin.documents.dialog.classLabel')} <span className="normal-case text-gray-600">{t('admin.documents.dialog.optional')}</span>
                            </Label>
                            <SearchableSelect
                                value={classId}
                                onChange={setClassId}
                                options={classes.map(c => ({ value: c.id, label: classLabel(c) }))}
                                placeholder="—"
                                searchPlaceholder={t('admin.documents.dialog.searchPlaceholder')}
                                noResultsText={t('admin.documents.dialog.noResults')}
                            />
                        </div>

                        {/* Teacher — only shown when not pre-set from parent context */}
                        {!defaultTeacherId && (
                            <div className="space-y-1.5">
                                <Label className="text-xs text-gray-400 uppercase font-bold">
                                    {t('admin.documents.dialog.teacherLabel')} <span className="normal-case text-gray-600">{t('admin.documents.dialog.optional')}</span>
                                </Label>
                                <SearchableSelect
                                    value={teacherId}
                                    onChange={setTeacherId}
                                    options={teachers.map(tc => ({ value: tc.id, label: tc.full_name }))}
                                    placeholder="—"
                                    searchPlaceholder={t('admin.documents.dialog.searchPlaceholder')}
                                    noResultsText={t('admin.documents.dialog.noResults')}
                                />
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
