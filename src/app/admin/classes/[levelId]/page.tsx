import { LevelView } from '@/components/admin/structure/level-view'

// Need to await params in Next.js 15+ if accessed in server component but here we pass to client component
export default async function LevelClassesPage({ params }: { params: Promise<{ levelId: string }> }) {
    const resolvedParams = await params
    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto h-[calc(100vh-80px)]">
            <LevelView params={resolvedParams} />
        </div>
    )
}
