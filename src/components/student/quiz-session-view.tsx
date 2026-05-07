'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Flame, Trophy, Zap, CheckCircle2, XCircle, Loader2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'

interface QuizQuestion {
    id: string
    question: string
    type: 'text-choice' | 'image-choice'
    options: {
        id: string
        text: string
        image?: string
        isCorrect: boolean
    }[]
}

interface Props {
    quizId: string
    quizTitle: string
    questions: QuizQuestion[]
    timeLimit: number | null
    subjectName: string
    userName: string
    userAvatar: string | null
}

export function QuizSessionView({
    quizId,
    quizTitle,
    questions,
    timeLimit,
    subjectName,
    userName,
    userAvatar
}: Props) {
    const router = useRouter()
    const supabase = createClient()
    const [isPending, startTransition] = useTransition()

    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
    const [selectedOption, setSelectedOption] = useState<string | null>(null)
    const [isAnswered, setIsAnswered] = useState(false)
    const [score, setScore] = useState(0)
    const [combo, setCombo] = useState(1)
    const [sessionXp, setSessionXp] = useState(0)
    const [answers, setAnswers] = useState<{ questionId: string, selectedId: string, correct: boolean }[]>([])
    const [timeRemaining, setTimeRemaining] = useState(timeLimit ? timeLimit * 60 : null)
    const [isCompleted, setIsCompleted] = useState(false)

    const currentQuestion = questions[currentQuestionIndex]

    // Timer
    useEffect(() => {
        if (!timeRemaining || isCompleted) return

        const timer = setInterval(() => {
            setTimeRemaining(prev => {
                if (prev === null || prev <= 1) {
                    clearInterval(timer)
                    handleFinish()
                    return 0
                }
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(timer)
    }, [timeRemaining, isCompleted])

    const formatTime = (seconds: number | null) => {
        if (seconds === null) return '--:--'
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    const handleOptionSelect = (optionId: string) => {
        if (isAnswered) return
        setSelectedOption(optionId)
    }

    const handleContinue = () => {
        if (!isAnswered && selectedOption) {
            // Check answer
            const selectedOpt = currentQuestion.options.find(o => o.id === selectedOption)
            const isCorrect = selectedOpt?.isCorrect ?? false
            setIsAnswered(true)

            // Save answer
            setAnswers(prev => [...prev, {
                questionId: currentQuestion.id,
                selectedId: selectedOption,
                correct: isCorrect
            }])

            if (isCorrect) {
                setCombo(prev => prev + 1)
                const xpGain = 10 * combo
                setSessionXp(prev => prev + xpGain)
                setScore(prev => prev + 1)
            } else {
                setCombo(1)
            }
        } else if (isAnswered) {
            // Next question or finish
            if (currentQuestionIndex < questions.length - 1) {
                setCurrentQuestionIndex(prev => prev + 1)
                setSelectedOption(null)
                setIsAnswered(false)
            } else {
                handleFinish()
            }
        }
    }

    const handleFinish = async () => {
        setIsCompleted(true)

        startTransition(async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) throw new Error('Not authenticated')

                const finalScore = answers.filter(a => a.correct).length + (isAnswered && currentQuestion.options.find(o => o.id === selectedOption)?.isCorrect ? 1 : 0)

                const { error } = await supabase.from('quiz_submissions').insert({
                    quiz_id: quizId,
                    student_id: user.id,
                    score: finalScore,
                    max_score: questions.length,
                    answers: answers,
                    time_taken_seconds: timeLimit ? (timeLimit * 60) - (timeRemaining ?? 0) : null
                })

                if (error) throw error

                toast.success('Quiz soumis avec succès!')
            } catch (error) {
                console.error('Error submitting quiz:', error)
                toast.error('Erreur lors de la soumission')
            }
        })
    }

    if (!currentQuestion && !isCompleted) {
        return (
            <div className="min-h-screen bg-[#080C14] flex items-center justify-center text-white">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-2">Aucune question</h1>
                    <p className="text-gray-400">Ce quiz ne contient pas de questions.</p>
                </div>
            </div>
        )
    }

    // Results screen
    if (isCompleted) {
        const finalScore = answers.filter(a => a.correct).length
        const percentage = Math.round((finalScore / questions.length) * 100)

        return (
            <div className="min-h-screen bg-[#080C14] flex items-center justify-center text-white p-4">
                <div className="text-center max-w-md mx-auto">
                    <div className="text-7xl mb-6">
                        {percentage >= 80 ? '🏆' : percentage >= 50 ? '🎉' : '📚'}
                    </div>
                    <h1 className="text-3xl font-black mb-2">Quiz Terminé!</h1>
                    <p className="text-gray-400 mb-8">{quizTitle}</p>

                    <div className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 rounded-3xl p-8 mb-8">
                        <p className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                            {finalScore}/{questions.length}
                        </p>
                        <p className="text-lg text-gray-400 mt-2">{percentage}% de réussite</p>

                        <div className="flex justify-center gap-6 mt-6">
                            <div className="text-center">
                                <div className="flex items-center justify-center gap-1 text-cyan-400">
                                    <Zap className="w-5 h-5" />
                                    <span className="text-2xl font-bold">+{sessionXp}</span>
                                </div>
                                <p className="text-xs text-gray-500">XP Gagnés</p>
                            </div>
                            <div className="text-center">
                                <div className="flex items-center justify-center gap-1 text-orange-400">
                                    <Flame className="w-5 h-5" />
                                    <span className="text-2xl font-bold">x{combo}</span>
                                </div>
                                <p className="text-xs text-gray-500">Combo Max</p>
                            </div>
                        </div>
                    </div>

                    <Button
                        onClick={() => router.push('/student/quiz')}
                        className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold h-12 rounded-2xl"
                    >
                        <ArrowLeft className="w-5 h-5 mr-2" />
                        Retour aux Quiz
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-md mx-auto h-[100dvh] flex flex-col bg-[#080C14] relative p-4">

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <Avatar className="h-10 w-10 border-2 border-cyan-500 p-0.5">
                    <AvatarImage src={userAvatar ?? ''} className="rounded-full" />
                    <AvatarFallback>{userName[0]}</AvatarFallback>
                </Avatar>

                <div className="flex-1 mx-4">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1">
                        <span className="text-gray-400">{subjectName}</span>
                        <span className="text-cyan-500">{score}/{questions.length}</span>
                    </div>
                    <Progress value={(score / questions.length) * 100} className="h-2 bg-[#1A2530]" indicatorClassName="bg-cyan-500" />
                </div>

                <div className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center border border-white/5",
                    timeRemaining !== null && timeRemaining < 60 ? "bg-red-500/20 border-red-500/30" : "bg-[#1A2530]"
                )}>
                    <span className={cn(
                        "text-xs font-bold",
                        timeRemaining !== null && timeRemaining < 60 ? "text-red-400" : "text-gray-400"
                    )}>
                        {formatTime(timeRemaining)}
                    </span>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-[#1A2530]/50 border border-white/5 rounded-2xl p-3 flex items-center gap-3 relative overflow-hidden">
                    <div className="absolute inset-0 bg-cyan-500/5" />
                    <div className="h-10 w-10 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                        <Zap className="w-5 h-5 fill-current" />
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Combo</p>
                        <p className="text-xl font-black text-white italic">x{combo}</p>
                    </div>
                </div>

                <div className="bg-[#1A2530]/50 border border-white/5 rounded-2xl p-3 flex items-center gap-3 relative overflow-hidden">
                    <div className="absolute inset-0 bg-emerald-500/5" />
                    <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <Trophy className="w-5 h-5 fill-current" />
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Session XP</p>
                        <p className="text-xl font-black text-white">+{sessionXp}</p>
                    </div>
                </div>
            </div>

            {/* Question */}
            <div className="flex-1 flex flex-col justify-center">
                <div className="text-center mb-2">
                    <span className="px-3 py-1 bg-cyan-950/50 text-cyan-400 text-[10px] font-bold rounded-full border border-cyan-500/20 uppercase tracking-wider">
                        Question {currentQuestionIndex + 1}/{questions.length}
                    </span>
                </div>

                <h2 className="text-2xl font-bold text-center text-white mb-8 leading-tight">
                    {currentQuestion.question}
                </h2>

                {/* Options Grid */}
                <div className={cn("grid gap-4", currentQuestion.type === 'image-choice' ? "grid-cols-2" : "grid-cols-1")}>
                    {currentQuestion.options.map((option, idx) => {
                        const isSelected = selectedOption === option.id
                        const showCorrect = isAnswered && option.isCorrect
                        const showWrong = isAnswered && isSelected && !option.isCorrect

                        return (
                            <button
                                key={option.id ? `${option.id}-${idx}` : idx}
                                onClick={() => handleOptionSelect(option.id)}
                                disabled={isAnswered}
                                className={cn(
                                    "relative rounded-3xl overflow-hidden transition-all duration-200 border-2",
                                    currentQuestion.type === 'image-choice' ? "aspect-square" : "p-4 text-left flex items-center",
                                    isSelected ? "border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.3)] ring-1 ring-cyan-500" : "border-transparent bg-[#1A2530] hover:bg-[#1A2530]/80",
                                    showCorrect && "border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] ring-1 ring-emerald-500",
                                    showWrong && "border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] ring-1 ring-red-500"
                                )}
                            >
                                {currentQuestion.type === 'image-choice' && option.image && (
                                    <>
                                        <img src={option.image} alt={option.text} className="absolute inset-0 w-full h-full object-cover" />
                                        <div className={cn("absolute inset-0 transition-colors", isSelected ? "bg-cyan-500/20" : "bg-black/20")} />
                                        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 to-transparent">
                                            <p className="text-sm font-bold text-white text-center">{option.text}</p>
                                        </div>
                                    </>
                                )}

                                {currentQuestion.type === 'text-choice' && (
                                    <span className="font-bold text-white flex-1">{option.text}</span>
                                )}

                                {isSelected && !isAnswered && (
                                    <div className="absolute top-3 right-3 h-6 w-6 rounded-full bg-cyan-500 flex items-center justify-center shadow-lg">
                                        <CheckCircle2 className="w-4 h-4 text-black" />
                                    </div>
                                )}
                                {showCorrect && (
                                    <div className="absolute top-3 right-3 h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg z-10">
                                        <CheckCircle2 className="w-4 h-4 text-white" />
                                    </div>
                                )}
                                {showWrong && (
                                    <div className="absolute top-3 right-3 h-6 w-6 rounded-full bg-red-500 flex items-center justify-center shadow-lg z-10">
                                        <XCircle className="w-4 h-4 text-white" />
                                    </div>
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Footer */}
            <div className="mt-8">
                {/* Progress Dots */}
                <div className="flex gap-2 mb-4 justify-center flex-wrap">
                    {questions.map((_, idx) => (
                        <div
                            key={idx}
                            className={cn(
                                "h-2 w-2 rounded-full transition-colors",
                                idx === currentQuestionIndex ? "bg-cyan-500 scale-125" :
                                    idx < currentQuestionIndex ? "bg-cyan-500/50" : "bg-[#1A2530]"
                            )}
                        />
                    ))}
                </div>

                <div className="flex justify-between items-center mb-4 px-2">
                    <span className="text-[10px] text-gray-500 font-bold uppercase">Question {currentQuestionIndex + 1} sur {questions.length}</span>
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] text-orange-500 font-bold uppercase">Score: {score}</span>
                        <Trophy className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
                    </div>
                </div>

                <Button
                    className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold h-12 rounded-2xl text-lg shadow-[0_0_20px_rgba(6,182,212,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={(!selectedOption && !isAnswered) || isPending}
                    onClick={handleContinue}
                >
                    {isPending ? (
                        <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Soumission...</>
                    ) : isAnswered ? (
                        currentQuestionIndex < questions.length - 1 ? "Continuer" : "Terminer"
                    ) : "Valider"}
                    {!isPending && <ArrowRight className="ml-2 w-5 h-5" />}
                </Button>
            </div>
        </div>
    )
}
