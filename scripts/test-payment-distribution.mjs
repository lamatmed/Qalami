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
    const studentId = '19d264dd-40a3-4ac3-8950-b6c43126479a';
    const amount = 2400;
    const paymentType = 'scolarite';
    const paymentNote = 'Test double payment';

    console.log(`Running simulated payment registration for student ${studentId} with amount ${amount}...`);

    // Fetch school_id and current year info
    const { data: studentProfile } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('id', studentId)
        .single();
    
    const schoolId = studentProfile?.school_id;
    console.log('School ID:', schoolId);

    const { data: currentYear } = await supabase
        .from('academic_years')
        .select('id, name')
        .eq('school_id', schoolId)
        .eq('is_current', true)
        .single();
    
    console.log('Current academic year:', currentYear);

    // Fetch pending payments
    const { data: pendingPayments, error: fetchPendingError } = await supabase
        .from('payments')
        .select('*')
        .eq('student_id', studentId)
        .eq('payment_type', paymentType)
        .in('payment_status', ['pending', 'overdue'])
        .order('due_date', { ascending: true });

    if (fetchPendingError) {
        console.error('Error fetching pending:', fetchPendingError);
        return;
    }

    console.log(`Found ${pendingPayments.length} pending payments.`);
    
    let remainingAmount = amount;
    const updates = [];
    const inserts = [];

    if (pendingPayments && pendingPayments.length > 0) {
        for (const pending of pendingPayments) {
            if (remainingAmount <= 0) break;

            if (remainingAmount >= Number(pending.amount)) {
                console.log(`Paying off fully: ${pending.id} (${pending.due_date}) with amount ${pending.amount}`);
                updates.push({
                    id: pending.id,
                    data: {
                        payment_status: 'paid',
                        paid_at: new Date().toISOString(),
                        amount: Number(pending.amount),
                        description: paymentNote || pending.description || `Paiement ${paymentType}`
                    }
                });
                remainingAmount -= Number(pending.amount);
            } else {
                console.log(`Paying off partially: ${pending.id} (${pending.due_date}) with amount ${remainingAmount} of ${pending.amount}`);
                const diff = Number(pending.amount) - remainingAmount;
                updates.push({
                    id: pending.id,
                    data: {
                        payment_status: 'paid',
                        paid_at: new Date().toISOString(),
                        amount: remainingAmount,
                        description: paymentNote || pending.description || `Paiement ${paymentType}`
                    }
                });
                inserts.push({
                    student_id: studentId,
                    school_id: schoolId,
                    amount: diff,
                    payment_type: paymentType,
                    payment_status: pending.payment_status || 'pending',
                    due_date: pending.due_date,
                    academic_year_id: pending.academic_year_id,
                    academic_year: pending.academic_year,
                    description: pending.description || `Reste paiement ${paymentType}`
                });
                remainingAmount = 0;
            }
        }
    }

    if (remainingAmount > 0) {
        console.log(`Inserting surplus payment with amount ${remainingAmount}`);
        inserts.push({
            student_id: studentId,
            school_id: schoolId,
            amount: remainingAmount,
            payment_type: paymentType,
            payment_status: 'paid',
            paid_at: new Date().toISOString(),
            due_date: new Date().toISOString(),
            academic_year_id: currentYear?.id ?? null,
            academic_year: currentYear?.name ?? '2024-2025',
            description: paymentNote || `Surplus paiement ${paymentType}`
        });
    }

    console.log('\n--- Planned Updates ---');
    console.dir(updates, { depth: null });
    console.log('\n--- Planned Inserts ---');
    console.dir(inserts, { depth: null });
}

run().catch(console.error);
