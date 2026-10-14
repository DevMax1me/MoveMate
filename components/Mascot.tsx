// Termi : la petite mascotte du carnet. Toujours bienveillante, jamais culpabilisante.
type Mood = "happy" | "cheer" | "sleepy" | "wink";
export default function Mascot({ mood = "happy", color = "var(--zone)", size = 64, className, title }: { mood?: Mood; color?: string; size?: number; className?: string; title?: string }) {
  const ink = "#2b2140";
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} style={{ flex: "none" }}>
      {/* corps : un galet un peu de travers */}
      <path d="M50 7C79 5 95 27 93 53 91 79 72 95 47 93 21 91 6 73 8 47 10 23 26 9 50 7Z" fill={color} />
      <path d="M22 24C30 14 42 10 52 11" stroke="#fff" strokeOpacity=".45" strokeWidth="5" strokeLinecap="round" fill="none" />
      {/* yeux */}
      {mood === "sleepy" ? <><path d="M28 47q8 6 16 0M56 47q8 6 16 0" stroke={ink} strokeWidth="4" strokeLinecap="round" fill="none" /></> :
        mood === "wink" ? <><circle cx="36" cy="46" r="6" fill={ink} /><circle cx="38" cy="43.8" r="1.9" fill="#fff" /><path d="M56 47q8 -7 16 0" stroke={ink} strokeWidth="4" strokeLinecap="round" fill="none" /></> :
        <><circle cx="36" cy="46" r="6" fill={ink} /><circle cx="64" cy="46" r="6" fill={ink} /><circle cx="38" cy="43.8" r="1.9" fill="#fff" /><circle cx="66" cy="43.8" r="1.9" fill="#fff" /></>}
      <circle cx="24" cy="60" r="6" fill="#ff8fa3" opacity=".55" /><circle cx="76" cy="60" r="6" fill="#ff8fa3" opacity=".55" />
      {/* bouche */}
      {mood === "cheer" ? <path d="M36 60q14 22 28 0z" fill={ink} /> :
        mood === "sleepy" ? <path d="M44 68q6 3 12 0" stroke={ink} strokeWidth="4" strokeLinecap="round" fill="none" /> :
        <path d="M38 62q12 12 24 0" stroke={ink} strokeWidth="4" strokeLinecap="round" fill="none" />}
    </svg>
  );
}
