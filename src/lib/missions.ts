export const CIVILIAN_MISSIONS = [
  "Get someone to pour you a drink without directly asking",
  "Get 3 people to follow you to the pool within 15 minutes",
  "Take a photo with someone without them knowing it's for a mission",
  "Get someone to say the word 'famiglia' without prompting",
  "Start a group chant and get 5 people to join in",
  "Get someone to swap seats with you at dinner",
  "Convince someone to give you a compliment in Italian",
  "Get a high-five from at least 4 different people in 10 minutes",
];

export const TRAITOR_MISSIONS = [
  "Get one of Il Fideli to do a dare without them realising it's a mission",
  "Convince someone to switch their alliance partner",
  "Say 'la famiglia' out loud in a group of 5+ without anyone calling it out",
  "Get a Capo to suspect the wrong person (verbally)",
  "Shake hands formally with every other traitor without anyone noticing",
  "Get someone to agree to vote for a specific person tonight",
  "Plant a wine glass at someone else's seat without being noticed",
  "Whisper a fake secret to two different Il Fideli",
];

export const CAPO_MISSIONS = [
  "Catch a player mid-mission (tap them and call 'fermati!')",
  "Get a traitor to admit their role while they're holding a drink",
  "Correctly guess all 4 traitors before Il Tribunale",
  "Form an alliance with a traitor without knowing they're a traitor",
  "Confirm your suspect tip by gathering evidence from 2 other players",
  "Warn one of Il Fideli that they're being targeted, correctly",
  "Interrogate 3 different players using only one question each",
  "Get a confession by offering immunity (you can't actually grant it)",
];

export const SPECIAL_EVENTS: Record<number, { emoji: string; name: string; description: string }> = {
  1: { emoji: "🃏", name: "Benvenuti", description: "Standard rules apply. Welcome to the family." },
  2: { emoji: "👁️", name: "Il Traditore Doppio", description: "One traitor was secretly a Capo — revealed at the vote." },
  3: { emoji: "🔥", name: "La Resa dei Conti", description: "Points doubled tonight. If not all 4 traitors are voted out, Il Fideli lose drink distribution rights." },
};

export function missionsForRole(role: "capo" | "traitor" | "civilian"): string[] {
  if (role === "capo") return CAPO_MISSIONS;
  if (role === "traitor") return TRAITOR_MISSIONS;
  return CIVILIAN_MISSIONS;
}

export function pickTwoMissions(role: "capo" | "traitor" | "civilian"): [string, string] {
  const pool = [...missionsForRole(role)];
  const i = Math.floor(Math.random() * pool.length);
  const m1 = pool.splice(i, 1)[0];
  const j = Math.floor(Math.random() * pool.length);
  const m2 = pool[j];
  return [m1, m2];
}