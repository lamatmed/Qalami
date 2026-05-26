import { redirect } from 'next/navigation'
import { getActionContext } from '@/lib/auth-action'
import { ActivityLog } from '@/components/admin/activity/activity-log'

export default async function ActivityPage() {
    const ctx = await getActionContext(['admin', 'super_admin'])
    if (!ctx) redirect('/admin')

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <ActivityLog />
        </div>
    )
}
