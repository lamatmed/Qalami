'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Wallet, Clock, Trophy, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react'
import { useLanguage } from '@/i18n'

export function SalaryDetails({ teacher, onBack, onValidate }: { teacher: any, onBack: () => void, onValidate: () => void }) {
    const { t } = useLanguage()
    const [overtimeHours, setOvertimeHours] = useState(8)
    const [bonus, setBonus] = useState(5000)

    // Calculations

    const overtimeRate = 400; // MRU per hour
    const overtimeTotal = overtimeHours * overtimeRate
    const absences = 2800
    const socialCotisation = 1450

    // Logic for Hourly (Simulated for teacher id 2)
    const isHourly = teacher.id === 2
    const hourlyVolume = 80 // Mock hours worked
    const baseSalary = isHourly ? (hourlyVolume * 500) : teacher.base

    const netSalary = baseSalary + overtimeTotal + bonus - absences - socialCotisation

    return (
        <div className="space-y-6 animate-in slide-in-from-right duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={onBack} className="text-gray-400 hover:text-white -ml-2 gap-2">
                    <ArrowLeft className="w-4 h-4" /> {t('admin.payroll.back')}
                </Button>
                <div className="flex items-center gap-2 bg-[#1A2530] px-3 py-1.5 rounded-full border border-white/5">
                    <Calendar className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-xs font-bold text-white">{t('admin.payroll.october2023')}</span>
                </div>
            </div>

            {/* Teacher Profile Card */}
            <div className="bg-[#1A2530] rounded-3xl border border-white/5 p-6 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                <div className="relative">
                    <div className="h-20 w-20 rounded-full bg-gray-700 flex items-center justify-center text-2xl font-bold text-white shadow-xl border-4 border-[#0F1720]">
                        {teacher.name.charAt(0)}
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-orange-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-[#1A2530]">
                        {t('admin.payroll.pendingStatusUpper')}
                    </div>
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-white">{teacher.name}</h2>
                    <p className="text-gray-400 text-sm">{teacher.subject}</p>
                    <p className="text-gray-500 text-xs font-mono mt-1">{t('admin.payroll.id')}: QA-2023-089</p>
                </div>
                <div className="sm:ml-auto bg-[#0F1720] rounded-2xl p-4 border border-white/5 min-w-[200px]">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-500">
                            <Wallet className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase font-bold">
                                {teacher.id === 2 ? t('admin.payroll.hourlyRate') : t('admin.payroll.baseSalary')}
                            </p>
                            <p className="text-white font-bold">
                                {teacher.id === 2 ? '500' : teacher.base.toLocaleString()} <span className="text-xs font-normal text-gray-500">MRU{teacher.id === 2 ? '/h' : ''}</span>
                            </p>
                        </div>
                    </div>
                    <Badge variant="outline" className="w-full justify-center bg-white/5 border-white/10 text-gray-400 font-normal py-1">
                        {teacher.id === 2 ? t('admin.payroll.hourlyContract') : t('admin.payroll.fullTimeContract')}
                    </Badge>
                </div>
            </div>

            {/* Variable Components */}
            <div className="bg-[#1A2530] rounded-3xl border border-white/5 overflow-hidden">
                <div className="p-4 bg-[#0F1720]/50 border-b border-white/5">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">{t('admin.payroll.variableComponents')}</h3>
                </div>

                <div className="p-6 space-y-6">
                    {/* Overtime */}
                    <div className="bg-[#0F1720] rounded-2xl p-4 border border-white/5 hover:border-emerald-500/30 transition-colors">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-emerald-500" />
                                <span className="font-bold text-white">{t('admin.payroll.overtime')}</span>
                            </div>
                            <span className="text-emerald-500 font-bold">+{overtimeTotal.toLocaleString()} MRU</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <input
                                    type="range"
                                    min="0"
                                    max="20"
                                    value={overtimeHours}
                                    onChange={(e) => setOvertimeHours(parseInt(e.target.value))}
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                />
                            </div>
                            <div className="bg-[#1A2530] px-3 py-1.5 rounded-lg border border-white/5 flex items-center gap-2 min-w-[100px] justify-center">
                                <span className="text-white font-mono font-bold">{overtimeHours}</span>
                                <span className="text-gray-500 text-xs text-right">{t('admin.payroll.hours')}</span>
                            </div>
                        </div>
                    </div>

                    {/* Bonus */}
                    <div className="bg-[#0F1720] rounded-2xl p-4 border border-white/5 hover:border-emerald-500/30 transition-colors">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2">
                                <Trophy className="w-4 h-4 text-emerald-500" />
                                <span className="font-bold text-white">{t('admin.payroll.excellenceBonus')}</span>
                            </div>
                            <span className="text-emerald-500 font-bold">+{bonus.toLocaleString()} MRU</span>
                        </div>
                        <div className="flex items-center">
                            <input
                                type="text"
                                value={bonus}
                                onChange={(e) => setBonus(parseInt(e.target.value) || 0)}
                                className="w-full bg-[#1A2530] border-white/10 text-white font-bold p-3 rounded-xl focus:ring-emerald-500 focus:border-emerald-500"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Deductions */}
            <div className="bg-[#1A2530] rounded-3xl border border-white/5 overflow-hidden">
                <div className="p-4 bg-[#0F1720]/50 border-b border-white/5">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">{t('admin.payroll.deductions')}</h3>
                </div>
                <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between group cursor-pointer">
                        <div className="flex items-center gap-4">
                            <div className="bg-red-500/10 p-2.5 rounded-xl text-red-500 group-hover:bg-red-500 group-hover:text-black transition-colors">
                                <Calendar className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-white font-bold">{t('admin.payroll.absences')}</p>
                                <p className="text-xs text-gray-500">{t('admin.payroll.absencesSub')}</p>
                            </div>
                        </div>
                        <span className="text-red-400 font-bold">-{absences.toLocaleString()} MRU</span>
                    </div>

                    <div className="flex items-center justify-between group cursor-pointer">
                        <div className="flex items-center gap-4">
                            <div className="bg-blue-500/10 p-2.5 rounded-xl text-blue-500 group-hover:bg-blue-500 group-hover:text-black transition-colors">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-white font-bold">{t('admin.payroll.socialContribution')}</p>
                                <p className="text-xs text-gray-500">{t('admin.payroll.socialContributionSub')}</p>
                            </div>
                        </div>
                        <span className="text-gray-400 font-bold">-{socialCotisation.toLocaleString()} MRU</span>
                    </div>
                </div>
            </div>

            {/* Footer Summary */}
            <div className="bg-gradient-to-r from-[#1A2530] to-[#1A2530] rounded-3xl border border-white/5 p-6 sticky bottom-4 shadow-2xl">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm">{t('admin.payroll.totalGross')}</span>
                    <span className="text-gray-400 text-sm">{(teacher.base + overtimeTotal + bonus).toLocaleString()} MRU</span>
                </div>
                <div className="flex items-center justify-between mb-6 pb-6 border-b border-white/5">
                    <span className="text-red-400 text-sm">{t('admin.payroll.totalDeductions')}</span>
                    <span className="text-red-400 text-sm">{(absences + socialCotisation).toLocaleString()} MRU</span>
                </div>

                <div className="flex items-center justify-between gap-6">
                    <div>
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">{t('admin.payroll.netToPayUpper')}</p>
                        <h2 className="text-3xl font-black text-white">{netSalary.toLocaleString()} <span className="text-lg text-emerald-500">MRU</span></h2>
                    </div>

                    <div className="flex gap-3">
                        <Button variant="outline" className="border-white/10 text-white hover:bg-white/5 bg-[#0F1720] h-12 px-6">
                            <FileText className="w-4 h-4 mr-2" /> {t('admin.payroll.slip')}
                        </Button>
                        <Button onClick={onValidate} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 px-8 shadow-lg shadow-emerald-900/20">
                            <CheckCircle2 className="w-4 h-4 mr-2" /> {t('admin.payroll.validate')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function Calendar(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
        </svg>
    )
}
