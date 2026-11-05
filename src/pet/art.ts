import type { PetKind } from '../shared/config';

/**
 * Built-in pets are vector art split into named parts (`data-p="..."`).
 * The Animator moves those parts procedurally; each pet declares a render style:
 *   - pixel : original flying pixel cat with a synthwave trail. Grid-snapped, 12 fps, frame swaps.
 *   - flat  : geometric flat-design Shiba. Restrained palette, poster-style backdrop disc.
 *   - power : sleek original fighter. Hover charges power → golden hair, geometric aura, speed lines.
 *
 * Elements with `data-power` fade in with the power level, `data-unpower` fade out.
 * Coordinate system: viewBox 0 0 120 120, ground line at y = 112.
 */

export type RenderStyle = 'pixel' | 'flat' | 'power';
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
    root: [60, 112], body: [60, 112], head: [92, 60],
    legL: [44, 84], legR: [70, 84], eyeL: [84, 60], eyeR: [104, 60],
  },
  dog: {
    style: 'flat', earTwitch: true,
    root: [60, 112], body: [60, 112], head: [60, 68], tail: [80, 96],
    earL: [44, 30], earR: [76, 30], legL: [52, 104], legR: [68, 104],
    eyeL: [50.5, 44], eyeR: [69.5, 44],
  },
  human: {
    style: 'power', earTwitch: false,
    root: [60, 112], body: [60, 96], head: [60, 52], tail: [72, 60],
    armL: [46, 62], armR: [74, 62], legL: [51, 92], legR: [69, 92],
    eyeL: [53, 38], eyeR: [67, 38],
  },
};

// ---------------------------------------------------------------- flying pixel cat (original)

const CAT_PAL: Record<string, string> = {
  K: '#241a33', // outline
  O: '#ffa64d', // fur
  D: '#e2702b', // stripes
  W: '#fff3e2', // belly
  P: '#ff6fa5', // pink
  E: '#241a33', // eye
  H: '#ffffff', // highlight
  S: '#241a33', // ground shadow
  '1': '#ff3df2', // trail: magenta
  '2': '#a35cff', // violet
  '3': '#3d7bff', // blue
  '4': '#2ef2ff', // cyan
  '*': '#ffffff', // star
  '+': '#ffe066', // star core
};

const CAT = {
  head: [
    '.KK.....KK.',
    '.KOK...KOK.',
    '.KPOKKKOPK.',
    'KOOODDDOOOK',
    'KOOOOOOOOOK',
    'KOOOOOOOOOK',
    'KOOOOKOOOOK',
    'KOOOOOOOOOK',
    '.KKKKKKKKK.',
  ],
  body: [
    '.KKKKKKKKKK.',
    'KOODOOODOOOK',
    'KOOODOOODOOK',
    'KOOOOOOOOOOK',
    'KODOOODOOOOK',
    'KOOWWWWWWOOK',
    'KOWWWWWWWWOK',
    '.KKKKKKKKKK.',
  ],
  legsBack: ['KOK.KOK', 'KKK.KKK'],
  legsFront: ['KOK.KOK', 'KKK.KKK'],
  tailA: ['KK...', 'KOK..', '.KOK.', '..KOK', '...KO'],
  tailB: ['...KO', '..KOK', '.KOK.', 'KOK..', 'KK...'],
  eye: ['HE', 'EE'],
  eyeClosed: ['EE'],
  happy: ['.E.', 'E.E'],
  mouth: ['K.K.K'],
  mouthOpen: ['KPPPK', '.KKK.'],
  blush: ['P'],
  shadow: ['SSSSSSSSSSSSSS'],
  // synthwave trail: 4 colour bands, segments alternately raised for a ribbon wave
  trailA: [
    '111...111...', '111111111111', '222111222111', '222222222222',
    '333222333222', '333333333333', '444333444333', '444444444444', '...444...444',
  ],
  trailB: [
    '...111...111', '111111111111', '111222111222', '222222222222',
    '222333222333', '333333333333', '333444333444', '444444444444', '444...444...',
  ],
  starA: ['.*.', '*+*', '.*.'],
  starB: ['*'],
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
  return `
  <g data-p="shadow" opacity=".14">${pix(CAT.shadow, 8, 28)}</g>
  <g data-p="root" shape-rendering="crispEdges">
    <g data-p="stars">
      <g data-p="starsA">${pix(CAT.starA, 3, 6)}${pix(CAT.starB, 15, 4)}${pix(CAT.starA, 1, 23)}</g>
      <g data-p="starsB" style="display:none">${pix(CAT.starB, 4, 7)}${pix(CAT.starA, 14, 3)}${pix(CAT.starB, 2, 24)}</g>
    </g>
    <g data-p="trail">${pix(CAT.trailA, -2, 12)}</g>
    <g data-p="trail2" style="display:none">${pix(CAT.trailB, -2, 12)}</g>
    <g data-p="tail">${pix(CAT.tailA, 4, 10)}</g>
    <g data-p="tail2" style="display:none">${pix(CAT.tailB, 4, 13)}</g>
    <g data-p="legL">${pix(CAT.legsBack, 8, 20)}</g>
    <g data-p="legR">${pix(CAT.legsFront, 15, 20)}</g>
    <g data-p="body">${pix(CAT.body, 8, 12)}</g>
    <g data-p="head">
      ${pix(CAT.head, 18, 10)}
      <g data-p="blush">${pix(CAT.blush, 19, 16)}${pix(CAT.blush, 27, 16)}</g>
      <g data-p="eyes">
        <g data-p="eyeL">${pix(CAT.eye, 20, 14)}</g>
        <g data-p="eyeR">${pix(CAT.eye, 25, 14)}</g>
      </g>
      <g data-p="eyesClosed" style="display:none">${pix(CAT.eyeClosed, 20, 15)}${pix(CAT.eyeClosed, 25, 15)}</g>
      <g data-p="eyesHappy" style="display:none">${pix(CAT.happy, 19, 14)}${pix(CAT.happy, 24, 14)}</g>
      <g data-p="mouth">${pix(CAT.mouth, 21, 17)}</g>
      <g data-p="mouthOpen" style="display:none">${pix(CAT.mouthOpen, 21, 17)}</g>
    </g>
  </g>`;
}

