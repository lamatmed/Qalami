'use client'

import { ArrowLeft, ArrowRight, BookOpen, FileText, FolderOpen, Download, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useState } from 'react'
import { useLanguage } from '@/i18n'

interface Subject {
    id: string
    name: string
    icon?: string | null
}

interface Document {
    id: string
    name: string
    description: string | null
    file_url: string | null
    file_type: string | null
    file_size_bytes: number | null
    document_type: string
    academic_year?: string | null
    subjects?: { name: string; icon?: string | null } | null
    created_at: string | null
}

interface Props {
    subjects: Subject[]
    documents: Document[]
}

const DOC_TYPE_COLORS: Record<string, { text: string; bg: string }> = {
    course: { text: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-500/10' },
    exercise: { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    exam: { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10' },
    correction: { text: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10' },
    resource: { text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
    general: { text: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-500/10' },
}

// Color mapping for subjects
const SUBJECT_COLORS: Record<string, { text: string; bg: string; icon: string }> = {
    'Mathématiques': { text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-500/10', icon: 'Σ' },
    'Français': { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10', icon: 'Fr' },
    'Arabe': { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', icon: 'ع' },
    'Anglais': { text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10', icon: 'En' },
    'Physique': { text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10', icon: '⚡' },
    'Physique-Chimie': { text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10', icon: '⚗' },
    'Sciences': { text: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-500/10', icon: '🔬' },
    'Histoire': { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10', icon: '📜' },
    'Géographie': { text: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-500/10', icon: '🌍' },
    'Éducation Islamique': { text: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-500/10', icon: '☪' },
    'default': { text: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-500/10', icon: '📚' }
}

function formatFileSize(bytes: number | null): string {
    if (!bytes) return ''
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export function StudentCoursesView({ subjects, documents }: Props) {
    const [searchQuery, setSearchQuery] = useState('')
    const { t, direction } = useLanguage()

    const getSubjectStyle = (name: string) => {
        return SUBJECT_COLORS[name] || SUBJECT_COLORS['default']
    }

    const filteredSubjects = subjects.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const filteredDocs = documents.filter(d =>
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (d.subjects?.name && d.subjects.name.toLowerCase().includes(searchQuery.toLowerCase()))
    )

    const BackIcon = direction === 'rtl' ? ArrowRight : ArrowLeft

    return (
        <div className="max-w-4xl space-y-8 pb-12 animate-in fade-in duration-500 p-6 md:p-8" dir={direction}>
            {/* Header */}
            <div className="flex items-center gap-4.5">
                <Link href="/student">
                    <Button variant="ghost" size="icon" className="h-11 w-11 rounded-2xl text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-100 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 shadow-sm transition-all duration-300">
                        <BackIcon className="w-5 h-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight leading-tight">
                        {t('student.courses.title')}
                    </h1>
                </div>
            </div>

            {/* Search Input */}
            <div className="relative">
                <Search className={cn("absolute top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400", direction === 'rtl' ? 'right-4' : 'left-4')} />
                <Input
                    placeholder={t('student.courses.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={cn("bg-white dark:bg-slate-900 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-400 rounded-2xl h-12 shadow-sm transition-all focus:bg-white focus:ring-2 focus:ring-purple-500/10", direction === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4')}
                />
            </div>

            {/* Subjects Grid */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h2 className="font-bold text-gray-900 dark:text-white text-lg">{t('student.courses.subjects')}</h2>
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-black bg-purple-50 dark:bg-purple-500/10 px-3 py-1 rounded-full border border-purple-100 dark:border-purple-500/20 uppercase tracking-wider">
                        {filteredSubjects.length} {filteredSubjects.length > 1 ? t('student.courses.subjects') : t('student.courses.subject')}
                    </span>
                </div>

                {filteredSubjects.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-3xl shadow-sm text-gray-400">
                        <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30 text-purple-600 animate-pulse" />
                        <p className="font-bold text-gray-500">{t('student.courses.noSubjects')}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                        {filteredSubjects.map((subject) => {
                            const style = getSubjectStyle(subject.name)
                            const iconLabel = subject.icon || style.icon
                            return (
                                <div
                                    key={subject.id}
                                    className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 p-6 rounded-3xl relative overflow-hidden group hover:border-purple-200 dark:hover:border-purple-500/20 hover:shadow-md transition-all duration-300 cursor-pointer flex items-center gap-4.5"
                                >
                                    <div className={cn("h-13 w-13 rounded-2xl flex items-center justify-center text-xl font-black shrink-0 border transition-all duration-300 group-hover:scale-105", style.bg, style.text, style.text.includes('dark:') ? style.text.split(' ')[0].replace('text-', 'border-').replace('600', '100') : 'border-transparent')}>
                                        {iconLabel}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-black text-base text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors truncate">{subject.name}</h3>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Recent Documents */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h2 className="font-bold text-gray-900 dark:text-white text-lg">{t('student.courses.recentDocuments')}</h2>
                    {filteredDocs.length > 0 && (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-black bg-gray-50 dark:bg-white/5 px-3 py-1 rounded-full border border-gray-100 dark:border-white/5 uppercase tracking-wider">
                            {filteredDocs.length} {filteredDocs.length > 1 ? t('student.courses.files') : t('student.courses.file')}
                        </span>
                    )}
                </div>

                {filteredDocs.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-3xl shadow-sm text-gray-400">
                        <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30 text-purple-600 animate-pulse" />
                        <p className="font-bold text-gray-500">{t('student.courses.noDocuments')}</p>
                    </div>
                ) : (
                    <div className="space-y-3.5">
                        {filteredDocs.map((doc) => {
                            const typeStyle = DOC_TYPE_COLORS[doc.document_type] || DOC_TYPE_COLORS.general
                            const subjectIcon = doc.subjects?.icon

                            return (
                                <a
                                    key={doc.id}
                                    href={doc.file_url || '#'}
                                    target={doc.file_url ? '_blank' : undefined}
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-4.5 bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 p-5 rounded-3xl hover:bg-gray-50/50 dark:hover:bg-white/[0.02] hover:border-purple-200 dark:hover:border-purple-500/20 hover:shadow-sm transition-all duration-300 group"
                                >
                                    <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 border transition-all duration-300 group-hover:scale-105", typeStyle.bg, typeStyle.text.includes('dark:') ? typeStyle.text.split(' ')[0].replace('text-', 'border-').replace('600', '100') : 'border-transparent')}>
                                        {subjectIcon ? (
                                            <span className="text-lg">{subjectIcon}</span>
                                        ) : (
                                            <FileText className={cn("w-5.5 h-5.5", typeStyle.text)} />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm text-gray-900 dark:text-white truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors leading-snug">
                                            {doc.name}
                                        </p>
                                        <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500 font-bold mt-1 uppercase tracking-wider">
                                            <span className={cn("font-black", typeStyle.text)}>
                                                {t('student.courses.' + doc.document_type, { defaultValue: doc.document_type })}
                                            </span>
                                            {doc.subjects?.name && (
                                                <>
                                                    <span>•</span>
                                                    <span>{doc.subjects.name}</span>
                                                </>
                                            )}
                                            {doc.file_size_bytes && (
                                                <>
                                                    <span>•</span>
                                                    <span>{formatFileSize(doc.file_size_bytes)}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    {doc.file_url && (
                                        <Download className="w-4.5 h-4.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                    )}
                                </a>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
