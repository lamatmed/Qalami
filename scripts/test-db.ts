import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load env from root
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}

async function listRpcs() {
    console.log('Fetching OpenAPI spec from Supabase...')
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`
        }
    })
    
    if (!res.ok) {
        console.error('Failed to fetch OpenAPI spec:', res.status, res.statusText)
        return
    }

    const spec = await res.json() as any
    const paths = Object.keys(spec.paths || {})
    const rpcs = paths.filter(p => p.startsWith('/rpc/'))
    
    console.log('\nAvailable RPC Functions:')
    console.log(rpcs)
}

listRpcs().catch(console.error)
