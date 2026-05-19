'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ChevronRight, ChevronLeft, Search, Loader2, X, Users, Phone } from 'lucide-react'
import { RegistrationData } from '../registration-wizard'
import { useLanguage } from '@/i18n'
import { searchSchoolParents } from '@/app/admin/actions'

interface StepProps {
    data: RegistrationData
    updateData: (section: keyof RegistrationData, data: any) => void
    onNext: () => void
    onPrev: () => void
    savedCredentials?: any
}

interface ParentResult {
    id: string
    full_name: string
    phone: string | null
    email: string | null
}

function normalizeArabicDigits(str: string): string {
    const arabicDigits = /[٠-٩]/g;
    const persianDigits = /[۰-۹]/g;
    return str
        .replace(arabicDigits, (d) => String(d.charCodeAt(0) - 1632))
        .replace(persianDigits, (d) => String(d.charCodeAt(0) - 1776));
}

export function ParentDetails({ data, updateData, onNext, onPrev }: StepProps) {
    const { t, direction } = useLanguage()
    const { parents } = data
    const [searchTerm, setSearchTerm] = useState('')
    const [searchResults, setSearchResults] = useState<ParentResult[]>([])
    const [searching, setSearching] = useState(false)

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

    const selectedParents = [
        parents.parent1Id ? { id: parents.parent1Id, name: parents.parent1Name || '', slot: 1 } : null,
        parents.parent2Id ? { id: parents.parent2Id, name: parents.parent2Name || '', slot: 2 } : null,
    ].filter(Boolean) as { id: string; name: string; slot: number }[]

    const selectParent = (parent: ParentResult) => {
        // Avoid duplicate
        if (parents.parent1Id === parent.id || parents.parent2Id === parent.id) {
            setSearchTerm('')
            setSearchResults([])
            return
        }
        if (!parents.parent1Id) {
            updateData('parents', { parent1Id: parent.id, parent1Name: parent.full_name })
        } else if (!parents.parent2Id) {
            updateData('parents', { parent2Id: parent.id, parent2Name: parent.full_name })
        }
        setSearchTerm('')
        setSearchResults([])
    }

    const removeParent = (slot: number) => {
        if (slot === 1) updateData('parents', { parent1Id: undefined, parent1Name: undefined })
        else updateData('parents', { parent2Id: undefined, parent2Name: undefined })
    }

    return (
        <div className="space-y-6">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('admin.students.register.parents.title')}</h2>
                <p className="text-gray-400 text-sm">{t('admin.students.register.parents.subtitle')}</p>
            </div>

            {/* Selected Parents */}
            {selectedParents.length > 0 && (
                <div className="space-y-2">
                    {selectedParents.map((p) => (
                        <div key={p.id} className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                    <Users className="w-4 h-4 text-emerald-500" />
                                </div>
                                <div className={direction === 'rtl' ? 'text-right' : 'text-left'}>
                                    <p className="text-white font-medium text-sm">{p.name}</p>
                                    <p className="text-emerald-500/60 text-xs">{p.slot === 1 ? t('admin.students.register.parents.primaryParent') : t('admin.students.register.parents.secondaryParent')}</p>
                                </div>
                            </div>
                            <button onClick={() => removeParent(p.slot)} className="text-gray-500 hover:text-red-400 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Search */}
            {selectedParents.length < 2 && (
                <div className="relative">
                    <p className="text-xs text-gray-400 mb-2 font-medium">
                        {selectedParents.length === 0 ? t('admin.students.register.parents.searchPrimary') : t('admin.students.register.parents.searchSecondary')}
                    </p>
                    <div className="relative">
                        <Search className={cn("absolute top-3 h-4 w-4 text-gray-500", direction === 'rtl' ? 'right-3' : 'left-3')} />
                        <Input
                            placeholder={t('admin.students.register.parents.searchPlaceholder')}
                            className={cn("bg-[#1A2530] border-white/5", direction === 'rtl' ? 'pr-9 pl-3 text-right placeholder:text-right' : 'pl-9 pr-3 text-left placeholder:text-left')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(normalizeArabicDigits(e.target.value))}
                            dir={direction}
                        />
                        {searching && <Loader2 className={cn("absolute top-3 h-4 w-4 text-gray-400 animate-spin", direction === 'rtl' ? 'left-3' : 'right-3')} />}
                    </div>

                    {searchResults.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#1A2530] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                            {searchResults.map(parent => (
                                <button
                                    key={parent.id}
                                    onClick={() => selectParent(parent)}
                                    className={cn("w-full px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0", direction === 'rtl' ? 'text-right' : 'text-left')}
                                >
                                    <p className="text-white font-medium text-sm">{parent.full_name}</p>
                                    <div className={cn("flex items-center gap-1 text-gray-500 text-xs mt-0.5", direction === 'rtl' && "flex-row-reverse")}>
                                        <Phone className="w-3 h-3" />
                                        <span>{parent.phone || parent.email || t('admin.students.register.parents.noContact')}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {searchTerm.length >= 2 && !searching && searchResults.length === 0 && (
                        <p className="text-xs text-gray-500 mt-2">{t('admin.students.register.parents.notFoundHint')}</p>
                    )}
                </div>
            )}

            <div className="flex gap-4 pt-6">
                <Button
                    variant="outline"
                    onClick={onPrev}
                    className="flex-1 bg-transparent border-white/10 text-white h-12 rounded-xl hover:bg-white/5"
                >
                    <ChevronLeft className={cn("mr-2 w-4 h-4", direction === 'rtl' && "rotate-180")} /> {t('common.back')}
                </Button>
                <Button
                    onClick={onNext}
                    disabled={!parents.parent1Id}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-bold h-12 rounded-xl disabled:opacity-50"
                >
                    {t('common.next')} <ChevronRight className={cn("ml-2 w-4 h-4", direction === 'rtl' && "rotate-180")} />
                </Button>
            </div>
        </div>
    )
}
