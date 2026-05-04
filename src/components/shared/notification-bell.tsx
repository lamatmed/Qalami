'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, CheckCheck, Info, AlertTriangle, CheckCircle, Activity } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import { markAsRead, markAllAsRead, formatNotificationTime, type Notification, type NotificationType } from '@/lib/notifications'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/i18n'

export function NotificationBell() {
    const supabase = createClient()
    const router = useRouter()
    const { t } = useLanguage()
    const [isOpen, setIsOpen] = useState(false)
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)
    const dropdownRef = useRef<HTMLDivElement>(null)

    const unreadCount = notifications.filter(n => !n.is_read).length

    // Fetch notifications
    useEffect(() => {
        const fetchNotifications = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(20)

            setNotifications(data ?? [])
            setLoading(false)
        }

        fetchNotifications()

        // Realtime subscription
        const channel = supabase
            .channel('notifications-realtime')
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'notifications' },
                (payload) => {
                    const newNotification = payload.new as Notification
                    setNotifications(prev => [newNotification, ...prev].slice(0, 20))
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

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.is_read) {
            await markAsRead(notification.id)
            setNotifications(prev =>
                prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
            )
        }
        if (notification.action_url) {
            router.push(notification.action_url)
            setIsOpen(false)
        }
    }

    const handleMarkAllRead = async () => {
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
                            notifications.map(notification => (
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
                                                )}>{notification.title}</p>
                                                {!notification.is_read && (
                                                    <span className="h-2 w-2 rounded-full bg-cyan-500 shrink-0" />
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-400 line-clamp-2">{notification.message}</p>
                                            <p className="text-[10px] text-gray-500 mt-1">
                                                {formatNotificationTime(notification.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
