import { ClassAttendanceDetail } from '@/components/admin/attendance/class-attendance-detail'

export default async function ClassAttendancePage({
    params,
}: {
    params: Promise<{ classId: string }>
}) {
    const { classId } = await params
    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto min-h-screen">
            <ClassAttendanceDetail classId={classId} />
        </div>
    )
}
