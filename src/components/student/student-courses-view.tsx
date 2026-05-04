'use client'

import { ChevronLeft, BookOpen, FileText, FolderOpen, Download, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useState } from 'react'

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

const DOC_TYPE_LABELS: Record<string, string> = {
    course: 'Cours', exercise: 'Exercice', exam: 'Examen',
    devoirs: 'Devoirs', correction: 'Correction', resource: 'Ressource', general: 'Général',
}

const DOC_TYPE_COLORS: Record<string, { text: string; bg: string }> = {
    course: { text: 'text-cyan-500', bg: 'bg-cyan-500/10' },
    exercise: { text: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    exam: { text: 'text-red-500', bg: 'bg-red-500/10' },
    correction: { text: 'text-purple-500', bg: 'bg-purple-500/10' },
    resource: { text: 'text-blue-500', bg: 'bg-blue-500/10' },
    general: { text: 'text-gray-400', bg: 'bg-gray-500/10' },
}

interface Props {
    subjects: Subject[]
    documents: Document[]
}

// Color mapping for subjects
const SUBJECT_COLORS: Record<string, { text: string; bg: string; icon: string }> = {
    'Mathématiques': { text: 'text-indigo-400', bg: 'bg-indigo-500/10', icon: 'Σ' },
    'Français': { text: 'text-amber-400', bg: 'bg-amber-500/10', icon: 'Fr' },
    'Arabe': { text: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: 'ع' },
    'Anglais': { text: 'text-blue-400', bg: 'bg-blue-500/10', icon: 'En' },
    'Physique': { text: 'text-orange-400', bg: 'bg-orange-500/10', icon: '⚡' },
    'Physique-Chimie': { text: 'text-orange-400', bg: 'bg-orange-500/10', icon: '⚗' },
    'Sciences': { text: 'text-cyan-400', bg: 'bg-cyan-500/10', icon: '🔬' },
    'Histoire': { text: 'text-red-400', bg: 'bg-red-500/10', icon: '📜' },
    'Géographie': { text: 'text-teal-400', bg: 'bg-teal-500/10', icon: '🌍' },
    'Éducation Islamique': { text: 'text-green-400', bg: 'bg-green-500/10', icon: '☪' },
    'default': { text: 'text-gray-400', bg: 'bg-gray-500/10', icon: '📚' }
}

function formatFileSize(bytes: number | null): string {
    if (!bytes) return ''
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export function StudentCoursesView({ subjects, documents }: Props) {
    const [searchQuery, setSearchQuery] = useState('')

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

    return (
        <div className="max-w-md mx-auto lg:max-w-3xl pb-24 space-y-6 p-4">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <Link href="/student">
                    <Button variant="ghost" size="icon" className="-ml-2"><ChevronLeft /></Button>
                </Link>
                <h1 className="font-bold text-xl">Bibliothèque de cours</h1>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                    placeholder="Rechercher une matière ou un fichier..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-[#0D1117] border-white/5 pl-9 h-10 text-sm text-white focus-visible:ring-cyan-500/50"
                />
            </div>

            {/* Subjects Grid */}
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="font-bold text-lg">Matières</h2>
                    <span className="text-[10px] text-cyan-400 font-bold bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-500/30">
                        {filteredSubjects.length} Matière{filteredSubjects.length > 1 ? 's' : ''}
                    </span>
                </div>

                {filteredSubjects.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                        <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">Aucune matière trouvée</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {filteredSubjects.map((subject) => {
                            const style = getSubjectStyle(subject.name)
                            const iconLabel = subject.icon || style.icon
                            return (
                                <div
                                    key={subject.id}
                                    className="bg-card border border-border/50 p-4 rounded-2xl relative overflow-hidden group hover:border-white/10 transition-colors cursor-pointer"
                                >
                                    <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center mb-3 text-xl font-bold", style.bg, style.text)}>
                                        {iconLabel}
                                    </div>
                                    <h3 className="font-bold text-sm text-gray-200 mb-1">{subject.name}</h3>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Recent Documents */}
            <div className="pt-2">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="font-bold text-lg">Documents récents</h2>
                    {filteredDocs.length > 0 && (
                        <span className="text-[10px] text-gray-400 font-bold bg-white/5 px-2 py-0.5 rounded">
                            {filteredDocs.length} fichier{filteredDocs.length > 1 ? 's' : ''}
                        </span>
                    )}
                </div>

                {filteredDocs.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                        <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">Aucun document disponible</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredDocs.map((doc) => {
                            const typeStyle = DOC_TYPE_COLORS[doc.document_type] || DOC_TYPE_COLORS.general
                            const subjectIcon = doc.subjects?.icon

                            return (
                                <a
                                    key={doc.id}
                                    href={doc.file_url || '#'}
                                    target={doc.file_url ? '_blank' : undefined}
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 bg-card border border-border/50 p-4 rounded-2xl hover:bg-card/80 hover:border-white/10 transition-colors group"
                                >
                                    <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", typeStyle.bg)}>
                                        {subjectIcon ? (
                                            <span className="text-base">{subjectIcon}</span>
                                        ) : (
                                            <FileText className={cn("w-5 h-5", typeStyle.text)} />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm text-gray-200 truncate group-hover:text-white transition-colors">
                                            {doc.name}
                                        </p>
                                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                            <span className={cn("font-bold", typeStyle.text)}>
                                                {DOC_TYPE_LABELS[doc.document_type] || doc.document_type}
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
                                        <Download className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
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
