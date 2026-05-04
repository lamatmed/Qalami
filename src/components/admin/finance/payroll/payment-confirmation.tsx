'use client'

import { Button } from '@/components/ui/button'
import { CheckCircle2, ArrowLeft, FileText, Download } from 'lucide-react'

export function PaymentConfirmation({ onReset }: { onReset: () => void }) {
    return (
        <div className="h-full flex flex-col items-center justify-center text-center space-y-8 animate-in zoom-in-50 duration-500 p-6">

            <div className="relative">
                <div className="bg-emerald-500/10 h-32 w-32 rounded-full flex items-center justify-center animate-pulse">
                    <div className="bg-emerald-500 h-20 w-20 rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/30">
                        <CheckCircle2 className="w-10 h-10 text-black" />
                    </div>
                </div>
                {/* Decorative Particles */}
                <div className="absolute top-0 right-0 h-3 w-3 bg-emerald-400 rounded-full animate-bounce delay-100"></div>
                <div className="absolute bottom-4 left-0 h-2 w-2 bg-purple-400 rounded-full animate-bounce delay-300"></div>
            </div>

            <div className="space-y-2 max-w-md">
                <h2 className="text-3xl font-bold text-white">Paiement validé !</h2>
                <p className="text-gray-400">Le paiement pour <span className="text-white font-bold">Ahmed Mahmoud</span> a été traité avec succès pour le mois d'Octobre.</p>
                <div className="mt-4 bg-[#1A2530] p-3 rounded-lg border border-white/5 inline-block">
                    <p className="text-xs text-slate-500 font-mono">ID TRANSPACTION: PAY-2023-10-42Q</p>
                </div>
            </div>

            {/* Auto-generated actions */}
            <div className="bg-[#1A2530] p-6 rounded-3xl border border-white/5 w-full max-w-sm space-y-4">
                <div className="flex items-center justify-between">
                    <span className="text-white font-bold text-sm">Envoyer l'avis</span>
                    <div className="h-5 w-9 bg-emerald-500 rounded-full relative cursor-pointer">
                        <div className="absolute right-1 top-1 h-3 w-3 bg-white rounded-full shadow-sm"></div>
                    </div>
                </div>
                <p className="text-xs text-gray-500 text-left">Informer l'enseignant par notification push et email automatiquement.</p>

                <div className="pt-4 border-t border-white/5 grid grid-cols-2 gap-3">
                    <Button variant="outline" className="border-white/10 hover:bg-white/5 text-white w-full">
                        <Download className="w-4 h-4 mr-2" /> Reçu
                    </Button>
                    <Button className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold w-full">
                        <FileText className="w-4 h-4 mr-2" /> Bulletin
                    </Button>
                </div>
            </div>

            <Button onClick={onReset} variant="ghost" className="text-gray-500 hover:text-white mt-8">
                <ArrowLeft className="w-4 h-4 mr-2" /> Retour à la gestion
            </Button>
        </div>
    )
}
