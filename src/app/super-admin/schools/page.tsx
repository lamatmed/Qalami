import { SchoolList } from '@/components/super-admin/schools/school-list'
import { getAllSchoolsWithCounts } from '@/app/super-admin/schools/actions'

export default async function SchoolsPage() {
    const initialSchools = await getAllSchoolsWithCounts()
    return <SchoolList initialSchools={initialSchools} />
}
