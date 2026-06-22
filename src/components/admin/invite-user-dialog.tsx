'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { InvitationSchema } from '@/app/auth/schemas'
import { createInvitation } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Loader2, UserPlus, Link2, Copy, CheckCircle2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n'

interface InviteUserDialogProps {
    children: React.ReactNode
}

export function InviteUserDialog({ children }: InviteUserDialogProps) {
    const { t } = useLanguage()
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [inviteLink, setInviteLink] = useState<string | null>(null)
    const [inviteName, setInviteName] = useState('')
    const [inviteRole, setInviteRole] = useState('')
    const [copied, setCopied] = useState(false)

    const form = useForm({
        resolver: zodResolver(InvitationSchema),
        defaultValues: {
            fullName: '',
            email: '',
            phone: '',
            role: undefined as any,
        },
    })

    async function onSubmit(data: z.infer<typeof InvitationSchema>) {
        setIsLoading(true)
        try {
            const result = await createInvitation(data)
            if (result?.error) {
                toast.error(t(result.error, (result as any).params))
            } else if (result?.token) {
                const link = `${window.location.origin}/invite/${result.token}`
                setInviteLink(link)
                setInviteName(data.fullName)
                setInviteRole(data.role)
                setInviteRole(data.role)
                toast.success(t('auth.invitationCreated'))
            }
        } catch {
            toast.error(t('auth.creationError'))
        } finally {
            setIsLoading(false)
        }
    }

    function handleCopy() {
        if (inviteLink) {
            navigator.clipboard.writeText(inviteLink)
            setCopied(true)
            toast.success(t('auth.linkCopied'))
            setTimeout(() => setCopied(false), 2000)
        }
    }

    function handleWhatsApp() {
        if (!inviteLink) return
        const roleLabels: Record<string, string> = {
            student: t('common.student'),
            parent: t('common.parent'),
            teacher: t('common.teacher'),
        }
        const message = `${t('auth.whatsAppMessage', { name: inviteName, role: roleLabels[inviteRole] || inviteRole })}\n${inviteLink}`
        const url = `https://wa.me/?text=${encodeURIComponent(message)}`
        window.open(url, '_blank')
    }

    function handleReset() {
        setInviteLink(null)
        setInviteName('')
        setInviteRole('')
        setCopied(false)
        form.reset()
    }

    return (
        <Dialog open={open} onOpenChange={(v) => {
            setOpen(v)
            if (!v) handleReset()
        }}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-primary" />
                        {t('auth.inviteUser')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('auth.inviteUserDesc')}
                    </DialogDescription>
                </DialogHeader>

                <AnimatePresence mode="wait">
                    {!inviteLink ? (
                        <motion.div
                            key="form"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="fullName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('auth.fullName')}</FormLabel>
                                                <FormControl>
                                                    <Input placeholder={t('admin.teachers.fullNamePlaceholder')} {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="phone"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('common.phone')}</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="+222 XX XX XX XX" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('auth.emailOptional')}</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="email@exemple.com" type="email" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="role"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('auth.role')}</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder={t('auth.selectRolePlaceholder')} />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="student">{t('common.student')}</SelectItem>
                                                        <SelectItem value="parent">{t('common.parent')}</SelectItem>
                                                        <SelectItem value="teacher">{t('common.teacher')}</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <Button
                                        className="w-full"
                                        type="submit"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <>
                                                <Link2 className="h-4 w-4 me-2" />
                                                {t('auth.generateLink')}
                                            </>
                                        )}
                                    </Button>
                                </form>
                            </Form>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-4"
                        >
                            <div className="flex items-center gap-2 text-emerald-500 mb-2">
                                <CheckCircle2 className="w-5 h-5" />
                                <span className="font-medium">{t('auth.invitationCreated')}</span>
                            </div>

                            <div className="p-3 bg-muted/50 rounded-lg break-all text-sm text-muted-foreground font-mono">
                                {inviteLink}
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    onClick={handleWhatsApp}
                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                >
                                    <Send className="h-4 w-4 me-2" />
                                    WhatsApp
                                </Button>
                                <Button
                                    onClick={handleCopy}
                                    variant="outline"
                                    className="flex-1"
                                >
                                    {copied ? (
                                        <CheckCircle2 className="h-4 w-4 me-2 text-emerald-500" />
                                    ) : (
                                        <Copy className="h-4 w-4 me-2" />
                                    )}
                                    {copied ? t('auth.copied') : t('auth.copy')}
                                </Button>
                            </div>

                            <Button
                                onClick={handleReset}
                                variant="ghost"
                                className="w-full"
                            >
                                <UserPlus className="h-4 w-4 me-2" />
                                {t('auth.inviteAnother')}
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </DialogContent>
        </Dialog>
    )
}
