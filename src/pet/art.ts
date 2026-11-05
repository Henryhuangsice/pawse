import type { PetKind } from '../shared/config';

/**
 * Built-in pets are vector art split into named parts (`data-p="..."`).
 * The Animator moves those parts procedurally; each pet also declares a render style
 * that changes how motion is applied:
 *   - pixel : 8-bit cat. Motion snaps to the pixel grid and steps at 12 fps, frame-swapped tail.
 *   - neon  : cyberpunk robo-dog. Neon pulse, visor scanline, occasional RGB glitch.
 *   - power : original anime-style fighter. Hover charges power → golden hair, aura, sparks.
 *
 * Elements with `data-power` fade in with the power level, `data-unpower` fade out.
 * Coordinate system: viewBox 0 0 120 120, ground line at y = 112.
 */

export type RenderStyle = 'pixel' | 'neon' | 'power';
type Pt = [number, number];

export interface PetMeta {
  style: RenderStyle;
  earTwitch: boolean;
  root: Pt;
  body: Pt;
  head: Pt;
  tail?: Pt;
  earL?: Pt;
  earR?: Pt;
  legL: Pt;
  legR: Pt;
  armL?: Pt;
  armR?: Pt;
  eyeL: Pt;
  eyeR: Pt;
}

export const PX = 4; // one "pixel" of the pixel-art cat, in viewBox units

export const META: Record<PetKind, PetMeta> = {
  cat: {
    style: 'pixel', earTwitch: false,
    root: [60, 112], body: [60, 112], head: [60, 84],
    legL: [44, 106], legR: [76, 106], eyeL: [44, 62], eyeR: [76, 62],
  },
  dog: {
    style: 'neon', earTwitch: true,
    root: [60, 112], body: [60, 112], head: [60, 72], tail: [84, 96],
    earL: [40, 37], earR: [80, 37], legL: [47, 106], legR: [73, 106],
    eyeL: [47.5, 46], eyeR: [72.5, 46],
  },
  human: {
    style: 'power', earTwitch: false,
    root: [60, 112], body: [60, 108], head: [60, 72],
    armL: [42, 80], armR: [78, 80], legL: [50, 106], legR: [70, 106],
    eyeL: [50, 51], eyeR: [70, 51],
  },
};

// ---------------------------------------------------------------- pixel cat

const CAT_PAL: Record<string, string> = {
  K: '#2b1d3a', // outline
  O: '#ff9f43', // fur
  D: '#e0702a', // stripes
  W: '#fff1dc', // belly / muzzle
  P: '#ff6f9c', // pink
  E: '#2b1d3a', // eye
  H: '#ffffff', // eye highlight
  S: '#2b1d3a', // shadow
};

const CAT = {
  head: [
    '.KK..........KK.',
    '.KOK........KOK.',
    '.KPOK......KOPK.',
    'KOPOOKKKKKKOOPOK',
    'KOOOOODDDDOOOOOK',
    'KOOOOOODDOOOOOOK',
    'KOOOOOOOOOOOOOOK',
    'KOOOOOOOOOOOOOOK',
    'KWOOOOOPPOOOOOWK',
    'KWWOOOOOOOOOOWWK',
    '.KWWOOOOOOOOWWK.',
    '..KKKKKKKKKKKK..',
  ],
  body: [
    'KOOOOOOOOOOK',
    'KOODWWWWDOOK',
    'KOOWWWWWWOOK',
    'KODWWWWWWDOK',
    'KOOOWWWWOOOK',
    '.KKKKKKKKKK.',
  ],
  tailA: ['...KK', '..KOK', '..KDK', '.KOK.', 'KODK.', 'KOK..', 'KOK..'],
  tailB: ['....KK', '...KOK', '..KDK.', '.KOK..', 'KODK..', 'KOK...', 'KOK...'],
  leg: ['KWWK', '.KK.'],
  eye: ['HE', 'EE'],
  eyeClosed: ['EE'],
  happyL: ['.E.', 'E.E'],
  mouth: ['K..K', '.KK.'],
  mouthOpen: ['KKKK', 'KPPK', '.KK.'],
  blush: ['PP'],
  shadow: ['SSSSSSSSSSSS'],
};

