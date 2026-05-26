## Goal
Banishment becomes a true blind vote: roles stay hidden until a dramatic Night 3 "Great Reveal", and banished players are bound by **Il Silenzio**.

## 1. Hide role on banishment
- Remove the current "RoleReveal" / role animation that fires when a player is voted out at Il Tribunale.
- After voting closes, voted-out players see a single full-screen card: **"Sei stato bandito"** ("You have been banished") — no role, no emoji hint, no team.
- Persist a `banished` flag + `banished_night` on `players` so they're marked permanently.
- On every screen (player view, lobby, leaderboard, tribunale), banished players render with a 🔒 marker and "Bandito" label — never their role.
- Tribunale's per-night "Reveal" phase shows only *who* was banished, not their roles. Score tally still runs (points deferred — see §4).

## 2. Il Silenzio rule
- New rule card surfaced on the banished player's screen and in the rules section:
  > **Il Silenzio** — A banished soul may lie, deflect, or stay silent, but must never confirm their true role. Breaking Il Silenzio breaks the family.
- Mechanical enforcement where possible:
  - **Giuro sulla Famiglia**: if a banished player tries to swear a Giuro *targeting themselves* (or asking a question of the form "are you a Traditore/Capo/Fideli" about themselves), block the action. Simpler enforceable rule: **banished players cannot initiate or be targeted by a Giuro that asks about their own role**. Cleanest implementation — disable the Giuro button entirely for banished players (both ask and answer), with tooltip "Il Silenzio — your voice is bound."
- This is largely a social rule; the app enforces the Giuro lock and shows the rule prominently.

## 3. The Great Reveal (Night 3, pre-final-vote)
- New phase inserted before Night 3's final Round Table vote: `great_reveal`.
- Triggered when a majority of players tap Ready on the new "Begin The Great Reveal" button (matches existing majority-vote pattern — no admin role).
- Shared `/tribunale` screen plays a sequenced animation: for each banished player (in banishment order), reveal **Name → Role** with dramatic fade/scale animation, one at a time, ~3s each, with a "Next" majority-advance between each if desired (default: auto-sequence, single Ready to start).
- Player phones mirror the reveal in sync via realtime.

## 4. Delayed banishment points
- Banishment votes from Nights 1 & 2 currently award points immediately. Change to **deferred**:
  - Store each vote's correctness against the now-revealed role, but don't add to `total_points` until the Great Reveal.
  - During the Great Reveal, after each role is shown, apply deltas live: **+2** per voter who voted to banish that player *if* they were a Traditore; **−1** per voter who voted to banish them *if* they were a Faithful (Il Fideli). Capo banishments: no delayed delta (or treat as Faithful — see open question).
  - Leaderboard on `/tribunale` and player phones updates after each reveal step.
- Existing immediate vote-scoring in `scoreNight` for nights 1–2 is removed for banishment votes; mission/arrest/alliance/murder scoring is unchanged.

## 5. Flow change
```text
Notte 3:
  night_active → tribunale_missions → tribunale_arrests
  → tribunale_discussion → tribunale_voting (1st round, optional — see Q)
  → great_reveal  ← NEW
  → final round table vote
  → tribunale_reveal → leaderboard → drinks → finished
```

## Technical notes
- **Schema migration**: add `players.banished bool`, `players.banished_night int`, `games.phase` enum value `great_reveal`, `votes.was_correct bool` (nullable, filled at Great Reveal), `votes.points_applied bool`.
- **`src/lib/game.ts`**: drop banishment-vote points from `scoreNight`; add `runGreatReveal(gameId)` that walks banished players in order, updates `votes.was_correct`, increments `players.total_points` in steps with small delays for the live leaderboard effect.
- **`src/routes/player.$playerId.tsx`**: replace `RoleReveal` for voted-out players with `BanishedCard`; hide role for any banished player everywhere; disable Giuro button for banished players; show Il Silenzio card.
- **`src/routes/tribunale.tsx`**: add `GreatReveal` phase component with sequenced animation; update `RoleReveal` phase to skip banished players' roles outside the Great Reveal; new ready label "Begin The Great Reveal".
- **`src/components/ReadyButton.tsx`** + `NEXT_PHASE` map: insert `great_reveal` between voting and final reveal on Night 3 only.

## Open questions
1. **Capo banishments** — currently Capo is on the Faithful side; should banishing a Capo cost the voter −1 (treat as Faithful), or 0 (neutral)?
2. **Night 3 has two votes?** Plan above assumes Night 3 keeps its normal accusation/vote *and* a final round-table vote after the Great Reveal. Or should Night 3 skip the first vote and go straight discussion → Great Reveal → final vote?
3. **Great Reveal pacing** — single Ready to play the whole sequence, or one Ready between each banished player?
