import { QuizBuilder } from '@/components/teacher/quiz-builder'

export default function EditQuizPage({ params }: { params: { quizId: string } }) {
    return <QuizBuilder quizId={params.quizId} />
}
