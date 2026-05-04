import { TeacherProfileLayout } from '@/components/admin/teachers/profile/teacher-profile-layout'

export default async function TeacherProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    return (
        <div className="p-6 h-full">
            <TeacherProfileLayout id={id} />
        </div>
    )
}
