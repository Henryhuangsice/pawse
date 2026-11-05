import type { PetKind } from '../shared/config';
import { PIVOTS, type Pivots } from './art';

export type AnimMode = 'idle' | 'walk' | 'sleep' | 'drag';
export type Reaction = 'jump' | 'spin' | 'happy' | 'shake' | 'startle' | 'wave' | 'land' | 'hop';

const DURATION: Record<Reaction, number> = {
  jump: 620,
  spin: 700,
  happy: 1100,
  shake: 650,
  startle: 520,
  wave: 1400,
  land: 280,
  hop: 320,
};

const PART_NAMES = [
  'root', 'body', 'head', 'tail', 'earL', 'earR', 'legL', 'legR', 'armL', 'armR',
  'eyeL', 'eyeR', 'eyes', 'eyesHappy', 'blush', 'mouth', 'mouthOpen', 'shadow',
] as const;
type PartName = (typeof PART_NAMES)[number];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const rot = (a: number, [cx, cy]: [number, number]) => `rotate(${a.toFixed(2)} ${cx} ${cy})`;
const scaleAt = (sx: number, sy: number, [cx, cy]: [number, number]) =>
  `translate(${cx} ${cy}) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(${-cx} ${-cy})`;
const tr = (x: number, y: number) => `translate(${x.toFixed(2)} ${y.toFixed(2)})`;

/**
 * Procedural animation for a part-rigged SVG pet. No sprite sheets needed:
 * breathing, blinking, gaze, walk cycle, tail wag, ear twitch, squash & stretch and drag swing
 * are all computed per frame from the current mode + transient reactions.
 */
export class Animator {
  mode: AnimMode = 'idle';
  dir: 1 | -1 = 1;
  hover = false;

  private p: Partial<Record<PartName, SVGGraphicsElement>> = {};
  private piv: Pivots;
  private gaze = { x: 0, y: 0 };
  private gazeTarget = { x: 0, y: 0 };
  private nextBlink = 0;
  private blinkStart = -1;
  private reaction: { type: Reaction; t0: number; dur: number } | null = null;
  private happyUntil = 0;
  private talkUntil = 0;
  private surpriseUntil = 0;
  private twitch = { side: 0, t0: 0, next: 0 };
  private swing = { a: 0, v: 0, target: 0 };
  private flip = 1; // smoothed dir

  constructor(svg: SVGSVGElement, kind: PetKind) {
    for (const n of PART_NAMES) {
      const el = svg.querySelector<SVGGraphicsElement>(`[data-p="${n}"]`);
      if (el) this.p[n] = el;
    }
    this.piv = PIVOTS[kind];
    this.flip = this.dir;
  }

  lookAt(x: number, y: number) {
    this.gazeTarget.x = clamp(x, -1, 1);
    this.gazeTarget.y = clamp(y, -1, 1);
  }

  react(type: Reaction, now = performance.now()) {
    this.reaction = { type, t0: now, dur: DURATION[type] };
    if (type === 'happy' || type === 'wave') this.happyUntil = now + DURATION[type] + 300;
    if (type === 'startle') this.surpriseUntil = now + 700;
  }

  happy(ms: number, now = performance.now()) {
    this.happyUntil = Math.max(this.happyUntil, now + ms);
  }

  talk(ms: number, now = performance.now()) {
    this.talkUntil = now + ms;
  }

  /** Horizontal drag velocity in px/s; drives the pendulum swing while held. */
  dragVelocity(vx: number) {
    this.swing.target = clamp(-vx * 0.045, -38, 38);
  }

  get isReacting() {
    return this.reaction !== null;
  }

