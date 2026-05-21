import { Link } from "@tanstack/react-router";

export function AppHeader({ subtitle }: { subtitle?: string }) {
  return (
    <header className="text-center pt-8 pb-6">
      <Link to="/" className="block">
        <h1 className="font-display text-3xl sm:text-4xl tracking-[0.25em] text-gold text-shadow-gold">
          LA FAMIGLIA
        </h1>
      </Link>
      {subtitle && (
        <p className="mt-2 font-serif italic text-muted-foreground text-sm">{subtitle}</p>
      )}
    </header>
  );
}