'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
    UserPlus,
    Trash2,
    Shield,
    Clock,
    KeyRound,
    User,
    CheckSquare2,
    Square,
    Activity,
    Users,
    ChevronDown,
    ChevronUp,
    ShieldCheck,
    RefreshCw,
    Eye,
    EyeOff
} from 'lucide-react'

const COUNTRY_CODES = [
    { code: '+222', flag: '🇲🇷', name: 'Mauritanie' },
    { code: '+221', flag: '🇸🇳', name: 'Sénégal' },
    { code: '+223', flag: '🇲🇱', name: 'Mali' },
    { code: '+212', flag: '🇲🇦', name: 'Maroc' },
    { code: '+213', flag: '🇩🇿', name: 'Algérie' },
    { code: '+216', flag: '🇹🇳', name: 'Tunisie' },
    { code: '+33', flag: '🇫🇷', name: 'France' },
    { code: '+1', flag: '🇺🇸', name: 'USA' },
]
import { useLanguage } from '@/i18n'
import {
    getStaffUsers, createStaffUser, updateStaffPermissions,
    deleteStaffUser, getActivityLogs, adminUpdateUserPassword, type Permission
} from '@/app/admin/users/actions'

const ALL_PERMISSIONS: { key: Permission; label: string; icon: string }[] = [
    { key: 'students', label: 'Élèves', icon: '👨‍🎓' },
    { key: 'teachers', label: 'Enseignants', icon: '👩‍🏫' },
    { key: 'parents', label: 'Parents', icon: '👪' },
    { key: 'employees', label: 'Personnel', icon: '💼' },
    { key: 'classes', label: 'Classes', icon: '🏫' },
    { key: 'schedule', label: 'Emploi du temps', icon: '🗓️' },
    { key: 'attendance', label: 'Présences', icon: '✅' },
    { key: 'reports', label: 'Bulletins', icon: '📋' },
    { key: 'finance', label: 'Comptabilité', icon: '💰' },
    { key: 'announcements', label: 'Annonces & Événements', icon: '📢' },
    { key: 'requests', label: 'Demandes', icon: '📥' },
    { key: 'settings', label: 'Paramètres', icon: '⚙️' },
    { key: 'users', label: 'Utilisateurs', icon: '👤' },
]

interface StaffUser {
    id: string
    full_name: string
    phone: string
    role: string
    position: string | null
    status: string
    first_login: boolean
    created_at: string
    permissions: Permission[]
}

interface ActivityLog {
    id: string
    actor_id: string
    action: string
    entity_type: string
    details: string
    created_at: string
    profiles: { full_name: string; phone?: string | null; role?: string | null } | null
}

type TabType = 'users' | 'logs'

