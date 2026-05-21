'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Users, Search, DollarSign, UserCog, Trash2, Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n'
import { getStaffAction, addStaffMemberAction, deleteStaffMember } from '@/app/admin/settings/actions'

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
                        filteredStaff.map(member => (
                            <div key={member.id} className="p-4 flex items-center justify-between group hover:bg-white/5 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-400 font-bold text-sm border border-pink-500/20 shrink-0">
                                        {member.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white text-sm">{member.name}</h4>
                                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                            <Badge variant="secondary" className="bg-pink-500/10 text-pink-400 text-[10px] border-0 px-1.5 py-0">
                                                {member.role}
                                            </Badge>
                                            <Badge variant="secondary" className="bg-white/5 text-gray-500 text-[10px] border-0 px-1.5 py-0">
                                                {member.contractType}
                                            </Badge>
                                            {member.phone && (
                                                <span className="text-xs text-gray-500">{member.phone}</span>
                                            )}
                                            {member.nni && (
                                                <span className="text-xs text-gray-600 font-mono">NNI: {member.nni}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="text-right hidden sm:block">
                                        <p className="text-emerald-400 font-bold font-mono text-sm">{member.salary.toLocaleString()} MRU</p>
                                        <p className="text-[10px] text-gray-600 uppercase">{t('admin.personnel.fixedSalary')}</p>
                                    </div>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                        onClick={() => handleDelete(member)}
                                        disabled={deletingId === member.id}
                                    >
                                        {deletingId === member.id
                                            ? <Loader2 className="w-4 h-4 animate-spin" />
                                            : <Trash2 className="w-4 h-4" />
                                        }
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
