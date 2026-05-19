import { Phone } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { TeacherProvider } from '@/context/teacher-context'
import { TeacherSpaceTitle } from '@/components/teacher/space-title'
import { TeacherLayoutFrame } from '@/components/teacher/layout-frame'

export default async function TeacherLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, phone, avatar_url, full_name')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'teacher' && profile?.role !== 'super_admin' && profile?.role !== 'admin') {
        redirect('/')
    }

    const initials = profile?.full_name
        ? profile.full_name.split(' ').map((n: any) => n[0]).join('').toUpperCase().substring(0, 2)
        : '?'

    const headerNode = (
        <header className="bg-white/80 dark:bg-card/85 backdrop-blur-md border-b px-6 sm:px-8 py-4 flex justify-between items-center sticky top-0 z-40 shadow-[0_1px_2px_rgba(0,0,0,0.02)] shrink-0">
            <TeacherSpaceTitle />
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                    {(profile?.phone || user.email) && (
                        <div className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-150 dark:border-white/10 text-slate-600 dark:text-slate-300 font-extrabold tracking-wide shadow-[0_1px_3px_rgba(0,0,0,0.05)] text-xs transition-all hover:bg-white hover:shadow-md dark:hover:bg-white/10 cursor-default group select-none">
                            <Phone className="w-3.5 h-3.5 text-indigo-500 group-hover:scale-110 transition-transform" />
                            <span dir="ltr">{profile?.phone || user.email}</span>
                        </div>
                    )}
                    
                    {/* Clickable Teacher Profile Widget */}
                    <Link 
                        href="/teacher/settings" 
                        title={profile?.full_name || "Paramètres"}
                        className="group focus:outline-none"
                    >
                        <div className="w-9 h-9 rounded-xl overflow-hidden border border-indigo-100 dark:border-indigo-500/20 shadow-sm flex items-center justify-center bg-slate-50 dark:bg-slate-850 group-hover:border-indigo-400 group-hover:shadow transition-all duration-300 shrink-0">
                            {profile?.avatar_url ? (
                                <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                            ) : (
                                <div className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                                    {initials}
                                </div>
                            )}
                        </div>
                    </Link>
                </div>
            </div>
        </header>
    )

    return (
        <TeacherProvider>
            <TeacherLayoutFrame header={headerNode}>
                <div className="p-4 sm:p-6 lg:p-8">
                    {children}
                </div>
            </TeacherLayoutFrame>
        </TeacherProvider>
    )
}
