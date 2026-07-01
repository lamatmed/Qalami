import { SuperAdminDashboard } from '@/components/super-admin/super-admin-dashboard'
import { getGlobalStats } from '@/app/super-admin/schools/actions'

export default async function SuperAdminPage() {
    const { stats, recentSchools } = await getGlobalStats()
    return <SuperAdminDashboard stats={stats} recentSchools={recentSchools} />
}