export function UsersManagement() {
    const { t } = useLanguage()
    const [tab, setTab] = useState<TabType>('users')
    const [users, setUsers] = useState<StaffUser[]>([])
    const [logs, setLogs] = useState<ActivityLog[]>([])
    const [loading, setLoading] = useState(true)
    const [logsLoading, setLogsLoading] = useState(false)
    const [showCreate, setShowCreate] = useState(false)
    const [expandedUser, setExpandedUser] = useState<string | null>(null)
    const [savingPerms, setSavingPerms] = useState<string | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [editPerms, setEditPerms] = useState<Record<string, Permission[]>>({})

    const [form, setForm] = useState({ fullName: '', phone: '', password: '' })
    const [countryCode, setCountryCode] = useState(COUNTRY_CODES[0])
    const [showCountryDropdown, setShowCountryDropdown] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [newPerms, setNewPerms] = useState<Permission[]>([])
    const [creating, setCreating] = useState(false)

    const [changePwdUser, setChangePwdUser] = useState<StaffUser | null>(null)
    const [newPwd, setNewPwd] = useState('')
    const [showNewPwd, setShowNewPwd] = useState(false)
    const [changingPwd, setChangingPwd] = useState(false)

    useEffect(() => {
        loadUsers()
    }, [])

    useEffect(() => {
        if (tab === 'logs' && logs.length === 0) loadLogs()
    }, [tab])

    async function loadUsers() {
        setLoading(true)
        const result = await getStaffUsers()
        if (result.error) toast.error(result.error)
        else {
            setUsers(result.data || [])
            const initialPerms: Record<string, Permission[]> = {}
            for (const u of result.data || []) {
                initialPerms[u.id] = [...u.permissions]
            }
            setEditPerms(initialPerms)
        }
        setLoading(false)
    }

    async function loadLogs() {
        setLogsLoading(true)
        const result = await getActivityLogs(100)
        if (result.error) toast.error(result.error)
        else setLogs(result.data as ActivityLog[])
        setLogsLoading(false)
    }

    async function handleCreate() {
        setCreating(true)
        const fullPhone = countryCode.code + form.phone.replace(/^0+/, '')
        const result = await createStaffUser({ ...form, phone: fullPhone, permissions: newPerms })
        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success(t('admin.users.savedSuccess'))
            setShowCreate(false)
            setForm({ fullName: '', phone: '', password: '' })
            setCountryCode(COUNTRY_CODES[0])
            setNewPerms([])
            loadUsers()
        }
        setCreating(false)
    }

    async function handleSavePerms(userId: string) {
        setSavingPerms(userId)
        const result = await updateStaffPermissions(userId, editPerms[userId] || [])
        if (result.error) toast.error(result.error)
        else toast.success(t('admin.users.permissionsUpdated'))
        setSavingPerms(null)
    }

    async function handleDelete(userId: string) {
        if (!confirm(t('admin.users.confirmDelete'))) return
        setDeletingId(userId)
        const result = await deleteStaffUser(userId)
        if (result.error) toast.error(result.error)
        else {
            toast.success(t('admin.users.userDeleted'))
            loadUsers()
        }
        setDeletingId(null)
    }

    async function handleChangePassword() {
        if (!changePwdUser) return
        if (newPwd.trim().length < 6) {
            toast.error(t('admin.users.passwordMinLength'))
            return
        }
        setChangingPwd(true)
        const result = await adminUpdateUserPassword(changePwdUser.id, newPwd.trim())
        setChangingPwd(false)
        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success(t('admin.users.passwordUpdated'))
            setChangePwdUser(null)
            setNewPwd('')
            setShowNewPwd(false)
        }
    }

    const togglePerm = (perms: Permission[], perm: Permission): Permission[] =>
        perms.includes(perm) ? perms.filter(p => p !== perm) : [...perms, perm]

    return (
        <>
        <div className="space-y-6">
            <div className="flex justify-end">
                <Button
                    onClick={() => setShowCreate(true)}
                    className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-xl"
                >
                    <UserPlus className="w-4 h-4 mr-2" /> {t('admin.users.addUser')}
                </Button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 dark:bg-[#1A2530] p-1 rounded-xl w-fit">
                <button
                    onClick={() => setTab('users')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'users' ? 'bg-white dark:bg-[#0F1720] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <Users className="w-4 h-4" /> {t('admin.users.users')}
                </button>
                <button
                    onClick={() => setTab('logs')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'logs' ? 'bg-white dark:bg-[#0F1720] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <Activity className="w-4 h-4" /> {t('admin.users.activityLog')}
                </button>
            </div>

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
                    <div className="bg-white dark:bg-[#0F1720] border border-gray-200 dark:border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                                <UserPlus className="w-5 h-5 text-emerald-500" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('admin.users.newUser')}</h2>
                                <p className="text-xs text-gray-400">{t('admin.users.newUserDesc')}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>{t('admin.users.fullName')}</Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                    <Input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                                        placeholder={t('admin.users.fullNamePlaceholder')}
                                        className="pl-9 bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>{t('admin.users.phone')}</Label>
                                <div className="relative flex">
                                    {/* Country code selector */}
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setShowCountryDropdown(v => !v)}
                                            className="h-10 flex items-center gap-1.5 px-3 bg-gray-50 dark:bg-[#1A2530] border border-gray-200 dark:border-white/5 rounded-l-lg border-r-0 text-sm font-medium hover:bg-gray-100 dark:hover:bg-[#23303d] transition-colors"
                                        >
                                            <span className="text-base leading-none">{countryCode.flag}</span>
                                            <span className="text-xs text-gray-500">{countryCode.code}</span>
                                            <ChevronDown className="w-3 h-3 text-gray-400" />
                                        </button>
                                        {showCountryDropdown && (
                                            <>
                                                <div className="fixed inset-0 z-20" onClick={() => setShowCountryDropdown(false)} />
                                                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-[#1A2530] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-30 py-1 min-w-[190px] max-h-48 overflow-y-auto">
                                                    {COUNTRY_CODES.map(cc => (
                                                        <button
                                                            key={cc.code}
                                                            type="button"
                                                            onClick={() => { setCountryCode(cc); setShowCountryDropdown(false) }}
                                                            className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${cc.code === countryCode.code ? 'bg-gray-50 dark:bg-white/5 font-medium' : ''}`}
                                                        >
                                                            <span className="text-base">{cc.flag}</span>
                                                            <span className="text-gray-800 dark:text-gray-200">{cc.name}</span>
                                                            <span className="text-gray-400 ml-auto text-xs">{cc.code}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <Input
                                        type="tel"
                                        value={form.phone}
                                        onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                                        placeholder="36 12 34 56"
                                        dir="ltr"
                                        className="rounded-l-none bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5 flex-1"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>{t('admin.users.password')}</Label>
                                <div className="relative">
                                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <Input
                                        type={showPassword ? 'text' : 'password'}
                                        value={form.password}
                                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                        placeholder={t('admin.users.passwordPlaceholder')}
                                        className="pl-9 pr-10 bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(v => !v)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                <p className="text-[11px] text-gray-400 italic">{t('admin.users.passwordDesc')}</p>
                            </div>

                            {/* Permissions */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>{t('admin.users.permissionsLabel')}</Label>
                                    <button
                                        type="button"
                                        onClick={() => setNewPerms(newPerms.length === ALL_PERMISSIONS.length ? [] : ALL_PERMISSIONS.map(p => p.key))}
                                        className="text-xs text-emerald-500 hover:text-emerald-600 font-medium"
                                    >
                                        {newPerms.length === ALL_PERMISSIONS.length ? t('admin.users.deselectAll') : t('admin.users.selectAll')}
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {ALL_PERMISSIONS.map(p => (
                                        <button
                                            key={p.key}
                                            type="button"
                                            onClick={() => setNewPerms(prev => togglePerm(prev, p.key))}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${newPerms.includes(p.key)
                                                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-400'
                                                : 'bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5 text-gray-500'}`}
                                        >
                                            {newPerms.includes(p.key)
                                                ? <CheckSquare2 className="w-3.5 h-3.5 shrink-0" />
                                                : <Square className="w-3.5 h-3.5 shrink-0" />}
                                            <span className="truncate">{t('admin.users.permissions.' + p.key)}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <Button variant="outline" className="flex-1 dark:border-white/10" onClick={() => setShowCreate(false)}>
                                {t('admin.users.cancel')}
                            </Button>
                            <Button
                                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-bold"
                                onClick={handleCreate}
                                disabled={creating || !form.fullName.trim() || !form.phone.trim() || !form.password.trim()}
                            >
                                {creating ? t('admin.users.creating') : t('admin.users.create')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Users Tab */}
            {tab === 'users' && (
                <div className="space-y-3">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="w-16 h-16 bg-gray-100 dark:bg-[#1A2530] rounded-full flex items-center justify-center mx-auto mb-4">
                                <Users className="w-8 h-8 text-gray-400" />
                            </div>
                            <p className="text-gray-500 font-medium">{t('admin.users.noStaffUser')}</p>
                            <p className="text-gray-400 text-sm mt-1">{t('admin.users.noStaffUserDesc')}</p>
                        </div>
                    ) : (
                        users.map(u => (
                            <div key={u.id} className="bg-white dark:bg-[#0F1720] border border-gray-200 dark:border-white/5 rounded-2xl overflow-hidden">
                                {/* User row */}
                                <div className="flex items-center gap-4 p-4">
                                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center shrink-0">
                                        <span className="text-emerald-600 font-bold text-sm">
                                            {u.full_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold text-gray-900 dark:text-white truncate">{u.full_name}</p>
                                            <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-bold shrink-0">
                                                {u.position ?? (u.role === 'school_staff' ? 'Staff' : u.role === 'admin' ? 'Admin' : u.role)}
                                            </span>
                                            {u.first_login && (
                                                <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium shrink-0">
                                                    {t('admin.users.firstLogin')}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500" dir="ltr">{u.phone}</p>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {u.permissions.slice(0, 4).map(p => {
                                                return (
                                                    <span key={p} className="text-[10px] bg-gray-100 dark:bg-[#1A2530] text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded">
                                                        {t('admin.users.permissions.' + p)}
                                                    </span>
                                                )
                                            })}
                                            {u.permissions.length > 4 && (
                                                <span className="text-[10px] text-gray-400">+{u.permissions.length - 4}</span>
                                            )}
                                            {u.permissions.length === 0 && (
                                                <span className="text-[10px] text-gray-400 italic">{t('admin.users.noPermission')}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)}
                                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1A2530] text-gray-500 transition-colors"
                                            title={t('admin.users.modifyPermissions')}
                                        >
                                            <Shield className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => { setChangePwdUser(u); setNewPwd(''); setShowNewPwd(false) }}
                                            className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 text-gray-400 hover:text-blue-500 transition-colors"
                                            title={t('admin.users.changePassword')}
                                        >
                                            <KeyRound className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(u.id)}
                                            disabled={deletingId === u.id}
                                            className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                            title={t('admin.users.delete')}
                                        >
                                            {deletingId === u.id
                                                ? <RefreshCw className="w-4 h-4 animate-spin" />
                                                : <Trash2 className="w-4 h-4" />}
                                        </button>
                                        <button
                                            onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)}
                                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1A2530] text-gray-400 transition-colors"
                                        >
                                            {expandedUser === u.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded permissions editor */}
                                {expandedUser === u.id && (
                                    <div className="border-t border-gray-100 dark:border-white/5 p-4 bg-gray-50 dark:bg-[#0A1018]">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('admin.users.permissionsLabel')}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const all = ALL_PERMISSIONS.map(p => p.key)
                                                    const current = editPerms[u.id] || []
                                                    setEditPerms(prev => ({
                                                        ...prev,
                                                        [u.id]: current.length === ALL_PERMISSIONS.length ? [] : all
                                                    }))
                                                }}
                                                className="text-xs text-emerald-500 hover:text-emerald-600 font-medium"
                                            >
                                                {(editPerms[u.id] || []).length === ALL_PERMISSIONS.length ? t('admin.users.deselectAll') : t('admin.users.selectAll')}
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                                            {ALL_PERMISSIONS.map(p => {
                                                const active = (editPerms[u.id] || []).includes(p.key)
                                                return (
                                                    <button
                                                        key={p.key}
                                                        type="button"
                                                        onClick={() => setEditPerms(prev => ({
                                                            ...prev,
                                                            [u.id]: togglePerm(prev[u.id] || [], p.key)
                                                        }))}
                                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${active
                                                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-400'
                                                            : 'bg-white dark:bg-[#1A2530] border-gray-200 dark:border-white/5 text-gray-500'}`}
                                                    >
                                                        {active
                                                            ? <CheckSquare2 className="w-3.5 h-3.5 shrink-0" />
                                                            : <Square className="w-3.5 h-3.5 shrink-0" />}
                                                        <span className="truncate">{t('admin.users.permissions.' + p.key)}</span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                        <Button
                                            onClick={() => handleSavePerms(u.id)}
                                            disabled={savingPerms === u.id}
                                            className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-xl h-9 text-sm"
                                        >
                                            {savingPerms === u.id ? t('admin.users.saving') : t('admin.users.savePermissions')}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Logs Tab */}
            {tab === 'logs' && (
                <div>
                    {logsLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-16">
                            <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500 font-medium">{t('admin.users.noActivity')}</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {logs.map(log => {
                                const actor = log.profiles as any
                                const actorName = actor?.full_name || 'Inconnu'
                                const actorPhone = actor?.phone as string | undefined
                                const actorRole = actor?.role as string | undefined
                                const initials = actorName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                                const roleLabel = actorRole === 'admin' ? 'Admin' : actorRole === 'school_staff' ? 'Staff' : actorRole === 'super_admin' ? 'Super Admin' : actorRole || ''
                                return (
                                    <div key={log.id} className="flex items-start gap-3 bg-white dark:bg-[#0F1720] border border-gray-200 dark:border-white/5 rounded-xl p-4">
                                        {/* Avatar initiales */}
                                        <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/20">
                                            <span className="text-xs font-black text-emerald-500">{initials}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            {/* Acteur : nom + tel + rôle */}
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <span className="text-sm font-bold text-gray-900 dark:text-white">{actorName}</span>
                                                {actorPhone && (
                                                    <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full" dir="ltr">
                                                        {actorPhone}
                                                    </span>
                                                )}
                                                {roleLabel && (
                                                    <span className="text-[10px] font-bold text-gray-500 bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-full uppercase">
                                                        {roleLabel}
                                                    </span>
                                                )}
                                            </div>
                                            {/* Action */}
                                            <p className="text-sm text-gray-700 dark:text-gray-200">{log.details}</p>
                                            {/* Date */}
                                            <span className="text-xs text-gray-400 mt-1 block">
                                                {new Date(log.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <span className="text-[10px] bg-gray-100 dark:bg-[#1A2530] text-gray-500 px-2 py-0.5 rounded shrink-0 mt-0.5 whitespace-nowrap">
                                            {t(`admin.activity.actionLabels.${log.action}`) || log.action}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Change password modal */}
        {changePwdUser && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => !changingPwd && setChangePwdUser(null)}>
                <div className="bg-white dark:bg-[#0F1720] border border-gray-200 dark:border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                            <KeyRound className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-gray-900 dark:text-white">{t('admin.users.changePassword')}</h2>
                            <p className="text-xs text-gray-400 truncate max-w-[200px]">{changePwdUser.full_name}</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-sm text-gray-600 dark:text-gray-400">{t('admin.users.password')}</Label>
                        <div className="relative">
                            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                type={showNewPwd ? 'text' : 'password'}
                                value={newPwd}
                                onChange={e => setNewPwd(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleChangePassword() }}
                                placeholder={t('admin.users.passwordPlaceholder')}
                                autoFocus
                                className="pl-9 pr-10 bg-gray-50 dark:bg-[#1A2530] border-gray-200 dark:border-white/5"
                            />
                            <button
                                type="button"
                                onClick={() => setShowNewPwd(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                tabIndex={-1}
                            >
                                {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        <p className="text-[11px] text-gray-400">{t('admin.users.passwordMinLength')}</p>
                    </div>

                    <div className="flex gap-3 mt-5">
                        <Button
                            variant="outline"
                            className="flex-1 dark:border-white/10"
                            onClick={() => setChangePwdUser(null)}
                            disabled={changingPwd}
                        >
                            {t('admin.users.cancel')}
                        </Button>
                        <Button
                            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold"
                            onClick={handleChangePassword}
                            disabled={changingPwd || newPwd.trim().length < 6}
                        >
                            {changingPwd ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
                            {changingPwd ? t('admin.users.saving') : t('admin.users.changePassword')}
                        </Button>
                    </div>
                </div>
            </div>
        )}
        </>
    )
}
