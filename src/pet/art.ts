import type { Accessory, PetKind } from '../shared/config';

/**
 * Built-in pets are vector art split into named parts (`data-p="..."`).
 * The Animator moves those parts procedurally; each pet declares a render style:
 *   - pixel : original flying pixel cat with a synthwave trail. Grid-snapped, 12 fps, frame swaps.
 *   - sprite: astronaut cut from green-screen footage; clips are swapped, the sprite is moved as a whole.
 *   - image : a user's custom pet (one cut-out picture), brought to life by whole-body motion.
 *
 * Built-in looks can be recoloured (hue shift on the palette) and given an accessory.
 *   - power : sleek original fighter. Hover charges power → golden hair, geometric aura, speed lines.
 *
 * Elements with `data-power` fade in with the power level, `data-unpower` fade out.
 * Coordinate system: viewBox 0 0 120 120, ground line at y = 112.
 */

export type RenderStyle = 'pixel' | 'sprite' | 'power' | 'image';

export interface SpriteSheets {
  base: string;
  fw: number;
  fh: number;
  cols: number;
  fps: number;
  /** clip name → frame count; each clip is `${base}${name}.webp`, frames laid out left-to-right in `cols` columns */
  clips: Record<string, number>;
}
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
  astro: {
    style: 'sprite', earTwitch: false,
    root: [60, 110], body: [60, 70], head: [60, 14],
    legL: [55, 100], legR: [65, 100], eyeL: [56, 26], eyeR: [64, 26],
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

// ---------------------------------------------------------------- astronaut (sprite sheets)

/**
 * The astronaut is footage, not vector art: frames cut from a Pixabay green-screen clip
 * (see scripts/make_astro_sprites.py) and packed into one sheet per clip. The Animator
 * swaps clips (idle float / three-quarter drift / wave) and steps frames; the whole sprite
 * is still moved by the shared root transform (hover, jumps, drag swing, sleep drift).
 */
export const ASTRO_SPRITE: SpriteSheets = {
  base: '/pets/astro/',
  fw: 200, fh: 300, cols: 12, fps: 12,
  clips: { idle: 84, side: 108, wave: 48 },
};

function astroSVG(): string {
  const { base, fw, fh, cols, clips } = ASTRO_SPRITE;
  const sheets = Object.entries(clips).map(([name, n]) => {
    const w = fw * cols, h = fh * Math.ceil(n / cols);
    return `<image data-clip="${name}" href="${base}${name}.webp" width="${w}" height="${h}"${name === 'idle' ? '' : ' style="display:none"'}/>`;
  }).join('');
  return `
  <g data-p="shadow"><ellipse cx="60" cy="114" rx="17" ry="3.2" fill="#1b2140" opacity=".16"/></g>
  <g data-p="root">
    <svg x="20" y="-6" width="80" height="120" viewBox="0 0 ${fw} ${fh}" style="overflow:hidden">${sheets}</svg>
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

const BUILD: Record<PetKind, () => string> = { cat: catSVG, astro: astroSVG, human: fighterSVG };

export interface Look {
  hue?: number;
  accessory?: Accessory;
}

const svgWrap = (style: RenderStyle, inner: string) =>
  `<svg class="pet-svg style-${style}" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" overflow="visible">${inner}</svg>`;

export function petSVG(kind: PetKind, look: Look = {}): string {
  const hue = look.hue ?? 0;
  let inner = BUILD[kind]();
  if (hue) {
    if (META[kind].style === 'sprite') inner = inner.replace('<svg x=', `<svg style="filter:hue-rotate(${hue}deg)" x=`);
    else inner = recolor(inner, hue, KEEP_COLORS[kind]);
  }
  return svgWrap(META[kind].style, withAccessory(inner, look.accessory, ACC_ANCHOR[kind]));
}

// ---------------------------------------------------------------- custom pets (single cut-out image)

export const CUSTOM_META: PetMeta = {
  style: 'image', earTwitch: false,
  root: [60, 112], body: [60, 80], head: [60, 30],
  legL: [55, 100], legR: [65, 100], eyeL: [56, 30], eyeR: [64, 30],
};

/** Fit the picture into a 104-unit box standing on the ground line. */
export function customSVG(image: string, aspect: number, look: Look = {}): string {
  const box = 104;
  const w = aspect >= 1 ? box : box * aspect;
  const h = aspect >= 1 ? box / aspect : box;
  const x = 60 - w / 2, y = 112 - h;
  const filter = look.hue ? ` style="filter:hue-rotate(${look.hue}deg)"` : '';
  const inner = `
  <g data-p="shadow"><ellipse cx="60" cy="113" rx="${Math.max(14, w * 0.32).toFixed(1)}" ry="3.4" fill="#1b2140" opacity=".16"/></g>
  <g data-p="root">
    <image href="${image}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" preserveAspectRatio="xMidYMax meet"${filter}/>
  </g>`;
  // only hats work on an arbitrary picture: there's no known eye line
  const acc = look.accessory && ['crown', 'bow'].includes(look.accessory) ? look.accessory : undefined;
  return svgWrap('image', withAccessory(inner, acc, { top: [60, y + 2], eyes: [60, y + h * 0.25], w: Math.min(48, w * 0.42) }));
}

// ---------------------------------------------------------------- recolouring

/** Colours that keep their hue (outlines, whites, skin) so a recolour still reads as the same pet. */
const KEEP_COLORS: Record<PetKind, string[]> = {
  cat: ['#241a33', '#fff3e2', '#ffffff', '#ff6fa5'],
  astro: [],
  human: ['#16182b', '#f0c9a5', '#f1ede4', '#3ff0d0'],
};

function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToHex(h: number, s: number, l: number) {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function recolor(svg: string, hue: number, keep: string[]) {
  return svg.replace(/#[0-9a-fA-F]{6}\b/g, (hex) => {
    if (keep.includes(hex.toLowerCase())) return hex;
    const [h, s, l] = hexToHsl(hex);
    if (s < 0.12) return hex; // greys stay grey
    return hslToHex((h + hue) % 360, s, l);
  });
}

// ---------------------------------------------------------------- accessories

interface Anchor {
  /** top of the head */
  top: [number, number];
  /** centre of the eye line */
  eyes: [number, number];
  /** head width */
  w: number;
}

const ACC_ANCHOR: Record<PetKind, Anchor> = {
  cat: { top: [94, 50], eyes: [94, 60], w: 40 },
  astro: { top: [60, 6], eyes: [60, 15.5], w: 19 },
  human: { top: [60, 14], eyes: [60, 38], w: 30 },
};

/** Drawn for a 40-unit-wide head, origin at the anchor. */
function accessoryMarkup(a: Accessory, an: Anchor): string {
  const k = an.w / 40;
  const at = ([x, y]: [number, number]) => `translate(${x} ${y}) scale(${k.toFixed(3)})`;
  switch (a) {
    case 'crown':
      return `<g transform="${at(an.top)}"><path d="M-14 2 L-16 -14 L-7 -6 L0 -18 L7 -6 L16 -14 L14 2 Z" fill="#ffd23f" stroke="#c98a00" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="0" cy="-5" r="2.6" fill="#ff4f7b"/><circle cx="-9" cy="-3" r="1.8" fill="#3ec6ff"/><circle cx="9" cy="-3" r="1.8" fill="#3ec6ff"/></g>`;
    case 'shades':
      return `<g transform="${at(an.eyes)}"><path d="M-19 -5 H-2 V1 Q-2 6 -8 6 H-14 Q-19 6 -19 1 Z M2 -5 H19 V1 Q19 6 14 6 H8 Q2 6 2 1 Z" fill="#14121c"/>
        <path d="M-2 -3.5 H2" stroke="#14121c" stroke-width="2.4"/><path d="M-16 -3 L-12 -3 M5 -3 L9 -3" stroke="#ffffff" stroke-opacity=".55" stroke-width="1.6" stroke-linecap="round"/></g>`;
    case 'bow':
      return `<g transform="${at([an.top[0] + an.w * 0.32, an.top[1] + 3])}"><path d="M0 0 L-13 -8 Q-16 0 -13 8 Z M0 0 L13 -8 Q16 0 13 8 Z" fill="#ff5d8f" stroke="#c42d62" stroke-width="1.6" stroke-linejoin="round"/>
        <circle r="3.6" fill="#ff86ad" stroke="#c42d62" stroke-width="1.6"/></g>`;
    case 'headphones': {
      const dy = (an.eyes[1] - an.top[1]) / k;
      return `<g transform="${at(an.top)}"><path d="M-22 ${dy.toFixed(1)} Q-24 -8 0 -8 Q24 -8 22 ${dy.toFixed(1)}" fill="none" stroke="#2b2f3f" stroke-width="4" stroke-linecap="round"/>
        <rect x="-27" y="${(dy - 5).toFixed(1)}" width="9" height="13" rx="4" fill="#ff8a5b" stroke="#2b2f3f" stroke-width="2"/>
        <rect x="18" y="${(dy - 5).toFixed(1)}" width="9" height="13" rx="4" fill="#ff8a5b" stroke="#2b2f3f" stroke-width="2"/></g>`;
    }
    default:
      return '';
  }
}

/** Put the accessory last inside the root group; the Animator gives it the head's transform. */
function withAccessory(inner: string, a: Accessory | undefined, an: Anchor) {
  if (!a || a === 'none') return inner;
  const i = inner.lastIndexOf('</g>');
  return `${inner.slice(0, i)}<g data-p="acc">${accessoryMarkup(a, an)}</g>${inner.slice(i)}`;
}
