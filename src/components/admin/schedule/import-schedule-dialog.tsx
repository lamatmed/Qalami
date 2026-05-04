'use client'

import { useState, useRef } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, Upload, Loader2, CheckCircle2, AlertTriangle, FileSpreadsheet } from 'lucide-react'
import { importSchedule, type ImportRow } from '@/app/admin/schedule/actions'
import { toast } from 'sonner'

// ─── Template ──────────────────────────────────────────────────────────────────

const TEMPLATE_ROWS = [
    '6ème A,1,08:00,09:00,Mathématiques,Ahmed Mohamed,Salle 101,course',
    '6ème A,1,09:00,10:00,Français,Fatima Salem,Salle 102,course',
    '6ème A,2,08:00,09:00,Sciences,Mohamed Ould Ahmed,Labo 1,lab',
    '6ème B,1,08:00,09:00,Mathématiques,Ahmed Mohamed,Salle 103,course',
]

function downloadTemplate() {
    const header = 'classe,jour,heure_debut,heure_fin,matiere,enseignant,salle,type_seance'
    const notes = [
        '# NOTES:',
        '# jour: 1=Lundi 2=Mardi 3=Mercredi 4=Jeudi 5=Vendredi',
        '# type_seance: course exam homework revision lab activity',
        '# Les noms de classe/matiere/enseignant doivent correspondre exactement aux données du système',
    ].join('\n')
    const csv = [notes, header, ...TEMPLATE_ROWS].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'modele-emploi-du-temps.csv'
    a.click()
    URL.revokeObjectURL(url)
}

// ─── CSV Parser ────────────────────────────────────────────────────────────────

function parseCSV(text: string): ImportRow[] {
    const lines = text
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'))

    if (lines.length < 2) return []

    const header = lines[0].split(',').map(h => h.trim().toLowerCase())

    return lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim())
        const obj: Record<string, string> = {}
        header.forEach((h, i) => { obj[h] = values[i] || '' })

        return {
            classe:      obj['classe']      || '',
            jour:        parseInt(obj['jour']) || 1,
            heure_debut: obj['heure_debut'] || '',
            heure_fin:   obj['heure_fin']   || '',
            matiere:     obj['matiere']     || '',
            enseignant:  obj['enseignant']  || '',
            salle:       obj['salle']       || '',
            type_seance: obj['type_seance'] || 'course',
        } satisfies ImportRow
    }).filter(r => r.classe && r.matiere && r.enseignant && r.heure_debut && r.heure_fin)
}

// ─── Component ─────────────────────────────────────────────────────────────────

const DAY_LABELS: Record<number, string> = { 1: 'Lun', 2: 'Mar', 3: 'Mer', 4: 'Jeu', 5: 'Ven' }

