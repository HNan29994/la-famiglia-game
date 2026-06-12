
-- 1. Player state enum + column
CREATE TYPE public.player_state AS ENUM ('active', 'ghost', 'banished');
ALTER TABLE public.players ADD COLUMN state public.player_state NOT NULL DEFAULT 'active';
UPDATE public.players SET state = 'banished' WHERE banished = true;

-- 2. Add 'armory' to game_phase
ALTER TYPE public.game_phase ADD VALUE IF NOT EXISTS 'armory' AFTER 'night_active';

-- 3. Morning reveal flag on games
ALTER TABLE public.games ADD COLUMN morning_revealed boolean NOT NULL DEFAULT false;
ALTER TABLE public.games ADD COLUMN morning_revealed_night integer;

-- 4. Murder votes (traitors only, one row per traitor per night)
CREATE TABLE public.murder_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  night integer NOT NULL,
  traitor_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  victim_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, night, traitor_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.murder_votes TO anon, authenticated;
GRANT ALL ON public.murder_votes TO service_role;
ALTER TABLE public.murder_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all murder_votes" ON public.murder_votes USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.murder_votes;

-- 5. Armory rounds
CREATE TABLE public.armory_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  night integer NOT NULL,
  player_a_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  player_b_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  is_winner boolean NOT NULL DEFAULT false,
  scored boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.armory_rounds TO anon, authenticated;
GRANT ALL ON public.armory_rounds TO service_role;
ALTER TABLE public.armory_rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all armory_rounds" ON public.armory_rounds USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.armory_rounds;

-- 6. Sotto Sospetto (one per game per night)
CREATE TABLE public.sotto_sospetto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  night integer NOT NULL,
  caller_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  accused_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  behaviour text NOT NULL,
  result text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, night)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sotto_sospetto TO anon, authenticated;
GRANT ALL ON public.sotto_sospetto TO service_role;
ALTER TABLE public.sotto_sospetto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all sotto_sospetto" ON public.sotto_sospetto USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.sotto_sospetto;

CREATE TABLE public.sotto_sospetto_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sospetto_id uuid NOT NULL REFERENCES public.sotto_sospetto(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  vote text NOT NULL CHECK (vote IN ('guilty','not_guilty')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sospetto_id, voter_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sotto_sospetto_votes TO anon, authenticated;
GRANT ALL ON public.sotto_sospetto_votes TO service_role;
ALTER TABLE public.sotto_sospetto_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all sotto_sospetto_votes" ON public.sotto_sospetto_votes USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.sotto_sospetto_votes;
