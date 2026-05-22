import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toggleReady, tryAdvancePhase } from "@/lib/game";

/**
 * Lets a player tap "ready" for the current phase. When a majority of players
 * have tapped ready, any client (first to detect) attempts the phase
 * transition. A DB-side phase_transitions PK prevents double execution.
 */
export function ReadyButton({
  gameId,
  playerId,
  night,
  phase,
  label,
  playerCount,
}: {
  gameId: string;
  playerId: string;
  night: number;
  phase: string;
  label: string;
  playerCount: number;
}) {
  const [readyIds, setReadyIds] = useState<string[]>([]);

  async function refresh() {
    const { data } = await supabase
      .from("phase_ready")
      .select("player_id")
      .eq("game_id", gameId)
      .eq("night", night)
      .eq("phase", phase as any);
    setReadyIds((data || []).map((r: any) => r.player_id));
  }

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel(`ready-${gameId}-${night}-${phase}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "phase_ready" },
        () => {
          refresh();
          // Any client may attempt the transition; lock ensures one wins.
          tryAdvancePhase(gameId).catch(() => {});
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [gameId, night, phase]);

  const isReady = readyIds.includes(playerId);
  const count = readyIds.length;
  const needed = Math.floor(playerCount / 2) + 1;

  return (
    <div className="mt-8 sticky bottom-3">
      <button
        onClick={async () => {
          await toggleReady(gameId, playerId, night, phase, isReady);
          tryAdvancePhase(gameId).catch(() => {});
        }}
        className={`w-full font-display tracking-widest text-sm uppercase py-4 rounded-sm shadow-gold transition ${
          isReady
            ? "bg-card border border-gold text-gold"
            : "bg-gradient-gold text-primary-foreground"
        }`}
      >
        {isReady ? `✓ Ready (${count}/${needed})` : label}
      </button>
      {!isReady && count > 0 && (
        <div className="mt-1 text-center text-[10px] tracking-widest uppercase text-muted-foreground">
          {count}/{needed} ready
        </div>
      )}
    </div>
  );
}
