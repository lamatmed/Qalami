import { Suspense } from 'react'
import { ParentDirectory } from '@/components/admin/parents/parent-directory'

export default function ParentsPage() {
    return (
        <div className="h-full">
            <Suspense>
                <ParentDirectory />
            </Suspense>
        </div>
    )
}
