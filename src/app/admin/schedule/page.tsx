'use client'

import { useState, useRef } from 'react'
import { ScheduleView } from '@/components/admin/schedule/schedule-view'
import { ClassSelector } from '@/components/admin/schedule/class-selector'
import { TeacherSelector } from '@/components/admin/schedule/teacher-selector'
import { Button } from '@/components/ui/button'
import { Download, Printer, Loader2, Copy, Upload, Users, GraduationCap } from 'lucide-react'
import { useLanguage } from '@/i18n'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type ViewMode = 'class' | 'teacher'

export default function SchedulePage() {
    const { t } = useLanguage()
    const [viewMode, setViewMode]               = useState<ViewMode>('class')
    const [selectedClassId, setSelectedClassId] = useState('')
    const [selectedTeacherId, setSelectedTeacherId] = useState('')
    const [refreshKey, setRefreshKey]           = useState(0)
    const [exporting, setExporting]             = useState(false)
    const scheduleRef = useRef<HTMLDivElement>(null)

    const handlePrint = () => {
        const activeId = viewMode === 'class' ? selectedClassId : selectedTeacherId
        if (!activeId) {
            toast.error(t('admin.schedule.selectRequired'))
            return
        }
        window.print()
    }

    const handleExportPDF = async () => {
        const activeId = viewMode === 'class' ? selectedClassId : selectedTeacherId
        if (!activeId) {
            toast.error(t('admin.schedule.selectRequired'))
            return
        }
        setExporting(true)
        try {
            const { toPng } = await import('html-to-image')
            const { jsPDF } = await import('jspdf')
            const element = scheduleRef.current
            if (!element) throw new Error('No element')
            const dataUrl = await toPng(element, {
                quality: 1,
                pixelRatio: 1.5,
                backgroundColor: '#0D1117',
                skipAutoScale: false,
            })
            const img = new Image()
            img.src = dataUrl
            await new Promise<void>(resolve => { img.onload = () => resolve() })
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
            const pdfWidth = pdf.internal.pageSize.getWidth()
            const pdfHeight = (img.height * pdfWidth) / img.width
            const pageHeight = pdf.internal.pageSize.getHeight()
            pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, Math.min(pdfHeight, pageHeight))
            pdf.save(`emploi-du-temps-${new Date().toISOString().split('T')[0]}.pdf`)
            toast.success(t('admin.schedule.exportSuccess'))
        } catch (err) {
            console.error('[PDF export]', err)
            const msg = err instanceof Error ? err.message : String(err)
            toast.error(`${t('admin.schedule.exportError')} — ${msg}`)
        } finally {
            setExporting(false)
        }
    }

    return (
        <div className="h-full flex flex-col space-y-6">
            {/* Actions */}
            <div className="flex flex-wrap justify-end gap-2 print:hidden">
                    <Button variant="outline" onClick={handlePrint}>
                        <Printer className="w-4 h-4 me-2" /> {t('admin.schedule.print')}
                    </Button>
                    <Button
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                        onClick={handleExportPDF}
                        disabled={exporting}
                    >
                        {exporting ? (
                            <><Loader2 className="w-4 h-4 me-2 animate-spin" /> {t('admin.schedule.exporting')}</>
                        ) : (
                            <><Download className="w-4 h-4 me-2" /> {t('admin.schedule.exportPdf')}</>
                        )}
                    </Button>
            </div>

            {/* View mode toggle */}
            <div className="flex gap-1 bg-white/4 p-1 rounded-xl w-fit print:hidden border border-white/5">
                <button
                    type="button"
                    onClick={() => setViewMode('class')}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                        viewMode === 'class'
                            ? "bg-[#161B22] text-white/90 shadow-sm border border-white/8"
                            : "text-gray-500 hover:text-gray-300"
                    )}
                >
                    <Users className="w-4 h-4" />
                    {t('admin.schedule.byClass')}
                </button>
                <button
                    type="button"
                    onClick={() => setViewMode('teacher')}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                        viewMode === 'teacher'
                            ? "bg-[#161B22] text-white/90 shadow-sm border border-white/8"
                            : "text-gray-500 hover:text-gray-300"
                    )}
                >
                    <GraduationCap className="w-4 h-4" />
                    {t('admin.schedule.byTeacher')}
                </button>
            </div>

            {/* Selector */}
            <div className="print:hidden">
                {viewMode === 'class' ? (
                    <ClassSelector
                        selectedClass={selectedClassId}
                        onClassChange={setSelectedClassId}
                    />
                ) : (
                    <TeacherSelector
                        selectedTeacher={selectedTeacherId}
                        onTeacherChange={setSelectedTeacherId}
                    />
                )}
            </div>

            {/* Schedule Grid */}
            <div ref={scheduleRef}>
                <ScheduleView
                    classId={viewMode === 'class' ? selectedClassId || undefined : undefined}
                    teacherId={viewMode === 'teacher' ? selectedTeacherId || undefined : undefined}
                    viewMode={viewMode}
                    refreshKey={refreshKey}
                />
            </div>

        </div>
    )
}
