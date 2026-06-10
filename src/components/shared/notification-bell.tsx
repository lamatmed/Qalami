'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, CheckCheck, Info, AlertTriangle, CheckCircle, Activity } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import { markAsRead, markAllAsRead, formatNotificationTime, type Notification, type NotificationType } from '@/lib/notifications'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/i18n'
import { getAdminNotifications } from '@/app/admin/actions'
import { getTeacherNotifications } from '@/app/teacher/actions'

function getLocalizedNotification(n: Notification, t: any, language: string) {
    let title = n.title
    let message = n.message

    const docLabels: Record<string, string> = {
        'Attestation de scolarité': t('adminRequests.attestation_scolarite') || 'Attestation de scolarité',
        'Certificat de scolarité': t('adminRequests.certificat_scolarite') || 'Certificat de scolarité',
        'Bulletin scolaire': t('adminRequests.bulletin') || 'Bulletin scolaire',
        'Bulletin': t('adminRequests.bulletin') || 'Bulletin',
        'Relevé de notes': t('adminRequests.releve_notes') || 'Relevé de notes',
        'Convention de stage': t('adminRequests.convention_stage') || 'Convention de stage',
        'Autre': t('adminRequests.autre') || 'Autre',
    }

    const translateDocLabel = (label: string) => {
        return docLabels[label] || label
    }

    if (language === 'ar') {
        // --- 1. Nouvelle demande ---
        if (title.startsWith('Nouvelle demande : ')) {
            const doc = title.replace('Nouvelle demande : ', '')
            title = `طلب جديد : ${translateDocLabel(doc)}`
        } else if (title === 'Nouvelle demande de document') {
            title = 'طلب وثيقة جديدة'
        }
        
        if (message.startsWith('Un parent demande : ')) {
            const rest = message.replace('Un parent demande : ', '')
            const parts = rest.split(' — ')
            const doc = translateDocLabel(parts[0])
            const notes = parts.slice(1).join(' — ')
            message = `طلب ولي أمر : ${doc}${notes ? ` — ${notes}` : ''}`
        } else {
            // Check for pattern: {parentName} demande : {docName} (élève : {studentName})
            const match = message.match(/(.*) demande : (.*) \(élève : (.*)\)/)
            if (match) {
                const parent = match[1]
                const doc = translateDocLabel(match[2])
                const student = match[3]
                message = `${parent} يطلب : ${doc} (التلميذ : ${student})`
            }
        }

        // --- 1b. Justification d'absence ---
        if (title === "Nouvelle justification d'absence") {
            title = 'تبرير غياب جديد'
        }
        if (title === "Justificatif d'absence") {
            title = 'تبرير غياب'
        }
        const justifMatch = message.match(/^(.*) a envoyé une justification pour : (.*)$/)
        if (justifMatch) {
            message = `${justifMatch[1]} أرسل تبريراً للغياب عن : ${justifMatch[2]}`
        }
        const justifPendingMatch = message.match(/^(.*) a soumis un justificatif pour le (.*)$/)
        if (justifPendingMatch) {
            message = `${justifPendingMatch[1]} قدم تبريراً للغياب بتاريخ ${justifPendingMatch[2]}`
        }

        // --- 2. Document prêt ---
        if (title.startsWith('Document prêt : ')) {
            const doc = title.replace('Document prêt : ', '')
            title = `الوثيقة جاهزة : ${translateDocLabel(doc)}`
        }
        if (message === 'Votre document est disponible. Vous pouvez le télécharger depuis votre espace.') {
            message = 'وثيقتكم جاهزة. يمكنكم تحميلها من فضاءكم الخاص.'
        }

        // --- 3. Rappel de paiement (parent side) ---
        if (title.startsWith('🔔 Rappel de Paiement : ')) {
            const student = title.replace('🔔 Rappel de Paiement : ', '')
            title = `🔔 تذكير بالدفع : ${student}`
        }
        if (message.includes('nous vous rappelons que') && message.includes('mensualité(s) en retard')) {
            const match = message.match(/nous vous rappelons que (.*) a (\d+) mensualité\(s\) en retard pour un total de ([\d\s.,]+) MRU/)
            if (match) {
                const student = match[1]
                const count = match[2]
                const total = match[3]
                message = `مرحباً، نذكركم بأن ${student} لديه ${count} قسط (أقساط) متأخرة بمجموع ${total} أوقية. يرجى التسوية في أقرب وقت ممكن.`
            }
        }

        // --- 4. Rappel envoyé (admin confirmation side) ---
        if (title.startsWith('✅ Rappel envoyé : ')) {
            const student = title.replace('✅ Rappel envoyé : ', '')
            title = `✅ تم إرسال التذكير : ${student}`
        }
        if (message.includes('mensualité(s) en retard') && message.includes('Rappel envoyé aux parents')) {
            const match = message.match(/(\d+) mensualité\(s\) en retard — ([\d\s.,]+) MRU/)
            if (match) {
                const count = match[1]
                const total = match[2]
                message = `${count} قسط (أقساط) متأخرة — ${total} أوقية. تم إرسال التذكير لأولياء الأمور.`
            }
        }

        // --- 5. Demande traitée / status updates (parent side) ---
        if (title.startsWith('Demande prête à retirer : ')) {
            const doc = title.replace('Demande prête à retirer : ', '')
            title = `الطلب جاهز للاستلام : ${translateDocLabel(doc)}`
        }
        if (title.startsWith('Demande refusée : ')) {
            const doc = title.replace('Demande refusée : ', '')
            title = `تم رفض الطلب : ${translateDocLabel(doc)}`
        }
        if (title.startsWith('Demande en cours de traitement : ')) {
            const doc = title.replace('Demande en cours de traitement : ', '')
            title = `الطلب قيد المعالجة : ${translateDocLabel(doc)}`
        }
        if (title.startsWith('Demande mise à jour : ')) {
            const doc = title.replace('Demande mise à jour : ', '')
            title = `تم تحديث الطلب : ${translateDocLabel(doc)}`
        }

        if (message.startsWith('Votre demande de ') && message.includes('a été')) {
            const rest = message.replace('Votre demande de ', '')
            let statusAr = 'تحديثها'
            if (rest.includes('prête à retirer')) statusAr = 'جاهزة للاستلام'
            else if (rest.includes('refusée')) statusAr = 'مرفوضة'
            else if (rest.includes('en cours de traitement')) statusAr = 'قيد المعالجة'
            const docRaw = rest.split(' a été ')[0]
            message = `طلبكم الخاص بـ ${translateDocLabel(docRaw)} أصبح ${statusAr}.`
        }
        if (message === "Annonce publiée pour l'école.") {
            message = "تم نشر الإعلان للمدرسة."
        }
    } else {
        if (title.startsWith('Nouvelle demande : ')) {
            const doc = title.replace('Nouvelle demande : ', '')
            title = `Nouvelle demande : ${translateDocLabel(doc)}`
        }
        if (message.startsWith('Un parent demande : ')) {
            const rest = message.replace('Un parent demande : ', '')
            const parts = rest.split(' — ')
            const doc = translateDocLabel(parts[0])
            const notes = parts.slice(1).join(' — ')
            message = `Un parent demande : ${doc}${notes ? ` — ${notes}` : ''}`
        } else {
            const match = message.match(/(.*) demande : (.*) \(élève : (.*)\)/)
            if (match) {
                const parent = match[1]
                const doc = translateDocLabel(match[2])
                const student = match[3]
                message = `${parent} demande : ${doc} (élève : ${student})`
            }
        }
        if (title.startsWith('Document prêt : ')) {
            const doc = title.replace('Document prêt : ', '')
            title = `Document prêt : ${translateDocLabel(doc)}`
        }
        if (title.startsWith('Demande prête à retirer : ')) {
            const doc = title.replace('Demande prête à retirer : ', '')
            title = `Demande prête à retirer : ${translateDocLabel(doc)}`
        }
        if (title.startsWith('Demande refusée : ')) {
            const doc = title.replace('Demande refusée : ', '')
            title = `Demande refusée : ${translateDocLabel(doc)}`
        }
        if (title.startsWith('Demande en cours de traitement : ')) {
            const doc = title.replace('Demande en cours de traitement : ', '')
            title = `Demande en cours de traitement : ${translateDocLabel(doc)}`
        }
        if (title.startsWith('Demande mise à jour : ')) {
            const doc = title.replace('Demande mise à jour : ', '')
            title = `Demande mise à jour : ${translateDocLabel(doc)}`
        }
        if (message.startsWith('Votre demande de ') && message.includes('a été')) {
            const rest = message.replace('Votre demande de ', '')
            const parts = rest.split(' a été ')
            const doc = translateDocLabel(parts[0])
            message = `Votre demande de ${doc} a été ${parts[1]}`
        }
    }

    return { title, message }
}

