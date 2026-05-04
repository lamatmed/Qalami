import { getInvitationByToken } from '@/app/auth/actions'
import { InviteCompletionForm } from '@/components/auth/invite-completion-form'
import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

interface InvitePageProps {
    params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: InvitePageProps) {
    const { token } = await params
    const result = await getInvitationByToken(token)

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50/30 to-slate-100 flex items-center justify-center p-4">
            {/* Background effects */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 w-full max-w-md">
                {result.error ? (
                    <div className="backdrop-blur-xl bg-white/80 border border-white/40 shadow-2xl rounded-2xl p-8 md:p-10 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-50" />

                        <div className="flex justify-center mb-6">
                            <Image
                                src="/Logo.png"
                                alt="Qalami"
                                width={120}
                                height={48}
                                priority
                                className="drop-shadow-md"
                            />
                        </div>

                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="w-8 h-8 text-red-400" />
                        </div>

                        <h1 className="text-xl font-bold text-foreground mb-2">
                            Invitation invalide
                        </h1>
                        <p className="text-sm text-muted-foreground mb-6">
                            {result.error}
                        </p>

                        <Link
                            href="/login"
                            className="text-sm text-primary hover:underline"
                        >
                            Retour à la connexion
                        </Link>
                    </div>
                ) : (
                    <InviteCompletionForm
                        token={token}
                        invitation={result.invitation!}
                    />
                )}
            </div>
        </div>
    )
}
