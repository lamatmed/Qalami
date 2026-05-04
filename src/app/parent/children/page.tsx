'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GraduationCap, ArrowRight, Users, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useParent } from "@/context/parent-context"

export default function ChildrenPage() {
    const { childrenList, loading } = useParent()

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Mes Enfants</h1>
                <p className="text-muted-foreground">Gérez les profils et les informations de vos enfants.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {childrenList.map((child, index) => (
                    <Card key={child.id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xl font-bold">{child.name}</CardTitle>
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${index % 2 === 0
                                    ? 'bg-blue-100 dark:bg-blue-900'
                                    : 'bg-pink-100 dark:bg-pink-900'
                                }`}>
                                <GraduationCap className={`h-4 w-4 ${index % 2 === 0
                                        ? 'text-blue-600 dark:text-blue-400'
                                        : 'text-pink-600 dark:text-pink-400'
                                    }`} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm text-muted-foreground mb-4">{child.class}</div>
                            <Link href={`/parent/children/${child.id}`} className="w-full block">
                                <Button className="w-full" variant="outline">
                                    Voir le profil <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                ))}

                {childrenList.length === 0 && (
                    <Card className="border-dashed flex flex-col items-center justify-center p-6 text-center min-h-[200px]">
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                            <Users className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <h3 className="font-semibold text-lg">Aucun enfant associé</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            Contactez l'administration pour associer vos enfants à votre compte.
                        </p>
                    </Card>
                )}

                <Card className="border-dashed flex flex-col items-center justify-center p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer min-h-[250px]">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Users className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-lg">Associer un autre élève</h3>
                    <p className="text-sm text-muted-foreground mt-1 mb-4">Vous avez un code parent ? Ajoutez un autre enfant à votre compte.</p>
                    <Button>Ajouter un élève</Button>
                </Card>
            </div>
        </div>
    )
}
