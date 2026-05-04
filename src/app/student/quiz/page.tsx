import { createClient } from '@/utils/supabase/server'
import { StudentQuizView } from '@/components/student/student-quiz-view'

export default async function StudentQuizPage() {
    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return <div>Not authenticated</div>

    // Get user's enrollment to find their class
    const { data: enrollment } = await supabase
        .from('enrollments')
        .select('class_id')
        .eq('student_id', user.id)
        .single()

    // Fetch available quizzes for the student's class
    const { data: quizzes } = await supabase
        .from('quizzes')
        .select(`
            id,
            title,
            description,
            time_limit_minutes,
            questions,
            is_published,
            available_from,
            available_until,
            subject:subject_id(id, name)
        `)
        .eq('class_id', enrollment?.class_id ?? '')
        .eq('is_published', true)
        .order('created_at', { ascending: false })

    // Fetch student's previous submissions
    const { data: submissions } = await supabase
        .from('quiz_submissions')
        .select('quiz_id, score, max_score, submitted_at')
        .eq('student_id', user.id)

    // Create a map of completed quizzes
    const completedMap = new Map(
        (submissions ?? []).map(s => [s.quiz_id, { score: s.score, max_score: s.max_score, submitted_at: s.submitted_at }])
    )

    // Transform quizzes with completion status
    const formattedQuizzes = (quizzes ?? []).map((q: any) => ({
        id: q.id,
        title: q.title,
        description: q.description,
        subject: q.subject?.name ?? 'General',
        questionCount: Array.isArray(q.questions) ? q.questions.length : 0,
        timeLimit: q.time_limit_minutes ?? 15,
        completed: completedMap.has(q.id),
        score: completedMap.get(q.id)?.score,
        maxScore: completedMap.get(q.id)?.max_score,
    }))

    return <StudentQuizView quizzes={formattedQuizzes} />
}
