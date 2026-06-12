import { supabase } from "@/integrations/supabase/client";
import { pickTwoMissions } from "./missions";

export type Role = "traitor" | "faithful";

export const MURDER_FINGERS = 3;
export const ARMORY_WIN_POINTS = 3;
export const ARMORY_WIN_POINTS_REDUCED = 2; // ghost or banished re-entry

export type PlayerState = "active" | "ghost" | "banished";

/** Scale role counts to the actual player count. */
export function roleCountsFor(n: number): Record<Role, number> {
  let traitor = 4;
  if (n < 6) traitor = 1;
  else if (n < 9) traitor = 2;
  else if (n < 14) traitor = 3;
  traitor = Math.min(traitor, Math.max(0, n - 1));
  const faithful = Math.max(0, n - traitor);
  return { traitor, faithful };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Assign roles randomly. Roles are fixed for the whole trip (assigned once on
 * Night 1) so no "no-repeat" constraint is needed.
 */
export function assignRoles(playerIds: string[]): Record<string, Role> {
  const counts = roleCountsFor(playerIds.length);
  const roleSlots: Role[] = [
    ...Array(counts.traitor).fill("traitor"),
    ...Array(counts.faithful).fill("faithful"),
  ];
  const shuffled = shuffle(roleSlots);
  const assignment: Record<string, Role> = {};
  playerIds.forEach((pid, i) => (assignment[pid] = shuffled[i]));
  return assignment;
}

export async function beginNight(gameId: string, night: number) {
  // Fetch ALL players — ghosts and banished still receive missions.
  const { data: players, error: pErr } = await supabase
    .from("players")
    .select("id, name, state")
    .eq("game_id", gameId);
  if (pErr) throw pErr;
  if (!players || players.length === 0) throw new Error("No players in game");

  const allPlayers = players as any[];
  const ids = allPlayers.map((p) => p.id);

  // Roles are assigned ONCE on Night 1 and reused for Nights 2/3.
  let roleByPlayer: Record<string, Role> = {};
  if (night === 1) {
    roleByPlayer = assignRoles(ids);
  } else {
    const { data: prev } = await supabase
      .from("role_assignments")
      .select("player_id, role")
      .eq("game_id", gameId)
      .eq("night", 1);
    (prev || []).forEach((r: any) => (roleByPlayer[r.player_id] = r.role as Role));
    // Safety: any player missing from night 1 (re-entry from Armory) gets faithful.
    const missing = ids.filter((id) => !roleByPlayer[id]);
    missing.forEach((id) => (roleByPlayer[id] = "faithful"));
  }

  // Delete any existing assignments for this night (in case of re-roll)
  await supabase.from("role_assignments").delete().eq("game_id", gameId).eq("night", night);

  const rows = ids.map((pid) => {
    const role = roleByPlayer[pid];
    const [m1, m2] = pickTwoMissions(role);
    return {
      game_id: gameId,
      player_id: pid,
      night,
      role,
      mission_1: m1,
      mission_2: m2,
      bonus_mission: null,
      bonus_target_id: null,
      bonus_mission_state: "pending" as const,
    };
  });
  const { error: insErr } = await supabase.from("role_assignments").insert(rows);
  if (insErr) throw insErr;

  // Update game state — reset morning_revealed for the new night
  await supabase
    .from("games")
    .update({ current_night: night, phase: "night_active", morning_revealed: false, morning_revealed_night: null } as any)
    .eq("id", gameId);
}

/**
 * Score the night: compute points based on missions completed, arrests, votes, alliances.
 * Multiplier of 2 applied on night 3.
 */
export async function scoreNight(gameId: string, night: number) {
  const multiplier = night === 3 ? 2 : 1;

  const { data: assignments } = await supabase
    .from("role_assignments")
    .select("*")
    .eq("game_id", gameId)
    .eq("night", night);
  if (!assignments) return;

  const { data: votes } = await supabase
    .from("votes")
    .select("*")
    .eq("game_id", gameId)
    .eq("night", night);

  const roleByPlayer: Record<string, Role> = {};
  assignments.forEach((a: any) => (roleByPlayer[a.player_id] = a.role));

  // Vote tallies — top 4 most-voted considered "voted out"
  const voteCount: Record<string, number> = {};
  votes?.forEach((v: any) => {
    voteCount[v.target_id] = (voteCount[v.target_id] || 0) + 1;
  });
  // Only the single top-voted player is banished per night. Ties are
  // broken randomly between joint-top players.
  const sortedTargets = Object.entries(voteCount).sort((a, b) => b[1] - a[1]);
  const votedOut = new Set<string>();
  if (sortedTargets.length > 0) {
    const topCount = sortedTargets[0][1];
    const topIds = sortedTargets.filter(([, c]) => c === topCount).map(([id]) => id);
    const pick = topIds[Math.floor(Math.random() * topIds.length)];
    votedOut.add(pick);
  }

  // Per-player points
  const pointsByPlayer: Record<string, number> = {};
  const missionsCompletedByPlayer: Record<string, number> = {};

  for (const a of assignments) {
    let pts = 0;
    let completed = 0;
    if (a.mission_1_state === "completed") { pts += 2; completed++; }
    if (a.mission_2_state === "completed") { pts += 2; completed++; }
    missionsCompletedByPlayer[a.player_id] = completed;

    // Traitor survives undetected
    if (a.role === "traitor" && !votedOut.has(a.player_id)) pts += 3;
    pointsByPlayer[a.player_id] = pts;
  }

  // Top mission scorer bonus
  const maxMissions = Math.max(0, ...Object.values(missionsCompletedByPlayer));
  if (maxMissions > 0) {
    Object.entries(missionsCompletedByPlayer)
      .filter(([, c]) => c === maxMissions)
      .forEach(([pid]) => (pointsByPlayer[pid] = (pointsByPlayer[pid] || 0) + 1));
  }

  // Apply multiplier and persist
  for (const a of assignments) {
    const pts = (pointsByPlayer[a.player_id] || 0) * multiplier;
    await supabase.from("role_assignments").update({ night_points: pts }).eq("id", a.id);
  }

  // Update total_points on players
  const { data: allAssignments } = await supabase
    .from("role_assignments")
    .select("player_id, night_points")
    .eq("game_id", gameId);
  const totals: Record<string, number> = {};
  allAssignments?.forEach((a: any) => {
    totals[a.player_id] = (totals[a.player_id] || 0) + (a.night_points || 0);
  });
  for (const [pid, total] of Object.entries(totals)) {
    await supabase.from("players").update({ total_points: total }).eq("id", pid);
  }

  // Mark voted-out players as banished (role stays hidden — revealed at Great Reveal)
  for (const id of votedOut) {
    await supabase
      .from("players")
      .update({ banished: true, banished_night: night } as any)
      .eq("id", id)
      .eq("banished", false);
  }
}

/**
 * Resolve the Traitor Murder Vote. Idempotent — guarded by games.morning_revealed.
 * Unanimous traitor votes → that player becomes a ghost and is announced.
 * Otherwise no kill is recorded.
 */
export async function resolveMurderVote(gameId: string, night: number) {
  const { data: g } = await supabase
    .from("games")
    .select("morning_revealed, morning_revealed_night")
    .eq("id", gameId)
    .single();
  if (!g) return { victim_id: null as string | null, already: false };
  if ((g as any).morning_revealed && (g as any).morning_revealed_night === night) {
    return { victim_id: null, already: true };
  }

  // Active traitors this night
  const { data: traitors } = await supabase
    .from("role_assignments")
    .select("player_id")
    .eq("game_id", gameId)
    .eq("night", night)
    .eq("role", "traitor");
  const traitorIds = (traitors || []).map((t: any) => t.player_id);

  // Exclude traitors who are ghosts/banished from "active voters" — they can't murder.
  const { data: alive } = await supabase
    .from("players")
    .select("id, state")
    .in("id", traitorIds.length ? traitorIds : ["00000000-0000-0000-0000-000000000000"]);
  const activeTraitorIds = (alive || []).filter((p: any) => p.state === "active").map((p: any) => p.id);

  let victim: string | null = null;
  if (activeTraitorIds.length > 0) {
    const { data: votes } = await supabase
      .from("murder_votes")
      .select("traitor_id, victim_id")
      .eq("game_id", gameId)
      .eq("night", night)
      .in("traitor_id", activeTraitorIds);
    if (votes && votes.length === activeTraitorIds.length) {
      const unique = new Set(votes.map((v: any) => v.victim_id));
      if (unique.size === 1) victim = [...unique][0];
    }
  }

  // Mark reveal as done (atomic)
  const { data: claimed } = await supabase
    .from("games")
    .update({ morning_revealed: true, morning_revealed_night: night } as any)
    .eq("id", gameId)
    .eq("morning_revealed", false)
    .select("id");
  if (!claimed || claimed.length === 0) return { victim_id: null, already: true };

  if (victim) {
    // Pick any active traitor as the recorded "killer" (display only).
    const killer = activeTraitorIds[0] || traitorIds[0];
    await supabase.from("murders").insert({
      game_id: gameId,
      night,
      traitor_id: killer,
      victim_id: victim,
      fingers: MURDER_FINGERS,
    });
    await supabase
      .from("players")
      .update({ state: "ghost" } as any)
      .eq("id", victim)
      .eq("state", "active");
  }
  return { victim_id: victim, already: false };
}

/**
 * Mark armory pairings as winners. Awards points (+3 normal, +2 if ghost/banished).
 * If a banished player is on the winning team AND reentry=true, restore them to
 * 'active' with role 'faithful' on the current night.
 */
export async function recordArmoryWinner(
  roundId: string,
  opts: { reentry?: boolean } = {},
) {
  const { data: round } = await supabase
    .from("armory_rounds")
    .select("*")
    .eq("id", roundId)
    .single();
  if (!round || (round as any).scored) return;
  const r: any = round;
  await supabase.from("armory_rounds").update({ is_winner: true, scored: true } as any).eq("id", roundId);

  for (const pid of [r.player_a_id, r.player_b_id]) {
    const { data: p } = await supabase.from("players").select("id, state, total_points").eq("id", pid).single();
    if (!p) continue;
    const reduced = (p as any).state === "ghost" || (p as any).state === "banished";
    const pts = reduced ? ARMORY_WIN_POINTS_REDUCED : ARMORY_WIN_POINTS;
    await supabase
      .from("players")
      .update({ total_points: ((p as any).total_points || 0) + pts } as any)
      .eq("id", pid);
    if ((p as any).state === "banished" && opts.reentry) {
      await supabase
        .from("players")
        .update({ state: "active", banished: false } as any)
        .eq("id", pid);
      // Overwrite this player's role on the current night to 'faithful'
      await supabase
        .from("role_assignments")
        .update({ role: "faithful" } as any)
        .eq("game_id", r.game_id)
        .eq("night", r.night)
        .eq("player_id", pid);
    }
  }
}

/** Toggle this player's "ready" state for the current game phase + night. */
export async function toggleReady(
  gameId: string,
  playerId: string,
  night: number,
  phase: string,
  currentlyReady: boolean,
) {
  if (currentlyReady) {
    await supabase
      .from("phase_ready")
      .delete()
      .eq("game_id", gameId)
      .eq("player_id", playerId)
      .eq("night", night)
      .eq("phase", phase as any);
  } else {
    await supabase
      .from("phase_ready")
      .insert({ game_id: gameId, player_id: playerId, night, phase: phase as any });
  }
}

/**
 * Map of (current phase) -> (next phase). For phases that need side effects
 * (beginNight, scoreNight), tryAdvancePhase handles them inline.
 */
const NEXT_PHASE: Record<string, string> = {
  setup: "night_active",
  night_active: "armory",
  armory: "tribunale_missions",
  tribunale_missions: "tribunale_discussion",
  tribunale_discussion: "tribunale_voting",
  tribunale_voting: "tribunale_reveal",
  great_reveal: "tribunale_voting",
  tribunale_reveal: "tribunale_leaderboard",
  tribunale_leaderboard: "tribunale_drinks",
  tribunale_drinks: "setup", // means: advance night (or finish)
};

/**
 * If a majority of players are ready for the current phase, atomically perform
 * the next transition. Uses phase_transitions PK as a lock so multiple phones
 * racing each other only run the transition once.
 */
export async function tryAdvancePhase(gameId: string) {
  const { data: g } = await supabase.from("games").select("*").eq("id", gameId).single();
  if (!g) return;
  const night = g.current_night;
  const phase = g.phase as string;

  const { count: readyCount } = await supabase
    .from("phase_ready")
    .select("*", { count: "exact", head: true })
    .eq("game_id", gameId)
    .eq("night", night)
    .eq("phase", phase as any);
  // Only living, active players gate phase transitions. Ghosts/banished
  // still receive missions but don't block phase advancement.
  const { count: playerCount } = await supabase
    .from("players")
    .select("*", { count: "exact", head: true })
    .eq("game_id", gameId)
    .eq("state", "active");

  const needed = Math.floor((playerCount ?? 0) / 2) + 1;
  if ((readyCount ?? 0) < needed) return;

  // Acquire the lock — PK conflict means another phone already triggered.
  const { error: lockErr } = await supabase
    .from("phase_transitions")
    .insert({ game_id: gameId, night, from_phase: phase as any });
  if (lockErr) return; // already transitioned

  const next = NEXT_PHASE[phase];
  if (!next) return;

  // Side effects per transition
  if (phase === "setup") {
    // Start the current night
    await beginNight(gameId, night);
    return;
  }
  // On Night 3 only, after discussion goes to The Great Reveal before voting
  if (phase === "tribunale_discussion" && night === 3) {
    await supabase.from("games").update({ phase: "great_reveal" as any }).eq("id", gameId);
    return;
  }
  if (phase === "tribunale_voting") {
    await scoreNight(gameId, night);
    await supabase.from("games").update({ phase: "tribunale_reveal" as any }).eq("id", gameId);
    return;
  }
  if (phase === "tribunale_drinks") {
    if (night >= 3) {
      await supabase.from("games").update({ phase: "finished" as any }).eq("id", gameId);
    } else {
      // Advance to next night and immediately begin it
      await supabase
        .from("games")
        .update({ current_night: night + 1, phase: "setup" as any })
        .eq("id", gameId);
      await beginNight(gameId, night + 1);
    }
    return;
  }

  await supabase.from("games").update({ phase: next as any }).eq("id", gameId);
}

export function getStoredGameId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("famiglia_game_id");
}
export function setStoredGameId(id: string) {
  localStorage.setItem("famiglia_game_id", id);
}
export function getStoredPlayerId(gameId: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(`famiglia_player_${gameId}`);
}
export function setStoredPlayerId(gameId: string, playerId: string) {
  localStorage.setItem(`famiglia_player_${gameId}`, playerId);
}

