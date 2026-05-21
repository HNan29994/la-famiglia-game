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
      const { data: ps } = await supabase.from("players").select("*").eq("game_id", g.id).order("name");
      setPlayers(ps || []);
      setLoading(false);
    })();
  }, []);

  function chooseName(playerId: string) {
    if (!gameId) return;
    setStoredPlayerId(gameId, playerId);
    navigate({ to: "/player/$playerId", params: { playerId } });
  }

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
        This phone will remember you. Choose carefully.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {players.map((p) => (
          <button
            key={p.id}
            onClick={() => chooseName(p.id)}
            className="border border-[var(--gold)]/30 rounded-sm py-4 px-3 bg-card hover:bg-[var(--gold)]/10 transition text-center"
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