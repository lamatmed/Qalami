'use client'

import { Button } from '@/components/ui/button'
import { CheckCircle2, FileText, UserPlus, Eye } from 'lucide-react'
import { RegistrationData } from '../registration-wizard'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n'

interface StepProps {
    data: RegistrationData
    updateData: (section: keyof RegistrationData, data: any) => void
    onNext: () => void
    onPrev: () => void
    savedCredentials?: { fullName: string; hasPhone: boolean; password: string | null; className: string } | null
}

export function Confirmation({ data, savedCredentials }: StepProps) {
    const router = useRouter()
    const { t, language } = useLanguage()

    const displayPin = savedCredentials?.hasPhone ? (savedCredentials.password || '----') : t('admin.students.register.confirmation.noStudentAccess')
    const displayName = savedCredentials?.fullName || `${data.personal.firstName} ${data.personal.lastName}`
    const displayClass = savedCredentials?.className || data.academic.className || t('admin.students.register.confirmation.unassigned')

    return (
        <div className="text-center py-6 space-y-6">
            <div className="flex justify-center">
                <div className="h-24 w-24 bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.4)] animate-in zoom-in duration-500">
                    <CheckCircle2 className="w-12 h-12 text-black" />
                </div>
            </div>

            <div>
                <h2 className="text-3xl font-bold text-white mb-2">{t('admin.students.register.confirmation.successTitle')}</h2>
                <p className="text-gray-400 max-w-sm mx-auto">
                    {t('admin.students.register.confirmation.successDescription')} <span className="text-white font-bold">{displayName}</span>.
                </p>
            </div>

            {/* Generated Card */}
            <div className="bg-gradient-to-br from-[#1A2530] to-[#0F1720] border border-white/10 rounded-3xl p-6 max-w-sm mx-auto shadow-2xl relative overflow-hidden text-left">
                <div className="absolute top-0 right-0 p-2 bg-emerald-500 text-black text-[10px] font-bold rounded-bl-xl">
                    {t('admin.students.register.confirmation.sessionLabel')}
                </div>

                <div className="flex items-center gap-4 mb-6 mt-2">
                    <div className="h-16 w-16 bg-[#253545] rounded-full"></div>
                    <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">{t('admin.students.register.confirmation.studentId')}</p>
                        <p className="text-emerald-400 font-mono font-bold">QAL-2024-089</p>
                        <p className="text-emerald-500 font-bold text-sm mt-1">{displayClass}</p>
                    </div>
                </div>

                <div className="bg-[#0F1720]/80 p-4 rounded-xl space-y-3 border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-xs font-bold text-emerald-500 uppercase">{t('admin.students.register.confirmation.temporaryCredentials')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500">{t('common.name')}:</span>
                        <span className="text-emerald-400 font-mono font-bold">{displayName}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500">{t('auth.pinLabel')}:</span>
                        <span className="text-emerald-400 font-mono font-bold">{displayPin}</span>
                    </div>
                </div>
                <p className="text-[10px] text-gray-500 mt-4 leading-relaxed">
                    {t('admin.students.register.confirmation.credentialsHint')}
                </p>
            </div>

            <div className="grid gap-3 max-w-sm mx-auto pt-4">
                <Button
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold h-12 rounded-xl"
                    onClick={() => {
                        // Create a printable receipt
                        const printWindow = window.open('', '_blank', 'width=600,height=800')
                        if (!printWindow) {
                            toast.error(t('admin.students.register.confirmation.printOpenError'))
                            return
                        }
                        const locale = language === 'ar' ? 'ar-u-ca-gregory' : 'fr-FR'
                        printWindow.document.write(`
                            <html>
                            <head><title>${t('admin.students.register.confirmation.receiptTitle')} - Qalami</title>
                            <style>
                                body { font-family: Arial, sans-serif; padding: 40px; max-width: 500px; margin: 0 auto; }
                                .header { text-align: center; margin-bottom: 30px; }
                                .header h1 { font-size: 24px; color: #10b981; margin: 0; }
                                .header p { color: #666; font-size: 12px; }
                                .card { border: 2px solid #10b981; border-radius: 12px; padding: 24px; margin: 20px 0; }
                                .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
                                .row:last-child { border: none; }
                                .label { color: #666; font-size: 14px; }
                                .value { font-weight: bold; font-size: 14px; }
                                .credentials { background: #f0fdf4; padding: 16px; border-radius: 8px; margin-top: 20px; border: 1px dashed #10b981; }
                                .credentials h3 { margin: 0 0 12px; color: #10b981; font-size: 14px; }
                                .footer { text-align: center; margin-top: 30px; color: #999; font-size: 11px; }
                            </style></head>
                            <body>
                                <div class="header">
                                    <h1>🎓 Qalami</h1>
                                    <p>${t('admin.students.register.confirmation.receiptTitle')} - ${t('admin.students.register.confirmation.schoolYear')} ${new Date().getFullYear() - 1}-${new Date().getFullYear()}</p>
                                </div>
                                <div class="card">
                                    <div class="row"><span class="label">${t('admin.students.register.confirmation.fullName')}</span><span class="value">${data.personal.firstName} ${data.personal.lastName}</span></div>
                                    <div class="row"><span class="label">${t('admin.students.class')}</span><span class="value">${data.academic.className || t('admin.students.register.confirmation.unassigned')}</span></div>
                                    <div class="row"><span class="label">${t('admin.students.register.confirmation.registrationFee')}</span><span class="value">${data.academic.registrationFee || '—'} MRU</span></div>
                                    <div class="row"><span class="label">${t('common.date')}</span><span class="value">${new Date().toLocaleDateString(locale)}</span></div>
                                </div>
                                <div class="credentials">
                                    <h3>🔑 ${t('admin.students.register.confirmation.temporaryCredentials')}</h3>
                                    <div class="row"><span class="label">${t('common.name')}</span><span class="value">${data.personal.firstName} ${data.personal.lastName}</span></div>
                                    <div class="row"><span class="label">${t('auth.password')}</span><span class="value">${savedCredentials?.hasPhone ? (savedCredentials.password || '—') : t('admin.students.register.confirmation.parentOnlyFollow')}</span></div>
                                </div>
                                <div class="footer">
                                    <p>* ${t('admin.students.register.confirmation.changePasswordHint')}</p>
                                    <p>${t('admin.students.register.confirmation.generatedBy')} - ${new Date().toLocaleString(locale)}</p>
                                </div>
                            </body></html>
                        `)
                        printWindow.document.close()
                        printWindow.focus()
                        setTimeout(() => printWindow.print(), 250)
                    }}
                >
                    <FileText className="mr-2 w-4 h-4" /> {t('admin.students.register.confirmation.printReceipt')}
                </Button>
                <Button
                    variant="outline"
                    className="w-full bg-[#1A2530] text-white border-white/5 hover:bg-[#23303d] h-12 rounded-xl"
                    onClick={() => router.push('/admin/students/register')}
                >
                    <UserPlus className="mr-2 w-4 h-4" /> {t('admin.students.register.confirmation.registerAnother')}
                </Button>
                <Button variant="ghost" onClick={() => router.push('/admin/students')} className="w-full text-gray-400 hover:text-white">
                    <Eye className="mr-2 w-4 h-4" /> {t('admin.students.register.confirmation.viewStudentsList')}
                </Button>
            </div>
        </div>
    )
}
