import { jsPDF } from 'jspdf'

export function generateTransferPDF({
    schoolName,
    studentName,
    birthDate,
    birthPlace,
    nni,
    className,
    academicYear,
    transferDate
}: {
    schoolName: string
    studentName: string
    birthDate: string
    birthPlace: string
    nni: string
    className: string
    academicYear: string
    transferDate: string
}) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    // Add border
    doc.setDrawColor(16, 185, 129) // Emerald-500
    doc.setLineWidth(1)
    doc.rect(10, 10, 190, 277)
    doc.setDrawColor(22, 27, 34) // Darker border offset
    doc.setLineWidth(0.3)
    doc.rect(12, 12, 186, 273)

    // Header - School Name
    doc.setFont('Helvetica', 'bold')
    doc.setFontSize(16)
    doc.text(schoolName.toUpperCase(), 105, 30, { align: 'center' })

    doc.setFont('Helvetica', 'normal')
    doc.setFontSize(10)
    doc.text("MINISTÈRE DE L'ÉDUCATION NATIONALE", 105, 38, { align: 'center' })
    doc.text("RÉPUBLIQUE ISLAMIQUE DE MAURITANIE", 105, 43, { align: 'center' })

    // Decorative line
    doc.setDrawColor(16, 185, 129)
    doc.setLineWidth(0.5)
    doc.line(70, 48, 140, 48)

    // Title
    doc.setFont('Helvetica', 'bold')
    doc.setFontSize(20)
    doc.setTextColor(16, 185, 129)
    doc.text("CERTIFICAT DE TRANSFERT", 105, 65, { align: 'center' })
    
    // Subtitle
    doc.setFont('Helvetica', 'italic')
    doc.setFontSize(11)
    doc.setTextColor(100, 116, 139)
    doc.text("(Attestation de scolarité et de départ)", 105, 72, { align: 'center' })

    // Body Text
    doc.setTextColor(33, 37, 41)
    doc.setFont('Helvetica', 'normal')
    doc.setFontSize(12)
    
    let y = 95
    const lineHeight = 8

    doc.text(`Je soussigné, Directeur de l'établissement ${schoolName}, certifie par la présente que l'élève :`, 20, y)
    y += 15

    doc.setFont('Helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(`Nom complet : ${studentName}`, 25, y)
    y += lineHeight

    doc.setFont('Helvetica', 'normal')
    doc.setFontSize(12)
    doc.text(`Date et lieu de naissance : ${birthDate} à ${birthPlace || '—'}`, 25, y)
    y += lineHeight
    doc.text(`Numéro National d'Identité (NNI) : ${nni || '—'}`, 25, y)
    y += lineHeight
    doc.text(`Classe fréquentée : ${className || 'Non affecté'}`, 25, y)
    y += lineHeight
    doc.text(`Année scolaire : ${academicYear || '—'}`, 25, y)
    y += 18

    // Text block
    const textParagraph = `L'élève susmentionné(e) a été régulièrement inscrit(e) et a suivi les cours au sein de notre établissement. À sa demande (ou celle de son tuteur légal), il/elle est transféré(e) de notre établissement en date du ${transferDate}.`
    const splitText = doc.splitTextToSize(textParagraph, 170)
    doc.text(splitText, 20, y)
    y += splitText.length * lineHeight + 10

    doc.text("Ce certificat lui est délivré pour servir et valoir ce que de droit.", 20, y)
    y += 25

    // Footer Dates & Signatures
    const currentDate = new Date().toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    })
    doc.setFont('Helvetica', 'normal')
    doc.text(`Fait à Nouakchott, le ${currentDate}`, 120, y)
    y += 15

    doc.setFont('Helvetica', 'bold')
    doc.text("Le Directeur de l'Établissement", 120, y)
    doc.setFont('Helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(150, 150, 150)
    doc.text("(Cachet et Signature)", 135, y + 25)

    // Save
    doc.save(`certificat-transfert-${studentName.replace(/\s+/g, '-').toLowerCase()}.pdf`)
}
