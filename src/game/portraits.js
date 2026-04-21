// Dummy character portraits rendered as inline SVG. Each portrait is a few
// distinctive shapes that hint at the character's personality. Swap for real
// sprite art by replacing each function's body with an <image href="..."/>
// tag pointing to the asset; consumers only read the return string.

const PAL = {
  bg:    "#0c1a0e",
  skin:  "#2c3a2e",
  ink:   "#c0e8c0",
  line:  "#7fff6a",
  accent:"#b9ff4d",
  dim:   "#6a8e6a",
  dark:  "#071008",
};

function frame(bodySVG, opts = {}) {
  const w = 100, h = 100;
  const accent = opts.accent ?? PAL.line;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"
               preserveAspectRatio="xMidYMid slice"
               class="portrait-svg" aria-hidden="true">
    <rect x="0" y="0" width="${w}" height="${h}" fill="${PAL.bg}"/>
    <g>${bodySVG}</g>
    <rect x="1.5" y="1.5" width="${w - 3}" height="${h - 3}" rx="4"
          fill="none" stroke="${accent}" stroke-width="1.4" opacity="0.75"/>
  </svg>`;
}

// Volkov — bald veteran. Heavy brow, thick beard, pipe.
function volkovSVG() {
  return frame(`
    <!-- shoulders -->
    <path d="M8 100 Q20 78 50 74 Q80 78 92 100 Z" fill="${PAL.skin}"/>
    <!-- head -->
    <ellipse cx="50" cy="46" rx="26" ry="30" fill="${PAL.skin}"/>
    <!-- bald shine -->
    <path d="M32 28 Q50 18 68 28 Q50 24 32 28 Z" fill="${PAL.dim}" opacity="0.55"/>
    <!-- heavy brow -->
    <path d="M30 42 Q50 36 70 42" stroke="${PAL.dark}" stroke-width="3" fill="none" stroke-linecap="round"/>
    <!-- eyes -->
    <circle cx="40" cy="49" r="1.8" fill="${PAL.ink}"/>
    <circle cx="60" cy="49" r="1.8" fill="${PAL.ink}"/>
    <!-- beard + mustache -->
    <path d="M28 60 Q32 76 50 80 Q68 76 72 60 Q66 66 50 66 Q34 66 28 60 Z"
          fill="${PAL.dark}"/>
    <path d="M40 58 Q50 62 60 58" stroke="${PAL.dark}" stroke-width="2.2" fill="none"/>
    <!-- pipe + smoke -->
    <rect x="62" y="68" width="14" height="3" rx="1.5" fill="${PAL.dark}"/>
    <circle cx="78" cy="69" r="2.2" fill="${PAL.accent}"/>
    <path d="M80 64 Q84 58 82 54 Q86 52 84 48"
          stroke="${PAL.dim}" stroke-width="1.2" fill="none" opacity="0.7"/>
  `);
}

// Petrov — 16, prodigy, round glasses, anxious posture.
function petrovSVG() {
  return frame(`
    <!-- shoulders -->
    <path d="M14 100 Q24 80 50 76 Q76 80 86 100 Z" fill="${PAL.skin}"/>
    <!-- head (narrower) -->
    <ellipse cx="50" cy="46" rx="22" ry="28" fill="${PAL.skin}"/>
    <!-- messy hair top + fringe -->
    <path d="M28 34 Q34 18 50 16 Q70 16 72 34 Q60 28 50 30 Q40 28 28 34 Z"
          fill="${PAL.dark}"/>
    <path d="M36 34 L42 44 M46 34 L48 42 M54 34 L56 42 M62 34 L60 44"
          stroke="${PAL.dark}" stroke-width="1.4" fill="none"/>
    <!-- round glasses -->
    <circle cx="41" cy="50" r="6" fill="none" stroke="${PAL.line}" stroke-width="1.6"/>
    <circle cx="59" cy="50" r="6" fill="none" stroke="${PAL.line}" stroke-width="1.6"/>
    <line x1="47" y1="50" x2="53" y2="50" stroke="${PAL.line}" stroke-width="1.6"/>
    <!-- eyes behind glasses -->
    <circle cx="41" cy="50" r="1.3" fill="${PAL.ink}"/>
    <circle cx="59" cy="50" r="1.3" fill="${PAL.ink}"/>
    <!-- small serious mouth -->
    <path d="M44 64 Q50 62 56 64" stroke="${PAL.dark}" stroke-width="1.5" fill="none"/>
  `);
}

// Kozlov — lebemann, slicked hair, shades, stubble, confident.
function kozlovSVG() {
  return frame(`
    <!-- shoulders + open collar -->
    <path d="M8 100 Q18 78 50 74 Q82 78 92 100 Z" fill="${PAL.skin}"/>
    <path d="M42 78 L50 92 L58 78 Z" fill="${PAL.bg}"/>
    <!-- head -->
    <ellipse cx="50" cy="46" rx="25" ry="29" fill="${PAL.skin}"/>
    <!-- slicked back hair -->
    <path d="M26 38 Q32 18 50 18 Q72 20 74 36 Q68 30 56 30 Q42 30 32 34 Q28 36 26 38 Z"
          fill="${PAL.dark}"/>
    <path d="M34 34 Q50 26 68 32" stroke="${PAL.dim}" stroke-width="1" fill="none" opacity="0.7"/>
    <!-- aviator shades -->
    <rect x="30" y="44" width="18" height="8" rx="2" fill="${PAL.dark}"/>
    <rect x="52" y="44" width="18" height="8" rx="2" fill="${PAL.dark}"/>
    <line x1="48" y1="48" x2="52" y2="48" stroke="${PAL.dark}" stroke-width="1.4"/>
    <!-- lens glint -->
    <line x1="33" y1="46" x2="37" y2="50" stroke="${PAL.line}" stroke-width="1" opacity="0.9"/>
    <line x1="55" y1="46" x2="59" y2="50" stroke="${PAL.line}" stroke-width="1" opacity="0.9"/>
    <!-- confident smirk -->
    <path d="M42 66 Q50 70 58 64" stroke="${PAL.dark}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <!-- stubble dots -->
    <g fill="${PAL.dark}" opacity="0.7">
      <circle cx="38" cy="70" r="0.8"/><circle cx="42" cy="72" r="0.8"/>
      <circle cx="46" cy="73" r="0.8"/><circle cx="54" cy="73" r="0.8"/>
      <circle cx="58" cy="72" r="0.8"/><circle cx="62" cy="70" r="0.8"/>
    </g>
  `);
}

// Fallback for unknown ids — monogram of the first letter.
function genericSVG(id) {
  const letter = (id?.[0] ?? "?").toUpperCase();
  return frame(`
    <path d="M8 100 Q20 78 50 74 Q80 78 92 100 Z" fill="${PAL.skin}"/>
    <circle cx="50" cy="46" r="28" fill="${PAL.skin}"/>
    <text x="50" y="56" text-anchor="middle"
          font-family="ui-monospace, Menlo, monospace"
          font-size="30" font-weight="700" fill="${PAL.line}">${letter}</text>
  `);
}

export function getPortraitSVG(id) {
  switch (id) {
    case "volkov": return volkovSVG();
    case "petrov": return petrovSVG();
    case "kozlov": return kozlovSVG();
    default: return genericSVG(id);
  }
}
