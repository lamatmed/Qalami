/**
 * Locale-aware date formatting utility.
 * Uses the app's current language to determine the locale.
 */

export function getLocale(language: string): string {
    return language === 'ar' ? 'ar-SA' : 'fr-FR'
}

export function formatDate(date: string | Date, language: string): string {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString(getLocale(language))
}

export function formatDateTime(date: string | Date, language: string): string {
    const d = typeof date === 'string' ? new Date(date) : date
    const locale = getLocale(language)
    const datePart = d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
    const timePart = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    return `${datePart} • ${timePart}`
}

export function formatDateTimeShort(date: string | Date, language: string): string {
    const d = typeof date === 'string' ? new Date(date) : date
    const locale = getLocale(language)
    const datePart = d.toLocaleDateString(locale, { day: '2-digit', month: 'short' })
    const timePart = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
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
