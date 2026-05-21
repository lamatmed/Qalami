import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
    const paymentId = 'c9088079-aae1-4881-af85-35e62ff19d4f';
    const studentId = '19d264dd-40a3-4ac3-8950-b6c43126479a';

    console.log(`Reverting payment ${paymentId} back to pending 1200 MRU...`);
    
    const { data, error } = await supabase
        .from('payments')
        .update({
            payment_status: 'pending',
            paid_at: null,
            amount: 1200,
            description: 'Mensualité - octobre 2025'
        })
        .eq('id', paymentId)
        .select();

    if (error) {
        console.error('Error reverting:', error);
        return;
    }

    console.log('Reverted successfully:', data);

    // List all payments for the student now
    console.log(`\nListing payments for student ${studentId} after revert:`);
    const { data: payments, error: listError } = await supabase
        .from('payments')
        .select('*')
        .eq('student_id', studentId)
        .order('due_date', { ascending: true });

    if (listError) {
        console.error('Error listing:', listError);
        return;
    }

    for (const p of payments) {
        console.log(`ID: ${p.id} | Amt: ${p.amount} | Type: ${p.payment_type} | Status: ${p.payment_status} | Due: ${p.due_date} | PaidAt: ${p.paid_at} | Desc: ${p.description}`);
    }
}

run().catch(console.error);
