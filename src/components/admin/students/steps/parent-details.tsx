'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ChevronRight, ChevronLeft, Search, Loader2, X, Users, Phone } from 'lucide-react'
import { RegistrationData } from '../registration-wizard'
import { createClient } from '@/utils/supabase/client'

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

export function ParentDetails({ data, updateData, onNext, onPrev }: StepProps) {
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
            const supabase = createClient()

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setSearching(false); return }

            const { data: profile } = await supabase
                .from('profiles')
                .select('school_id')
                .eq('id', user.id)
                .single()

            const { data: results } = await supabase
                .from('profiles')
                .select('id, full_name, phone, email')
                .eq('role', 'parent')
                .eq('school_id', profile?.school_id)
                .or(`full_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
                .limit(10)

            setSearchResults(results || [])
            setSearching(false)
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
                <h2 className="text-2xl font-bold text-white mb-2">Contacts Parents</h2>
                <p className="text-gray-400 text-sm">Étape 2 sur 4 : Sélectionner les parents depuis la liste.</p>
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
                                <div>
                                    <p className="text-white font-medium text-sm">{p.name}</p>
                                    <p className="text-emerald-500/60 text-xs">{p.slot === 1 ? 'Parent principal' : 'Parent secondaire'}</p>
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
                        {selectedParents.length === 0 ? 'Rechercher le parent principal' : 'Rechercher le parent secondaire (optionnel)'}
                    </p>
                    <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                        <Input
                            placeholder="Nom ou numéro de téléphone..."
                            className="pl-9 bg-[#1A2530] border-white/5"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searching && <Loader2 className="absolute right-3 top-3 h-4 w-4 text-gray-400 animate-spin" />}
                    </div>

                    {searchResults.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#1A2530] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                            {searchResults.map(parent => (
                                <button
                                    key={parent.id}
                                    onClick={() => selectParent(parent)}
                                    className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0"
                                >
                                    <p className="text-white font-medium text-sm">{parent.full_name}</p>
                                    <div className="flex items-center gap-1 text-gray-500 text-xs mt-0.5">
                                        <Phone className="w-3 h-3" />
                                        <span>{parent.phone || parent.email || 'Aucun contact'}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {searchTerm.length >= 2 && !searching && searchResults.length === 0 && (
                        <p className="text-xs text-gray-500 mt-2">Aucun parent trouvé. Créez d'abord le parent depuis la page Parents.</p>
                    )}
                </div>
            )}

            <div className="flex gap-4 pt-6">
                <Button
                    variant="outline"
                    onClick={onPrev}
                    className="flex-1 bg-transparent border-white/10 text-white h-12 rounded-xl hover:bg-white/5"
                >
                    <ChevronLeft className="mr-2 w-4 h-4" /> Retour
                </Button>
                <Button
                    onClick={onNext}
                    disabled={!parents.parent1Id}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-bold h-12 rounded-xl disabled:opacity-50"
                >
                    Suivant <ChevronRight className="ml-2 w-4 h-4" />
                </Button>
            </div>
        </div>
    )
}
