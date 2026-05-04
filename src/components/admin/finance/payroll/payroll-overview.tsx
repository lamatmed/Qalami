'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Search, ChevronRight, CheckCircle2, Download, Printer, Wallet, ArrowUpRight, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { createClient } from '@/utils/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'

interface PayrollEmployee {
    id: string
    employeeId: string
    employeeName: string
    position: string
    status: 'pending' | 'paid' | 'cancelled'
    baseSalary: number
    bonuses: number
    deductions: number
    netSalary: number
    initials: string
}

export function PayrollOverview({ onSelectTeacher }: { onSelectTeacher: (teacher: any) => void }) {
    const [employees, setEmployees] = useState<PayrollEmployee[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')
    const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
    const [searchQuery, setSearchQuery] = useState('')

    // Get current month and year
    const currentMonth = new Date().getMonth() + 1
    const currentYear = new Date().getFullYear()
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

    // Fetch payroll data
    useEffect(() => {
        async function fetchPayroll() {
            setLoading(true)
            const supabase = createClient()

            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) {
                    setLoading(false)
                    return
                }

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('school_id')
                    .eq('id', user.id)
                    .single()

                if (!profile?.school_id) {
                    setLoading(false)
                    return
                }

                // Fetch payroll with employee details - use simple join
                const { data, error } = await supabase
                    .from('payroll')
                    .select(`
                        *,
                        profiles (id, full_name)
                    `)
                    .eq('school_id', profile.school_id)
                    .order('created_at', { ascending: false })

                if (error) {
                    setLoading(false)
                    return
                }

                // Also fetch contracts for positions
                const { data: contracts } = await supabase
                    .from('contracts')
                    .select('employee_id, position')
                    .eq('school_id', profile.school_id)

                const positionMap = new Map((contracts || []).map(c => [c.employee_id, c.position]))

                const processedData: PayrollEmployee[] = (data || []).map(payroll => {
                    const fullName = (payroll.profiles as any)?.full_name || 'Employé'
                    const initials = fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

                    return {
                        id: payroll.id,
                        employeeId: payroll.employee_id,
                        employeeName: fullName,
                        position: positionMap.get(payroll.employee_id) || 'Enseignant',
                        status: payroll.status,
                        baseSalary: parseFloat(payroll.base_salary) || 0,
                        bonuses: parseFloat(payroll.bonuses) || 0,
                        deductions: parseFloat(payroll.deductions) || 0,
                        netSalary: parseFloat(payroll.net_salary) || 0,
                        initials
                    }
                })

                setEmployees(processedData)
            } catch (err) {
            } finally {
                setLoading(false)
            }
        }

        fetchPayroll()
    }, [])


    const filteredEmployees = employees.filter(e => {
        const matchesFilter = filter === 'all' || e.status === filter
        const matchesSearch = searchQuery === '' || e.employeeName.toLowerCase().includes(searchQuery.toLowerCase())
        return matchesFilter && matchesSearch
    })

    const totalPayroll = employees.reduce((acc, curr) => acc + curr.netSalary, 0)
    const pendingAmount = employees.filter(e => e.status === 'pending').reduce((acc, curr) => acc + curr.netSalary, 0)
    const paidAmount = employees.filter(e => e.status === 'paid').reduce((acc, curr) => acc + curr.netSalary, 0)

    const toggleSelectAll = () => {
        if (selectedEmployees.length === filteredEmployees.length) {
            setSelectedEmployees([])
        } else {
            setSelectedEmployees(filteredEmployees.map(e => e.id))
        }
    }

    const toggleSelectEmployee = (id: string) => {
        if (selectedEmployees.includes(id)) {
            setSelectedEmployees(selectedEmployees.filter(e => e !== id))
        } else {
            setSelectedEmployees([...selectedEmployees, id])
        }
    }

    if (loading) {
        return (
            <div className="space-y-6 animate-in fade-in duration-500 pb-20">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Skeleton className="h-32 rounded-3xl" />
                    <Skeleton className="h-32 rounded-3xl" />
                    <Skeleton className="h-32 rounded-3xl" />
                </div>
                <Skeleton className="h-12 rounded-xl" />
                <Skeleton className="h-64 rounded-3xl" />
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            {/* Header Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Total Budget */}
                <Card className="bg-[#161B22] border-white/5 p-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Wallet className="w-24 h-24 text-emerald-500" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Budget Total ({monthNames[currentMonth - 1]})</p>
                        <h2 className="text-3xl font-black text-white mb-2">{totalPayroll.toLocaleString()} <span className="text-sm text-gray-500 font-medium">MRU</span></h2>
                        <div className="flex items-center gap-2 text-xs text-emerald-500 bg-emerald-500/10 w-fit px-2 py-1 rounded-md">
                            <ArrowUpRight className="w-3 h-3" /> {employees.length} employés
                        </div>
                    </div>
                </Card>

                {/* Paid */}
                <Card className="bg-[#161B22] border-white/5 p-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <CheckCircle2 className="w-24 h-24 text-blue-500" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Versé</p>
                        <h2 className="text-3xl font-black text-white mb-2">{paidAmount.toLocaleString()} <span className="text-sm text-gray-500 font-medium">MRU</span></h2>
                        <div className="w-full bg-gray-800 h-1.5 rounded-full mt-2 overflow-hidden">
                            <div className="bg-blue-500 h-full rounded-full" style={{ width: `${totalPayroll > 0 ? (paidAmount / totalPayroll) * 100 : 0}%` }} />
                        </div>
                        <p className="text-[10px] text-gray-500 mt-2 text-right">{totalPayroll > 0 ? Math.round((paidAmount / totalPayroll) * 100) : 0}% complété</p>
                    </div>
                </Card>

                {/* Pending */}
                <Card className="bg-[#161B22] border-white/5 p-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Clock className="w-24 h-24 text-orange-500" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">En attente</p>
                        <h2 className="text-3xl font-black text-white mb-2">{pendingAmount.toLocaleString()} <span className="text-sm text-gray-500 font-medium">MRU</span></h2>
                        <div className="flex items-center gap-2 text-xs text-orange-500 bg-orange-500/10 w-fit px-2 py-1 rounded-md mt-1">
                            {employees.filter(e => e.status === 'pending').length} employés à payer
                        </div>
                    </div>
                </Card>
            </div>

            {/* Actions Toolbar */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex gap-2 bg-[#161B22] p-1 rounded-xl border border-white/5 w-full sm:w-auto">
                    {['all', 'paid', 'pending'].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={cn(
                                "flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all",
                                filter === f
                                    ? "bg-white/10 text-white shadow-sm"
                                    : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                            )}
                        >
                            {f === 'all' ? 'Tous' : f === 'paid' ? 'Payés' : 'En attente'}
                        </button>
                    ))}
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="outline" className="bg-[#161B22] border-white/5 text-gray-400 hover:text-white flex-1 sm:flex-none gap-2">
                        <Printer className="w-4 h-4" /> <span className="hidden sm:inline">Imprimer</span>
                    </Button>
                    <Button variant="outline" className="bg-[#161B22] border-white/5 text-gray-400 hover:text-white flex-1 sm:flex-none gap-2">
                        <Download className="w-4 h-4" /> <span className="hidden sm:inline">Exporter</span>
                    </Button>
                </div>
            </div>

            {/* Bulk Action Bar */}
            {selectedEmployees.length > 0 && (
                <div className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 bg-emerald-500 text-black px-6 py-3 rounded-full shadow-2xl shadow-emerald-500/20 flex items-center gap-4 animate-in slide-in-from-bottom-5">
                    <span className="font-bold text-sm">{selectedEmployees.length} sélectionnés</span>
                    <div className="h-4 w-px bg-black/20" />
                    <button className="font-bold text-sm hover:bg-emerald-600 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> Tout payer
                    </button>
                    <button className="font-bold text-sm hover:bg-emerald-600 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2">
                        <Download className="w-4 h-4" /> Bulletins
                    </button>
                </div>
            )}

            {/* Employee List */}
            <div className="bg-[#161B22] rounded-3xl border border-white/5 overflow-hidden">
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Checkbox
                            checked={selectedEmployees.length === filteredEmployees.length && filteredEmployees.length > 0}
                            onCheckedChange={toggleSelectAll}
                            className="border-white/20 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                        />
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Employés ({filteredEmployees.length})</span>
                    </div>
                    <div className="relative w-48 hidden sm:block">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                        <Input
                            placeholder="Rechercher..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8 bg-[#0D1117] border-white/5 text-xs h-8 focus-visible:ring-emerald-500/50 rounded-lg"
                        />
                    </div>
                </div>

                <div className="divide-y divide-white/5">
                    {filteredEmployees.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            <Wallet className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>Aucun employé trouvé</p>
                        </div>
                    ) : (
                        filteredEmployees.map((employee) => (
                            <div
                                key={employee.id}
                                className={cn(
                                    "p-4 flex flex-col sm:flex-row items-center gap-4 hover:bg-white/[0.02] transition-colors group",
                                    selectedEmployees.includes(employee.id) && "bg-emerald-500/5"
                                )}
                            >
                                <div className="flex items-center gap-4 w-full sm:w-auto">
                                    <Checkbox
                                        checked={selectedEmployees.includes(employee.id)}
                                        onCheckedChange={() => toggleSelectEmployee(employee.id)}
                                        className="border-white/20 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                                    />
                                    <Avatar className="h-10 w-10 border border-white/10">
                                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${employee.employeeName}`} />
                                        <AvatarFallback className="bg-[#21262d] text-gray-400 text-xs font-bold">{employee.initials}</AvatarFallback>
                                    </Avatar>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-white text-sm truncate group-hover:text-emerald-400 transition-colors">{employee.employeeName}</h4>
                                            {employee.status === 'paid' && (
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                            )}
                                        </div>
                                        <p className="text-gray-500 text-xs truncate">{employee.position}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 w-full sm:w-auto sm:ml-auto justify-between sm:justify-end">
                                    <Badge className={cn(
                                        "border-0 text-[10px] px-2 h-5",
                                        employee.status === 'paid'
                                            ? "bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500/20"
                                            : "bg-orange-500/10 text-orange-500 group-hover:bg-orange-500/20"
                                    )}>
                                        {employee.status === 'paid' ? 'PAYÉ' : 'EN ATTENTE'}
                                    </Badge>

                                    <div className="text-right min-w-[80px]">
                                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-0.5">Net à payer</p>
                                        <p className="text-sm font-bold text-white">
                                            {employee.netSalary.toLocaleString()} <span className="text-[10px] text-gray-600 font-normal">MRU</span>
                                        </p>
                                    </div>

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => onSelectTeacher({
                                            ...employee,
                                            base: employee.baseSalary,
                                            variable: employee.bonuses - employee.deductions,
                                            name: employee.employeeName,
                                            subject: employee.position
                                        })}
                                        className="text-gray-500 hover:text-white hover:bg-white/5 rounded-lg h-8 w-8"
                                    >
                                        <ChevronRight className="w-4 h-4" />
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
