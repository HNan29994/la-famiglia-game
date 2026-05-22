import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Ornament } from "@/components/Ornament";
import { getStoredGameId } from "@/lib/game";
import { SPECIAL_EVENTS } from "@/lib/missions";
import { roleMeta } from "@/components/RoleBadge";
import type { Role } from "@/lib/game";
import { toast } from "sonner";

export const Route = createFileRoute("/tribunale")({
  component: TribunalePage,
  head: () => ({ meta: [{ title: "Il Tribunale · La Famiglia" }] }),
});

function TribunalePage() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [game, setGame] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [arrests, setArrests] = useState<any[]>([]);
  const [votes, setVotes] = useState<any[]>([]);
  const [timer, setTimer] = useState(180);
  const [murders, setMurders] = useState<any[]>([]);

  useEffect(() => {
    const id = getStoredGameId();
    if (!id) return;
    setGameId(id);
  }, []);

  async function refresh(id: string) {
    const { data: g } = await supabase.from("games").select("*").eq("id", id).single();
    setGame(g);
    const { data: ps } = await supabase.from("players").select("*").eq("game_id", id);
    setPlayers(ps || []);
    if (g) {
      const { data: a } = await supabase.from("role_assignments").select("*").eq("game_id", id).eq("night", g.current_night);
      setAssignments(a || []);
      const { data: ar } = await supabase.from("arrests").select("*").eq("game_id", id).eq("night", g.current_night);
      setArrests(ar || []);
      const { data: v } = await supabase.from("votes").select("*").eq("game_id", id).eq("night", g.current_night);
      setVotes(v || []);
      const { data: m } = await supabase.from("murders").select("*").eq("game_id", id).eq("night", g.current_night);
      setMurders(m || []);
    }
  }

  useEffect(() => {
    if (!gameId) return;
    refresh(gameId);
    const id = gameId;
    const ch = supabase.channel(`trib-${id}`)
      .on("postgres_changes", { event: "*", schema: "public" }, () => refresh(id))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [gameId]);

  // Discussion timer — must be declared before any conditional return
  // to keep hook order stable across renders.
  useEffect(() => {
    if (game?.phase !== "tribunale_discussion") return;
    setTimer(180);
    const t = setInterval(() => setTimer((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [game?.phase]);

  if (!gameId || !game) {
    return (
      <div className="min-h-screen px-6 max-w-md mx-auto">
        <AppHeader subtitle="No active tribunal" />
        <div className="text-center font-serif italic text-muted-foreground mt-10">
          No game in session. Set one up from the lobby first.
        </div>
        <Link to="/admin" className="block text-center mt-6 font-display tracking-widest text-xs uppercase text-gold underline">Lobby →</Link>
      </div>
    );
  }

  const playerById = Object.fromEntries(players.map((p) => [p.id, p]));
  const event = SPECIAL_EVENTS[game.current_night];

  return (
    <div className="min-h-screen px-5 max-w-2xl mx-auto pb-20">
      <AppHeader subtitle={`Il Tribunale · Notte ${game.current_night}`} />

      <div className="bg-card border border-gold rounded-sm p-5 shadow-dramatic text-center">
        <div className="text-4xl mb-2">{event.emoji}</div>
        <div className="font-display text-2xl text-gold text-shadow-gold">{event.name}</div>
        <div className="text-sm font-serif italic text-muted-foreground mt-2">{event.description}</div>
      </div>

      <div className="mt-3 text-center text-[10px] tracking-widest uppercase text-muted-foreground">
        Shared screen · phases advance when a majority of players tap ready on their phones
      </div>

      {murders.length > 0 &&
        (game.phase === "tribunale_reveal" ||
          game.phase === "tribunale_leaderboard" ||
          game.phase === "tribunale_drinks") && (
          <DeceasedReveal murders={murders} playerById={playerById} />
        )}

      {/* Phase router */}
      {game.phase === "tribunale_missions" && (
        <MissionReport assignments={assignments} playerById={playerById} />
      )}
      {game.phase === "tribunale_arrests" && (
        <ArrestsReveal arrests={arrests} playerById={playerById} />
      )}
      {game.phase === "tribunale_discussion" && (
        <DiscussionPhase timer={timer} />
      )}
      {game.phase === "tribunale_voting" && (
        <VotingPhase players={players} votes={votes} />
      )}
      {game.phase === "tribunale_reveal" && (
        <RoleReveal assignments={assignments} playerById={playerById} night={game.current_night} />
      )}
      {game.phase === "tribunale_leaderboard" && (
        <NightLeaderboard assignments={assignments} playerById={playerById} />
      )}
      {game.phase === "tribunale_drinks" && (
        <DrinkPhase gameId={gameId} night={game.current_night} assignments={assignments} players={players} />
      )}
      {game.phase === "finished" && (
        <Finale players={players} />
      )}
    </div>
  );
}

function PhaseShell({ title, children, onNext, nextLabel = "Continue →" }: any) {
  return (
    <div className="mt-6">
      <Ornament>{title}</Ornament>
      <div className="mt-4">{children}</div>
      {onNext && (
        <button onClick={onNext} className="mt-6 w-full font-display tracking-widest text-sm uppercase bg-gradient-gold text-primary-foreground py-4 rounded-sm shadow-gold">
          {nextLabel}
        </button>
      )}
    </div>
  );
}

function MissionReport({ assignments, playerById, onNext }: any) {
  const sorted = [...assignments].sort((a, b) => {
    const ac = (a.mission_1_state === "completed" ? 1 : 0) + (a.mission_2_state === "completed" ? 1 : 0);
    const bc = (b.mission_1_state === "completed" ? 1 : 0) + (b.mission_2_state === "completed" ? 1 : 0);
    return bc - ac;
  });
  return (
    <PhaseShell title="MISSION REPORT" onNext={onNext} nextLabel="Reveal Arrests →">
      <div className="space-y-2">
        {sorted.map((a: any) => {
          const completed = [a.mission_1_state, a.mission_2_state].filter((s) => s === "completed").length;
          return (
            <div key={a.id} className="flex justify-between items-center bg-card border border-[var(--gold)]/20 rounded-sm p-3">
              <span className="font-serif">{playerById[a.player_id]?.name}</span>
              <span className="font-display text-gold text-sm">{completed}/2 ✓</span>
            </div>
          );
        })}
      </div>
    </PhaseShell>
  );
}

function ArrestsReveal({ arrests, playerById, onNext }: any) {
  return (
    <PhaseShell title="THE CAPI ACT" onNext={onNext} nextLabel="Open Discussion →">
      {arrests.length === 0 && <div className="text-center font-serif italic text-muted-foreground">No arrests this night.</div>}
      <div className="space-y-3">
        {arrests.map((ar: any) => (
          <div key={ar.id} className="bg-card border border-gold rounded-sm p-4 text-center animate-fade-up">
            <div className="text-[10px] tracking-widest uppercase text-gold">Il Capo</div>
            <div className="font-display text-lg text-foreground">{playerById[ar.capo_id]?.name}</div>
            <div className="my-2 text-gold">↓ ARRESTS ↓</div>
            <div className="font-display text-xl text-shimmer">{playerById[ar.target_id]?.name?.toUpperCase()}</div>
          </div>
        ))}
      </div>
    </PhaseShell>
  );
}

function DiscussionPhase({ timer, onNext }: any) {
  const mm = String(Math.floor(timer / 60)).padStart(2, "0");
  const ss = String(timer % 60).padStart(2, "0");
  return (
    <PhaseShell title="OPEN ACCUSATIONS" onNext={onNext} nextLabel="Open the Vote →">
      <div className="text-center bg-card border border-gold rounded-sm p-10 animate-glow">
        <div className="font-display text-7xl text-shimmer">{mm}:{ss}</div>
        <div className="text-sm font-serif italic text-muted-foreground mt-3">
          Accuse. Defend. Lie. The floor is open.
        </div>
      </div>
    </PhaseShell>
  );
}

function VotingPhase({ players, votes, onClose }: any) {
  const voters = new Set(votes.map((v: any) => v.voter_id));
  return (
    <PhaseShell title={`IL VOTO · ${voters.size}/${players.length}`} onNext={onClose} nextLabel="Reveal All Roles →">
      <div className="bg-card border border-gold rounded-sm p-6 text-center">
        <div className="font-display text-5xl text-shimmer">{voters.size}/{players.length}</div>
        <div className="text-sm font-serif italic text-muted-foreground mt-3">Players are voting on their own phones…</div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-1">
        {players.map((p: any) => (
          <div key={p.id} className={`text-xs font-serif p-2 rounded-sm text-center ${voters.has(p.id) ? "bg-[var(--gold)]/20 text-gold" : "bg-card text-muted-foreground"}`}>
            {voters.has(p.id) ? "✓ " : ""}{p.name}
          </div>
        ))}
      </div>
    </PhaseShell>
  );
}

function RoleReveal({ assignments, playerById, night, onNext }: any) {
  return (
    <PhaseShell title="THE REVEAL" onNext={onNext} nextLabel="Tally the Score →">
      {night === 2 && (
        <div className="bg-[var(--blood)]/20 border border-[var(--blood)] rounded-sm p-3 mb-4 text-center">
          <div className="font-display text-sm text-[var(--blood)] tracking-widest">👁️ IL TRADITORE DOPPIO</div>
          <div className="text-xs font-serif italic mt-1">One traitor was secretly a Capo…</div>
        </div>
      )}
      <div className="space-y-2">
        {assignments.map((a: any, i: number) => {
          const meta = roleMeta(a.role as Role);
          return (
            <div key={a.id} className="flex justify-between items-center bg-card border border-[var(--gold)]/30 rounded-sm p-3 animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
              <span className="font-serif">{playerById[a.player_id]?.name}</span>
              <span className={`font-display text-sm tracking-widest uppercase ${meta.color}`}>{meta.emoji} {meta.italian}</span>
            </div>
          );
        })}
      </div>
    </PhaseShell>
  );
}

function NightLeaderboard({ assignments, playerById, onNext }: any) {
  const sorted = [...assignments].sort((a, b) => b.night_points - a.night_points);
  return (
    <PhaseShell title="NIGHT CLASSIFICA" onNext={onNext} nextLabel="Distribute Drinks →">
      <div className="space-y-1">
        {sorted.map((a: any, i: number) => (
          <div key={a.id} className={`flex justify-between items-center py-2 px-3 rounded-sm ${i === 0 ? "bg-gradient-gold text-primary-foreground" : "border-b border-[var(--gold)]/10"}`}>
            <div className="flex items-center gap-3">
              <span className={`font-display text-xs w-5 ${i === 0 ? "" : "text-gold/70"}`}>{String(i + 1).padStart(2, "0")}</span>
              <span className="font-serif">{playerById[a.player_id]?.name}</span>
            </div>
            <span className="font-display text-sm">+{a.night_points}</span>
          </div>
        ))}
      </div>
    </PhaseShell>
  );
}

function DrinkPhase({ gameId, night, assignments, players }: any) {
  const playerById = Object.fromEntries(players.map((p: any) => [p.id, p]));
  const sorted = [...assignments].sort((a, b) => b.night_points - a.night_points);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [assigning, setAssigning] = useState<Record<string, number>>({});
  const [received, setReceived] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("drink_assignments").select("*").eq("game_id", gameId).eq("night", night);
      const r: Record<string, number> = {};
      data?.forEach((d: any) => {
        r[d.to_player_id] = (r[d.to_player_id] || 0) + d.fingers;
      });
      setReceived(r);
    })();
  }, [gameId, night]);

  if (currentIdx >= sorted.length) {
    return (
      <PhaseShell title="DRINKS DISTRIBUTED">
        <div className="text-center font-serif italic">All fingers assigned. Salute!</div>
        <div className="mt-4 space-y-1">
          {Object.entries(received).sort((a, b) => b[1] - a[1]).map(([pid, n]) => (
            <div key={pid} className="flex justify-between text-sm font-serif border-b border-[var(--gold)]/10 py-1">
              <span>{playerById[pid]?.name}</span>
              <span className="text-[var(--blood)]">🥃 {n}</span>
            </div>
          ))}
        </div>
      </PhaseShell>
    );
  }

  const current = sorted[currentIdx];
  const budget = current.night_points;
  const used = Object.values(assigning).reduce((a, b) => a + b, 0);
  const remaining = budget - used;

  async function confirm() {
    const rows = Object.entries(assigning)
      .filter(([, n]) => n > 0)
      .map(([toId, fingers]) => ({
        game_id: gameId,
        night,
        from_player_id: current.player_id,
        to_player_id: toId,
        fingers,
      }));
    if (rows.length > 0) {
      const { error } = await supabase.from("drink_assignments").insert(rows);
      if (error) { toast.error(error.message); return; }
      const r = { ...received };
      rows.forEach((row) => { r[row.to_player_id] = (r[row.to_player_id] || 0) + row.fingers; });
      setReceived(r);
    }
    setAssigning({});
    setCurrentIdx((i) => i + 1);
  }

  return (
    <PhaseShell title={`${playerById[current.player_id]?.name?.toUpperCase()} POURS`}>
      <div className="bg-card border border-gold rounded-sm p-4 mb-4 text-center">
        <div className="text-[10px] tracking-widest uppercase text-gold">Budget</div>
        <div className="font-display text-4xl text-shimmer">{remaining} / {budget}</div>
        <div className="text-xs font-serif italic text-muted-foreground">fingers remaining</div>
      </div>
      <div className="space-y-1">
        {players.filter((p: any) => p.id !== current.player_id).map((p: any) => {
          const n = assigning[p.id] || 0;
          return (
            <div key={p.id} className="flex justify-between items-center bg-card border border-[var(--gold)]/20 rounded-sm p-2">
              <div>
                <div className="font-serif text-sm">{p.name}</div>
                <div className="text-[10px] text-muted-foreground">🥃 {received[p.id] || 0} pending</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setAssigning((s) => ({ ...s, [p.id]: Math.max(0, n - 1) }))} className="w-8 h-8 rounded-sm border border-[var(--gold)]/30 text-gold">−</button>
                <span className="font-display w-5 text-center">{n}</span>
                <button disabled={remaining <= 0} onClick={() => setAssigning((s) => ({ ...s, [p.id]: n + 1 }))} className="w-8 h-8 rounded-sm border border-gold text-gold disabled:opacity-30">+</button>
              </div>
            </div>
          );
        })}
      </div>
      <button onClick={confirm} className="mt-4 w-full font-display tracking-widest text-sm uppercase bg-gradient-gold text-primary-foreground py-4 rounded-sm shadow-gold">
        Confirm & Next Pour →
      </button>
    </PhaseShell>
  );
}

