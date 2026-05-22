import { supabase } from "@/integrations/supabase/client";
import { pickTwoMissions } from "./missions";

export type Role = "capo" | "traitor" | "civilian";

export const MURDER_FINGERS = 3;

/** Scale role counts to the actual player count. */
export function roleCountsFor(n: number): Record<Role, number> {
  let capo = 2;
  let traitor = 4;
  if (n < 6) { capo = 1; traitor = 1; }
  else if (n < 9) { capo = 1; traitor = 2; }
  else if (n < 12) { capo = 1; traitor = 3; }
  else if (n < 15) { capo = 2; traitor = 3; }
  // 15+ keeps 2/4
  capo = Math.min(capo, n);
  traitor = Math.min(traitor, Math.max(0, n - capo));
  const civilian = Math.max(0, n - capo - traitor);
  return { capo, traitor, civilian };
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
 * Assign roles for `night` such that no player has the same role as last night.
 * Uses a constraint-satisfaction approach with retries.
 */
export function assignRoles(
  playerIds: string[],
  lastRoles: Record<string, Role | undefined>,
): Record<string, Role> {
  const counts = roleCountsFor(playerIds.length);
  const roleSlots: Role[] = [
    ...Array(counts.capo).fill("capo"),
    ...Array(counts.traitor).fill("traitor"),
    ...Array(counts.civilian).fill("civilian"),
  ];

  for (let attempt = 0; attempt < 200; attempt++) {
    const shuffled = shuffle(roleSlots);
    const assignment: Record<string, Role> = {};
    let ok = true;
    for (let i = 0; i < playerIds.length; i++) {
      const pid = playerIds[i];
      const role = shuffled[i];
      if (lastRoles[pid] && lastRoles[pid] === role) {
        ok = false;
        break;
      }
      assignment[pid] = role;
    }
    if (ok) return assignment;
  }
  // Fallback: ignore constraint
  const shuffled = shuffle(roleSlots);
  const assignment: Record<string, Role> = {};
  playerIds.forEach((pid, i) => (assignment[pid] = shuffled[i]));
  return assignment;
}

export async function beginNight(gameId: string, night: number) {
  // Fetch players
  const { data: players, error: pErr } = await supabase
    .from("players")
    .select("id")
    .eq("game_id", gameId);
  if (pErr) throw pErr;
  if (!players || players.length === 0) throw new Error("No players in game");

  // Fetch last night's role assignments
  const lastRoles: Record<string, Role> = {};
  if (night > 1) {
    const { data: prev } = await supabase
      .from("role_assignments")
      .select("player_id, role")
      .eq("game_id", gameId)
      .eq("night", night - 1);
    prev?.forEach((r: any) => (lastRoles[r.player_id] = r.role));
  }

  const ids = players.map((p) => p.id);
  const assignment = assignRoles(ids, lastRoles);

  // Delete any existing assignments for this night (in case of re-roll)
  await supabase.from("role_assignments").delete().eq("game_id", gameId).eq("night", night);
  await supabase.from("suspect_tips").delete().eq("game_id", gameId).eq("night", night);

  // Insert role assignments with missions
  const traitorIds = ids.filter((id) => assignment[id] === "traitor");
  const nonTraitorIds = ids.filter((id) => assignment[id] !== "traitor");
  const playerNames: Record<string, string> = {};
  (players as any[]).forEach((p: any) => (playerNames[p.id] = p.name));

  const rows = ids.map((pid) => {
    const role = assignment[pid];
    const [m1, m2] = pickTwoMissions(role);
    let bonus_mission: string | null = null;
    let bonus_target_id: string | null = null;
    if (role === "traitor" && nonTraitorIds.length > 0) {
      bonus_target_id = nonTraitorIds[Math.floor(Math.random() * nonTraitorIds.length)];
      bonus_mission = `Eliminate ${playerNames[bonus_target_id]} — get them to take a long drink without revealing yourself.`;
    }
    return {
      game_id: gameId,
      player_id: pid,
      night,
      role,
      mission_1: m1,
      mission_2: m2,
      bonus_mission,
      bonus_target_id,
      bonus_mission_state: "pending" as const,
    };
  });
  const { error: insErr } = await supabase.from("role_assignments").insert(rows);
  if (insErr) throw insErr;

  // Create suspect tips for each Capo
  const capoIds = ids.filter((id) => assignment[id] === "capo");
  const civilianIds = ids.filter((id) => assignment[id] === "civilian");

  const tipRows = capoIds.map((capoId) => {
    const realTraitor = traitorIds[Math.floor(Math.random() * traitorIds.length)];
    const decoys = shuffle(civilianIds).slice(0, 2);
    return {
      game_id: gameId,
      capo_id: capoId,
      night,
      suspect_ids: shuffle([realTraitor, ...decoys]),
    };
  });
  if (tipRows.length > 0 && traitorIds.length > 0) {
    const { error: tErr } = await supabase.from("suspect_tips").insert(tipRows);
    if (tErr) throw tErr;
  }

  // Update game state
  await supabase
    .from("games")
    .update({ current_night: night, phase: "night_active" })
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

  const { data: arrests } = await supabase
    .from("arrests")
    .select("*")
    .eq("game_id", gameId)
    .eq("night", night);

  const { data: votes } = await supabase
    .from("votes")
    .select("*")
    .eq("game_id", gameId)
    .eq("night", night);

  const { data: alliances } = await supabase
    .from("alliances")
    .select("*")
    .eq("game_id", gameId)
    .eq("night", night)
    .eq("status", "accepted");

  const roleByPlayer: Record<string, Role> = {};
  assignments.forEach((a: any) => (roleByPlayer[a.player_id] = a.role));

  // Vote tallies — top 4 most-voted considered "voted out"
  const voteCount: Record<string, number> = {};
  votes?.forEach((v: any) => {
    voteCount[v.target_id] = (voteCount[v.target_id] || 0) + 1;
  });
  const sortedTargets = Object.entries(voteCount).sort((a, b) => b[1] - a[1]);
  const votedOut = new Set(sortedTargets.slice(0, 4).map(([id]) => id));

  // Determine winning team for night: civilians/capos win if majority of traitors voted out, else traitors win
  const traitorIds = Object.entries(roleByPlayer).filter(([, r]) => r === "traitor").map(([id]) => id);
  const traitorsCaught = traitorIds.filter((id) => votedOut.has(id)).length;
  const civiliansWin = traitorsCaught >= Math.ceil(traitorIds.length / 2);
  const winningTeam: Role[] = civiliansWin ? ["capo", "civilian"] : ["traitor"];

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
    // Traitor bonus murder mission: +4 pts if completed and not voted out
    if (
      a.role === "traitor" &&
      a.bonus_mission_state === "completed" &&
      !votedOut.has(a.player_id)
    ) {
      pts += 4;
    }
    // Civilian correctly voted for a traitor
    if (a.role === "civilian") {
      const myVotes = votes?.filter((v: any) => v.voter_id === a.player_id) || [];
      const correct = myVotes.filter((v: any) => roleByPlayer[v.target_id] === "traitor").length;
      pts += correct;
    }
    pointsByPlayer[a.player_id] = pts;
  }

  // Arrest points and mark correctness
  for (const arr of arrests || []) {
    const targetRole = roleByPlayer[arr.target_id];
    const correct = targetRole === "traitor";
    pointsByPlayer[arr.capo_id] = (pointsByPlayer[arr.capo_id] || 0) + (correct ? 3 : -2);
    await supabase.from("arrests").update({ was_correct: correct }).eq("id", arr.id);
  }

  // Alliance bonus
  for (const al of alliances || []) {
    const r1 = roleByPlayer[al.requester_id];
    const r2 = roleByPlayer[al.partner_id];
    if (r1 && r2 && winningTeam.includes(r1) && winningTeam.includes(r2)) {
      pointsByPlayer[al.requester_id] = (pointsByPlayer[al.requester_id] || 0) + 1;
      pointsByPlayer[al.partner_id] = (pointsByPlayer[al.partner_id] || 0) + 1;
    }
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