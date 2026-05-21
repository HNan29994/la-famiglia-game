import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Ornament } from "@/components/Ornament";
import { beginNight, getStoredGameId, setStoredGameId, scoreNight } from "@/lib/game";
import { SPECIAL_EVENTS } from "@/lib/missions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Admin · La Famiglia" }] }),
});

function AdminPage() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const stored = getStoredGameId();
      if (stored) {
        const { data } = await supabase.from("games").select("id").eq("id", stored).maybeSingle();
        if (data) {
          setGameId(stored);
          setLoading(false);
          return;
        }
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="p-8 text-center text-muted-foreground">…</div>;
  if (!gameId) return <NewGameSetup onCreated={(id) => { setStoredGameId(id); setGameId(id); }} />;
  return <AdminConsole gameId={gameId} onReset={() => { localStorage.removeItem("famiglia_game_id"); setGameId(null); }} />;
}

function NewGameSetup({ onCreated }: { onCreated: (id: string) => void }) {
  const [names, setNames] = useState<string[]>(Array(18).fill(""));
  const [submitting, setSubmitting] = useState(false);

  async function createGame() {
    const cleaned = names.map((n) => n.trim()).filter(Boolean);
    if (cleaned.length < 4) {
      toast.error("Need at least 4 players");
      return;
    }
    if (new Set(cleaned).size !== cleaned.length) {
      toast.error("Player names must be unique");
      return;
    }
    setSubmitting(true);
    try {
      const { data: g, error: gErr } = await supabase.from("games").insert({}).select().single();
      if (gErr) throw gErr;
      const rows = cleaned.map((name) => ({ game_id: g.id, name }));
      const { error: pErr } = await supabase.from("players").insert(rows);
      if (pErr) throw pErr;
      toast.success("La famiglia is assembled");
      onCreated(g.id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen px-5 max-w-md mx-auto pb-20">
      <AppHeader subtitle="Assemble the family" />
      <Ornament>NEW GAME</Ornament>
      <p className="text-center text-sm text-muted-foreground mt-4 mb-6 font-serif italic">
        Enter the names of all 18 souls. Each will receive their fate.
      </p>
      <div className="space-y-2">
        {names.map((n, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="font-display text-gold/60 text-xs w-6">{String(i + 1).padStart(2, "0")}</span>
            <input
              value={n}
              onChange={(e) => {
                const next = [...names];
                next[i] = e.target.value;
                setNames(next);
              }}
              placeholder="Player name…"
              className="flex-1 bg-input border border-[var(--gold)]/20 rounded-sm px-3 py-2 text-sm font-serif focus:border-gold focus:outline-none"
            />
          </div>
        ))}
      </div>
      <button
        onClick={createGame}
        disabled={submitting}
        className="mt-8 w-full font-display tracking-widest text-sm uppercase bg-gradient-gold text-primary-foreground py-4 rounded-sm shadow-gold disabled:opacity-50"
      >
        {submitting ? "Sealing…" : "Begin La Famiglia"}
      </button>
    </div>
  );
}

function AdminConsole({ gameId, onReset }: { gameId: string; onReset: () => void }) {
  const [game, setGame] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [arrests, setArrests] = useState<any[]>([]);
  const [votes, setVotes] = useState<any[]>([]);
  const navigate = useNavigate();

  async function refresh() {
    const { data: g } = await supabase.from("games").select("*").eq("id", gameId).single();
    setGame(g);
    const { data: p } = await supabase.from("players").select("*").eq("game_id", gameId).order("name");
    setPlayers(p || []);
    if (g) {
      const { data: a } = await supabase.from("role_assignments").select("*").eq("game_id", gameId).eq("night", g.current_night);
      setAssignments(a || []);
      const { data: ar } = await supabase.from("arrests").select("*").eq("game_id", gameId).eq("night", g.current_night);
      setArrests(ar || []);
      const { data: v } = await supabase.from("votes").select("*").eq("game_id", gameId).eq("night", g.current_night);
      setVotes(v || []);
    }
  }

  useEffect(() => {
    refresh();
    const ch = supabase.channel(`admin-${gameId}`)
      .on("postgres_changes", { event: "*", schema: "public" }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [gameId]);

  if (!game) return <div className="p-8 text-center">…</div>;

  const event = SPECIAL_EVENTS[game.current_night];
  const playerById = Object.fromEntries(players.map((p) => [p.id, p]));
  const voteCount: Record<string, number> = {};
  votes.forEach((v) => { voteCount[v.target_id] = (voteCount[v.target_id] || 0) + 1; });
  const uniqueVoters = new Set(votes.map((v) => v.voter_id)).size;

  async function setPhase(phase: any) {
    await supabase.from("games").update({ phase }).eq("id", gameId);
  }

  async function startNight() {
    try {
      await beginNight(gameId, game.current_night);
      toast.success(`Night ${game.current_night} begins`);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function advanceToTribunale() {
    await setPhase("tribunale_missions");
    toast.success("Il Tribunale convenes");
  }

  async function calculateScores() {
    await scoreNight(gameId, game.current_night);
    await setPhase("tribunale_leaderboard");
    toast.success("Points calculated");
  }

  async function nextNight() {
    if (game.current_night >= 3) {
      await supabase.from("games").update({ phase: "finished" }).eq("id", gameId);
    } else {
      await supabase.from("games").update({
        current_night: game.current_night + 1,
        phase: "setup",
      }).eq("id", gameId);
    }
  }

  return (
    <div className="min-h-screen px-5 max-w-md mx-auto pb-20">
      <AppHeader subtitle="Padrino's chamber" />
      <div className="bg-card border border-[var(--gold)]/30 rounded-sm p-5 shadow-dramatic">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Tonight</div>
            <div className="font-display text-2xl text-gold">Notte {game.current_night}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Phase</div>
            <div className="font-display text-sm text-foreground">{game.phase.replace(/_/g, " ")}</div>
          </div>
        </div>
        <div className="mt-4 p-3 border border-[var(--gold)]/20 rounded-sm bg-[var(--ink)]/40">
          <div className="text-xs font-display tracking-widest text-gold">
            {event.emoji} {event.name}
          </div>
          <div className="text-xs font-serif italic text-muted-foreground mt-1">{event.description}</div>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        {game.phase === "setup" && (
          <button onClick={startNight} className="w-full font-display tracking-widest text-sm uppercase bg-gradient-gold text-primary-foreground py-4 rounded-sm shadow-gold">
            Begin Notte {game.current_night}
          </button>
        )}
        {game.phase === "night_active" && (
          <button onClick={advanceToTribunale} className="w-full font-display tracking-widest text-sm uppercase bg-gradient-gold text-primary-foreground py-4 rounded-sm shadow-gold">
            Convene Il Tribunale
          </button>
        )}
        {game.phase.startsWith("tribunale_") && (
          <Link to="/tribunale" className="block text-center font-display tracking-widest text-sm uppercase bg-gradient-gold text-primary-foreground py-4 rounded-sm shadow-gold">
            Open Il Tribunale →
          </Link>
        )}
        {game.phase === "finished" && (
          <Link to="/tribunale" className="block text-center font-display tracking-widest text-sm uppercase bg-gradient-gold text-primary-foreground py-4 rounded-sm shadow-gold">
            View Final Reveal
          </Link>
        )}
      </div>

      <Ornament className="mt-8">ROSTER</Ornament>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {players.map((p) => {
          const a = assignments.find((x) => x.player_id === p.id);
          return (
            <div key={p.id} className="border border-[var(--gold)]/20 rounded-sm p-2 bg-card/60">
              <div className="font-serif text-sm">{p.name}</div>
              <div className="text-[10px] tracking-widest uppercase text-muted-foreground">
                {a ? a.role : "—"} · {p.total_points}pt
              </div>
            </div>
          );
        })}
      </div>

      {arrests.length > 0 && (
        <>
          <Ornament className="mt-8">ARRESTS</Ornament>
          <div className="mt-3 space-y-2">
            {arrests.map((ar) => (
              <div key={ar.id} className="text-sm font-serif border border-[var(--gold)]/20 rounded-sm p-2">
                <span className="text-gold">{playerById[ar.capo_id]?.name}</span>
                {" → "}
                <span>{playerById[ar.target_id]?.name}</span>
                {ar.was_correct === true && <span className="ml-2 text-gold">✓ correct</span>}
                {ar.was_correct === false && <span className="ml-2 text-[var(--blood)]">✗ wrong</span>}
              </div>
            ))}
          </div>
        </>
      )}

      {game.phase === "tribunale_voting" && (
        <>
          <Ornament className="mt-8">VOTES · {uniqueVoters}/{players.length}</Ornament>
          <div className="mt-3 space-y-1">
            {Object.entries(voteCount).sort((a, b) => b[1] - a[1]).map(([pid, count]) => (
              <div key={pid} className="flex justify-between text-sm font-serif border-b border-[var(--gold)]/10 py-1">
                <span>{playerById[pid]?.name}</span>
                <span className="text-gold">{count}</span>
              </div>
            ))}
          </div>
          <button onClick={calculateScores} className="mt-6 w-full font-display tracking-widest text-sm uppercase bg-gradient-gold text-primary-foreground py-4 rounded-sm shadow-gold">
            Reveal & Score
          </button>
        </>
      )}

      {(game.phase === "tribunale_leaderboard" || game.phase === "tribunale_drinks") && (
        <button onClick={nextNight} className="mt-6 w-full font-display tracking-widest text-sm uppercase border border-gold text-gold py-4 rounded-sm">
          {game.current_night >= 3 ? "End Trip → Crown Padrino" : `Advance to Notte ${game.current_night + 1}`}
        </button>
      )}

      <button onClick={onReset} className="mt-10 w-full text-[10px] tracking-widest uppercase text-muted-foreground/60 py-2">
        End Game & Start Over
      </button>
    </div>
  );
}