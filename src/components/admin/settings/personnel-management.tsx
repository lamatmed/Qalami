'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Users, Search, DollarSign, UserCog, Trash2, Loader2, CalendarDays, ChevronDown, ChevronUp, Check, X, StickyNote, Pencil } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n'
import { cn } from '@/lib/utils'
import { getStaffAction, addStaffMemberAction, deleteStaffMember, updateStaffMemberAction, addStaffAbsenceAction, getStaffAbsencesAction, deleteStaffAbsenceAction } from '@/app/admin/settings/actions'

interface StaffMember {
    id: string
    name: string
    role: string
    phone: string | null
    nni: string | null
    salary: number
    contractType: string
    status: string
}

interface StaffAbsence {
    id: string
    date: string
    justified: boolean
    justification_note: string | null
}

const POSITIONS = [
    'Surveillant',
    'Secrétaire',
    'Comptable',
    'Concierge',
    'Sécurité',
    'Chauffeur',
    'Technicien',
    'Autre',
]

export function PersonnelManagement() {
    const { t } = useLanguage()
    const [staff, setStaff] = useState<StaffMember[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [newMember, setNewMember] = useState({
        name: '',
        role: '',
        phone: '',
        nni: '',
        salary: '',
        contractType: 'CDI' as 'CDI' | 'CDD' | 'hourly',
    })
    const [searchQuery, setSearchQuery] = useState('')

    // Edit state
    const [editMember, setEditMember] = useState<StaffMember | null>(null)
    const [editForm, setEditForm] = useState({ name: '', role: '', phone: '', nni: '', salary: '', contractType: 'CDI' as 'CDI' | 'CDD' | 'hourly' })

    const openEdit = (member: StaffMember) => {
        setEditMember(member)
        setEditForm({ name: member.name, role: member.role, phone: member.phone || '', nni: member.nni || '', salary: String(member.salary), contractType: (member.contractType as 'CDI' | 'CDD' | 'hourly') || 'CDI' })
    }

    const handleUpdate = async () => {
        if (!editMember) return
        if (!editForm.name.trim() || !editForm.role.trim()) { toast.error('Nom et poste sont obligatoires'); return }
        setSaving(true)
        const result = await updateStaffMemberAction(editMember.id, {
            name: editForm.name,
            role: editForm.role,
            phone: editForm.phone,
            nni: editForm.nni,
            salary: Number(editForm.salary) || 0,
            contractType: editForm.contractType,
        })
        setSaving(false)
        if (result.error) { toast.error(result.error); return }
        setStaff(prev => prev.map(s => s.id === editMember.id ? {
            ...s, name: editForm.name, role: editForm.role, phone: editForm.phone || null,
            nni: editForm.nni || null, salary: Number(editForm.salary) || 0, contractType: editForm.contractType
        } : s))
        toast.success('Informations mises à jour')
        setEditMember(null)
    }

    // Absence panel state
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [absencesMap, setAbsencesMap] = useState<Record<string, StaffAbsence[]>>({})
    const [loadingAbsences, setLoadingAbsences] = useState<string | null>(null)
    const [absenceDate, setAbsenceDate] = useState(() => new Date().toISOString().split('T')[0])
    const [absenceJustified, setAbsenceJustified] = useState(false)
    const [absenceNote, setAbsenceNote] = useState('')
    const [addingAbsence, setAddingAbsence] = useState(false)
    const [deletingAbsenceId, setDeletingAbsenceId] = useState<string | null>(null)
    const [addFormOpenFor, setAddFormOpenFor] = useState<string | null>(null)

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    const loadAbsences = async (staffId: string) => {
        setLoadingAbsences(staffId)
        const result = await getStaffAbsencesAction(staffId, currentMonth, currentYear)
        if (!result.error) {
            setAbsencesMap(prev => ({ ...prev, [staffId]: result.absences }))
        }
        setLoadingAbsences(null)
    }

    const toggleExpand = async (staffId: string) => {
        if (expandedId === staffId) {
            setExpandedId(null)
            return
        }
        setExpandedId(staffId)
        setAbsenceDate(new Date().toISOString().split('T')[0])
        setAbsenceJustified(false)
        setAbsenceNote('')
        if (!absencesMap[staffId]) await loadAbsences(staffId)
    }

    const handleAddAbsence = async (staffId: string) => {
        setAddingAbsence(true)
        const result = await addStaffAbsenceAction({ staffId, date: absenceDate, justified: absenceJustified, note: absenceNote.trim() || null })
        if (result.error) { toast.error(result.error) }
        else {
            toast.success('Absence enregistrée')
            setAbsenceDate(new Date().toISOString().split('T')[0])
            setAbsenceJustified(false)
            setAbsenceNote('')
            setAddFormOpenFor(null)
            await loadAbsences(staffId)
        }
        setAddingAbsence(false)
    }

    const handleDeleteAbsence = async (staffId: string, absenceId: string) => {
        if (!confirm('Supprimer cette absence ?')) return
        setDeletingAbsenceId(absenceId)
        const result = await deleteStaffAbsenceAction(absenceId)
        if (result.error) toast.error(result.error)
        else {
            toast.success('Absence supprimée')
            await loadAbsences(staffId)
        }
        setDeletingAbsenceId(null)
    }

    useEffect(() => {
        async function load() {
            setLoading(true)
            const result = await getStaffAction()
            if (result.error) {
                toast.error(result.error)
            } else {
                setStaff((result.staff ?? []) as StaffMember[])
            }
            setLoading(false)
        }
        load()
    }, [])

    const handleAdd = async () => {
        if (!newMember.name || !newMember.role) {
            toast.error('Nom et poste sont obligatoires')
            return
        }
        if (newMember.nni && !/^\d{10}$/.test(newMember.nni)) {
            toast.error('Le NNI doit contenir exactement 10 chiffres')
            return
        }
        setSaving(true)
        const result = await addStaffMemberAction({
            name: newMember.name,
            role: newMember.role,
            phone: newMember.phone,
            nni: newMember.nni,
            salary: Number(newMember.salary) || 0,
            contractType: newMember.contractType,
        })
        if (result.error) {
            toast.error(result.error)
        } else {
            setStaff(prev => [result.member as StaffMember, ...prev])
            toast.success(t('admin.personnel.memberAdded'))
            setIsAddOpen(false)
            setNewMember({ name: '', role: '', phone: '', nni: '', salary: '', contractType: 'CDI' })
        }
        setSaving(false)
    }

    const handleDelete = async (member: StaffMember) => {
        if (!confirm(`${t('admin.personnel.deleteConfirm')} ${member.name}?`)) return
        setDeletingId(member.id)
        const result = await deleteStaffMember(member.id)
        if (result.error) {
            toast.error(result.error)
        } else {
            setStaff(prev => prev.filter(s => s.id !== member.id))
            toast.success(t('admin.personnel.memberDeleted'))
        }
        setDeletingId(null)
    }

    const filteredStaff = staff.filter(m =>
        searchQuery === '' ||
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.role.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const uniqueRoles = new Set(staff.map(s => s.role))
    const totalPayroll = staff.reduce((acc, s) => acc + s.salary, 0)

    if (loading) {
        return (
            <div className="space-y-8 animate-in fade-in duration-500">
                <div className="flex justify-between items-center">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-10 w-36" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Skeleton className="h-24 rounded-2xl" />
                    <Skeleton className="h-24 rounded-2xl" />
                    <Skeleton className="h-24 rounded-2xl" />
                </div>
                <Skeleton className="h-64 rounded-2xl" />
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h3 className="text-xl font-bold text-white">{t('admin.personnel.title')}</h3>
                    <p className="text-gray-400 text-sm">{t('admin.personnel.subtitle')}</p>
                </div>
                {/* Edit dialog */}
                <Dialog open={!!editMember} onOpenChange={open => { if (!open) setEditMember(null) }}>
                    <DialogContent className="bg-[#161B22] border-white/10 text-white">
                        <DialogHeader>
                            <DialogTitle>Modifier les informations</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label>{t('admin.personnel.fullName')}</Label>
                                <Input placeholder={t('admin.personnel.fullNamePlaceholder')} className="bg-[#0D1117] border-white/10"
                                    value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>{t('admin.personnel.rolePosition')}</Label>
                                    <Select value={editForm.role} onValueChange={v => setEditForm({ ...editForm, role: v })}>
                                        <SelectTrigger className="bg-[#0D1117] border-white/10">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#161B22] border-white/10 text-white">
                                            {POSITIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Type de contrat</Label>
                                    <Select value={editForm.contractType} onValueChange={v => setEditForm({ ...editForm, contractType: v as 'CDI' | 'CDD' | 'hourly' })}>
                                        <SelectTrigger className="bg-[#0D1117] border-white/10">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#161B22] border-white/10 text-white">
                                            <SelectItem value="CDI">CDI</SelectItem>
                                            <SelectItem value="CDD">CDD</SelectItem>
                                            <SelectItem value="hourly">Horaire</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>{t('admin.personnel.monthlySalary')} (MRU)</Label>
                                    <Input type="number" placeholder="0" className="bg-[#0D1117] border-white/10"
                                        value={editForm.salary} onChange={e => setEditForm({ ...editForm, salary: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>NNI</Label>
                                    <Input placeholder="10 chiffres" maxLength={10} className="bg-[#0D1117] border-white/10 font-mono"
                                        value={editForm.nni} onChange={e => setEditForm({ ...editForm, nni: e.target.value.replace(/\D/g, '') })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>{t('admin.personnel.phone')}</Label>
                                <Input placeholder={t('admin.personnel.phonePlaceholder')} className="bg-[#0D1117] border-white/10"
                                    value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
                            </div>
                            <Button onClick={handleUpdate} className="w-full bg-pink-600 hover:bg-pink-500 font-bold mt-2" disabled={saving}>
                                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                {t('common.save')}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-pink-600 hover:bg-pink-500 text-white font-bold shadow-lg shadow-pink-500/20">
                            <Plus className="w-4 h-4 mr-2" />
                            {t('admin.personnel.addMember')}
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#161B22] border-white/10 text-white">
                        <DialogHeader>
                            <DialogTitle>{t('admin.personnel.newMember')}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label>{t('admin.personnel.fullName')}</Label>
                                <Input
                                    placeholder={t('admin.personnel.fullNamePlaceholder')}
                                    className="bg-[#0D1117] border-white/10"
                                    value={newMember.name}
                                    onChange={e => setNewMember({ ...newMember, name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>{t('admin.personnel.rolePosition')}</Label>
                                    <Select
                                        value={newMember.role}
                                        onValueChange={v => setNewMember({ ...newMember, role: v })}
                                    >
                                        <SelectTrigger className="bg-[#0D1117] border-white/10">
                                            <SelectValue placeholder={t('admin.personnel.choosePlaceholder')} />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#161B22] border-white/10 text-white">
                                            {POSITIONS.map(p => (
                                                <SelectItem key={p} value={p}>{p}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Type de contrat</Label>
                                    <Select
                                        value={newMember.contractType}
                                        onValueChange={v => setNewMember({ ...newMember, contractType: v as 'CDI' | 'CDD' | 'hourly' })}
                                    >
                                        <SelectTrigger className="bg-[#0D1117] border-white/10">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#161B22] border-white/10 text-white">
                                            <SelectItem value="CDI">CDI</SelectItem>
                                            <SelectItem value="CDD">CDD</SelectItem>
                                            <SelectItem value="hourly">Horaire</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>{t('admin.personnel.monthlySalary')} (MRU)</Label>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        className="bg-[#0D1117] border-white/10"
                                        value={newMember.salary}
                                        onChange={e => setNewMember({ ...newMember, salary: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>NNI</Label>
                                    <Input
                                        placeholder="10 chiffres"
                                        maxLength={10}
                                        className={`bg-[#0D1117] border-white/10 font-mono ${newMember.nni && newMember.nni.length !== 10 ? 'border-red-500/50' : ''}`}
                                        value={newMember.nni}
                                        onChange={e => setNewMember({ ...newMember, nni: e.target.value.replace(/\D/g, '') })}
                                    />
                                    {newMember.nni && (
                                        <p className={`text-[10px] mt-1 ${newMember.nni.length === 10 ? 'text-emerald-500' : 'text-red-400'}`}>
                                            {newMember.nni.length}/10
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>{t('admin.personnel.phone')}</Label>
                                <Input
                                    placeholder={t('admin.personnel.phonePlaceholder')}
                                    className="bg-[#0D1117] border-white/10"
                                    value={newMember.phone}
                                    onChange={e => setNewMember({ ...newMember, phone: e.target.value })}
                                />
                            </div>
                            <Button
                                onClick={handleAdd}
                                className="w-full bg-pink-600 hover:bg-pink-500 font-bold mt-2"
                                disabled={saving}
                            >
                                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                {t('common.save')}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#1A2530] p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                    <div className="p-3 bg-pink-500/10 rounded-xl text-pink-500">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-gray-400 text-xs font-bold uppercase">{t('admin.personnel.totalMembers')}</p>
                        <h4 className="text-2xl font-black text-white">{staff.length}</h4>
                    </div>
                </div>
                <div className="bg-[#1A2530] p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">
                        <DollarSign className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-gray-400 text-xs font-bold uppercase">{t('admin.personnel.payroll')}</p>
                        <h4 className="text-2xl font-black text-white">
                            {totalPayroll.toLocaleString()} <span className="text-xs text-gray-500">MRU</span>
                        </h4>
                    </div>
                </div>
                <div className="bg-[#1A2530] p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-500">
                        <UserCog className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-gray-400 text-xs font-bold uppercase">{t('admin.personnel.activeRoles')}</p>
                        <h4 className="text-2xl font-black text-white">{uniqueRoles.size}</h4>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="bg-[#1A2530] rounded-2xl border border-white/5 overflow-hidden">
                <div className="p-4 border-b border-white/5 flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <Input
                            placeholder={t('admin.personnel.searchMember')}
                            className="bg-[#0F1720] border-white/10 pl-9 text-sm h-10"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
                <div className="divide-y divide-white/5">
                    {filteredStaff.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>{t('admin.personnel.noMemberFound')}</p>
                        </div>
                    ) : (
                        filteredStaff.map(member => {
                            const absences = absencesMap[member.id] || []
                            const unjustifiedCount = absences.filter(a => !a.justified).length
                            const dailySalary = member.salary / 26
                            const deduction = unjustifiedCount * dailySalary
                            const isExpanded = expandedId === member.id

                            return (
                                <div key={member.id}>
                                    {/* Staff row */}
                                    <div className="p-4 flex items-center justify-between group hover:bg-white/5 transition-colors">
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-400 font-bold text-sm border border-pink-500/20 shrink-0">
                                                {member.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-white text-sm">{member.name}</h4>
                                                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                                    <Badge variant="secondary" className="bg-pink-500/10 text-pink-400 text-[10px] border-0 px-1.5 py-0">
                                                        {member.role}
                                                    </Badge>
                                                    <Badge variant="secondary" className="bg-white/5 text-gray-500 text-[10px] border-0 px-1.5 py-0">
                                                        {member.contractType}
                                                    </Badge>
                                                    {member.phone && <span className="text-xs text-gray-500">{member.phone}</span>}
                                                    {member.nni && <span className="text-xs text-gray-600 font-mono">NNI: {member.nni}</span>}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 shrink-0">
                                            <div className="text-right hidden sm:block">
                                                <p className="text-emerald-400 font-bold font-mono text-sm">{member.salary.toLocaleString()} MRU</p>
                                                <p className="text-[10px] text-gray-600 uppercase">{t('admin.personnel.fixedSalary')}</p>
                                            </div>
                                            {/* Absences toggle */}
                                            <button
                                                type="button"
                                                onClick={() => toggleExpand(member.id)}
                                                className={cn(
                                                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all",
                                                    unjustifiedCount > 0
                                                        ? "bg-red-500/10 border-red-500/20 text-red-400"
                                                        : "bg-white/5 border-white/10 text-gray-500 hover:text-gray-300"
                                                )}
                                            >
                                                <CalendarDays className="w-3 h-3" />
                                                {unjustifiedCount > 0 ? `${unjustifiedCount} abs.` : 'Absences'}
                                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                            </button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-gray-500 hover:text-blue-400 hover:bg-blue-500/10"
                                                onClick={() => openEdit(member)}
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                onClick={() => handleDelete(member)}
                                                disabled={deletingId === member.id}
                                            >
                                                {deletingId === member.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Absence panel */}
                                    {isExpanded && (
                                        <div className="border-t border-white/5 bg-[#0F1720] px-5 py-4 space-y-4">
                                            {/* Month summary */}
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs font-bold text-gray-400">
                                                    Absences — {new Date(currentYear, currentMonth - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                                                </p>
                                                {unjustifiedCount > 0 && (
                                                    <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/20">
                                                        Déduction : −{Math.round(deduction).toLocaleString()} MRU
                                                    </span>
                                                )}
                                            </div>

                                            {/* Add form toggle */}
                                            {addFormOpenFor !== member.id ? (
                                                <button
                                                    type="button"
                                                    onClick={() => { setAddFormOpenFor(member.id); setAbsenceDate(new Date().toISOString().split('T')[0]); setAbsenceJustified(false); setAbsenceNote('') }}
                                                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-pink-500/10 border border-pink-500/20 text-pink-400 hover:bg-pink-500/20 transition-all w-full justify-center"
                                                >
                                                    <Plus className="w-3.5 h-3.5" /> Ajouter une absence
                                                </button>
                                            ) : (
                                                <div className="bg-[#1A2530] rounded-xl border border-pink-500/20 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-[10px] font-bold text-pink-400 uppercase">Nouvelle absence</p>
                                                        <button type="button" title="Fermer" onClick={() => setAddFormOpenFor(null)} className="text-gray-500 hover:text-white transition-colors">
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] text-gray-500 uppercase font-bold">Date</label>
                                                            <input
                                                                type="date"
                                                                title="Date de l'absence"
                                                                value={absenceDate}
                                                                onChange={e => setAbsenceDate(e.target.value)}
                                                                className="w-full bg-[#0D1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-pink-500/50"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] text-gray-500 uppercase font-bold">Note</label>
                                                            <input
                                                                type="text"
                                                                placeholder="Optionnel"
                                                                value={absenceNote}
                                                                onChange={e => setAbsenceNote(e.target.value)}
                                                                className="w-full bg-[#0D1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-pink-500/50"
                                                            />
                                                        </div>
                                                    </div>
                                                    <label className="flex items-center gap-2 cursor-pointer group">
                                                        <div
                                                            onClick={() => setAbsenceJustified(v => !v)}
                                                            className={cn(
                                                                "w-4 h-4 rounded border-2 flex items-center justify-center transition-all shrink-0",
                                                                absenceJustified ? "bg-emerald-500 border-emerald-500" : "border-white/20 group-hover:border-emerald-500/50"
                                                            )}
                                                        >
                                                            {absenceJustified && <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />}
                                                        </div>
                                                        <span className="text-xs text-gray-400">Absence justifiée (ne compte pas dans la déduction)</span>
                                                    </label>
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setAddFormOpenFor(null)}
                                                            className="px-3 py-2 rounded-lg text-xs font-bold text-gray-400 hover:text-white border border-white/10 hover:bg-white/5 transition-all"
                                                        >
                                                            Annuler
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAddAbsence(member.id)}
                                                            disabled={addingAbsence || !absenceDate}
                                                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-pink-600 hover:bg-pink-500 text-white transition-all disabled:opacity-50"
                                                        >
                                                            {addingAbsence ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                                            Enregistrer
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Absence list */}
                                            {loadingAbsences === member.id ? (
                                                <div className="flex justify-center py-4">
                                                    <Loader2 className="w-5 h-5 animate-spin text-pink-500" />
                                                </div>
                                            ) : absences.length === 0 ? (
                                                <p className="text-center text-xs text-gray-600 py-3">Aucune absence ce mois-ci</p>
                                            ) : (
                                                <div className="space-y-2">
                                                    {absences.map(ab => (
                                                        <div key={ab.id} className="flex items-center justify-between bg-[#1A2530] rounded-lg px-3 py-2.5 border border-white/5">
                                                            <div className="flex items-center gap-3">
                                                                <span className={cn(
                                                                    "w-2 h-2 rounded-full shrink-0",
                                                                    ab.justified ? "bg-amber-400" : "bg-red-500"
                                                                )} />
                                                                <div>
                                                                    <p className="text-xs font-bold text-white">
                                                                        {new Date(ab.date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}
                                                                    </p>
                                                                    {ab.justification_note && (
                                                                        <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                                                                            <StickyNote className="w-2.5 h-2.5" />{ab.justification_note}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className={cn(
                                                                    "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                                                                    ab.justified
                                                                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                                                        : "bg-red-500/10 text-red-400 border-red-500/20"
                                                                )}>
                                                                    {ab.justified ? 'Justifiée' : `−${Math.round(dailySalary).toLocaleString()} MRU`}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteAbsence(member.id, ab.id)}
                                                                    disabled={deletingAbsenceId === ab.id}
                                                                    className="p-1 text-gray-600 hover:text-red-400 transition-colors rounded"
                                                                >
                                                                    {deletingAbsenceId === ab.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    )}
                </div>
            </div>
        </div>
    )
}
