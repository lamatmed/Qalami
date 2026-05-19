import { SuperAdminSidebar } from '@/components/super-admin/sidebar'
import { SuperAdminMobileNav } from '@/components/super-admin/mobile-nav'
import { SuperAdminProvider } from '@/context/super-admin-context'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Shield, Sparkles } from 'lucide-react'
import { SuperAdminLayoutWrapper } from '@/components/super-admin/layout-wrapper'

export default async function SuperAdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    // Only super_admin can access this area
    if (profile?.role !== 'super_admin') {
        redirect('/')
    }

    return (
        <SuperAdminProvider>
            <SuperAdminLayoutWrapper>
                {/* Sidebar — desktop only */}
                <SuperAdminSidebar />

                <main className="flex-1 overflow-y-auto pb-24 lg:pb-0 min-w-0">
                    {/* Desktop header */}
                    <header className="hidden lg:flex bg-white/60 dark:bg-slate-900/40 border-b border-slate-200/60 dark:border-white/5 px-6 lg:px-8 py-4 justify-between items-center sticky top-0 z-20 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">
                        <div className="flex items-center gap-3 group">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/10 to-indigo-500/10 text-purple-500 group-hover:scale-110 transition-transform">
                                <Shield className="w-5 h-5" />
                            </div>
                            <span className="font-bold text-slate-800 dark:text-slate-100 tracking-tight">Super Admin Control</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="hidden sm:flex items-center px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 text-xs font-medium text-slate-600 dark:text-slate-400 transition-colors">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 animate-pulse" />
                                {user.email}
                            </div>
                        </div>
                    </header>

                    {/* Mobile top bar */}
                    <header className="lg:hidden h-12 bg-slate-900/95 backdrop-blur-xl border-b border-white/5 px-4 flex items-center justify-between sticky top-0 z-20">
                        <div className="flex items-center gap-2.5">
                            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-purple-600/20 border border-purple-500/20 shrink-0">
                                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                            </div>
                            <div>
                                <span className="font-extrabold text-sm text-white tracking-tight leading-none">Qalami</span>
                                <p className="text-[9px] font-black text-purple-400 tracking-widest uppercase leading-none">Superadmin</p>
                            </div>
                        </div>
                        <div className="flex items-center px-2.5 py-1 rounded-full bg-white/5 border border-white/5 text-[10px] font-medium text-slate-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                            <span className="truncate max-w-[140px]">{user.email}</span>
                        </div>
                    </header>

                    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
                        {children}
                    </div>
                </main>

                {/* Mobile bottom navigation */}
                <SuperAdminMobileNav />
            </SuperAdminLayoutWrapper>
        </SuperAdminProvider>
    )
}
