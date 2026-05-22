import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Ornament } from "@/components/Ornament";
import { getStoredGameId, setStoredGameId } from "@/lib/game";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Lobby · La Famiglia" }] }),
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
  return <LobbyView gameId={gameId} onReset={() => { localStorage.removeItem("famiglia_game_id"); setGameId(null); }} />;
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

function LobbyView({ gameId, onReset }: { gameId: string; onReset: () => void }) {
  const [players, setPlayers] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    async function refresh() {
      const { data: p } = await supabase.from("players").select("*").eq("game_id", gameId).order("name");
      if (mounted) setPlayers(p || []);
    }
    refresh();
    const ch = supabase.channel(`lobby-${gameId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, () => refresh())
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [gameId]);

  return (
    <div className="min-h-screen px-5 max-w-md mx-auto pb-20">
      <AppHeader subtitle="Lobby · La Famiglia" />
      <Ornament>LA FAMIGLIA IS ASSEMBLED</Ornament>
      <p className="text-center text-sm text-muted-foreground mt-4 mb-6 font-serif italic">
        {players.length} {players.length === 1 ? "soul" : "souls"} have joined. Each phone is its own player —
        share this game with your group, then tap below to take your seat.
      </p>
      <Link
        to="/play"
        className="block text-center font-display tracking-widest text-sm uppercase bg-gradient-gold text-primary-foreground py-4 rounded-sm shadow-gold"
      >
        Take My Seat →
      </Link>
      <Link
        to="/tribunale"
        className="mt-3 block text-center font-display tracking-widest text-xs uppercase border border-[var(--gold)]/40 text-gold py-3 rounded-sm"
      >
        Il Tribunale (shared screen)
      </Link>

      <Ornament className="mt-10">ROSTER</Ornament>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {players.map((p) => (
          <div key={p.id} className="border border-[var(--gold)]/20 rounded-sm p-2 bg-card/60">
            <div className="font-serif text-sm">{p.name}</div>
            <div className="text-[10px] tracking-widest uppercase text-muted-foreground">
              {p.total_points}pt
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => { if (confirm("End the current game for everyone on this device?")) onReset(); }} className="mt-10 w-full text-[10px] tracking-widest uppercase text-muted-foreground/60 py-2">
        Forget Game on This Device
      </button>
    </div>
  );
}