  update(dt: number, now: number) {
    const T = now / 1000;
    const p = this.p;
    const piv = this.piv;
    const sleeping = this.mode === 'sleep';
    const walking = this.mode === 'walk';
    const dragging = this.mode === 'drag';
    const happy = now < this.happyUntil;
    const surprised = now < this.surpriseUntil || dragging;

    // ---- transient reaction curve ----
    let jumpY = 0, sx = 1, sy = 1, spinX = 1, headShake = 0, wave = 0;
    const r = this.reaction;
    if (r) {
      const k = (now - r.t0) / r.dur;
      if (k >= 1) this.reaction = null;
      else {
        const s = Math.sin(k * Math.PI);
        switch (r.type) {
          case 'jump':
          case 'startle': {
            const h = r.type === 'jump' ? 38 : 22;
            if (k < 0.15) { sy = 1 - 0.16 * Math.sin((k / 0.15) * Math.PI); }
            else if (k > 0.85) { sy = 1 - 0.16 * Math.sin(((k - 0.85) / 0.15) * Math.PI); }
            else { const q = (k - 0.15) / 0.7; jumpY = h * 4 * q * (1 - q); sy = 1.07; }
            sx = 2 - sy;
            break;
          }
          case 'hop': jumpY = 10 * s; break;
          case 'spin': spinX = Math.cos(k * Math.PI * 2); jumpY = 12 * s; break;
          case 'happy': jumpY = 9 * Math.abs(Math.sin(k * Math.PI * 2)); break;
          case 'shake': headShake = 11 * Math.sin(k * Math.PI * 6) * (1 - k); break;
          case 'wave': wave = 1; break;
          case 'land': sy = 1 - 0.2 * s; sx = 1 + 0.14 * s; break;
        }
      }
    }

    // ---- continuous motion ----
    const breath = sleeping ? 0.035 * Math.sin(T * 1.5) : 0.018 * Math.sin(T * 2.4);
    const cyc = T * 11;
    const bob = walking ? Math.abs(Math.sin(cyc)) * 3 : 0;

    this.flip += (this.dir - this.flip) * Math.min(1, dt * 12);

    // drag pendulum (critically-ish damped spring)
    if (dragging) {
      const sw = this.swing;
      sw.v += ((sw.target - sw.a) * 60 - sw.v * 9) * dt;
      sw.a += sw.v * dt;
      sw.target *= Math.pow(0.02, dt); // drift back to vertical when the mouse stops
    } else {
      this.swing.a *= Math.pow(0.0005, dt);
      this.swing.v = 0;
    }

    // root
    if (p.root) {
      const lean = walking ? 4 * this.dir : 0;
      p.root.setAttribute(
        'transform',
        [
          tr(0, -(jumpY + bob)),
          rot(this.swing.a + lean, dragging ? [60, 30] : piv.root),
          scaleAt(this.flip * spinX * sx, sy, piv.root),
        ].join(' '),
      );
    }
    if (p.shadow) {
      const lift = jumpY + (dragging ? 30 : 0);
      const k = clamp(1 - lift / 70, 0.35, 1);
      p.shadow.setAttribute('transform', scaleAt(k, k, [60, 113]));
      p.shadow.setAttribute('opacity', String(0.16 * k));
    }

    // body breathing
    p.body?.setAttribute('transform', scaleAt(1 - breath * 0.4, 1 + breath, piv.body));

    // legs
    const legA = walking ? -Math.max(0, Math.sin(cyc)) * 4 : dragging ? 3 + Math.sin(T * 8) : 0;
    const legB = walking ? -Math.max(0, -Math.sin(cyc)) * 4 : dragging ? 3 - Math.sin(T * 8) : 0;
    p.legL?.setAttribute('transform', tr(0, legA));
    p.legR?.setAttribute('transform', tr(0, legB));

    // arms (human)
    if (piv.armL && piv.armR) {
      let aL = 4 * Math.sin(T * 2), aR = -4 * Math.sin(T * 2);
      if (walking) { aL = 22 * Math.sin(cyc); aR = -22 * Math.sin(cyc); }
      if (dragging) { aL = 50 + 6 * Math.sin(T * 9); aR = -50 - 6 * Math.sin(T * 9); }
      if (happy) { aL = 35 + 15 * Math.sin(T * 14); aR = -35 - 15 * Math.sin(T * 14); }
      if (wave) aR = -130 + 22 * Math.sin(T * 16);
      if (sleeping) { aL = 2; aR = -2; }
      p.armL?.setAttribute('transform', rot(aL, piv.armL));
      p.armR?.setAttribute('transform', rot(aR, piv.armR));
    }

    // tail
    if (piv.tail && p.tail) {
      let a = 8 * Math.sin(T * 1.6);
      if (walking) a = 14 * Math.sin(T * 6);
      if (this.hover || happy) a = 22 * Math.sin(T * 16);
      if (sleeping) a = 3 * Math.sin(T * 0.8);
      if (dragging) a = -25 + 10 * Math.sin(T * 7);
      p.tail.setAttribute('transform', rot(a, piv.tail));
    }

    // gaze (smoothed)
    const gz = this.gazeTarget;
    this.gaze.x += (gz.x * this.flip - this.gaze.x) * Math.min(1, dt * 10);
    this.gaze.y += (gz.y - this.gaze.y) * Math.min(1, dt * 10);

    // head
    if (p.head) {
      let tilt = 2.5 * Math.sin(T * 0.9);
      let dy = -bob * 0.3 - breath * 20;
      if (this.hover) tilt = 7 * this.gaze.x;
      if (sleeping) { tilt = 5; dy = 3 + breath * 30; }
      if (dragging) tilt = -this.swing.a * 0.4;
      p.head.setAttribute('transform', `${tr(0, dy)} ${rot(tilt + headShake, piv.head)}`);
    }

    // ears
    if (now > this.twitch.next) {
      this.twitch = { side: Math.random() < 0.5 ? -1 : 1, t0: now, next: now + 2500 + Math.random() * 5000 };
    }
    const tw = now - this.twitch.t0 < 180 ? 1 : 0;
    if (piv.earL && piv.earR && p.earL && p.earR) {
      const floppy = this.p.tail && this.piv === PIVOTS.dog;
      let eL = 0, eR = 0;
      if (floppy) {
        eL = walking ? 8 * Math.sin(cyc) : 3 * Math.sin(T * 1.3);
        eR = -eL;
        if (this.hover) { eL -= 10; eR += 10; }
        if (dragging) { eL = 25; eR = -25; }
      } else {
        if (tw) { if (this.twitch.side < 0) eL = -14; else eR = 14; }
        if (this.hover) { eL -= 4; eR += 4; }
        if (sleeping) { eL = 10; eR = -10; }
        if (surprised) { eL = -6; eR = 6; }
      }
      p.earL.setAttribute('transform', rot(eL, piv.earL));
      p.earR.setAttribute('transform', rot(eR, piv.earR));
    }

    // blink
    if (this.nextBlink === 0) this.nextBlink = now + 1500;
    if (now > this.nextBlink) {
      this.blinkStart = now;
      this.nextBlink = now + 2200 + Math.random() * 4200;
      if (Math.random() < 0.18) this.nextBlink = now + 260; // occasional double blink
    }
    const bk = this.blinkStart >= 0 ? (now - this.blinkStart) / 140 : 1;
    let lid = bk < 1 ? Math.abs(1 - bk * 2) : 1; // 1 open -> 0 closed -> 1 open
    if (sleeping) lid = 0.1;
    const eyeScale = surprised ? 1.2 : 1;

    const showHappyEyes = happy && !sleeping;
    if (p.eyes) p.eyes.style.display = showHappyEyes ? 'none' : '';
    if (p.eyesHappy) p.eyesHappy.style.display = showHappyEyes ? '' : 'none';
    const gx = this.gaze.x * 2.6, gy = this.gaze.y * 2;
    for (const side of ['eyeL', 'eyeR'] as const) {
      p[side]?.setAttribute('transform', `${tr(gx, gy)} ${scaleAt(eyeScale, Math.max(0.08, lid) * eyeScale, piv[side])}`);
    }

    // blush & mouth
    if (p.blush) p.blush.setAttribute('opacity', String(happy ? 0.95 : this.hover ? 0.75 : 0.35));
    const open = !sleeping && (now < this.talkUntil ? Math.sin(T * 18) > -0.2 : surprised || happy);
    if (p.mouth) p.mouth.style.display = open ? 'none' : '';
    if (p.mouthOpen) p.mouthOpen.style.display = open ? '' : 'none';
  }
}
