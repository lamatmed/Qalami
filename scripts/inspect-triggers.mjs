import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`
        }
    });
    
    if (!res.ok) {
        console.error('Failed to fetch OpenAPI spec:', res.status, res.statusText);
        return;
    }

    const spec = await res.json();
    const paths = Object.keys(spec.paths || {});
    const rpcs = paths.filter(p => p.startsWith('/rpc/'));
    console.log('Available RPCs:', rpcs);
}

run().catch(console.error);
