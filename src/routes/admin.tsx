import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Ornament } from "@/components/Ornament";
import { getStoredGameId, setStoredGameId, resolveMurderVote, recordArmoryWinner } from "@/lib/game";
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
  const [game, setGame] = useState<any>(null);
  const [n3Name, setN3Name] = useState("");
  const [savingN3, setSavingN3] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function refresh() {
      const { data: p } = await supabase.from("players").select("*").eq("game_id", gameId);
      if (mounted) setPlayers((p || []).slice().sort((a: any, b: any) => {
        const na = Number(a.name), nb = Number(b.name);
        if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
        return String(a.name).localeCompare(String(b.name));
      }));
      const { data: g } = await supabase.from("games").select("*").eq("id", gameId).maybeSingle();
      if (mounted && g) {
        setGame(g);
        setN3Name((g as any).night3_game_name ?? "");
      }
    }
    refresh();
    const ch = supabase.channel(`lobby-${gameId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "games" }, () => refresh())
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [gameId]);

  async function saveN3() {
    setSavingN3(true);
    const { error } = await supabase
      .from("games")
      .update({ night3_game_name: n3Name.trim() || "TBC — To be decided by the group." } as any)
      .eq("id", gameId);
    setSavingN3(false);
    if (error) toast.error(error.message);
    else toast.success("Night 3 game saved");
  }

  const n3Locked = game && game.current_night >= 3 && game.phase !== "setup";

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

      <Ornament className="mt-10">NIGHT 3 · ARMORY GAME</Ornament>
      <div className="mt-4 bg-card border border-[var(--gold)]/30 rounded-sm p-4">
        <div className="text-[10px] tracking-widest uppercase text-gold/70 mb-2">
          Game name (any player can edit before Night 3 begins)
        </div>
        <input
          value={n3Name}
          onChange={(e) => setN3Name(e.target.value)}
          disabled={!!n3Locked}
          placeholder="TBC — To be decided by the group."
          className="w-full bg-input border border-[var(--gold)]/20 rounded-sm px-3 py-2 text-sm font-serif focus:border-gold focus:outline-none disabled:opacity-60"
        />
        <button
          onClick={saveN3}
          disabled={savingN3 || !!n3Locked}
          className="mt-3 w-full font-display tracking-widest text-xs uppercase border border-gold text-gold py-2 rounded-sm disabled:opacity-40"
        >
          {savingN3 ? "Saving…" : n3Locked ? "Locked · Night 3 in progress" : "Save Night 3 Game"}
        </button>
        <div className="mt-2 text-[10px] tracking-widest uppercase text-muted-foreground/70 text-center">
          Displayed on every player's screen during Night 3.
        </div>
      </div>

      <Ornament className="mt-10">ROSTER</Ornament>
      {game && (game.phase === "night_active" || game.phase === "armory") && (
        <MorningRevealCard game={game} players={players} gameId={gameId} />
      )}
      {game && (game.phase === "night_active" || game.phase === "armory") && (
        <ArmoryAdminCard gameId={gameId} night={game.current_night} players={players} />
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {players.map((p) => (
          <div key={p.id} className="border border-[var(--gold)]/20 rounded-sm p-2 bg-card/60">
            <div className="font-serif text-sm">{p.name}</div>
            <div className="text-[10px] tracking-widest uppercase text-muted-foreground flex justify-between">
              <span>
                {p.total_points}pt
                {p.state === "ghost" && <span className="ml-2 text-[var(--blood)]">🕯</span>}
                {p.state === "banished" && <span className="ml-2 text-[var(--blood)]">🔒</span>}
              </span>
              <span className={p.giuro_used ? "text-[var(--blood)]" : "text-gold"}>
                Giuro: {p.giuro_used ? "Used" : "Available"}
              </span>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={async () => {
          if (!confirm("Permanently delete this game and all its data? This cannot be undone.")) return;
          const tables = [
            "alliances", "arrests", "drink_assignments", "giuros",
            "murders", "murder_votes", "armory_rounds", "phase_ready",
            "phase_transitions", "role_assignments", "sotto_sospetto_votes",
            "sotto_sospetto", "suspect_tips", "votes", "players",
          ];
          // sotto_sospetto_votes uses sospetto_id, not game_id — cascade from sotto_sospetto handles it.
          await Promise.all(
            tables
              .filter((t) => t !== "sotto_sospetto_votes")
              .map((t) => (supabase as any).from(t).delete().eq("game_id", gameId)),
          );
          await supabase.from("games").delete().eq("id", gameId);
          localStorage.removeItem("famiglia_game_id");
          window.location.href = "/admin";
        }}
        className="mt-6 w-full font-display tracking-widest text-xs uppercase bg-[var(--blood)] text-white py-3 rounded-sm"
      >
        New Game
      </button>

      <button onClick={() => { if (confirm("End the current game for everyone on this device?")) onReset(); }} className="mt-4 w-full text-[10px] tracking-widest uppercase text-muted-foreground/60 py-2">
        Forget Game on This Device
      </button>
    </div>
  );
}

function MorningRevealCard({ game, players, gameId }: { game: any; players: any[]; gameId: string }) {
  const [busy, setBusy] = useState(false);
  const revealed = game.morning_revealed && game.morning_revealed_night === game.current_night;
  const victim = players.find((p) => p.state === "ghost"); // most recent ghost (display only)

  async function reveal() {
    setBusy(true);
    const res = await resolveMurderVote(gameId, game.current_night).catch((e) => {
      toast.error(e.message); return null;
    });
    setBusy(false);
    if (!res) return;
    if (res.already) toast("Already revealed.");
    else if (res.victim_id) toast.success("Victim revealed.");
    else toast("No murder — Traditori not unanimous.");
  }

  return (
    <div className="mt-6 bg-[var(--blood)]/10 border border-[var(--blood)] rounded-sm p-4">
      <div className="text-[10px] tracking-widest uppercase text-[var(--blood)] mb-2">
        🌅 Morning Reveal · Notte {game.current_night}
      </div>
      {revealed ? (
        <div className="text-center font-display text-sm tracking-widest text-[var(--blood)]">
          {victim ? `† ${victim.name?.toUpperCase()} †` : "No one was murdered."}
        </div>
      ) : (
        <button onClick={reveal} disabled={busy}
          className="w-full font-display tracking-widest text-xs uppercase bg-[var(--blood)] text-foreground py-3 rounded-sm disabled:opacity-50">
          {busy ? "Revealing…" : "Reveal the Victim"}
        </button>
      )}
      <div className="mt-2 text-[10px] tracking-widest uppercase text-muted-foreground/70 text-center">
        Tap when all Traditori have submitted their murder vote. Broadcasts to all phones.
      </div>
    </div>
  );
}

function ArmoryAdminCard({ gameId, night, players }: { gameId: string; night: number; players: any[] }) {
  const [rounds, setRounds] = useState<any[]>([]);
  const [a, setA] = useState(""); const [b, setB] = useState("");

  async function refresh() {
    const { data } = await supabase.from("armory_rounds").select("*").eq("game_id", gameId).eq("night", night).order("created_at");
    setRounds(data || []);
  }
  useEffect(() => {
    refresh();
    const ch = supabase.channel(`armory-admin-${gameId}-${night}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "armory_rounds" }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [gameId, night]);

  async function addPair() {
    if (!a || !b || a === b) { toast.error("Pick two different players."); return; }
    const { error } = await supabase.from("armory_rounds").insert({
      game_id: gameId, night, player_a_id: a, player_b_id: b,
    });
    if (error) toast.error(error.message); else { setA(""); setB(""); }
  }
  async function removeRound(id: string) {
    await supabase.from("armory_rounds").delete().eq("id", id);
  }
  async function markWinner(round: any) {
    const a = players.find((p) => p.id === round.player_a_id);
    const b = players.find((p) => p.id === round.player_b_id);
    const banishedNames = [a, b].filter((p) => p?.state === "banished").map((p) => p!.name);
    let reentry = false;
    if (banishedNames.length > 0) {
      reentry = confirm(
        `${banishedNames.join(" & ")} is banished. Re-enter as a Fedele? OK = re-enter, Cancel = stay banished (still earns +2 pt).`,
      );
    }
    await recordArmoryWinner(round.id, { reentry }).catch((e) => toast.error(e.message));
    toast.success("Winners recorded · points applied.");
  }

  const playerName = (id: string) => players.find((p) => p.id === id)?.name || "?";

  return (
    <div className="mt-4 bg-card border border-gold rounded-sm p-4">
      <div className="text-[10px] tracking-widest uppercase text-gold mb-2">
        ⚔ Armory · Notte {night}
      </div>
      <div className="space-y-2 mb-3">
        {rounds.length === 0 && (
          <div className="text-xs font-serif italic text-muted-foreground text-center">No pairings yet.</div>
        )}
        {rounds.map((r) => (
          <div key={r.id} className={`flex items-center justify-between border rounded-sm p-2 ${r.is_winner ? "border-gold bg-[var(--gold)]/10" : "border-[var(--gold)]/20"}`}>
            <span className="font-serif text-sm">{playerName(r.player_a_id)} <span className="text-gold/60">+</span> {playerName(r.player_b_id)}</span>
            <div className="flex gap-1">
              {r.is_winner ? (
                <span className="text-[10px] tracking-widest uppercase text-gold">✓ Winner</span>
              ) : (
                <button onClick={() => markWinner(r)} className="text-[10px] tracking-widest uppercase border border-gold text-gold px-2 py-1 rounded-sm">
                  Mark winner
                </button>
              )}
              {!r.scored && (
                <button onClick={() => removeRound(r.id)} className="text-[10px] tracking-widest uppercase text-[var(--blood)] px-2 py-1">
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <select value={a} onChange={(e) => setA(e.target.value)} className="flex-1 bg-input border border-[var(--gold)]/30 rounded-sm py-2 px-2 text-xs font-serif">
          <option value="">Player A</option>
          {players.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
        </select>
        <select value={b} onChange={(e) => setB(e.target.value)} className="flex-1 bg-input border border-[var(--gold)]/30 rounded-sm py-2 px-2 text-xs font-serif">
          <option value="">Player B</option>
          {players.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
        </select>
        <button onClick={addPair} className="font-display tracking-widest text-xs uppercase border border-gold text-gold px-3 rounded-sm">
          + Pair
        </button>
      </div>
    </div>
  );
}