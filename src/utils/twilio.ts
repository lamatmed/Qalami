'use server'

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID!
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN!
const TWILIO_VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID!

const twilioAuthHeader = 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')

/**
 * Send an OTP code to a phone number via Twilio Verify API
 */
export async function sendOTP(phone: string) {
    try {
        const response = await fetch(
            `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/Verifications`,
            {
                method: 'POST',
                headers: {
                    'Authorization': twilioAuthHeader,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    To: phone,
                    Channel: 'sms',
                }),
            }
        )

        const data = await response.json()

        if (!response.ok) {
            console.error('Twilio send OTP error:', data)
            if (data.code === 60200) {
                return { error: 'Numéro de téléphone invalide' }
            }
            return { error: 'Erreur lors de l\'envoi du code. Réessayez.' }
        }

        return { success: true, status: data.status }
    } catch (error) {
        console.error('Twilio send OTP exception:', error)
        return { error: 'Erreur de connexion au service SMS' }
    }
}

/**
 * Verify an OTP code via Twilio Verify API
 */
export async function verifyOTP(phone: string, code: string) {
    try {
        const response = await fetch(
            `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`,
            {
                method: 'POST',
                headers: {
                    'Authorization': twilioAuthHeader,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    To: phone,
                    Code: code,
                }),
            }
        )

        const data = await response.json()

        if (!response.ok || data.status !== 'approved') {
            return { error: 'Code incorrect ou expiré' }
        }

        return { success: true }
    } catch (error) {
        console.error('Twilio verify OTP exception:', error)
        return { error: 'Erreur de vérification' }
    }
}
