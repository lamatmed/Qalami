'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Search, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { addChildToParent, searchSchoolStudentsForParent } from '@/app/admin/parents/actions'
import { useLanguage } from '@/i18n'

interface AddChildDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    parentId: string
    parentName: string
    onSuccess: () => void
}

export function AddChildDialog({ open, onOpenChange, parentId, parentName, onSuccess }: AddChildDialogProps) {
    const { t } = useLanguage()
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<{ id: string; full_name: string; national_id: string | null }[]>([])
    const [searching, setSearching] = useState(false)
    const [adding, setAdding] = useState<string | null>(null)

    const handleSearch = async () => {
        if (!query.trim()) return
        setSearching(true)
        const { data } = await searchSchoolStudentsForParent(query)
        setResults(data as any[])
        setSearching(false)
    }

    const handleAdd = async (studentId: string, studentName: string) => {
        setAdding(studentId)
        const result = await addChildToParent(parentId, studentId)
        setAdding(null)
        if (result.error) { toast.error(result.error); return }
        toast.success(t('admin.parents.addedToAccount', { name: studentName, parent: parentName }))
        setResults(prev => prev.filter(r => r.id !== studentId))
        onSuccess()
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-[#1A2530] border-white/10 text-white max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-emerald-500" />
                        {t('admin.parents.addChildToAccount')}
                    </DialogTitle>
                </DialogHeader>
                <p className="text-xs text-gray-400">
                    {t('admin.parents.parentLabel')} : <span className="text-white font-bold">{parentName}</span>
                </p>

                <div className="flex gap-2">
                    <Input
                        placeholder={t('admin.parents.searchByNamePlaceholder')}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        className="flex-1 bg-[#0F1720] border-white/10 text-white"
                    />
                    <Button type="button" onClick={handleSearch} disabled={searching}
                        className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold shrink-0">
                        {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </Button>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                    {results.length === 0 && !searching && query && (
                        <p className="text-xs text-gray-500 text-center py-4">{t('admin.parents.noStudentFound')}</p>
                    )}
                    {results.map(student => (
                        <div key={student.id} className="flex items-center justify-between p-3 bg-[#0F1720] rounded-xl border border-white/5">
                            <div>
                                <p className="text-sm font-medium text-white">{student.full_name}</p>
                                {student.national_id && (
                                    <p className="text-xs text-gray-500 font-mono">NNI: {student.national_id}</p>
                                )}
                            </div>
                            <Button type="button" size="sm"
                                className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold h-8"
                                onClick={() => handleAdd(student.id, student.full_name)}
                                disabled={adding === student.id}>
                                {adding === student.id
                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                    : t('common.add')}
                            </Button>
                        </div>
                    ))}
                </div>

                <Button variant="outline" className="w-full border-white/10 text-gray-400 hover:text-white"
                    onClick={() => onOpenChange(false)}>
                    {t('common.close')}
                </Button>
            </DialogContent>
        </Dialog>
    )
}
