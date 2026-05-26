import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { Ornament } from "@/components/Ornament";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "La Famiglia — 3 Nights. 18 Players. One Family." },
      { name: "description", content: "A 3-night Italian-mafia social deduction drinking game for 18 players." },
    ],
  }),
});

function Index() {
  return (
    <div className="min-h-screen flex flex-col px-6 max-w-md mx-auto">
      <AppHeader subtitle="Three nights. One family. No survivors." />
      <div className="flex-1 flex flex-col justify-center gap-8 py-10">
        <Ornament>OMERTÀ</Ornament>
        <div className="text-center space-y-2">
          <p className="font-serif text-lg italic text-foreground/90 leading-relaxed">
            "Keep your friends close — <br/>and your enemies closer."
          </p>
        </div>
        <div className="space-y-3 mt-4">
          <Link
            to="/play"
            className="block w-full text-center font-display tracking-widest text-sm uppercase bg-gradient-gold text-primary-foreground py-4 rounded-sm shadow-gold hover:brightness-110 transition"
          >
            Enter as Player
          </Link>
          <Link
            to="/admin"
            className="block w-full text-center font-display tracking-widest text-xs uppercase border border-[var(--gold)]/40 text-gold py-3 rounded-sm hover:bg-[var(--gold)]/10 transition"
          >
            Set Up · New Game
          </Link>
        </div>
        <Ornament>NIGHTS · 3</Ornament>
        <div className="text-center text-xs tracking-[0.3em] uppercase text-muted-foreground">
          18 Souls · 4 Il Traditori · 16 Il Fideli
        </div>
      </div>
      <footer className="text-center pb-6 text-[10px] tracking-widest uppercase text-muted-foreground/70">
        Drink Responsibly · La Famiglia
      </footer>
    </div>
  );
}
