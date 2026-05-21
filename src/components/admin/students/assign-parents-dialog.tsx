'use client'

import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { searchSchoolParents } from '@/app/admin/actions'
import { assignParentsToStudent } from '@/app/admin/students/actions'
import { toast } from 'sonner'
import { Loader2, Search, X, Users, Phone } from 'lucide-react'
import { useLanguage } from '@/i18n'
import { cn } from '@/lib/utils'

interface ParentInfo {
    id: string
    full_name: string
    phone: string | null
}

interface AssignParentsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    studentId: string
    studentName: string
    currentParents: ParentInfo[]
    onSuccess: (newParents: ParentInfo[]) => void
}

function normalizeArabicDigits(str: string): string {
    const arabicDigits = /[٠-٩]/g;
    const persianDigits = /[۰-۹]/g;
    return str
        .replace(arabicDigits, (d) => String(d.charCodeAt(0) - 1632))
        .replace(persianDigits, (d) => String(d.charCodeAt(0) - 1776));
}

export function AssignParentsDialog({
    open,
    onOpenChange,
    studentId,
    studentName,
    currentParents,
    onSuccess,
}: AssignParentsDialogProps) {
    const { t, direction } = useLanguage()
    const [selectedParents, setSelectedParents] = useState<ParentInfo[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [searchResults, setSearchResults] = useState<{ id: string; full_name: string; phone: string | null }[]>([])
    const [searching, setSearching] = useState(false)
    const [saving, setSaving] = useState(false)

    // Reset selected parents when dialog opens
    useEffect(() => {
        if (open) {
            setSelectedParents(currentParents)
            setSearchTerm('')
            setSearchResults([])
        }
    }, [open, currentParents])

    // Fetch search results as user types
    useEffect(() => {
        if (!searchTerm || searchTerm.length < 2) {
            setSearchResults([])
            return
        }
        const timer = setTimeout(async () => {
            setSearching(true)
            try {
                const results = await searchSchoolParents(searchTerm)
                setSearchResults(results)
            } catch (err) {
                console.error(err)
                setSearchResults([])
            } finally {
                setSearching(false)
            }
        }, 300)
        return () => clearTimeout(timer)
    }, [searchTerm])

    const selectParent = (parent: { id: string; full_name: string; phone: string | null }) => {
        // Prevent duplicates
        if (selectedParents.some(p => p.id === parent.id)) {
            setSearchTerm('')
            setSearchResults([])
            return
        }
        if (selectedParents.length >= 2) {
            toast.error(t('admin.students.assignParentsDialog.maxTwoError') || 'Vous ne pouvez affecter que deux parents au maximum.')
            return
        }

        setSelectedParents(prev => [...prev, {
            id: parent.id,
            full_name: parent.full_name,
            phone: parent.phone,
        }])
        setSearchTerm('')
        setSearchResults([])
    }

    const removeParent = (parentId: string) => {
        setSelectedParents(prev => prev.filter(p => p.id !== parentId))
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const parentIds = selectedParents.map(p => p.id)
            const result = await assignParentsToStudent(studentId, parentIds)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success(t('admin.students.assignParentsDialog.successMessage') || 'Contacts parents mis à jour avec succès.')
                onSuccess(selectedParents)
                onOpenChange(false)
            }
        } catch (error) {
            console.error(error)
            toast.error(t('common.errorOccurred') || 'Une erreur est survenue.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px] bg-[#1A2530] border-white/5 text-white" dir={direction}>
                <DialogHeader className={direction === 'rtl' ? 'text-right' : 'text-left'}>
                    <DialogTitle className={cn("flex items-center gap-2 text-xl font-bold", direction === 'rtl' ? 'flex-row-reverse justify-start' : 'flex-row')}>
                        <Users className="w-5 h-5 text-emerald-500" />
                        {t('admin.students.register.parents.title') || 'Contacts parents'}
                    </DialogTitle>
                </DialogHeader>

                <div className="py-4 space-y-5">
                    <p className={cn("text-sm text-gray-400", direction === 'rtl' ? 'text-right' : 'text-left')}>
                        {t('admin.students.assignParentsDialog.chooseParentsFor') || `Gérer les parents pour ${studentName}. (Maximum 2)`}
                    </p>

                    {/* Selected Parents List */}
                    <div className="space-y-2">
                        <label className={cn("block text-xs font-semibold text-gray-400 uppercase tracking-wider", direction === 'rtl' ? 'text-right' : 'text-left')}>
                            {t('admin.students.assignParentsDialog.selectedParents') || 'Parents sélectionnés'}
                        </label>
                        {selectedParents.length === 0 ? (
                            <div className="bg-[#0F1720]/50 border border-dashed border-white/10 rounded-xl p-6 text-center text-gray-500 text-sm">
                                {t('admin.students.register.parents.noContact') || 'Aucun contact sélectionné'}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {selectedParents.map((p, index) => (
                                    <div key={p.id} className="flex items-center justify-between bg-[#0F1720] border border-white/5 rounded-xl px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                                <Users className="w-4 h-4 text-emerald-500" />
                                            </div>
                                            <div className={direction === 'rtl' ? 'text-right' : 'text-left'}>
                                                <p className="text-white font-medium text-sm">{p.full_name}</p>
                                                <p className="text-emerald-500/60 text-xs font-semibold">
                                                    {index === 0 
                                                        ? (t('admin.students.register.parents.primaryParent') || 'Parent principal')
                                                        : (t('admin.students.register.parents.secondaryParent') || 'Parent secondaire')}
                                                </p>
                                            </div>
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={() => removeParent(p.id)} 
                                            className="text-gray-500 hover:text-red-400 transition-colors p-1"
                                            disabled={saving}
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Search Section */}
                    {selectedParents.length < 2 && (
                        <div className="space-y-2">
                            <label className={cn("block text-xs font-semibold text-gray-400 uppercase tracking-wider", direction === 'rtl' ? 'text-right' : 'text-left')}>
                                {selectedParents.length === 0 
                                    ? (t('admin.students.register.parents.searchPrimary') || 'Rechercher le parent principal') 
                                    : (t('admin.students.register.parents.searchSecondary') || 'Rechercher le parent secondaire')}
                            </label>
                            <div className="relative">
                                <Search className={cn("absolute top-3 h-4 w-4 text-gray-500", direction === 'rtl' ? 'right-3' : 'left-3')} />
                                <Input
                                    placeholder={t('admin.students.register.parents.searchPlaceholder') || 'Nom ou numéro de téléphone...'}
                                    className={cn("bg-[#0F1720] border-white/5 text-white h-11 placeholder:text-gray-500", direction === 'rtl' ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left')}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(normalizeArabicDigits(e.target.value))}
                                    dir={direction}
                                    disabled={saving}
                                />
                                {searching && <Loader2 className={cn("absolute top-3 h-4 w-4 text-emerald-500 animate-spin", direction === 'rtl' ? 'left-3' : 'right-3')} />}
                            </div>

                            {/* Search Results */}
                            {searchResults.length > 0 && (
                                <div className="max-h-48 overflow-y-auto bg-[#0F1720] border border-white/10 rounded-xl divide-y divide-white/5 shadow-2xl">
                                    {searchResults.map(parent => {
                                        const isAlreadySelected = selectedParents.some(p => p.id === parent.id)
                                        return (
                                            <button
                                                key={parent.id}
                                                type="button"
                                                onClick={() => !isAlreadySelected && selectParent(parent)}
                                                className={cn(
                                                    "w-full px-4 py-3 hover:bg-white/5 transition-colors text-left flex justify-between items-center", 
                                                    direction === 'rtl' && "flex-row-reverse text-right",
                                                    isAlreadySelected && "opacity-50 cursor-not-allowed"
                                                )}
                                                disabled={isAlreadySelected}
                                            >
                                                <div>
                                                    <p className="text-white font-medium text-sm">{parent.full_name}</p>
                                                    <div className={cn("flex items-center gap-1 text-gray-500 text-xs mt-0.5", direction === 'rtl' && "flex-row-reverse")}>
                                                        <Phone className="w-3 h-3" />
                                                        <span>{parent.phone || t('admin.students.register.parents.noContact') || 'Aucun contact'}</span>
                                                    </div>
                                                </div>
                                                {isAlreadySelected && (
                                                    <span className="text-xs text-emerald-500 font-medium">
                                                        {t('admin.students.assignParentsDialog.selected') || 'Sélectionné'}
                                                    </span>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}

                            {searchTerm.length >= 2 && !searching && searchResults.length === 0 && (
                                <p className={cn("text-xs text-gray-500", direction === 'rtl' ? 'text-right' : 'text-left')}>
                                    {t('admin.students.register.parents.notFoundHint') || 'Aucun parent trouvé.'}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className={cn("flex gap-2 border-t border-white/5 pt-4 mt-2", direction === 'rtl' ? 'flex-row-reverse justify-start' : 'flex-row justify-end')}>
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={saving}
                        className="text-gray-400 hover:text-white hover:bg-white/5 rounded-xl px-5 h-11"
                    >
                        {t('common.cancel') || 'Annuler'}
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-xl px-6 h-11"
                    >
                        {saving && <Loader2 className={cn("w-4 h-4 animate-spin", direction === 'rtl' ? 'ml-2' : 'mr-2')} />}
                        {t('common.save') || 'Enregistrer'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
