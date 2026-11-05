import type { PetKind } from '../shared/config';

/**
 * Built-in pets are vector art split into named parts (`data-p="..."`).
 * The Animator moves those parts procedurally (breathing, blinking, walking, wagging…),
 * which is the same pipeline we will use later for user-uploaded images (single image + procedural motion).
 *
 * Coordinate system: viewBox 0 0 120 120, ground line at y = 112.
 */

type Pt = [number, number];
export interface Pivots {
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

export const PIVOTS: Record<PetKind, Pivots> = {
  cat: {
    root: [60, 112], body: [60, 112], head: [60, 74], tail: [82, 100],
    earL: [44, 34], earR: [76, 34], legL: [47, 106], legR: [73, 106],
    eyeL: [47, 50], eyeR: [73, 50],
  },
  dog: {
    root: [60, 112], body: [60, 112], head: [60, 74], tail: [84, 96],
    earL: [36, 34], earR: [84, 34], legL: [47, 106], legR: [73, 106],
    eyeL: [47, 48], eyeR: [73, 48],
  },
  human: {
    root: [60, 112], body: [60, 108], head: [60, 72],
    armL: [42, 80], armR: [78, 80], legL: [50, 106], legR: [70, 106],
    eyeL: [50, 50], eyeR: [70, 50],
  },
};

const PALETTES: Record<PetKind, Record<string, string>> = {
  cat: { body: '#f6b26b', belly: '#fff3e0', line: '#5b3a1e', stripe: '#d9893b', inner: '#ffb3c1', eye: '#2d1e12', nose: '#ff8fa3' },
  dog: { body: '#ecc9a0', belly: '#fff7ec', line: '#4a3223', ear: '#8a5a3b', patch: '#a8754f', eye: '#2a1d14' },
  human: { skin: '#ffdcbd', hair: '#3b2a20', shirt: '#6c8cff', tie: '#ff6b6b', line: '#2f2a3a', shoe: '#3a3a48', eye: '#2a2230' },
};

const TEMPLATES: Record<PetKind, string> = {
  cat: `
  <ellipse data-p="shadow" cx="60" cy="113" rx="30" ry="5" fill="#000" opacity=".16"/>
  <g data-p="root">
    <g data-p="tail"><path d="M82 100 C 102 100, 110 80, 103 62" fill="none" stroke="{line}" stroke-width="12" stroke-linecap="round"/><path d="M82 100 C 102 100, 110 80, 103 62" fill="none" stroke="{body}" stroke-width="7.5" stroke-linecap="round"/></g>
    <g data-p="body"><ellipse cx="60" cy="92" rx="27" ry="21" fill="{body}" stroke="{line}" stroke-width="2.5"/><ellipse cx="60" cy="97" rx="15" ry="12" fill="{belly}"/></g>
    <g data-p="legL"><ellipse cx="47" cy="110" rx="9" ry="5.5" fill="{belly}" stroke="{line}" stroke-width="2.5"/></g>
    <g data-p="legR"><ellipse cx="73" cy="110" rx="9" ry="5.5" fill="{belly}" stroke="{line}" stroke-width="2.5"/></g>
    <g data-p="head">
      <g data-p="earL"><path d="M33 40 L37 13 L56 29 Z" fill="{body}" stroke="{line}" stroke-width="2.5" stroke-linejoin="round"/><path d="M38.5 33 L40 20 L49.5 28 Z" fill="{inner}"/></g>
      <g data-p="earR"><path d="M87 40 L83 13 L64 29 Z" fill="{body}" stroke="{line}" stroke-width="2.5" stroke-linejoin="round"/><path d="M81.5 33 L80 20 L70.5 28 Z" fill="{inner}"/></g>
      <ellipse cx="60" cy="50" rx="33" ry="27" fill="{body}" stroke="{line}" stroke-width="2.5"/>
      <path d="M53 25 q2 5 0 9 M60 24 q0 5 0 10 M67 25 q-2 5 0 9" stroke="{stripe}" stroke-width="3" fill="none" stroke-linecap="round"/>
      <g data-p="blush"><ellipse cx="38" cy="60" rx="6" ry="3.5" fill="#ff9aa8"/><ellipse cx="82" cy="60" rx="6" ry="3.5" fill="#ff9aa8"/></g>
      <g data-p="eyes">
        <g data-p="eyeL"><ellipse cx="47" cy="50" rx="5" ry="6.5" fill="{eye}"/><circle cx="48.8" cy="47.4" r="1.9" fill="#fff"/></g>
        <g data-p="eyeR"><ellipse cx="73" cy="50" rx="5" ry="6.5" fill="{eye}"/><circle cx="74.8" cy="47.4" r="1.9" fill="#fff"/></g>
      </g>
      <g data-p="eyesHappy" style="display:none"><path d="M41 52 Q47 44 53 52 M67 52 Q73 44 79 52" stroke="{eye}" stroke-width="3" fill="none" stroke-linecap="round"/></g>
      <path d="M57 58 L63 58 L60 61.5 Z" fill="{nose}" stroke="{line}" stroke-width="1" stroke-linejoin="round"/>
      <g data-p="mouth"><path d="M54 63 Q57 67 60 63 Q63 67 66 63" stroke="{line}" stroke-width="2" fill="none" stroke-linecap="round"/></g>
      <g data-p="mouthOpen" style="display:none"><path d="M54.5 62.5 Q60 74 65.5 62.5 Z" fill="#c2414b" stroke="{line}" stroke-width="2" stroke-linejoin="round"/></g>
      <path d="M27 55 L41 57.5 M27 62.5 L41 61.5 M93 55 L79 57.5 M93 62.5 L79 61.5" stroke="{line}" stroke-width="1.5" stroke-linecap="round" opacity=".55"/>
    </g>
  </g>`,

  dog: `
  <ellipse data-p="shadow" cx="60" cy="113" rx="30" ry="5" fill="#000" opacity=".16"/>
  <g data-p="root">
    <g data-p="tail"><path d="M84 96 C 98 92, 103 82, 99 70" fill="none" stroke="{line}" stroke-width="11" stroke-linecap="round"/><path d="M84 96 C 98 92, 103 82, 99 70" fill="none" stroke="{body}" stroke-width="6.5" stroke-linecap="round"/></g>
    <g data-p="body"><ellipse cx="60" cy="92" rx="27" ry="21" fill="{body}" stroke="{line}" stroke-width="2.5"/><ellipse cx="60" cy="97" rx="15" ry="12" fill="{belly}"/></g>
    <g data-p="legL"><ellipse cx="47" cy="110" rx="9" ry="5.5" fill="{belly}" stroke="{line}" stroke-width="2.5"/></g>
    <g data-p="legR"><ellipse cx="73" cy="110" rx="9" ry="5.5" fill="{belly}" stroke="{line}" stroke-width="2.5"/></g>
    <g data-p="head">
      <ellipse cx="60" cy="50" rx="32" ry="27" fill="{body}" stroke="{line}" stroke-width="2.5"/>
      <ellipse cx="73" cy="44" rx="10" ry="9" fill="{patch}" opacity=".85"/>
      <g data-p="earL"><path d="M38 30 C 22 30, 16 56, 24 70 C 30 76, 37 64, 41 44 Z" fill="{ear}" stroke="{line}" stroke-width="2.5" stroke-linejoin="round"/></g>
      <g data-p="earR"><path d="M82 30 C 98 30, 104 56, 96 70 C 90 76, 83 64, 79 44 Z" fill="{ear}" stroke="{line}" stroke-width="2.5" stroke-linejoin="round"/></g>
      <g data-p="blush"><ellipse cx="38" cy="61" rx="5.5" ry="3.2" fill="#ff9aa8"/><ellipse cx="82" cy="61" rx="5.5" ry="3.2" fill="#ff9aa8"/></g>
      <ellipse cx="60" cy="62" rx="14" ry="10" fill="{belly}"/>
      <g data-p="eyes">
        <g data-p="eyeL"><ellipse cx="47" cy="48" rx="4.8" ry="6" fill="{eye}"/><circle cx="48.6" cy="45.6" r="1.8" fill="#fff"/></g>
        <g data-p="eyeR"><ellipse cx="73" cy="48" rx="4.8" ry="6" fill="{eye}"/><circle cx="74.6" cy="45.6" r="1.8" fill="#fff"/></g>
      </g>
      <g data-p="eyesHappy" style="display:none"><path d="M41 50 Q47 42 53 50 M67 50 Q73 42 79 50" stroke="{eye}" stroke-width="3" fill="none" stroke-linecap="round"/></g>
      <ellipse cx="60" cy="57" rx="5.5" ry="3.8" fill="#2b2b2b"/>
      <g data-p="mouth"><path d="M60 60.5 L60 64 M53 64 Q56.5 68 60 64 Q63.5 68 67 64" stroke="{line}" stroke-width="2" fill="none" stroke-linecap="round"/></g>
      <g data-p="mouthOpen" style="display:none"><path d="M53 63.5 Q60 70 67 63.5" stroke="{line}" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M56.5 66 Q60 78 63.5 66 Z" fill="#ff7a8a" stroke="{line}" stroke-width="1.6" stroke-linejoin="round"/></g>
    </g>
  </g>`,

  human: `
  <ellipse data-p="shadow" cx="60" cy="113" rx="26" ry="5" fill="#000" opacity=".16"/>
  <g data-p="root">
    <g data-p="legL"><ellipse cx="50" cy="109" rx="8" ry="5" fill="{shoe}"/></g>
    <g data-p="legR"><ellipse cx="70" cy="109" rx="8" ry="5" fill="{shoe}"/></g>
    <g data-p="armL"><path d="M43 82 Q32 92 35 102" stroke="{line}" stroke-width="11" fill="none" stroke-linecap="round"/><path d="M43 82 Q32 92 35 102" stroke="{shirt}" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="35" cy="103" r="4.2" fill="{skin}" stroke="{line}" stroke-width="2"/></g>
    <g data-p="armR"><path d="M77 82 Q88 92 85 102" stroke="{line}" stroke-width="11" fill="none" stroke-linecap="round"/><path d="M77 82 Q88 92 85 102" stroke="{shirt}" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="85" cy="103" r="4.2" fill="{skin}" stroke="{line}" stroke-width="2"/></g>
    <g data-p="body">
      <path d="M40 108 Q37 84 49 76 L71 76 Q83 84 80 108 Z" fill="{shirt}" stroke="{line}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M54 76 L60 84 L66 76 Z" fill="#fff" stroke="{line}" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M60 83 L57 96 L60 100 L63 96 Z" fill="{tie}" stroke="{line}" stroke-width="1.2" stroke-linejoin="round"/>
    </g>
    <g data-p="head">
      <circle cx="34.5" cy="51" r="4.5" fill="{skin}" stroke="{line}" stroke-width="2"/>
      <circle cx="85.5" cy="51" r="4.5" fill="{skin}" stroke="{line}" stroke-width="2"/>
      <ellipse cx="60" cy="49" rx="26" ry="26" fill="{skin}" stroke="{line}" stroke-width="2.5"/>
      <path d="M33 47 Q31 19 60 19 Q89 19 87 47 Q82 35 71 32 Q60 39 47 32 Q37 36 33 47 Z" fill="{hair}" stroke="{line}" stroke-width="2" stroke-linejoin="round"/>
      <g data-p="blush"><ellipse cx="43" cy="59" rx="5" ry="3" fill="#ff9aa8"/><ellipse cx="77" cy="59" rx="5" ry="3" fill="#ff9aa8"/></g>
      <g data-p="eyes">
        <g data-p="eyeL"><ellipse cx="50" cy="50" rx="3.8" ry="5" fill="{eye}"/><circle cx="51.3" cy="48.2" r="1.4" fill="#fff"/></g>
        <g data-p="eyeR"><ellipse cx="70" cy="50" rx="3.8" ry="5" fill="{eye}"/><circle cx="71.3" cy="48.2" r="1.4" fill="#fff"/></g>
      </g>
      <g data-p="eyesHappy" style="display:none"><path d="M45.5 51.5 Q50 45 54.5 51.5 M65.5 51.5 Q70 45 74.5 51.5" stroke="{eye}" stroke-width="2.6" fill="none" stroke-linecap="round"/></g>
      <g data-p="mouth"><path d="M56 61 Q60 64.5 64 61" stroke="{line}" stroke-width="2" fill="none" stroke-linecap="round"/></g>
      <g data-p="mouthOpen" style="display:none"><path d="M55.5 60 Q60 70 64.5 60 Z" fill="#c2414b" stroke="{line}" stroke-width="2" stroke-linejoin="round"/></g>
    </g>
  </g>`,
};

export function petSVG(kind: PetKind): string {
  const pal = PALETTES[kind];
  const inner = TEMPLATES[kind].replace(/\{(\w+)\}/g, (_, k: string) => pal[k] ?? '#000');
  return `<svg class="pet-svg" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" overflow="visible">${inner}</svg>`;
}
