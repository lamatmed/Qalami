-- Migration to fix and enhance student remarks table constraints and fields

-- 1. Make class_id nullable so remarks can be sent if a student has no active enrollment
ALTER TABLE public.remarks ALTER COLUMN class_id DROP NOT NULL;

-- 2. Add category column which is used in frontend but missing in the database
ALTER TABLE public.remarks ADD COLUMN category text;

-- 3. Add is_visible_to_student column as requested by the user
ALTER TABLE public.remarks ADD COLUMN is_visible_to_student boolean DEFAULT true;