/**
 * Reveal a single banished player's role and apply their delayed banishment
 * vote points. Idempotent — guarded by `players.banished_revealed` and
 * `votes.points_applied`.
 * Returns the role and per-voter deltas (for UI display) or null if already revealed.
 */
export async function revealBanishedPlayer(
  gameId: string,
  playerId: string,
): Promise<{ role: Role; deltas: { voter_id: string; delta: number }[] } | null> {
  const { data: p } = await supabase
    .from("players")
    .select("banished, banished_night, banished_revealed")
    .eq("id", playerId)
    .single();
  if (!p || !p.banished || p.banished_revealed) return null;

  const { data: ra } = await supabase
    .from("role_assignments")
    .select("role")
    .eq("game_id", gameId)
    .eq("player_id", playerId)
    .eq("night", p.banished_night as number)
    .maybeSingle();
  if (!ra) return null;
  const role = ra.role as Role;
  // Traitor banishment rewards voters (+2). Faithful/Capo banishment costs voters (-1).
  const delta = role === "traitor" ? 2 : -1;
  const correct = role === "traitor";

  const { data: votes } = await supabase
    .from("votes")
    .select("id, voter_id")
    .eq("game_id", gameId)
    .eq("target_id", playerId)
    .eq("points_applied", false);

  const deltas: { voter_id: string; delta: number }[] = [];
  for (const v of votes || []) {
    // Atomic claim — only one client gets the row.
    const { data: claimed } = await supabase
      .from("votes")
      .update({ was_correct: correct, points_applied: true } as any)
      .eq("id", v.id)
      .eq("points_applied", false)
      .select("id");
    if (claimed && claimed.length > 0) {
      const { data: voter } = await supabase
        .from("players")
        .select("total_points")
        .eq("id", v.voter_id)
        .single();
      const newTotal = (voter?.total_points || 0) + delta;
      await supabase.from("players").update({ total_points: newTotal }).eq("id", v.voter_id);
      deltas.push({ voter_id: v.voter_id, delta });
    }
  }

  await supabase
    .from("players")
    .update({ banished_revealed: true } as any)
    .eq("id", playerId)
    .eq("banished_revealed", false);

  return { role, deltas };
}

/** Returns ordered list of banished players awaiting reveal. */
export async function getBanishedOrder(gameId: string) {
  const { data } = await supabase
    .from("players")
    .select("id, name, banished_night, banished_revealed")
    .eq("game_id", gameId)
    .eq("banished", true)
    .order("banished_night", { ascending: true })
    .order("name", { ascending: true });
  return data || [];
}