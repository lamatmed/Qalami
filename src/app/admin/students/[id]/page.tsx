import { StudentProfileLayout } from '@/components/admin/students/profile/student-profile-layout'

export default async function StudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params
    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen">
            <StudentProfileLayout id={resolvedParams.id} />
        </div>
    )
}