export function NotificationBell() {
    const supabase = createClient()
    const router = useRouter()
    const { t, language } = useLanguage()
    const [isOpen, setIsOpen] = useState(false)
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)
    const [userRole, setUserRole] = useState<string>('')
    const [localReadIds, setLocalReadIds] = useState<Set<string>>(new Set())
    const dropdownRef = useRef<HTMLDivElement>(null)
    const userContextRef = useRef<{ userId: string, schoolId: string | null, isAdmin: boolean, isTeacher: boolean, excludeIds: Set<string> } | null>(null)

    const unreadCount = notifications.filter(n => !n.is_read).length

    // Fetch notifications
    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return

                const { data: profile } = await supabase.from('profiles').select('role, school_id').eq('id', user.id).single()
                const role = profile?.role || ''
                setUserRole(role)
                const isAdmin = ['admin', 'super_admin', 'school_staff'].includes(role)
                const isTeacher = role === 'teacher'

                userContextRef.current = { userId: user.id, schoolId: profile?.school_id || null, isAdmin, isTeacher, excludeIds: new Set() }

                // Load virtual-notification read state from localStorage
                const storedRead = localStorage.getItem(`qalami_read_${user.id}`)
                const readSet = new Set<string>(storedRead ? JSON.parse(storedRead) : [])
                setLocalReadIds(readSet)

                let data: any[] = []
                if (isAdmin && profile?.school_id) {
                    data = await getAdminNotifications(profile.school_id)
                } else if (isTeacher && profile?.school_id) {
                    const raw = await getTeacherNotifications(user.id, profile.school_id)
                    // Apply localStorage read state to virtual notifications
                    data = (raw ?? []).map((n: any) =>
                        isVirtualNotification(n.id) ? { ...n, is_read: readSet.has(n.id) } : n
                    )
                } else {
                    const { data: userData } = await supabase
                        .from('notifications')
                        .select('*')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false })
                        .limit(20)
                    data = userData ?? []
                }

                setNotifications(data)
                setLoading(false)
            } catch (error: any) {
                if (error?.name === 'AbortError') {
                    console.log('Fetch notifications aborted')
                } else {
                    console.error('Error fetching notifications:', error)
                }
            }
        }

        fetchNotifications()

        // Realtime subscription
        const channel = supabase
            .channel('notifications-realtime')
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'notifications' },
                (payload) => {
                    const newNotification = payload.new as Notification
                    const ctx = userContextRef.current
                    if (!ctx) return

                    if (newNotification.user_id === ctx.userId) {
                        if (ctx.isAdmin && newNotification.event_type !== 'absence_justification') return
                        setNotifications(prev => [newNotification, ...prev].slice(0, 50))
                    }
                }
            )
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'notifications' },
                (payload) => {
                    const updated = payload.new as Notification
                    setNotifications(prev =>
                        prev.map(n => n.id === updated.id ? updated : n)
                    )
                }
            )
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'attendance' },
                async (payload) => {
                    const ctx = userContextRef.current
                    if (!ctx?.isAdmin || !ctx.schoolId) return
                    const updated = payload.new as any
                    if (['pending', 'approved', 'rejected'].includes(updated.justification_status)) {
                        const data = await getAdminNotifications(ctx.schoolId)
                        setNotifications(data ?? [])
                    }
                }
            )
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'announcements' },
                async () => {
                    const ctx = userContextRef.current
                    if (!ctx?.isTeacher || !ctx.schoolId) return
                    const storedRead = localStorage.getItem(`qalami_read_${ctx.userId}`)
                    const readSet = new Set<string>(storedRead ? JSON.parse(storedRead) : [])
                    const raw = await getTeacherNotifications(ctx.userId, ctx.schoolId)
                    setNotifications((raw ?? []).map((n: any) =>
                        isVirtualNotification(n.id) ? { ...n, is_read: readSet.has(n.id) } : n
                    ))
                }
            )
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'events' },
                async () => {
                    const ctx = userContextRef.current
                    if (!ctx?.isTeacher || !ctx.schoolId) return
                    const storedRead = localStorage.getItem(`qalami_read_${ctx.userId}`)
                    const readSet = new Set<string>(storedRead ? JSON.parse(storedRead) : [])
                    const raw = await getTeacherNotifications(ctx.userId, ctx.schoolId)
                    setNotifications((raw ?? []).map((n: any) =>
                        isVirtualNotification(n.id) ? { ...n, is_read: readSet.has(n.id) } : n
                    ))
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const isVirtualNotification = (id: string) =>
        id.startsWith('req_') || id.startsWith('justif_') || id.startsWith('ann_') || id.startsWith('evt_')

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.is_read) {
            if (isVirtualNotification(notification.id)) {
                // Persist read state in localStorage (for teacher ann_/evt_, req_, justif_ have no DB row)
                const ctx = userContextRef.current
                if (ctx) {
                    const storedRead = localStorage.getItem(`qalami_read_${ctx.userId}`)
                    const ids: string[] = storedRead ? JSON.parse(storedRead) : []
                    if (!ids.includes(notification.id)) {
                        ids.push(notification.id)
                        localStorage.setItem(`qalami_read_${ctx.userId}`, JSON.stringify(ids))
                        setLocalReadIds(new Set(ids))
                    }
                }
            } else {
                await markAsRead(notification.id)
            }
            setNotifications(prev =>
                prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
            )
        }
        if (notification.action_url) {
            let url = notification.action_url
            if (url.startsWith('/announcements/')) {
                const id = url.split('/')[2]
                if (['admin', 'super_admin', 'school_staff'].includes(userRole)) {
                    url = '/admin/announcements'
                } else if (userRole === 'teacher') {
                    // Teacher has a specific detail page for community announcements
                    url = `/teacher/community/announcements/${id}`
                } else if (userRole === 'parent') {
                    url = '/parent/announcements'
                } else if (userRole === 'student') {
                    url = '/student/announcements'
                }
            } else if (url.startsWith('/document-requests/')) {
                if (['admin', 'super_admin', 'school_staff'].includes(userRole)) {
                    url = '/admin/requests'
                }
            }
            router.push(url)
            setIsOpen(false)
        }
    }

    const handleMarkAllRead = async () => {
        const ctx = userContextRef.current
        const virtualIds = notifications.filter(n => isVirtualNotification(n.id)).map(n => n.id)
        if (virtualIds.length > 0 && ctx) {
            const storedRead = localStorage.getItem(`qalami_read_${ctx.userId}`)
            const existing: string[] = storedRead ? JSON.parse(storedRead) : []
            const merged = [...new Set([...existing, ...virtualIds])]
            localStorage.setItem(`qalami_read_${ctx.userId}`, JSON.stringify(merged))
            setLocalReadIds(new Set(merged))
        }
        await markAllAsRead()
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    }

    const getIcon = (type: NotificationType) => {
        switch (type) {
            case 'success': return <CheckCircle className="w-4 h-4 text-emerald-500" />
            case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500" />
            case 'action': return <Activity className="w-4 h-4 text-blue-500" />
            default: return <Info className="w-4 h-4 text-cyan-500" />
        }
    }

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <Button
                variant="ghost"
                size="icon"
                className="relative rounded-full hover:bg-white/10"
                onClick={() => setIsOpen(!isOpen)}
            >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center shadow-lg shadow-red-500/50">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </Button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 top-12 w-80 md:w-96 bg-[#0D1117] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-white/10">
                        <h3 className="font-bold text-sm">{t('common.notifications')}</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-xs text-cyan-500 hover:underline flex items-center gap-1"
                            >
                                <CheckCheck className="w-3 h-3" /> {t('common.markAllRead')}
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {loading ? (
                            <div className="p-8 text-center text-gray-500">
                                <Bell className="w-8 h-8 mx-auto mb-2 animate-pulse" />
                                {t('common.loading')}
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                {t('common.noNotifications')}
                            </div>
                        ) : (
                            notifications.map(notification => {
                                const { title, message } = getLocalizedNotification(notification, t, language)
                                return (
                                    <div
                                        key={notification.id}
                                        onClick={() => handleNotificationClick(notification)}
                                        className={cn(
                                            "p-4 border-b border-white/5 cursor-pointer transition-colors hover:bg-white/5",
                                            !notification.is_read && "bg-cyan-500/5"
                                        )}
                                    >
                                        <div className="flex gap-3">
                                            <div className={cn(
                                                "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                                                notification.type === 'success' && "bg-emerald-500/10",
                                                notification.type === 'warning' && "bg-amber-500/10",
                                                notification.type === 'action' && "bg-blue-500/10",
                                                notification.type === 'info' && "bg-cyan-500/10"
                                            )}>
                                                {getIcon(notification.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2 mb-1">
                                                    <p className={cn(
                                                        "font-semibold text-sm truncate",
                                                        !notification.is_read && "text-white"
                                                    )}>{title}</p>
                                                    {!notification.is_read && (
                                                        <span className="h-2 w-2 rounded-full bg-cyan-500 shrink-0" />
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-400 line-clamp-2">{message}</p>
                                                <p className="text-[10px] text-gray-500 mt-1">
                                                    {formatNotificationTime(notification.created_at, t, language)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
