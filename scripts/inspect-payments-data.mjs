import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
    console.log('Querying payments table for recent rows...');
    const { data: payments, error } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error fetching payments:', error);
        return;
    }

    console.log(`Fetched ${payments.length} payments:`);
    console.dir(payments, { depth: null, colors: true });

    // Also get the list of unique payment statuses and counts
    const { data: counts, error: countError } = await supabase
        .from('payments')
        .select('payment_status, payment_type');
    
    if (countError) {
        console.error('Error counting:', countError);
    } else {
        const stats = {};
        for (const p of counts) {
            const key = `${p.payment_type}:${p.payment_status}`;
            stats[key] = (stats[key] || 0) + 1;
        }
        console.log('\nPayment Stats (type:status counts):', stats);
    }
}

run().catch(console.error);
