'use client'

import { Bell, Trophy, Zap, Clock, Play, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from '@/lib/utils'
import { Leaderboard } from '@/components/student/leaderboard'
import Link from 'next/link'

interface Quiz {
    id: string
    title: string
    description: string | null
    subject: string
    questionCount: number
    timeLimit: number
    completed: boolean
    score?: number
    maxScore?: number
}

interface Props {
    quizzes: Quiz[]
}

// Fallback images for quiz cards
const QUIZ_IMAGES = [
    'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600',
    'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=600',
    'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=600'
]

const SUBJECT_COLORS: Record<string, string> = {
    'Mathématiques': 'bg-cyan-500',
    'Physique-Chimie': 'bg-purple-500',
    'Français': 'bg-amber-500',
    'Arabe': 'bg-emerald-500',
    'Anglais': 'bg-indigo-500',
    'default': 'bg-gray-500'
}

export function StudentQuizView({ quizzes }: Props) {
    const availableQuizzes = quizzes.filter(q => !q.completed)
    const completedQuizzes = quizzes.filter(q => q.completed)

    return (
        <div className="max-w-md mx-auto lg:max-w-3xl pb-24 space-y-6 p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-border">
                        <AvatarImage src="https://github.com/shadcn.png" />
                        <AvatarFallback>AM</AvatarFallback>
                    </Avatar>
                    <span className="font-bold text-lg">Quiz Hub</span>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full">
                    <Bell className="w-5 h-5" />
                </Button>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="todo" className="w-full">
                <TabsList className="w-full bg-card/50 p-1 rounded-2xl grid grid-cols-3 mb-6">
                    <TabsTrigger value="todo" className="rounded-xl data-[state=active]:bg-cyan-500 data-[state=active]:text-black font-bold">
                        À faire
                        {availableQuizzes.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 bg-black/20 rounded-full text-[10px]">{availableQuizzes.length}</span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="done" className="rounded-xl data-[state=active]:bg-cyan-500 data-[state=active]:text-black font-bold">Terminés</TabsTrigger>
                    <TabsTrigger value="leaderboard" className="rounded-xl data-[state=active]:bg-cyan-500 data-[state=active]:text-black font-bold text-[10px] sm:text-sm">Classement</TabsTrigger>
                </TabsList>

                <TabsContent value="todo" className="space-y-6">
                    <div className="flex justify-between items-center px-1">
                        <h2 className="font-bold text-lg">Quizzes disponibles</h2>
                        {availableQuizzes.length > 0 && (
                            <span className="text-[10px] text-cyan-400 font-bold bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-500/30">
                                {availableQuizzes.length} Nouveau{availableQuizzes.length > 1 ? 'x' : ''}
                            </span>
                        )}
                    </div>

                    {availableQuizzes.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground">
                            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-30" />
                            <p className="font-medium">Aucun quiz disponible</p>
                            <p className="text-sm">Vos prochains quiz apparaîtront ici</p>
                        </div>
                    ) : (
                        availableQuizzes.map((quiz, idx) => {
                            const bgImage = QUIZ_IMAGES[idx % QUIZ_IMAGES.length]
                            const subjectColor = SUBJECT_COLORS[quiz.subject] ?? SUBJECT_COLORS.default

                            return (
                                <div key={quiz.id} className="relative aspect-[16/10] rounded-3xl overflow-hidden group cursor-pointer border border-white/5">
                                    <img src={bgImage} alt={quiz.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

                                    <div className="absolute top-4 left-4">
                                        <span className={cn("px-3 py-1 text-white text-[10px] font-bold rounded-full uppercase tracking-wider", subjectColor)}>
                                            {quiz.subject}
                                        </span>
                                    </div>

                                    <div className="absolute bottom-0 left-0 right-0 p-5">
                                        <h3 className="text-xl font-bold mb-2">{quiz.title}</h3>
                                        <div className="flex items-center gap-4 text-xs text-gray-300 mb-4">
                                            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {quiz.timeLimit} min</span>
                                            <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5" /> {quiz.questionCount} Questions</span>
                                        </div>
                                        <Link href={`/student/quiz/${quiz.id}`} className="block">
                                            <Button className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl h-10">
                                                <Play className="w-4 h-4 mr-2" />
                                                Commencer
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </TabsContent>

                <TabsContent value="done" className="space-y-4">
                    {completedQuizzes.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground">
                            <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-30" />
                            <p className="font-medium">Aucun quiz terminé</p>
                            <p className="text-sm">Complétez un quiz pour voir vos résultats</p>
                        </div>
                    ) : (
                        completedQuizzes.map((quiz) => (
                            <div key={quiz.id} className="bg-card border border-border/50 rounded-2xl p-4 flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-sm">{quiz.title}</h3>
                                    <p className="text-xs text-muted-foreground">{quiz.subject}</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-lg font-bold text-emerald-500">{quiz.score}/{quiz.maxScore}</span>
                                    <p className="text-[10px] text-muted-foreground">Score</p>
                                </div>
                            </div>
                        ))
                    )}
                </TabsContent>

                <TabsContent value="leaderboard" className="pt-2">
                    <Leaderboard isEmbedded />
                </TabsContent>
            </Tabs>
        </div>
    )
}
