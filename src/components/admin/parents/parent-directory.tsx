'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Plus, Phone, User, X, Loader2, ShieldAlert } from 'lucide-react'
import { StatusBadge } from '@/components/admin/shared/status-badge'
import { ChangeStatusDialog } from '@/components/admin/shared/change-status-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { ParentProfile } from './parent-profile'
import { Label } from '@/components/ui/label'

import { createClient } from '@/utils/supabase/client'
import { useLanguage } from '@/i18n'
import { toast } from 'sonner'
import { getMySchoolContext } from '@/app/admin/actions'

interface Child {
    id: string
    name: string
    avatar: string | null
}

interface Parent {
    id: string
    name: string
    phone: string | null
    status: string
    address: string | null
    children: Child[]
    childrenCount: number
    avatar_url: string | null
}

export function ParentDirectory() {

    const [filter, setFilter] = useState('tous')
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedParent, setSelectedParent] = useState<Parent | null>(null)
    const [parents, setParents] = useState<Parent[]>([])
    const [loading, setLoading] = useState(true)
    const [showAddForm, setShowAddForm] = useState(false)
    const [statusDialog, setStatusDialog] = useState<{ open: boolean; parent: Parent | null }>({ open: false, parent: null })
    const [addingParent, setAddingParent] = useState(false)
    const [newParent, setNewParent] = useState({ firstName: '', lastName: '', phone: '', email: '', password: '' })
    const { t } = useLanguage()

    const fetchParents = async () => {
        setLoading(true)
        const ctx = await getMySchoolContext()
        if (!ctx) { setLoading(false); return }
        const adminProfile = { school_id: ctx.school_id }
        const supabase = createClient()

        const { data: parentProfiles, error } = await supabase
            .from('profiles')
            .select('id, full_name, email, phone, avatar_url, status, address')
            .eq('role', 'parent')
            .eq('school_id', adminProfile.school_id)
            .order('full_name')

        if (error) { setLoading(false); return }

        const parentIds = (parentProfiles || []).map(p => p.id)
        if (!parentIds.length) { setParents([]); setLoading(false); return }

        // Batch fetch all children links in one query (fixes N+1)
        const { data: allLinks } = await supabase
            .from('parent_student_links')
            .select(`
                parent_id,
                students:profiles!parent_student_links_student_id_fkey (
                    id, full_name, avatar_url
                )
            `)
            .in('parent_id', parentIds)

        const linksByParent = new Map<string, Child[]>()
        ;(allLinks || []).forEach((link: any) => {
            const list = linksByParent.get(link.parent_id) || []
            list.push({
                id: link.students?.id || '',
                name: link.students?.full_name?.split(' ')[0] || 'Enfant',
                avatar: link.students?.avatar_url || null,
            })
            linksByParent.set(link.parent_id, list)
        })

        const parentsData = (parentProfiles || []).map(profile => {
            const children = linksByParent.get(profile.id) || []
            return {
                id: profile.id,
                name: profile.full_name || 'Parent',
                phone: profile.phone || 'Non renseigné',
                status: (profile as any).status || 'active',
                address: (profile as any).address || null,
                children,
                childrenCount: children.length,
                avatar_url: profile.avatar_url,
            }
        })

        setParents(parentsData)
        setLoading(false)
    }

    const handleAddParent = async () => {
        if (!newParent.firstName || !newParent.lastName) {
            toast.error(t('admin.parents.firstNameRequired'))
            return
        }
        if (!newParent.password.trim()) {
            toast.error(t('admin.parents.passwordRequired'))
            return
        }
        setAddingParent(true)
        try {
            const { createParent } = await import('@/app/auth/actions')
            const result = await createParent({
                firstName: newParent.firstName,
                lastName: newParent.lastName,
                phone: newParent.phone || undefined,
                email: newParent.email || undefined,
                password: newParent.password || undefined,
            })

            if (result.error) {
                toast.error(result.error)
                return
            }

            if (result.success && result.credentials) {
                const cred = result.credentials
                toast.success(t('admin.parents.parentAddedSuccess', { name: cred.fullName }), {
                    description: t('admin.parents.passwordIs', { password: cred.password }),
                    duration: 10000
                })
            }

            setShowAddForm(false)
            setNewParent({ firstName: '', lastName: '', phone: '', email: '', password: '' })
            await fetchParents()
        } catch (err: any) {
            toast.error(t('admin.parents.addParentError'), { description: err.message })
        } finally {
            setAddingParent(false)
        }
    }

    useEffect(() => { fetchParents() }, [])

    const STATUS_FILTER_MAP: Record<string, string> = { actif: 'active', inactif: 'inactive' }
    const filteredParents = parents.filter(parent => {
        const filterStatus = STATUS_FILTER_MAP[filter] ?? filter
        const matchesFilter = filter === 'tous' || parent.status === filterStatus
        const matchesSearch = parent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (parent.phone || '').includes(searchQuery)
        return matchesFilter && matchesSearch
    })

    return (
        <div className="flex flex-col gap-6">
            {/* Parent Directory */}
            {(
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Directory List Column */}
                    <div className={cn("flex flex-col gap-4 lg:col-span-4", selectedParent ? "hidden lg:flex" : "flex")}>
                        {/* Search & Filters */}
                        <div className="space-y-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <Input
                                    placeholder={t('admin.parents.searchPlaceholder')}
                                    className="bg-[#161B22] border-white/5 pl-9 text-white placeholder:text-gray-600 focus-visible:ring-emerald-500/50"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                                {['tous', 'actif', 'inactif'].map((status) => (
                                    <button
                                        key={status}
                                        onClick={() => setFilter(status)}
                                        className={cn(
                                            "px-3 py-1.5 rounded-full text-xs font-medium capitalize whitespace-nowrap transition-colors",
                                            filter === status
                                                ? "bg-emerald-500 text-black"
                                                : "bg-[#161B22] text-gray-400 border border-white/5 hover:bg-white/5"
                                        )}
                                    >
                                        {status === 'tous' ? t('common.all') : status === 'actif' ? t('admin.parents.filterActive') : t('admin.parents.filterInactive')}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* List */}
                        <div className="pr-2 space-y-3">
                            {filteredParents.map((parent) => (
                                <div
                                    key={parent.id}
                                    onClick={() => setSelectedParent(parent)}
                                    className={cn(
                                        "group p-3 rounded-xl bg-[#161B22] border transition-all cursor-pointer relative overflow-hidden",
                                        selectedParent?.id === parent.id
                                            ? "border-emerald-500/50 bg-emerald-500/5 shadow-[0_0_15px_-3px_rgba(16,185,129,0.1)]"
                                            : "border-white/5 hover:border-emerald-500/30"
                                    )}
                                >
                                    <div className="flex items-start gap-3">
                                        <Avatar className="w-10 h-10 border border-white/10">
                                            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${parent.name}`} />
                                            <AvatarFallback>{parent.name.substring(0, 2)}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{parent.name}</h3>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <StatusBadge status={parent.status} />
                                                    <button
                                                        className="text-gray-500 hover:text-orange-400 transition-colors"
                                                        title="Changer le statut"
                                                        onClick={(e) => { e.stopPropagation(); setStatusDialog({ open: true, parent }) }}
                                                    >
                                                        <ShieldAlert className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-500">
                                                <Phone className="w-3 h-3" />
                                                <span className="ltr-content">{parent.phone}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-3 flex items-center justify-between pl-13">
                                        <div className="flex items-center gap-2">
                                            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">{t('admin.parents.linkedStudents')}</p>
                                            <div className="flex -space-x-2">
                                                {parent.children.slice(0, 3).map((child, i) => (
                                                    <Avatar key={child.id} className="w-5 h-5 border border-[#161B22]">
                                                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${child.name}`} />
                                                        <AvatarFallback className="text-[8px]">{child.name[0]}</AvatarFallback>
                                                    </Avatar>
                                                ))}
                                                {parent.childrenCount > 3 && (
                                                    <div className="w-5 h-5 rounded-full bg-gray-700 border border-[#161B22] flex items-center justify-center text-[8px] text-white">
                                                        +{parent.childrenCount - 3}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <Button
                                className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold mt-4"
                                onClick={() => setShowAddForm(true)}
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('admin.parents.addParent')}
                            </Button>

                            {/* Add Parent Modal */}
                            {showAddForm && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAddForm(false)}>
                                    <div className="bg-[#1A2530] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="text-lg font-bold text-white">{t('admin.parents.addParent')}</h3>
                                            <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-white">
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-gray-400">{t('admin.parents.firstName')}</Label>
                                                    <Input
                                                        placeholder={t('admin.parents.firstNamePlaceholder')}
                                                        value={newParent.firstName}
                                                        onChange={(e) => setNewParent(p => ({ ...p, firstName: e.target.value }))}
                                                        className="bg-[#0D1117] border-white/10 text-white h-10"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-gray-400">{t('admin.parents.lastName')}</Label>
                                                    <Input
                                                        placeholder={t('admin.parents.lastNamePlaceholder')}
                                                        value={newParent.lastName}
                                                        onChange={(e) => setNewParent(p => ({ ...p, lastName: e.target.value }))}
                                                        className="bg-[#0D1117] border-white/10 text-white h-10"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs text-gray-400">{t('admin.parents.phoneLabel')}</Label>
                                                <Input
                                                    placeholder={t('admin.parents.phonePlaceholder')}
                                                    value={newParent.phone}
                                                    onChange={(e) => setNewParent(p => ({ ...p, phone: e.target.value }))}
                                                    className="bg-[#0D1117] border-white/10 text-white h-10"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs text-gray-400">{t('admin.parents.emailLabel')}</Label>
                                                <Input
                                                    type="email"
                                                    placeholder={t('admin.parents.emailPlaceholder')}
                                                    value={newParent.email}
                                                    onChange={(e) => setNewParent(p => ({ ...p, email: e.target.value }))}
                                                    className="bg-[#0D1117] border-white/10 text-white h-10"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs text-gray-400">{t('admin.parents.tempPassword')}</Label>
                                                <Input
                                                    placeholder={t('admin.parents.tempPasswordPlaceholder')}
                                                    value={newParent.password}
                                                    onChange={(e) => setNewParent(p => ({ ...p, password: e.target.value }))}
                                                    className="bg-[#0D1117] border-white/10 text-white h-10"
                                                />
                                                <p className="text-[10px] text-gray-600">{t('admin.parents.tempPasswordHint')}</p>
                                            </div>
                                        </div>

                                        <div className="flex gap-3 mt-6">
                                            <Button
                                                variant="outline"
                                                className="flex-1 border-white/10 text-gray-400 hover:text-white"
                                                onClick={() => setShowAddForm(false)}
                                            >
                                                {t('common.cancel')}
                                            </Button>
                                            <Button
                                                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-bold"
                                                onClick={handleAddParent}
                                                disabled={addingParent}
                                            >
                                                {addingParent ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                                                {t('common.save')}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Profile Detail Column */}
                    <div className={cn("lg:col-span-8 h-full", !selectedParent ? "hidden lg:block" : "block")}>
                        {selectedParent ? (
                            <ParentProfile parent={selectedParent} onClose={() => setSelectedParent(null)} />
                        ) : (
                            <div className="h-full bg-[#161B22] border border-white/5 rounded-3xl p-6 flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 rounded-full bg-gray-800/50 flex items-center justify-center mb-4">
                                    <User className="w-8 h-8 text-gray-600" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('admin.parents.selectParent')}</h3>
                                <p className="text-gray-500 text-sm max-w-sm mt-2">
                                    {t('admin.parents.selectParentDesc')}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
            <ChangeStatusDialog
                open={statusDialog.open}
                onOpenChange={(open) => setStatusDialog(s => ({ ...s, open }))}
                userId={statusDialog.parent?.id ?? ''}
                currentStatus={statusDialog.parent?.status ?? 'active'}
                userName={statusDialog.parent?.name ?? ''}
                onSuccess={(newStatus) => {
                    setParents(prev => prev.map(p =>
                        p.id === statusDialog.parent?.id ? { ...p, status: newStatus } : p
                    ))
                }}
            />
        </div>
    )
}
