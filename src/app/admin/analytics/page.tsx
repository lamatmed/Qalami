import { SchoolMetrics } from '@/components/admin/analytics/school-metrics'
import { EnrollmentChart } from '@/components/admin/analytics/enrollment-chart'
import { AttendanceChart } from '@/components/admin/analytics/attendance-chart'

export default function AnalyticsPage() {
    return (
        <div className="space-y-6 max-w-[1400px] mx-auto">
            {/* KPI Metrics Grid */}
            <SchoolMetrics />

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <EnrollmentChart />
                <AttendanceChart />
            </div>
        </div>
    )
}
