// Quick test: use admin API to set phone identity on admin user and test login
import { createClient } from '@supabase/supabase-js'

const url = 'https://zsqffmvwqysjvwugizhk.supabase.co'
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!serviceKey || !anonKey) {
    // Try reading from .env.local
    const fs = await import('fs')
    const path = await import('path')
    const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf-8')
    const envVars = {}
    envContent.split('\n').forEach(line => {
        const [key, ...vals] = line.split('=')
        if (key && !key.startsWith('#')) envVars[key.trim()] = vals.join('=').trim()
    })
    var SK = envVars['SUPABASE_SERVICE_ROLE_KEY']
    var AK = envVars['NEXT_PUBLIC_SUPABASE_ANON_KEY']
} else {
    var SK = serviceKey
    var AK = anonKey
}

const admin = createClient(url, SK, {
    auth: { autoRefreshToken: false, persistSession: false }
})

const testClient = createClient(url, AK, {
    auth: { autoRefreshToken: false, persistSession: false }
})

// Step 1: Test current phone login
console.log('🧪 Testing phone login for +22237002001 with PIN 001234...')
const { data: t1, error: e1 } = await testClient.auth.signInWithPassword({
    phone: '+22237002001',
    password: '001234',
})
console.log(e1 ? `❌ Failed: ${e1.message}` : `✅ Works! user: ${t1.user?.id}`)

if (e1) {
    // Step 2: Update user via admin to have phone confirmed + re-set password
    console.log('\n🔧 Updating admin user via admin API...')

    const { data: userData, error: userError } = await admin.auth.admin.updateUserById(
        'aaaaaaaa-0001-0000-0000-000000000001',
        {
            phone: '+22237002001',
            phone_confirm: true,
            password: '001234',
        }
    )

    if (userError) {
        console.error('❌ Admin update failed:', userError.message)
    } else {
        console.log('✅ Updated user. Identities:', userData.user.identities?.map(i => `${i.provider}:${i.identity_id}`))

        // Step 3: Re-test login
        console.log('\n🧪 Re-testing phone login...')
        const { data: t2, error: e2 } = await testClient.auth.signInWithPassword({
            phone: '+22237002001',
            password: '001234',
        })
        console.log(e2 ? `❌ Still failed: ${e2.message}` : `✅ Phone login works! user: ${t2.user?.id}`)

        if (!e2) {
            console.log('\n🔄 Phone login works! Now migrating ALL users...')

            // Get all users
            const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 100 })
            const qalamUsers = users.filter(u => u.email?.endsWith('@qalami.app'))
            console.log(`Found ${qalamUsers.length} users to migrate\n`)

            let ok = 0, fail = 0
            for (const user of qalamUsers) {
                if (user.id === 'aaaaaaaa-0001-0000-0000-000000000001') { ok++; continue } // Already done
                const phone = user.phone || ('+' + user.email.replace('@qalami.app', ''))

                const { error: ue } = await admin.auth.admin.updateUserById(user.id, {
                    phone: phone,
                    phone_confirm: true,
                })
                if (ue) { console.log(`  ❌ ${phone}: ${ue.message}`); fail++; }
                else { console.log(`  ✅ ${phone}`); ok++; }
            }
            console.log(`\n✅ Done: ${ok} OK, ${fail} failed`)
        }
    }
}
