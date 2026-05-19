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

            <div className="relative z-11 w-full max-w-md">
                <InviteCompletionForm
                    token={token}
                    invitation={result.invitation || undefined}
                    error={result.error}
                />
            </div>
        </div>
    )
}
