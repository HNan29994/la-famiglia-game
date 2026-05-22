## Fix role assignment for any player count

**The bug**: `ROLE_COUNTS` in `src/lib/game.ts` is hard-coded for 18 and mutated globally; small games end up with more role slots than players, so everyone gets dealt "traitor."

### Changes

**1. `src/lib/game.ts` — rewrite `assignRoles`**

- Compute role counts locally (no mutation of the module constant).
- Scale by player count so capi + traitors + civilians always equals N:
  - 4–5 players: 1 capo, 1 traitor, rest civilians
  - 6–8: 1 capo, 2 traitors, rest civilians
  - 9–11: 1 capo, 3 traitors, rest civilians
  - 12–14: 2 capi, 3 traitors, rest civilians
  - 15–17: 2 capi, 4 traitors, rest civilians
  - 18+: 2 capi, 4 traitors, rest civilians (original spec)
- Keep the "no same role two nights in a row" retry loop.
- Keep capo suspect-tip generation working when there are <3 civilians (use whatever civilians exist as decoys).

**2. `src/routes/admin.tsx` — small-game notice**

Show a subtle line under the night card when `players.length < 18`:
"Test mode · {N} players · roles scaled" so it's obvious balance is non-canonical.

No DB or schema changes. Existing games keep working.
