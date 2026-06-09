export const FAITHFUL_MISSIONS = [
  "Get someone to pour you a drink without directly asking",
  "Get 3 people to follow you to the pool within 15 minutes",
  "Take a photo with someone without them knowing it's for a mission",
  "Get someone to say the word 'famiglia' without prompting",
  "Start a group chant and get 5 people to join in",
  "Get someone to swap seats with you at dinner",
  "Convince someone to give you a compliment in Italian",
  "Get a high-five from at least 4 different people in 10 minutes",
  "Order a round of espressos for 3 people after dinner",
  "Get someone to jump into the pool fully clothed",
  "Convince two people to swap drinks at the bar",
  "Toast 'Salute!' with 5 different people in one sitting",
  "Get the table to sing along to one Italian song at dinner",
  "Lead a poolside cannonball contest with at least 3 jumpers",
];

export const TRAITOR_MISSIONS = [
  "Get one of Il Fideli to do a dare without them realising it's a mission",
  "Say 'la famiglia' out loud in a group of 5+ without anyone calling it out",
  "Shake hands formally with every other traitor without anyone noticing",
  "Get someone to agree to vote for a specific person tonight",
  "Plant a wine glass at someone else's seat without being noticed",
  "Whisper a fake secret to two different Il Fideli",
  "Convince a Fideli to accuse another innocent player publicly",
  "Get a Fideli to buy you a drink while you steer the conversation away from the game",
];

export const SPECIAL_EVENTS: Record<number, { emoji: string; name: string; description: string }> = {
  1: { emoji: "🃏", name: "Benvenuti", description: "Standard rules apply. Welcome to the family." },
  2: { emoji: "👁️", name: "Il Traditore Doppio", description: "One traitor was secretly a Capo — revealed at the vote." },
  3: { emoji: "🔥", name: "La Resa dei Conti", description: "Points doubled tonight. If not all 4 traitors are voted out, Il Fideli lose drink distribution rights." },
};

export function missionsForRole(role: "traitor" | "faithful"): string[] {
  if (role === "traitor") return TRAITOR_MISSIONS;
  return FAITHFUL_MISSIONS;
}

export function pickTwoMissions(role: "traitor" | "faithful"): [string, string] {
  const pool = [...missionsForRole(role)];
  const i = Math.floor(Math.random() * pool.length);
  const m1 = pool.splice(i, 1)[0];
  const j = Math.floor(Math.random() * pool.length);
  const m2 = pool[j];
  return [m1, m2];
}