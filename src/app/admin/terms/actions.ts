'use server'

import { getActionContext } from '@/lib/auth-action'
import { revalidatePath } from 'next/cache'

function termDates(yearName: string, term: 'T1' | 'T2' | 'T3') {
    const [startYear, endYear] = yearName.split('-').map(Number)
    if (term === 'T1') return { start: `${startYear}-10-01`, end: `${startYear}-12-31` }
    if (term === 'T2') return { start: `${endYear}-01-05`,   end: `${endYear}-03-31`   }
    return                    { start: `${endYear}-04-06`,   end: `${endYear}-06-30`   }
}

// ─── Academic Years ────────────────────────────────────────────────────────────

export async function createAcademicYear(yearName: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { supabase, schoolId } = ctx

    if (!/^\d{4}-\d{4}$/.test(yearName)) {
        return { error: 'Format invalide — utilisez AAAA-AAAA (ex: 2025-2026)' }
    }

    const [start, end] = yearName.split('-').map(Number)
    if (end !== start + 1) {
        return { error: 'Les deux années doivent être consécutives (ex: 2025-2026)' }
    }

    const { data: existing } = await supabase
        .from('academic_years')
        .select('id')
        .eq('school_id', schoolId)
        .eq('name', yearName)
        .limit(1)

    if (existing && existing.length > 0) {
        return { error: `L'année scolaire ${yearName} existe déjà` }
    }

    const { data: year, error: yearError } = await supabase
        .from('academic_years')
        .insert({
            school_id:  schoolId,
            name:       yearName,
            start_date: `${start}-10-01`,
            end_date:   `${end}-06-30`,
            is_current: false,
        })
        .select('id')
        .single()

    if (yearError || !year) return { error: yearError?.message ?? 'Erreur création année' }

    const LABELS = {
        T1: { fr: 'Premier Trimestre',   ar: 'الفصل الأول'   },
        T2: { fr: 'Deuxième Trimestre',  ar: 'الفصل الثاني'  },
        T3: { fr: 'Troisième Trimestre', ar: 'الفصل الثالث'  },
    }

    const terms = (['T1', 'T2', 'T3'] as const).map(name => {
        const dates = termDates(yearName, name)
        return {
            school_id:        schoolId,
            academic_year_id: year.id,
            name,
            label_fr:   LABELS[name].fr,
            label_ar:   LABELS[name].ar,
            start_date: dates.start,
            end_date:   dates.end,
            is_current: false,
        }
    })

    const { error: termsError } = await supabase.from('terms').insert(terms)
    if (termsError) return { error: termsError.message }

    revalidatePath('/admin/terms')
    return { success: true }
}

export async function setCurrentAcademicYear(yearId: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { supabase, schoolId } = ctx

    await supabase.from('academic_years').update({ is_current: false }).eq('school_id', schoolId)

    const { error } = await supabase
        .from('academic_years')
        .update({ is_current: true })
        .eq('id', yearId)
        .eq('school_id', schoolId)

    if (error) return { error: error.message }

    revalidatePath('/admin/terms')
    return { success: true }
}

export async function deleteAcademicYear(yearId: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { supabase, schoolId } = ctx

    const { data: year } = await supabase
        .from('academic_years')
        .select('is_current')
        .eq('id', yearId)
        .eq('school_id', schoolId)
        .single()

    if (year?.is_current) {
        return { error: "Impossible de supprimer l'année en cours. Définissez une autre année comme active d'abord." }
    }

    const { error } = await supabase
        .from('academic_years')
        .delete()
        .eq('id', yearId)
        .eq('school_id', schoolId)

    if (error) return { error: error.message }

    revalidatePath('/admin/terms')
    return { success: true }
}

// ─── Terms ─────────────────────────────────────────────────────────────────────

export async function setCurrentTerm(termId: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { supabase, schoolId } = ctx

    await supabase.from('terms').update({ is_current: false }).eq('school_id', schoolId)

    const { error } = await supabase
        .from('terms')
        .update({ is_current: true })
        .eq('id', termId)
        .eq('school_id', schoolId)

    if (error) return { error: error.message }

    revalidatePath('/admin/terms')
    return { success: true }
}

export async function updateTerm(
    id: string,
    data: {
        label_fr?:      string
        label_ar?:      string
        start_date?:    string
        end_date?:      string
        conseil_date?:  string | null
        bulletin_date?: string | null
    },
) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { supabase, schoolId } = ctx

    const { error } = await supabase
        .from('terms')
        .update(data)
        .eq('id', id)
        .eq('school_id', schoolId)

    if (error) return { error: error.message }

    revalidatePath('/admin/terms')
    return { success: true }
}

export async function closeTerm(currentTermId: string, nextTermId?: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { supabase, schoolId } = ctx

    await supabase.from('terms').update({ is_current: false }).eq('school_id', schoolId)

    if (nextTermId) {
        const { error } = await supabase
            .from('terms')
            .update({ is_current: true })
            .eq('id', nextTermId)
            .eq('school_id', schoolId)
        if (error) return { error: error.message }
    }

    revalidatePath('/admin/terms')
    return { success: true }
}

export async function deleteTerm(id: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { supabase, schoolId } = ctx

    const { data: term } = await supabase
        .from('terms')
        .select('is_current')
        .eq('id', id)
        .eq('school_id', schoolId)
        .single()

    if (term?.is_current) {
        return { error: "Impossible de supprimer le trimestre actuel. Définissez un autre trimestre comme actuel d'abord." }
    }

    const { error } = await supabase
        .from('terms')
        .delete()
        .eq('id', id)
        .eq('school_id', schoolId)

    if (error) return { error: error.message }

    revalidatePath('/admin/terms')
    return { success: true }
}
