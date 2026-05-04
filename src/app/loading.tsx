import Image from "next/image"

export default function Loading() {
    return (
        <div className="h-screen w-full flex items-center justify-center bg-gradient-to-br from-white via-blue-50/30 to-cyan-50/30 dark:from-[#09090b] dark:via-[#0a1628] dark:to-[#09090b]">
            <div className="flex flex-col items-center gap-8">
                {/* Logo */}
                <div className="animate-fade-in">
                    <Image
                        src="/Logo.png"
                        alt="Qalami"
                        width={200}
                        height={80}
                        priority
                        className="drop-shadow-lg"
                    />
                </div>

                {/* Loading indicator */}
                <div className="flex flex-col items-center gap-3">
                    <div className="flex gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-2 h-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-2 h-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 animate-bounce" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">Chargement...</p>
                </div>
            </div>
        </div>
    )
}