/** Grid rows → merged <rect> runs, crisp at any scale. */
function pix(grid: string[], ox: number, oy: number, pal = CAT_PAL): string {
  let out = '';
  grid.forEach((row, r) => {
    let c = 0;
    while (c < row.length) {
      const ch = row[c];
      if (ch === '.') { c++; continue; }
      let e = c;
      while (e < row.length && row[e] === ch) e++;
      out += `<rect x="${(ox + c) * PX}" y="${(oy + r) * PX}" width="${(e - c) * PX}" height="${PX}" fill="${pal[ch]}"/>`;
      c = e;
    }
  });
  return out;
}

function catSVG(): string {
  // 1.25× about the ground point: each art pixel becomes 5 units, filling the frame like the other pets
  return `<g transform="translate(60 112) scale(1.25) translate(-60 -112)">
  <g data-p="shadow" opacity=".18">${pix(CAT.shadow, 9, 28)}</g>
  <g data-p="root" shape-rendering="crispEdges">
    <g data-p="tail">${pix(CAT.tailA, 20, 16)}</g>
    <g data-p="tail2" style="display:none">${pix(CAT.tailB, 20, 16)}</g>
    <g data-p="body">${pix(CAT.body, 9, 20)}</g>
    <g data-p="legL">${pix(CAT.leg, 9, 26)}</g>
    <g data-p="legR">${pix(CAT.leg, 17, 26)}</g>
    <g data-p="head">
      ${pix(CAT.head, 7, 9)}
      <g data-p="blush">${pix(CAT.blush, 9, 17)}${pix(CAT.blush, 19, 17)}</g>
      <g data-p="eyes">
        <g data-p="eyeL">${pix(CAT.eye, 10, 15)}</g>
        <g data-p="eyeR">${pix(CAT.eye, 18, 15)}</g>
      </g>
      <g data-p="eyesClosed" style="display:none">${pix(CAT.eyeClosed, 10, 16)}${pix(CAT.eyeClosed, 18, 16)}</g>
      <g data-p="eyesHappy" style="display:none">${pix(CAT.happyL, 9, 15)}${pix(CAT.happyL, 18, 15)}</g>
      <g data-p="mouth">${pix(CAT.mouth, 13, 18)}</g>
      <g data-p="mouthOpen" style="display:none">${pix(CAT.mouthOpen, 13, 18)}</g>
    </g>
  </g></g>`;
}

// ---------------------------------------------------------------- cyber dog

const CY = '#00f0ff';
const MG = '#ff2bd6';
const DK = '#1b1b33';

