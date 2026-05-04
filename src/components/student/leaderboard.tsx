'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, Trophy, Flame, ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useStudent } from '@/context/student-context'

interface LeaderboardProps {
    isEmbedded?: boolean;
}

interface LeaderboardEntry {
    rank: number
    name: string
    avatar: string | null
    xp: number
    level: number
    streak: number
    isUser: boolean
    studentId: string
}

export function Leaderboard({ isEmbedded = false }: LeaderboardProps) {
    const router = useRouter()
    const { student } = useStudent()
    const [filter, setFilter] = useState<'week' | 'all'>('week')
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchLeaderboard = async () => {
            const supabase = createClient()

            // Get current user ID (either logged in or impersonated)
            let currentUserId: string | null = null
            const stored = sessionStorage.getItem('superAdminViewingAs')
            if (stored) {
                try {
                    currentUserId = JSON.parse(stored).userId
                } catch { }
            }
            if (!currentUserId) {
                const { data: { user } } = await supabase.auth.getUser()
                currentUserId = user?.id || null
            }

            // Fetch leaderboard data
            const { data, error } = await supabase
                .from('student_gamification')
                .select(`
                    xp,
                    level,
                    streak,
                    student_id,
                    profiles!student_gamification_student_id_fkey (
                        id,
                        full_name,
                        avatar_url
                    )
                `)
                .order('xp', { ascending: false })
                .limit(50)

            if (error) {
                console.error('[Leaderboard] Error fetching:', error)
                setLoading(false)
                return
            }

            // Transform to leaderboard entries with ranks
            const entries: LeaderboardEntry[] = (data || []).map((item, index) => ({
                rank: index + 1,
                name: (item.profiles as { full_name?: string })?.full_name || 'Étudiant',
                avatar: (item.profiles as { avatar_url?: string })?.avatar_url || null,
                xp: item.xp,
                level: item.level,
                streak: item.streak,
                isUser: item.student_id === currentUserId,
                studentId: item.student_id
            }))

            setLeaderboard(entries)
            setLoading(false)
        }

        fetchLeaderboard()
    }, [filter])

    // Separate top 3 and rest
    const topThree = leaderboard.slice(0, 3)
    const rankings = leaderboard.slice(3)

    // Find current user's position for the bottom bar
    const userEntry = leaderboard.find(e => e.isUser)
    const nextHigherRank = userEntry ? leaderboard.find(e => e.rank === userEntry.rank - 1) : null
    const pointsToNext = nextHigherRank && userEntry ? nextHigherRank.xp - userEntry.xp : 0

    if (loading) {
        return (
            <div className={cn("max-w-md mx-auto h-full flex flex-col bg-[#080C14] relative", isEmbedded && "h-auto bg-transparent")}>
                <div className="flex-1 flex items-center justify-center">
                    <div className="animate-pulse text-muted-foreground">Chargement du classement...</div>
                </div>
            </div>
        )
    }

    return (
        <div className={cn("max-w-md mx-auto h-full flex flex-col bg-[#080C14] relative", isEmbedded && "h-auto bg-transparent")}>
            {/* Header */}
            {!isEmbedded && (
                <div className="flex items-center justify-between p-4 z-10">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full hover:bg-white/10">
                        <ChevronLeft className="w-6 h-6" />
                    </Button>
                    <span className="font-bold text-lg">Classement</span>
                    <div className="h-9 w-9 rounded-full bg-cyan-500/10 flex items-center justify-center">
                        <Trophy className="w-5 h-5 text-cyan-500" />
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto pb-32 no-scrollbar">
                {/* Toggle */}
                <div className="px-6 mb-8">
                    <div className="bg-[#0F1720] border border-white/5 p-1 rounded-2xl flex relative">
                        <div
                            className={cn("absolute top-1 bottom-1 w-[48%] bg-[#1A2530] rounded-xl transition-all duration-300 shadow-lg border border-white/5",
                                filter === 'week' ? 'left-1' : 'left-[51%]'
                            )}
                        />
                        <button
                            className={cn("flex-1 py-2 text-xs font-bold relative z-10 transition-colors", filter === 'week' ? 'text-white' : 'text-gray-500')}
                            onClick={() => setFilter('week')}
                        >
                            Cette semaine
                        </button>
                        <button
                            className={cn("flex-1 py-2 text-xs font-bold relative z-10 transition-colors", filter === 'all' ? 'text-white' : 'text-gray-500')}
                            onClick={() => setFilter('all')}
                        >
                            Général
                        </button>
                    </div>
                </div>

                {/* Podium */}
                {topThree.length >= 3 && (
                    <div className="flex justify-center items-end gap-2 mb-8 px-4 h-48">
                        {/* Rank 2 */}
                        <div className="flex flex-col items-center gap-2 w-1/3">
                            <div className="relative">
                                <div className="h-16 w-16 rounded-full border-2 border-[#1A2530] p-1 bg-[#1A2530] overflow-hidden">
                                    <Avatar className="h-full w-full">
                                        <AvatarImage src={topThree[1]?.avatar || ''} className="object-cover" />
                                        <AvatarFallback>{topThree[1]?.name?.[0] || 'M'}</AvatarFallback>
                                    </Avatar>
                                </div>
                                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[#1A2530] border border-white/10 flex items-center justify-center text-xs font-bold text-gray-400 shadow-lg">2</div>
                            </div>
                            <div className="text-center mt-2 relative z-10 bg-gradient-to-b from-[#1A2530] to-transparent w-full pt-4 pb-2 rounded-t-2xl border-t border-x border-white/5">
                                <p className="font-bold text-sm truncate w-full px-2">{topThree[1]?.name}</p>
                                <p className="text-[10px] text-gray-500">{topThree[1]?.xp} pts</p>
                            </div>
                        </div>

                        {/* Rank 1 */}
                        <div className="flex flex-col items-center gap-2 w-1/3 z-20 -mt-8">
                            <div className="relative">
                                <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full" />
                                <div className="h-20 w-20 rounded-full border-2 border-amber-500 p-1 bg-[#1A2530] overflow-hidden relative shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                                    <Avatar className="h-full w-full">
                                        <AvatarImage src={topThree[0]?.avatar || ''} className="object-cover" />
                                        <AvatarFallback>{topThree[0]?.name?.[0] || 'A'}</AvatarFallback>
                                    </Avatar>
                                </div>
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <Trophy className="w-5 h-5 text-amber-500 fill-amber-500" />
                                </div>
                                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-xs font-bold text-black shadow-lg border-2 border-[#0F1720]">1</div>
                            </div>
                            <div className="text-center mt-3 bg-gradient-to-b from-amber-500/10 to-transparent w-full pt-4 pb-4 rounded-t-2xl border-t border-x border-amber-500/20">
                                <p className="font-bold text-sm truncate w-full px-2 text-amber-500">{topThree[0]?.name}</p>
                                <p className="text-xs font-bold text-cyan-400">{topThree[0]?.xp} pts</p>
                            </div>
                        </div>

                        {/* Rank 3 */}
                        <div className="flex flex-col items-center gap-2 w-1/3">
                            <div className="relative">
                                <div className="h-16 w-16 rounded-full border-2 border-[#1A2530] p-1 bg-[#1A2530] overflow-hidden">
                                    <Avatar className="h-full w-full">
                                        <AvatarImage src={topThree[2]?.avatar || ''} className="object-cover" />
                                        <AvatarFallback>{topThree[2]?.name?.[0] || 'S'}</AvatarFallback>
                                    </Avatar>
                                </div>
                                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[#1A2530] border border-white/10 flex items-center justify-center text-xs font-bold text-orange-700 shadow-lg">3</div>
                            </div>
                            <div className="text-center mt-2 relative z-10 bg-gradient-to-b from-[#1A2530] to-transparent w-full pt-4 pb-2 rounded-t-2xl border-t border-x border-white/5">
                                <p className="font-bold text-sm truncate w-full px-2">{topThree[2]?.name}</p>
                                <p className="text-[10px] text-gray-500">{topThree[2]?.xp} pts</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* List */}
                <div className="px-4 space-y-2">
                    {rankings.map((user) => (
                        <div key={user.rank} className={cn(
                            "flex items-center gap-4 p-3 rounded-2xl border transition-all",
                            user.isUser
                                ? "bg-cyan-950/30 border-cyan-500/30 relative overflow-hidden"
                                : "bg-[#0F1720] border-white/5"
                        )}>
                            {user.isUser && (
                                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-transparent opacity-50" />
                            )}

                            <span className={cn("text-xs font-bold w-6 text-center", user.isUser ? "text-cyan-500" : "text-gray-500")}>
                                {user.rank}
                            </span>

                            <Avatar className="h-10 w-10 border border-white/10">
                                <AvatarImage src={user.avatar || ''} className="object-cover" />
                                <AvatarFallback>{user.name?.[0]}</AvatarFallback>
                            </Avatar>

                            <div className="flex-1 min-w-0 z-10">
                                <div className="flex items-center gap-2">
                                    <p className={cn("font-bold text-sm truncate", user.isUser && "text-white")}>{user.name}</p>
                                    {user.isUser && <span className="text-[9px] bg-cyan-500 text-black px-1.5 py-0.5 rounded font-bold uppercase">Vous</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-gray-500">Niveau {user.level}</span>
                                    <span className="text-[10px] text-orange-500 flex items-center gap-0.5">
                                        <Flame className="w-3 h-3 fill-orange-500" />
                                        {user.streak} jours
                                    </span>
                                </div>
                            </div>

                            <div className="text-right z-10">
                                <span className={cn("font-bold text-sm", user.isUser ? "text-cyan-400" : "text-cyan-500/70")}>{user.xp} pts</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom Floating Stats */}
            {userEntry && userEntry.rank > 10 && (
                <div className="fixed bottom-6 left-0 right-0 p-4 z-20 pointer-events-none">
                    <div className="max-w-md mx-auto pointer-events-auto">
                        <div className="bg-gradient-to-r from-cyan-500 to-blue-500 rounded-3xl p-4 flex items-center justify-between shadow-2xl shadow-cyan-500/30 relative overflow-hidden">
                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />

                            <div className="flex items-center gap-4 relative z-10 text-black">
                                <div className="h-10 w-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                                    <ArrowUp className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <p className="font-extrabold text-sm ml-1">Presque là !</p>
                                    <p className="text-[11px] font-medium opacity-80 leading-tight ml-1">
                                        Tu es à {pointsToNext} pts du rang {userEntry.rank - 1} !
                                    </p>
                                </div>
                            </div>

                            <Button size="sm" className="bg-[#080C14] hover:bg-black text-white border-none rounded-xl h-9 relative z-10 text-xs font-bold px-4">
                                Booster mes points
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

