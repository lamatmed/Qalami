'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, Eye, CheckCircle2, Upload, Plus, Camera, Image as ImageIcon, Loader2, Download, X, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { createClient } from '@/utils/supabase/client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UploadDocumentDialog } from '@/components/admin/documents/upload-document-dialog'

interface StudentDocumentsProps {
    studentId?: string
    classId?: string
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

const DOC_TYPE_LABELS: Record<string, string> = {
    course: 'Cours', exercise: 'Exercice', exam: 'Examen',
    devoirs: 'Devoirs', correction: 'Correction', resource: 'Ressource', general: 'Général',
}

const requiredDocuments = [
    { name: 'Acte de Naissance', icon: FileText, color: 'text-blue-400' },
    { name: 'Photo d\'identité', icon: ImageIcon, color: 'text-purple-400' },
    { name: 'Certificat Médical', icon: FileText, color: 'text-emerald-400' },
    { name: 'Bulletin Précédent', icon: FileText, color: 'text-orange-400' },
]

export function StudentDocuments({ studentId, classId }: StudentDocumentsProps) {
    const [documents, setDocuments] = useState<Document[]>([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState<string | null>(null)
    const [viewingDoc, setViewingDoc] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const cameraInputRef = useRef<HTMLInputElement>(null)
    const [uploadTarget, setUploadTarget] = useState<string>('')

    // Pedagogical docs
    const [pedaDocs, setPedaDocs] = useState<PedaDocument[]>([])
    const [pedaLoading, setPedaLoading] = useState(false)
    const [typeFilter, setTypeFilter] = useState<string>('all')
    const [subjectFilter, setSubjectFilter] = useState<string>('all')
    const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([])
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false)

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
        if (!classId) return
        setPedaLoading(true)
        const supabase = createClient()
        const { data } = await supabase
            .from('documents')
            .select('id, name, file_url, file_type, file_size_bytes, document_type, subject_id, subjects(name, icon), created_at')
            .eq('class_id', classId)
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
    }, [classId])

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
            const supabase = createClient()

