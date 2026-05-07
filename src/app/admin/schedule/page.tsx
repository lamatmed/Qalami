'use client'

import { useState, useRef } from 'react'
import { ScheduleView } from '@/components/admin/schedule/schedule-view'
import { ClassSelector } from '@/components/admin/schedule/class-selector'
import { TeacherSelector } from '@/components/admin/schedule/teacher-selector'
import { CopyScheduleDialog } from '@/components/admin/schedule/copy-schedule-dialog'
import { ImportScheduleDialog } from '@/components/admin/schedule/import-schedule-dialog'
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
    const [copyOpen, setCopyOpen]               = useState(false)
    const [importOpen, setImportOpen]           = useState(false)
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
            const html2canvas = (await import('html2canvas')).default
            const { jsPDF } = await import('jspdf')
            const element = scheduleRef.current
            if (!element) throw new Error('No schedule element')
            const canvas = await html2canvas(element, {
                scale: 2,
                backgroundColor: '#0D1117',
                useCORS: true,
            })
            const imgData = canvas.toDataURL('image/png')
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
            const pdfWidth = pdf.internal.pageSize.getWidth()
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
            pdf.save(`emploi-du-temps-${new Date().toISOString().split('T')[0]}.pdf`)
            toast.success(t('admin.schedule.exportSuccess'))
        } catch (err) {
            toast.error(t('admin.schedule.exportError'))
        } finally {
            setExporting(false)
        }
    }

    return (
        <div className="h-full flex flex-col space-y-6">
            {/* Actions */}
            <div className="flex flex-wrap justify-end gap-2 print:hidden">
                    <Button variant="outline" onClick={() => setImportOpen(true)}>
                        <Upload className="w-4 h-4 me-2" /> {t('admin.schedule.import')}
                    </Button>
                    <Button variant="outline" onClick={() => setCopyOpen(true)}>
                        <Copy className="w-4 h-4 me-2" /> {t('admin.schedule.copy')}
                    </Button>
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

            {/* Dialogs */}
            <CopyScheduleDialog
                open={copyOpen}
                onClose={() => setCopyOpen(false)}
                onSuccess={() => { setCopyOpen(false); setRefreshKey(k => k + 1) }}
            />
            <ImportScheduleDialog
                open={importOpen}
                onClose={() => setImportOpen(false)}
                onSuccess={() => { setImportOpen(false); setRefreshKey(k => k + 1) }}
            />
        </div>
    )
}
