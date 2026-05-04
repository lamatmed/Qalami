'use client'

import { useState, useEffect } from 'react'
import { Megaphone, AlertTriangle, Bell, ChevronLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'

interface Announcement {
    id: string
    title: string
    content: string
    target_audience: string | null
    target_scope: string | null
    target_class_id: string | null
    target_profile_id: string | null
    priority: string | null
    created_at: string
    published_at: string | null
}

interface Props {
    userRole: 'student' | 'parent' | 'teacher'
    backUrl?: string
}

const ROLE_LABEL: Record<string, string> = {
    student: 'Élèves',
    teacher: 'Enseignants',
    parent: 'Parents',
}

export function AnnouncementsView({ userRole, backUrl = '/student' }: Props) {
    const supabase = createClient()
    const [announcements, setAnnouncements] = useState<Announcement[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedId, setExpandedId] = useState<string | null>(null)

    useEffect(() => {
        const fetchAnnouncements = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('school_id')
                    .eq('id', user.id)
                    .single()

                if (!profile?.school_id) return

                // Resolve the user's class IDs for class-scope filtering
                let classIds: string[] = []
                if (userRole === 'student') {
                    const { data: enr } = await supabase
                        .from('enrollments')
                        .select('class_id')
                        .eq('student_id', user.id)
                        .eq('status', 'active')
                    classIds = (enr || []).map((e: any) => e.class_id).filter(Boolean)
                } else if (userRole === 'teacher') {
                    const { data: sch } = await supabase
                        .from('schedule')
                        .select('class_id')
                        .eq('teacher_id', user.id)
                    classIds = [...new Set((sch || []).map((e: any) => e.class_id).filter(Boolean))]
                } else if (userRole === 'parent') {
                    const { data: children } = await supabase
                        .from('parent_children')
                        .select('student_id')
                        .eq('parent_id', user.id)
                    const childIds = (children || []).map((c: any) => c.student_id)
                    if (childIds.length > 0) {
                        const { data: enr } = await supabase
                            .from('enrollments')
                            .select('class_id')
                            .in('student_id', childIds)
                            .eq('status', 'active')
                        classIds = (enr || []).map((e: any) => e.class_id).filter(Boolean)
                    }
                }

                const { data } = await supabase
                    .from('announcements')
                    .select('id, title, content, target_audience, target_scope, target_class_id, target_profile_id, priority, created_at, published_at')
                    .eq('school_id', profile.school_id)
                    .in('status', ['published', 'sent'])
                    .order('created_at', { ascending: false })
                    .limit(50)

                const roleLabel = ROLE_LABEL[userRole] || userRole
                const filtered = (data || []).filter((a: Announcement) => {
                    if (a.target_scope === 'individual') {
                        return a.target_profile_id === user.id
                    }
                    if (a.target_scope === 'class') {
                        return a.target_class_id ? classIds.includes(a.target_class_id) : false
                    }
                    // school scope
                    if (!a.target_audience) return true
                    const audience = a.target_audience.split(',').map(s => s.trim())
                    return audience.length === 0 || audience.includes('all') || audience.includes(roleLabel)
                })

                setAnnouncements(filtered)
            } catch (error) {
                console.error('Error fetching announcements:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchAnnouncements()

        // Realtime subscription for new school-scope announcements
        const channel = supabase
            .channel('announcements-realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, (payload) => {
                const newAnn = payload.new as Announcement
                const roleLabel = ROLE_LABEL[userRole] || userRole
                // Only add school-scope ones here (individual/class would need class lookup)
                if (newAnn.target_scope === 'school') {
                    const audience = (newAnn.target_audience || '').split(',').map(s => s.trim())
                    if (audience.length === 0 || audience.includes('all') || audience.includes(roleLabel)) {
                        setAnnouncements(prev => [newAnn, ...prev])
                    }
                }
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [userRole])

    const formatDate = (ann: Announcement) => {
        const dateStr = ann.published_at || ann.created_at
        const date = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffHours = diffMs / (1000 * 60 * 60)
        const diffDays = diffMs / (1000 * 60 * 60 * 24)

        if (diffHours < 1) return 'À l\'instant'
        if (diffHours < 24) return `Il y a ${Math.floor(diffHours)}h`
        if (diffDays < 2) return 'Hier'
        if (diffDays < 7) return `Il y a ${Math.floor(diffDays)} jours`
        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    }

    // Separate urgent from normal
    const urgent = announcements.filter(a => a.priority === 'high')
    const normal = announcements.filter(a => a.priority !== 'high')

    return (
        <div className="max-w-md mx-auto lg:max-w-3xl pb-24 space-y-6 p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Link href={backUrl}>
                        <Button variant="ghost" size="icon" className="-ml-2"><ChevronLeft /></Button>
                    </Link>
                    <h1 className="font-bold text-xl">Annonces</h1>
                </div>
                <Bell className="w-5 h-5 text-gray-500" />
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
                </div>
            ) : announcements.length === 0 ? (
                <div className="text-center py-20 text-gray-500">
                    <Megaphone className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Aucune annonce pour le moment</p>
                </div>
            ) : (
                <>
                    {/* Urgent Announcements */}
                    {urgent.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                                <h2 className="font-bold text-lg text-red-500">Urgent</h2>
                            </div>
                            <div className="space-y-3">
                                {urgent.map(ann => (
                                    <AnnouncementCard
                                        key={ann.id}
                                        announcement={ann}
                                        isExpanded={expandedId === ann.id}
                                        onToggle={() => setExpandedId(expandedId === ann.id ? null : ann.id)}
                                        formatDate={formatDate}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Normal Announcements */}
                    {normal.length > 0 && (
                        <div>
                            {urgent.length > 0 && <h2 className="font-bold text-lg mb-4 mt-6">Autres annonces</h2>}
                            <div className="space-y-3">
                                {normal.map(ann => (
                                    <AnnouncementCard
                                        key={ann.id}
                                        announcement={ann}
                                        isExpanded={expandedId === ann.id}
                                        onToggle={() => setExpandedId(expandedId === ann.id ? null : ann.id)}
                                        formatDate={formatDate}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

function AnnouncementCard({
    announcement,
    isExpanded,
    onToggle,
    formatDate
}: {
    announcement: Announcement
    isExpanded: boolean
    onToggle: () => void
    formatDate: (ann: Announcement) => string
}) {
    const isUrgent = announcement.priority === 'high'

    return (
        <div
            className={cn(
                "rounded-2xl p-4 cursor-pointer transition-all duration-200",
                isUrgent
                    ? "bg-red-500/10 border border-red-500/20 hover:bg-red-500/15"
                    : "bg-card border border-border/50 hover:bg-card/80"
            )}
            onClick={onToggle}
        >
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                    <div className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center",
                        isUrgent ? "bg-red-600" : "bg-blue-600"
                    )}>
                        <Megaphone className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h3 className={cn(
                            "font-bold text-sm",
                            isUrgent && "text-red-400"
                        )}>{announcement.title}</h3>
                    </div>
                </div>
                <span className="text-[10px] text-gray-500">{formatDate(announcement)}</span>
            </div>

            <p className={cn(
                "text-sm text-gray-400 transition-all duration-200",
                isExpanded ? "" : "line-clamp-2"
            )}>
                {announcement.content}
            </p>

            {!isExpanded && announcement.content.length > 100 && (
                <span className="text-xs text-blue-500 mt-2 block">Voir plus...</span>
            )}
        </div>
    )
}
