import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Ornament } from "@/components/Ornament";
import { RoleBadge, roleMeta } from "@/components/RoleBadge";
import type { Role } from "@/lib/game";
import { revealBanishedPlayer, getBanishedOrder } from "@/lib/game";
import { ReadyButton } from "@/components/ReadyButton";
import { SPECIAL_EVENTS } from "@/lib/missions";
import { toast } from "sonner";

export const Route = createFileRoute("/player/$playerId")({
  component: PlayerView,
  head: () => ({ meta: [{ title: "Your fate · La Famiglia" }] }),
});

function PlayerView() {
  const { playerId } = Route.useParams();
  const [game, setGame] = useState<any>(null);
  const [player, setPlayer] = useState<any>(null);
  const [assignment, setAssignment] = useState<any>(null);
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [myVotes, setMyVotes] = useState<any[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [murders, setMurders] = useState<any[]>([]);
  const [traitorAssignments, setTraitorAssignments] = useState<any[]>([]);
  const [giuros, setGiuros] = useState<any[]>([]);
  const [murderVotes, setMurderVotes] = useState<any[]>([]);
  const [armoryRounds, setArmoryRounds] = useState<any[]>([]);
  const [sospetto, setSospetto] = useState<any | null>(null);
  const [sospettoVotes, setSospettoVotes] = useState<any[]>([]);

  async function refresh() {
    const { data: p } = await supabase.from("players").select("*").eq("id", playerId).single();
    setPlayer(p);
    if (!p) return;
    const { data: g } = await supabase.from("games").select("*").eq("id", p.game_id).single();
    setGame(g);
    const { data: ap } = await supabase.from("players").select("*").eq("game_id", p.game_id).order("name");
    setAllPlayers(ap || []);
    if (g) {
      const { data: a } = await supabase.from("role_assignments").select("*").eq("game_id", p.game_id).eq("night", g.current_night).eq("player_id", playerId).maybeSingle();
      setAssignment(a);
      const { data: ta } = await supabase.from("role_assignments").select("player_id, role").eq("game_id", p.game_id).eq("night", g.current_night).eq("role", "traitor");
      setTraitorAssignments(ta || []);
      const { data: v } = await supabase.from("votes").select("*").eq("game_id", p.game_id).eq("night", g.current_night).eq("voter_id", playerId);
      setMyVotes(v || []);
      const { data: m } = await supabase.from("murders").select("*").eq("game_id", p.game_id).eq("night", g.current_night);
      setMurders(m || []);
      const { data: gq } = await supabase.from("giuros").select("*").eq("game_id", p.game_id).order("created_at", { ascending: false });
      setGiuros(gq || []);
      const { data: mv } = await supabase.from("murder_votes").select("*").eq("game_id", p.game_id).eq("night", g.current_night);
      setMurderVotes(mv || []);
      const { data: ar } = await supabase.from("armory_rounds").select("*").eq("game_id", p.game_id).eq("night", g.current_night);
      setArmoryRounds(ar || []);
      const { data: ss } = await supabase.from("sotto_sospetto").select("*").eq("game_id", p.game_id).eq("night", g.current_night).maybeSingle();
      setSospetto(ss);
      if (ss) {
        const { data: ssv } = await supabase.from("sotto_sospetto_votes").select("*").eq("sospetto_id", (ss as any).id);
        setSospettoVotes(ssv || []);
      } else {
        setSospettoVotes([]);
      }
    }
  }

  useEffect(() => {
    refresh();
    const ch = supabase.channel(`player-${playerId}`)
      .on("postgres_changes", { event: "*", schema: "public" }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [playerId]);

  // Re-trigger reveal animation when new night
  useEffect(() => {
    if (assignment) setRevealed(false);
  }, [assignment?.id]);

  if (!player) return <div className="p-8 text-center text-muted-foreground">…</div>;
  if (!game) return <div className="p-8 text-center text-muted-foreground">…</div>;

  const readyLabel: Record<string, string> = {
    setup: `Begin Notte ${game.current_night}`,
    night_active: "Ready for Armory",
    armory: "Ready for Il Tribunale",
    tribunale_missions: "Continue · Open discussion",
    tribunale_discussion: game.current_night === 3 ? "Begin The Great Reveal" : "Open the vote",
    great_reveal: "Open the final vote",
    tribunale_voting: "I've voted",
    tribunale_reveal: "Continue · Tally scores",
    tribunale_leaderboard: "Continue · Pour drinks",
    tribunale_drinks: game.current_night >= 3 ? "End trip · Crown Padrino" : `Advance to Notte ${game.current_night + 1}`,
  };

  // Banished players see a single locked-out view + Il Silenzio. They never
  // see their old role, get no new role, and cannot Giuro.
  if (player.state === "banished") {
    return (
      <div className="min-h-screen px-5 max-w-md mx-auto pb-20">
        <AppHeader subtitle={`${player.name}`} />
        <BanishedCard player={player} />
        <IlSilenzioCard />
        {game.phase === "great_reveal" && (
          <GreatRevealMirror gameId={game.id} allPlayers={allPlayers} />
        )}
        {game.phase !== "setup" && <Leaderboard players={allPlayers} meId={playerId} />}
        {game.phase !== "finished" && readyLabel[game.phase] && (
          <ReadyButton
            gameId={game.id}
            playerId={playerId}
            night={game.current_night}
            phase={game.phase}
            label={readyLabel[game.phase]}
            playerCount={allPlayers.length}
          />
        )}
      </div>
    );
  }

  // Setup phase — dedicated pre-game screen
  if (game.phase === "setup") {
    return (
      <div className="min-h-screen px-5 max-w-md mx-auto pb-20">
        <AppHeader subtitle={`Welcome, ${player.name}`} />
        <div className="mt-8 text-center">
          <div className="font-display text-4xl tracking-[0.3em] uppercase text-gold text-shadow-gold">
            {player.name}
          </div>
          <div className="mt-4 font-serif italic text-muted-foreground text-base">
            La Famiglia è qui — attendere l'inizio
          </div>
          <div className="mt-1 text-xs tracking-widest uppercase text-muted-foreground/60">
            The family is here — waiting to begin
          </div>
        </div>
        <div className="mt-10">
          <Ornament>LA FAMIGLIA · {allPlayers.length} SOULS</Ornament>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {allPlayers
              .slice()
              .sort((a: any, b: any) => {
                const na = Number(a.name), nb = Number(b.name);
                if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
                return String(a.name).localeCompare(String(b.name));
              })
              .map((p: any) => (
                <div
                  key={p.id}
                  className={`border border-[var(--gold)]/20 rounded-sm py-3 px-2 text-center ${p.id === playerId ? "bg-[var(--gold)]/10 border-gold" : "bg-card"}`}
                >
                  <div className="font-serif text-sm text-foreground">{p.name}</div>
                  {p.id === playerId && (
                    <div className="text-[9px] tracking-widest uppercase text-gold mt-1">You</div>
                  )}
                </div>
              ))}
          </div>
        </div>
        <ReadyButton
          gameId={game.id}
          playerId={playerId}
          night={game.current_night}
          phase={game.phase}
          label={readyLabel[game.phase]}
          playerCount={allPlayers.length}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-5 max-w-md mx-auto pb-20">
      <AppHeader subtitle={`Welcome, ${player.name}`} />

      {game.current_night === 3 && (
        <ArmoryBanner name={game.night3_game_name} />
      )}

      {/* Incoming Giuro — must answer before doing anything else */}
      <PendingGiuroAnswer
        giuros={giuros}
        meId={playerId}
        allPlayers={allPlayers}
      />

      {/* Morning Reveal — full-screen victim announcement */}
      {game.morning_revealed && game.morning_revealed_night === game.current_night && (
        <MorningRevealBanner murders={murders} allPlayers={allPlayers} meId={playerId} />
      )}

      {/* Sotto Sospetto — active vote overlay for everyone, available always */}
      {sospetto && !sospetto.resolved_at && (
        <SottoSospettoVoteOverlay
          sospetto={sospetto}
          votes={sospettoVotes}
          meId={playerId}
          me={player}
          allPlayers={allPlayers}
        />
      )}

      {game.phase === "great_reveal" && (
        <GreatRevealMirror gameId={game.id} allPlayers={allPlayers} />
      )}


      {assignment && (game.phase === "night_active" || game.phase === "armory" || game.phase.startsWith("tribunale_")) && (
        <>
          <RoleReveal assignment={assignment} revealed={revealed} onReveal={() => setRevealed(true)} />
          {revealed && assignment.role === "traitor" && !assignment.traitor_list_seen && (
            <TraitorListOverlay
              assignment={assignment}
              traitorAssignments={traitorAssignments}
              allPlayers={allPlayers}
              meId={playerId}
            />
          )}
          {revealed && (assignment.role !== "traitor" || assignment.traitor_list_seen) && (
            <>
              <MissionsCard
                assignment={assignment}
                disabled={!game.phase.startsWith("tribunale_") && game.phase !== "night_active" && game.phase !== "armory"}
              />
              {assignment.role === "traitor" && game.phase === "night_active" && player.state === "active" && (
                <MurderVoteCard
                  gameId={game.id}
                  night={game.current_night}
                  meId={playerId}
                  allPlayers={allPlayers}
                  traitorAssignments={traitorAssignments}
                  murderVotes={murderVotes}
                  armoryRounds={armoryRounds}
                />
              )}
              {/* Sotto Sospetto trigger — any phase, once per day across the group */}
              {!sospetto && player.state !== "banished" && (
                <SottoSospettoTriggerCard
                  gameId={game.id}
                  night={game.current_night}
                  meId={playerId}
                  allPlayers={allPlayers}
                />
              )}
              {sospetto && sospetto.resolved_at && (
                <SottoSospettoResultCard sospetto={sospetto} allPlayers={allPlayers} />
              )}
              {game.phase === "tribunale_discussion" && (
                <GiuroCard
                  gameId={game.id}
                  night={game.current_night}
                  me={player}
                  allPlayers={allPlayers}
                  giuros={giuros}
                />
              )}
              {game.phase === "tribunale_voting" && (
                <VoteCard
                  gameId={game.id}
                  night={game.current_night}
                  voterId={playerId}
                  allPlayers={allPlayers.filter((p) => p.id !== playerId && p.state !== "banished")}
                  myVotes={myVotes}
                  canVote={player.state === "active"}
                />
              )}
              {(game.phase === "tribunale_reveal" || game.phase === "tribunale_leaderboard" || game.phase === "tribunale_drinks") && (
                <>
                  <DeceasedPanel murders={murders} allPlayers={allPlayers} meId={playerId} />
                  <NightSummaryCard assignment={assignment} />
                </>
              )}
            </>
          )}
        </>
      )}

      {game.phase === "finished" && (
        <div className="text-center font-serif italic text-muted-foreground mt-8">
          The reckoning is over. View the final reveal at Il Tribunale.
        </div>
      )}

      {game.phase !== "setup" && <Leaderboard players={allPlayers} meId={playerId} />}

      {game.phase !== "finished" && readyLabel[game.phase] && (
        <ReadyButton
          gameId={game.id}
          playerId={playerId}
          night={game.current_night}
          phase={game.phase}
          label={readyLabel[game.phase]}
          playerCount={allPlayers.length}
        />
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="mt-12 text-center font-serif italic text-muted-foreground px-4">
      {text}
    </div>
  );
}

function RoleReveal({ assignment, revealed, onReveal }: any) {
  const meta = roleMeta(assignment.role as Role);
  if (!revealed) {
    return (
      <button
        onClick={onReveal}
        className="mt-4 w-full bg-card border border-[var(--gold)]/40 rounded-sm py-12 shadow-dramatic animate-glow"
      >
        <div className="text-5xl mb-3">🎭</div>
        <div className="font-display text-sm tracking-[0.4em] uppercase text-gold">Tap to Reveal</div>
        <div className="text-xs font-serif italic text-muted-foreground mt-2">Make sure no one sees…</div>
      </button>
    );
  }
  return (
    <div className="mt-4 bg-gradient-to-b from-card to-[var(--ink)] border border-[var(--gold)]/40 rounded-sm py-8 text-center shadow-dramatic animate-reveal">
      <div className="text-6xl mb-3">{meta.emoji}</div>
      <div className={`font-display text-2xl tracking-[0.3em] uppercase ${meta.color} text-shadow-gold`}>
        {meta.italian}
      </div>
      <div className="text-xs font-serif italic text-muted-foreground mt-2 tracking-widest uppercase">
        {meta.label}
      </div>
    </div>
  );
}

function MissionsCard({ assignment, disabled }: any) {
  async function setState(field: "mission_1_state" | "mission_2_state", value: any) {
    const payload: any = { [field]: value };
    const { error } = await supabase.from("role_assignments").update(payload).eq("id", assignment.id);
    if (error) toast.error(error.message); else toast.success("Logged");
  }
  const mission = (text: string, state: string, field: any) => (
    <div className="bg-card border border-[var(--gold)]/20 rounded-sm p-4">
      <div className="text-[10px] tracking-widest uppercase text-gold/70 mb-2">Missione</div>
      <div className="font-serif text-base leading-snug">{text}</div>
      <div className="flex gap-2 mt-3">
        <button
          disabled={disabled}
          onClick={() => setState(field, "completed")}
          className={`flex-1 text-xs font-display tracking-widest uppercase py-2 rounded-sm border ${state === "completed" ? "bg-gradient-gold text-primary-foreground border-transparent" : "border-[var(--gold)]/30 text-gold"}`}
        >
          ✓ Done
        </button>
        <button
          disabled={disabled}
          onClick={() => setState(field, "failed")}
          className={`flex-1 text-xs font-display tracking-widest uppercase py-2 rounded-sm border ${state === "failed" ? "bg-[var(--blood)]/80 text-foreground border-transparent" : "border-[var(--blood)]/30 text-[var(--blood)]"}`}
        >
          ✗ Failed
        </button>
      </div>
    </div>
  );
  return (
    <div className="mt-6 space-y-3">
      <Ornament>YOUR MISSIONI</Ornament>
      {mission(assignment.mission_1, assignment.mission_1_state, "mission_1_state")}
      {mission(assignment.mission_2, assignment.mission_2_state, "mission_2_state")}
    </div>
  );
}

function SuspectTipCard({ suspectIds, allPlayers }: { suspectIds: string[]; allPlayers: any[] }) {
  const names = suspectIds.map((id) => allPlayers.find((p) => p.id === id)?.name).filter(Boolean);
  return (
    <div className="mt-6 bg-[var(--ink)]/60 border border-gold rounded-sm p-4">
      <div className="text-[10px] tracking-widest uppercase text-gold mb-2">Suspect Tip · Il Capo</div>
      <div className="font-serif text-sm italic mb-3">One of these is a Traditore:</div>
      <div className="space-y-1">
        {names.map((n) => (
          <div key={n} className="font-display tracking-widest text-sm text-foreground">· {n}</div>
        ))}
      </div>
    </div>
  );
}

function ArrestCard({ gameId, night, capoId, allPlayers, existing }: any) {
  const [target, setTarget] = useState<string>("");
  async function arrest() {
    if (!target) return;
    const { error } = await supabase.from("arrests").insert({ game_id: gameId, night, capo_id: capoId, target_id: target });
    if (error) toast.error(error.message); else toast.success("Arresto!");
  }
  if (existing) {
    const name = allPlayers.find((p: any) => p.id === existing.target_id)?.name;
    return (
      <div className="mt-6 bg-card border border-gold rounded-sm p-4">
        <div className="text-[10px] tracking-widest uppercase text-gold mb-2">Your Arrest</div>
        <div className="font-display text-lg text-gold">FERMATI, {name?.toUpperCase()}</div>
        <div className="text-xs font-serif italic text-muted-foreground mt-1">Verdict revealed at Il Tribunale.</div>
      </div>
    );
  }
  return (
    <div className="mt-6 bg-card border border-[var(--gold)]/30 rounded-sm p-4">
      <div className="text-[10px] tracking-widest uppercase text-gold mb-2">Make Arrest · One per night</div>
      <select value={target} onChange={(e) => setTarget(e.target.value)} className="w-full bg-input border border-[var(--gold)]/30 rounded-sm py-2 px-3 font-serif text-sm">
        <option value="">Choose your suspect…</option>
        {allPlayers.filter((p: any) => p.id !== capoId).map((p: any) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <button onClick={arrest} disabled={!target} className="mt-3 w-full font-display tracking-widest text-xs uppercase bg-gradient-gold text-primary-foreground py-3 rounded-sm disabled:opacity-40">
        Fermati!
      </button>
    </div>
  );
}

function AllianceCard({ gameId, night, me, allPlayers, myAlliance, incoming, refresh }: any) {
  const [target, setTarget] = useState<string>("");
  async function request() {
    if (!target) return;
    const { error } = await supabase.from("alliances").insert({ game_id: gameId, night, requester_id: me.id, partner_id: target });
    if (error) toast.error(error.message); else { toast.success("Request sent"); setTarget(""); refresh(); }
  }
  async function respond(status: any) {
    await supabase.from("alliances").update({ status }).eq("id", incoming.id);
    refresh();
  }
  async function breakIt() {
    await supabase.from("alliances").update({ status: "broken" }).eq("id", myAlliance.id);
    refresh();
  }

  if (incoming) {
    const reqName = allPlayers.find((p: any) => p.id === incoming.requester_id)?.name;
    return (
      <div className="mt-6 bg-card border border-gold rounded-sm p-4">
        <div className="text-[10px] tracking-widest uppercase text-gold mb-2">Alliance Request</div>
        <div className="font-serif text-sm mb-3">{reqName} extends a hand.</div>
        <div className="flex gap-2">
          <button onClick={() => respond("accepted")} className="flex-1 font-display tracking-widest text-xs uppercase bg-gradient-gold text-primary-foreground py-2 rounded-sm">Accept</button>
          <button onClick={() => respond("declined")} className="flex-1 font-display tracking-widest text-xs uppercase border border-[var(--blood)]/40 text-[var(--blood)] py-2 rounded-sm">Decline</button>
        </div>
      </div>
    );
  }
  if (myAlliance && myAlliance.status === "accepted") {
    const partner = allPlayers.find((p: any) => p.id === myAlliance.partner_id)?.name;
    return (
      <div className="mt-6 bg-card border border-gold rounded-sm p-4">
        <div className="text-[10px] tracking-widest uppercase text-gold mb-2">Your Alliance</div>
        <div className="font-display text-lg text-gold">{partner?.toUpperCase()}</div>
        <button onClick={breakIt} className="mt-2 text-[10px] tracking-widest uppercase text-[var(--blood)] underline">Break Alliance</button>
      </div>
    );
  }
  if (myAlliance && myAlliance.status === "pending") {
    const partner = allPlayers.find((p: any) => p.id === myAlliance.partner_id)?.name;
    return (
      <div className="mt-6 bg-card border border-[var(--gold)]/30 rounded-sm p-4">
        <div className="text-[10px] tracking-widest uppercase text-gold mb-2">Pending Alliance</div>
        <div className="font-serif text-sm italic text-muted-foreground">Awaiting {partner}'s answer…</div>
      </div>
    );
  }
  return (
    <div className="mt-6 bg-card border border-[var(--gold)]/30 rounded-sm p-4">
      <div className="text-[10px] tracking-widest uppercase text-gold mb-2">Propose Alliance · One per night</div>
      <select value={target} onChange={(e) => setTarget(e.target.value)} className="w-full bg-input border border-[var(--gold)]/30 rounded-sm py-2 px-3 font-serif text-sm">
        <option value="">Choose a partner…</option>
        {allPlayers.filter((p: any) => p.id !== me.id).map((p: any) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <button onClick={request} disabled={!target} className="mt-3 w-full font-display tracking-widest text-xs uppercase bg-gradient-gold text-primary-foreground py-3 rounded-sm disabled:opacity-40">
        Extend Hand
      </button>
    </div>
  );
}

function VoteCard({ gameId, night, voterId, allPlayers, myVotes, canVote = true }: any) {
  const [selected, setSelected] = useState<string[]>(myVotes.map((v: any) => v.target_id));
  const submitted = myVotes.length > 0;

  function toggle(id: string) {
    if (submitted || !canVote) return;
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : s.length < 2 ? [...s, id] : s);
  }
  async function submit() {
    if (selected.length === 0 || !canVote) return;
    const rows = selected.map((id) => ({ game_id: gameId, night, voter_id: voterId, target_id: id }));
    const { error } = await supabase.from("votes").insert(rows);
    if (error) toast.error(error.message); else toast.success("Vote sealed");
  }

  return (
    <div className="mt-6 bg-card border border-gold rounded-sm p-4 animate-glow">
      <div className="text-[10px] tracking-widest uppercase text-gold mb-2">Il Voto · Choose up to 2 traitors</div>
      {!canVote && (
        <div className="text-center text-xs font-display tracking-widest uppercase text-[var(--blood)] py-2">
          🕯 Sei un Fantasma — you cannot vote, but you may watch.
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 mt-3">
        {allPlayers.map((p: any) => {
          const isSel = selected.includes(p.id);
          return (
            <button
              key={p.id}
              disabled={submitted || !canVote}
              onClick={() => toggle(p.id)}
              className={`py-2 px-2 rounded-sm border text-sm font-serif transition ${isSel ? "bg-gradient-gold text-primary-foreground border-transparent" : "border-[var(--gold)]/30 hover:bg-[var(--gold)]/10"} ${!canVote ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              {p.name}
            </button>
          );
        })}
      </div>
      {canVote && !submitted ? (
        <button onClick={submit} disabled={selected.length === 0} className="mt-4 w-full font-display tracking-widest text-xs uppercase bg-gradient-gold text-primary-foreground py-3 rounded-sm disabled:opacity-40">
          Seal My Vote
        </button>
      ) : submitted ? (
        <div className="mt-4 text-center text-xs font-serif italic text-gold">Your vote is sealed. Wait for the reveal…</div>
      ) : null}
    </div>
  );
}

function NightSummaryCard({ assignment }: any) {
  return (
    <div className="mt-6 bg-card border border-gold rounded-sm p-4 text-center">
      <div className="text-[10px] tracking-widest uppercase text-gold mb-2">Notte Risultato</div>
      <div className="font-display text-3xl text-shimmer">+{assignment.night_points} pt</div>
    </div>
  );
}

function MurderVoteCard({
  gameId, night, meId, allPlayers, traitorAssignments, murderVotes, armoryRounds,
}: {
  gameId: string;
  night: number;
  meId: string;
  allPlayers: any[];
  traitorAssignments: { player_id: string; role: string }[];
  murderVotes: any[];
  armoryRounds: any[];
}) {
  // Immune = anyone on a winning Armory team this night.
  const immuneIds = new Set<string>();
  armoryRounds.filter((r: any) => r.is_winner).forEach((r: any) => {
    immuneIds.add(r.player_a_id); immuneIds.add(r.player_b_id);
  });
  const traitorIds = new Set(traitorAssignments.map((t) => t.player_id));
  const activeTraitorIds = traitorAssignments
    .map((t) => allPlayers.find((p) => p.id === t.player_id))
    .filter((p) => p && p.state === "active")
    .map((p) => p!.id);

  // Eligible victims: active, non-traitor, non-immune
  const candidates = allPlayers.filter(
    (p) => p.state === "active" && !traitorIds.has(p.id) && !immuneIds.has(p.id),
  );

  const myVote = murderVotes.find((v: any) => v.traitor_id === meId);
  const [pick, setPick] = useState<string>(myVote?.victim_id || "");

  async function submit() {
    if (!pick || myVote) return;
    const { error } = await supabase.from("murder_votes").insert({
      game_id: gameId, night, traitor_id: meId, victim_id: pick,
    });
    if (error) toast.error(error.message); else toast.success("Vote sealed.");
  }

  const submittedCount = murderVotes.filter((v: any) => activeTraitorIds.includes(v.traitor_id)).length;

  return (
    <div className="mt-3 bg-[var(--blood)]/15 border border-[var(--blood)] rounded-sm p-4">
      <div className="text-[10px] tracking-widest uppercase text-[var(--blood)] mb-1">
        🩸 Murder Vote · Unanimous to kill
      </div>
      <div className="text-[10px] font-serif italic text-muted-foreground mb-3">
        All active Traditori must pick the same victim. Immune players (Armory winners) are excluded.
        Result is hidden until the Morning Reveal.
      </div>
      <div className="grid grid-cols-2 gap-2">
        {candidates.map((p: any) => {
          const sel = pick === p.id;
          return (
            <button
              key={p.id}
              disabled={!!myVote}
              onClick={() => setPick(p.id)}
              className={`py-2 px-2 rounded-sm border text-sm font-serif transition ${sel ? "bg-[var(--blood)] text-foreground border-transparent" : "border-[var(--blood)]/30 hover:bg-[var(--blood)]/10"} ${myVote ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              {p.name}
            </button>
          );
        })}
      </div>
      {!myVote ? (
        <button onClick={submit} disabled={!pick} className="mt-3 w-full font-display tracking-widest text-xs uppercase bg-[var(--blood)] text-foreground py-3 rounded-sm disabled:opacity-40">
          Seal Murder Vote
        </button>
      ) : (
        <div className="mt-3 text-center text-xs font-display tracking-widest text-[var(--blood)]">
          ✓ Your vote sealed · {submittedCount}/{activeTraitorIds.length} Traditori voted
        </div>
      )}
      {immuneIds.size > 0 && (
        <div className="mt-2 text-[10px] tracking-widest uppercase text-gold/70 text-center">
          Immune tonight: {[...immuneIds].map((id) => allPlayers.find((p) => p.id === id)?.name).filter(Boolean).join(" · ")}
        </div>
      )}
    </div>
  );
}

function MorningRevealBanner({ murders, allPlayers, meId }: { murders: any[]; allPlayers: any[]; meId: string }) {
  const victim = murders[0] ? allPlayers.find((p) => p.id === murders[0].victim_id) : null;
  if (!victim) {
    return (
      <div className="mt-4 bg-card border border-gold rounded-sm p-5 text-center">
        <div className="text-3xl mb-2">🌅</div>
        <div className="font-display text-sm tracking-[0.4em] uppercase text-gold">Morning Reveal</div>
        <div className="mt-2 font-serif italic text-muted-foreground">
          The Traditori could not agree. No one was murdered tonight.
        </div>
      </div>
    );
  }
  const isMe = victim.id === meId;
  return (
    <div className="mt-4 bg-gradient-to-b from-[var(--blood)]/30 to-[var(--ink)] border border-[var(--blood)] rounded-sm p-6 text-center shadow-dramatic animate-reveal">
      <div className="text-4xl mb-2">†</div>
      <div className="font-display text-xs tracking-[0.4em] uppercase text-[var(--blood)] mb-2">
        Morning Reveal · Notte scorsa
      </div>
      <div className="font-display text-3xl tracking-[0.3em] uppercase text-[var(--blood)] text-shadow-gold">
        {victim.name?.toUpperCase()}{isMe ? " (YOU)" : ""}
      </div>
      <div className="mt-3 text-xs font-serif italic text-muted-foreground">
        Sleeps with the fishes. They walk among us still — as a Fantasma.
      </div>
    </div>
  );
}

function SottoSospettoTriggerCard({
  gameId, night, meId, allPlayers,
}: { gameId: string; night: number; meId: string; allPlayers: any[] }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [behaviour, setBehaviour] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const targetable = allPlayers.filter((p) => p.id !== meId);

  async function submit() {
    const b = behaviour.trim();
    if (!target || !b) return;
    setSubmitting(true);
    const { error } = await supabase.from("sotto_sospetto").insert({
      game_id: gameId, night, caller_id: meId, accused_id: target, behaviour: b,
    });
    setSubmitting(false);
    if (error) toast.error(error.code === "23505" ? "Sotto Sospetto already used today." : error.message);
    else { setOpen(false); setTarget(""); setBehaviour(""); toast.success("Sotto Sospetto called."); }
  }

  return (
    <div className="mt-3 bg-card border border-gold rounded-sm p-4">
      <div className="text-[10px] tracking-widest uppercase text-gold mb-1">
        🕵 Sotto Sospetto · Once per day
      </div>
      <div className="text-[10px] font-serif italic text-muted-foreground mb-3">
        Call out a suspicious player. Everyone votes Guilty / Not Guilty.
        Guilty → accused finishes their vessel. Not Guilty / tie → you finish yours.
      </div>
      {!open ? (
        <button onClick={() => setOpen(true)} className="w-full font-display tracking-widest text-xs uppercase border border-gold text-gold py-3 rounded-sm">
          Invoke Sotto Sospetto
        </button>
      ) : (
        <div className="space-y-3">
          <select value={target} onChange={(e) => setTarget(e.target.value)}
            className="w-full bg-input border border-[var(--gold)]/30 rounded-sm py-2 px-3 font-serif text-sm">
            <option value="">Choose the accused…</option>
            {targetable.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
          <textarea value={behaviour} onChange={(e) => setBehaviour(e.target.value)}
            placeholder="Describe the suspicious behaviour…" rows={3} maxLength={300}
            className="w-full bg-input border border-[var(--gold)]/30 rounded-sm py-2 px-3 font-serif text-sm" />
          <div className="flex gap-2">
            <button onClick={submit} disabled={!target || !behaviour.trim() || submitting}
              className="flex-1 font-display tracking-widest text-xs uppercase bg-gradient-gold text-primary-foreground py-3 rounded-sm disabled:opacity-40">
              {submitting ? "…" : "Accuse"}
            </button>
            <button onClick={() => setOpen(false)}
              className="flex-1 font-display tracking-widest text-xs uppercase border border-[var(--gold)]/30 text-gold py-3 rounded-sm">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SottoSospettoVoteOverlay({
  sospetto, votes, meId, me, allPlayers,
}: { sospetto: any; votes: any[]; meId: string; me: any; allPlayers: any[] }) {
  const caller = allPlayers.find((p) => p.id === sospetto.caller_id);
  const accused = allPlayers.find((p) => p.id === sospetto.accused_id);
  const eligible = allPlayers.filter((p) => p.state !== "banished" && p.id !== sospetto.caller_id);
  const myVote = votes.find((v) => v.voter_id === meId);
  const canVote = me.state !== "banished" && meId !== sospetto.caller_id;

  async function vote(value: "guilty" | "not_guilty") {
    if (!canVote || myVote) return;
    const { error } = await supabase.from("sotto_sospetto_votes").insert({
      sospetto_id: sospetto.id, voter_id: meId, vote: value,
    });
    if (error) toast.error(error.message);
  }

  // Auto-resolve when all eligible voted (any client may race; constraint protects)
  useEffect(() => {
    (async () => {
      if (sospetto.resolved_at) return;
      const voterIds = new Set(votes.map((v: any) => v.voter_id));
      const allVoted = eligible.every((p) => voterIds.has(p.id));
      if (!allVoted) return;
      const guilty = votes.filter((v: any) => v.vote === "guilty").length;
      const notGuilty = votes.filter((v: any) => v.vote === "not_guilty").length;
      const result = guilty > notGuilty ? "guilty" : "not_guilty";
      await supabase
        .from("sotto_sospetto")
        .update({ result, resolved_at: new Date().toISOString() } as any)
        .eq("id", sospetto.id)
        .is("resolved_at", null);
    })();
  }, [votes.length, eligible.length, sospetto.id, sospetto.resolved_at]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center px-5">
      <div className="w-full max-w-md bg-gradient-to-b from-card to-[var(--ink)] border border-gold rounded-sm p-6 shadow-dramatic animate-reveal">
        <div className="text-center text-4xl mb-2">🕵</div>
        <div className="text-center font-display text-sm tracking-[0.4em] uppercase text-gold mb-3">
          Sotto Sospetto
        </div>
        <div className="text-center text-xs font-serif italic text-muted-foreground mb-3">
          {caller?.name} accuses <span className="font-display text-[var(--blood)] tracking-widest">{accused?.name?.toUpperCase()}</span>
        </div>
        <div className="bg-card border border-[var(--gold)]/30 rounded-sm p-3 font-serif text-sm text-foreground text-center mb-4">
          "{sospetto.behaviour}"
        </div>
        {meId === sospetto.caller_id ? (
          <div className="text-center text-xs font-serif italic text-muted-foreground">
            Awaiting the family's verdict…
          </div>
        ) : !canVote ? (
          <div className="text-center text-xs font-serif italic text-muted-foreground">
            Banished — you may not vote.
          </div>
        ) : myVote ? (
          <div className="text-center text-xs font-display tracking-widest uppercase text-gold">
            ✓ Voted: {myVote.vote === "guilty" ? "Colpevole" : "Non colpevole"}
          </div>
        ) : (
          <div className="flex gap-3">
            <button onClick={() => vote("guilty")}
              className="flex-1 font-display tracking-widest text-sm uppercase bg-[var(--blood)] text-foreground py-4 rounded-sm">
              Colpevole
            </button>
            <button onClick={() => vote("not_guilty")}
              className="flex-1 font-display tracking-widest text-sm uppercase border border-gold text-gold py-4 rounded-sm">
              Non colpevole
            </button>
          </div>
        )}
        <div className="mt-3 text-center text-[10px] tracking-widest uppercase text-muted-foreground/70">
          {votes.length}/{eligible.length} voted
        </div>
      </div>
    </div>
  );
}

function SottoSospettoResultCard({ sospetto, allPlayers }: { sospetto: any; allPlayers: any[] }) {
  const caller = allPlayers.find((p) => p.id === sospetto.caller_id);
  const accused = allPlayers.find((p) => p.id === sospetto.accused_id);
  const guilty = sospetto.result === "guilty";
  const loser = guilty ? accused : caller;
  return (
    <div className="mt-3 bg-card border border-gold rounded-sm p-4 text-center">
      <div className="text-[10px] tracking-widest uppercase text-gold mb-1">🕵 Sotto Sospetto · Verdetto</div>
      <div className="font-serif text-sm mb-1">{caller?.name} → {accused?.name}</div>
      <div className="font-display text-sm tracking-widest uppercase text-[var(--blood)]">
        {guilty ? "COLPEVOLE" : "NON COLPEVOLE"} · {loser?.name} finishes their vessel
      </div>
    </div>
  );
}

function DeceasedPanel({ murders, allPlayers, meId }: { murders: any[]; allPlayers: any[]; meId: string }) {
  if (!murders || murders.length === 0) return null;
  const playerById = Object.fromEntries(allPlayers.map((p) => [p.id, p]));
  return (
    <div className="mt-6 bg-[var(--blood)]/15 border border-[var(--blood)] rounded-sm p-4">
      <div className="text-[10px] tracking-widest uppercase text-[var(--blood)] mb-3 text-center">
        † The Deceased Tonight †
      </div>
      <div className="space-y-2">
        {murders.map((m) => {
          const victim = playerById[m.victim_id];
          const isMe = m.victim_id === meId;
          return (
            <div
              key={m.id}
              className={`flex justify-between items-center font-serif text-sm border-b border-[var(--blood)]/20 py-1 ${isMe ? "text-[var(--blood)] font-bold" : ""}`}
            >
              <span>{victim?.name}{isMe ? " (you)" : ""}</span>
              <span className="text-[var(--blood)]">🥃 {m.fingers} fingers</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-center text-[10px] tracking-widest uppercase text-muted-foreground italic">
        Pour. Drink. Carry on.
      </div>
    </div>
  );
}

function Leaderboard({ players, meId }: { players: any[]; meId: string }) {
  const sorted = [...players].sort((a, b) => b.total_points - a.total_points);
  return (
    <div className="mt-10">
      <Ornament>CLASSIFICA · TRIP</Ornament>
      <div className="mt-4 space-y-1">
        {sorted.map((p, i) => (
          <div key={p.id} className={`flex justify-between items-center py-2 px-3 rounded-sm ${p.id === meId ? "bg-[var(--gold)]/15 border border-gold" : "border-b border-[var(--gold)]/10"}`}>
            <div className="flex items-center gap-3">
              <span className="font-display text-gold/70 text-xs w-5">{String(i + 1).padStart(2, "0")}</span>
              <span className="font-serif">
                {p.banished && <span className="mr-1">🔒</span>}
                {p.name}
                {p.banished && <span className="ml-2 text-[10px] tracking-widest uppercase text-[var(--blood)]/80">Bandito</span>}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-[9px] tracking-widest uppercase ${p.giuro_used ? "text-[var(--blood)]/70" : "text-gold/70"}`}>
                Giuro · {p.giuro_used ? "Used" : "Avail."}
              </span>
              <span className="font-display text-gold text-sm">{p.total_points}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArmoryBanner({ name }: { name: string }) {
  return (
    <div className="mt-4 bg-card border border-gold rounded-sm p-4 text-center">
      <div className="text-[10px] tracking-[0.4em] uppercase text-gold mb-1">
        Night 3 · To Be Confirmed
      </div>
      <div className="font-display text-xl text-shimmer">{name || "TBC — To be decided by the group."}</div>
      <div className="mt-2 text-[10px] tracking-widest uppercase text-muted-foreground/80 italic">
        Editable from the lobby before Night 3 begins.
      </div>
    </div>
  );
}

function TraitorListOverlay({
  assignment,
  traitorAssignments,
  allPlayers,
  meId,
}: {
  assignment: any;
  traitorAssignments: { player_id: string; role: string }[];
  allPlayers: any[];
  meId: string;
}) {
  const others = traitorAssignments
    .filter((t) => t.player_id !== meId)
    .map((t) => allPlayers.find((p) => p.id === t.player_id)?.name)
    .filter(Boolean);

  async function dismiss() {
    const { error } = await supabase
      .from("role_assignments")
      .update({ traitor_list_seen: true } as any)
      .eq("id", assignment.id);
    if (error) toast.error(error.message);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center px-5">
      <div className="w-full max-w-md bg-gradient-to-b from-card to-[var(--ink)] border border-[var(--blood)] rounded-sm p-6 shadow-dramatic animate-reveal">
        <div className="text-center text-4xl mb-2">🐍</div>
        <div className="text-center font-display text-sm tracking-[0.4em] uppercase text-[var(--blood)] mb-4">
          La Famiglia Segreta
        </div>
        <div className="text-center font-serif italic text-muted-foreground mb-4 text-sm">
          Your fellow Il Traditori for the whole trip:
        </div>
        {others.length === 0 ? (
          <div className="text-center font-serif italic text-muted-foreground">
            You are the lone snake tonight.
          </div>
        ) : (
          <div className="space-y-1">
            {others.map((n) => (
              <div
                key={n as string}
                className="text-center font-display tracking-[0.3em] uppercase text-xl text-[var(--blood)] py-2 border-b border-[var(--blood)]/20"
              >
                {n as string}
              </div>
            ))}
          </div>
        )}
        <div className="mt-5 bg-[var(--blood)]/20 border border-[var(--blood)]/50 rounded-sm p-3 text-center">
          <div className="font-display text-xs tracking-widest uppercase text-[var(--blood)]">
            📸 Screenshot this
          </div>
          <div className="text-xs font-serif italic text-muted-foreground mt-1">
            You will not see this list again.
          </div>
        </div>
        <div className="mt-3 bg-card border border-gold rounded-sm p-3 text-center">
          <div className="font-display text-[10px] tracking-widest uppercase text-gold">
            💬 WhatsApp Group
          </div>
          <div className="text-xs font-serif italic text-muted-foreground mt-1">
            Set up your traitors-only WhatsApp group with the names above
            <span className="not-italic"> </span>before tapping confirm.
          </div>
        </div>
        <button
          onClick={dismiss}
          className="mt-5 w-full font-display tracking-widest text-sm uppercase bg-gradient-gold text-primary-foreground py-4 rounded-sm shadow-gold"
        >
          I have memorised them
        </button>
      </div>
    </div>
  );
}

function GiuroCard({
  gameId,
  night,
  me,
  allPlayers,
  giuros,
}: {
  gameId: string;
  night: number;
  me: any;
  allPlayers: any[];
  giuros: any[];
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const myGiuros = giuros.filter((g) => g.asker_id === me.id);
  const used = me.giuro_used || myGiuros.length > 0;
  // Banished players are bound by Il Silenzio — can neither swear nor be targeted.
  const targetable = allPlayers.filter((p) => p.id !== me.id && !p.banished);

  async function submit() {
    const q = question.trim();
    if (!target || !q) return;
    setSubmitting(true);
    const { error: insErr } = await supabase.from("giuros").insert({
      game_id: gameId,
      night,
      asker_id: me.id,
      target_id: target,
      question: q,
    });
    if (insErr) {
      setSubmitting(false);
      toast.error(insErr.message);
      return;
    }
    await supabase.from("players").update({ giuro_used: true } as any).eq("id", me.id);
    setSubmitting(false);
    setOpen(false);
    setTarget("");
    setQuestion("");
    toast.success("Giuro sworn. Await the answer.");
  }

  return (
    <div className="mt-6 bg-card border border-gold rounded-sm p-4">
      <div className="text-[10px] tracking-widest uppercase text-gold mb-2">
        Giuro sulla Famiglia · One use per trip
      </div>
      <div className="font-serif text-sm italic text-muted-foreground mb-3">
        Swear on the family and force any player to answer one yes/no question publicly.
      </div>
      {used ? (
        <div className="text-center text-xs font-display tracking-widest uppercase text-[var(--blood)] py-2">
          You have used your Giuro
        </div>
      ) : !open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full font-display tracking-widest text-xs uppercase bg-gradient-gold text-primary-foreground py-3 rounded-sm shadow-gold"
        >
          ⚖ Giuro sulla Famiglia
        </button>
      ) : (
        <div className="space-y-3">
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="w-full bg-input border border-[var(--gold)]/30 rounded-sm py-2 px-3 font-serif text-sm"
          >
            <option value="">Choose your target…</option>
            {targetable.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Yes / no question only…"
            rows={3}
            maxLength={200}
            className="w-full bg-input border border-[var(--gold)]/30 rounded-sm py-2 px-3 font-serif text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={!target || !question.trim() || submitting}
              className="flex-1 font-display tracking-widest text-xs uppercase bg-gradient-gold text-primary-foreground py-3 rounded-sm disabled:opacity-40"
            >
              {submitting ? "…" : "Swear it"}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="flex-1 font-display tracking-widest text-xs uppercase border border-[var(--gold)]/30 text-gold py-3 rounded-sm"
            >
              Cancel
            </button>
          </div>
          <div className="text-[10px] tracking-widest uppercase text-muted-foreground/70 text-center">
            The answer will be shown to everyone at Il Tribunale.
          </div>
        </div>
      )}
    </div>
  );
}

function PendingGiuroAnswer({
  giuros,
  meId,
  allPlayers,
}: {
  giuros: any[];
  meId: string;
  allPlayers: any[];
}) {
  const pending = giuros.find((g) => g.target_id === meId && !g.answer);
  if (!pending) return null;
  const askerName = allPlayers.find((p) => p.id === pending.asker_id)?.name || "Someone";

  async function answer(value: "Sì" | "No") {
    const { error } = await supabase
      .from("giuros")
      .update({ answer: value, answered_at: new Date().toISOString() } as any)
      .eq("id", pending.id);
    if (error) toast.error(error.message);
    else toast.success(`Answered: ${value}`);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center px-5">
      <div className="w-full max-w-md bg-gradient-to-b from-card to-[var(--ink)] border border-gold rounded-sm p-6 shadow-dramatic animate-reveal">
        <div className="text-center text-4xl mb-2">⚖</div>
        <div className="text-center font-display text-sm tracking-[0.4em] uppercase text-gold mb-3">
          Giuro sulla Famiglia
        </div>
        <div className="text-center text-xs font-serif italic text-muted-foreground mb-4">
          {askerName} demands an answer on the family.
        </div>
        <div className="bg-card border border-[var(--gold)]/30 rounded-sm p-4 font-serif text-base text-foreground text-center">
          {pending.question}
        </div>
        <div className="mt-5 flex gap-3">
          <button
            onClick={() => answer("Sì")}
            className="flex-1 font-display tracking-widest text-sm uppercase bg-gradient-gold text-primary-foreground py-4 rounded-sm shadow-gold"
          >
            Sì
          </button>
          <button
            onClick={() => answer("No")}
            className="flex-1 font-display tracking-widest text-sm uppercase border border-[var(--blood)] text-[var(--blood)] py-4 rounded-sm"
          >
            No
          </button>
        </div>
        <div className="mt-3 text-center text-[10px] tracking-widest uppercase text-muted-foreground/70">
          Your answer will be shown to all players.
        </div>
      </div>
    </div>
  );
}
function BanishedCard({ player }: { player: any }) {
  return (
    <div className="mt-6 bg-gradient-to-b from-[var(--blood)]/20 to-[var(--ink)] border border-[var(--blood)] rounded-sm p-8 text-center shadow-dramatic animate-reveal">
      <div className="text-6xl mb-3">🔒</div>
      <div className="font-display text-3xl tracking-[0.3em] uppercase text-[var(--blood)] text-shadow-gold">
        Sei stato bandito
      </div>
      <div className="mt-3 text-sm font-serif italic text-muted-foreground">
        You have been banished from La Famiglia
        {player.banished_night ? ` on Notte ${player.banished_night}` : ""}.
      </div>
      <div className="mt-4 text-[10px] tracking-widest uppercase text-muted-foreground/70">
        Your role is sealed — none shall know until The Great Reveal.
      </div>
    </div>
  );
}

function IlSilenzioCard() {
  return (
    <div className="mt-4 bg-card border border-gold rounded-sm p-5">
      <div className="text-center text-[10px] tracking-[0.4em] uppercase text-gold mb-2">
        ⚖ Il Silenzio
      </div>
      <div className="font-serif italic text-sm leading-relaxed text-foreground/90 text-center">
        A banished soul may lie, deflect, or stay silent — but must never
        confirm their true role. Breaking Il Silenzio breaks the family.
      </div>
      <div className="mt-3 text-[10px] tracking-widest uppercase text-muted-foreground/70 text-center">
        Your Giuro sulla Famiglia is sealed shut.
      </div>
    </div>
  );
}

function GreatRevealMirror({ gameId, allPlayers }: { gameId: string; allPlayers: any[] }) {
  const [banished, setBanished] = useState<any[]>([]);
  const [roles, setRoles] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    async function refresh() {
      const order = await getBanishedOrder(gameId);
      if (mounted) setBanished(order);
      // Fetch revealed roles only for already-revealed players
      const revealedIds = order.filter((p: any) => p.banished_revealed).map((p: any) => p.id);
      if (revealedIds.length > 0) {
        const { data } = await supabase
          .from("role_assignments")
          .select("player_id, role, night")
          .eq("game_id", gameId)
          .in("player_id", revealedIds);
        const map: Record<string, string> = {};
        const byPlayer: Record<string, any[]> = {};
        (data || []).forEach((r: any) => {
          (byPlayer[r.player_id] ||= []).push(r);
        });
        for (const p of order) {
          if (!p.banished_revealed) continue;
          const rs = byPlayer[p.id] || [];
          const ra = rs.find((r) => r.night === p.banished_night);
          if (ra) map[p.id] = ra.role;
        }
        if (mounted) setRoles(map);
      }
    }
    refresh();
    const ch = supabase
      .channel(`great-reveal-mirror-${gameId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, () => refresh())
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [gameId]);

  if (banished.length === 0) {
    return (
      <div className="mt-6 bg-card border border-gold rounded-sm p-6 text-center">
        <div className="font-display text-sm tracking-[0.4em] uppercase text-gold">The Great Reveal</div>
        <div className="mt-2 font-serif italic text-muted-foreground text-sm">
          No souls were banished. La Famiglia stands whole.
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 bg-gradient-to-b from-card to-[var(--ink)] border border-gold rounded-sm p-5 shadow-dramatic">
      <div className="text-center font-display text-sm tracking-[0.4em] uppercase text-gold mb-4">
        ⚜ The Great Reveal ⚜
      </div>
      <div className="space-y-2">
        {banished.map((p) => {
          const revealed = p.banished_revealed;
          const role = roles[p.id];
          return (
            <div
              key={p.id}
              className={`flex justify-between items-center border-b border-[var(--gold)]/15 py-2 px-2 ${revealed ? "animate-reveal" : "opacity-50"}`}
            >
              <span className="font-serif">{p.name}</span>
              {revealed && role ? (
                <span className={`font-display tracking-widest text-sm uppercase ${roleColor(role)}`}>
                  {roleEmoji(role)} {roleItalian(role)}
                </span>
              ) : (
                <span className="font-display text-xs tracking-widest uppercase text-muted-foreground">
                  🔒 Sealed
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-center text-[10px] tracking-widest uppercase text-muted-foreground/70 italic">
        Watch the shared screen — points are applied as each soul is unmasked.
      </div>
    </div>
  );
}

function roleColor(r: string) {
  if (r === "traitor") return "text-[var(--blood)]";
  return "text-muted-foreground";
}
function roleEmoji(r: string) {
  if (r === "traitor") return "🐍";
  return "👤";
}
function roleItalian(r: string) {
  if (r === "traitor") return "Il Traditore";
  return "Il Fideli";
}
