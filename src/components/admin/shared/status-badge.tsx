'use client'

import { cn } from '@/lib/utils'

export type ProfileStatus = 'active' | 'suspended' | 'inactive' | 'archived'

const statusConfig: Record<ProfileStatus, { label: string; className: string; dotColor: string }> = {
    active:    { label: 'Actif',    className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', dotColor: 'bg-emerald-500' },
    suspended: { label: 'Suspendu', className: 'bg-orange-500/10 text-orange-500 border-orange-500/20',   dotColor: 'bg-orange-500' },
    inactive:  { label: 'Inactif',  className: 'bg-gray-500/10 text-gray-400 border-gray-500/20',         dotColor: 'bg-gray-500' },
    archived:  { label: 'Archivé',  className: 'bg-red-500/10 text-red-400 border-red-500/20',            dotColor: 'bg-red-400' },
}

export function StatusBadge({ status, className }: { status: ProfileStatus | string; className?: string }) {
    const cfg = statusConfig[status as ProfileStatus] ?? statusConfig.inactive
    return (
        <span className={cn(
            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border',
            cfg.className,
            className
        )}>
            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', cfg.dotColor)} />
            {cfg.label}
        </span>
    )
}

export function StatusDot({ status }: { status: ProfileStatus | string }) {
    const cfg = statusConfig[status as ProfileStatus] ?? statusConfig.inactive
    return <span className={cn('h-2.5 w-2.5 rounded-full inline-block', cfg.dotColor)} />
}
