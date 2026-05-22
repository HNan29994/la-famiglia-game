## Goal

Drop the dedicated "admin" role so every participant uses the same player UI, and bake murders into traitor missions as a high-value bonus that costs the victim a drink.

## 1. Setup — keep, but make it player-driven

- Keep `/admin` as a minimal lobby route, but rename and re-skin as `/setup`:
  - First person to open the app lands on `/setup` if no game exists locally; enters the 18 names and creates the game.
  - After creation, they're redirected to `/player/:id` like everyone else (pick their own name from the roster on first open).
- Remove all admin-only controls (Begin Notte, Convene Il Tribunale, Reveal & Score, Advance) from this screen.
- Drop the "Padrino's chamber" framing; this is just the lobby.

## 2. Phase advancement — majority vote on phones

Add a "ready to advance" mechanic shared across all player phones.

- New table `phase_ready` (game_id, player_id, phase, night). One row per player per phase.
- On every player screen (`/player/:id` and `/tribunale`), show a single primary action at the bottom appropriate to the current phase, e.g.:
  - `night_active` → "Ready for Il Tribunale"
  - `tribunale_missions` → "Ready to vote"
  - `tribunale_voting` → "I've voted"
  - `tribunale_leaderboard` → "Ready for next night" (or "End trip" on night 3)
- Tapping it inserts/deletes a `phase_ready` row for the current (game, player, phase, night). Button toggles between "Ready (N/M)" and "Cancel ready".
- A lightweight client-side watcher (already using realtime) checks: when `phase_ready` count > 50% of living players for the current phase, the *first* client to detect it calls a small transition function that:
  1. Re-checks majority server-side (in a `createServerFn`) to avoid races.
  2. Calls the existing `beginNight` / `scoreNight` / phase update logic.
  3. Clears `phase_ready` rows for that phase.
- The new night `setup → night_active` transition runs `beginNight` automatically once majority is reached on the leaderboard screen.

Tradeoff: the first-to-detect pattern means whichever phone wins the race triggers the transition; the server-side re-check + an `ON CONFLICT DO NOTHING` guard on a `phase_transitions` log table prevents double-execution.

## 3. Murders — bonus mission for traitors

- Add a third optional mission slot on traitor role assignments: `bonus_mission` (text) + `bonus_mission_state` (pending/completed/failed) + `bonus_target_id` (uuid, nullable).
- During night assignment, every traitor also gets a generated bonus: "Murder {Player Name}" where the target is a random non-traitor still in the game.
- On the traitor's player screen, the bonus appears in red below their two normal missions with two buttons:
  - "Confirm kill" → marks `completed`, inserts a `murders` row (game_id, night, traitor_id, victim_id).
  - "Abandon" → marks `failed`.
- Scoring (`scoreNight`):
  - Successful murder: +4 pts to the traitor (vs +2 for a normal mission completion), but only counted if the traitor isn't voted out.
  - Failed/skipped murder: 0 pts, no penalty.
- Victim consequence (drink penalty only): victim stays in the game, keeps voting and missions. At the tribunale reveal we add a "The Deceased" section listing each victim with their assigned drink (e.g. "{Victim} — 3 fingers, poured by the family"). No death state in the DB beyond the murders row.

## 4. UI cleanup

- `/admin` route file → renamed to `/setup`. Old admin link in `index.tsx` removed; replaced with "Open lobby" (only shown if no game exists locally) and "Open my player view".
- `/tribunale` becomes a shared read-only view with the same "ready" button — no host-only buttons.
- Add a small "Deceased tonight" panel at the top of the leaderboard phase pulling from `murders` for the current night.

## Technical details

### Schema changes (one migration)

```sql
-- Bonus mission slot on role_assignments
ALTER TABLE role_assignments
  ADD COLUMN bonus_mission text,
  ADD COLUMN bonus_mission_state mission_state DEFAULT 'pending',
  ADD COLUMN bonus_target_id uuid;

-- Murders log
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

-- Ready-state per phase
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

-- Transition lock to prevent double-execution
CREATE TABLE phase_transitions (
  game_id uuid NOT NULL,
  night int NOT NULL,
  from_phase game_phase NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (game_id, night, from_phase)
);
ALTER TABLE phase_transitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all phase_transitions" ON phase_transitions FOR ALL USING (true) WITH CHECK (true);
```

### Files

- `supabase/migrations/<new>.sql` — schema above.
- `src/lib/game.ts` — extend `beginNight` to write bonus mission for traitors; extend `scoreNight` for bonus kill points + drink fingers; add `tryAdvancePhase(gameId, fromPhase)` helper that does the majority-check + transition lock + appropriate next action.
- `src/lib/missions.ts` — small helper `formatMurderMission(name)`.
- `src/routes/setup.tsx` (renamed from `admin.tsx`) — lobby only; no phase controls.
- Delete `src/routes/admin.tsx` (replaced).
- `src/routes/player.$playerId.tsx` — add bonus mission card for traitors, add bottom "Ready" button calling `tryAdvancePhase`, show ready count.
- `src/routes/tribunale.tsx` — strip host controls, add the same "Ready" pattern, add "Deceased tonight" panel sourced from `murders`.
- `src/routes/index.tsx` — update entry links: "Open lobby" / "Join as player".

No auth changes. All tables stay open-policy (matches existing pattern). No edge functions.
