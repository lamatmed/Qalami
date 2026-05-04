'use client'

import { useState } from 'react'
import { PayrollOverview } from '@/components/admin/finance/payroll/payroll-overview'
import { SalaryDetails } from '@/components/admin/finance/payroll/salary-details'
import { PaymentConfirmation } from '@/components/admin/finance/payroll/payment-confirmation'

export default function PayrollPage() {
    const [view, setView] = useState('overview') // overview, details, confirmation
    const [selectedTeacher, setSelectedTeacher] = useState<any>(null)

    const handleSelectTeacher = (teacher: any) => {
        setSelectedTeacher(teacher)
        setView('details')
    }

    const handleBack = () => {
        setView('overview')
        setSelectedTeacher(null)
    }

    const handleValidate = () => {
        setView('confirmation')
    }

    const handleReset = () => {
        setView('overview')
        setSelectedTeacher(null)
    }

    return (
        <div className="p-6 h-full max-w-5xl mx-auto">
            {view === 'overview' && <PayrollOverview onSelectTeacher={handleSelectTeacher} />}
            {view === 'details' && selectedTeacher && (
                <SalaryDetails
                    teacher={selectedTeacher}
                    onBack={handleBack}
                    onValidate={handleValidate}
                />
            )}
            {view === 'confirmation' && <PaymentConfirmation onReset={handleReset} />}
        </div>
    )
}
