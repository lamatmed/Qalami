'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Trophy, Medal, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

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

interface QuizLeaderboardProps {
    submissions: Submission[]
    loading?: boolean
}

export function QuizLeaderboard({ submissions, loading = false }: QuizLeaderboardProps) {
    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-amber-500" />
                        Classement
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center text-muted-foreground py-8">
                        Chargement du classement...
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (submissions.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-amber-500" />
                        Classement
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center text-muted-foreground py-8">
                        Aucune soumission pour ce quiz encore.
                    </div>
                </CardContent>
            </Card>
        )
    }

    // Sort by percentage descending
    const sorted = [...submissions].sort((a, b) => b.percentage - a.percentage)
    const topThree = sorted.slice(0, 3)
    const rest = sorted.slice(3)

    const getRankStyle = (rank: number) => {
        switch (rank) {
            case 1:
                return "border-amber-500 bg-amber-500/10"
            case 2:
                return "border-slate-400 bg-slate-400/10"
            case 3:
                return "border-orange-600 bg-orange-600/10"
            default:
                return "border-border"
        }
    }

    const getRankIcon = (rank: number) => {
        switch (rank) {
            case 1:
                return <Trophy className="w-5 h-5 text-amber-500 fill-amber-500" />
            case 2:
                return <Medal className="w-5 h-5 text-slate-400" />
            case 3:
                return <Medal className="w-5 h-5 text-orange-600" />
            default:
                return null
        }
    }

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr)
        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Africa/Nouakchott' })
            + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nouakchott' })
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-500" />
                    Classement ({submissions.length} participants)
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Podium for top 3 */}
                {topThree.length >= 3 && (
                    <div className="flex justify-center items-end gap-4 pb-4">
                        {/* 2nd place */}
                        <div className="flex flex-col items-center gap-2 w-24">
                            <Avatar className="h-14 w-14 border-2 border-slate-400">
                                <AvatarImage src={topThree[1].student_avatar || ''} />
                                <AvatarFallback>{topThree[1].student_name[0]}</AvatarFallback>
                            </Avatar>
                            <div className="text-center">
                                <p className="text-sm font-semibold truncate w-full">{topThree[1].student_name}</p>
                                <Badge variant="secondary" className="text-xs">
                                    {topThree[1].percentage}%
                                </Badge>
                            </div>
                            <div className="w-full h-16 bg-slate-400/20 rounded-t-lg flex items-center justify-center">
                                <span className="text-2xl font-bold text-slate-400">2</span>
                            </div>
                        </div>

                        {/* 1st place */}
                        <div className="flex flex-col items-center gap-2 w-28 -mt-4">
                            <div className="relative">
                                <Avatar className="h-18 w-18 border-2 border-amber-500">
                                    <AvatarImage src={topThree[0].student_avatar || ''} />
                                    <AvatarFallback>{topThree[0].student_name[0]}</AvatarFallback>
                                </Avatar>
                                <Trophy className="w-6 h-6 text-amber-500 fill-amber-500 absolute -top-2 -right-2" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-bold truncate w-full text-amber-500">{topThree[0].student_name}</p>
                                <Badge className="bg-amber-500 text-black text-xs">
                                    {topThree[0].percentage}%
                                </Badge>
                            </div>
                            <div className="w-full h-24 bg-amber-500/20 rounded-t-lg flex items-center justify-center">
                                <span className="text-3xl font-bold text-amber-500">1</span>
                            </div>
                        </div>

                        {/* 3rd place */}
                        <div className="flex flex-col items-center gap-2 w-24">
                            <Avatar className="h-14 w-14 border-2 border-orange-600">
                                <AvatarImage src={topThree[2].student_avatar || ''} />
                                <AvatarFallback>{topThree[2].student_name[0]}</AvatarFallback>
                            </Avatar>
                            <div className="text-center">
                                <p className="text-sm font-semibold truncate w-full">{topThree[2].student_name}</p>
                                <Badge variant="secondary" className="text-xs">
                                    {topThree[2].percentage}%
                                </Badge>
                            </div>
                            <div className="w-full h-12 bg-orange-600/20 rounded-t-lg flex items-center justify-center">
                                <span className="text-2xl font-bold text-orange-600">3</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* List for the rest */}
                <div className="space-y-2">
                    {(topThree.length < 3 ? sorted : rest).map((submission, index) => {
                        const rank = topThree.length < 3 ? index + 1 : index + 4
                        return (
                            <div
                                key={submission.id}
                                className={cn(
                                    "flex items-center gap-4 p-3 rounded-lg border",
                                    getRankStyle(rank)
                                )}
                            >
                                <div className="w-8 flex items-center justify-center">
                                    {getRankIcon(rank) || (
                                        <span className="text-sm font-bold text-muted-foreground">{rank}</span>
                                    )}
                                </div>

                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={submission.student_avatar || ''} />
                                    <AvatarFallback>{submission.student_name[0]}</AvatarFallback>
                                </Avatar>

                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{submission.student_name}</p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Clock className="w-3 h-3" />
                                        {formatDate(submission.submitted_at)}
                                    </div>
                                </div>

                                <div className="text-right">
                                    <div className={cn(
                                        "font-bold text-lg",
                                        submission.percentage >= 70 ? "text-emerald-500" :
                                            submission.percentage >= 50 ? "text-amber-500" :
                                                "text-red-500"
                                    )}>
                                        {submission.percentage}%
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {submission.score}/{submission.total_questions}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    )
}
