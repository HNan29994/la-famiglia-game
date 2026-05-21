
-- Enums
CREATE TYPE public.player_role AS ENUM ('capo', 'traitor', 'civilian');
CREATE TYPE public.game_phase AS ENUM ('setup', 'night_active', 'tribunale_missions', 'tribunale_arrests', 'tribunale_discussion', 'tribunale_voting', 'tribunale_reveal', 'tribunale_leaderboard', 'tribunale_drinks', 'finished');
CREATE TYPE public.alliance_status AS ENUM ('pending', 'accepted', 'declined', 'broken');
CREATE TYPE public.mission_state AS ENUM ('pending', 'completed', 'failed');

-- Games (one active game at a time, but support multiple)
CREATE TABLE public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'La Famiglia',
  current_night INT NOT NULL DEFAULT 1,
  phase public.game_phase NOT NULL DEFAULT 'setup',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Players
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  pin TEXT,
  total_points INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(game_id, name)
);

-- Role assignments per night
CREATE TABLE public.role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  night INT NOT NULL,
  role public.player_role NOT NULL,
  mission_1 TEXT NOT NULL,
  mission_1_state public.mission_state NOT NULL DEFAULT 'pending',
  mission_2 TEXT NOT NULL,
  mission_2_state public.mission_state NOT NULL DEFAULT 'pending',
  night_points INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(game_id, player_id, night)
);

-- Arrests by Capos
CREATE TABLE public.arrests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  night INT NOT NULL,
  capo_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  was_correct BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(game_id, capo_id, night)
);

-- Suspect tips for Capos (3 names, 1 traitor)
CREATE TABLE public.suspect_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  night INT NOT NULL,
  capo_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  suspect_ids UUID[] NOT NULL,
  UNIQUE(game_id, capo_id, night)
);

-- Alliances
CREATE TABLE public.alliances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  night INT NOT NULL,
  requester_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  status public.alliance_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Votes (each voter can pick up to 2 targets, so multiple rows)
CREATE TABLE public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  night INT NOT NULL,
  voter_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX votes_game_night_idx ON public.votes(game_id, night);

-- Drink assignments (fingers)
CREATE TABLE public.drink_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  night INT NOT NULL,
  from_player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  to_player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  fingers INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS, open policies (no auth — friend group drinking game)
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arrests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suspect_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alliances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drink_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public all games" ON public.games FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public all players" ON public.players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public all role_assignments" ON public.role_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public all arrests" ON public.arrests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public all suspect_tips" ON public.suspect_tips FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public all alliances" ON public.alliances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public all votes" ON public.votes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public all drink_assignments" ON public.drink_assignments FOR ALL USING (true) WITH CHECK (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alliances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.arrests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.role_assignments;
