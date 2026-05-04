'use client'

import { Flame, Trophy, Zap, BookOpen } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import Link from 'next/link'
import { useStudent } from '@/context/student-context'
import { cn } from '@/lib/utils'

// Keep daily challenges static for now (gamification features would need their own tables)
const dailyChallenges = [
    {
        id: 1,
        title: "Terminer quiz Math",
        subject: "Algèbre linéaire",
        xp: 20,
        icon: "zap",
        color: "blue"
    },
    {
        id: 2,
        title: "Lire cours Français",
        subject: "La littérature moderne",
        xp: 15,
        icon: "book",
        color: "emerald"
    },
    {
        id: 3,
        title: "Réviser Histoire",
        subject: "L'indépendance",
        xp: 10,
        icon: "clock",
        color: "amber"
    }
]

export function GamificationStats() {
    const { student, loading } = useStudent()

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="bg-[#0F1720] border border-white/5 rounded-3xl p-5 animate-pulse h-48" />
            </div>
        )
    }

    const levelProgress = student ? Math.min(100, Math.round((student.xp % 100) / 100 * 100)) : 0

    return (
        <div className="space-y-4">
            {/* Main Stats Card */}
            <div className="bg-[#0F1720] border border-white/5 rounded-3xl p-5 relative overflow-hidden shadow-lg">
                <div className="grid grid-cols-2 gap-4 mb-6">
                    {/* Streak */}
                    <div className="bg-[#1A2530] rounded-2xl p-3 border border-white/5 flex flex-col items-center justify-center relative overflow-hidden group">
                        <div className="absolute inset-0 bg-orange-500/5 group-hover:bg-orange-500/10 transition-colors" />
                        <Flame className="w-6 h-6 text-orange-500 mb-1 fill-orange-500 animate-pulse" />
                        <span className="text-2xl font-bold text-white">{student?.streak || 0} Jours</span>
                        <span className="text-[10px] text-orange-400 font-medium uppercase tracking-wider">Série Actuelle</span>
                    </div>

                    {/* XP */}
                    <Link href="/student/leaderboard" className="bg-[#1A2530] rounded-2xl p-3 border border-white/5 flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer hover:border-purple-500/30 transition-all">
                        <div className="absolute inset-0 bg-purple-500/5 group-hover:bg-purple-500/10 transition-colors" />
                        <Trophy className="w-6 h-6 text-purple-500 mb-1" />
                        <span className="text-2xl font-bold text-white">{student?.xp || 0}</span>
                        <span className="text-[10px] text-purple-400 font-medium uppercase tracking-wider">XP Total</span>
                    </Link>
                </div>

                {/* Level Progress */}
                <div>
                    <div className="flex justify-between items-end mb-2">
                        <div>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">PROGRÈS NIVEAU {student?.level || 1}</p>
                            <span className="text-2xl font-bold text-white">{levelProgress}%</span>
                        </div>
                        <span className="text-[10px] text-emerald-400 font-medium bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                            +{student?.nextLevelXp || 100} XP pour le niveau {(student?.level || 1) + 1}
                        </span>
                    </div>
                    <Progress value={levelProgress} className="h-2 bg-[#1A2530]" indicatorClassName="bg-gradient-to-r from-purple-500 to-cyan-500" />
                </div>
            </div>

            {/* Daily Challenges - Compact List */}
            <div className="bg-[#0F1720] border border-white/5 rounded-3xl p-5">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-sm text-gray-200">Défis du jour</h3>
                    <span className="text-[10px] bg-white/5 px-2 py-1 rounded-full text-gray-400">3 Restants</span>
                </div>

                <div className="space-y-3">
                    {dailyChallenges.map((challenge) => (
                        <div key={challenge.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/5 transition-colors cursor-pointer group">
                            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110",
                                challenge.color === 'blue' ? "bg-blue-500/10 text-blue-500" :
                                    challenge.color === 'emerald' ? "bg-emerald-500/10 text-emerald-500" :
                                        "bg-amber-500/10 text-amber-500"
                            )}>
                                {challenge.icon === 'zap' && <Zap className="w-4 h-4 fill-current" />}
                                {challenge.icon === 'book' && <BookOpen className="w-4 h-4" />}
                                {challenge.icon === 'clock' && <Clock className="w-4 h-4" />}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-center mb-0.5">
                                    <p className="text-xs font-bold text-gray-200">{challenge.title}</p>
                                    <span className="text-[10px] font-bold text-amber-500">+{challenge.xp} XP</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground">{challenge.subject}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

function Clock(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    )
}
