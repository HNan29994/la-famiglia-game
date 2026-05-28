import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Ornament } from "@/components/Ornament";
import { getStoredGameId, setStoredGameId, setStoredPlayerId } from "@/lib/game";

export const Route = createFileRoute("/play")({
  component: PlayPicker,
  head: () => ({ meta: [{ title: "Choose your name · La Famiglia" }] }),
});

function PlayPicker() {
  const [players, setPlayers] = useState<any[]>([]);
  const [gameId, setGameId] = useState<string | null>(null);
  const [phase, setPhase] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      // Find most recent game with players
      const stored = getStoredGameId();
      let g: any = null;
      if (stored) {
        const { data } = await supabase.from("games").select("*").eq("id", stored).maybeSingle();
        g = data;
      }
      if (!g) {
        const { data } = await supabase.from("games").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
        g = data;
        if (g) setStoredGameId(g.id);
      }
      if (!g) { setLoading(false); return; }
      setGameId(g.id);
      setPhase(g.phase ?? null);
      const { data: ps } = await supabase.from("players").select("*").eq("game_id", g.id);
      setPlayers((ps || []).slice().sort((a: any, b: any) => {
        const na = Number(a.name), nb = Number(b.name);
        if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
        return String(a.name).localeCompare(String(b.name));
      }));
      setLoading(false);
    })();
  }, []);

  function chooseName(playerId: string) {
    if (!gameId || !selectable) return;
    setStoredPlayerId(gameId, playerId);
    navigate({ to: "/player/$playerId", params: { playerId } });
  }

  const selectable = !phase || phase === "setup";

  if (loading) return <div className="p-8 text-center text-muted-foreground">…</div>;
  if (!gameId || players.length === 0) {
    return (
      <div className="min-h-screen px-6 max-w-md mx-auto">
        <AppHeader subtitle="No game in session" />
        <div className="text-center font-serif italic text-muted-foreground mt-10">
          The family has not yet assembled. Ask Il Padrino.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-5 max-w-md mx-auto pb-20">
      <AppHeader subtitle="Identify yourself" />
      <Ornament>SELECT YOUR NAME</Ornament>
      <p className="text-center text-xs text-muted-foreground mt-4 mb-6 font-serif italic">
        {selectable ? "This phone will remember you. Choose carefully." : "Waiting for the family to settle — selection is locked while the game is in progress."}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {players.map((p) => (
          <button
            key={p.id}
            onClick={() => chooseName(p.id)}
            disabled={!selectable}
            title={selectable ? undefined : "Waiting for game to begin"}
            className={`border border-[var(--gold)]/30 rounded-sm py-4 px-3 bg-card transition text-center ${selectable ? "hover:bg-[var(--gold)]/10" : "opacity-50 cursor-not-allowed"}`}
          >
            <div className="font-serif text-base text-foreground">{p.name}</div>
            <div className="text-[10px] tracking-widest uppercase text-muted-foreground mt-1">
              {p.total_points} pt
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}