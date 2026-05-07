'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GraduationCap, ArrowRight, Users, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useParent } from "@/context/parent-context"
import { useLanguage } from "@/i18n"

export default function ChildrenPage() {
    const { childrenList, loading } = useParent()
    const { t } = useLanguage()

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="max-w-md mx-auto lg:max-w-3xl lg:ms-12 lg:me-auto pb-24 space-y-6 p-4">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('parent.children.title')}</h1>
                <p className="text-muted-foreground">{t('parent.children.subtitle')}</p>
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
                                    {t('parent.children.viewProfile')} <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
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
                        <h3 className="font-semibold text-lg">{t('parent.children.noChildren')}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            {t('parent.children.contactAdminDesc')}
                        </p>
                    </Card>
                )}
{/* pas encore developper*/}
                <Card className="border-dashed flex flex-col items-center justify-center p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer min-h-[250px]">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Users className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-lg">{t('parent.children.associateAnother')}</h3>
                    <p className="text-sm text-muted-foreground mt-1 mb-4">{t('parent.children.hasParentCode')}</p>
                    <Button>{t('parent.children.addStudent')}</Button>
                </Card>
            </div>
        </div>
    )
}
