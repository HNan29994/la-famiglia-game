ALTER TABLE public.players ADD COLUMN IF NOT EXISTS banished boolean NOT NULL DEFAULT false;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS banished_night integer;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS banished_revealed boolean NOT NULL DEFAULT false;
ALTER TABLE public.votes ADD COLUMN IF NOT EXISTS was_correct boolean;
ALTER TABLE public.votes ADD COLUMN IF NOT EXISTS points_applied boolean NOT NULL DEFAULT false;
ALTER TYPE public.game_phase ADD VALUE IF NOT EXISTS 'great_reveal';