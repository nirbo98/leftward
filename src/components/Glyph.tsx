/**
 * Original, simple, high-contrast SVG silhouettes (drawn for this project).
 * Deliberately no numerals, clock hands, logos, text or fine detail — legible with
 * uncorrected astigmatism at large sizes.
 */
interface Props {
  glyph: string;
  fg: string;
  bg: string;
  photoUrl?: string;
  label: string;
}

export const SHAPE_GLYPHS = ['disc', 'square', 'diamond'] as const;
export const CAR_GLYPHS = ['car_roadster', 'car_coupe', 'car_sedan'] as const;
export const WATCH_GLYPHS = ['watch_round', 'watch_square', 'watch_pocket'] as const;

function Wheels({ fg, bg }: { fg: string; bg: string }) {
  return (
    <>
      <circle cx="25" cy="66" r="12" fill={fg} stroke={bg} strokeWidth="3" />
      <circle cx="25" cy="66" r="4" fill={bg} />
      <circle cx="76" cy="66" r="12" fill={fg} stroke={bg} strokeWidth="3" />
      <circle cx="76" cy="66" r="4" fill={bg} />
    </>
  );
}

export function Glyph({ glyph, fg, bg, photoUrl, label }: Props) {
  if (glyph.startsWith('photo:')) {
    return photoUrl ? (
      <img src={photoUrl} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    ) : (
      <svg viewBox="0 0 100 100" role="img" aria-label={label}>
        <circle cx="50" cy="50" r="44" fill={fg} />
      </svg>
    );
  }
  let body: JSX.Element;
  switch (glyph) {
    case 'square':
      body = <rect x="10" y="10" width="80" height="80" rx="8" fill={fg} />;
      break;
    case 'diamond':
      body = <polygon points="50,4 96,50 50,96 4,50" fill={fg} />;
      break;
    case 'car_roadster':
      body = (
        <>
          <path d="M5 64 L8 53 Q11 47 22 46 L42 46 L48 37 L56 37 L58 46 L84 46 Q95 47 96 57 L96 64 Z" fill={fg} />
          <Wheels fg={fg} bg={bg} />
        </>
      );
      break;
    case 'car_coupe':
      body = (
        <>
          <path d="M5 64 L8 54 Q12 48 26 46 Q34 28 52 28 Q68 28 75 46 Q91 48 95 56 L95 64 Z" fill={fg} />
          <path d="M35 44 Q41 34 52 34 Q62 34 66 44 Z" fill={bg} />
          <Wheels fg={fg} bg={bg} />
        </>
      );
      break;
    case 'car_sedan':
      body = (
        <>
          <path d="M6 64 L6 52 L18 50 L24 30 L72 30 L78 50 L94 52 L94 64 Z" fill={fg} />
          <rect x="29" y="35" width="17" height="12" fill={bg} />
          <rect x="51" y="35" width="17" height="12" fill={bg} />
          <Wheels fg={fg} bg={bg} />
        </>
      );
      break;
    case 'watch_round':
      body = (
        <>
          <rect x="38" y="2" width="24" height="26" rx="3" fill={fg} />
          <rect x="38" y="72" width="24" height="26" rx="3" fill={fg} />
          <circle cx="50" cy="50" r="30" fill={fg} />
          <circle cx="50" cy="50" r="20" fill={bg} />
          <rect x="79" y="45" width="8" height="10" rx="2" fill={fg} />
        </>
      );
      break;
    case 'watch_square':
      body = (
        <>
          <rect x="38" y="2" width="24" height="26" rx="3" fill={fg} />
          <rect x="38" y="72" width="24" height="26" rx="3" fill={fg} />
          <rect x="21" y="21" width="58" height="58" rx="12" fill={fg} />
          <rect x="31" y="31" width="38" height="38" rx="7" fill={bg} />
          <rect x="79" y="45" width="8" height="10" rx="2" fill={fg} />
        </>
      );
      break;
    case 'watch_pocket':
      body = (
        <>
          <circle cx="50" cy="13" r="8" fill="none" stroke={fg} strokeWidth="5" />
          <rect x="45" y="19" width="10" height="8" fill={fg} />
          <circle cx="50" cy="60" r="34" fill={fg} />
          <circle cx="50" cy="60" r="24" fill={bg} />
        </>
      );
      break;
    case 'disc':
    default:
      body = <circle cx="50" cy="50" r="44" fill={fg} />;
  }
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label={label} focusable="false">
      {body}
    </svg>
  );
}
