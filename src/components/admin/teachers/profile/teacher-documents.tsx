'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileText, Download, Eye, Upload, CheckCircle2, AlertCircle, X, Loader2, BookOpen, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/utils/supabase/client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UploadDocumentDialog } from '@/components/admin/documents/upload-document-dialog'
import { useLanguage } from '@/i18n'

interface TeacherDocumentsProps {
    teacherId?: string
}

const ADMIN_DOCS = [
    { id: '1', name: 'CV', type: 'cv', size: '', status: 'missing', date: '', file_url: '' },
    { id: '2', name: 'Contrat de travail', type: 'contract', size: '', status: 'missing', date: '', file_url: '' },
    { id: '3', name: 'Diplôme', type: 'diploma', size: '', status: 'missing', date: '', file_url: '' },
    { id: '4', name: 'Certificat Médical', type: 'medical', size: '', status: 'missing', date: '', file_url: '' },
]

interface TeacherResource {
    id: string
    name: string
    file_url: string | null
    file_type: string | null
    file_size_bytes: number | null
    document_type: string
    subjectName: string | null
    subjectIcon: string | null
    className: string | null
    academic_year: string | null
    created_at: string
}

export function TeacherDocuments({ teacherId }: TeacherDocumentsProps) {
    const { t } = useLanguage()
    const [adminDocs, setAdminDocs] = useState(ADMIN_DOCS)
    const [uploading, setUploading] = useState(false)
    const [viewingDoc, setViewingDoc] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [uploadTarget, setUploadTarget] = useState('')

    // Resources tab
    const [resources, setResources] = useState<TeacherResource[]>([])
    const [resLoading, setResLoading] = useState(false)
    const [typeFilter, setTypeFilter] = useState('all')
    const [subjectFilter, setSubjectFilter] = useState('all')
    const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([])
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false)

    const docTypeLabels: Record<string, string> = {
        course: t('admin.teachers.documents.types.course'),
        exercise: t('admin.teachers.documents.types.exercise'),
        exam: t('admin.teachers.documents.types.exam'),
        devoirs: t('admin.teachers.documents.types.devoirs'),
        correction: t('admin.teachers.documents.types.correction'),
        resource: t('admin.teachers.documents.types.resource'),
        general: t('admin.teachers.documents.types.general'),
    }

    const fetchResources = async () => {
        if (!teacherId) return
        setResLoading(true)
        const supabase = createClient()
        const { data } = await supabase
            .from('documents')
            .select('id, name, file_url, file_type, file_size_bytes, document_type, academic_year, created_at, subjects(name, icon), classes(name)')
            .eq('teacher_id', teacherId)
            .order('created_at', { ascending: false })

        const mapped: TeacherResource[] = (data || []).map((d: any) => ({
            id: d.id,
            name: d.name,
            file_url: d.file_url,
            file_type: d.file_type,
            file_size_bytes: d.file_size_bytes,
            document_type: d.document_type,
            subjectName: d.subjects?.name || null,
            subjectIcon: d.subjects?.icon || null,
            className: d.classes?.name || null,
            academic_year: d.academic_year,
            created_at: d.created_at,
        }))

        setResources(mapped)
        const uniqueSubjects = mapped
            .filter(d => d.subjectName)
            .reduce((acc, d) => {
                if (!acc.find(s => s.id === (d as any).subject_id)) {
                    acc.push({ id: (d as any).subject_id, name: d.subjectName! })
                }
                return acc
            }, [] as { id: string; name: string }[])
        setSubjects(uniqueSubjects)
        setResLoading(false)
    }

    useEffect(() => {
        fetchResources()
    }, [teacherId])

    const handleUpload = (docName: string) => {
        setUploadTarget(docName)
        fileInputRef.current?.click()
    }

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        try {
            const supabase = createClient()
            const fileExt = file.name.split('.').pop()
            const filePath = `teachers/${teacherId || 'unknown'}/${uploadTarget.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.${fileExt}`

            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, file, { cacheControl: '3600', upsert: true })

            if (uploadError) {
                if (uploadError.message?.includes('not found') || uploadError.message?.includes('Bucket')) {
                    toast.error(t('admin.teachers.documents.storageBucketError'))
                    return
                }
                throw uploadError
            }

            const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath)

            setAdminDocs(prev => prev.map(d =>
                d.name === uploadTarget || d.type === uploadTarget
                    ? {
                        ...d,
                        status: 'verified',
                        date: new Date().toLocaleDateString(t('common.locale') || 'fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
                        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
                        file_url: urlData.publicUrl
                    }
                    : d
            ))

            toast.success(t('admin.teachers.documents.uploadSuccess', { name: uploadTarget }))
        } catch (err) {
            console.error('Upload error:', err)
            toast.error(t('admin.teachers.documents.uploadError'))
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleViewDoc = (url: string) => {
        if (!url) { toast.error(t('admin.teachers.documents.noFileToView')); return }
        setViewingDoc(url)
    }

    const handleDownload = (url: string, name: string) => {
        if (!url) { toast.error(t('admin.teachers.documents.noFileToDownload')); return }
        const link = document.createElement('a')
        link.href = url
        link.download = name
        link.target = '_blank'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const verifiedCount = adminDocs.filter(d => d.status === 'verified').length

    const filteredResources = resources.filter(d => {
        if (typeFilter !== 'all' && d.document_type !== typeFilter) return false
        if (subjectFilter !== 'all' && d.subjectName !== subjectFilter) return false
        return true
    })

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden" onChange={handleFileSelected} />

            <UploadDocumentDialog
                isOpen={uploadDialogOpen}
                onClose={() => setUploadDialogOpen(false)}
                onSuccess={fetchResources}
                defaultTeacherId={teacherId}
            />

            {/* Document Viewer Modal */}
            {viewingDoc && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setViewingDoc(null)}>
                    <div className="relative max-w-4xl w-full max-h-[90vh] bg-[#1A2530] rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-white/5">
                            <h3 className="font-bold text-white">{t('admin.teachers.documents.preview')}</h3>
                            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white" onClick={() => setViewingDoc(null)}>
                                <X className="w-4 h-4" />
                            </Button>
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

            <Tabs defaultValue="admin">
                <TabsList className="bg-[#1A2530] border border-white/5 p-1 rounded-xl w-full grid grid-cols-2 mb-2">
                    <TabsTrigger value="admin" className="rounded-lg data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 text-xs font-bold">
                        {t('admin.teachers.documents.title')}
                    </TabsTrigger>
                    <TabsTrigger value="resources" className="rounded-lg data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 text-xs font-bold">
                        {t('admin.teachers.documents.pedagogicalResources')}
                    </TabsTrigger>
                </TabsList>

                {/* Tab 1: Admin docs */}
                <TabsContent value="admin" className="space-y-4">
                    <div className="flex justify-between items-center bg-[#1A2530] p-4 rounded-2xl border border-white/5">
                        <div>
                            <h3 className="text-white font-bold">{t('admin.teachers.documents.title')}</h3>
                            <p className="text-xs text-gray-400">
                                {t('admin.teachers.documents.verifiedCount').replace('{verified}', verifiedCount.toString()).replace('{total}', adminDocs.length.toString())}
                            </p>
                        </div>
                        <Button
                            className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold gap-2"
                            onClick={() => { setUploadTarget('cv'); fileInputRef.current?.click() }}
                            disabled={uploading}
                        >
                            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            {t('admin.teachers.documents.add')}
                        </Button>
                    </div>

                    <div className="bg-[#1A2530] rounded-3xl border border-white/5 overflow-hidden">
                        <div className="divide-y divide-white/5">
                            {adminDocs.map((doc) => {
                                const localizedName = t(`admin.teachers.documents.types.${doc.type}`) || doc.name
                                const localizedType = t(`admin.teachers.documents.types.${doc.type}`) || doc.type
                                return (
                                    <div key={doc.id} className="p-4 sm:p-5 flex items-center justify-between hover:bg-[#0F1720] transition-colors group">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 bg-[#0F1720] rounded-xl flex items-center justify-center border border-white/5 group-hover:border-emerald-500/30 transition-colors">
                                                <FileText className="w-6 h-6 text-gray-400 group-hover:text-emerald-500" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-white text-sm group-hover:text-emerald-500 transition-colors">{localizedName}</h4>
                                                <div className="flex items-center gap-2 text-xs mt-1">
                                                    <Badge variant="outline" className="bg-white/5 border-white/10 text-gray-400 font-normal">{localizedType}</Badge>
                                                    {doc.size && <span className="text-gray-500">• {doc.size}</span>}
                                                    {doc.date && <span className="text-gray-500">• {doc.date}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {doc.status === 'verified' ? (
                                                <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                                    <span className="text-[10px] font-bold text-emerald-500 uppercase">{t('admin.teachers.documents.verified')}</span>
                                                </div>
                                            ) : doc.status === 'expired' ? (
                                                <div className="flex items-center gap-1.5 bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20">
                                                    <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                                                    <span className="text-[10px] font-bold text-red-500 uppercase">{t('admin.teachers.documents.expired')}</span>
                                                </div>
                                            ) : (
                                                <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold h-7 text-xs rounded-lg gap-1" onClick={() => handleUpload(doc.type)}>
                                                    <Upload className="w-3 h-3" /> {t('admin.teachers.documents.add')}
                                                </Button>
                                            )}
                                            {doc.file_url && (
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white h-8 w-8" onClick={() => handleViewDoc(doc.file_url)}>
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white h-8 w-8" onClick={() => handleDownload(doc.file_url, localizedName)}>
                                                        <Download className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </TabsContent>

                {/* Tab 2: Pedagogical resources */}
                <TabsContent value="resources" className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-white text-sm">
                            {t('admin.teachers.documents.myResources').replace('{count}', resources.length.toString())}
                        </h3>
                        <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold gap-1 h-8" onClick={() => setUploadDialogOpen(true)}>
                            <Plus className="w-3.5 h-3.5" /> {t('admin.teachers.documents.add')}
                        </Button>
                    </div>

                    {/* Filters */}
                    <div className="flex gap-2">
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="bg-[#0F1720] border-white/10 text-white h-8 text-xs flex-1">
                                <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1A2530] border-white/10 text-white">
                                <SelectItem value="all">{t('admin.teachers.documents.allTypes')}</SelectItem>
                                {Object.entries(docTypeLabels).map(([v, l]) => (
                                    <SelectItem key={v} value={v}>{l}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {subjects.length > 0 && (
                            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                                <SelectTrigger className="bg-[#0F1720] border-white/10 text-white h-8 text-xs flex-1">
                                    <SelectValue placeholder="Matière" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1A2530] border-white/10 text-white">
                                    <SelectItem value="all">{t('admin.teachers.documents.allSubjects')}</SelectItem>
                                    {subjects.map(s => (
                                        <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {resLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
                        </div>
                    ) : filteredResources.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">
                            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">{t('admin.teachers.documents.noResources')}</p>
                            <p className="text-xs mt-1">{t('admin.teachers.documents.noResourcesDesc')}</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredResources.map(doc => (
                                <div key={doc.id} className="flex items-center gap-3 p-3 bg-[#0F1720] rounded-xl border border-white/5 hover:border-cyan-500/30 transition-colors group">
                                    <div className="h-9 w-9 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                                        {doc.subjectIcon ? (
                                            <span className="text-base">{doc.subjectIcon}</span>
                                        ) : (
                                            <FileText className="w-4 h-4 text-cyan-400" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-white truncate">{doc.name}</p>
                                        <p className="text-[10px] text-gray-500 mt-0.5">
                                            <span className="text-cyan-400 font-bold">{docTypeLabels[doc.document_type] || doc.document_type}</span>
                                            {doc.subjectName && ` · ${doc.subjectName}`}
                                            {doc.className && ` · ${doc.className}`}
                                            {doc.academic_year && ` · ${doc.academic_year}`}
                                        </p>
                                    </div>
                                    {doc.file_url && (
                                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                                            <Button variant="ghost" size="icon" className="text-gray-500 hover:text-white h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Download className="w-4 h-4" />
                                            </Button>
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}