function Finale({ players }: { players: any[] }) {
  const sorted = [...players].sort((a, b) => b.total_points - a.total_points);
  const winner = sorted[0];
  return (
    <div className="mt-10 text-center">
      <Ornament>IL FINALE</Ornament>
      <div className="mt-8 bg-gradient-to-b from-card to-[var(--ink)] border border-gold rounded-sm p-10 shadow-dramatic animate-reveal">
        <div className="text-6xl mb-4">👑</div>
        <div className="text-[10px] tracking-[0.4em] uppercase text-gold mb-2">The Padrino</div>
        <div className="font-display text-4xl text-shimmer">{winner?.name?.toUpperCase()}</div>
        <div className="font-display text-sm text-gold mt-3">{winner?.total_points} POINTS</div>
      </div>
      <div className="mt-8 space-y-1">
        {sorted.map((p, i) => (
          <div key={p.id} className={`flex justify-between items-center py-2 px-3 rounded-sm ${i === 0 ? "bg-[var(--gold)]/20 border border-gold" : "border-b border-[var(--gold)]/10"}`}>
            <div className="flex items-center gap-3">
              <span className="font-display text-gold/70 text-xs w-5">{String(i + 1).padStart(2, "0")}</span>
              <span className="font-serif">{p.name}</span>
            </div>
            <span className="font-display text-gold">{p.total_points}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function DeceasedReveal({ murders, playerById }: { murders: any[]; playerById: Record<string, any> }) {
  return (
    <div className="mt-6 bg-[var(--blood)]/15 border border-[var(--blood)] rounded-sm p-5">
      <div className="text-center text-[10px] tracking-[0.4em] uppercase text-[var(--blood)] mb-3">
        † The Deceased Tonight †
      </div>
      <div className="space-y-2">
        {murders.map((m: any) => (
          <div
            key={m.id}
            className="flex justify-between items-center font-serif text-base border-b border-[var(--blood)]/20 py-2"
          >
            <span>{playerById[m.victim_id]?.name}</span>
            <span className="text-[var(--blood)] font-display tracking-widest text-sm">
              🥃 {m.fingers} FINGERS
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 text-center text-xs font-serif italic text-muted-foreground">
        Pour. Drink. Carry on. The assassins remain hidden.
      </div>
    </div>
  );
}
