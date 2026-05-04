import { AccessSchool } from '@/components/super-admin/schools/access-school'

export default async function AccessSchoolPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    return <AccessSchool schoolId={id} />
}
