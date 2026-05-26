import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Ornament } from "@/components/Ornament";
import { RoleBadge, roleMeta } from "@/components/RoleBadge";
import type { Role } from "@/lib/game";
import { recordMurder, abandonMurder } from "@/lib/game";
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
  const [suspectTip, setSuspectTip] = useState<string[] | null>(null);
  const [myArrest, setMyArrest] = useState<any>(null);
  const [myAlliance, setMyAlliance] = useState<any>(null);
  const [incomingAlliance, setIncomingAlliance] = useState<any>(null);
  const [myVotes, setMyVotes] = useState<any[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [murders, setMurders] = useState<any[]>([]);
  const [traitorAssignments, setTraitorAssignments] = useState<any[]>([]);
  const [giuros, setGiuros] = useState<any[]>([]);

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
      const { data: tip } = await supabase.from("suspect_tips").select("*").eq("game_id", p.game_id).eq("night", g.current_night).eq("capo_id", playerId).maybeSingle();
      setSuspectTip(tip?.suspect_ids ?? null);
      const { data: ar } = await supabase.from("arrests").select("*").eq("game_id", p.game_id).eq("night", g.current_night).eq("capo_id", playerId).maybeSingle();
      setMyArrest(ar);
      const { data: outAl } = await supabase.from("alliances").select("*").eq("game_id", p.game_id).eq("night", g.current_night).eq("requester_id", playerId).order("created_at", { ascending: false }).limit(1);
      const { data: inAl } = await supabase.from("alliances").select("*").eq("game_id", p.game_id).eq("night", g.current_night).eq("partner_id", playerId).eq("status", "pending").order("created_at", { ascending: false }).limit(1);
      setMyAlliance(outAl?.[0] || null);
      setIncomingAlliance(inAl?.[0] || null);
      const { data: v } = await supabase.from("votes").select("*").eq("game_id", p.game_id).eq("night", g.current_night).eq("voter_id", playerId);
      setMyVotes(v || []);
      const { data: m } = await supabase.from("murders").select("*").eq("game_id", p.game_id).eq("night", g.current_night);
      setMurders(m || []);
      const { data: gq } = await supabase.from("giuros").select("*").eq("game_id", p.game_id).order("created_at", { ascending: false });
      setGiuros(gq || []);
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
    night_active: "Ready for Il Tribunale",
    tribunale_missions: "Continue · Reveal arrests",
    tribunale_arrests: "Continue · Open discussion",
    tribunale_discussion: game.current_night === 3 ? "Begin The Great Reveal" : "Open the vote",
    great_reveal: "Open the final vote",
    tribunale_voting: "I've voted",
    tribunale_reveal: "Continue · Tally scores",
    tribunale_leaderboard: "Continue · Pour drinks",
    tribunale_drinks: game.current_night >= 3 ? "End trip · Crown Padrino" : `Advance to Notte ${game.current_night + 1}`,
  };

  // Banished players see a single locked-out view + Il Silenzio. They never
  // see their old role, get no new role, and cannot Giuro.
  if (player.banished) {
    return (
      <div className="min-h-screen px-5 max-w-md mx-auto pb-20">
        <AppHeader subtitle={`${player.name}`} />
        <BanishedCard player={player} />
        <IlSilenzioCard />
        {game.phase === "great_reveal" && (
          <GreatRevealMirror gameId={game.id} allPlayers={allPlayers} />
        )}
        <Leaderboard players={allPlayers} meId={playerId} />
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

      {game.phase === "great_reveal" && (
        <GreatRevealMirror gameId={game.id} allPlayers={allPlayers} />
      )}

      {game.phase === "setup" && (
        <EmptyState text={`Notte ${game.current_night} has not yet begun. Tap ready when the family is ready to start.`} />
      )}

      {assignment && (game.phase === "night_active" || game.phase.startsWith("tribunale_")) && (
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
                disabled={!game.phase.startsWith("tribunale_") && game.phase !== "night_active"}
              />
              {assignment.role === "traitor" && assignment.bonus_mission && game.phase === "night_active" && (
                <MurderMissionCard
                  assignment={assignment}
                  gameId={game.id}
                  night={game.current_night}
                  allPlayers={allPlayers}
                />
              )}
              {assignment.role === "capo" && suspectTip && (
                <SuspectTipCard suspectIds={suspectTip} allPlayers={allPlayers} />
              )}
              {assignment.role === "capo" && game.phase === "night_active" && (
                <ArrestCard
                  gameId={game.id}
                  night={game.current_night}
                  capoId={playerId}
                  allPlayers={allPlayers}
                  existing={myArrest}
                />
              )}
              {game.phase === "night_active" && (
                <AllianceCard
                  gameId={game.id}
                  night={game.current_night}
                  me={player}
                  allPlayers={allPlayers}
                  myAlliance={myAlliance}
                  incoming={incomingAlliance}
                  refresh={refresh}
                />
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
                  allPlayers={allPlayers.filter((p) => p.id !== playerId)}
                  myVotes={myVotes}
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

      <Leaderboard players={allPlayers} meId={playerId} />

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

function VoteCard({ gameId, night, voterId, allPlayers, myVotes }: any) {
  const [selected, setSelected] = useState<string[]>(myVotes.map((v: any) => v.target_id));
  const submitted = myVotes.length > 0;

  function toggle(id: string) {
    if (submitted) return;
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : s.length < 2 ? [...s, id] : s);
  }
  async function submit() {
    if (selected.length === 0) return;
    const rows = selected.map((id) => ({ game_id: gameId, night, voter_id: voterId, target_id: id }));
    const { error } = await supabase.from("votes").insert(rows);
    if (error) toast.error(error.message); else toast.success("Vote sealed");
  }

  return (
    <div className="mt-6 bg-card border border-gold rounded-sm p-4 animate-glow">
      <div className="text-[10px] tracking-widest uppercase text-gold mb-2">Il Voto · Choose up to 2 traitors</div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        {allPlayers.map((p: any) => {
          const isSel = selected.includes(p.id);
          return (
            <button
              key={p.id}
              disabled={submitted}
              onClick={() => toggle(p.id)}
              className={`py-2 px-2 rounded-sm border text-sm font-serif transition ${isSel ? "bg-gradient-gold text-primary-foreground border-transparent" : "border-[var(--gold)]/30 hover:bg-[var(--gold)]/10"}`}
            >
              {p.name}
            </button>
          );
        })}
      </div>
      {!submitted ? (
        <button onClick={submit} disabled={selected.length === 0} className="mt-4 w-full font-display tracking-widest text-xs uppercase bg-gradient-gold text-primary-foreground py-3 rounded-sm disabled:opacity-40">
          Seal My Vote
        </button>
      ) : (
        <div className="mt-4 text-center text-xs font-serif italic text-gold">Your vote is sealed. Wait for the reveal…</div>
      )}
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

function MurderMissionCard({ assignment, gameId, night, allPlayers }: any) {
  const targetName = allPlayers.find((p: any) => p.id === assignment.bonus_target_id)?.name || "your target";
  const state = assignment.bonus_mission_state as "pending" | "completed" | "failed";

  async function kill() {
    if (!assignment.bonus_target_id) return;
    await recordMurder(assignment.id, gameId, night, assignment.player_id, assignment.bonus_target_id);
    toast.success(`${targetName} sleeps with the fishes.`);
  }
  async function abandon() {
    await abandonMurder(assignment.id);
    toast("Mission abandoned.");
  }

  return (
    <div className="mt-3 bg-[var(--blood)]/15 border border-[var(--blood)] rounded-sm p-4">
      <div className="text-[10px] tracking-widest uppercase text-[var(--blood)] mb-2">
        Bonus · Murder Mission · +4 pt
      </div>
      <div className="font-serif text-base leading-snug">
        Eliminate <span className="font-display text-[var(--blood)]">{targetName.toUpperCase()}</span>.
        Get them to take a long drink ({3} fingers) without revealing yourself.
      </div>
      {state === "pending" && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={kill}
            className="flex-1 text-xs font-display tracking-widest uppercase py-2 rounded-sm bg-[var(--blood)] text-foreground"
          >
            ✓ Confirm kill
          </button>
          <button
            onClick={abandon}
            className="flex-1 text-xs font-display tracking-widest uppercase py-2 rounded-sm border border-[var(--gold)]/30 text-gold"
          >
            Abandon
          </button>
        </div>
      )}
      {state === "completed" && (
        <div className="mt-3 text-center text-xs font-display tracking-widest text-[var(--blood)]">
          KILL CONFIRMED · POURS REVEALED AT IL TRIBUNALE
        </div>
      )}
      {state === "failed" && (
        <div className="mt-3 text-center text-xs font-display tracking-widest text-muted-foreground">
          MISSION ABANDONED
        </div>
      )}
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
            {allPlayers.filter((p) => p.id !== me.id).map((p) => (
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