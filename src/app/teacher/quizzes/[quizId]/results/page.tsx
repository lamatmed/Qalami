'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Eye, Edit } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'
import Link from 'next/link'
import { QuizLeaderboard } from '@/components/teacher/quiz-leaderboard'

interface Quiz {
    id: string
    title: string
    description: string | null
    questions: any[]
    time_limit_minutes: number
    max_attempts: number
    is_published: boolean
    class_name?: string
    subject_name?: string
}

interface Submission {
    id: string
    student_id: string
    student_name: string
    student_avatar: string | null
    score: number
    total_questions: number
    percentage: number
    submitted_at: string
}

export default function QuizResultsPage() {
    const params = useParams()
    const router = useRouter()
    const quizId = params.quizId as string

    const [quiz, setQuiz] = useState<Quiz | null>(null)
    const [submissions, setSubmissions] = useState<Submission[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadData()
    }, [quizId])

    const loadData = async () => {
        const supabase = createClient()

        // Load quiz details
        const { data: quizData, error: quizError } = await supabase
            .from('quizzes')
            .select(`
                *,
                classes (name),
                subjects (name)
            `)
            .eq('id', quizId)
            .single()

        if (quizError || !quizData) {
            toast.error('Quiz non trouvé')
            router.push('/teacher/quizzes')
            return
        }

        const formattedQuiz: Quiz = {
            id: quizData.id,
            title: quizData.title,
            description: quizData.description,
            questions: Array.isArray(quizData.questions) ? quizData.questions : [],
            time_limit_minutes: quizData.time_limit_minutes || 10,
            max_attempts: quizData.max_attempts || 1,
            is_published: quizData.is_published || false,
            class_name: (quizData.classes as any)?.name || 'Non assigné',
            subject_name: (quizData.subjects as any)?.name || 'Général'
        }

        setQuiz(formattedQuiz)

        // Load submissions
        const { data: submissionData, error: subError } = await supabase
            .from('quiz_submissions')
            .select('id, student_id, score, answers, submitted_at, created_at')
            .eq('quiz_id', quizId)
            .order('score', { ascending: false })

        if (subError) {
            console.error('Error loading submissions:', subError)
        }

        // Get unique student IDs and fetch their profiles
        const studentIds = [...new Set((submissionData || []).map(s => s.student_id))]
        const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('id', studentIds)

        const profileMap = new Map<string, { full_name: string | null; avatar_url: string | null }>()
        profilesData?.forEach(p => {
            profileMap.set(p.id, { full_name: p.full_name, avatar_url: p.avatar_url })
        })

        const formattedSubmissions: Submission[] = (submissionData || []).map(sub => {
            const profile = profileMap.get(sub.student_id)
            const totalQuestions = formattedQuiz.questions.length
            const score = sub.score || 0
            return {
                id: sub.id,
                student_id: sub.student_id,
                student_name: profile?.full_name || 'Étudiant',
                student_avatar: profile?.avatar_url || null,
                score: score,
                total_questions: totalQuestions,
                percentage: totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0,
                submitted_at: sub.submitted_at || sub.created_at || new Date().toISOString()
            }
        })

        setSubmissions(formattedSubmissions)
        setLoading(false)
    }

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto p-8">
                <div className="text-center text-muted-foreground">Chargement...</div>
            </div>
        )
    }

    if (!quiz) return null

    // Stats
    const totalSubmissions = submissions.length
    const avgScore = submissions.length > 0
        ? Math.round(submissions.reduce((acc, s) => acc + s.percentage, 0) / submissions.length)
        : 0
    const passRate = submissions.length > 0
        ? Math.round((submissions.filter(s => s.percentage >= 50).length / submissions.length) * 100)
        : 0

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/teacher/quizzes">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                </Link>
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <h1 className="text-2xl font-bold">{quiz.title}</h1>
                        <Badge variant={quiz.is_published ? "default" : "secondary"}>
                            {quiz.is_published ? "Publié" : "Brouillon"}
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {quiz.class_name} • {quiz.subject_name}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link href={`/teacher/quizzes/${quizId}/preview`}>
                        <Button variant="outline" size="sm" className="gap-2">
                            <Eye className="w-4 h-4" />
                            Prévisualiser
                        </Button>
                    </Link>
                    <Link href={`/teacher/quizzes/${quizId}/edit`}>
                        <Button variant="outline" size="sm" className="gap-2">
                            <Edit className="w-4 h-4" />
                            Modifier
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-primary">{quiz.questions.length}</div>
                        <div className="text-xs text-muted-foreground">Questions</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-cyan-500">{totalSubmissions}</div>
                        <div className="text-xs text-muted-foreground">Participations</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-amber-500">{avgScore}%</div>
                        <div className="text-xs text-muted-foreground">Score moyen</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-emerald-500">{passRate}%</div>
                        <div className="text-xs text-muted-foreground">Taux de réussite</div>
                    </CardContent>
                </Card>
            </div>

            {/* Leaderboard */}
            <QuizLeaderboard submissions={submissions} loading={loading} />
        </div>
    )
}
