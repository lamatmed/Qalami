'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Users, Search, DollarSign, UserCog, Trash2, Edit2, User, Loader2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n'

interface StaffMember {
    id: string
    name: string
    role: string
    phone: string | null
    salary: number
    status: string
}

export function PersonnelManagement() {
    const { t } = useLanguage()
    const [staff, setStaff] = useState<StaffMember[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [newMember, setNewMember] = useState({ name: '', role: '', phone: '', salary: '' })
    const [searchQuery, setSearchQuery] = useState('')

    // Fetch staff from profiles directly
    useEffect(() => {
        async function fetchStaff() {
            setLoading(true)
            const supabase = createClient()

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setLoading(false); return }

            const { data: me } = await supabase
                .from('profiles')
                .select('school_id')
                .eq('id', user.id)
                .single()

            if (!me?.school_id) { setLoading(false); return }

            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, phone, status, contracts(position, monthly_salary)')
                .eq('school_id', me.school_id)
                .eq('role', 'school_staff')
                .order('full_name', { ascending: true })

            if (error) {
                console.error('Error fetching staff:', error.message, error.code)
            }

            const processedData: StaffMember[] = (data || []).map(p => {
                const contract = p.contracts && p.contracts.length > 0 ? p.contracts[0] : null;
                return {
                    id: p.id,
                    name: (p as any).full_name || 'Non défini',
                    role: contract?.position || 'Staff',
                    phone: p.phone,
                    salary: contract?.monthly_salary || 0,
                    status: p.status === 'active' ? 'Active' : (p.status || 'Active'),
                }
            })

            setStaff(processedData)
            setLoading(false)
        }

        fetchStaff()
    }, [])

    const handleAdd = async () => {
        if (!newMember.name || !newMember.role) return
        setSaving(true)
        const supabase = createClient()

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setSaving(false); return }

        const { data: me } = await supabase
            .from('profiles')
            .select('school_id')
            .eq('id', user.id)
            .single()

        if (!me?.school_id) { setSaving(false); return }

        const { data: newProfile, error } = await supabase
            .from('profiles')
            .insert({
                full_name: newMember.name,
                phone: newMember.phone || null,
                role: 'school_staff',
                school_id: me.school_id,
                status: 'active',
            })
            .select('id')
            .single()

        if (error) {
            console.error('Add staff error:', error.message, error.code)
            toast.error(error.message || t('admin.personnel.addError'))
            setSaving(false)
            return
        }

        // Add contract details if salary or position provided
        if (newProfile && (newMember.role || newMember.salary)) {
            const { error: contractError } = await supabase
                .from('contracts')
                .insert({
                    school_id: me.school_id,
                    employee_id: newProfile.id,
                    contract_type: 'CDI',
                    position: newMember.role,
                    monthly_salary: Number(newMember.salary) || 0,
                    start_date: new Date().toISOString().split('T')[0],
                    status: 'active'
                })
                
            if (contractError) {
                console.error('Contract creation error:', contractError.message)
            }
        }

        setStaff(prev => [{
            id: newProfile.id,
            name: newMember.name,
            role: newMember.role,
            phone: newMember.phone || null,
            salary: 0,
            status: 'Active',
        }, ...prev])

        toast.success(t('admin.personnel.memberAdded'))
        setIsAddOpen(false)
        setNewMember({ name: '', role: '', phone: '', salary: '' })
        setSaving(false)
    }

    const handleDelete = async (member: StaffMember) => {
        if (!confirm(`${t('admin.personnel.deleteConfirm')} ${member.name}?`)) return

        const res = await fetch('/api/staff/delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileId: member.id }),
        })

        const data = await res.json()

        if (!res.ok || data.error) {
            toast.error(data.error || 'Erreur de suppression')
            return
        }

        setStaff(prev => prev.filter(s => s.id !== member.id))
        toast.success(t('admin.personnel.memberDeleted'))
    }

    // Filter by search
    const filteredStaff = staff.filter(m =>
        searchQuery === '' ||
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.role.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // Calculate unique roles
    const uniqueRoles = new Set(staff.map(s => s.role))

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
                                    <Select onValueChange={v => setNewMember({ ...newMember, role: v })}>
                                        <SelectTrigger className="bg-[#0D1117] border-white/10">
                                            <SelectValue placeholder={t('admin.personnel.choosePlaceholder')} />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#161B22] border-white/10 text-white">
                                            <SelectItem value="Surveillant">{t('admin.personnel.supervisor')}</SelectItem>
                                            <SelectItem value="Secrétaire">{t('admin.personnel.secretary')}</SelectItem>
                                            <SelectItem value="Comptable">{t('admin.personnel.accountant')}</SelectItem>
                                            <SelectItem value="Concierge">{t('admin.personnel.concierge')}</SelectItem>
                                            <SelectItem value="Sécurité">{t('admin.personnel.security')}</SelectItem>
                                            <SelectItem value="Autre">{t('admin.personnel.other')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('admin.personnel.monthlySalary')}</Label>
                                    <Input
                                        type="number"
                                        placeholder="0.00"
                                        className="bg-[#0D1117] border-white/10"
                                        value={newMember.salary}
                                        onChange={e => setNewMember({ ...newMember, salary: e.target.value })}
                                    />
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
                                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                {t('common.save')}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Stats Overview */}
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
                            {(staff.reduce((acc, curr) => acc + curr.salary, 0)).toLocaleString()} <span className="text-xs text-gray-500">MRU</span>
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
                            onChange={(e) => setSearchQuery(e.target.value)}
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
                        filteredStaff.map((member) => (
                            <div key={member.id} className="p-4 flex items-center justify-between group hover:bg-white/5 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-[#0F1720] flex items-center justify-center text-gray-400 font-bold border border-white/5">
                                        <User className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white text-sm">{member.name}</h4>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="bg-pink-500/10 text-pink-500 text-[10px] border-0 px-1.5 py-0">
                                                {member.role}
                                            </Badge>
                                            {member.phone && <span className="text-xs text-gray-500 ltr-content">{member.phone}</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    <div className="text-right hidden sm:block">
                                        <p className="text-emerald-500 font-bold font-mono text-sm">{member.salary.toLocaleString()} MRU</p>
                                        <p className="text-[10px] text-gray-600 uppercase">{t('admin.personnel.fixedSalary')}</p>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/5">
                                            <Edit2 className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                            onClick={() => handleDelete(member)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
