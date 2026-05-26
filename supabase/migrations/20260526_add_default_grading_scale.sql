-- Add default grading scale column to school_settings
ALTER TABLE school_settings
ADD COLUMN IF NOT EXISTS default_grading_scale integer DEFAULT 20;
