-- Journal des heures supplémentaires, primes et déductions par employé
-- Permet la saisie au fil du mois, inclus automatiquement lors de la paie

CREATE TABLE IF NOT EXISTS staff_adjustments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID NOT NULL,
    profile_id      UUID NOT NULL,
    type            TEXT NOT NULL DEFAULT 'autre',
    description     TEXT,
    hours           NUMERIC(6,2),
    hourly_rate     NUMERIC(10,2),
    amount          NUMERIC(10,2) NOT NULL DEFAULT 0,
    date            DATE NOT NULL DEFAULT CURRENT_DATE,
    is_included     BOOLEAN NOT NULL DEFAULT FALSE,
    payroll_id      UUID,
    created_by      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_adj_profile   ON staff_adjustments(profile_id);
CREATE INDEX IF NOT EXISTS idx_staff_adj_school    ON staff_adjustments(school_id);
CREATE INDEX IF NOT EXISTS idx_staff_adj_included  ON staff_adjustments(is_included);

ALTER TABLE staff_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school_access" ON staff_adjustments;
CREATE POLICY "school_access" ON staff_adjustments
    USING  (school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK (school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid()));
