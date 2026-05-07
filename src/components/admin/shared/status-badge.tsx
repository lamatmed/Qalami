'use client'

import { cn } from '@/lib/utils'
import { useLanguage } from '@/i18n'

export type ProfileStatus = 'active' | 'suspended' | 'inactive' | 'archived'

const statusConfig: Record<ProfileStatus, { labelKey: string; className: string; dotColor: string }> = {
    active: { labelKey: 'admin.students.statusActive', className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', dotColor: 'bg-emerald-500' },
    suspended: { labelKey: 'admin.students.statusSuspended', className: 'bg-orange-500/10 text-orange-500 border-orange-500/20', dotColor: 'bg-orange-500' },
    inactive: { labelKey: 'admin.students.statusInactive', className: 'bg-gray-500/10 text-gray-400 border-gray-500/20', dotColor: 'bg-gray-500' },
    archived: { labelKey: 'admin.students.statusArchived', className: 'bg-red-500/10 text-red-400 border-red-500/20', dotColor: 'bg-red-400' },
}

export function StatusBadge({ status, className }: { status: ProfileStatus | string; className?: string }) {
    const { t } = useLanguage()
    const cfg = statusConfig[status as ProfileStatus] ?? statusConfig.inactive
    return (
        <span className={cn(
            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border',
            cfg.className,
            className
        )}>
            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', cfg.dotColor)} />
            {t(cfg.labelKey)}
        </span>
    )
}

export function StatusDot({ status }: { status: ProfileStatus | string }) {
    const cfg = statusConfig[status as ProfileStatus] ?? statusConfig.inactive
    return <span className={cn('h-2.5 w-2.5 rounded-full inline-block', cfg.dotColor)} />
}
