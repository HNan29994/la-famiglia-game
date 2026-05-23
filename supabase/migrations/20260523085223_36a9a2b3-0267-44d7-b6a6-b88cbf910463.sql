ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS night3_game_name text NOT NULL DEFAULT 'TBC — To be decided by the group.';

ALTER TABLE public.role_assignments
  ADD COLUMN IF NOT EXISTS traitor_list_seen boolean NOT NULL DEFAULT false;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS giuro_used boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.giuros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL,
  night integer NOT NULL,
  asker_id uuid NOT NULL,
  target_id uuid NOT NULL,
  question text NOT NULL,
  answer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz
);

ALTER TABLE public.giuros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public all giuros" ON public.giuros;
CREATE POLICY "public all giuros" ON public.giuros FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.giuros;