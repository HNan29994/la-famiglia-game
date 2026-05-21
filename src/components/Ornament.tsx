export function Ornament({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-3 text-gold ${className}`}>
      <span className="h-px w-12 bg-gradient-to-r from-transparent to-[var(--gold)]" />
      <span className="text-xs tracking-[0.4em] uppercase font-display">{children ?? "✦"}</span>
      <span className="h-px w-12 bg-gradient-to-l from-transparent to-[var(--gold)]" />
    </div>
  );
}