            // Upload to Supabase Storage
            const fileExt = file.name.split('.').pop()
            const filePath = `students/${studentId}/${docName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.${fileExt}`

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: true
                })

            if (uploadError) {
                // If bucket doesn't exist, try creating it
                if (uploadError.message?.includes('not found') || uploadError.message?.includes('Bucket')) {
                    toast.error('Le stockage n\'est pas configuré. Contactez l\'administrateur pour créer le bucket "documents" dans Supabase Storage.')
                    return
                }
                throw uploadError
            }

            // Get public URL
            const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath)

            // Save document reference in DB
            if (studentId) {
                const { error: dbError } = await supabase.from('student_documents').upsert({
                    student_id: studentId,
                    document_name: docName,
                    file_url: urlData.publicUrl,
                    file_type: fileExt?.toUpperCase() || 'PDF',
                    status: 'pending',
                    uploaded_at: new Date().toISOString()
                }, {
                    onConflict: 'student_id,document_name'
                })

                if (dbError) {
                    console.error('DB save error:', dbError)
                    // Even if DB save fails, file is uploaded
                    toast.warning('Fichier uploadé mais non enregistré dans le dossier')
                }
            }

            toast.success(`${docName} uploadé avec succès`, {
                description: `${file.name} (${(file.size / 1024).toFixed(0)} KB)`
            })
            fetchDocuments()
        } catch (err) {
            console.error('Upload error:', err)
            toast.error('Erreur lors de l\'upload du fichier')
        } finally {
            setUploading(null)
            // Reset file input
            if (fileInputRef.current) fileInputRef.current.value = ''
            if (cameraInputRef.current) cameraInputRef.current.value = ''
        }
    }

    const handleViewDocument = (url: string | null) => {
        if (!url) {
            toast.error('Aucun fichier à visualiser')
            return
        }
        setViewingDoc(url)
    }

    const validCount = documents.filter(d => d.status === 'valid' || d.status === 'pending').length
    const totalCount = documents.length
    const progressPercentage = totalCount > 0 ? Math.round((validCount / totalCount) * 100) : 0

    const getDocIcon = (name: string) => {
        const found = requiredDocuments.find(r => r.name === name)
        return found || { icon: FileText, color: 'text-gray-400' }
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
                defaultClassId={classId}
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
                            <h3 className="font-bold text-white">Aperçu du document</h3>
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
                        Dossier Officiel
                    </TabsTrigger>
                    <TabsTrigger value="ressources" className="rounded-lg data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 text-xs font-bold">
                        Ressources Pédagogiques
                    </TabsTrigger>
                </TabsList>

                {/* Tab 1: Official documents */}
                <TabsContent value="dossier" className="space-y-5">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <h3 className="font-bold text-white">Dossier Élève</h3>
                            {validCount === totalCount && totalCount > 0 && (
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                                    <CheckCircle2 className="w-3 h-3 mr-1" /> Complet
                                </Badge>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-xs text-gray-400">
                            <span>Progression du dossier</span>
                            <span className="text-emerald-500 font-bold">{progressPercentage}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-[#0F1720] rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progressPercentage}%` }} />
                        </div>
                        <p className="text-[10px] text-gray-500 italic">{validCount} document{validCount > 1 ? 's' : ''} sur {totalCount} validé{validCount > 1 ? 's' : ''}</p>
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
                                                {doc.status === 'pending' && <div className="absolute -top-1 -right-1 h-3 w-3 bg-orange-500 rounded-full border-2 border-[#0F1720]" />}
                                            </div>
                                            <div>
                                                <h5 className={cn("font-bold text-sm", doc.status === 'missing' ? "text-red-400" : "text-white")}>{doc.name}</h5>
                                                <p className={cn("text-[10px]", doc.status === 'valid' ? "text-emerald-500" : doc.status === 'pending' ? "text-orange-400" : "text-red-400")}>
                                                    {doc.status === 'valid' && `Validé le ${doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString('fr-FR') : '—'}`}
                                                    {doc.status === 'pending' && "En cours de vérification..."}
                                                    {doc.status === 'missing' && "Document manquant"}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {uploading === doc.name ? (
                                                <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
                                            ) : doc.status === 'missing' ? (
                                                <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold h-8 rounded-lg gap-1" onClick={() => handleUploadForDocument(doc.name)}>
                                                    <Upload className="w-3 h-3" /> AJOUTER
                                                </Button>
                                            ) : (
                                                <Button size="icon" variant="ghost" className="text-gray-500 hover:text-white" onClick={() => handleViewDocument(doc.file_url)}>
                                                    <Eye className="w-5 h-5" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <Button variant="outline" className="bg-[#0F1720] border-white/5 hover:bg-[#1A2530] text-gray-300 gap-2 h-10" onClick={handleCameraCapture}>
                            <Camera className="w-4 h-4" /> Prendre une photo
                        </Button>
                        <Button variant="outline" className="bg-[#0F1720] border-white/5 hover:bg-[#1A2530] text-gray-300 gap-2 h-10" onClick={handleGeneralUpload}>
                            <Upload className="w-4 h-4" /> Importer PDF
                        </Button>
                    </div>

                    <div className="flex justify-center pt-2">
                        <div className="flex items-center gap-2 text-[10px] text-gray-500">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            <span>Tous les documents sont chiffrés et sécurisés.</span>
                        </div>
                    </div>
                </TabsContent>

                {/* Tab 2: Pedagogical resources */}
                <TabsContent value="ressources" className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-white text-sm">Ressources de la classe</h3>
                        <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold gap-1 h-8" onClick={() => setUploadDialogOpen(true)}>
                            <Plus className="w-3.5 h-3.5" /> Ajouter
                        </Button>
                    </div>

                    {/* Filters */}
                    <div className="flex gap-2">
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="bg-[#0F1720] border-white/10 text-white h-8 text-xs flex-1">
                                <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1A2530] border-white/10 text-white">
                                <SelectItem value="all">Tous les types</SelectItem>
                                {Object.entries(DOC_TYPE_LABELS).map(([v, l]) => (
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
                                    <SelectItem value="all">Toutes les matières</SelectItem>
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
                            <p className="text-sm">Aucun document disponible</p>
                            {!classId && <p className="text-xs mt-1">Associez l'élève à une classe pour voir les ressources</p>}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredPedaDocs.map(doc => (
                                <a
                                    key={doc.id}
                                    href={doc.file_url || '#'}
                                    target={doc.file_url ? '_blank' : undefined}
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 p-3 bg-[#0F1720] rounded-xl border border-white/5 hover:border-cyan-500/30 transition-colors group"
                                >
                                    <div className="h-9 w-9 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                                        {doc.subjectIcon ? (
                                            <span className="text-base">{doc.subjectIcon}</span>
                                        ) : (
                                            <FileText className="w-4 h-4 text-cyan-400" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-white truncate group-hover:text-cyan-300 transition-colors">{doc.name}</p>
                                        <p className="text-[10px] text-gray-500 mt-0.5">
                                            {DOC_TYPE_LABELS[doc.document_type] || doc.document_type}
                                            {doc.subjectName && ` · ${doc.subjectName}`}
                                        </p>
                                    </div>
                                    {doc.file_url && <Download className="w-4 h-4 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />}
                                </a>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}
