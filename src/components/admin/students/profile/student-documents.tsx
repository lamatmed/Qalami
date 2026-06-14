'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, Eye, CheckCircle2, Upload, Plus, Camera, Image as ImageIcon, Loader2, Download, X, BookOpen, Trash2, Pencil, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { createClient } from '@/utils/supabase/client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UploadDocumentDialog } from '@/components/admin/documents/upload-document-dialog'
import { useLanguage } from '@/i18n'

interface StudentDocumentsProps {
    studentId?: string
    classId?: string
    schoolId?: string
    isArchived?: boolean
}

interface Document {
    id: string
    name: string
    file_url: string | null
    file_type: string
    status: 'valid' | 'pending' | 'missing'
    uploaded_at: string | null
}

interface PedaDocument {
    id: string
    name: string
    file_url: string | null
    file_type: string | null
    file_size_bytes: number | null
    document_type: string
    subject_id: string | null
    subjectName: string | null
    subjectIcon: string | null
    created_at: string
}

const DOC_TYPE_LABEL_KEYS: Record<string, string> = {
    course: 'admin.students.profile.documentsTypeCourse',
    exercise: 'admin.students.profile.documentsTypeExercise',
    exam: 'admin.students.profile.documentsTypeExam',
    devoirs: 'admin.students.profile.documentsTypeDevoirs',
    correction: 'admin.students.profile.documentsTypeCorrection',
    resource: 'admin.students.profile.documentsTypeResource',
    general: 'admin.students.profile.documentsTypeGeneral',
}

const requiredDocuments = [
    // `name` must stay in French to match DB `document_name` values.
    { name: 'Acte de Naissance',   labelKey: 'admin.students.profile.documentsReqBirthCert',      icon: FileText,  color: 'text-blue-400' },
    { name: 'Photo d\'identité',  labelKey: 'admin.students.profile.documentsReqIdPhoto',        icon: ImageIcon, color: 'text-purple-400' },
    { name: 'Certificat Médical', labelKey: 'admin.students.profile.documentsReqMedicalCert',    icon: FileText,  color: 'text-emerald-400' },
    { name: 'Bulletin Précédent', labelKey: 'admin.students.profile.documentsReqPreviousReport', icon: FileText,  color: 'text-orange-400' },
]

