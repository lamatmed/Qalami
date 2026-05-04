'use client'

import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Upload, FileText, AlertTriangle, CheckCircle2, Loader2, Download, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { bulkImportStudents } from '@/app/admin/students/actions'

interface CsvRow {
    prenom: string
    nom: string
    genre: string
    date_naissance: string
    classe: string
    _error?: string
}

interface ClassOption {
    id: string
    name: string
}

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    classes: ClassOption[]
    onSuccess: (count: number) => void
}

const TEMPLATE_CSV = 'prenom,nom,genre,date_naissance,classe\nFatima,Mint Ahmed,F,15/03/2010,CM1\nMohamed,Ould Brahim,M,22/07/2009,CM2'

function parseCSV(text: string): CsvRow[] {
    const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) return []

    const headers = lines[0].toLowerCase().split(',').map(h => h.trim())

    return lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim())
        const row: any = {}
        headers.forEach((h, i) => { row[h] = values[i] ?? '' })

        const errors: string[] = []
        if (!row.prenom?.trim()) errors.push('Prénom manquant')
        if (!row.nom?.trim()) errors.push('Nom manquant')
        if (row.genre && !['m', 'f', 'male', 'female', 'garçon', 'fille'].includes(row.genre.toLowerCase())) {
            errors.push('Genre invalide (M ou F)')
        }

        return {
            prenom: row.prenom ?? '',
            nom: row.nom ?? '',
            genre: row.genre ?? '',
            date_naissance: row.date_naissance ?? '',
            classe: row.classe ?? '',
            _error: errors.length > 0 ? errors.join(', ') : undefined,
        } as CsvRow
    })
}

function normalizeGender(g: string): string {
    const lower = g.toLowerCase()
    if (['m', 'male', 'garçon', 'garcon'].includes(lower)) return 'male'
    if (['f', 'female', 'fille'].includes(lower)) return 'female'
    return ''
}

function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'modele-import-eleves.csv'
    a.click()
    URL.revokeObjectURL(url)
}

