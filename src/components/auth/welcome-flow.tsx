'use client'

import { useState } from 'react'
import { SplashScreen } from './splash-screen'
import { OnboardingCarousel } from './onboarding-carousel'
import { LoginForm } from './login-form'
import { AnimatePresence, motion } from 'framer-motion'

export function WelcomeFlow() {
    const [step, setStep] = useState<'splash' | 'onboarding' | 'login'>('splash')

    // Optional: Check if user has already seen onboarding in localStorage
    // For now we show it every time as requested or we can persist state

    return (
        <>
            <AnimatePresence mode="wait">
                {step === 'splash' && (
                    <SplashScreen key="splash" onComplete={() => setStep('onboarding')} />
                )}

                {step === 'onboarding' && (
                    <OnboardingCarousel key="onboarding" onComplete={() => setStep('login')} />
                )}
            </AnimatePresence>

            {/* Login is always rendered but hidden/revealed to ensure smooth transition? 
                Actually AnimatePresence is better for replacing views completely. 
                Login Form needs its own wrapper to match the style.
            */}

            {step === 'login' && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="relative min-h-screen w-full flex items-center justify-center bg-[#0D1117] overflow-hidden"
                >
                    {/* Background Gradients for Login */}
                    <div className="absolute inset-0 z-0">
                        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/10 blur-[120px] animate-pulse" />
                        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px] animate-pulse delay-700" />
                    </div>

                    <div className="relative z-10 w-full max-w-lg px-4">
                        <LoginForm />
                    </div>
                </motion.div>
            )}
        </>
    )
}
