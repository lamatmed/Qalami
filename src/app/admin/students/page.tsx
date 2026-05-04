import { StudentDirectory } from '@/components/admin/students/student-directory'

export default function StudentDirectoryPage() {
    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto h-[calc(100vh-80px)]">
            <StudentDirectory />
        </div>
    )
}
