'use client'

import { motion } from 'framer-motion'
import { UserPlus, Copy, Send, Clock, CheckCircle2, AlertTriangle, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InviteUserDialog } from '@/components/admin/invite-user-dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/i18n'
import { formatDate } from '@/utils/locale'

interface Invitation {
    id: string
    full_name: string
    email: string
    role: string
    phone?: string | null
    token: string
    status: string
    created_at: string
    expires_at: string
    completed_at?: string | null
}

const roleColors: Record<string, string> = {
    student: 'bg-blue-500/10 text-blue-500',
    parent: 'bg-purple-500/10 text-purple-500',
    teacher: 'bg-emerald-500/10 text-emerald-500',
}

export function InvitationsPageClient({ invitations }: { invitations: Invitation[] }) {
    const { t, language } = useLanguage()

    const roleLabels: Record<string, string> = {
        student: t('common.student'),
        parent: t('common.parent'),
        teacher: t('common.teacher'),
    }

    const statusConfig: Record<string, { icon: typeof CheckCircle2, color: string, label: string }> = {
        pending: { icon: Clock, color: 'text-amber-500', label: t('common.pending') },
        completed: { icon: CheckCircle2, color: 'text-emerald-500', label: t('auth.completed') },
        expired: { icon: AlertTriangle, color: 'text-red-400', label: t('auth.expired') },
    }

    function handleCopy(token: string) {
        const link = `${window.location.origin}/invite/${token}`
        navigator.clipboard.writeText(link)
        toast.success(t('auth.linkCopied'))
    }

    function handleWhatsApp(inv: Invitation) {
        const link = `${window.location.origin}/invite/${inv.token}`
        const message = t('auth.whatsAppMessage', { name: inv.full_name, role: roleLabels[inv.role] || inv.role }) + `\n${link}`
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <InviteUserDialog>
                    <Button>
                        <UserPlus className="h-4 w-4 me-2" />
                        {t('auth.inviteUser')}
                    </Button>
                </InviteUserDialog>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                    { label: t('common.total'), value: invitations.length, icon: Users, color: 'text-primary' },
                    { label: t('common.pending'), value: invitations.filter(i => i.status === 'pending').length, icon: Clock, color: 'text-amber-500' },
                    { label: t('auth.completed'), value: invitations.filter(i => i.status === 'completed').length, icon: CheckCircle2, color: 'text-emerald-500' },
                ].map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="p-4 rounded-xl bg-card border border-border/50"
                    >
                        <div className="flex items-center gap-3">
                            <stat.icon className={cn("w-5 h-5", stat.color)} />
                            <div>
                                <p className="text-2xl font-bold">{stat.value}</p>
                                <p className="text-xs text-muted-foreground">{stat.label}</p>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Invitations List */}
            {invitations.length === 0 ? (
                <div className="text-center py-16">
                    <UserPlus className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground">{t('auth.noInvitations')}</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">
                        {t('auth.inviteUserDesc')}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {invitations.map((inv, i) => {
                        const status = statusConfig[inv.status] || statusConfig.pending
                        const StatusIcon = status.icon
                        return (
                            <motion.div
                                key={inv.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="p-4 rounded-xl bg-card border border-border/50 hover:border-border transition-colors"
                            >
                                <div className="flex items-center justify-between gap-4 flex-wrap">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shrink-0">
                                            {inv.full_name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-medium text-foreground truncate">{inv.full_name}</p>
                                            <p className="text-xs text-muted-foreground truncate">{inv.email}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 flex-wrap">
                                        <span className={cn("text-xs font-medium px-2 py-1 rounded-full", roleColors[inv.role] || 'bg-muted text-muted-foreground')}>
                                            {roleLabels[inv.role] || inv.role}
                                        </span>
                                        <span className={cn("flex items-center gap-1 text-xs font-medium", status.color)}>
                                            <StatusIcon className="w-3.5 h-3.5" />
                                            {status.label}
                                        </span>

                                        {inv.status === 'pending' && (
                                            <div className="flex gap-1">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleCopy(inv.token)}
                                                    className="h-8 w-8 p-0"
                                                >
                                                    <Copy className="w-3.5 h-3.5" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleWhatsApp(inv)}
                                                    className="h-8 w-8 p-0 text-green-500 hover:text-green-600"
                                                >
                                                    <Send className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-2 text-xs text-muted-foreground/70 ltr-content">
                                    {formatDate(inv.created_at, language)}
                                    {inv.completed_at && (
                                        <> • {formatDate(inv.completed_at, language)}</>
                                    )}
                                </div>
                            </motion.div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
