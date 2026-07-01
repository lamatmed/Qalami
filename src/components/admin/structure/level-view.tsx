'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Search, Plus, Filter, Calendar, Users, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

import { Skeleton } from '@/components/ui/skeleton'
import { useLanguage } from '@/i18n'

interface ClassData {
    id: string
    name: string
    teacher: string
    students: number
    capacity: number
    status: 'complet' | 'incomplet' | 'pleine'
    lastUpdate: string
}

export function LevelView({ params }: { params: { levelId: string } }) {
    const router = useRouter()
    const { t } = useLanguage()
    const [classes, setClasses] = useState<ClassData[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [levelNameFr, setLevelNameFr] = useState('')
    const levelId = params.levelId

    useEffect(() => {
        setLoading(true)
        fetch(`/api/admin/levels/${levelId}`)
            .then(res => res.ok ? res.json() : null)
            .then(json => {
                if (!json) return
                if (json.levelNameFr) setLevelNameFr(json.levelNameFr)
                const processedClasses: ClassData[] = (json.classes || []).map((cls: any) => {
                    const students = cls.studentCount || 0
                    const capacity = cls.capacity || 40
                    let status: 'complet' | 'incomplet' | 'pleine' = 'incomplet'
                    if (students >= capacity) status = 'pleine'
                    else if (students >= capacity * 0.7) status = 'complet'

                    let lastUpdate = t('admin.levelView.today')
                    if (cls.updatedAt) {
                        const diffDays = Math.floor((Date.now() - new Date(cls.updatedAt).getTime()) / 86400000)
                        if (diffDays === 1) lastUpdate = t('admin.levelView.yesterday')
                        else if (diffDays > 1) lastUpdate = t('admin.levelView.daysAgo').replace('{n}', String(diffDays))
                    }

                    return {
                        id: cls.id,
                        name: cls.name,
                        teacher: (cls.teachers || [])[0] || t('admin.levelView.notAssigned'),
                        students,
                        capacity,
                        status,
                        lastUpdate,
                    }
                })
                setClasses(processedClasses)
            })
            .catch(err => console.error('Error fetching classes:', err))
            .finally(() => setLoading(false))
    }, [levelId])

    const filteredClasses = classes.filter(cls =>
        searchQuery === '' ||
        cls.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cls.teacher.toLowerCase().includes(searchQuery.toLowerCase())
    )

    if (loading) {
        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div>
                        <Skeleton className="h-6 w-32 mb-2" />
                        <Skeleton className="h-4 w-24" />
                    </div>
                </div>
                <Skeleton className="h-11 rounded-xl" />
                <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-48 rounded-xl" />
                    <Skeleton className="h-48 rounded-xl" />
                    <Skeleton className="h-48 rounded-xl" />
                    <Skeleton className="h-48 rounded-xl" />
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h2 className="text-xl font-bold text-foreground">{t('admin.levelView.level')}: {levelNameFr}</h2>
                        <p className="text-primary text-xs font-bold">{filteredClasses.length} {t('admin.levelView.totalClasses')}</p>
                    </div>
                </div>
                <Link href={`/admin/classes/${levelId}/new`}>
                    <Button size="icon" className="bg-primary hover:bg-primary/90 rounded-full h-10 w-10 shadow-lg shadow-primary/20">
                        <Plus className="w-5 h-5 text-primary-foreground" />
                    </Button>
                </Link>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-primary" />
                <Input
                    placeholder={t('admin.levelView.searchClass')}
                    className="pl-9 bg-muted border-transparent focus:border-primary/50 h-11 rounded-xl"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Classes Grid */}
            <div className="space-y-4">
                <div className="flex justify-between items-end">
                    <h3 className="font-bold text-foreground text-lg">{t('admin.levelView.classList')}</h3>
                    <Filter className="w-5 h-5 text-muted-foreground" />
                </div>

                {filteredClasses.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>{t('admin.levelView.noClassFound')}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        {filteredClasses.map((cls) => (
                            <Link href={`/admin/classes/${levelId}/${cls.id}`} key={cls.id}>
                                <div className="bg-card rounded-xl p-3 border border-border hover:border-primary/50 transition-all group relative overflow-hidden">
                                    {cls.status === 'complet' && <Badge className="absolute top-2 right-2 text-[10px] h-5 bg-emerald-500 text-black font-bold">{t('admin.levelView.complete')}</Badge>}
                                    {cls.status === 'incomplet' && <Badge className="absolute top-2 right-2 text-[10px] h-5 bg-orange-500 text-black font-bold">{t('admin.levelView.incomplete')}</Badge>}
                                    {cls.status === 'pleine' && <Badge className="absolute top-2 right-2 text-[10px] h-5 bg-red-500 text-white font-bold">{t('admin.levelView.full')}</Badge>}

                                    <div className="h-20 bg-muted rounded-lg mb-3 flex items-center justify-center">
                                        <Users className="text-muted-foreground w-8 h-8" />
                                    </div>

                                    <h4 className="font-bold text-foreground mb-1 group-hover:text-primary transition-colors">{cls.name}</h4>
                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-2">
                                        <Users className="w-3 h-3" /> {cls.teacher}
                                    </div>

                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[10px] font-bold">
                                            <span className="text-muted-foreground uppercase">{t('admin.levelView.capacity')}</span>
                                            <span className={cn(
                                                cls.students >= cls.capacity ? "text-red-500" : "text-primary"
                                            )}>{cls.students}/{cls.capacity}</span>
                                        </div>
                                        <Progress value={(cls.students / cls.capacity) * 100} className="h-1 bg-muted" />
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* Recent Activity */}
            <div>
                <h3 className="font-bold text-foreground text-lg mb-4">{t('admin.levelView.recentSchedules')}</h3>
                <div className="space-y-3">
                    {filteredClasses.slice(0, 2).map((cls) => (
                        <div key={cls.id} className="bg-card p-3 rounded-xl flex items-center gap-4 border border-border">
                            <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                                <Calendar className="w-5 h-5" />
                            </div>
                            <div>
                                <h5 className="font-bold text-foreground text-sm">{cls.name}</h5>
                                <p className="text-[10px] text-muted-foreground">{t('admin.levelView.lastUpdate')}: {cls.lastUpdate}</p>
                            </div>
                            <div className="ms-auto h-2 w-2 rounded-full bg-primary"></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
