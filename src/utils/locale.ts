/**
 * Locale-aware date formatting utility.
 * All times are displayed in Mauritania timezone (UTC+0, no DST).
 */

export const MRU_TZ = 'Africa/Nouakchott'

export function getLocale(language: string): string {
    return language === 'ar' ? 'ar-SA' : 'fr-FR'
}

export function formatDate(date: string | Date, language: string): string {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString(getLocale(language), { timeZone: MRU_TZ })
}

export function formatDateTime(date: string | Date, language: string): string {
    const d = typeof date === 'string' ? new Date(date) : date
    const locale = getLocale(language)
    const datePart = d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric', timeZone: MRU_TZ })
    const timePart = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: MRU_TZ })
    return `${datePart} • ${timePart}`
}

export function formatDateTimeShort(date: string | Date, language: string): string {
    const d = typeof date === 'string' ? new Date(date) : date
    const locale = getLocale(language)
    const datePart = d.toLocaleDateString(locale, { day: '2-digit', month: 'short', timeZone: MRU_TZ })
    const timePart = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: MRU_TZ })
    return `${datePart} • ${timePart}`
}

export function formatNumber(value: number, language: string): string {
    return value.toLocaleString(getLocale(language))
}

export function formatCurrency(value: number, language: string, currency = 'MRU'): string {
    return new Intl.NumberFormat(getLocale(language), {
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value) + ' ' + currency
}
