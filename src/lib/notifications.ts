import { createClient } from '@/utils/supabase/client'

export type NotificationType = 'info' | 'success' | 'warning' | 'action'

export interface Notification {
    id: string
    user_id: string
    title: string
    message: string
    type: NotificationType
    action_url: string | null
    is_read: boolean
    created_at: string
    school_id?: string | null
    event_type?: string | null
}

/**
 * Send a notification to a user
 */
export async function sendNotification({
    userId,
    title,
    message,
    type = 'info',
    actionUrl
}: {
    userId: string
    title: string
    message: string
    type?: NotificationType
    actionUrl?: string
}): Promise<void> {
    const supabase = createClient()

    const { error } = await supabase.from('notifications').insert({
        user_id: userId,
        title,
        message,
        type,
        action_url: actionUrl ?? null
    })

    if (error) {
        console.error('Error sending notification:', error)
        throw error
    }
}

/**
 * Send notification to multiple users
 */
export async function sendBulkNotifications({
    userIds,
    title,
    message,
    type = 'info',
    actionUrl
}: {
    userIds: string[]
    title: string
    message: string
    type?: NotificationType
    actionUrl?: string
}): Promise<void> {
    const supabase = createClient()

    const notifications = userIds.map(userId => ({
        user_id: userId,
        title,
        message,
        type,
        action_url: actionUrl ?? null
    }))

    const { error } = await supabase.from('notifications').insert(notifications)

    if (error) {
        console.error('Error sending bulk notifications:', error)
        throw error
    }
}

/**
 * Mark a notification as read
 */
export async function markAsRead(notificationId: string): Promise<void> {
    const supabase = createClient()

    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)

    if (error) {
        console.error('Error marking notification as read:', error)
    }
}

/**
 * Mark all notifications as read for current user
 */
export async function markAllAsRead(): Promise<void> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

    if (error) {
        console.error('Error marking all as read:', error)
    }
}

/**
 * Get unread count for current user
 */
export async function getUnreadCount(): Promise<number> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return 0

    const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

    return count ?? 0
}

/**
 * Format notification time
 */
export function formatNotificationTime(dateStr: string, t?: any, language?: string): string {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = diffMs / (1000 * 60)
    const diffHours = diffMs / (1000 * 60 * 60)
    const diffDays = diffMs / (1000 * 60 * 60 * 24)

    const isAr = language === 'ar'

    if (diffMins < 1) {
        return isAr ? 'الآن' : 'À l\'instant'
    }
    if (diffMins < 60) {
        return isAr 
            ? `منذ ${Math.floor(diffMins)} دقيقة` 
            : `Il y a ${Math.floor(diffMins)} min`
    }
    if (diffHours < 24) {
        return isAr 
            ? `منذ ${Math.floor(diffHours)} ساعة` 
            : `Il y a ${Math.floor(diffHours)}h`
    }
    if (diffDays < 2) {
        return isAr ? 'أمس' : 'Hier'
    }
    if (diffDays < 7) {
        return isAr 
            ? `منذ ${Math.floor(diffDays)} أيام` 
            : `Il y a ${Math.floor(diffDays)} jours`
    }
    return date.toLocaleDateString(isAr ? 'ar-MR' : 'fr-FR', { day: 'numeric', month: 'short' })
}
