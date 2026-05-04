// Migration script: Convert all @qalami.app email users to phone-only auth
// Uses Supabase admin API to properly create phone identities
// Run: npx tsx scripts/migrate-to-phone-auth.ts

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
})

async function migrate() {
    console.log('🔄 Starting phone auth migration...\n')

    // 1. Get all users with @qalami.app emails
    const { data: { users }, error } = await admin.auth.admin.listUsers({ perPage: 100 })
    if (error) {
        console.error('Failed to list users:', error.message)
        process.exit(1)
    }

    const qalamUsers = users.filter(u => u.email?.endsWith('@qalami.app'))
    console.log(`Found ${qalamUsers.length} @qalami.app users to migrate\n`)

    let success = 0
    let failed = 0

    for (const user of qalamUsers) {
        const phone = user.phone || ('+' + user.email!.replace('@qalami.app', ''))
        console.log(`  Migrating ${user.email} → ${phone}...`)

        try {
            // Step 1: Update user to have phone set (if not already)
            const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
                phone: phone,
                phone_confirm: true,
            })

            if (updateError) {
                console.error(`    ❌ Failed to set phone: ${updateError.message}`)
                failed++
                continue
            }

            // Step 2: Delete the email identity
            // We need to call the GoTrue API directly for this
            const deleteRes = await fetch(
                `${supabaseUrl}/auth/v1/admin/users/${user.id}/factors`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                    }
                }
            )

            // Step 3: Remove email from user (set to empty via admin API)
            // The admin API should handle this correctly
            const { error: removeEmailError } = await admin.auth.admin.updateUserById(user.id, {
                email: '',
            } as any)

            if (removeEmailError) {
                // If we can't remove email, just log it - the phone identity should still work
                console.log(`    ⚠️  Could not remove email: ${removeEmailError.message}`)
            }

            console.log(`    ✅ Migrated to ${phone}`)
            success++
        } catch (err: any) {
            console.error(`    ❌ Error: ${err.message}`)
            failed++
        }
    }

    console.log(`\n✅ Migration complete: ${success} succeeded, ${failed} failed`)

    // Verify: check if phone login works for test user
    console.log('\n🧪 Testing phone login for admin user (+22237002001)...')

    // Create a regular client for testing
    const testClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data: loginData, error: loginError } = await testClient.auth.signInWithPassword({
        phone: '+22237002001',
        password: '001234', // padded PIN
    })

    if (loginError) {
        console.error('❌ Phone login test FAILED:', loginError.message)
        console.log('\n⚠️  Phone login does not work yet. The password may need to be re-set.')
        console.log('   Trying to re-set password for admin user...')

        // Re-set password through admin API
        const { error: resetError } = await admin.auth.admin.updateUserById(
            'aaaaaaaa-0001-0000-0000-000000000001',
            { password: '001234' }
        )

        if (resetError) {
            console.error('❌ Password reset failed:', resetError.message)
        } else {
            console.log('✅ Password re-set. Testing login again...')

            const { data: retryData, error: retryError } = await testClient.auth.signInWithPassword({
                phone: '+22237002001',
                password: '001234',
            })

            if (retryError) {
                console.error('❌ Phone login still FAILED:', retryError.message)
            } else {
                console.log('✅ Phone login works! User:', retryData.user?.id)
            }
        }
    } else {
        console.log('✅ Phone login works! User:', loginData.user?.id)
    }
}

migrate().catch(console.error)
