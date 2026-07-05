// Znaczek słoneczka przy nazwie/typie firmy: żółty gdy NIP uzupełniony, szary gdy brak.
export default function NipBadge({ nip, size = 18 }: { nip?: string; size?: number }) {
  const has = Boolean((nip || '').replace(/[-\s]/g, '').length);
  const color = has ? '#eab308' : '#94a3b8'; // amber-500 / slate-400
  const title = has ? `NIP uzupełniony: ${nip}` : 'Brak NIP';
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      role="img" aria-label={title} className="inline-block shrink-0"
    >
      <title>{title}</title>
      <circle cx="12" cy="12" r="4.2" fill={color} />
      <g stroke={color} strokeWidth="2" strokeLinecap="round">
        <line x1="12" y1="2.5" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="21.5" />
        <line x1="2.5" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="21.5" y2="12" />
        <line x1="5.2" y1="5.2" x2="6.9" y2="6.9" />
        <line x1="17.1" y1="17.1" x2="18.8" y2="18.8" />
        <line x1="18.8" y1="5.2" x2="17.1" y2="6.9" />
        <line x1="6.9" y1="17.1" x2="5.2" y2="18.8" />
      </g>
    </svg>
  );
}