export function ImportScheduleDialog({
    open,
    onClose,
    onSuccess,
}: {
    open: boolean
    onClose: () => void
    onSuccess: () => void
}) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [parsed, setParsed] = useState<ImportRow[] | null>(null)
    const [fileName, setFileName] = useState('')
    const [saving, setSaving] = useState(false)
    const [result, setResult] = useState<{ count: number; errors: { row: number; reason: string }[] } | null>(null)

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setFileName(file.name)
        setResult(null)
        const reader = new FileReader()
        reader.onload = (ev) => {
            const text = ev.target?.result as string
            const rows = parseCSV(text)
            setParsed(rows)
        }
        reader.readAsText(file, 'utf-8')
    }

    const handleImport = async () => {
        if (!parsed || parsed.length === 0) return
        setSaving(true)
        const res = await importSchedule(parsed)
        setSaving(false)
        if (res.error && !('count' in res)) {
            toast.error(res.error)
            return
        }
        const successRes = res as { count: number; errors: { row: number; reason: string }[] }
        setResult({ count: successRes.count || 0, errors: successRes.errors || [] })
        if (successRes.count > 0) {
            toast.success(`${successRes.count} créneaux importés`)
        }
    }

    const handleClose = () => {
        setParsed(null)
        setFileName('')
        setResult(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        if (result?.count) onSuccess()
        else onClose()
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[600px] bg-card border-border text-foreground max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4" />
                        Importer depuis CSV
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Téléchargez le modèle, remplissez-le, puis importez-le.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto grid gap-4 py-2">
                    {/* Step 1: Download template */}
                    <div className="flex items-center justify-between bg-muted/50 rounded-xl p-4">
                        <div>
                            <p className="text-sm font-bold text-foreground">1. Télécharger le modèle</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Fichier CSV avec colonnes: classe, jour, heure_debut, heure_fin, matiere, enseignant, salle, type_seance
                            </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={downloadTemplate} className="shrink-0 ms-4">
                            <Download className="w-4 h-4 me-2" /> Modèle CSV
                        </Button>
                    </div>

                    {/* Step 2: Upload */}
                    <div className="grid gap-2">
                        <p className="text-sm font-bold text-foreground">2. Sélectionner le fichier</p>
                        <div
                            className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload className="w-8 h-8 text-muted-foreground" />
                            {fileName ? (
                                <p className="text-sm font-bold text-foreground">{fileName}</p>
                            ) : (
                                <p className="text-sm text-muted-foreground">Cliquer pour sélectionner un fichier CSV</p>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,text/csv"
                                className="hidden"
                                onChange={handleFile}
                            />
                        </div>
                    </div>

                    {/* Preview */}
                    {parsed && parsed.length > 0 && !result && (
                        <div className="grid gap-2">
                            <p className="text-sm font-bold text-foreground">
                                Aperçu — {parsed.length} lignes détectées
                            </p>
                            <div className="overflow-x-auto rounded-xl border border-border">
                                <table className="w-full text-xs">
                                    <thead className="bg-muted/50">
                                        <tr>
                                            {['Classe', 'Jour', 'Début', 'Fin', 'Matière', 'Enseignant', 'Salle'].map(h => (
                                                <th key={h} className="px-2 py-2 text-left font-bold text-muted-foreground">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {parsed.slice(0, 8).map((row, i) => (
                                            <tr key={i} className="border-t border-border">
                                                <td className="px-2 py-1.5 font-medium">{row.classe}</td>
                                                <td className="px-2 py-1.5 text-muted-foreground">{DAY_LABELS[row.jour] || row.jour}</td>
                                                <td className="px-2 py-1.5 font-mono">{row.heure_debut}</td>
                                                <td className="px-2 py-1.5 font-mono">{row.heure_fin}</td>
                                                <td className="px-2 py-1.5">{row.matiere}</td>
                                                <td className="px-2 py-1.5">{row.enseignant}</td>
                                                <td className="px-2 py-1.5 text-muted-foreground">{row.salle || '—'}</td>
                                            </tr>
                                        ))}
                                        {parsed.length > 8 && (
                                            <tr className="border-t border-border">
                                                <td colSpan={7} className="px-2 py-1.5 text-center text-muted-foreground">
                                                    + {parsed.length - 8} lignes supplémentaires
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Import results */}
                    {result && (
                        <div className="grid gap-3">
                            {result.count > 0 && (
                                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-emerald-400">
                                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                                    <span className="text-sm font-bold">{result.count} créneau{result.count > 1 ? 'x' : ''} importé{result.count > 1 ? 's' : ''} avec succès</span>
                                </div>
                            )}
                            {result.errors.length > 0 && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                                    <div className="flex items-center gap-2 text-red-400 text-sm font-bold mb-2">
                                        <AlertTriangle className="w-4 h-4" />
                                        {result.errors.length} erreur{result.errors.length > 1 ? 's' : ''}
                                    </div>
                                    <ul className="space-y-1">
                                        {result.errors.map((e, i) => (
                                            <li key={i} className="text-xs text-red-300">
                                                Ligne {e.row}: {e.reason}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className="border-t border-border pt-4">
                    <Button variant="ghost" onClick={handleClose} className="text-muted-foreground">
                        {result ? 'Fermer' : 'Annuler'}
                    </Button>
                    {!result && (
                        <Button
                            onClick={handleImport}
                            disabled={saving || !parsed || parsed.length === 0}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                        >
                            {saving ? (
                                <><Loader2 className="w-4 h-4 me-2 animate-spin" /> Importation...</>
                            ) : (
                                <><Upload className="w-4 h-4 me-2" /> Importer {parsed ? `(${parsed.length})` : ''}</>
                            )}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
