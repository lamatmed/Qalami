'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Plus,
    BrainCircuit,
    Clock,
    Users,
    MoreVertical,
    Edit,
    Trash2,
    Eye,
    EyeOff,
    FileQuestion,
    Play,
    Trophy
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

interface Quiz {
    id: string
    title: string
    description: string | null
    questions: any[]
    time_limit_minutes: number
    max_attempts: number
    is_published: boolean
    created_at: string
    class_id: string
    subject_id: string | null
    class_name?: string
    subject_name?: string
    submission_count?: number
}

export default function TeacherQuizzesPage() {
    const [quizzes, setQuizzes] = useState<Quiz[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadQuizzes()
    }, [])

    const loadQuizzes = async () => {
        setLoading(true)
        const supabase = createClient()

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Get quizzes created by this teacher
            const { data, error } = await supabase
                .from('quizzes')
                .select(`
                    *,
                    classes (name),
                    subjects (name)
                `)
                .eq('teacher_id', user.id)
                .order('created_at', { ascending: false })

            if (error) throw error

            // Get submission counts
            const quizIds = (data || []).map(q => q.id)
            const { data: submissions } = await supabase
                .from('quiz_submissions')
                .select('quiz_id')
                .in('quiz_id', quizIds)

            const submissionCounts = new Map<string, number>()
            submissions?.forEach(s => {
                submissionCounts.set(s.quiz_id, (submissionCounts.get(s.quiz_id) || 0) + 1)
            })

            const formattedQuizzes = (data || []).map(quiz => ({
                ...quiz,
                class_name: (quiz.classes as any)?.name || 'Non assigné',
                subject_name: (quiz.subjects as any)?.name || 'Général',
                submission_count: submissionCounts.get(quiz.id) || 0
            }))

            setQuizzes(formattedQuizzes)
        } catch (error) {
            console.error('Error loading quizzes:', error)
            toast.error('Erreur lors du chargement des quiz')
        }

        setLoading(false)
    }

    const togglePublish = async (quizId: string, currentState: boolean) => {
        const supabase = createClient()

        const { error } = await supabase
            .from('quizzes')
            .update({ is_published: !currentState })
            .eq('id', quizId)

        if (error) {
            toast.error('Erreur lors de la mise à jour')
            return
        }

        toast.success(currentState ? 'Quiz dépublié' : 'Quiz publié')
        loadQuizzes()
    }

    const deleteQuiz = async (quizId: string) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce quiz ?')) return

        const supabase = createClient()

        const { error } = await supabase
            .from('quizzes')
            .delete()
            .eq('id', quizId)

        if (error) {
            toast.error('Erreur lors de la suppression')
            return
        }

        toast.success('Quiz supprimé')
        loadQuizzes()
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-10 w-40" />
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map(i => (
                        <Skeleton key={i} className="h-48 rounded-xl" />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Mes Quiz</h1>
                    <p className="text-muted-foreground text-sm">{quizzes.length} quiz créé{quizzes.length !== 1 ? 's' : ''}</p>
                </div>
                <Link href="/teacher/quizzes/new">
                    <Button className="gap-2">
                        <Plus className="w-4 h-4" />
                        Créer un Quiz
                    </Button>
                </Link>
            </div>

            {/* Quiz List */}
            {quizzes.length === 0 ? (
                <Card className="p-12 text-center">
                    <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <BrainCircuit className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">Aucun quiz créé</h3>
                    <p className="text-muted-foreground mb-6">
                        Créez votre premier quiz pour vos élèves !
                    </p>
                    <Link href="/teacher/quizzes/new">
                        <Button>
                            <Plus className="w-4 h-4 mr-2" />
                            Créer un Quiz
                        </Button>
                    </Link>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {quizzes.map(quiz => (
                        <Card key={quiz.id} className="group hover:border-primary/50 transition-all">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge variant={quiz.is_published ? "default" : "secondary"}>
                                                {quiz.is_published ? 'Publié' : 'Brouillon'}
                                            </Badge>
                                            <Badge variant="outline">{quiz.subject_name}</Badge>
                                        </div>
                                        <CardTitle className="text-lg line-clamp-1">{quiz.title}</CardTitle>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreVertical className="w-4 h-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <Link href={`/teacher/quizzes/${quiz.id}/preview`}>
                                                <DropdownMenuItem>
                                                    <Play className="w-4 h-4 mr-2" />
                                                    Prévisualiser
                                                </DropdownMenuItem>
                                            </Link>
                                            <Link href={`/teacher/quizzes/${quiz.id}/results`}>
                                                <DropdownMenuItem>
                                                    <Trophy className="w-4 h-4 mr-2" />
                                                    Voir les résultats
                                                </DropdownMenuItem>
                                            </Link>
                                            <Link href={`/teacher/quizzes/${quiz.id}/edit`}>
                                                <DropdownMenuItem>
                                                    <Edit className="w-4 h-4 mr-2" />
                                                    Modifier
                                                </DropdownMenuItem>
                                            </Link>
                                            <DropdownMenuItem onClick={() => togglePublish(quiz.id, quiz.is_published)}>
                                                {quiz.is_published ? (
                                                    <>
                                                        <EyeOff className="w-4 h-4 mr-2" />
                                                        Dépublier
                                                    </>
                                                ) : (
                                                    <>
                                                        <Eye className="w-4 h-4 mr-2" />
                                                        Publier
                                                    </>
                                                )}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => deleteQuiz(quiz.id)}
                                                className="text-red-500 focus:text-red-500"
                                            >
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Supprimer
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                                    {quiz.description || 'Pas de description'}
                                </p>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <FileQuestion className="w-3.5 h-3.5" />
                                        {Array.isArray(quiz.questions) ? quiz.questions.length : 0} questions
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5" />
                                        {quiz.time_limit_minutes} min
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Users className="w-3.5 h-3.5" />
                                        {quiz.submission_count} réponses
                                    </span>
                                </div>
                                <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                                    Classe: {quiz.class_name}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
