import { EmployeeProfileLayout } from '@/components/admin/employees/profile/employee-profile-layout'

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    return (
        <div className="p-6 max-w-4xl mx-auto">
            <EmployeeProfileLayout id={id} />
        </div>
    )
}
