'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, Clock, FileText, Upload, CheckCircle2, MoreHorizontal, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState, useTransition } from 'react'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'
import { FileUpload } from '@/components/shared/file-upload'
import { type UploadResult } from '@/lib/upload'

interface HomeworkData {
    id: string
    title: string
    description: string | null
    instructions: string | null
    dueDate: string | null
    maxPoints: number | null
    attachmentUrls: string[] | null
    subjectName: string
    className: string
    teacherName: string
}

interface SubmissionData {
    id: string
    status: string
    grade: number | null
    feedback: string | null
    submittedAt: string
    attachmentUrls: string[] | null
}

interface Props {
    homework: HomeworkData
    existingSubmission: SubmissionData | null
}

export function HomeworkDetailView({ homework, existingSubmission }: Props) {
    const router = useRouter()
    const supabase = createClient()
    const [isPending, startTransition] = useTransition()
    const [isSuccess, setIsSuccess] = useState(false)
    const [comment, setComment] = useState('')
    const [sheetOpen, setSheetOpen] = useState(false)
    const [uploadedFiles, setUploadedFiles] = useState<UploadResult[]>([])

    const formatDue = (dateStr: string | null) => {
        if (!dateStr) return 'Pas de date limite'
        const date = new Date(dateStr)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        if (date.toDateString() === today.toDateString()) {
            return `Aujourd'hui, ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nouakchott' })}`
        }
        if (date.toDateString() === tomorrow.toDateString()) {
            return `Demain, ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nouakchott' })}`
        }
        return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nouakchott' })
    }

    const handleUploadComplete = (results: UploadResult[]) => {
        setUploadedFiles(prev => [...prev, ...results])
    }

    const handleSubmit = () => {
        startTransition(async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) throw new Error('Not authenticated')

                // Get file paths from uploaded files
                const attachmentPaths = uploadedFiles.map(f => f.path)

                const { error } = await supabase.from('homework_submissions').insert({
                    homework_id: homework.id,
                    student_id: user.id,
                    content: comment || null,
                    status: 'submitted',
                    attachment_urls: attachmentPaths
                })

                if (error) throw error

                toast.success('Devoir soumis avec succès!')
                setIsSuccess(true)
                setSheetOpen(false)
            } catch (error) {
                console.error('Error submitting:', error)
                toast.error('Erreur lors de la soumission')
            }
        })
    }

    // Already submitted view
    if (existingSubmission || isSuccess) {
        const sub = existingSubmission
        return (
            <div className="h-full flex flex-col items-center justify-center p-6 space-y-8 animate-in fade-in duration-500">
                <div className="w-32 h-32 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4 relative">
                    <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
                    <CheckCircle2 className="w-16 h-16 text-emerald-500" />
                </div>

                <div className="text-center space-y-2">
                    <h1 className="text-2xl font-bold">
                        {sub?.grade ? 'Devoir corrigé!' : 'Devoir envoyé avec succès!'}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {sub?.submittedAt ? `Envoyé le ${new Date(sub.submittedAt).toLocaleDateString('fr-FR')}` : "Envoyé aujourd'hui"}
                    </p>
                </div>

                {sub?.grade !== null && sub?.grade !== undefined && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 text-center">
                        <p className="text-4xl font-black text-emerald-500">{sub.grade}/{homework.maxPoints ?? 20}</p>
                        <p className="text-sm text-gray-400">Votre note</p>
                        {sub.feedback && (
                            <p className="text-sm text-gray-300 mt-4 bg-black/20 p-3 rounded-xl">{sub.feedback}</p>
                        )}
                    </div>
                )}

                <div className="w-full bg-card border border-border p-4 rounded-xl flex items-center gap-4">
                    <div className="h-10 w-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Cours</p>
                        <p className="font-bold text-sm">{homework.subjectName}</p>
                    </div>
                </div>

                <div className="w-full space-y-3 pt-8">
                    <Button className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-xl" onClick={() => router.push('/student')}>
                        Retour à l'accueil
                    </Button>
                    <Button variant="outline" className="w-full h-12 rounded-xl border-white/10" onClick={() => router.push('/student/homework')}>
                        Voir mes devoirs
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-md mx-auto h-[100dvh] flex flex-col relative bg-background">
            {/* Header */}
            <div className="flex items-center justify-between p-4 z-10">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full hover:bg-white/10">
                    <ChevronLeft className="w-6 h-6" />
                </Button>
                <span className="font-medium text-sm text-muted-foreground">Devoir: {homework.subjectName}</span>
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/10">
                    <MoreHorizontal className="w-6 h-6" />
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-32">
                {/* Title Section */}
                <div>
                    <span className="inline-block px-3 py-1 rounded-full bg-purple-500/10 text-purple-500 text-xs font-bold mb-4 border border-purple-500/20">
                        {homework.subjectName}
                    </span>
                    <h1 className="text-3xl font-bold leading-tight mb-6">
                        {homework.title}
                    </h1>

                    <div className="grid grid-cols-1 gap-3 mb-8">
                        <div className="bg-card/50 border border-white/5 p-4 rounded-2xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                                    <Clock className="w-5 h-5 text-purple-500" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">ÉCHÉANCE</p>
                                    <p className="font-bold text-sm">{formatDue(homework.dueDate)}</p>
                                </div>
                            </div>
                            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                        </div>
                        <div className="bg-card/50 border border-white/5 p-4 rounded-2xl flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                                <FileText className="w-5 h-5 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold">NOTE MAX</p>
                                <p className="font-bold text-sm">{homework.maxPoints ?? 20} Points</p>
                            </div>
                        </div>
                    </div>

                    {/* Instructions */}
                    {(homework.instructions || homework.description) && (
                        <div className="space-y-3 mb-8">
                            <h3 className="font-bold text-lg">Instructions</h3>
                            <p className="text-sm text-gray-400 leading-relaxed bg-card/30 p-4 rounded-2xl border border-white/5">
                                {homework.instructions || homework.description}
                            </p>
                        </div>
                    )}

                    {/* Resources */}
                    {homework.attachmentUrls && homework.attachmentUrls.length > 0 && (
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-bold text-lg">Ressources jointes</h3>
                                <span className="text-xs text-purple-500 font-medium">{homework.attachmentUrls.length} fichier(s)</span>
                            </div>
                            {homework.attachmentUrls.map((url, idx) => (
                                <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="bg-card border border-white/5 p-3 rounded-xl flex items-center gap-3 hover:bg-white/5 transition-colors cursor-pointer group mb-2">
                                    <div className="h-10 w-10 bg-red-500/10 rounded-lg flex items-center justify-center text-red-500">
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium group-hover:underline">Ressource {idx + 1}</p>
                                        <p className="text-xs text-muted-foreground">Télécharger</p>
                                    </div>
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Action */}
            <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/90 to-transparent z-20">
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                    <SheetTrigger asChild>
                        <Button className="w-full h-14 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-2xl shadow-lg shadow-purple-600/20 text-base">
                            <Upload className="mr-2 w-5 h-5" /> Soumettre mon travail
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="h-[90vh] rounded-t-[2rem] border-white/10 bg-[#0D1117] p-0">
                        <div className="p-6 h-full flex flex-col">
                            {/* Sheet Header */}
                            <div className="flex justify-between items-center mb-6">
                                <Button variant="ghost" size="icon" className="-ml-2" onClick={() => setSheetOpen(false)}>
                                    <ChevronLeft className="w-6 h-6" />
                                </Button>
                                <SheetTitle className="font-bold text-lg">Soumettre le devoir</SheetTitle>
                                <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="w-5 h-5" />
                                </Button>
                            </div>

                            {/* File Upload Component */}
                            <FileUpload
                                bucket="homework-submissions"
                                folder={homework.id}
                                maxFiles={5}
                                onUploadComplete={handleUploadComplete}
                            />

                            {/* Comment Input */}
                            <div className="mt-6 flex-1 overflow-y-auto">
                                <h3 className="font-bold text-base mb-3">Ajouter un commentaire</h3>
                                <textarea
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm min-h-[100px] focus:outline-none focus:border-purple-500/50 transition-colors resize-none placeholder:text-muted-foreground/50"
                                    placeholder="Écrivez un message pour l'enseignant ici..."
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                />
                            </div>

                            {/* Upload Status */}
                            {uploadedFiles.length > 0 && (
                                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 mt-4">
                                    <p className="text-sm text-green-400">
                                        ✓ {uploadedFiles.length} fichier(s) prêt(s) à soumettre
                                    </p>
                                </div>
                            )}

                            {/* Submit Button */}
                            <div className="pt-4 mt-4">
                                <Button
                                    className="w-full h-14 bg-cyan-500 hover:bg-cyan-600 text-black font-bold rounded-2xl shadow-lg shadow-cyan-500/20 text-base"
                                    onClick={handleSubmit}
                                    disabled={isPending}
                                >
                                    {isPending ? (
                                        <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Envoi en cours...</>
                                    ) : (
                                        <><Upload className="mr-2 w-5 h-5" /> Envoyer le devoir</>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
        </div>
    )
}
