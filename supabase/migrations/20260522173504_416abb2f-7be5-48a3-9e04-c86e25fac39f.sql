ALTER TABLE role_assignments
  ADD COLUMN bonus_mission text,
  ADD COLUMN bonus_mission_state mission_state DEFAULT 'pending',
  ADD COLUMN bonus_target_id uuid;

CREATE TABLE murders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL,
  night int NOT NULL,
  traitor_id uuid NOT NULL,
  victim_id uuid NOT NULL,
  fingers int NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE murders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all murders" ON murders FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE murders;

CREATE TABLE phase_ready (
  game_id uuid NOT NULL,
  player_id uuid NOT NULL,
  night int NOT NULL,
  phase game_phase NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (game_id, player_id, night, phase)
);
ALTER TABLE phase_ready ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all phase_ready" ON phase_ready FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE phase_ready;

CREATE TABLE phase_transitions (
  game_id uuid NOT NULL,
  night int NOT NULL,
  from_phase game_phase NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (game_id, night, from_phase)
);
ALTER TABLE phase_transitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all phase_transitions" ON phase_transitions FOR ALL USING (true) WITH CHECK (true);