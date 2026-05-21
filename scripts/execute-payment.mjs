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
    const paymentNote = 'deux mois';

    console.log(`Executing actual payment of ${amount} MRU for student ${studentId}...`);

    // Get school_id
    const { data: studentProfile } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('id', studentId)
        .single();
    
    const schoolId = studentProfile?.school_id;

    // Resolve current academic year
    const { data: currentYear } = await supabase
        .from('academic_years')
        .select('id, name')
        .eq('school_id', schoolId)
        .eq('is_current', true)
        .single();

    // Fetch pending payments
    const { data: pendingPayments, error: fetchPendingError } = await supabase
        .from('payments')
        .select('*')
        .eq('student_id', studentId)
        .eq('payment_type', paymentType)
        .in('payment_status', ['pending', 'overdue'])
        .order('due_date', { ascending: true });

    if (fetchPendingError) {
        console.error(fetchPendingError);
        return;
    }

    let remainingAmount = amount;

    if (pendingPayments && pendingPayments.length > 0) {
        for (const pending of pendingPayments) {
            if (remainingAmount <= 0) break;

            if (remainingAmount >= Number(pending.amount)) {
                // Mark this pending payment as fully paid
                console.log(`Updating ${pending.id} (${pending.due_date}) to paid (amount: ${pending.amount})`);
                const { error } = await supabase
                    .from('payments')
                    .update({
                        payment_status: 'paid',
                        paid_at: new Date().toISOString(),
                        amount: Number(pending.amount),
                        description: paymentNote || pending.description || `Paiement ${paymentType}`
                    })
                    .eq('id', pending.id);

                if (error) throw error;
                remainingAmount -= Number(pending.amount);
            } else {
                // Partial payment
                console.log(`Updating ${pending.id} (${pending.due_date}) to partial paid (amount: ${remainingAmount})`);
                const diff = Number(pending.amount) - remainingAmount;

                const { error: updateError } = await supabase
                    .from('payments')
                    .update({
                        payment_status: 'paid',
                        paid_at: new Date().toISOString(),
                        amount: remainingAmount,
                        description: paymentNote || pending.description || `Paiement ${paymentType}`
                    })
                    .eq('id', pending.id);

                if (updateError) throw updateError;

                console.log(`Inserting remaining pending row (amount: ${diff})`);
                const { error: insertError } = await supabase
                    .from('payments')
                    .insert({
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

                if (insertError) throw insertError;

                remainingAmount = 0;
            }
        }
    }

    if (remainingAmount > 0) {
        console.log(`Inserting surplus payment row (amount: ${remainingAmount})`);
        const { error } = await supabase
            .from('payments')
            .insert({
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

        if (error) throw error;
    }

    console.log('Payment registration finished! Listing payments:');
    const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('student_id', studentId)
        .order('due_date', { ascending: true });

    for (const p of payments) {
        console.log(`ID: ${p.id} | Amt: ${p.amount} | Status: ${p.payment_status} | Due: ${p.due_date} | PaidAt: ${p.paid_at} | Desc: ${p.description}`);
    }
}

run().catch(console.error);
