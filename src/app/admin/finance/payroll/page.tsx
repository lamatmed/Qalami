'use client'

import { useState } from 'react'
import { PayrollOverview } from '@/components/admin/finance/payroll/payroll-overview'
import { SalaryDetails } from '@/components/admin/finance/payroll/salary-details'
import { PaymentConfirmation } from '@/components/admin/finance/payroll/payment-confirmation'
import { confirmPaymentAction } from './actions'

function generateTransactionId() {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
    return `PAY-${y}-${m}-${rand}`
}

export default function PayrollPage() {
    const [view, setView] = useState('overview')
    const [selectedTeacher, setSelectedTeacher] = useState<any>(null)
    const [confirmedNet, setConfirmedNet] = useState(0)
    const [confirmedBreakdown, setConfirmedBreakdown] = useState({ baseSalary: 0, bonuses: 0, deductions: 0 })
    const [transactionId, setTransactionId] = useState('')
    const [refreshKey, setRefreshKey] = useState(0)

    const handleSelectTeacher = (teacher: any) => {
        setSelectedTeacher(teacher)
        setView('details')
    }

    const handleBack = () => {
        setView('overview')
        setSelectedTeacher(null)
    }

    const handleValidate = (data: { netSalary: number, baseSalary: number, bonuses: number, deductions: number }) => {
        const txId = generateTransactionId()
        setTransactionId(txId)
        setConfirmedNet(data.netSalary)
        setConfirmedBreakdown({ baseSalary: data.baseSalary, bonuses: data.bonuses, deductions: data.deductions })
        setView('confirmation')

        if (selectedTeacher?.employeeId) {
            confirmPaymentAction({
                employeeId: selectedTeacher.employeeId,
                employeeName: selectedTeacher.name,
                baseSalary: data.baseSalary,
                bonuses: data.bonuses,
                deductions: data.deductions,
                netSalary: data.netSalary,
                transactionRef: txId,
            })
        }
    }

    const handleReset = () => {
        setView('overview')
        setSelectedTeacher(null)
        setConfirmedNet(0)
        setConfirmedBreakdown({ baseSalary: 0, bonuses: 0, deductions: 0 })
        setTransactionId('')
        setRefreshKey(k => k + 1)
    }

    return (
        <div className="p-6 h-full max-w-5xl mx-auto">
            {view === 'overview' && (
                <PayrollOverview
                    onSelectTeacher={handleSelectTeacher}
                    refreshKey={refreshKey}
                />
            )}
            {view === 'details' && selectedTeacher && (
                <SalaryDetails
                    teacher={selectedTeacher}
                    onBack={handleBack}
                    onValidate={handleValidate}
                />
            )}
            {view === 'confirmation' && selectedTeacher && (
                <PaymentConfirmation
                    teacher={selectedTeacher}
                    netSalary={confirmedNet}
                    breakdown={confirmedBreakdown}
                    transactionId={transactionId}
                    onReset={handleReset}
                />
            )}
        </div>
    )
}
