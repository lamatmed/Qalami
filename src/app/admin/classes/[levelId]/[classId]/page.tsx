import { ClassDetails } from '@/components/admin/structure/class-details'

export default async function ClassDetailsPage({ params }: { params: Promise<{ levelId: string, classId: string }> }) {
    const resolvedParams = await params
    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto h-[calc(100vh-80px)]">
            <ClassDetails levelId={resolvedParams.levelId} classId={resolvedParams.classId} />
        </div>
    )
}
