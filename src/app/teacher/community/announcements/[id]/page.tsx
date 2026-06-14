'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { useTeacher } from '@/context/teacher-context'
import { useReadNotifications } from '@/hooks/use-read-notifications'
import { useLanguage } from '@/i18n'
import { ArrowLeft, Megaphone, Loader2, Pin, AlertTriangle, Globe, Clock, GraduationCap, Users, BookOpen, Paperclip, Download } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

function decodeAudience(raw: string[]) {
    const roles = raw.filter(x => !x.startsWith('cls:'))
    const classIds = raw.filter(x => x.startsWith('cls:')).map(x => x.slice(4))
    return { roles, classIds }
}

function audienceSummary(raw: string[], classes: { id: string, name: string }[], t: any) {
    const { roles, classIds } = decodeAudience(raw)
    const rLabel = roles.includes('all') || roles.length === 0 ? (t('teacher.community.audience.all') || 'Tous')
        : roles.map(r => r === 'eleves' ? (t('teacher.community.roles.students') || 'Élèves') : r === 'parents' ? (t('teacher.community.roles.parents') || 'Parents') : (t('teacher.community.roles.teachers') || 'Enseignants')).join(', ')
    if (classIds.length === 0) return `${rLabel} · ${t('teacher.community.audience.wholeSchool') || "Toute l'école"}`
    const cNames = classIds.map(id => classes.find(c => c.id === id)?.name ?? id).join(', ')
    return `${rLabel} · ${cNames}`
}

export default function AnnouncementDetailsPage() {
    const { id } = useParams()
    const router = useRouter()
    const { t, language } = useLanguage()
    const { teacherId, schoolId } = useTeacher()
    const { markAsRead } = useReadNotifications(teacherId)
    const [announcement, setAnnouncement] = useState<any>(null)
    const [allClasses, setAllClasses] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const PRIORITIES = [
        { value: 'normal',  label: t('teacher.community.priorities.normal') || 'Normale',  cls: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
        { value: 'high',    label: t('teacher.community.priorities.high') || 'Haute',    cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
        { value: 'urgent',  label: t('teacher.community.priorities.urgent') || 'Urgente',  cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
        { value: 'low',     label: t('teacher.community.priorities.low') || 'Basse',    cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    ]

    const pInfo = (p: string) => PRIORITIES.find(x => x.value === p) ?? PRIORITIES[0]

    useEffect(() => {
        async function fetchAnn() {
            if (!id || !schoolId) return
            const supabase = createClient()
            const [ { data: ann }, { data: cls } ] = await Promise.all([
                supabase.from('announcements').select('*').eq('id', id).single(),
                supabase.from('classes').select('id, name').eq('school_id', schoolId)
            ])
            setAnnouncement(ann)
            setAllClasses(cls || [])
            setLoading(false)
            if (ann && teacherId) {
                setTimeout(() => markAsRead(ann.id), 500)
            }
        }
        if (id && schoolId) fetchAnn()
    }, [id, teacherId, schoolId])

    if (loading) {
        return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
    }

    if (!announcement) {
        return (
            <div className="max-w-3xl mx-auto py-24 text-center">
                <Megaphone className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h2 className="text-xl font-bold">{t('teacher.community.announcementNotFound')}</h2>
                <button onClick={() => router.back()} className="mt-4 text-emerald-500 font-bold hover:underline">{t('teacher.community.back')}</button>
            </div>
        )
    }

    const pi = pInfo(announcement.priority)
    const isExpired = announcement.expires_at ? new Date(announcement.expires_at) < new Date() : false
    const summary = audienceSummary(announcement.target_audience || [], allClasses, t)

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-6 pb-24">
            <Link href="/teacher/community" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors bg-white dark:bg-slate-900/50 px-4 py-2 rounded-xl border border-slate-150 dark:border-white/5 w-fit">
                <ArrowLeft className="w-4 h-4" />
                {t('teacher.community.backToCommunity')}
            </Link>

            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-white/5 rounded-3xl p-6 sm:p-8 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
                    <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border", pi.cls)}>
                        {announcement.priority === 'urgent' ? <AlertTriangle className="w-6 h-6" /> : <Megaphone className="w-6 h-6" />}
                    </div>
                    <div className="flex-1 space-y-4">
                        <div>
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                                <span className={cn('px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider border', pi.cls)}>
                                    {pi.label}
                                </span>
                                {isExpired && <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-gray-500/20 text-gray-400 border border-gray-500/30">{t('teacher.community.expired')}</span>}
                                <span className="text-sm font-bold text-slate-400">
                                    {new Date(announcement.created_at).toLocaleDateString(language === 'ar' ? 'ar-MR' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Nouakchott' })} {language === 'ar' ? 'على الساعة' : 'à'} {new Date(announcement.created_at).toLocaleTimeString(language === 'ar' ? 'ar-MR' : 'fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nouakchott' })}
                                </span>
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-tight">
                                {announcement.title}
                            </h1>
                            <div className="mt-3 inline-flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-white/5 text-sm font-medium text-slate-600 dark:text-slate-400">
                                <Globe className="w-4 h-4 text-emerald-500" />
                                <span className="font-bold">{t('teacher.community.targeting')}</span> {summary}
                            </div>
                        </div>
                        
                        <div className="h-px w-full bg-slate-100 dark:bg-white/5" />

                        <div className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300">
                            <p className="whitespace-pre-wrap leading-relaxed">{announcement.content}</p>
                        </div>

                        {announcement.attachment_url && (
                            <div className="pt-2">
                                <a
                                    href={announcement.attachment_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download={announcement.attachment_name || true}
                                    className="inline-flex items-center gap-2.5 px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-500 text-sm font-bold rounded-xl transition-colors"
                                >
                                    <Paperclip className="w-4 h-4" />
                                    {announcement.attachment_name || 'Télécharger la pièce jointe'}
                                    <Download className="w-3.5 h-3.5 opacity-70" />
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    )
}
