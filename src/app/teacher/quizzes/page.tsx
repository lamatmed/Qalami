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
import { useLanguage } from '@/i18n'

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
    const { t, direction } = useLanguage()
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
                class_name: (quiz.classes as any)?.name || t('teacher.quizzes.unassigned'),
                subject_name: (quiz.subjects as any)?.name || t('teacher.quizzes.general'),
                submission_count: submissionCounts.get(quiz.id) || 0
            }))

            setQuizzes(formattedQuizzes)
        } catch (error) {
            console.error('Error loading quizzes:', error)
            toast.error(t('teacher.quizzes.errorLoading'))
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
            toast.error(t('teacher.quizzes.updateError'))
            return
        }

        toast.success(currentState ? t('teacher.quizzes.unpublishSuccess') : t('teacher.quizzes.publishSuccess'))
        loadQuizzes()
    }

    const deleteQuiz = async (quizId: string) => {
        if (!confirm(t('teacher.quizzes.deleteConfirm'))) return

        const supabase = createClient()

        const { error } = await supabase
            .from('quizzes')
            .delete()
            .eq('id', quizId)

        if (error) {
            toast.error(t('teacher.quizzes.deleteError'))
            return
        }

        toast.success(t('teacher.quizzes.deleteSuccess'))
        loadQuizzes()
    }

    if (loading) {
        return (
            <div className="space-y-6" dir={direction}>
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
        <div className="space-y-6" dir={direction}>
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">{t('teacher.quizzes.title')}</h1>
                    <p className="text-muted-foreground text-sm">
                        {t('teacher.quizzes.subtitle', { count: quizzes.length, plural: quizzes.length !== 1 ? 's' : '' })}
                    </p>
                </div>
                <Link href="/teacher/quizzes/new">
                    <Button className="gap-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-sm transition-all duration-300">
                        <Plus className="w-4 h-4" />
                        {t('teacher.quizzes.createBtn')}
                    </Button>
                </Link>
            </div>

            {/* Quiz List */}
            {quizzes.length === 0 ? (
                <Card className="p-12 text-center border border-gray-100 dark:border-white/5 rounded-3xl bg-white dark:bg-slate-900 shadow-sm">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center mb-4 text-purple-600 dark:text-purple-400">
                        <BrainCircuit className="w-8 h-8" />
                    </div>
                    <h3 className="font-bold text-lg mb-2 text-gray-900 dark:text-white">{t('teacher.quizzes.noQuizzes')}</h3>
                    <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                        {t('teacher.quizzes.noQuizzesDesc')}
                    </p>
                    <Link href="/teacher/quizzes/new">
                        <Button className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl">
                            <Plus className="w-4 h-4 mr-2" />
                            {t('teacher.quizzes.createBtn')}
                        </Button>
                    </Link>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {quizzes.map(quiz => (
                        <Card key={quiz.id} className="group hover:border-purple-200 dark:hover:border-purple-500/20 hover:shadow-md transition-all duration-300 bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-2xl">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                            <Badge className={quiz.is_published 
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20" 
                                                : "bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"}>
                                                {quiz.is_published ? t('teacher.quizzes.published') : t('teacher.quizzes.draft')}
                                            </Badge>
                                            <Badge variant="outline" className="border-gray-200 text-gray-600 dark:border-white/10 dark:text-gray-400">{quiz.subject_name}</Badge>
                                        </div>
                                        <CardTitle className="text-base font-bold text-gray-950 dark:text-white line-clamp-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">{quiz.title}</CardTitle>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-950 dark:hover:text-white rounded-lg">
                                                <MoreVertical className="w-4 h-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align={direction === 'rtl' ? 'start' : 'end'} className="rounded-xl border-gray-100 dark:border-white/10">
                                            <Link href={`/teacher/quizzes/${quiz.id}/preview`}>
                                                <DropdownMenuItem className="cursor-pointer gap-2 rounded-lg font-semibold text-xs">
                                                    <Play className="w-3.5 h-3.5" />
                                                    {t('teacher.quizzes.preview')}
                                                </DropdownMenuItem>
                                            </Link>
                                            <Link href={`/teacher/quizzes/${quiz.id}/results`}>
                                                <DropdownMenuItem className="cursor-pointer gap-2 rounded-lg font-semibold text-xs">
                                                    <Trophy className="w-3.5 h-3.5" />
                                                    {t('teacher.quizzes.viewResults')}
                                                </DropdownMenuItem>
                                            </Link>
                                            <Link href={`/teacher/quizzes/${quiz.id}/edit`}>
                                                <DropdownMenuItem className="cursor-pointer gap-2 rounded-lg font-semibold text-xs">
                                                    <Edit className="w-3.5 h-3.5" />
                                                    {t('teacher.quizzes.modify')}
                                                </DropdownMenuItem>
                                            </Link>
                                            <DropdownMenuItem onClick={() => togglePublish(quiz.id, quiz.is_published)} className="cursor-pointer gap-2 rounded-lg font-semibold text-xs">
                                                {quiz.is_published ? (
                                                    <>
                                                        <EyeOff className="w-3.5 h-3.5" />
                                                        {t('teacher.quizzes.unpublish')}
                                                    </>
                                                ) : (
                                                    <>
                                                        <Eye className="w-3.5 h-3.5" />
                                                        {t('teacher.quizzes.publish')}
                                                    </>
                                                )}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => deleteQuiz(quiz.id)}
                                                className="text-red-500 focus:text-red-500 cursor-pointer gap-2 rounded-lg font-semibold text-xs"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                {t('teacher.quizzes.delete')}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground line-clamp-2 mb-4 h-10 leading-snug">
                                    {quiz.description || t('teacher.quizzes.noDescription')}
                                </p>
                                <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500 font-bold">
                                    <span className="flex items-center gap-1">
                                        <FileQuestion className="w-3.5 h-3.5" />
                                        {t('teacher.quizzes.questionsCount', { count: Array.isArray(quiz.questions) ? quiz.questions.length : 0 })}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5" />
                                        {t('teacher.quizzes.minsCount', { count: quiz.time_limit_minutes })}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Users className="w-3.5 h-3.5" />
                                        {t('teacher.quizzes.submissionsCount', { count: quiz.submission_count || 0 })}
                                    </span>
                                </div>
                                <div className="mt-4 pt-3 border-t border-gray-50 dark:border-white/5 text-xs text-gray-400 font-bold uppercase tracking-wider">
                                    {t('teacher.quizzes.classLabel', { name: quiz.class_name })}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
