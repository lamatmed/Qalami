'use client'

import { useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
    UserPlus, UserMinus, ShieldCheck, KeyRound, CreditCard, DollarSign,
    Building2, RefreshCw, Loader2, ChevronLeft, ChevronRight, X,
    GraduationCap, BookOpen, Settings, Calendar, Users, FileText,
    Activity, Filter,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getActivityLogsAction, getActivityActorsAction } from '@/app/admin/activity/actions'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n'

interface LogEntry {
    id: string
    actor_id: string
    actor_name: string
    actor_role: string
    action: string
    entity_type: string
    entity_id: string
    details: string
    created_at: string
}

const ACTION_ICONS: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
    create_staff:          { icon: UserPlus,      color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    delete_staff:          { icon: UserMinus,     color: 'text-red-400',     bg: 'bg-red-500/10' },
    update_permissions:    { icon: ShieldCheck,   color: 'text-blue-400',    bg: 'bg-blue-500/10' },
    update_password:       { icon: KeyRound,      color: 'text-orange-400',  bg: 'bg-orange-500/10' },
    add_personnel:         { icon: UserPlus,      color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    delete_personnel:      { icon: UserMinus,     color: 'text-red-400',     bg: 'bg-red-500/10' },
    confirm_payroll:       { icon: CreditCard,    color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    save_fees:             { icon: DollarSign,    color: 'text-blue-400',    bg: 'bg-blue-500/10' },
    update_school:         { icon: Building2,     color: 'text-purple-400',  bg: 'bg-purple-500/10' },
    create_class:          { icon: GraduationCap, color: 'text-indigo-400',  bg: 'bg-indigo-500/10' },
    delete_class:          { icon: GraduationCap, color: 'text-red-400',     bg: 'bg-red-500/10' },
    update_class:          { icon: GraduationCap, color: 'text-blue-400',    bg: 'bg-blue-500/10' },
    assign_student:        { icon: Users,         color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    transfer_student:      { icon: Users,         color: 'text-orange-400',  bg: 'bg-orange-500/10' },
    bulk_import_students:  { icon: Users,         color: 'text-blue-400',    bg: 'bg-blue-500/10' },
    create_academic_year:  { icon: Calendar,      color: 'text-indigo-400',  bg: 'bg-indigo-500/10' },
    delete_academic_year:  { icon: Calendar,      color: 'text-red-400',     bg: 'bg-red-500/10' },
    set_current_year:      { icon: Calendar,      color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    create_teacher:        { icon: BookOpen,      color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    validate_reports:      { icon: FileText,      color: 'text-orange-400',  bg: 'bg-orange-500/10' },
    publish_reports:       { icon: FileText,      color: 'text-blue-400',    bg: 'bg-blue-500/10' },
    assign_parents:        { icon: Users,         color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    update_settings:       { icon: Settings,      color: 'text-gray-400',    bg: 'bg-gray-500/10' },
}

const ACTION_KEYS = Object.keys(ACTION_ICONS)

const PAGE_SIZE = 30

export function ActivityLog() {
    const { t, language } = useLanguage()
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [actors, setActors] = useState<{ id: string; full_name: string; role: string }[]>([])
    const [loading, setLoading] = useState(true)
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(0)

    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [actorId, setActorId] = useState('')
    const [action, setAction] = useState('')

    const fetchLogs = useCallback(async (p = page) => {
        setLoading(true)
        try {
            const result = await getActivityLogsAction({
                limit: PAGE_SIZE,
                offset: p * PAGE_SIZE,
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
                actorId: actorId || undefined,
                action: action || undefined,
            })
            if (result.error) { toast.error(result.error); return }
            setLogs(result.data as LogEntry[])
            setTotal(result.total)
        } finally {
            setLoading(false)
        }
    }, [page, dateFrom, dateTo, actorId, action])

    useEffect(() => {
        getActivityActorsAction().then(r => setActors((r.data as any[]) ?? []))
    }, [])

    useEffect(() => {
        setPage(0)
        fetchLogs(0)
    }, [dateFrom, dateTo, actorId, action])

    useEffect(() => {
        fetchLogs(page)
    }, [page])

    const clearFilters = () => {
        setDateFrom('')
        setDateTo('')
        setActorId('')
        setAction('')
    }

    const hasFilters = !!(dateFrom || dateTo || actorId || action)
    const totalPages = Math.ceil(total / PAGE_SIZE)
    const locale = language === 'ar' ? 'ar-MA' : 'fr-FR'

    const formatDate = (iso: string) => {
        return new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
    }
    const formatTime = (iso: string) => {
        return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    }

    const getActionLabel = (key: string) =>
        t(`admin.activity.actionLabels.${key}` as any) || key

    const getRoleLabel = (role: string) =>
        t(`admin.activity.roles.${role}` as any) || role

    const getMeta = (actionKey: string) =>
        ACTION_ICONS[actionKey] ?? { icon: Activity, color: 'text-gray-400', bg: 'bg-gray-500/10' }

    // Group logs by date
    const grouped: { date: string; entries: LogEntry[] }[] = []
    for (const log of logs) {
        const date = formatDate(log.created_at)
        const last = grouped[grouped.length - 1]
        if (last && last.date === date) {
            last.entries.push(log)
        } else {
            grouped.push({ date, entries: [log] })
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white flex items-center gap-2">
                        <Activity className="w-6 h-6 text-emerald-400" />
                        {t('admin.activity.title')}
                    </h1>
                    <p className="text-gray-400 text-sm mt-0.5">
                        {t('admin.activity.subtitle')}
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => fetchLogs(page)}
                    disabled={loading}
                    className="border-white/10 bg-[#161B22] text-gray-400 hover:text-white"
                >
                    <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
                    {t('admin.activity.refresh')}
                </Button>
            </div>

            {/* Filters */}
            <div className="bg-[#161B22] border border-white/5 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Filter className="w-4 h-4 text-gray-500" />
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        {t('admin.activity.filters')}
                    </span>
                    {hasFilters && (
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-md px-2 py-1"
                        >
                            <X className="w-3 h-3" /> {t('admin.activity.clearFilters')}
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        title="Date de début"
                        placeholder="Date de début"
                        className="bg-[#0D1117] border border-white/10 text-white text-sm rounded-lg h-9 px-3 focus:outline-none focus:border-emerald-500/50 [color-scheme:dark]"
                    />
                    <input
                        type="date"
                        value={dateTo}
                        min={dateFrom || undefined}
                        onChange={e => setDateTo(e.target.value)}
                        title="Date de fin"
                        placeholder="Date de fin"
                        className="bg-[#0D1117] border border-white/10 text-white text-sm rounded-lg h-9 px-3 focus:outline-none focus:border-emerald-500/50 [color-scheme:dark]"
                    />
                    <Select value={actorId || 'all'} onValueChange={v => setActorId(v === 'all' ? '' : v)}>
                        <SelectTrigger className="bg-[#0D1117] border-white/10 text-sm h-9">
                            <SelectValue placeholder={t('admin.activity.allAdmins')} />
                        </SelectTrigger>
                        <SelectContent className="bg-[#161B22] border-white/10 text-white">
                            <SelectItem value="all">{t('admin.activity.allAdmins')}</SelectItem>
                            {actors.map(a => (
                                <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={action || 'all'} onValueChange={v => setAction(v === 'all' ? '' : v)}>
                        <SelectTrigger className="bg-[#0D1117] border-white/10 text-sm h-9">
                            <SelectValue placeholder={t('admin.activity.allActions')} />
                        </SelectTrigger>
                        <SelectContent className="bg-[#161B22] border-white/10 text-white">
                            <SelectItem value="all">{t('admin.activity.allActions')}</SelectItem>
                            {ACTION_KEYS.map(key => (
                                <SelectItem key={key} value={key}>{getActionLabel(key)}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Stats bar */}
            <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-400">
                    <span className="text-white font-bold">{total}</span>{' '}
                    {t(total !== 1 ? 'admin.activity.totalPlural' : 'admin.activity.total').replace('{count}', String(total)).replace('{count} ', '')}
                </span>
                {hasFilters && (
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/5 text-xs">
                        {t('admin.activity.filtered')}
                    </Badge>
                )}
            </div>

            {/* Log list */}
            <div className="bg-[#161B22] border border-white/5 rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                        <Activity className="w-12 h-12 mb-3 opacity-20" />
                        <p className="font-medium">{t('admin.activity.noActivity')}</p>
                        <p className="text-sm">{t('admin.activity.noActivityDesc')}</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {grouped.map(({ date, entries }) => (
                            <div key={date}>
                                {/* Date separator */}
                                <div className="px-6 py-2 bg-[#0D1117]/60 flex items-center gap-3">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{date}</span>
                                    <div className="flex-1 h-px bg-white/5" />
                                    <span className="text-xs text-gray-600">
                                        {entries.length} {entries.length > 1 ? t('admin.activity.actions') : t('admin.activity.action')}
                                    </span>
                                </div>

                                {entries.map(log => {
                                    const meta = getMeta(log.action)
                                    const Icon = meta.icon
                                    return (
                                        <div key={log.id} className="px-6 py-4 flex items-start gap-4 hover:bg-white/[0.02] transition-colors">
                                            {/* Action icon */}
                                            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5', meta.bg)}>
                                                <Icon className={cn('w-4 h-4', meta.color)} />
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                                    <span className="font-bold text-white text-sm">{getActionLabel(log.action)}</span>
                                                    <Badge variant="secondary" className="bg-white/5 text-gray-400 border-0 text-[10px] px-1.5 py-0">
                                                        {getRoleLabel(log.actor_role)}
                                                    </Badge>
                                                </div>
                                                <p className="text-gray-400 text-sm">{log.details}</p>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="text-xs font-semibold text-gray-500">
                                                        {log.actor_name}
                                                    </span>
                                                    <span className="text-gray-700 text-xs">·</span>
                                                    <span className="text-xs text-gray-600 font-mono">{formatTime(log.created_at)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                        {t('admin.activity.page')
                            .replace('{current}', String(page + 1))
                            .replace('{total}', String(totalPages))}
                    </span>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page === 0}
                            onClick={() => setPage(p => p - 1)}
                            className="border-white/10 bg-[#161B22] text-gray-400 hover:text-white"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page >= totalPages - 1}
                            onClick={() => setPage(p => p + 1)}
                            className="border-white/10 bg-[#161B22] text-gray-400 hover:text-white"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
