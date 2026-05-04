'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, Clock, CheckCircle, XCircle, RotateCcw } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

interface QuestionOption {
    id: string
    text: string
    isCorrect: boolean
}

interface Question {
    question: string
    options: QuestionOption[]
}

interface Quiz {
    id: string
    title: string
    description: string | null
    questions: Question[]
    time_limit_minutes: number
    class_name?: string
    subject_name?: string
}

export default function QuizPreviewPage() {
    const params = useParams()
    const router = useRouter()
    const quizId = params.quizId as string

    const [quiz, setQuiz] = useState<Quiz | null>(null)
    const [loading, setLoading] = useState(true)
    const [currentQuestion, setCurrentQuestion] = useState(0)
    const [selectedAnswers, setSelectedAnswers] = useState<(number | null)[]>([])
    const [showResults, setShowResults] = useState(false)
    const [timeLeft, setTimeLeft] = useState(0)
    const [isStarted, setIsStarted] = useState(false)

    useEffect(() => {
        loadQuiz()
    }, [quizId])

    useEffect(() => {
        if (isStarted && timeLeft > 0 && !showResults) {
            const timer = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        handleSubmit()
                        return 0
                    }
                    return prev - 1
                })
            }, 1000)
            return () => clearInterval(timer)
        }
    }, [isStarted, timeLeft, showResults])

    const loadQuiz = async () => {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('quizzes')
            .select(`
                *,
                classes (name),
                subjects (name)
            `)
            .eq('id', quizId)
            .single()

        if (error || !data) {
            toast.error('Quiz non trouvé')
            router.push('/teacher/quizzes')
            return
        }

        const formattedQuiz: Quiz = {
            id: data.id,
            title: data.title,
            description: data.description,
            questions: Array.isArray(data.questions) ? (data.questions as unknown as Question[]) : [],
            time_limit_minutes: data.time_limit_minutes || 10,
            class_name: (data.classes as any)?.name || 'Non assigné',
            subject_name: (data.subjects as any)?.name || 'Général'
        }

        setQuiz(formattedQuiz)
        setSelectedAnswers(new Array(formattedQuiz.questions.length).fill(null))
        setTimeLeft((formattedQuiz.time_limit_minutes || 10) * 60)
        setLoading(false)
    }

    const startQuiz = () => {
        setIsStarted(true)
    }

    const selectAnswer = (optionIndex: number) => {
        if (showResults) return
        const newAnswers = [...selectedAnswers]
        newAnswers[currentQuestion] = optionIndex
        setSelectedAnswers(newAnswers)
    }

    const nextQuestion = () => {
        if (currentQuestion < (quiz?.questions.length || 0) - 1) {
            setCurrentQuestion(prev => prev + 1)
        }
    }

    const prevQuestion = () => {
        if (currentQuestion > 0) {
            setCurrentQuestion(prev => prev - 1)
        }
    }

    const handleSubmit = () => {
        setShowResults(true)
    }

    const resetQuiz = () => {
        setCurrentQuestion(0)
        setSelectedAnswers(new Array(quiz?.questions.length || 0).fill(null))
        setShowResults(false)
        setIsStarted(false)
        setTimeLeft((quiz?.time_limit_minutes || 10) * 60)
    }

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const calculateScore = () => {
        if (!quiz) return { correct: 0, total: 0, percentage: 0 }
        let correct = 0
        quiz.questions.forEach((q, i) => {
            const selectedIndex = selectedAnswers[i]
            if (selectedIndex !== null && q.options[selectedIndex]?.isCorrect) correct++
        })
        return {
            correct,
            total: quiz.questions.length,
            percentage: quiz.questions.length > 0 ? Math.round((correct / quiz.questions.length) * 100) : 0
        }
    }

    if (loading) {
        return (
            <div className="max-w-3xl mx-auto p-8">
                <div className="text-center text-muted-foreground">Chargement du quiz...</div>
            </div>
        )
    }

    if (!quiz) return null

    // Check if quiz has no questions
    if (quiz.questions.length === 0) {
        return (
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="flex items-center gap-4">
                    <Link href="/teacher/quizzes">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div>
                        <Badge variant="outline" className="mb-2">Mode Prévisualisation</Badge>
                        <h1 className="text-2xl font-bold">{quiz.title}</h1>
                    </div>
                </div>
                <Card className="border-destructive/20">
                    <CardContent className="p-8 text-center space-y-4">
                        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                            <XCircle className="w-8 h-8 text-destructive" />
                        </div>
                        <h2 className="text-xl font-semibold">Aucune question</h2>
                        <p className="text-muted-foreground">
                            Ce quiz ne contient pas encore de questions. Veuillez ajouter des questions avant de le prévisualiser.
                        </p>
                        <Link href={`/teacher/quizzes/${quiz.id}/edit`}>
                            <Button>Ajouter des questions</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const question = quiz.questions[currentQuestion]
    if (!question) {
        setCurrentQuestion(0)
        return null
    }
    const score = calculateScore()

    // Start screen
    if (!isStarted) {
        return (
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="flex items-center gap-4">
                    <Link href="/teacher/quizzes">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div>
                        <Badge variant="outline" className="mb-2">Mode Prévisualisation</Badge>
                        <h1 className="text-2xl font-bold">{quiz.title}</h1>
                    </div>
                </div>

                <Card className="border-primary/20">
                    <CardContent className="p-8 text-center space-y-6">
                        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                            <Clock className="w-10 h-10 text-primary" />
                        </div>

                        <div>
                            <h2 className="text-xl font-semibold mb-2">Prêt à tester votre quiz ?</h2>
                            <p className="text-muted-foreground">
                                Ce mode vous permet de tester le quiz comme le verront vos élèves.
                                Aucune soumission ne sera enregistrée.
                            </p>
                        </div>

                        <div className="flex justify-center gap-6 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                {quiz.time_limit_minutes} minutes
                            </div>
                            <div>
                                {quiz.questions.length} questions
                            </div>
                        </div>

                        <Button size="lg" onClick={startQuiz} className="w-full max-w-xs">
                            Commencer le test
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Results screen
    if (showResults) {
        return (
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="flex items-center gap-4">
                    <Link href="/teacher/quizzes">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div>
                        <Badge variant="outline" className="mb-2">Résultats du test</Badge>
                        <h1 className="text-2xl font-bold">{quiz.title}</h1>
                    </div>
                </div>

                <Card>
                    <CardContent className="p-8">
                        <div className="text-center space-y-4 mb-8">
                            <div className={cn(
                                "w-24 h-24 rounded-full flex items-center justify-center mx-auto text-3xl font-bold",
                                score.percentage >= 70 ? "bg-emerald-500/20 text-emerald-500" :
                                    score.percentage >= 50 ? "bg-amber-500/20 text-amber-500" :
                                        "bg-red-500/20 text-red-500"
                            )}>
                                {score.percentage}%
                            </div>
                            <div>
                                <p className="text-lg font-medium">
                                    {score.correct} / {score.total} réponses correctes
                                </p>
                                <p className="text-muted-foreground text-sm">
                                    {score.percentage >= 70 ? 'Excellent résultat !' :
                                        score.percentage >= 50 ? 'Bon effort !' :
                                            'Il y a des points à améliorer'}
                                </p>
                            </div>
                        </div>

                        {/* Review answers */}
                        <div className="space-y-4">
                            <h3 className="font-semibold">Récapitulatif des réponses</h3>
                            {quiz.questions.map((q, i) => {
                                const selectedIndex = selectedAnswers[i]
                                const selectedOption = selectedIndex !== null ? q.options[selectedIndex] : null
                                const correctOption = q.options.find(o => o.isCorrect)
                                const isCorrect = selectedOption?.isCorrect === true
                                return (
                                    <div key={i} className="p-4 rounded-lg border bg-card">
                                        <div className="flex items-start gap-3">
                                            {isCorrect ? (
                                                <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5" />
                                            ) : (
                                                <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                                            )}
                                            <div className="flex-1">
                                                <p className="font-medium text-sm mb-2">Q{i + 1}: {q.question}</p>
                                                <div className="text-xs space-y-1">
                                                    {selectedOption && !isCorrect && (
                                                        <p className="text-red-400">
                                                            Votre réponse: {selectedOption.text}
                                                        </p>
                                                    )}
                                                    <p className="text-emerald-400">
                                                        Bonne réponse: {correctOption?.text || 'N/A'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        <div className="flex gap-4 mt-8">
                            <Button variant="outline" onClick={resetQuiz} className="flex-1 gap-2">
                                <RotateCcw className="w-4 h-4" />
                                Recommencer
                            </Button>
                            <Link href="/teacher/quizzes" className="flex-1">
                                <Button className="w-full">Retour aux quiz</Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Quiz in progress
    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Badge variant="outline">Mode Test</Badge>
                    <span className="text-sm text-muted-foreground">{quiz.title}</span>
                </div>
                <div className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
                    timeLeft < 60 ? "bg-red-500/20 text-red-500" : "bg-primary/10 text-primary"
                )}>
                    <Clock className="w-4 h-4" />
                    {formatTime(timeLeft)}
                </div>
            </div>

            {/* Progress */}
            <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Question {currentQuestion + 1} sur {quiz.questions.length}</span>
                    <span>{Math.round(((currentQuestion + 1) / quiz.questions.length) * 100)}%</span>
                </div>
                <Progress value={((currentQuestion + 1) / quiz.questions.length) * 100} />
            </div>

            {/* Question Card */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentQuestion}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                >
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">{question.question}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {question.options.map((option, index) => (
                                <button
                                    key={index}
                                    onClick={() => selectAnswer(index)}
                                    className={cn(
                                        "w-full text-left p-4 rounded-lg border transition-all",
                                        selectedAnswers[currentQuestion] === index
                                            ? "border-primary bg-primary/10"
                                            : "border-border hover:border-primary/50 hover:bg-muted/50"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold",
                                            selectedAnswers[currentQuestion] === index
                                                ? "border-primary bg-primary text-primary-foreground"
                                                : "border-muted-foreground/30"
                                        )}>
                                            {String.fromCharCode(65 + index)}
                                        </div>
                                        <span className="text-sm">{option.text}</span>
                                    </div>
                                </button>
                            ))}
                        </CardContent>
                    </Card>
                </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex justify-between">
                <Button
                    variant="outline"
                    onClick={prevQuestion}
                    disabled={currentQuestion === 0}
                >
                    Précédent
                </Button>

                {currentQuestion === quiz.questions.length - 1 ? (
                    <Button onClick={handleSubmit}>
                        Terminer le test
                    </Button>
                ) : (
                    <Button onClick={nextQuestion}>
                        Suivant
                    </Button>
                )}
            </div>

            {/* Question dots */}
            <div className="flex justify-center gap-2 flex-wrap">
                {quiz.questions.map((_, i) => (
                    <button
                        key={i}
                        onClick={() => setCurrentQuestion(i)}
                        className={cn(
                            "w-8 h-8 rounded-full text-xs font-medium transition-all",
                            i === currentQuestion
                                ? "bg-primary text-primary-foreground"
                                : selectedAnswers[i] !== null
                                    ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30"
                                    : "bg-muted hover:bg-muted-foreground/20"
                        )}
                    >
                        {i + 1}
                    </button>
                ))}
            </div>
        </div>
    )
}
