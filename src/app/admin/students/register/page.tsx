import { RegistrationWizard } from '@/components/admin/students/registration-wizard'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export default function RegisterStudentPage() {
    return (
        <div className="pb-10">
            {/* Sub-header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <Link href="/admin/students">
                        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-gray-900 dark:hover:text-white">
                            <ChevronLeft className="w-6 h-6" />
                        </Button>
                    </Link>
                    <h1 className="text-lg font-bold text-gray-900 dark:text-white">Nouvelle Inscription</h1>
                </div>
                <Link href="/admin/students">
                    <Button variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                        Annuler
                    </Button>
                </Link>
            </div>

            <RegistrationWizard />
        </div>
    )
}