function dogSVG(): string {
  return `
  <defs>
    <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="1.4" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <clipPath id="visor-clip"><rect x="36" y="38" width="48" height="16" rx="8"/></clipPath>
  </defs>
  <ellipse data-p="shadow" cx="60" cy="113" rx="30" ry="4.5" fill="${CY}" opacity=".22"/>
  <g data-p="root">
    <g data-p="tail">
      <path d="M84 96 L94 88 L98 76" fill="none" stroke="#2a2a4a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M84 96 L94 88 L98 76" fill="none" stroke="${CY}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" filter="url(#neon-glow)"/>
      <circle data-p="led" cx="98" cy="74" r="3.6" fill="${MG}" filter="url(#neon-glow)"/>
    </g>
    <g data-p="body">
      <path d="M36 96 Q34 74 60 72 Q86 74 84 96 Q84 110 60 110 Q36 110 36 96 Z" fill="${DK}" stroke="${CY}" stroke-width="2" filter="url(#neon-glow)"/>
      <path d="M42 90 L49 90 M71 90 L78 90 M44 98 L50 98 M70 98 L76 98" stroke="${CY}" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>
      <g data-p="neon">
        <polygon points="60,85 66,88.5 66,95.5 60,99 54,95.5 54,88.5" fill="none" stroke="${MG}" stroke-width="1.8" filter="url(#neon-glow)"/>
        <circle cx="60" cy="92" r="2.2" fill="${MG}"/>
      </g>
      <path d="M41 75 Q60 82 79 75" fill="none" stroke="${MG}" stroke-width="3" stroke-linecap="round"/>
      <circle data-p="led2" cx="60" cy="79" r="2" fill="${CY}" filter="url(#neon-glow)"/>
    </g>
    <g data-p="legL"><rect x="38" y="103" width="18" height="9" rx="3.5" fill="#24244a" stroke="${CY}" stroke-width="1.6"/><path d="M42 108 L52 108" stroke="${MG}" stroke-width="1.6" stroke-linecap="round"/></g>
    <g data-p="legR"><rect x="64" y="103" width="18" height="9" rx="3.5" fill="#24244a" stroke="${CY}" stroke-width="1.6"/><path d="M68 108 L78 108" stroke="${MG}" stroke-width="1.6" stroke-linecap="round"/></g>
    <g data-p="head">
      <g data-p="earL"><polygon points="33,45 15,15 51,31" fill="${DK}" stroke="${CY}" stroke-width="2" stroke-linejoin="round" filter="url(#neon-glow)"/><polygon points="34,38 22,22 45,31" fill="${MG}" opacity=".85"/></g>
      <g data-p="earR"><polygon points="87,45 105,15 69,31" fill="${DK}" stroke="${CY}" stroke-width="2" stroke-linejoin="round" filter="url(#neon-glow)"/><polygon points="86,38 98,22 75,31" fill="${MG}" opacity=".85"/></g>
      <path d="M30 47 Q30 22 60 22 Q90 22 90 47 Q90 70 60 72 Q30 70 30 47 Z" fill="${DK}" stroke="${CY}" stroke-width="2.2" filter="url(#neon-glow)"/>
      <path data-p="circuit" d="M60 24 L60 31 L54 35 M60 31 L66 35 M54 35 L50 35 M66 35 L70 35" fill="none" stroke="${MG}" stroke-width="1.4" stroke-linecap="round"/>
      <rect x="36" y="38" width="48" height="16" rx="8" fill="#07070f" stroke="${MG}" stroke-width="1.8" filter="url(#neon-glow)"/>
      <g clip-path="url(#visor-clip)">
        <g data-p="eyes">
          <g data-p="eyeL"><rect x="43" y="42" width="9" height="8" rx="2.5" fill="${CY}" filter="url(#neon-glow)"/></g>
          <g data-p="eyeR"><rect x="68" y="42" width="9" height="8" rx="2.5" fill="${CY}" filter="url(#neon-glow)"/></g>
        </g>
        <g data-p="eyesHappy" style="display:none"><path d="M43 50 L47.5 43.5 L52 50 M68 50 L72.5 43.5 L77 50" fill="none" stroke="${CY}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" filter="url(#neon-glow)"/></g>
        <rect data-p="scan" x="36" y="38" width="48" height="1.6" fill="${CY}" opacity=".4"/>
      </g>
      <g data-p="blush"><rect x="34" y="59" width="7" height="2.2" rx="1" fill="${MG}"/><rect x="79" y="59" width="7" height="2.2" rx="1" fill="${MG}"/></g>
      <path d="M49 58 Q60 54 71 58 Q71 69 60 69 Q49 69 49 58 Z" fill="#2a2a50" stroke="${CY}" stroke-width="1.4"/>
      <rect x="55.5" y="57" width="9" height="4.6" rx="2.2" fill="${MG}" filter="url(#neon-glow)"/>
      <g data-p="mouth"><path d="M55 64.5 Q60 67.5 65 64.5" fill="none" stroke="${CY}" stroke-width="1.6" stroke-linecap="round"/></g>
      <g data-p="mouthOpen" style="display:none"><path d="M54 63.5 Q60 73 66 63.5 Z" fill="${MG}" stroke="${CY}" stroke-width="1.4" stroke-linejoin="round"/></g>
    </g>
  </g>`;
}

