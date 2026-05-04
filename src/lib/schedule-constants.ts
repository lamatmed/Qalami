/**
 * Shared constants and utilities for schedule/timetable views.
 * Used by parent-schedule, teacher-schedule, student-schedule-view.
 */

export const SESSION_TYPE_CONFIG: Record<string, { label: string; text: string }> = {
    course:   { label: 'Cours',    text: 'text-blue-400' },
    exam:     { label: 'Examen',   text: 'text-red-400' },
    homework: { label: 'Devoir',   text: 'text-amber-400' },
    revision: { label: 'Révision', text: 'text-purple-400' },
    lab:      { label: 'TP',       text: 'text-emerald-400' },
    activity: { label: 'Activité', text: 'text-cyan-400' },
}

/** ISO-day mapping: 1 = Monday … 7 = Sunday. */
export const DAY_NAMES_FR: Record<number, string> = {
    1: 'Lundi',
    2: 'Mardi',
    3: 'Mercredi',
    4: 'Jeudi',
    5: 'Vendredi',
    6: 'Samedi',
    7: 'Dimanche',
}

/** Short labels for the week-strip day selector. */
export const WEEK_DAYS_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/** Subject → accent border-left class. Falls back to border-l-blue-500. */
export const SUBJECT_BORDER_COLORS: Record<string, string> = {
    'Mathématiques':                    'border-l-cyan-500',
    'Français':                         'border-l-emerald-500',
    'Physique-Chimie':                  'border-l-purple-500',
    'Anglais':                          'border-l-amber-500',
    'Sciences de la Vie et de la Terre': 'border-l-green-500',
    'Arabe':                            'border-l-red-500',
    'Histoire-Géographie':              'border-l-orange-500',
}

export function getSessionConfig(type: string | null | undefined) {
    return SESSION_TYPE_CONFIG[type ?? 'course'] ?? SESSION_TYPE_CONFIG.course
}

export function getSubjectBorderColor(subjectName: string): string {
    return SUBJECT_BORDER_COLORS[subjectName] ?? 'border-l-blue-500'
}

/** Convert JS getDay() (0=Sun, 1=Mon) to our ISO 1-7 format. */
export function toIsoDay(jsDay: number): number {
    return jsDay === 0 ? 7 : jsDay
}