export function CsvImportDialog({ open, onOpenChange, classes, onSuccess }: Props) {
    const fileRef = useRef<HTMLInputElement>(null)
    const [rows, setRows] = useState<CsvRow[]>([])
    const [fileName, setFileName] = useState('')
    const [importing, setImporting] = useState(false)
    const [result, setResult] = useState<{ ok: number; errors: string[] } | null>(null)

    const validRows = rows.filter(r => !r._error)
    const invalidRows = rows.filter(r => r._error)

    const handleFile = (file: File) => {
        if (!file) return
        setFileName(file.name)
        setResult(null)
        const reader = new FileReader()
        reader.onload = (e) => {
            const text = e.target?.result as string
            setRows(parseCSV(text))
        }
        reader.readAsText(file, 'utf-8')
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        const file = e.dataTransfer.files[0]
        if (file) handleFile(file)
    }

    const handleImport = async () => {
        if (validRows.length === 0) return
        setImporting(true)

        const payload = validRows.map(r => {
            const matchedClass = classes.find(c => c.name.toLowerCase() === r.classe.toLowerCase())
            return {
                firstName: r.prenom,
                lastName: r.nom,
                gender: normalizeGender(r.genre),
                dateOfBirth: r.date_naissance || '',
                classId: matchedClass?.id ?? null,
            }
        })

        const res = await bulkImportStudents(payload)
        setImporting(false)

        if (res.error) {
            setResult({ ok: 0, errors: [res.error] })
        } else {
            setResult({ ok: res.created ?? 0, errors: res.errors ?? [] })
            if ((res.created ?? 0) > 0) {
                onSuccess(res.created ?? 0)
            }
        }
    }

    const reset = () => {
        setRows([])
        setFileName('')
        setResult(null)
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
            <DialogContent className="sm:max-w-2xl bg-[#1A2530] border-white/10 text-white max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-white flex items-center gap-2">
                        <Upload className="w-4 h-4 text-emerald-500" />
                        Importer des élèves depuis CSV
                    </DialogTitle>
                </DialogHeader>

                {/* Result state */}
                {result && (
                    <div className={cn(
                        "rounded-xl p-4 border text-sm",
                        result.ok > 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"
                    )}>
                        {result.ok > 0 && (
                            <div className="flex items-center gap-2 font-bold text-emerald-400 mb-1">
                                <CheckCircle2 className="w-4 h-4" />
                                {result.ok} élève{result.ok > 1 ? 's' : ''} importé{result.ok > 1 ? 's' : ''} avec succès
                            </div>
                        )}
                        {result.errors.length > 0 && (
                            <div className="text-red-400 space-y-1">
                                {result.errors.map((e, i) => <p key={i}>· {e}</p>)}
                            </div>
                        )}
                    </div>
                )}

                {/* Instructions */}
                {rows.length === 0 && (
                    <div className="space-y-4">
                        <div className="bg-[#0F1720] rounded-xl p-4 border border-white/5 text-sm space-y-2">
                            <p className="font-bold text-gray-300 text-xs uppercase tracking-wider mb-2">Format attendu</p>
                            <div className="font-mono text-xs text-gray-400 overflow-x-auto">
                                <p className="text-emerald-400">prenom,nom,genre,date_naissance,classe</p>
                                <p>Fatima,Mint Ahmed,F,15/03/2010,CM1</p>
                                <p>Mohamed,Ould Brahim,M,22/07/2009,CM2</p>
                            </div>
                        </div>

                        <div className="text-xs text-gray-500 space-y-1">
                            <p><span className="text-white font-medium">genre</span> : M ou F</p>
                            <p><span className="text-white font-medium">date_naissance</span> : JJ/MM/AAAA (optionnel)</p>
                            <p><span className="text-white font-medium">classe</span> : nom exact de la classe (optionnel)</p>
                        </div>

                        <button
                            onClick={downloadTemplate}
                            className="flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                            <Download className="w-3.5 h-3.5" /> Télécharger le modèle CSV
                        </button>
                    </div>
                )}

                {/* Drop zone */}
                {rows.length === 0 && (
                    <div
                        className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all cursor-pointer"
                        onDrop={handleDrop}
                        onDragOver={(e) => e.preventDefault()}
                        onClick={() => fileRef.current?.click()}
                    >
                        <FileText className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                        <p className="text-sm font-medium text-gray-400">Glisser le fichier CSV ici</p>
                        <p className="text-xs text-gray-600 mt-1">ou cliquer pour choisir</p>
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".csv,.txt"
                            className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                        />
                    </div>
                )}

                {/* Preview */}
                {rows.length > 0 && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-bold text-white">{fileName}</p>
                            <button onClick={reset} className="text-xs text-gray-500 hover:text-white flex items-center gap-1 transition-colors">
                                <X className="w-3.5 h-3.5" /> Changer
                            </button>
                        </div>

                        {/* Summary */}
                        <div className="flex gap-4 text-xs">
                            <span className="text-emerald-400 font-bold">{validRows.length} valide{validRows.length !== 1 ? 's' : ''}</span>
                            {invalidRows.length > 0 && <span className="text-red-400 font-bold">{invalidRows.length} erreur{invalidRows.length !== 1 ? 's' : ''}</span>}
                        </div>

                        {/* Errors */}
                        {invalidRows.length > 0 && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 space-y-1">
                                <p className="text-xs font-bold text-red-400 flex items-center gap-1.5 mb-2">
                                    <AlertTriangle className="w-3.5 h-3.5" /> Lignes ignorées
                                </p>
                                {invalidRows.map((r, i) => (
                                    <p key={i} className="text-xs text-red-400/80">
                                        <span className="font-medium">{r.prenom || '—'} {r.nom || '—'}</span> : {r._error}
                                    </p>
                                ))}
                            </div>
                        )}

                        {/* Valid rows preview */}
                        {validRows.length > 0 && (
                            <div className="bg-[#0F1720] rounded-xl border border-white/5 overflow-hidden max-h-56 overflow-y-auto">
                                <table className="w-full text-xs">
                                    <thead className="sticky top-0 bg-[#161B22]">
                                        <tr className="border-b border-white/5">
                                            <th className="text-left px-3 py-2 text-gray-500 font-bold uppercase tracking-wider">Nom</th>
                                            <th className="text-left px-3 py-2 text-gray-500 font-bold uppercase tracking-wider">Genre</th>
                                            <th className="text-left px-3 py-2 text-gray-500 font-bold uppercase tracking-wider hidden sm:table-cell">Naissance</th>
                                            <th className="text-left px-3 py-2 text-gray-500 font-bold uppercase tracking-wider">Classe</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {validRows.map((r, i) => {
                                            const matchedClass = classes.find(c => c.name.toLowerCase() === r.classe.toLowerCase())
                                            return (
                                                <tr key={i}>
                                                    <td className="px-3 py-2 text-white font-medium">{r.prenom} {r.nom}</td>
                                                    <td className="px-3 py-2 text-gray-400">{r.genre || '—'}</td>
                                                    <td className="px-3 py-2 text-gray-400 hidden sm:table-cell">{r.date_naissance || '—'}</td>
                                                    <td className="px-3 py-2">
                                                        {matchedClass
                                                            ? <span className="text-emerald-400">{matchedClass.name}</span>
                                                            : <span className="text-gray-600">{r.classe || '—'}</span>
                                                        }
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <Button
                            onClick={handleImport}
                            disabled={validRows.length === 0 || importing}
                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold"
                        >
                            {importing
                                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Import en cours…</>
                                : <><Upload className="w-4 h-4 mr-2" /> Importer {validRows.length} élève{validRows.length !== 1 ? 's' : ''}</>
                            }
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
