import { SuperAdminSidebar } from '@/components/super-admin/sidebar'
import { SuperAdminProvider } from '@/context/super-admin-context'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Shield } from 'lucide-react'
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
                <SuperAdminSidebar />
                <main className="flex-1 overflow-y-auto">
                    <header className="bg-white/80 dark:bg-slate-900/50 border-b border-gray-200 dark:border-white/10 px-8 py-4 flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm">
                        <div className="flex items-center gap-3">
                            <Shield className="w-5 h-5 text-purple-500" />
                            <span className="font-bold text-gray-900 dark:text-white">Super Admin</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-500 dark:text-gray-400">{user.email}</span>
                        </div>
                    </header>
                    <div className="p-8">
                        {children}
                    </div>
                </main>
            </SuperAdminLayoutWrapper>
        </SuperAdminProvider>
    )
}