// ---------------------------------------------------------------- geometric flat Shiba

const SH = {
  coat: '#e07a5f', // terracotta
  coatDark: '#c5654b',
  cream: '#f4f1de',
  ink: '#2f3150',
  sun: '#f2cc8f', // mustard
  sage: '#81b29a',
};

function dogSVG(): string {
  return `
  <ellipse data-p="shadow" cx="60" cy="113" rx="24" ry="3.5" fill="${SH.ink}" opacity=".14"/>
  <g data-p="root">
    <circle data-p="backdrop" cx="60" cy="58" r="40" fill="${SH.sun}" opacity=".55"/>
    <g data-p="tail">
      <path d="M78 98 C 96 98, 100 78, 88 74 C 80 72, 78 82, 86 84" fill="none" stroke="${SH.coat}" stroke-width="9" stroke-linecap="round"/>
      <path d="M88 74 C 82 73, 79 79, 84 83" fill="none" stroke="${SH.cream}" stroke-width="4" stroke-linecap="round"/>
    </g>
    <g data-p="body">
      <path d="M41 112 L45 80 Q47 68 60 68 Q73 68 75 80 L79 112 Z" fill="${SH.coat}"/>
      <path d="M52 70 L68 70 L64 98 Q60 104 56 98 Z" fill="${SH.cream}"/>
      <path d="M45.5 78 Q60 86 74.5 78 L75.2 83 Q60 91 44.8 83 Z" fill="${SH.sage}"/>
      <circle cx="60" cy="88" r="3.2" fill="${SH.sun}"/>
    </g>
    <g data-p="legL"><rect x="47.5" y="96" width="9" height="16" rx="4.5" fill="${SH.cream}"/></g>
    <g data-p="legR"><rect x="63.5" y="96" width="9" height="16" rx="4.5" fill="${SH.cream}"/></g>
    <g data-p="head">
      <g data-p="earL"><path d="M36 36 L41 9 L56 27 Z" fill="${SH.coat}"/><path d="M41 31 L43 17 L51 27 Z" fill="${SH.ink}"/></g>
      <g data-p="earR"><path d="M84 36 L79 9 L64 27 Z" fill="${SH.coat}"/><path d="M79 31 L77 17 L69 27 Z" fill="${SH.ink}"/></g>
      <path d="M34 44 Q34 22 60 22 Q86 22 86 44 Q86 61 60 68 Q34 61 34 44 Z" fill="${SH.coat}"/>
      <path d="M41 49 Q50 44 60 50 Q70 44 79 49 Q77 63 60 68 Q43 63 41 49 Z" fill="${SH.cream}"/>
      <circle cx="49" cy="36.5" r="2.4" fill="${SH.cream}"/>
      <circle cx="71" cy="36.5" r="2.4" fill="${SH.cream}"/>
      <g data-p="eyes">
        <g data-p="eyeL"><ellipse cx="50.5" cy="44" rx="2.8" ry="3.4" fill="${SH.ink}"/></g>
        <g data-p="eyeR"><ellipse cx="69.5" cy="44" rx="2.8" ry="3.4" fill="${SH.ink}"/></g>
      </g>
      <g data-p="eyesHappy" style="display:none"><path d="M47 45 Q50.5 40.5 54 45 M66 45 Q69.5 40.5 73 45" fill="none" stroke="${SH.ink}" stroke-width="2.4" stroke-linecap="round"/></g>
      <path d="M56 53 L64 53 L60 57.5 Z" fill="${SH.ink}" stroke="${SH.ink}" stroke-width="1.6" stroke-linejoin="round"/>
      <g data-p="mouth"><path d="M60 57.5 L60 60 M56 61 Q58 62.5 60 60 Q62 62.5 64 61" fill="none" stroke="${SH.ink}" stroke-width="1.6" stroke-linecap="round"/></g>
      <g data-p="mouthOpen" style="display:none"><path d="M60 57.5 L60 59.5 M55.5 60 Q60 62 64.5 60 Q63 68 60 68 Q57 68 55.5 60 Z" fill="${SH.coatDark}" stroke="${SH.ink}" stroke-width="1.6" stroke-linejoin="round"/></g>
    </g>
  </g>`;
}

