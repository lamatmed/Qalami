'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { useTeacher } from '@/context/teacher-context'
import { useReadNotifications } from '@/hooks/use-read-notifications'
import { ArrowLeft, CalendarDays, Loader2, Clock, MapPin } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'

export default function EventDetailsPage() {
    const { id } = useParams()
    const router = useRouter()
    const { teacherId } = useTeacher()
    const { markAsRead } = useReadNotifications(teacherId)
    const [eventData, setEventData] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchEv() {
            if (!id) return
            const supabase = createClient()
            const { data } = await supabase.from('events').select('*').eq('id', id).single()
            setEventData(data)
            setLoading(false)
            if (data && teacherId) {
                setTimeout(() => markAsRead(data.id), 500)
            }
        }
        fetchEv()
    }, [id, teacherId])

    if (loading) {
        return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
    }

    if (!eventData) {
        return (
            <div className="max-w-3xl mx-auto py-24 text-center">
                <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h2 className="text-xl font-bold">Événement introuvable</h2>
                <button onClick={() => router.back()} className="mt-4 text-indigo-500 font-bold hover:underline">Retour</button>
            </div>
        )
    }

    const eventColor = eventData.color || '#6366f1'

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-6 pb-24">
            <Link href="/teacher/community" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors bg-white dark:bg-slate-900/50 px-4 py-2 rounded-xl border border-slate-150 dark:border-white/5 w-fit">
                <ArrowLeft className="w-4 h-4" />
                Retour à la communauté
            </Link>

            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-white/5 rounded-3xl p-6 sm:p-8 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-3xl flex flex-col items-center justify-center overflow-hidden border shadow-inner" style={{ backgroundColor: eventColor + '15', borderColor: eventColor + '30', color: eventColor }}>
                        <span className="text-xs sm:text-sm font-black uppercase tracking-wider">{new Date(eventData.start_date).toLocaleDateString('fr-FR', { month: 'short' })}</span>
                        <span className="text-2xl sm:text-3xl font-black leading-none mt-0.5">{new Date(eventData.start_date).getDate()}</span>
                    </div>
                    
                    <div className="flex-1 space-y-5">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-tight mb-3">
                                {eventData.title}
                            </h1>
                            <div className="flex flex-wrap items-center gap-4 text-sm font-bold text-slate-600 dark:text-slate-400">
                                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-white/5">
                                    <Clock className="w-4 h-4 text-indigo-500" />
                                    {eventData.all_day 
                                        ? 'Toute la journée' 
                                        : `${new Date(eventData.start_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} ${eventData.end_date ? ' - ' + new Date(eventData.end_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}`
                                    }
                                </div>
                                {eventData.location && (
                                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-white/5">
                                        <MapPin className="w-4 h-4 text-indigo-500" />
                                        {eventData.location}
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {eventData.description && (
                            <>
                                <div className="h-px w-full bg-slate-100 dark:bg-white/5" />
                                <div className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300">
                                    <p className="whitespace-pre-wrap leading-relaxed">{eventData.description}</p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    )
}
