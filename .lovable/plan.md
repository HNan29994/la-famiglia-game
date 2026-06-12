# Game rules alignment — major build

## 1. Database

New migration:
- `player_state` enum: `active` | `ghost` | `banished`. Add `state` column to `players`, backfill from `banished`.
- Add `armory` to `game_phase` enum.
- Add `morning_revealed boolean` to `games` (so admin's "reveal victim" tap is idempotent and visible to all phones).
- New tables (all open-policy like existing tables):
  - `murder_votes` (game, night, traitor_id, victim_id) — one row per traitor per night.
  - `armory_rounds` (game, night, player_a_id, player_b_id, is_winner) — admin enters pairings + flips winner.
  - `sotto_sospetto` (game, day_number, caller_id, accused_id, behaviour, result, resolved_at) — unique per (game, day_number).
  - `sotto_sospetto_votes` (sospetto_id, voter_id, vote: 'guilty'|'not_guilty') — one per voter.

## 2. `src/lib/game.ts`

- `NEXT_PHASE`: `night_active → armory → tribunale_missions`.
- `beginNight`: assign missions/roles to ALL players (active, ghost, banished). Stop generating `bonus_mission`/`bonus_target_id`.
- New `resolveMurderVote(gameId, night)`: read traitor murder_votes; if unanimous → that player. Otherwise no kill. Insert `murders` row + flip victim to `state='ghost'`. Idempotent.
- New `recordArmoryWinners(gameId, night, roundIds[])`: flip `is_winner`, +3 pts to each winner (+2 if winner's state is ghost or banished). If winner is banished and admin confirms re-entry → state='active', role='faithful'.
- `tryAdvancePhase`: count eligible voters as `state IN ('active','ghost')` for the night→armory and armory→missions transitions; voting phase counts only `active`.
- Remove `recordMurder`/`abandonMurder` exports.

## 3. Admin (`src/routes/admin.tsx`)

- During `night_active`: "Reveal the Victim" button → runs `resolveMurderVote` and sets `games.morning_revealed=true`.
- New Armory card (during `night_active`/`armory`): add pairing rows, pick the winning team, re-entry confirm dialog if a banished player wins.

## 4. Player (`src/routes/player.$playerId.tsx`)

- Remove `MurderMissionCard`.
- New `MurderVoteCard` for traitors during `night_active`: list active, non-immune players, one pick, shows fellow traitors' picks live. Locked after submit.
- New "Morning Reveal" full-screen banner when `games.morning_revealed=true`: dramatic announcement of victim.
- `state==='ghost'` view: still see missions, still pour drinks, but vote/giuro buttons disabled with "Sei un Fantasma" label.
- `SottoSospettoCard`: trigger button (disabled if today already used), pick player + textarea; live vote overlay for everyone when active; result banner.

## 5. Tribunale (`src/routes/tribunale.tsx`)

- New `armory` phase view: list pairings & winners.
- Morning Reveal panel (deceased name) shown during `night_active` after admin reveal.
- Sotto Sospetto results in the discussion phase.

## 6. Missions fix

Replace `Il Fideli` → `Fedeli` in `TRAITOR_MISSIONS`.

---

## Approval flow

The migration requires user approval before code can use the new tables/enums. I'll submit it first; once it runs and types regenerate, I'll ship the code changes in a follow-up turn.