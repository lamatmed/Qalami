'use client'

import { motion } from 'framer-motion'
import { ArrowLeft, MessageCircle, Mail, Phone, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/i18n'
import Link from 'next/link'
import Image from 'next/image'
import { LanguageSwitcher } from '@/components/shared/language-switcher'

export default function ContactAdminPage() {
    const { t, direction } = useLanguage()
    const isRtl = direction === 'rtl'

    const contactMethods = [
        {
            id: 'whatsapp',
            icon: MessageCircle,
            title: t('contact.whatsapp'),
            desc: t('contact.whatsappDesc'),
            action: 'https://wa.me/22237001001', // Example number
            color: 'from-green-500 to-emerald-600',
            bgLight: 'bg-green-50 text-green-600',
        },
        {
            id: 'call',
            icon: Phone,
            title: t('contact.call'),
            desc: t('contact.callDesc'),
            action: 'tel:+22237001001',
            color: 'from-blue-500 to-indigo-600',
            bgLight: 'bg-blue-50 text-blue-600',
        },
        {
            id: 'email',
            icon: Mail,
            title: t('contact.email'),
            desc: t('contact.emailDesc'),
            action: 'mailto:admin@qalami.mr',
            color: 'from-violet-500 to-purple-600',
            bgLight: 'bg-violet-50 text-violet-600',
        }
    ]

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-gray-100 to-slate-200" dir={direction}>
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="w-full max-w-lg"
            >
                <div className="backdrop-blur-2xl bg-white/70 border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-3xl p-8 relative overflow-hidden">
                    {/* Decorative background shapes */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-emerald-400/20 to-teal-400/20 rounded-full blur-3xl" />
                    <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-gradient-to-tr from-blue-400/20 to-indigo-400/20 rounded-full blur-3xl" />

                    <div className="relative z-10">
                        {/* Logo & Language */}
                        <div className="flex justify-between items-start mb-8">
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                            >
                                <Image
                                    src="/Logo.png"
                                    alt="Qalami"
                                    width={110}
                                    height={44}
                                    priority
                                    className="drop-shadow-sm"
                                />
                            </motion.div>
                            <LanguageSwitcher variant="compact" className="bg-white/50 border border-black/5" />
                        </div>

                        {/* Header */}
                        <div className="mb-8">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring' as const, stiffness: 200, damping: 15, delay: 0.3 }}
                                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shadow-lg shadow-slate-900/20 mb-6"
                            >
                                <MessageCircle className="h-8 w-8 text-white" />
                            </motion.div>
                            <motion.h1 
                                initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.4 }}
                                className="text-3xl font-extrabold text-slate-900 tracking-tight"
                            >
                                {t('contact.title')}
                            </motion.h1>
                            <motion.p 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 }}
                                className="text-base text-slate-500 mt-3 leading-relaxed"
                            >
                                {t('contact.description')}
                            </motion.p>
                        </div>

                        {/* Contact Methods */}
                        <div className="space-y-4 mb-8">
                            {contactMethods.map((method, index) => (
                                <motion.a
                                    key={method.id}
                                    href={method.action}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.6 + index * 0.1 }}
                                    className="group flex items-center p-4 rounded-2xl bg-white/60 hover:bg-white border border-white hover:border-slate-200 shadow-sm hover:shadow-md transition-all duration-300"
                                >
                                    <div className={`w-12 h-12 rounded-xl ${method.bgLight} flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 duration-300`}>
                                        <method.icon className="h-6 w-6" />
                                    </div>
                                    <div className={`flex-1 ${isRtl ? 'mr-4' : 'ml-4'}`}>
                                        <h3 className="font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors">{method.title}</h3>
                                        <p className="text-sm text-slate-500 mt-0.5">{method.desc}</p>
                                    </div>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-slate-50 group-hover:text-emerald-600 transition-colors ${isRtl ? 'mr-auto rotate-180' : 'ml-auto'}`}>
                                        <ExternalLink className="h-4 w-4" />
                                    </div>
                                </motion.a>
                            ))}
                        </div>

                        {/* Back Button */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.9 }}
                        >
                            <Link href="/login">
                                <Button
                                    variant="outline"
                                    className="w-full h-14 rounded-2xl border-slate-200 text-slate-700 font-medium hover:bg-slate-50 hover:text-slate-900 transition-all duration-300"
                                >
                                    <ArrowLeft className={`h-4 w-4 ${isRtl ? 'ml-2 rotate-180' : 'mr-2'}`} />
                                    {t('contact.backToLogin')}
                                </Button>
                            </Link>
                        </motion.div>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
