'use client'

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, FileText, Clock, CheckCircle2 } from "lucide-react"
import { useParent } from "@/context/parent-context"
import { useLanguage } from "@/i18n"

export default function RequestsPage() {
    const { selectedChild, childrenList } = useParent()
    const { t } = useLanguage()

    // Get first and second child names for demo
    const childName = selectedChild?.name || childrenList[0]?.name || t('parent.requests.child')
    const secondChildName = childrenList[1]?.name || childrenList[0]?.name || t('parent.requests.child')

    return (
        <div className="max-w-md mx-auto lg:max-w-3xl lg:ms-12 lg:me-auto pb-24 space-y-6 p-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('parent.requests.title')}</h1>
                    <p className="text-muted-foreground">{t('parent.requests.subtitle')}</p>
                </div>
                <Button className="bg-amber-600 hover:bg-amber-700 text-white">
                    <Plus className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" /> {t('parent.requests.newRequest')}
                </Button>
            </div>

            <Tabs defaultValue="active" className="w-full">
                <TabsList>
                    <TabsTrigger value="active">{t('parent.requests.inProgress')}</TabsTrigger>
                    <TabsTrigger value="history">{t('parent.requests.history')}</TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="mt-4 space-y-4">
                    <Card>
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <FileText className="h-5 w-5 text-blue-600" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-base">{t('parent.requests.schoolCertificate')}</h3>
                                <p className="text-sm text-muted-foreground">{t('parent.requests.initiatedOn', { name: childName, date: '30 Janv.' })}</p>
                            </div>
                            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1 rounded-full text-xs font-medium border border-amber-200">
                                <Clock className="h-3 w-3" />
                                {t('parent.requests.inTreatment')}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="history" className="mt-4 space-y-4">
                    <Card>
                        <CardContent className="p-6 flex items-center gap-4 opacity-70">
                            <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                <FileText className="h-5 w-5 text-gray-600" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-base">{t('parent.requests.reportCardT1')}</h3>
                                <p className="text-sm text-muted-foreground">{t('parent.requests.processedOn', { name: secondChildName, date: '15 Janv.' })}</p>
                            </div>
                            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-xs font-medium border border-emerald-200">
                                <CheckCircle2 className="h-3 w-3" />
                                {t('parent.requests.processed')}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}

