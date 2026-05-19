'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

/**
 * Step 1: Send OTP to the user's phone number using native Supabase auth (linked to Twilio)
 * Validates that the phone exists in profiles first
 */
export async function requestPasswordReset(phone: string) {
    const adminClient = createAdminClient()
    const supabase = await createClient()
    
    const normalizedPhone = phone.replace(/[\s\-()]/g, '')
    let searchPhone = normalizedPhone
    if (!searchPhone.startsWith('+')) {
        searchPhone = `+${searchPhone}`
    }
    const altPhone = searchPhone.substring(1)

    // Verify phone exists in profiles
    const { data: profile } = await adminClient
        .from('profiles')
        .select('id, full_name')
        .or(`phone.eq.${searchPhone},phone.eq.${altPhone}`)
        .maybeSingle()

    if (!profile) {
        return { error: 'Numéro de téléphone non trouvé' }
    }

    // Send OTP via Supabase native Auth (linked to Twilio dashboard side)
    const { error } = await supabase.auth.signInWithOtp({
        phone: searchPhone,
        options: {
            shouldCreateUser: false, // Security: don't automatically register unknown numbers
        }
    })

    if (error) {
        console.error('[Supabase Phone OTP Error]:', error)
        return { error: error.message }
    }

    return { success: true, userName: profile.full_name }
}

/**
 * Step 2: Verify OTP code via Supabase native Auth
 */
export async function verifyPasswordResetOTP(phone: string, code: string) {
    const supabase = await createClient()
    
    const normalizedPhone = phone.replace(/[\s\-()]/g, '')
    let searchPhone = normalizedPhone
    if (!searchPhone.startsWith('+')) {
        searchPhone = `+${searchPhone}`
    }

    // Verify OTP with Supabase
    const { error } = await supabase.auth.verifyOtp({
        phone: searchPhone,
        token: code,
        type: 'sms',
    })

    if (error) {
        console.error('[Supabase OTP Verify Error]:', error)
        if (error.message.toLowerCase().includes('expired') || error.message.toLowerCase().includes('invalid')) {
            return { error: 'Code de validation invalide ou expiré' }
        }
        return { error: error.message }
    }

    return { success: true }
}

/**
 * Step 3: Reset the user's PIN in the DB after successful OTP verification
 */
export async function resetPin(phone: string, newPin: string) {
    const adminClient = createAdminClient()
    
    const normalizedPhone = phone.replace(/[\s\-()]/g, '')
    let searchPhone = normalizedPhone
    if (!searchPhone.startsWith('+')) {
        searchPhone = `+${searchPhone}`
    }
    const altPhone = searchPhone.substring(1)

    // Look up user
    const { data: profile } = await adminClient
        .from('profiles')
        .select('id')
        .or(`phone.eq.${searchPhone},phone.eq.${altPhone}`)
        .maybeSingle()

    if (!profile) {
        return { error: 'Utilisateur non trouvé' }
    }

    // Force update user's password (PIN) using Admin privilege bypass
    const { error } = await adminClient.auth.admin.updateUserById(
        profile.id,
        { password: newPin }
    )

    if (error) {
        console.error('[Supabase Admin User Update Error]:', error)
        return { error: 'Erreur lors de la réinitialisation: ' + error.message }
    }

    return { success: true }
}