export function StudentDocuments({ studentId, classId, schoolId, isArchived }: StudentDocumentsProps) {
    const { t } = useLanguage()
    const [documents, setDocuments] = useState<Document[]>([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState<string | null>(null)
    const [viewingDoc, setViewingDoc] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const cameraInputRef = useRef<HTMLInputElement>(null)
    const [uploadTarget, setUploadTarget] = useState<string>('')

    // Pedagogical docs
    const [resolvedClassId, setResolvedClassId] = useState<string | undefined>(classId)
    const [pedaDocs, setPedaDocs] = useState<PedaDocument[]>([])
    const [pedaLoading, setPedaLoading] = useState(false)
    const [typeFilter, setTypeFilter] = useState<string>('all')
    const [subjectFilter, setSubjectFilter] = useState<string>('all')
    const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([])
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false)

    // Delete/rename states
    const [deletingDocId, setDeletingDocId] = useState<string | null>(null)
    const [renamingDoc, setRenamingDoc] = useState<{ id: string; name: string } | null>(null)
    const [renameValue, setRenameValue] = useState('')
    // Change status
    const [statusMenuId, setStatusMenuId] = useState<string | null>(null)

    // Resolve classId if schoolId is provided and classId is not
    useEffect(() => {
        if (classId) {
            setResolvedClassId(classId)
            return
        }
        if (!studentId || !schoolId) return

        async function fetchClass() {
            const supabase = createClient()
            const { data: enrollment } = await supabase
                .from('enrollments')
                .select('class_id, status')
                .eq('student_id', studentId)
                .eq('school_id', schoolId)
                .order('created_at', { ascending: false })
            
            const activeEnrollment = enrollment?.find(e => e.status === 'active') || enrollment?.[0]
            if (activeEnrollment?.class_id) {
                setResolvedClassId(activeEnrollment.class_id)
            }
        }
        fetchClass()
    }, [studentId, schoolId, classId])

    const fetchDocuments = async () => {
        if (!studentId) {
            // Show default document slots
            setDocuments(requiredDocuments.map((d, i) => ({
                id: String(i),
                name: d.name,
                file_url: null,
                file_type: '',
                status: 'missing' as const,
                uploaded_at: null
            })))
            setLoading(false)
            return
        }

        const supabase = createClient()
        const { data, error } = await supabase
            .from('student_documents')
            .select('*')
            .eq('student_id', studentId)

        if (error) {
            console.error('[StudentDocuments] Error:', error)
            // If table doesn't exist, show default slots
            setDocuments(requiredDocuments.map((d, i) => ({
                id: String(i),
                name: d.name,
                file_url: null,
                file_type: '',
                status: 'missing' as const,
                uploaded_at: null
            })))
            setLoading(false)
            return
        }

        // Merge with required documents
        const mergedDocs = requiredDocuments.map((req, i) => {
            const found = (data || []).find(d => d.document_name === req.name)
            if (found) {
                return {
                    id: found.id,
                    name: found.document_name,
                    file_url: found.file_url,
                    file_type: found.file_type || 'PDF',
                    status: found.status || 'valid' as const,
                    uploaded_at: found.uploaded_at
                }
            }
            return {
                id: String(i),
                name: req.name,
                file_url: null,
                file_type: '',
                status: 'missing' as const,
                uploaded_at: null
            }
        })

        setDocuments(mergedDocs as Document[])
        setLoading(false)
    }

    useEffect(() => {
        fetchDocuments()
    }, [studentId])

    const fetchPedaDocs = async () => {
        if (!resolvedClassId) return
        setPedaLoading(true)
        const supabase = createClient()
        const { data } = await supabase
            .from('documents')
            .select('id, name, file_url, file_type, file_size_bytes, document_type, subject_id, subjects(name, icon), created_at')
            .eq('class_id', resolvedClassId)
            .in('document_type', ['course', 'exercise', 'exam', 'devoirs', 'correction', 'resource', 'general'])
            .order('created_at', { ascending: false })

        const mapped: PedaDocument[] = (data || []).map((d: any) => ({
            id: d.id,
            name: d.name,
            file_url: d.file_url,
            file_type: d.file_type,
            file_size_bytes: d.file_size_bytes,
            document_type: d.document_type,
            subject_id: d.subject_id,
            subjectName: d.subjects?.name || null,
            subjectIcon: d.subjects?.icon || null,
            created_at: d.created_at,
        }))

        setPedaDocs(mapped)
        const uniqueSubjects = mapped
            .filter(d => d.subject_id && d.subjectName)
            .reduce((acc, d) => {
                if (!acc.find(s => s.id === d.subject_id)) {
                    acc.push({ id: d.subject_id!, name: d.subjectName! })
                }
                return acc
            }, [] as { id: string; name: string }[])
        setSubjects(uniqueSubjects)
        setPedaLoading(false)
    }

    useEffect(() => {
        fetchPedaDocs()
    }, [resolvedClassId])

    const handleUploadForDocument = (docName: string) => {
        setUploadTarget(docName)
        fileInputRef.current?.click()
    }

    const handleCameraCapture = () => {
        setUploadTarget('')
        cameraInputRef.current?.click()
    }

    const handleGeneralUpload = () => {
        setUploadTarget('')
        fileInputRef.current?.click()
    }

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const docName = uploadTarget || file.name.split('.')[0]
        setUploading(docName)

        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('studentId', studentId || '')
            formData.append('docName', docName)

            const res = await fetch('/api/admin/upload-student-document', {
                method: 'POST',
                body: formData,
            })

            const json = await res.json()

            if (!res.ok) {
                throw new Error(json.error || 'Upload failed')
            }

            if (json.warning) {
                toast.warning(t('admin.students.profile.documentsUploadSavedButNotFiled'))
            }

            toast.success(t('admin.students.profile.documentsUploadSuccess', { docName }), {
                description: `${file.name} (${(file.size / 1024).toFixed(0)} KB)`
            })
            fetchDocuments()
        } catch (err) {
            console.error('Upload error:', err)
            toast.error(t('admin.students.profile.documentsUploadError'))
        } finally {
            setUploading(null)
            if (fileInputRef.current) fileInputRef.current.value = ''
            if (cameraInputRef.current) cameraInputRef.current.value = ''
        }
    }

    const handleViewDocument = (url: string | null) => {
        if (!url) {
            toast.error(t('admin.students.profile.documentsNoFileToView'))
            return
        }
        setViewingDoc(url)
    }

    const handleDeleteOfficialDoc = async (docId: string) => {
        if (!confirm(t('admin.students.profile.deleteDocConfirm'))) return
        setDeletingDocId(docId)
        const supabase = createClient()
        await supabase.from('student_documents').delete().eq('id', docId)
        setDeletingDocId(null)
        toast.success(t('admin.students.profile.deleteDocSuccess'))
        fetchDocuments()
    }

    const handleDeletePedaDoc = async (docId: string) => {
        if (!confirm(t('admin.students.profile.deleteDocConfirm'))) return
        setDeletingDocId(docId)
        const supabase = createClient()
        await supabase.from('documents').delete().eq('id', docId)
        setDeletingDocId(null)
        toast.success(t('admin.students.profile.deleteDocSuccess'))
        fetchPedaDocs()
    }

    const handleRenamePedaDoc = async () => {
        if (!renamingDoc || !renameValue.trim()) return
        const supabase = createClient()
        await supabase.from('documents').update({ name: renameValue.trim() }).eq('id', renamingDoc.id)
        toast.success(t('admin.students.profile.renameDocSuccess'))
        setRenamingDoc(null)
        fetchPedaDocs()
    }

    const handleChangeStatus = async (docId: string, newStatus: 'valid' | 'pending' | 'missing') => {
        const supabase = createClient()
        const { error } = await supabase.from('student_documents').update({ status: newStatus }).eq('id', docId)
        if (error) { toast.error(error.message); return }
        setStatusMenuId(null)
        fetchDocuments()
    }

    const validCount = documents.filter(d => d.status === 'valid' || d.status === 'pending').length
    const totalCount = documents.length
    const progressPercentage = totalCount > 0 ? Math.round((validCount / totalCount) * 100) : 0

    const getDocIcon = (name: string) => {
        const found = requiredDocuments.find(r => r.name === name)
        return found || { icon: FileText, color: 'text-gray-400' }
    }

    const getDocLabel = (name: string) => {
        const found = requiredDocuments.find(r => r.name === name)
        return found?.labelKey ? t(found.labelKey) : name
    }

    const filteredPedaDocs = pedaDocs.filter(d => {
        if (typeFilter !== 'all' && d.document_type !== typeFilter) return false
        if (subjectFilter !== 'all' && d.subject_id !== subjectFilter) return false
        return true
    })

    return (
        <div className="bg-[#1A2530] rounded-3xl border border-white/5 p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <UploadDocumentDialog
                isOpen={uploadDialogOpen}
                onClose={() => setUploadDialogOpen(false)}
                onSuccess={fetchPedaDocs}
                defaultClassId={resolvedClassId}
            />
            {/* Hidden file inputs */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={handleFileSelected}
            />
            <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileSelected}
            />

            {/* Document Viewer Modal */}
            {viewingDoc && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setViewingDoc(null)}>
                    <div className="relative max-w-4xl w-full max-h-[90vh] bg-[#1A2530] rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-white/5">
                            <h3 className="font-bold text-white">{t('admin.students.profile.documentsViewerTitle')}</h3>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white" onClick={() => window.open(viewingDoc, '_blank')}>
                                    <Download className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white" onClick={() => setViewingDoc(null)}>
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                        <div className="p-4 flex items-center justify-center min-h-[400px]">
                            {viewingDoc.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
                                <img src={viewingDoc} alt="Document" className="max-w-full max-h-[70vh] object-contain rounded-lg" />
                            ) : (
                                <iframe src={viewingDoc} className="w-full h-[70vh] rounded-lg" />
                            )}
                        </div>
                    </div>
                </div>
            )}

            <Tabs defaultValue="dossier">
                <TabsList className="bg-[#0F1720] border border-white/5 p-1 rounded-xl w-full grid grid-cols-2 mb-4">
                    <TabsTrigger value="dossier" className="rounded-lg data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 text-xs font-bold">
                        {t('admin.students.profile.documentsTabOfficial')}
                    </TabsTrigger>
                    <TabsTrigger value="ressources" className="rounded-lg data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 text-xs font-bold">
                        {t('admin.students.profile.documentsTabResources')}
                    </TabsTrigger>
                </TabsList>

                {/* Tab 1: Official documents */}
                <TabsContent value="dossier" className="space-y-5">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <h3 className="font-bold text-white">{t('admin.students.profile.studentFile')}</h3>
                            {validCount === totalCount && totalCount > 0 && (
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                                    <CheckCircle2 className="w-3 h-3 mr-1" /> {t('admin.students.profile.documentsComplete')}
                                </Badge>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-xs text-gray-400">
                            <span>{t('admin.students.profile.documentsProgress')}</span>
                            <span className="text-emerald-500 font-bold">{progressPercentage}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-[#0F1720] rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progressPercentage}%` }} />
                        </div>
                        <p className="text-[10px] text-gray-500 italic">
                            {t('admin.students.profile.documentsProgressCount', {
                                validCount,
                                totalCount,
                                validPlural: validCount > 1 ? 's' : '',
                            })}
                        </p>
                    </div>

                    <div className="space-y-3">
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                            </div>
                        ) : (
                            documents.map((doc) => {
                                const docMeta = getDocIcon(doc.name)
                                const DocIcon = docMeta.icon
                                return (
                                    <div key={doc.id} className="bg-[#0F1720] p-4 rounded-xl border border-white/5 flex items-center justify-between group">
                                        <div className="flex items-center gap-4">
                                            <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center bg-[#1A2530] relative", docMeta.color)}>
                                                <DocIcon className="w-5 h-5" />
                                                {doc.status === 'valid' && <div className="absolute -top-1 -right-1 h-3 w-3 bg-emerald-500 rounded-full border-2 border-[#0F1720]" />}
                                                {doc.status === 'pending' && <div className="absolute -top-1 -right-1 h-3 w-3 bg-amber-400 rounded-full border-2 border-[#0F1720]" />}
                                            </div>
                                            <div>
                                                <h5 className={cn("font-bold text-sm", doc.status === 'missing' ? "text-red-400" : "text-white")}>{getDocLabel(doc.name)}</h5>
                                                {/* Clickable status badge */}
                                                <div className="relative mt-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => !isArchived && setStatusMenuId(statusMenuId === doc.id ? null : doc.id)}
                                                        className={cn(
                                                            "flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors",
                                                            doc.status === 'valid'   ? 'bg-emerald-500 text-white' :
                                                            doc.status === 'pending' ? 'bg-amber-400 text-black' :
                                                            'bg-red-500 text-white',
                                                            !isArchived && 'hover:opacity-80 cursor-pointer'
                                                        )}
                                                    >
                                                        {doc.status === 'valid' ? t('admin.students.profile.documentsValidatedOn', { date: doc.uploaded_at ? (() => { const _d = new Date(doc.uploaded_at); return _d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Nouakchott' }) + ' ' + _d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nouakchott' }) })() : '—' })
                                                         : doc.status === 'pending' ? t('admin.students.profile.documentsPending')
                                                         : t('admin.students.profile.documentsMissing')}
                                                        {!isArchived && <ChevronDown className="w-2.5 h-2.5" />}
                                                    </button>
                                                    {statusMenuId === doc.id && (
                                                        <>
                                                            <div className="fixed inset-0 z-10" onClick={() => setStatusMenuId(null)} />
                                                            <div className="absolute left-0 top-full mt-1 z-20 bg-[#1A2530] border border-white/10 rounded-xl shadow-xl overflow-hidden min-w-[130px]">
                                                                {(['valid', 'pending', 'missing'] as const).map(s => (
                                                                    <button key={s} type="button"
                                                                        onClick={() => handleChangeStatus(doc.id, s)}
                                                                        className={cn(
                                                                            "w-full text-left px-3 py-2 text-xs font-bold flex items-center gap-2 hover:bg-white/5 transition-colors",
                                                                            doc.status === s ? 'opacity-50 cursor-default' : ''
                                                                        )}
                                                                    >
                                                                        <span className={cn("w-2 h-2 rounded-full",
                                                                            s === 'valid' ? 'bg-emerald-500' :
                                                                            s === 'pending' ? 'bg-amber-400' : 'bg-red-500'
                                                                        )} />
                                                                        <span className={s === 'valid' ? 'text-emerald-400' : s === 'pending' ? 'text-amber-400' : 'text-red-400'}>
                                                                            {s === 'valid' ? t('admin.students.profile.documentsStatusValid') : s === 'pending' ? t('admin.students.profile.documentsStatusPending') : t('admin.students.profile.documentsStatusMissing')}
                                                                        </span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {uploading === doc.name || deletingDocId === doc.id ? (
                                                <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
                                            ) : doc.status === 'missing' ? (
                                                !isArchived ? (
                                                    <Button type="button" size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold h-8 rounded-lg gap-1" onClick={() => handleUploadForDocument(doc.name)}>
                                                        <Upload className="w-3 h-3" /> {t('admin.students.profile.documentsAddUpper')}
                                                    </Button>
                                                ) : (
                                                    <span className="text-xs text-red-400 font-semibold">{t('admin.students.profile.documentsMissing')}</span>
                                                )
                                            ) : (
                                                <>
                                                    <Button type="button" size="icon" variant="ghost" className="text-gray-500 hover:text-white h-8 w-8" onClick={() => handleViewDocument(doc.file_url)}>
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                    {!isArchived && (
                                                        <>
                                                            <Button type="button" size="icon" variant="ghost" className="text-gray-500 hover:text-blue-400 h-8 w-8" title="Remplacer" onClick={() => handleUploadForDocument(doc.name)}>
                                                                <Upload className="w-4 h-4" />
                                                            </Button>
                                                            <Button type="button" size="icon" variant="ghost" className="text-gray-500 hover:text-red-400 h-8 w-8" title="Supprimer" onClick={() => handleDeleteOfficialDoc(doc.id)}>
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>

                    {!isArchived && (
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <Button variant="outline" className="bg-[#0F1720] border-white/5 hover:bg-[#1A2530] text-gray-300 gap-2 h-10" onClick={handleCameraCapture}>
                                <Camera className="w-4 h-4" /> {t('admin.students.profile.documentsTakePhoto')}
                            </Button>
                            <Button variant="outline" className="bg-[#0F1720] border-white/5 hover:bg-[#1A2530] text-gray-300 gap-2 h-10" onClick={handleGeneralUpload}>
                                <Upload className="w-4 h-4" /> {t('admin.students.profile.documentsImportPdf')}
                            </Button>
                        </div>
                    )}

                    <div className="flex justify-center pt-2">
                        <div className="flex items-center gap-2 text-[10px] text-gray-500">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            <span>{t('admin.students.profile.documentsEncryptedHint')}</span>
                        </div>
                    </div>
                </TabsContent>

                {/* Tab 2: Pedagogical resources */}
                <TabsContent value="ressources" className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-white text-sm">{t('admin.students.profile.documentsClassResourcesTitle')}</h3>
                        {!isArchived && (
                            <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold gap-1 h-8" onClick={() => setUploadDialogOpen(true)}>
                                <Plus className="w-3.5 h-3.5" /> {t('admin.students.profile.documentsAdd')}
                            </Button>
                        )}
                    </div>

                    {/* Filters */}
                    <div className="flex gap-2">
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="bg-[#0F1720] border-white/10 text-white h-8 text-xs flex-1">
                                <SelectValue placeholder={t('admin.students.profile.documentsFilterTypePlaceholder')} />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1A2530] border-white/10 text-white">
                                <SelectItem value="all">{t('admin.students.profile.documentsFilterAllTypes')}</SelectItem>
                                {Object.entries(DOC_TYPE_LABEL_KEYS).map(([v, k]) => (
                                    <SelectItem key={v} value={v}>{t(k)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {subjects.length > 0 && (
                            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                                <SelectTrigger className="bg-[#0F1720] border-white/10 text-white h-8 text-xs flex-1">
                                    <SelectValue placeholder={t('admin.students.profile.documentsFilterSubjectPlaceholder')} />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1A2530] border-white/10 text-white">
                                    <SelectItem value="all">{t('admin.students.profile.documentsFilterAllSubjects')}</SelectItem>
                                    {subjects.map(s => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {pedaLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
                        </div>
                    ) : filteredPedaDocs.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">
                            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">{t('admin.students.profile.documentsNoneAvailable')}</p>
                            {!resolvedClassId && <p className="text-xs mt-1">{t('admin.students.profile.documentsAssignClassHint')}</p>}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredPedaDocs.map(doc => (
                                <div key={doc.id} className="flex items-center gap-3 p-3 bg-[#0F1720] rounded-xl border border-white/5 hover:border-cyan-500/30 transition-colors group">
                                    <a href={doc.file_url || '#'} target={doc.file_url ? '_blank' : undefined} rel="noopener noreferrer" className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className="h-9 w-9 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                                            {doc.subjectIcon ? (
                                                <span className="text-base">{doc.subjectIcon}</span>
                                            ) : (
                                                <FileText className="w-4 h-4 text-cyan-400" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            {renamingDoc?.id === doc.id ? (
                                                <input
                                                    className="w-full bg-[#1A2530] border border-cyan-500/50 text-white text-sm rounded-md px-2 py-1 focus:outline-none"
                                                    value={renameValue}
                                                    onChange={e => setRenameValue(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') handleRenamePedaDoc(); if (e.key === 'Escape') setRenamingDoc(null) }}
                                                    autoFocus
                                                    onClick={e => e.preventDefault()}
                                                />
                                            ) : (
                                                <p className="text-sm font-medium text-white truncate group-hover:text-cyan-300 transition-colors">{doc.name}</p>
                                            )}
                                            <p className="text-[10px] text-gray-500 mt-0.5">
                                                {DOC_TYPE_LABEL_KEYS[doc.document_type] ? t(DOC_TYPE_LABEL_KEYS[doc.document_type]) : doc.document_type}
                                                {doc.subjectName && ` · ${doc.subjectName}`}
                                            </p>
                                        </div>
                                    </a>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {deletingDocId === doc.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                                        ) : renamingDoc?.id === doc.id ? (
                                            <>
                                                <button type="button" onClick={handleRenamePedaDoc} className="text-xs text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded border border-emerald-500/30">OK</button>
                                                <button type="button" onClick={() => setRenamingDoc(null)} className="text-xs text-gray-500 hover:text-white"><X className="w-3.5 h-3.5" /></button>
                                            </>
                                        ) : (
                                            <>
                                                {doc.file_url && <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white"><Download className="w-4 h-4" /></a>}
                                                {!isArchived && (
                                                    <>
                                                        <button type="button" title="Renommer" className="text-gray-500 hover:text-blue-400 p-1" onClick={() => { setRenamingDoc({ id: doc.id, name: doc.name }); setRenameValue(doc.name) }}>
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button type="button" title="Supprimer" className="text-gray-500 hover:text-red-400 p-1" onClick={() => handleDeletePedaDoc(doc.id)}>
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}