// ---------------------------------------------------------------- power fighter (original design)

const F = {
  ink: '#16182b',
  suit: '#1f2547',
  suitLight: '#2f3a72',
  skin: '#f0c9a5',
  cloth: '#f1ede4',
  gold: '#f5c542',
  goldDeep: '#d99a1e',
  aura: '#ffe08a',
};

function fighterSVG(): string {
  const arm = (d: string, hand: Pt) => `
    <path d="${d}" stroke="${F.suit}" stroke-width="9" fill="none" stroke-linecap="round"/>
    <circle cx="${hand[0]}" cy="${hand[1]}" r="4.2" fill="${F.skin}"/>`;
  const spark = (x: number, y: number, s: number) =>
    `<path d="M${x} ${y - s} L${x + s * 0.45} ${y} L${x} ${y + s} L${x - s * 0.45} ${y} Z" fill="${F.gold}"/>`;
  const lines = [22, 34, 86, 98].map((x, i) =>
    `<rect x="${x}" y="${30 + (i % 2) * 22}" width="1.6" height="${22 - (i % 2) * 6}" rx=".8" fill="${F.gold}"/>`).join('');
  return `
  <defs>
    <filter id="power-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <radialGradient id="power-disc" cx=".5" cy=".55" r=".5">
      <stop offset="0" stop-color="${F.aura}" stop-opacity=".85"/>
      <stop offset=".6" stop-color="${F.gold}" stop-opacity=".35"/>
      <stop offset="1" stop-color="${F.gold}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse data-p="shadow" cx="60" cy="113" rx="20" ry="3.5" fill="${F.ink}" opacity=".18"/>
  <g data-p="root">
    <g data-p="aura" opacity="0">
      <circle cx="60" cy="62" r="52" fill="url(#power-disc)"/>
      <circle cx="60" cy="62" r="44" fill="none" stroke="${F.gold}" stroke-width="1.4" stroke-dasharray="3 6"/>
    </g>
    <g data-p="ring" opacity="0"><polygon points="60,20 96.4,41 96.4,83 60,104 23.6,83 23.6,41" fill="none" stroke="${F.gold}" stroke-width="1.8" filter="url(#power-glow)"/></g>
    <g data-p="aura2" opacity="0">${lines}</g>
    <g data-p="tail"><path d="M72 58 C 84 55, 92 62, 104 56 L102 63 C 92 68, 83 62, 72 63.5 Z" fill="${F.cloth}"/></g>
    <g data-p="legL"><path d="M47 92 L45 107 L56 107 L58 92 Z" fill="${F.suit}"/><rect x="43" y="106" width="14" height="6" rx="2" fill="${F.ink}"/></g>
    <g data-p="legR"><path d="M73 92 L75 107 L64 107 L62 92 Z" fill="${F.suit}"/><rect x="63" y="106" width="14" height="6" rx="2" fill="${F.ink}"/></g>
    <g data-p="armL">${arm('M46 62 Q38 76 40 88', [40, 90])}</g>
    <g data-p="armR">${arm('M74 62 Q82 76 80 88', [80, 90])}</g>
    <g data-p="body">
      <path d="M44 59 Q60 52 76 59 L78 96 L42 96 Z" fill="${F.suit}"/>
      <path d="M53 56 L60 72 L67 56 Z" fill="${F.suitLight}"/>
      <path d="M42.6 86 L77.4 86" stroke="${F.gold}" stroke-width="2.4"/>
      <path d="M46 56 Q60 63 74 56 L74.5 61 Q60 68 45.5 61 Z" fill="${F.cloth}"/>
    </g>
    <g data-p="head">
      <rect x="56" y="45" width="8" height="10" fill="${F.skin}"/>
      <circle cx="45.5" cy="36" r="2.6" fill="${F.skin}"/>
      <circle cx="74.5" cy="36" r="2.6" fill="${F.skin}"/>
      <path d="M45 33 Q45 19 60 19 Q75 19 75 33 Q75 45 60 51 Q45 45 45 33 Z" fill="${F.skin}"/>
      <g data-unpower><path d="M43 35 L40 21 L47 23 L46 11 L54 17 L58 5 L63 16 L71 9 L71 19 L79 17 L76 29 L77 35 Q73 25 63 24 L58 28 L52 24 Q46 27 43 35 Z" fill="${F.ink}"/></g>
      <g data-power opacity="0"><path d="M43 35 L35 17 L46 20 L41 2 L53 14 L58 -6 L64 12 L75 0 L72 16 L84 12 L77 29 L77 35 Q73 25 63 24 L58 28 L52 24 Q46 27 43 35 Z" fill="${F.gold}" stroke="${F.goldDeep}" stroke-width="1.2" stroke-linejoin="round" filter="url(#power-glow)"/></g>
      <path d="M45.2 29.5 Q60 25.5 74.8 29.5 L74.9 32.6 Q60 28.6 45.1 32.6 Z" fill="${F.cloth}"/>
      <path d="M49 33.4 L56 35 M71 33.4 L64 35" stroke="${F.ink}" stroke-width="1.8" stroke-linecap="round"/>
      <g data-p="eyes">
        <g data-p="eyeL"><path d="M50 37 L56.2 36.6 L55.2 39.4 L51 39.2 Z" fill="${F.ink}"/><path data-power opacity="0" d="M51.6 37.2 L54.8 37 L54.3 38.9 L52.1 38.8 Z" fill="#3ff0d0"/></g>
        <g data-p="eyeR"><path d="M70 37 L63.8 36.6 L64.8 39.4 L69 39.2 Z" fill="${F.ink}"/><path data-power opacity="0" d="M68.4 37.2 L65.2 37 L65.7 38.9 L67.9 38.8 Z" fill="#3ff0d0"/></g>
      </g>
      <g data-p="eyesHappy" style="display:none"><path d="M50 39 Q53 35.6 56 39 M64 39 Q67 35.6 70 39" fill="none" stroke="${F.ink}" stroke-width="1.8" stroke-linecap="round"/></g>
      <g data-p="mouth"><path d="M57 45 L63 45" stroke="${F.ink}" stroke-width="1.6" stroke-linecap="round"/></g>
      <g data-p="mouthOpen" style="display:none"><path d="M56.5 43.8 L63.5 43.8 L62.2 47.6 L57.8 47.6 Z" fill="${F.ink}"/></g>
    </g>
    <g data-p="sparks" opacity="0" filter="url(#power-glow)">
      ${spark(20, 44, 5)}${spark(101, 36, 4)}${spark(24, 86, 3.5)}${spark(97, 80, 5)}
    </g>
  </g>`;
}

const BUILD: Record<PetKind, () => string> = { cat: catSVG, dog: dogSVG, human: fighterSVG };

export function petSVG(kind: PetKind): string {
  return `<svg class="pet-svg style-${META[kind].style}" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" overflow="visible">${BUILD[kind]()}</svg>`;
}