// ---------------------------------------------------------------- power fighter (original design)

const SKIN = '#ffd9b5';
const LINE = '#1e1a2b';
const GOLD = '#ffd23f';

function fighterSVG(): string {
  const arm = (d: string, fist: Pt, band: string) => `
    <path d="${d}" stroke="${LINE}" stroke-width="10.5" fill="none" stroke-linecap="round"/>
    <path d="${d}" stroke="${SKIN}" stroke-width="6.5" fill="none" stroke-linecap="round"/>
    <path d="${band}" stroke="#e0353b" stroke-width="5" stroke-linecap="round"/>
    <circle cx="${fist[0]}" cy="${fist[1]}" r="4.8" fill="${SKIN}" stroke="${LINE}" stroke-width="2"/>`;
  const spark = (d: string) =>
    `<path d="${d}" fill="none" stroke="#fff6a8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" filter="url(#aura-glow)"/>`;
  return `
  <defs>
    <filter id="aura-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2.2" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <linearGradient id="aura-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff7c2" stop-opacity=".4"/>
      <stop offset=".55" stop-color="${GOLD}" stop-opacity=".75"/>
      <stop offset="1" stop-color="#ff9d00" stop-opacity=".9"/>
    </linearGradient>
  </defs>
  <ellipse data-p="shadow" cx="60" cy="113" rx="26" ry="5" fill="#000" opacity=".16"/>
  <g data-p="root">
    <g data-p="aura" opacity="0">
      <path d="M60 2 C 70 20, 90 16, 94 42 C 106 58, 100 86, 94 111 L26 111 C 20 86, 14 58, 26 42 C 30 16, 50 20, 60 2 Z" fill="url(#aura-grad)" filter="url(#aura-glow)"/>
    </g>
    <g data-p="aura2" opacity="0">
      <path d="M60 14 C 68 28, 82 26, 85 46 C 94 62, 88 88, 84 110 L36 110 C 32 88, 26 62, 35 46 C 38 26, 52 28, 60 14 Z" fill="#fff3a6" opacity=".45" filter="url(#aura-glow)"/>
    </g>
    <g data-p="legL"><path d="M42 110 Q42 103 50 103 Q58 103 58 110 Z" fill="#1d2233" stroke="${LINE}" stroke-width="2"/><rect x="43" y="104" width="14" height="2.6" fill="#e0353b"/></g>
    <g data-p="legR"><path d="M62 110 Q62 103 70 103 Q78 103 78 110 Z" fill="#1d2233" stroke="${LINE}" stroke-width="2"/><rect x="63" y="104" width="14" height="2.6" fill="#e0353b"/></g>
    <g data-p="armL">${arm('M43 82 Q32 91 36 101', [36, 103], 'M33.5 97.5 L39 98.6')}</g>
    <g data-p="armR">${arm('M77 82 Q88 91 84 101', [84, 103], 'M86.5 97.5 L81 98.6')}</g>
    <g data-p="body">
      <path d="M40 108 Q37 84 49 76 L71 76 Q83 84 80 108 Z" fill="#233a6b" stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M51 76 L60 89 L69 76 Z" fill="#11131c"/>
      <rect x="40.5" y="96" width="39" height="5.5" fill="#efe9da" stroke="${LINE}" stroke-width="1.6"/>
      <rect x="56" y="95" width="8" height="7.5" rx="1.5" fill="#efe9da" stroke="${LINE}" stroke-width="1.6"/>
      <path d="M71 81 L67 87 L70 87 L68 92 L73.5 85 L70.5 85 Z" fill="${GOLD}" stroke="${LINE}" stroke-width="1"/>
    </g>
    <g data-p="head">
      <circle cx="35" cy="52" r="4.5" fill="${SKIN}" stroke="${LINE}" stroke-width="2"/>
      <circle cx="85" cy="52" r="4.5" fill="${SKIN}" stroke="${LINE}" stroke-width="2"/>
      <ellipse cx="60" cy="50" rx="25" ry="25" fill="${SKIN}" stroke="${LINE}" stroke-width="2.5"/>
      <g data-unpower><path d="M33 52 L27 36 L38 40 L35 21 L48 32 L52 11 L60 28 L68 11 L72 32 L85 21 L82 40 L93 36 L87 52 Q84 38 72 36 L66 42 L60 34 L54 42 L48 36 Q36 38 33 52 Z" fill="#221c2c" stroke="${LINE}" stroke-width="2" stroke-linejoin="round"/></g>
      <g data-power opacity="0"><path d="M33 52 L22 31 L37 37 L31 10 L47 27 L52 0 L60 23 L68 0 L73 27 L89 10 L83 37 L98 31 L87 52 Q84 38 72 36 L66 42 L60 34 L54 42 L48 36 Q36 38 33 52 Z" fill="${GOLD}" stroke="#c58a00" stroke-width="2" stroke-linejoin="round" filter="url(#aura-glow)"/></g>
      <path d="M43.5 43 L55 46 M76.5 43 L65 46" stroke="${LINE}" stroke-width="2.8" stroke-linecap="round"/>
      <g data-p="blush"><ellipse cx="43" cy="60" rx="5" ry="2.8" fill="#ff9aa8"/><ellipse cx="77" cy="60" rx="5" ry="2.8" fill="#ff9aa8"/></g>
      <g data-p="eyes">
        <g data-p="eyeL"><ellipse cx="50" cy="51" rx="3.8" ry="4.8" fill="${LINE}"/><ellipse data-power opacity="0" cx="50" cy="51.4" rx="2.4" ry="3.2" fill="#2ee6c5"/><circle cx="51.3" cy="49.2" r="1.3" fill="#fff"/></g>
        <g data-p="eyeR"><ellipse cx="70" cy="51" rx="3.8" ry="4.8" fill="${LINE}"/><ellipse data-power opacity="0" cx="70" cy="51.4" rx="2.4" ry="3.2" fill="#2ee6c5"/><circle cx="71.3" cy="49.2" r="1.3" fill="#fff"/></g>
      </g>
      <g data-p="eyesHappy" style="display:none"><path d="M45.5 52.5 Q50 46 54.5 52.5 M65.5 52.5 Q70 46 74.5 52.5" stroke="${LINE}" stroke-width="2.6" fill="none" stroke-linecap="round"/></g>
      <g data-p="mouth"><path d="M55.5 62 Q60 65 64.5 62" stroke="${LINE}" stroke-width="2" fill="none" stroke-linecap="round"/></g>
      <g data-p="mouthOpen" style="display:none"><path d="M54.5 60.5 Q60 71 65.5 60.5 Z" fill="#c2414b" stroke="${LINE}" stroke-width="2" stroke-linejoin="round"/></g>
    </g>
    <g data-p="sparks" opacity="0">
      ${spark('M18 40 L24 46 L19 50 L26 58')}
      ${spark('M101 34 L95 42 L101 45 L94 54')}
      ${spark('M22 82 L28 86 L23 92')}
      ${spark('M98 78 L92 84 L98 89')}
    </g>
  </g>`;
}

const BUILD: Record<PetKind, () => string> = { cat: catSVG, dog: dogSVG, human: fighterSVG };

export function petSVG(kind: PetKind): string {
  return `<svg class="pet-svg style-${META[kind].style}" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" overflow="visible">${BUILD[kind]()}</svg>`;
}
