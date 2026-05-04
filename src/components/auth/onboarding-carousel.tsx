'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import Image from 'next/image'
import { useLanguage } from '@/i18n'

const slides = [
    {
        id: 'connectivity',
        image: '/onboarding-1-rm.png',
        titleKey: 'onboarding.slide1.title',
        descKey: 'onboarding.slide1.desc',
        buttonColor: 'bg-purple-600 hover:bg-purple-700',
        buttonTextKey: 'onboarding.next',
        dotColor: 'bg-purple-600'
    },
    {
        id: 'tracking',
        image: '/onboarding-2-rm.png',
        titleKey: 'onboarding.slide2.title',
        descKey: 'onboarding.slide2.desc',
        buttonColor: 'bg-emerald-500 hover:bg-emerald-600',
        buttonTextKey: 'onboarding.next',
        dotColor: 'bg-emerald-500'
    },
    {
        id: 'gamification',
        image: '/onboarding-3-rm.png',
        titleKey: 'onboarding.slide3.title',
        descKey: 'onboarding.slide3.desc',
        buttonColor: 'bg-orange-500 hover:bg-orange-600',
        buttonTextKey: 'onboarding.start',
        dotColor: 'bg-orange-500'
    }
]

export function OnboardingCarousel({ onComplete }: { onComplete: () => void }) {
    const [currentIndex, setCurrentIndex] = useState(0)
    const { t, direction } = useLanguage()

    const nextSlide = () => {
        if (currentIndex < slides.length - 1) {
            setCurrentIndex(prev => prev + 1)
        } else {
            onComplete()
        }
    }

    const currentSlide = slides[currentIndex]

    return (
        <motion.div
            className="fixed inset-0 z-40 bg-gradient-to-b from-white to-gray-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ x: '-100%' }}
            dir={direction}
        >
            {/* Mobile-constrained container */}
            <div className="w-full max-w-md h-full max-h-[900px] flex flex-col relative">
                {/* Skip button */}
                <div className={`absolute top-4 z-50 ${direction === 'rtl' ? 'left-4' : 'right-4'}`}>
                    <Button
                        variant="ghost"
                        className="text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full px-4 text-sm"
                        onClick={onComplete}
                    >
                        {t('onboarding.skip')}
                    </Button>
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col pt-12">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentSlide.id}
                            initial={{ opacity: 0, x: direction === 'rtl' ? -50 : 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: direction === 'rtl' ? 50 : -50 }}
                            transition={{ duration: 0.3 }}
                            className="flex-1 flex flex-col"
                        >
                            {/* Image container */}
                            <div className="flex-1 relative flex items-center justify-center px-6">
                                <div className="relative w-full h-full max-h-[400px]">
                                    <Image
                                        src={currentSlide.image}
                                        alt={t(currentSlide.titleKey)}
                                        fill
                                        className="object-contain"
                                        priority
                                    />
                                </div>
                            </div>

                            {/* Text content */}
                            <div className="px-6 py-2 text-center">
                                <h2 className="text-3xl font-bold text-gray-900 mb-3 whitespace-pre-line leading-tight">
                                    {t(currentSlide.titleKey)}
                                </h2>
                                <p className="text-gray-500 text-sm leading-relaxed">
                                    {t(currentSlide.descKey)}
                                </p>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Bottom Controls */}
                <div className="px-6 pb-8 space-y-6">
                    {/* Dots */}
                    <div className="flex justify-center gap-2">
                        {slides.map((slide, idx) => (
                            <div
                                key={idx}
                                className={`h-2 rounded-full transition-all duration-300 ${idx === currentIndex
                                    ? `w-6 ${slide.dotColor}`
                                    : 'w-2 bg-gray-300'
                                    }`}
                            />
                        ))}
                    </div>

                    {/* Button */}
                    <Button
                        size="lg"
                        className={`w-full h-12 text-base font-semibold rounded-xl shadow-lg transition-all ${currentSlide.buttonColor} text-white`}
                        onClick={nextSlide}
                    >
                        {t(currentSlide.buttonTextKey)}
                        <ArrowRight className={`ml-2 w-5 h-5 ${direction === 'rtl' ? 'rotate-180' : ''}`} />
                    </Button>
                </div>
            </div>
        </motion.div>
    )
}

