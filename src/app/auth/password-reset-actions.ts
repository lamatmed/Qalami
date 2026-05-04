'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { sendOTP, verifyOTP } from '@/utils/twilio'

/**
 * Step 1: Send OTP to the user's phone number
 * Validates that the phone exists in profiles first
 */
export async function requestPasswordReset(phone: string) {
    const adminClient = createAdminClient()
    const normalizedPhone = phone.replace(/[\s\-()]/g, '')

    // Verify phone exists in profiles
    const { data: profile } = await adminClient
        .from('profiles')
        .select('id, full_name')
        .or(`phone.eq.${normalizedPhone},phone.eq.+${normalizedPhone}`)
        .maybeSingle()

    if (!profile) {
        return { error: 'Numéro de téléphone non trouvé' }
    }

    // Send OTP via Twilio
    const result = await sendOTP(normalizedPhone)
    if (result.error) {
        return { error: result.error }
    }

    return { success: true, userName: profile.full_name }
}

/**
 * Step 2: Verify OTP code
 */
export async function verifyPasswordResetOTP(phone: string, code: string) {
    const normalizedPhone = phone.replace(/[\s\-()]/g, '')

    const result = await verifyOTP(normalizedPhone, code)
    if (result.error) {
        return { error: result.error }
    }

    return { success: true }
}

/**
 * Step 3: Reset the user's PIN after OTP verification
 */
export async function resetPin(phone: string, newPin: string) {
    const adminClient = createAdminClient()
    const normalizedPhone = phone.replace(/[\s\-()]/g, '')

    // Look up user
    const { data: profile } = await adminClient
        .from('profiles')
        .select('id')
        .or(`phone.eq.${normalizedPhone},phone.eq.+${normalizedPhone}`)
        .maybeSingle()

    if (!profile) {
        return { error: 'Utilisateur non trouvé' }
    }

    const { error } = await adminClient.auth.admin.updateUserById(
        profile.id,
        { password: newPin }
    )

    if (error) {
        return { error: 'Erreur lors de la réinitialisation: ' + error.message }
    }

    return { success: true }
}
