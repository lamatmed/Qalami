import { TeacherSidebar, sidebarItems } from '@/components/teacher/sidebar'
import { MobileNav } from '@/components/layout/mobile-nav'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { TeacherProvider } from '@/context/teacher-context'
import { SuperAdminViewingBanner } from '@/components/shared/super-admin-viewing-banner'

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
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'teacher' && profile?.role !== 'super_admin' && profile?.role !== 'admin') {
        // Allowing admins to view for debug, or restrict strictly to teachers
        redirect('/')
    }

    return (
        <TeacherProvider>
            <div className="flex h-screen bg-gray-100 dark:bg-muted/20 theme-teacher">
                <div className="hidden lg:block h-full">
                    <TeacherSidebar />
                </div>
                <main className="flex-1 overflow-y-auto pb-20 lg:pb-0"> {/* Added pb-20 for mobile nav spacing */}
                    <SuperAdminViewingBanner />
                    <header className="bg-white dark:bg-card border-b px-8 py-4 flex justify-between items-center sticky top-0 z-10">
                        <h2 className="text-xl font-semibold text-gray-800 dark:text-foreground">Espace Enseignant</h2>
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-600 dark:text-muted-foreground hidden sm:inline-block">{user.email}</span>
                        </div>
                    </header>
                    <div className="p-4 sm:p-8">
                        {children}
                    </div>
                </main>
                <MobileNav items={sidebarItems} />
            </div>
        </TeacherProvider>
    )
}
