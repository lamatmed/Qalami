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
    ArrowLeft
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

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
    const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
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

        // Load teacher's assigned classes
        const { data: assignments } = await supabase
            .from('teacher_assignments')
            .select('class_id, classes(id, name), subjects(id, name)')
            .eq('teacher_id', user.id)

        const classMap = new Map<string, { id: string; name: string }>()
        const subjectMap = new Map<string, { id: string; name: string }>()

        assignments?.forEach(a => {
            const cls = a.classes as any
            const subj = a.subjects as any
            if (cls?.id) classMap.set(cls.id, { id: cls.id, name: cls.name })
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
            toast.error('Quiz non trouvé')
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
            toast.error('Un quiz doit avoir au moins une question')
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
            toast.error('Le titre est requis')
            return
        }
        if (!classId) {
            toast.error('Veuillez sélectionner une classe')
            return
        }

        const validQuestions = questions.filter(q =>
            q.question.trim() && q.options.every(o => o.trim())
        )

        if (validQuestions.length === 0) {
            toast.error('Ajoutez au moins une question complète')
            return
        }

        setSaving(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        const quizData = {
            title: title.trim(),
            description: description.trim() || null,
            class_id: classId,
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
            toast.error('Erreur lors de la sauvegarde')
            return
        }

        toast.success(quizId ? 'Quiz mis à jour !' : 'Quiz créé !')
        router.push('/teacher/quizzes')
    }

    if (loading) {
        return <div className="p-8 text-center">Chargement...</div>
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/teacher/quizzes">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold">
                        {quizId ? 'Modifier le Quiz' : 'Créer un Quiz'}
                    </h1>
                </div>
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                    <Save className="w-4 h-4" />
                    {saving ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
            </div>

            {/* Quiz Settings */}
            <Card>
                <CardHeader>
                    <CardTitle>Paramètres du Quiz</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <Label htmlFor="title">Titre *</Label>
                            <Input
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Ex: Quiz de révision - Chapitre 3"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Description optionnelle du quiz..."
                                rows={2}
                            />
                        </div>
                        <div>
                            <Label>Classe *</Label>
                            <Select value={classId} onValueChange={setClassId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Sélectionner une classe" />
                                </SelectTrigger>
                                <SelectContent>
                                    {classes.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Matière</Label>
                            <Select value={subjectId} onValueChange={setSubjectId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Sélectionner une matière" />
                                </SelectTrigger>
                                <SelectContent>
                                    {subjects.map(s => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="timeLimit">Durée (minutes)</Label>
                            <Input
                                id="timeLimit"
                                type="number"
                                min={1}
                                max={120}
                                value={timeLimit}
                                onChange={(e) => setTimeLimit(Number(e.target.value))}
                            />
                        </div>
                        <div>
                            <Label htmlFor="maxAttempts">Tentatives max</Label>
                            <Input
                                id="maxAttempts"
                                type="number"
                                min={1}
                                max={10}
                                value={maxAttempts}
                                onChange={(e) => setMaxAttempts(Number(e.target.value))}
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                        <div>
                            <Label htmlFor="published">Publier immédiatement</Label>
                            <p className="text-xs text-muted-foreground">
                                Les élèves pourront voir et répondre au quiz
                            </p>
                        </div>
                        <Switch
                            id="published"
                            checked={isPublished}
                            onCheckedChange={setIsPublished}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Questions */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Questions ({questions.length})</h2>
                    <Button variant="outline" size="sm" onClick={addQuestion} className="gap-2">
                        <Plus className="w-4 h-4" />
                        Ajouter
                    </Button>
                </div>

                <AnimatePresence>
                    {questions.map((q, qIndex) => (
                        <motion.div
                            key={q.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            <Card className="border-l-4 border-l-primary">
                                <CardHeader className="pb-3">
                                    <div className="flex items-center gap-2">
                                        <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                                        <span className="font-bold text-primary">Question {qIndex + 1}</span>
                                        <div className="flex-1" />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive"
                                            onClick={() => removeQuestion(q.id)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <Label>Énoncé de la question *</Label>
                                        <Textarea
                                            value={q.question}
                                            onChange={(e) => updateQuestion(q.id, 'question', e.target.value)}
                                            placeholder="Tapez votre question ici..."
                                            rows={2}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Options de réponse *</Label>
                                        <p className="text-xs text-muted-foreground mb-2">
                                            Cliquez sur le cercle pour marquer la bonne réponse
                                        </p>
                                        {q.options.map((option, oIndex) => (
                                            <div key={oIndex} className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => updateQuestion(q.id, 'correctIndex', oIndex)}
                                                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${q.correctIndex === oIndex
                                                        ? 'border-emerald-500 bg-emerald-500 text-white'
                                                        : 'border-muted-foreground/30 hover:border-muted-foreground'
                                                        }`}
                                                >
                                                    {q.correctIndex === oIndex && <Check className="w-3 h-3" />}
                                                </button>
                                                <Input
                                                    value={option}
                                                    onChange={(e) => updateOption(q.id, oIndex, e.target.value)}
                                                    placeholder={`Option ${oIndex + 1}`}
                                                    className={q.correctIndex === oIndex ? 'border-emerald-500/50' : ''}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </AnimatePresence>

                <Button variant="outline" onClick={addQuestion} className="w-full gap-2">
                    <Plus className="w-4 h-4" />
                    Ajouter une question
                </Button>
            </div>
        </div>
    )
}
