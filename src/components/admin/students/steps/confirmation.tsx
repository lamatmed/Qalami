'use client'

import { Button } from '@/components/ui/button'
import { CheckCircle2, FileText, UserPlus, Eye } from 'lucide-react'
import { RegistrationData } from '../registration-wizard'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface StepProps {
    data: RegistrationData
    updateData: (section: keyof RegistrationData, data: any) => void
    onNext: () => void
    onPrev: () => void
    savedCredentials?: { fullName: string; hasPhone: boolean; password: string | null; className: string } | null
}

export function Confirmation({ data, savedCredentials }: StepProps) {
    const router = useRouter()

    const displayPin = savedCredentials?.hasPhone ? (savedCredentials.password || '----') : 'Aucun accès (suivi parent)'
    const displayName = savedCredentials?.fullName || `${data.personal.firstName} ${data.personal.lastName}`
    const displayClass = savedCredentials?.className || data.academic.className || 'Non affecté'

    return (
        <div className="text-center py-6 space-y-6">
            <div className="flex justify-center">
                <div className="h-24 w-24 bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.4)] animate-in zoom-in duration-500">
                    <CheckCircle2 className="w-12 h-12 text-black" />
                </div>
            </div>

            <div>
                <h2 className="text-3xl font-bold text-white mb-2">Élève inscrit avec succès !</h2>
                <p className="text-gray-400 max-w-sm mx-auto">
                    Le dossier de <span className="text-white font-bold">{displayName}</span> a été validé et enregistré dans le système Qalami.
                </p>
            </div>

            {/* Generated Card */}
            <div className="bg-gradient-to-br from-[#1A2530] to-[#0F1720] border border-white/10 rounded-3xl p-6 max-w-sm mx-auto shadow-2xl relative overflow-hidden text-left">
                <div className="absolute top-0 right-0 p-2 bg-emerald-500 text-black text-[10px] font-bold rounded-bl-xl">
                    SESSION 2024-2025
                </div>

                <div className="flex items-center gap-4 mb-6 mt-2">
                    <div className="h-16 w-16 bg-[#253545] rounded-full"></div>
                    <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">ID Étudiant</p>
                        <p className="text-emerald-400 font-mono font-bold">QAL-2024-089</p>
                        <p className="text-emerald-500 font-bold text-sm mt-1">{displayClass}</p>
                    </div>
                </div>

                <div className="bg-[#0F1720]/80 p-4 rounded-xl space-y-3 border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-xs font-bold text-emerald-500 uppercase">Identifiants Temporaires</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Nom:</span>
                        <span className="text-emerald-400 font-mono font-bold">{displayName}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Code PIN:</span>
                        <span className="text-emerald-400 font-mono font-bold">{displayPin}</span>
                    </div>
                </div>
                <p className="text-[10px] text-gray-500 mt-4 leading-relaxed">
                    * Ces identifiants sont valables pour la première connexion uniquement. Recommandez aux parents de les modifier.
                </p>
            </div>

            <div className="grid gap-3 max-w-sm mx-auto pt-4">
                <Button
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold h-12 rounded-xl"
                    onClick={() => {
                        // Create a printable receipt
                        const printWindow = window.open('', '_blank', 'width=600,height=800')
                        if (!printWindow) {
                            toast.error('Impossible d\'ouvrir la fenêtre d\'impression')
                            return
                        }
                        printWindow.document.write(`
                            <html>
                            <head><title>Reçu d'inscription - Qalami</title>
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
                                    <p>Reçu d'inscription - Année scolaire ${new Date().getFullYear() - 1}-${new Date().getFullYear()}</p>
                                </div>
                                <div class="card">
                                    <div class="row"><span class="label">Nom complet</span><span class="value">${data.personal.firstName} ${data.personal.lastName}</span></div>
                                    <div class="row"><span class="label">Classe</span><span class="value">${data.academic.className || 'Non affecté'}</span></div>
                                    <div class="row"><span class="label">Frais d'inscription</span><span class="value">${data.academic.registrationFee || '—'} MRU</span></div>
                                    <div class="row"><span class="label">Date</span><span class="value">${new Date().toLocaleDateString('fr-FR')}</span></div>
                                </div>
                                <div class="credentials">
                                    <h3>🔑 Identifiants (temporaires)</h3>
                                    <div class="row"><span class="label">Nom</span><span class="value">${data.personal.firstName} ${data.personal.lastName}</span></div>
                                    <div class="row"><span class="label">Mot de passe</span><span class="value">${savedCredentials?.hasPhone ? (savedCredentials.password || '—') : 'Suivi parent uniquement'}</span></div>
                                </div>
                                <div class="footer">
                                    <p>* Changez votre mot de passe lors de la première connexion.</p>
                                    <p>Généré par Qalami - ${new Date().toLocaleString('fr-FR')}</p>
                                </div>
                            </body></html>
                        `)
                        printWindow.document.close()
                        printWindow.focus()
                        setTimeout(() => printWindow.print(), 250)
                    }}
                >
                    <FileText className="mr-2 w-4 h-4" /> Imprimer le reçu
                </Button>
                <Button
                    variant="outline"
                    className="w-full bg-[#1A2530] text-white border-white/5 hover:bg-[#23303d] h-12 rounded-xl"
                    onClick={() => router.push('/admin/students/register')}
                >
                    <UserPlus className="mr-2 w-4 h-4" /> Inscrire un autre élève
                </Button>
                <Button variant="ghost" onClick={() => router.push('/admin/students')} className="w-full text-gray-400 hover:text-white">
                    <Eye className="mr-2 w-4 h-4" /> Voir la liste des élèves
                </Button>
            </div>
        </div>
    )
}
