-- Run this in your Supabase project → SQL Editor

-- ── Operations table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS operations (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title        TEXT        NOT NULL DEFAULT '',
  original_text TEXT       NOT NULL,
  tashkeel_text TEXT       NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Row-Level Security ────────────────────────────────────────────────────────
ALTER TABLE operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_operations" ON operations
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Auto-update updated_at ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_operations_updated_at
  BEFORE UPDATE ON operations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
