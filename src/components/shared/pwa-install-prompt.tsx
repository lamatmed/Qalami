'use client'

import { useState, useEffect } from 'react'
import { X, Download, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PwaInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
    const [showPrompt, setShowPrompt] = useState(false)
    const [isIOS, setIsIOS] = useState(false)
    const [isStandalone, setIsStandalone] = useState(false)

    useEffect(() => {
        // Check if already installed (standalone mode)
        const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches
            || (window.navigator as any).standalone === true
        setIsStandalone(isStandaloneMode)

        // Check if iOS
        const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
        setIsIOS(iOS)

        // Check if user dismissed before (within last 7 days)
        const dismissedAt = localStorage.getItem('pwa-prompt-dismissed')
        if (dismissedAt) {
            const dismissedDate = new Date(dismissedAt)
            const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24)
            if (daysSinceDismissed < 7) {
                return // Don't show if dismissed within 7 days
            }
        }

        // Listen for beforeinstallprompt event (Android/Chrome)
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault()
            setDeferredPrompt(e as BeforeInstallPromptEvent)
            // Show prompt after a short delay
            setTimeout(() => setShowPrompt(true), 2000)
        }

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

        // For iOS, show prompt if not in standalone mode
        if (iOS && !isStandaloneMode) {
            setTimeout(() => setShowPrompt(true), 2000)
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
        }
    }, [])

    const handleInstall = async () => {
        if (deferredPrompt) {
            // Android/Chrome install
            await deferredPrompt.prompt()
            const { outcome } = await deferredPrompt.userChoice
            if (outcome === 'accepted') {
                setShowPrompt(false)
            }
            setDeferredPrompt(null)
        }
    }

    const handleDismiss = () => {
        setShowPrompt(false)
        localStorage.setItem('pwa-prompt-dismissed', new Date().toISOString())
    }

    // Don't show if already installed or shouldn't show
    if (isStandalone || !showPrompt) return null

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 animate-in slide-in-from-bottom-4 duration-500">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-4 shadow-2xl shadow-indigo-500/20 border border-white/10">
                <button
                    onClick={handleDismiss}
                    className="absolute top-3 right-3 text-white/60 hover:text-white transition-colors"
                    aria-label="Fermer"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                        <Smartphone className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-white font-bold text-base mb-1">
                            Installer Qalami
                        </h3>
                        <p className="text-white/70 text-sm leading-snug">
                            {isIOS
                                ? "Ajoutez Qalami à votre écran d'accueil pour un accès rapide !"
                                : "Installez l'application pour un accès plus rapide et une meilleure expérience !"}
                        </p>
                    </div>
                </div>

                {isIOS ? (
                    <div className="mt-4 bg-white/10 rounded-xl p-3">
                        <p className="text-white/90 text-xs leading-relaxed">
                            <span className="font-semibold">Comment faire :</span><br />
                            1. Appuyez sur <span className="inline-flex items-center px-1.5 py-0.5 bg-white/20 rounded text-[10px] mx-0.5">Partager</span> en bas<br />
                            2. Sélectionnez <span className="inline-flex items-center px-1.5 py-0.5 bg-white/20 rounded text-[10px] mx-0.5">Sur l'écran d'accueil</span>
                        </p>
                    </div>
                ) : (
                    <div className="mt-4 flex gap-2">
                        <Button
                            onClick={handleDismiss}
                            variant="ghost"
                            className="flex-1 text-white/70 hover:text-white hover:bg-white/10"
                        >
                            Plus tard
                        </Button>
                        <Button
                            onClick={handleInstall}
                            className="flex-1 bg-white text-indigo-600 hover:bg-white/90 font-bold"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Installer
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}
