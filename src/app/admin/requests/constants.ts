import type { DocType } from './actions'

export const DOC_TYPE_LABELS: Record<DocType, string> = {
    attestation_scolarite: 'Attestation de scolarité',
    certificat_scolarite:  'Certificat de scolarité',
    bulletin:              'Bulletin scolaire',
    releve_notes:          'Relevé de notes',
    convention_stage:      'Convention de stage',
    autre:                 'Autre',
}
