import type { Role } from "@/lib/game";

const ROLE_META: Record<Role, { emoji: string; label: string; italian: string; color: string }> = {
  traitor: { emoji: "🐍", label: "Traitor", italian: "Il Traditore", color: "text-[var(--blood)]" },
  faithful: { emoji: "👤", label: "Faithful", italian: "Fedeli", color: "text-muted-foreground" },
};

export function RoleBadge({ role, big = false }: { role: Role; big?: boolean }) {
  const m = ROLE_META[role];
  return (
    <div className={`inline-flex items-center gap-2 ${big ? "text-2xl" : "text-sm"}`}>
      <span>{m.emoji}</span>
      <span className={`font-display tracking-widest uppercase ${m.color}`}>{m.italian}</span>
    </div>
  );
}

export function roleMeta(role: Role) {
  return ROLE_META[role];
}