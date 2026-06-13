-- Add notes column to transactions for admin remarks
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS notes TEXT;
