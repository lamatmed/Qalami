import { ClassForm } from '@/components/admin/structure/class-form'

export default async function NewClassPage({ params }: { params: Promise<{ levelId: string }> }) {
    const resolvedParams = await params
    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
            <ClassForm levelId={resolvedParams.levelId} />
        </div>
    )
}
