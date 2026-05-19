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
import { getMySchoolContext, getSchoolLinkedProfileIds, secureFetchProfiles } from '@/app/admin/actions'

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

const normalizeArabicDigits = (val: string) => {
    return val.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
              .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776));
}

const cleanPhoneDigits = (val: string) => {
    const normalized = normalizeArabicDigits(val);
    return normalized.replace(/[^\d\s]/g, '');
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
    const [parentPhoneCode, setParentPhoneCode] = useState('+222')
    const [parentLocalPhone, setParentLocalPhone] = useState('')
    const [checkingPhone, setCheckingPhone] = useState(false)
    const [phoneChecked, setPhoneChecked] = useState(false)
    const [foundExistingParent, setFoundExistingParent] = useState<{ fullName: string; id: string } | null>(null)
    const [verificationError, setVerificationError] = useState('')
    const [linkingParent, setLinkingParent] = useState(false)
    
    const { t, direction } = useLanguage()

    const COMMON_COUNTRIES = [
        { code: '+222', label: '🇲🇷 +222' },
        { code: '+221', label: '🇸🇳 +221' },
        { code: '+212', label: '🇲🇦 +212' },
        { code: '+33',  label: '🇫🇷 +33' },
        { code: '+213', label: '🇩🇿 +213' },
        { code: '+216', label: '🇹🇳 +216' },
        { code: '+1',   label: '🇺🇸 +1' },
    ]

    const fetchParents = async () => {
        setLoading(true)
        const ctx = await getMySchoolContext()
        if (!ctx) { setLoading(false); return }
        const currentSchoolId = ctx.school_id
        const supabase = createClient()

        // ─── DISCOVERY 1: Parents directly assigned to this school
        const { data: directProfiles } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 'parent')
            .eq('school_id', currentSchoolId)

        // ─── DISCOVERY 2: Parents of students IN this school (even if parent school_id differs)
        const { data: linkedRows } = await supabase
            .from('parent_student_links')
            .select('parent_id, students:profiles!parent_student_links_student_id_fkey!inner(school_id)')
            .eq('students.school_id', currentSchoolId)

        // ─── DISCOVERY 3: Parents linked via profile_schools explicitly
        const schoolLinkedIds = await getSchoolLinkedProfileIds(currentSchoolId, 'parent')

        // COMBINE all unique parent IDs visible to this school
        const directIds = (directProfiles || []).map(p => p.id)
        const studentLinkedIds = (linkedRows || []).map((r: any) => r.parent_id)
        const allParentIds = Array.from(new Set([...directIds, ...studentLinkedIds, ...schoolLinkedIds]))

        if (!allParentIds.length) { setParents([]); setLoading(false); return }

        // Fetch full detailed profiles for these discovered IDs
        // Fetch full detailed profiles for these discovered IDs via secure server action
        const parentProfiles = await secureFetchProfiles(allParentIds, 'id, full_name, email, phone, avatar_url, status, address')

        if (!parentProfiles || parentProfiles.length === 0) { setParents([]); setLoading(false); return }

        const parentIds = (parentProfiles || []).map(p => p.id)
        if (!parentIds.length) { setParents([]); setLoading(false); return }

        // Batch fetch only children links belonging to THIS school
        const { data: allLinks } = await supabase
            .from('parent_student_links')
            .select(`
                parent_id,
                students:profiles!parent_student_links_student_id_fkey!inner (
                    id, full_name, avatar_url
                )
            `)
            .in('parent_id', parentIds)
            .eq('students.school_id', currentSchoolId)

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

    const handleCheckPhone = async () => {
        setVerificationError('')
        const raw = parentLocalPhone.trim().replace(/[^\d\s]/g, '')
        if (raw.length < 4) {
            toast.error("Veuillez saisir un numéro de téléphone valide")
            return
        }
        setCheckingPhone(true)
        try {
            const combined = `${parentPhoneCode}${raw}`
            const { checkUserByPhone } = await import('@/app/auth/actions')
            const res = await checkUserByPhone(combined)
            
            if (res.exists) {
                if (res.role !== 'parent') {
                    setVerificationError(`Ce numéro est déjà lié à un compte "${res.role}". Impossible de l'enregistrer comme parent.`)
                    setPhoneChecked(false)
                } else {
                    setFoundExistingParent({ fullName: res.fullName || "Parent", id: res.id })
                    setPhoneChecked(true)
                }
            } else {
                setFoundExistingParent(null)
                setPhoneChecked(true)
            }
        } catch (err) {
            console.error(err)
            toast.error("Erreur lors de la vérification")
        } finally {
            setCheckingPhone(false)
        }
    }

    const resetForm = () => {
        setShowAddForm(false)
        setNewParent({ firstName: '', lastName: '', phone: '', email: '', password: '' })
        setParentLocalPhone('')
        setPhoneChecked(false)
        setFoundExistingParent(null)
        setVerificationError('')
        setLinkingParent(false)
    }

    const handleLinkExistingParent = async () => {
        if (!foundExistingParent) return
        setLinkingParent(true)
        try {
            const { linkProfileToSchool } = await import('@/app/auth/actions')
            const result = await linkProfileToSchool(foundExistingParent.id, 'parent')
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success(t('common.success') || "Succès", {
                    description: `Le parent (${foundExistingParent.fullName}) a été attaché à votre école.`,
                    duration: 6000
                })
                resetForm()
                await fetchParents()
            }
        } catch (err: any) {
            toast.error("Erreur lors de la liaison", { description: err.message })
        } finally {
            setLinkingParent(false)
        }
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
            const combinedPhone = parentLocalPhone.trim() ? `${parentPhoneCode}${parentLocalPhone.trim().replace(/[^\d\s]/g, '')}` : undefined
            const { createParent } = await import('@/app/auth/actions')
            const result = await createParent({
                firstName: newParent.firstName,
                lastName: newParent.lastName,
                phone: combinedPhone,
                email: newParent.email || undefined,
                password: newParent.password || undefined,
            })

            if (result.error) {
                toast.error(result.error)
                return
            }

            if (result.success && result.credentials) {
                const cred = result.credentials
                
                if ((result as any).isExisting) {
                    toast.success(t('common.success') || "Succès", {
                        description: `Ce parent (${cred.fullName}) est déjà inscrit sur Qalami. Vous pouvez l'associer à un élève.`,
                        duration: 6000
                    })
                } else {
                    toast.success(t('admin.parents.parentAddedSuccess', { name: cred.fullName }), {
                        description: t('admin.parents.passwordIs', { password: cred.password }),
                        duration: 10000
                    })
                }
            }

            resetForm()
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
                        <Button
                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold"
                            onClick={() => setShowAddForm(true)}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            {t('admin.parents.addParent')}
                        </Button>

                        {/* Search & Filters */}
                        <div className="space-y-3">
                            <div className="relative" dir={direction}>
                                <Search className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500", direction === 'rtl' ? "right-3" : "left-3")} />
                                <Input
                                    placeholder={t('admin.parents.searchPlaceholder')}
                                    className={cn(
                                        "bg-[#161B22] border-white/5 text-white placeholder:text-gray-600 focus-visible:ring-emerald-500/50",
                                        direction === 'rtl' ? "pr-9 pl-3 text-right" : "pl-9 pr-3 text-left"
                                    )}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(normalizeArabicDigits(e.target.value))}
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


                            {/* Add Parent Modal */}
                            {/* Add Parent Modal */}
                            {showAddForm && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={resetForm}>
                                    <div 
                                        dir={direction}
                                        className={cn(
                                            "bg-[#1A2530] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200",
                                            direction === 'rtl' ? 'text-right' : 'text-left'
                                        )} 
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="text-lg font-bold text-white">{t('admin.parents.addParent')}</h3>
                                            <button onClick={resetForm} className="text-gray-400 hover:text-white">
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>

                                        <div className="space-y-5">
                                            {/* STEP 1: Phone Check */}
                                            <div className="space-y-1">
                                                <Label className="text-xs text-gray-400">{t('admin.parents.phoneLabel')}</Label>
                                                <div className="relative flex items-center" dir="ltr" style={{ direction: 'ltr' }}>
                                                    <div style={{ position: 'absolute', left: '4px', right: 'auto', zIndex: 10 }}>
                                                        <select
                                                            value={parentPhoneCode}
                                                            onChange={(e) => { setParentPhoneCode(e.target.value); setPhoneChecked(false); setVerificationError(''); }}
                                                            disabled={phoneChecked}
                                                            className="bg-transparent text-gray-400 text-[10px] font-bold py-1 focus:outline-none appearance-none cursor-pointer hover:text-white disabled:opacity-50" style={{ borderRight: '1px solid rgba(255,255,255,0.1)', borderLeft: 'none', paddingLeft: '6px', paddingRight: '4px' }}
                                                        >
                                                            {COMMON_COUNTRIES.map(c => (
                                                                <option key={c.code} value={c.code} className="bg-[#1A2530] text-white">{c.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <Input
                                                        placeholder={t('admin.parents.phonePlaceholder')}
                                                        value={parentLocalPhone}
                                                        onChange={(e) => { setParentLocalPhone(cleanPhoneDigits(e.target.value)); setPhoneChecked(false); setVerificationError(''); }}
                                                        disabled={phoneChecked}
                                                        className="bg-[#0D1117] border-white/10 text-white h-10 disabled:opacity-75" style={{ paddingLeft: '64px', paddingRight: '80px', textAlign: 'left', direction: 'ltr' }}
                                                        dir="ltr"
                                                    />
                                                    {!phoneChecked && (
                                                        <Button 
                                                            onClick={handleCheckPhone}
                                                            disabled={checkingPhone || !parentLocalPhone.trim()}
                                                            size="sm"
                                                            className="bg-emerald-500 hover:bg-emerald-600 text-black text-[11px] font-black uppercase tracking-wider h-8 px-3.5 rounded-lg border-0 shadow-md transition-all" style={{ position: 'absolute', right: '4px', left: 'auto', zIndex: 10 }}
                                                        >
                                                            {checkingPhone ? <Loader2 className="w-3 h-3 animate-spin" /> : (t('common.verify') || 'Vérifier')}
                                                        </Button>
                                                    )}
                                                    {phoneChecked && (
                                                        <button 
                                                            onClick={() => { setPhoneChecked(false); setFoundExistingParent(null); }}
                                                            className="text-emerald-500 hover:text-white transition-colors" style={{ position: 'absolute', right: '12px', left: 'auto', zIndex: 10 }}
                                                            title="Modifier"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                                                        </button>
                                                    )}
                                                </div>
                                                {verificationError && (
                                                    <div className="mt-2 p-2.5 rounded bg-red-500/10 border border-red-500/20 flex items-start gap-2 text-[11px] text-red-400 animate-in slide-in-from-top-1">
                                                        <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                                        <span>{verificationError}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {!phoneChecked && !checkingPhone && !verificationError && (
                                                <div className="py-6 text-center bg-[#0D1117] rounded-xl border border-dashed border-white/5">
                                                    <Phone className="w-6 h-6 text-gray-600 mx-auto mb-2 opacity-50" />
                                                    <p className="text-gray-500 text-[11px]">{t('admin.parents.verifyPhoneToContinue')}</p>
                                                </div>
                                            )}

                                            {/* CASE A: Existing Parent Found */}
                                            {phoneChecked && foundExistingParent && (
                                                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 font-bold text-lg">
                                                            {foundExistingParent.fullName.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-emerald-400 font-medium">Compte existant trouvé !</p>
                                                            <h4 className="text-white font-bold">{foundExistingParent.fullName}</h4>
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-gray-400">Ce parent est inscrit sur Qalami. Voulez-vous l'attacher à votre annuaire scolaire ?</p>
                                                    <Button 
                                                        onClick={handleLinkExistingParent} 
                                                        disabled={linkingParent}
                                                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold mt-2"
                                                    >
                                                        {linkingParent ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                                                        Attacher à mon école
                                                    </Button>
                                                </div>
                                            )}

                                            {/* CASE B: New Parent Creation Flows */}
                                            {phoneChecked && !foundExistingParent && (
                                                <div className="space-y-4 animate-in slide-in-from-top-4 duration-300">
                                                    <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs p-2.5 rounded-lg flex items-center gap-2">
                                                        <ShieldAlert className="w-4 h-4" /> {t('admin.parents.newNumberEnterDetails')}
                                                    </div>
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
                                                         <Label className="text-xs text-gray-400">{t('admin.parents.emailLabel')}</Label>
                                                         <Input
                                                             type="email"
                                                             placeholder={t('admin.parents.emailPlaceholder')}
                                                             value={newParent.email}
                                                             onChange={(e) => setNewParent(p => ({ ...p, email: e.target.value }))}
                                                             className="bg-[#0D1117] border-white/10 text-white h-10 text-left"
                                                             dir="ltr"
                                                         />
                                                     </div>
                                                     <div className="space-y-1">
                                                         <Label className="text-xs text-gray-400">{t('admin.parents.tempPassword')}</Label>
                                                         <Input
                                                             placeholder={t('admin.parents.tempPasswordPlaceholder')}
                                                             value={newParent.password}
                                                             onChange={(e) => setNewParent(p => ({ ...p, password: e.target.value }))}
                                                             className="bg-[#0D1117] border-white/10 text-white h-10 text-left"
                                                             dir="ltr"
                                                         />
                                                         <p className="text-[10px] text-gray-600">{t('admin.parents.tempPasswordHint')}</p>
                                                     </div>

                                                    <div className="flex gap-3 mt-6">
                                                        <Button
                                                            variant="outline"
                                                            className="flex-1 border-white/10 text-gray-400 hover:text-white"
                                                            onClick={resetForm}
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
                                            )}
                                        </div>

                                        {/* Initial footer state - before verify */}
                                        {!phoneChecked && (
                                            <div className="flex justify-end mt-6 pt-4 border-t border-white/5">
                                                <Button
                                                    variant="ghost"
                                                    className="text-gray-400 hover:text-white text-xs"
                                                    onClick={resetForm}
                                                >
                                                            {t('common.cancel')}
                                                </Button>
                                            </div>
                                        )}
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
