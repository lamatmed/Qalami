'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Loader2, MessageSquare, StickyNote } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/i18n'
import { getMySchoolContext } from '@/app/admin/actions'

interface RemarkRow {
    id: string
    content: string
    type: string | null
    created_at: string
    student: { full_name: string | null } | null
    subject: { name: string } | null
}

const TYPE_COLORS: Record<string, string> = {
    positive:    'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    negative:    'bg-red-500/10 border-red-500/30 text-red-400',
    behavioral:  'bg-orange-500/10 border-orange-500/30 text-orange-400',
    academic:    'bg-blue-500/10 border-blue-500/30 text-blue-400',
    neutral:     'bg-gray-500/10 border-gray-500/30 text-gray-400',
}

type FilterType = 'all' | 'positive' | 'negative' | 'behavioral' | 'academic'

export function TeacherRemarksList({ teacherId }: { teacherId: string }) {
    const { t } = useLanguage()
    const [remarks, setRemarks] = useState<RemarkRow[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<FilterType>('all')

    const typeLabels: Record<string, string> = {
        positive:   t('admin.teachers.remarks.positiveSingle'),
        negative:   t('admin.teachers.remarks.negativeSingle'),
        behavioral: t('admin.teachers.remarks.behavioralSingle'),
        academic:   t('admin.teachers.remarks.academicSingle'),
        neutral:    t('admin.teachers.remarks.neutralSingle'),
    }
 
    useEffect(() => {
        async function load() {
            const supabase = createClient()
            const ctx = await getMySchoolContext()
            const currentSchoolId = ctx?.school_id

            const { data } = await supabase
                .from('remarks')
                .select(`
                    id, content, type, created_at,
                    student:profiles!remarks_student_id_fkey ( full_name ),
                    subject:subjects ( name )
                `)
                .eq('teacher_id', teacherId)
                .eq('school_id', currentSchoolId)
                .order('created_at', { ascending: false })
 
            if (data) setRemarks(data as unknown as RemarkRow[])
            setLoading(false)
        }
        load()
    }, [teacherId])
 
    const stats = useMemo(() => {
        const count = (type: string) => remarks.filter(r => r.type === type).length
        return {
            total: remarks.length,
            positive: count('positive'),
            negative: count('negative'),
            behavioral: count('behavioral'),
            academic: count('academic'),
        }
    }, [remarks])
 
    const filtered = useMemo(() => {
        if (filter === 'all') return remarks
        return remarks.filter(r => r.type === filter)
    }, [remarks, filter])
 
    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
        </div>
    )
 
    if (remarks.length === 0) return (
        <div className="text-center py-20 bg-[#1A2530] rounded-3xl border border-white/5">
            <MessageSquare className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">{t('admin.teachers.remarks.noRemarks')}</p>
            <p className="text-xs text-gray-600 mt-1">{t('admin.teachers.remarks.noRemarksDesc')}</p>
        </div>
    )

    return (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { key: 'positive',   label: t('admin.teachers.remarks.positive'),     count: stats.positive,   color: 'text-emerald-400', border: 'border-emerald-500/20' },
                    { key: 'negative',   label: t('admin.teachers.remarks.negative'),     count: stats.negative,   color: 'text-red-400',     border: 'border-red-500/20' },
                    { key: 'behavioral', label: t('admin.teachers.remarks.behavioral'), count: stats.behavioral, color: 'text-orange-400',  border: 'border-orange-500/20' },
                    { key: 'academic',   label: t('admin.teachers.remarks.academic'),  count: stats.academic,   color: 'text-blue-400',    border: 'border-blue-500/20' },
                ].map(s => (
                    <div key={s.key} className={cn('bg-[#1A2530] rounded-2xl border p-4 text-center', s.border)}>
                        <p className={cn('text-2xl font-black', s.color)}>{s.count}</p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Total */}
            <div className="bg-[#1A2530] rounded-2xl border border-white/5 px-5 py-3 flex justify-between items-center">
                <p className="text-sm text-gray-400">{t('admin.teachers.remarks.totalLabel')}</p>
                <p className="text-lg font-black text-white">
                    {t('admin.teachers.remarks.remarksCount').replace('{count}', stats.total.toString()).replace('{plural}', stats.total !== 1 ? 's' : '')}
                </p>
            </div>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
                {([
                    { key: 'all',        label: t('admin.teachers.remarks.all'),       count: stats.total },
                    { key: 'positive',   label: t('admin.teachers.remarks.positive'),     count: stats.positive },
                    { key: 'negative',   label: t('admin.teachers.remarks.negative'),     count: stats.negative },
                    { key: 'behavioral', label: t('admin.teachers.remarks.behavioral'), count: stats.behavioral },
                    { key: 'academic',   label: t('admin.teachers.remarks.academic'),  count: stats.academic },
                ] as { key: FilterType; label: string; count: number }[]).map(f => (
                    <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        className={cn(
                            'px-3 py-1.5 rounded-lg text-xs font-bold border transition-all',
                            filter === f.key
                                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                                : 'bg-white/5 border-white/10 text-gray-500 hover:text-gray-300'
                        )}
                    >
                        {f.label} <span className="opacity-60">({f.count})</span>
                    </button>
                ))}
            </div>

            {/* List */}
            {filtered.length === 0 ? (
                <div className="text-center py-12 bg-[#1A2530] rounded-3xl border border-white/5">
                    <p className="text-gray-500 text-sm">{t('admin.teachers.remarks.noFilterResults')}</p>
                </div>
            ) : (
                <div className="bg-[#1A2530] rounded-3xl border border-white/5 overflow-hidden">
                    <div className="divide-y divide-white/5">
                        {filtered.map(r => {
                            const typeKey = r.type ?? 'neutral'
                            const colorClass = TYPE_COLORS[typeKey] ?? TYPE_COLORS.neutral
                            const typeLabel  = typeLabels[typeKey] ?? r.type ?? t('admin.teachers.remarks.remarkSingle')
                            return (
                                <div key={r.id} className="flex items-start gap-4 p-4 hover:bg-[#0F1720] transition-colors">
                                    <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border mt-0.5', colorClass)}>
                                        <StickyNote className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', colorClass)}>
                                                    {typeLabel}
                                                </span>
                                                {r.student?.full_name && (
                                                    <p className="text-sm font-bold text-white">{r.student.full_name}</p>
                                                )}
                                                {r.subject?.name && (
                                                    <p className="text-xs text-gray-500">· {r.subject.name}</p>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-600 shrink-0">
                                                {new Date(r.created_at).toLocaleDateString(t('common.locale') || 'fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </p>
                                        </div>
                                        <p className="text-sm text-gray-300 mt-2 leading-relaxed">{r.content}</p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
