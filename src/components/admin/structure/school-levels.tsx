'use client'

import { Button } from '@/components/ui/button'
import { Plus, GraduationCap, Settings, Loader2, X, ChevronDown, Trash2, AlertTriangle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n'
import { createClient } from '@/utils/supabase/client'
import { createLevel, deleteLevel } from '@/app/admin/classes/actions'
import { useState, useEffect } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

interface ClassInLevel {
    id: string
    name: string
    students: number
    capacity: number
}

interface LevelData {
    id: string
    nameFr: string
    nameAr: string
    classes: ClassInLevel[]
}

export function SchoolLevels() {
    const { t } = useLanguage()
    const [levels, setLevels] = useState<LevelData[]>([])
    const [loading, setLoading] = useState(true)
    const [expanded, setExpanded] = useState<Set<string>>(new Set())
    const [showNewCycleForm, setShowNewCycleForm] = useState(false)
    const [newLevelNameFr, setNewLevelNameFr] = useState('')
    const [newLevelNameAr, setNewLevelNameAr] = useState('')
    const [creating, setCreating] = useState(false)

    // Delete level
    const [deletingLevel, setDeletingLevel] = useState<LevelData | null>(null)
    const [confirmDeleting, setConfirmDeleting] = useState(false)

    const handleDeleteLevel = async () => {
        if (!deletingLevel) return
        setConfirmDeleting(true)
        const result = await deleteLevel(deletingLevel.id)
        if (result?.error) {
            toast.error(result.error)
            setConfirmDeleting(false)
        } else {
            toast.success(`Niveau "${deletingLevel.nameFr}" supprimé`)
            setLevels(prev => prev.filter(l => l.id !== deletingLevel.id))
            setDeletingLevel(null)
            setConfirmDeleting(false)
        }
    }

    async function fetchLevels() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }

        const { data: profile } = await supabase
            .from('profiles')
            .select('school_id')
            .eq('id', user.id)
            .single()
        if (!profile?.school_id) { setLoading(false); return }

        const { data: levelsData } = await supabase
            .from('levels')
            .select('id, name_fr, name_ar')
            .eq('school_id', profile.school_id)
            .order('order', { ascending: true })

        if (!levelsData || levelsData.length === 0) {
            setLevels([])
            setLoading(false)
            return
        }

        const levelIds = levelsData.map(l => l.id)

        const { data: classes } = await supabase
            .from('classes')
            .select('id, name, capacity, level_id')
            .eq('school_id', profile.school_id)
            .in('level_id', levelIds)
            .order('name', { ascending: true })

        const allClassIds = (classes || []).map(c => c.id)
        const studentCounts = new Map<string, number>()

        if (allClassIds.length > 0) {
            const { data: enrollments } = await supabase
                .from('enrollments')
                .select('class_id')
                .in('class_id', allClassIds)
            ;(enrollments || []).forEach((e: any) => {
                studentCounts.set(e.class_id, (studentCounts.get(e.class_id) || 0) + 1)
            })
        }

        const classMap = new Map<string, ClassInLevel[]>()
        ;(classes || []).forEach((cls: any) => {
            if (!cls.level_id) return
            if (!classMap.has(cls.level_id)) classMap.set(cls.level_id, [])
            classMap.get(cls.level_id)!.push({
                id: cls.id,
                name: cls.name,
                students: studentCounts.get(cls.id) || 0,
                capacity: cls.capacity || 40,
            })
        })

        const levelData: LevelData[] = levelsData.map((l: any) => ({
            id: l.id,
            nameFr: l.name_fr,
            nameAr: l.name_ar,
            classes: classMap.get(l.id) || [],
        }))

        setLevels(levelData)
        setExpanded(new Set(levelData.map(l => l.id)))
        setLoading(false)
    }

    useEffect(() => { fetchLevels() }, [])

    const toggleLevel = (id: string) => {
        setExpanded(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    const handleCreateCycle = async () => {
        if (!newLevelNameFr.trim()) { toast.error('Veuillez entrer un nom de niveau en français'); return }
        setCreating(true)
        try {
            const result = await createLevel(newLevelNameFr.trim(), newLevelNameAr.trim() || newLevelNameFr.trim())
            if (result?.error) throw new Error(result.error)
            toast.success(`Niveau "${newLevelNameFr}" créé`)
            setShowNewCycleForm(false)
            setNewLevelNameFr('')
            setNewLevelNameAr('')
            setLoading(true)
            await fetchLevels()
        } catch (err: any) {
            toast.error(err?.message || 'Erreur lors de la création du niveau')
        } finally {
            setCreating(false)
        }
    }

    if (loading) {
        return (
            <div className="space-y-4 animate-in fade-in duration-500">
                <div><Skeleton className="h-8 w-48 mb-1" /><Skeleton className="h-4 w-64" /></div>
                <Skeleton className="h-40 rounded-2xl" />
                <Skeleton className="h-40 rounded-2xl" />
                <Skeleton className="h-40 rounded-2xl" />
            </div>
        )
    }

    const totalClasses = levels.reduce((s, l) => s + l.classes.length, 0)
    const totalStudents = levels.reduce((s, l) => s + l.classes.reduce((cs, c) => cs + c.students, 0), 0)

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">{t('admin.structure.schoolStructure')}</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {levels.length} niveau{levels.length !== 1 ? 'x' : ''} · {totalClasses} classe{totalClasses !== 1 ? 's' : ''} · {totalStudents} élève{totalStudents !== 1 ? 's' : ''}
                    </p>
                </div>
                <Link href="/admin/settings">
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                        <Settings className="w-5 h-5" />
                    </Button>
                </Link>
            </div>

            {/* Tree */}
            {levels.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                    <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="font-medium">{t('common.noData')}</p>
                    <p className="text-sm mt-1">{t('admin.structure.addPreschool')}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {levels.map(level => {
                        const isOpen = expanded.has(level.id)
                        const levelStudents = level.classes.reduce((s, c) => s + c.students, 0)

                        return (
                            <div key={level.id} className="border border-border rounded-2xl overflow-hidden bg-card">
                                {/* Level row */}
                                <button
                                    type="button"
                                    onClick={() => toggleLevel(level.id)}
                                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors text-left group"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                                            <GraduationCap className="w-4 h-4 text-emerald-600" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-foreground leading-tight">{level.nameFr}</p>
                                            {level.nameAr && level.nameAr !== level.nameFr && (
                                                <p className="text-xs text-muted-foreground" dir="rtl">{level.nameAr}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 ml-4">
                                        <span className="text-xs text-muted-foreground font-medium hidden sm:block">
                                            {level.classes.length} classe{level.classes.length !== 1 ? 's' : ''} · {levelStudents} élève{levelStudents !== 1 ? 's' : ''}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={e => { e.stopPropagation(); setDeletingLevel(level) }}
                                            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                            title="Supprimer ce niveau"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                        <ChevronDown className={cn(
                                            "w-4 h-4 text-muted-foreground transition-transform duration-200",
                                            !isOpen && "-rotate-90"
                                        )} />
                                    </div>
                                </button>

                                {/* Classes */}
                                {isOpen && (
                                    <div className="border-t border-border px-5 py-4 bg-muted/20">
                                        {level.classes.length === 0 ? (
                                            <div className="flex items-center justify-between py-2">
                                                <p className="text-sm text-muted-foreground">Aucune classe dans ce niveau</p>
                                                <Link href={`/admin/classes/${level.id}/new`}>
                                                    <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs">
                                                        <Plus className="w-3.5 h-3.5" /> Ajouter une classe
                                                    </Button>
                                                </Link>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                                {level.classes.map(cls => {
                                                    const pct = Math.round((cls.students / cls.capacity) * 100)
                                                    const isFull = cls.students >= cls.capacity
                                                    const isHigh = pct >= 70
                                                    const accentColor = isFull ? 'text-red-500' : isHigh ? 'text-amber-500' : 'text-emerald-600'
                                                    const barColor = isFull ? 'bg-red-500' : isHigh ? 'bg-amber-500' : 'bg-emerald-500'

                                                    return (
                                                        <Link key={cls.id} href={`/admin/classes/${level.id}/${cls.id}`}>
                                                            <div className="bg-background border border-border rounded-xl p-3 hover:border-emerald-500/40 hover:shadow-sm transition-all group cursor-pointer">
                                                                <p className="font-semibold text-sm text-foreground group-hover:text-emerald-600 transition-colors truncate">{cls.name}</p>
                                                                <div className="flex items-baseline gap-1 mt-2 mb-2">
                                                                    <span className={cn('text-2xl font-black tabular-nums leading-none', accentColor)}>
                                                                        {cls.students}
                                                                    </span>
                                                                    <span className="text-xs text-muted-foreground">/ {cls.capacity}</span>
                                                                </div>
                                                                <div className="h-1 bg-muted rounded-full overflow-hidden">
                                                                    <div
                                                                        className={cn('h-full rounded-full', barColor)}
                                                                        style={{ width: `${Math.min(pct, 100)}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </Link>
                                                    )
                                                })}

                                                {/* Add class card */}
                                                <Link href={`/admin/classes/${level.id}/new`}>
                                                    <div className="border-2 border-dashed border-border rounded-xl p-3 flex flex-col items-center justify-center hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all cursor-pointer group min-h-[88px]">
                                                        <Plus className="w-5 h-5 text-muted-foreground group-hover:text-emerald-600 transition-colors" />
                                                        <p className="text-xs text-muted-foreground group-hover:text-emerald-600 transition-colors mt-1 font-medium">Ajouter</p>
                                                    </div>
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Add level */}
            {showNewCycleForm ? (
                <div className="border-2 border-primary/30 rounded-2xl p-6 bg-primary/5 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex items-center justify-between">
                        <h4 className="font-bold text-foreground">{t('admin.structure.defineNewCycle')}</h4>
                        <Button variant="ghost" size="icon" onClick={() => setShowNewCycleForm(false)}>
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-muted-foreground font-bold mb-1.5 block">Nom du niveau (français)</label>
                            <Input
                                placeholder="Ex: 1ère Année, Terminale..."
                                className="h-11"
                                value={newLevelNameFr}
                                onChange={(e) => setNewLevelNameFr(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateCycle()}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground font-bold mb-1.5 block">Nom du niveau (arabe)</label>
                            <Input
                                placeholder="مثال: السنة الأولى..."
                                className="h-11 text-right"
                                dir="rtl"
                                value={newLevelNameAr}
                                onChange={(e) => setNewLevelNameAr(e.target.value)}
                            />
                        </div>
                    </div>
                    <Button
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-11"
                        onClick={handleCreateCycle}
                        disabled={creating}
                    >
                        {creating
                            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Création...</>
                            : <><Plus className="w-4 h-4 mr-2" /> Créer le niveau</>
                        }
                    </Button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setShowNewCycleForm(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-muted/50 transition-colors"
                >
                    <Plus className="w-4 h-4 shrink-0" />
                    {t('admin.structure.defineNewCycle')}
                </button>
            )}
            {/* ── Delete Level Dialog ── */}
            {deletingLevel && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => !confirmDeleting && setDeletingLevel(null)}
                    />
                    <div className="relative w-full max-w-sm bg-[#161B22] rounded-2xl border border-red-500/20 shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">

                        {/* Header */}
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0 mt-0.5">
                                <AlertTriangle className="w-4 h-4 text-red-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-base font-semibold text-white">Supprimer le niveau</h3>
                                <p className="text-sm text-gray-400 mt-0.5">
                                    <span className="font-semibold text-white">"{deletingLevel.nameFr}"</span> sera supprimé définitivement.
                                </p>
                            </div>
                        </div>

                        {/* Impact summary */}
                        <div className="bg-red-500/8 border border-red-500/15 rounded-xl p-4 space-y-2">
                            <p className="text-[11px] font-bold text-red-400 uppercase tracking-wider mb-2">Cette action va :</p>
                            {[
                                `Supprimer ${deletingLevel.classes.length} classe${deletingLevel.classes.length !== 1 ? 's' : ''}`,
                                `Désassigner ${deletingLevel.classes.reduce((s, c) => s + c.students, 0)} élève${deletingLevel.classes.reduce((s, c) => s + c.students, 0) !== 1 ? 's' : ''}`,
                                'Supprimer toutes les matières liées',
                                'Retirer toutes les affectations enseignants',
                                "Effacer les créneaux de l'emploi du temps",
                            ].map(line => (
                                <div key={line} className="flex items-start gap-2">
                                    <span className="text-red-500 mt-0.5 shrink-0 text-xs">·</span>
                                    <span className="text-xs text-red-300/80">{line}</span>
                                </div>
                            ))}
                        </div>

                        {/* Classes preview */}
                        {deletingLevel.classes.length > 0 && (
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                                    Classes concernées
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {deletingLevel.classes.map(cls => (
                                        <span key={cls.id} className="text-[11px] bg-white/5 border border-white/8 text-gray-400 px-2 py-0.5 rounded-md">
                                            {cls.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 pt-1">
                            <button
                                onClick={() => setDeletingLevel(null)}
                                disabled={confirmDeleting}
                                className="flex-1 h-10 rounded-xl border border-white/8 text-gray-500 hover:text-gray-300 hover:bg-white/4 text-sm font-medium transition-colors disabled:opacity-40"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleDeleteLevel}
                                disabled={confirmDeleting}
                                className="flex-1 h-10 rounded-xl bg-red-600/85 hover:bg-red-600 text-white text-sm font-semibold disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                            >
                                {confirmDeleting
                                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Suppression…</>
                                    : <><Trash2 className="w-3.5 h-3.5" /> Supprimer le niveau</>
                                }
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
