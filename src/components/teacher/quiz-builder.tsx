'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
    Plus,
    Trash2,
    GripVertical,
    Check,
    Save,
    ArrowLeft,
    ArrowRight
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '@/i18n'
import { getTeacherAssignmentsAction } from '@/app/teacher/actions'

interface Question {
    id: string
    question: string
    options: string[]
    correctIndex: number
}

interface QuizBuilderProps {
    quizId?: string // If provided, we're editing
}

export function QuizBuilder({ quizId }: QuizBuilderProps) {
    const router = useRouter()
    const { t, direction } = useLanguage()
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    // Quiz metadata
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [classId, setClassId] = useState('')
    const [subjectId, setSubjectId] = useState('')
    const [timeLimit, setTimeLimit] = useState(10)
    const [maxAttempts, setMaxAttempts] = useState(1)
    const [isPublished, setIsPublished] = useState(false)

    // Questions
    const [questions, setQuestions] = useState<Question[]>([
        { id: crypto.randomUUID(), question: '', options: ['', '', '', ''], correctIndex: 0 }
    ])

    // Available classes and subjects
    const [classes, setClasses] = useState<{ id: string; name: string; schoolId?: string }[]>([])
    const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([])

    useEffect(() => {
        loadTeacherData()
        if (quizId) {
            loadQuiz()
        }
    }, [quizId])

    const loadTeacherData = async () => {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Load teacher's assigned classes using Server Action to bypass RLS for cross-school school names
        let assignments: any[] = []
        try {
            assignments = await getTeacherAssignmentsAction(user.id)
        } catch (err) {
            console.error('Error loading assignments:', err)
        }

        const classMap = new Map<string, { id: string; name: string; schoolId?: string }>()
        const subjectMap = new Map<string, { id: string; name: string }>()

        assignments?.forEach(a => {
            const cls = a.classes as any
            const subj = a.subjects as any
            if (cls?.id) {
                const schoolName = cls.schools?.name ? ` (${cls.schools.name})` : ''
                classMap.set(cls.id, { 
                    id: cls.id, 
                    name: `${cls.name}${schoolName}`,
                    schoolId: cls.school_id
                })
            }
            if (subj?.id) subjectMap.set(subj.id, { id: subj.id, name: subj.name })
        })

        setClasses(Array.from(classMap.values()))
        setSubjects(Array.from(subjectMap.values()))
    }

    const loadQuiz = async () => {
        if (!quizId) return
        setLoading(true)

        const supabase = createClient()
        const { data, error } = await supabase
            .from('quizzes')
            .select('*')
            .eq('id', quizId)
            .single()

        if (error || !data) {
            toast.error(t('teacher.quizzes.builder.notFound'))
            router.push('/teacher/quizzes')
            return
        }

        setTitle(data.title)
        setDescription(data.description || '')
        setClassId(data.class_id || '')
        setSubjectId(data.subject_id || '')
        setTimeLimit(data.time_limit_minutes || 10)
        setMaxAttempts(data.max_attempts || 1)
        setIsPublished(data.is_published || false)

        if (Array.isArray(data.questions) && data.questions.length > 0) {
            setQuestions(data.questions.map((q: any) => ({
                id: crypto.randomUUID(),
                question: q.question || '',
                options: q.options || ['', '', '', ''],
                correctIndex: q.correctIndex || 0
            })))
        }

        setLoading(false)
    }

    const addQuestion = () => {
        setQuestions([
            ...questions,
            { id: crypto.randomUUID(), question: '', options: ['', '', '', ''], correctIndex: 0 }
        ])
    }

    const removeQuestion = (id: string) => {
        if (questions.length <= 1) {
            toast.error(t('teacher.quizzes.builder.minQuestionsError'))
            return
        }
        setQuestions(questions.filter(q => q.id !== id))
    }

    const updateQuestion = (id: string, field: keyof Question, value: any) => {
        setQuestions(questions.map(q =>
            q.id === id ? { ...q, [field]: value } : q
        ))
    }

    const updateOption = (questionId: string, optionIndex: number, value: string) => {
        setQuestions(questions.map(q => {
            if (q.id === questionId) {
                const newOptions = [...q.options]
                newOptions[optionIndex] = value
                return { ...q, options: newOptions }
            }
            return q
        }))
    }

    const handleSave = async () => {
        // Validation
        if (!title.trim()) {
            toast.error(t('teacher.quizzes.builder.titleRequired'))
            return
        }
        if (!classId) {
            toast.error(t('teacher.quizzes.builder.classRequired'))
            return
        }

        const validQuestions = questions.filter(q =>
            q.question.trim() && q.options.every(o => o.trim())
        )

        if (validQuestions.length === 0) {
            toast.error(t('teacher.quizzes.builder.completeQuestionError'))
            return
        }

        setSaving(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        const selectedClass = classes.find(c => c.id === classId)

        const quizData = {
            title: title.trim(),
            description: description.trim() || null,
            class_id: classId,
            school_id: selectedClass?.schoolId,
            subject_id: subjectId || null,
            time_limit_minutes: timeLimit,
            max_attempts: maxAttempts,
            is_published: isPublished,
            questions: validQuestions.map(q => ({
                question: q.question,
                options: q.options,
                correctIndex: q.correctIndex
            })),
            teacher_id: user?.id
        }

        let error
        if (quizId) {
            const result = await supabase
                .from('quizzes')
                .update(quizData)
                .eq('id', quizId)
            error = result.error
        } else {
            const result = await supabase
                .from('quizzes')
                .insert(quizData)
            error = result.error
        }

        setSaving(false)

        if (error) {
            console.error('Error saving quiz:', error)
            toast.error(t('teacher.quizzes.builder.saveError'))
            return
        }

        toast.success(t('teacher.quizzes.builder.saveSuccess'))
        router.push('/teacher/quizzes')
    }

    if (loading) {
        return <div className="p-8 text-center font-bold text-gray-400">{t('teacher.quizzes.builder.loading')}</div>
    }

    const BackIcon = direction === 'rtl' ? ArrowRight : ArrowLeft

    return (
        <div className="max-w-3xl mx-auto space-y-6" dir={direction}>
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/teacher/quizzes">
                    <Button variant="ghost" size="icon" className="h-10 w-10 border border-gray-100 dark:border-white/10 hover:bg-gray-50 rounded-xl">
                        <BackIcon className="w-5 h-5 text-gray-500" />
                    </Button>
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">
                        {quizId ? t('teacher.quizzes.builder.editTitle') : t('teacher.quizzes.builder.createTitle')}
                    </h1>
                </div>
                <Button onClick={handleSave} disabled={saving} className="gap-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-sm">
                    <Save className="w-4 h-4" />
                    {saving ? t('teacher.quizzes.builder.saving') : t('teacher.quizzes.builder.save')}
                </Button>
            </div>

            {/* Quiz Settings */}
            <Card className="border border-gray-100 dark:border-white/5 rounded-2xl bg-white dark:bg-slate-900 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-lg font-bold text-gray-950 dark:text-white">{t('teacher.quizzes.builder.settingsTitle')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <Label htmlFor="title" className="font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('teacher.quizzes.builder.quizTitleLabel')}</Label>
                            <Input
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder={t('teacher.quizzes.builder.quizTitlePlaceholder')}
                                className="rounded-xl border-gray-100 mt-1.5 focus-visible:ring-purple-600 focus-visible:border-purple-600"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <Label htmlFor="description" className="font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('teacher.quizzes.builder.descriptionLabel')}</Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder={t('teacher.quizzes.builder.descriptionPlaceholder')}
                                rows={2.5}
                                className="rounded-xl border-gray-100 mt-1.5 focus-visible:ring-purple-600 focus-visible:border-purple-600"
                            />
                        </div>
                        <div>
                            <Label className="font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('teacher.quizzes.builder.classSelectLabel')}</Label>
                            <div className="mt-1.5">
                                <Select value={classId} onValueChange={setClassId}>
                                    <SelectTrigger className="rounded-xl border-gray-100">
                                        <SelectValue placeholder={t('teacher.quizzes.builder.classPlaceholder')} />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {classes.map(c => (
                                            <SelectItem key={c.id} value={c.id} className="cursor-pointer">{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div>
                            <Label className="font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('teacher.quizzes.builder.subjectSelectLabel')}</Label>
                            <div className="mt-1.5">
                                <Select value={subjectId} onValueChange={setSubjectId}>
                                    <SelectTrigger className="rounded-xl border-gray-100">
                                        <SelectValue placeholder={t('teacher.quizzes.builder.subjectPlaceholder')} />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {subjects.map(s => (
                                            <SelectItem key={s.id} value={s.id} className="cursor-pointer">{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="timeLimit" className="font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('teacher.quizzes.builder.durationLabel')}</Label>
                            <Input
                                id="timeLimit"
                                type="number"
                                min={1}
                                max={120}
                                value={timeLimit}
                                onChange={(e) => setTimeLimit(Number(e.target.value))}
                                className="rounded-xl border-gray-100 mt-1.5 focus-visible:ring-purple-600"
                            />
                        </div>
                        <div>
                            <Label htmlFor="maxAttempts" className="font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('teacher.quizzes.builder.attemptsLabel')}</Label>
                            <Input
                                id="maxAttempts"
                                type="number"
                                min={1}
                                max={10}
                                value={maxAttempts}
                                onChange={(e) => setMaxAttempts(Number(e.target.value))}
                                className="rounded-xl border-gray-100 mt-1.5 focus-visible:ring-purple-600"
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-gray-50 dark:border-white/5">
                        <div>
                            <Label htmlFor="published" className="font-bold text-sm text-gray-900 dark:text-white">{t('teacher.quizzes.builder.publishImmediatelyLabel')}</Label>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {t('teacher.quizzes.builder.publishImmediatelyDesc')}
                            </p>
                        </div>
                        <Switch
                            id="published"
                            checked={isPublished}
                            onCheckedChange={setIsPublished}
                            className="data-[state=checked]:bg-purple-600"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Questions */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-950 dark:text-white">
                        {t('teacher.quizzes.builder.questionsTitle', { count: questions.length })}
                    </h2>
                    <Button variant="outline" size="sm" onClick={addQuestion} className="gap-2 border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl font-bold">
                        <Plus className="w-4 h-4" />
                        {t('teacher.quizzes.builder.addQuestionBtn')}
                    </Button>
                </div>

                <AnimatePresence>
                    {questions.map((q, qIndex) => (
                        <motion.div
                            key={q.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.2 }}
                        >
                            <Card className="border-l-4 border-l-purple-600 border border-gray-100 dark:border-white/5 rounded-2xl bg-white dark:bg-slate-900 shadow-sm">
                                <CardHeader className="pb-3">
                                    <div className="flex items-center gap-2">
                                        <GripVertical className="w-4 h-4 text-gray-300 cursor-grab shrink-0" />
                                        <span className="font-bold text-purple-600 dark:text-purple-400">Question {qIndex + 1}</span>
                                        <div className="flex-1" />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
                                            onClick={() => removeQuestion(q.id)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <Label className="font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('teacher.quizzes.builder.questionLabel')}</Label>
                                        <Textarea
                                            value={q.question}
                                            onChange={(e) => updateQuestion(q.id, 'question', e.target.value)}
                                            placeholder={t('teacher.quizzes.builder.questionPlaceholder')}
                                            rows={2}
                                            className="rounded-xl border-gray-100 mt-1.5 focus-visible:ring-purple-600 focus-visible:border-purple-600"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <Label className="font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('teacher.quizzes.builder.optionsLabel')}</Label>
                                        <p className="text-xs text-muted-foreground leading-none">
                                            {t('teacher.quizzes.builder.optionsDesc')}
                                        </p>
                                        <div className="space-y-2 mt-2">
                                            {q.options.map((option, oIndex) => (
                                                <div key={oIndex} className="flex items-center gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateQuestion(q.id, 'correctIndex', oIndex)}
                                                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${q.correctIndex === oIndex
                                                            ? 'border-emerald-500 bg-emerald-500 text-white'
                                                            : 'border-gray-200 dark:border-white/10 hover:border-purple-600'
                                                            }`}
                                                    >
                                                        {q.correctIndex === oIndex && <Check className="w-3.5 h-3.5 stroke-[3px]" />}
                                                    </button>
                                                    <Input
                                                        value={option}
                                                        onChange={(e) => updateOption(q.id, oIndex, e.target.value)}
                                                        placeholder={t('teacher.quizzes.builder.optionPlaceholder', { num: oIndex + 1 })}
                                                        className={`rounded-xl border-gray-100 focus-visible:ring-purple-600 ${q.correctIndex === oIndex ? 'border-emerald-500/50 focus-visible:ring-emerald-500 focus-visible:border-emerald-500' : ''}`}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </AnimatePresence>

                <Button variant="outline" onClick={addQuestion} className="w-full gap-2 border-dashed border-2 border-gray-200 dark:border-white/10 hover:border-purple-600 hover:text-purple-600 text-gray-500 font-bold py-5 rounded-2xl">
                    <Plus className="w-4 h-4" />
                    {t('teacher.quizzes.builder.addQuestionBtn')}
                </Button>
            </div>
        </div>
    )
}
