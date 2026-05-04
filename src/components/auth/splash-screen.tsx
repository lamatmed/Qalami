'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { useLanguage } from '@/i18n'

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
    const { t, direction } = useLanguage()

    useEffect(() => {
        const timer = setTimeout(onComplete, 3000) // 3s display time
        return () => clearTimeout(timer)
    }, [onComplete])

    return (
        <motion.div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-cyan-50 via-white to-blue-50"
            dir={direction}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            {/* Decorative background circles */}
            <div className="absolute inset-0 overflow-hidden">
                <motion.div
                    className="absolute top-[10%] left-[10%] w-64 h-64 bg-cyan-200/30 rounded-full blur-3xl"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
                    transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                />
                <motion.div
                    className="absolute bottom-[10%] right-[10%] w-72 h-72 bg-blue-200/30 rounded-full blur-3xl"
                    animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }}
                    transition={{ repeat: Infinity, duration: 4, ease: "easeInOut", delay: 1 }}
                />
            </div>

            <div className="relative z-10">
                {/* Logo with animation */}
                <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.8, type: 'spring', bounce: 0.4 }}
                    className="mb-8"
                >
                    <Image
                        src="/Logo.png"
                        alt="Qalami"
                        width={280}
                        height={112}
                        priority
                        className="drop-shadow-xl"
                    />
                </motion.div>

                {/* Subtitle */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-center"
                >
                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-[0.25em]">
                        {t('splash.subtitle')}
                    </p>
                </motion.div>

                {/* Loading dots */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="flex justify-center gap-1.5 mt-8"
                >
                    <span className="w-2 h-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2 h-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2 h-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 animate-bounce" />
                </motion.div>
            </div>
        </motion.div>
    )
}
