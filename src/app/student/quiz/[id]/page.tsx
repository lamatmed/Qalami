import { createClient } from '@/utils/supabase/server'
import { QuizSessionView } from '@/components/student/quiz-session-view'
import { redirect } from 'next/navigation'

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function QuizPage({ params }: PageProps) {
    const { id } = await params
    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    // Fetch the quiz
    const { data: quiz, error } = await supabase
        .from('quizzes')
        .select(`
            id,
            title,
            description,
            time_limit_minutes,
            questions,
            subject:subject_id(id, name)
        `)
        .eq('id', id)
        .eq('is_published', true)
        .single()

    if (error || !quiz) {
        return (
            <div className="min-h-screen bg-[#080C14] flex items-center justify-center text-white">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-2">Quiz introuvable</h1>
                    <p className="text-gray-400">Ce quiz n'existe pas ou n'est plus disponible.</p>
                </div>
            </div>
        )
    }

    // Check if already submitted
    const { data: existingSubmission } = await supabase
        .from('quiz_submissions')
        .select('id, score, max_score')
        .eq('quiz_id', id)
        .eq('student_id', user.id)
        .single()

    if (existingSubmission) {
        return (
            <div className="min-h-screen bg-[#080C14] flex items-center justify-center text-white">
                <div className="text-center max-w-md mx-auto p-6">
                    <div className="text-6xl mb-4">🎉</div>
                    <h1 className="text-2xl font-bold mb-2">Quiz déjà complété!</h1>
                    <p className="text-gray-400 mb-4">Vous avez déjà terminé ce quiz.</p>
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 mb-6">
                        <p className="text-4xl font-black text-emerald-500">{existingSubmission.score}/{existingSubmission.max_score}</p>
                        <p className="text-sm text-gray-400">Votre score</p>
                    </div>
                    <a href="/student/quiz" className="text-cyan-400 hover:underline">Retour aux quiz</a>
                </div>
            </div>
        )
    }

    // Get user profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .single()

    return (
        <QuizSessionView
            quizId={quiz.id}
            quizTitle={quiz.title}
            questions={quiz.questions as any[]}
            timeLimit={quiz.time_limit_minutes}
            subjectName={(quiz.subject as any)?.name ?? 'Quiz'}
            userName={profile?.full_name ?? 'Élève'}
            userAvatar={profile?.avatar_url}
        />
    )
}
