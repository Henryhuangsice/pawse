import type { PetKind } from '../shared/config';
import { META, PX, type PetMeta } from './art';

export type AnimMode = 'idle' | 'walk' | 'sleep' | 'drag';
export type Reaction = 'jump' | 'spin' | 'happy' | 'shake' | 'startle' | 'wave' | 'land' | 'hop' | 'powerup';

const DURATION: Record<Reaction, number> = {
  jump: 620, spin: 700, happy: 1100, shake: 650, startle: 520,
  wave: 1400, land: 280, hop: 320, powerup: 1100,
};

const PART_NAMES = [
  'root', 'body', 'head', 'tail', 'tail2', 'earL', 'earR', 'legL', 'legR', 'armL', 'armR',
  'eyeL', 'eyeR', 'eyes', 'eyesHappy', 'eyesClosed', 'blush', 'mouth', 'mouthOpen', 'shadow',
  'aura', 'aura2', 'ring', 'sparks', 'backdrop', 'trail', 'trail2', 'starsA', 'starsB',
  'flameL', 'flameR', 'flutter',
] as const;
type PartName = (typeof PART_NAMES)[number];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const rot = (a: number, [cx, cy]: [number, number]) => `rotate(${a.toFixed(2)} ${cx} ${cy})`;
const scaleAt = (sx: number, sy: number, [cx, cy]: [number, number]) =>
  `translate(${cx} ${cy}) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(${-cx} ${-cy})`;
const tr = (x: number, y: number) => `translate(${x.toFixed(2)} ${y.toFixed(2)})`;
const q = (v: number) => Math.round(v / PX) * PX; // snap to the pixel grid
const show = (el: SVGGraphicsElement | undefined, on: boolean) => el && (el.style.display = on ? '' : 'none');

/**
 * Procedural animation for a part-rigged SVG pet. No sprite sheets:
 * breathing, blinking, gaze, walk cycle, tail, ears, squash & stretch and drag swing are
 * computed per frame from the current mode + transient reactions, then applied according
 * to the pet's render style (pixel-snapped, flat, or power-up).
 */
export class Animator {
  mode: AnimMode = 'idle';
  dir: 1 | -1 = 1;
  hover = false;

  private p: Partial<Record<PartName, SVGGraphicsElement>> = {};
  private powerOn: SVGGraphicsElement[];
  private powerOff: SVGGraphicsElement[];
  private m: PetMeta;
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
  private flip = 1;
  private lastStep = 0;
  private power = 0;
  private powerHoldUntil = 0;

  constructor(svg: SVGSVGElement, kind: PetKind) {
    for (const n of PART_NAMES) {
      const el = svg.querySelector<SVGGraphicsElement>(`[data-p="${n}"]`);
      if (el) this.p[n] = el;
    }
    this.powerOn = [...svg.querySelectorAll<SVGGraphicsElement>('[data-power]')];
    this.powerOff = [...svg.querySelectorAll<SVGGraphicsElement>('[data-unpower]')];
    this.m = META[kind];
  }

  lookAt(x: number, y: number) {
    this.gazeTarget.x = clamp(x, -1, 1);
    this.gazeTarget.y = clamp(y, -1, 1);
  }

  react(type: Reaction, now = performance.now()) {
    this.reaction = { type, t0: now, dur: DURATION[type] };
    if (type === 'happy' || type === 'wave') this.happyUntil = now + DURATION[type] + 300;
    if (type === 'startle') this.surpriseUntil = now + 700;
    if (type === 'powerup') this.powerHoldUntil = now + 3200;
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
    const m = this.m;
    // pixel art steps at 12 fps for that chunky sprite feel
    if (m.style === 'pixel') {
      if (now - this.lastStep < 83) return;
      dt = Math.min(0.1, (now - this.lastStep) / 1000);
      this.lastStep = now;
    }

    const T = now / 1000;
    const p = this.p;
    const sleeping = this.mode === 'sleep';
    const walking = this.mode === 'walk';
    const dragging = this.mode === 'drag';
    const happy = now < this.happyUntil;
    const surprised = now < this.surpriseUntil || dragging;

    // ---- transient reaction curve ----
    let jumpY = 0, sx = 1, sy = 1, spinX = 1, headShake = 0, wave = 0, quake = 0;
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
            if (k < 0.15) sy = 1 - 0.16 * Math.sin((k / 0.15) * Math.PI);
            else if (k > 0.85) sy = 1 - 0.16 * Math.sin(((k - 0.85) / 0.15) * Math.PI);
            else { const u = (k - 0.15) / 0.7; jumpY = h * 4 * u * (1 - u); sy = 1.07; }
            sx = 2 - sy;
            break;
          }
          case 'hop': jumpY = 10 * s; break;
          case 'spin': spinX = Math.cos(k * Math.PI * 2); jumpY = 12 * s; break;
          case 'happy': jumpY = 9 * Math.abs(Math.sin(k * Math.PI * 2)); break;
          case 'shake': headShake = 11 * Math.sin(k * Math.PI * 6) * (1 - k); break;
          case 'wave': wave = 1; break;
          case 'land': sy = 1 - 0.2 * s; sx = 1 + 0.14 * s; break;
          case 'powerup':
            if (k < 0.35) { sy = 1 - 0.12 * Math.sin((k / 0.35) * Math.PI); sx = 2 - sy; quake = 1.6; }
            else { jumpY = 14 * Math.sin(((k - 0.35) / 0.65) * Math.PI); quake = 0.8; }
            break;
        }
      }
    }

    // ---- shared continuous motion ----
    const breath = sleeping ? 0.035 * Math.sin(T * 1.5) : 0.018 * Math.sin(T * 2.4);
    const cyc = T * (m.style === 'pixel' ? 8 : 11);
    const bob = walking ? Math.abs(Math.sin(cyc)) * 3 : 0;
    this.flip += (this.dir - this.flip) * Math.min(1, dt * 12);

    if (dragging) {
      const sw = this.swing;
      sw.v += ((sw.target - sw.a) * 60 - sw.v * 9) * dt;
      sw.a += sw.v * dt;
      sw.target *= Math.pow(0.02, dt);
    } else {
      this.swing.a *= Math.pow(0.0005, dt);
      this.swing.v = 0;
    }

    const gz = this.gazeTarget;
    this.gaze.x += (gz.x * Math.sign(this.flip || 1) - this.gaze.x) * Math.min(1, dt * 10);
    this.gaze.y += (gz.y - this.gaze.y) * Math.min(1, dt * 10);

    // blink
    if (this.nextBlink === 0) this.nextBlink = now + 1500;
    if (now > this.nextBlink) {
      this.blinkStart = now;
      this.nextBlink = now + 2200 + Math.random() * 4200;
      if (Math.random() < 0.18) this.nextBlink = now + 260;
    }
    const bk = this.blinkStart >= 0 ? (now - this.blinkStart) / (m.style === 'pixel' ? 170 : 140) : 1;
    let lid = bk < 1 ? Math.abs(1 - bk * 2) : 1;
    if (sleeping) lid = 0.1;

    const showHappyEyes = happy && !sleeping;
    const mouthOpen = !sleeping && (now < this.talkUntil ? Math.sin(T * 18) > -0.2 : surprised || happy);
    show(p.mouth, !mouthOpen);
    show(p.mouthOpen, mouthOpen);
    if (p.blush) p.blush.setAttribute('opacity', String(happy ? 0.95 : this.hover ? 0.75 : 0.35));

    if (m.style === 'pixel') {
      this.applyPixel({ T, jumpY, bob, spinX, cyc, walking, dragging, sleeping, lid, showHappyEyes });
      return;
    }

    // ---- smooth styles (flat / power) ----
    // flyers hover on their thrusters and only touch down to nap
    const fly = !!m.fly;
    const lift = !fly ? 0 : sleeping ? -8 : 3 + 3 * Math.sin(T * (walking ? 4.5 : 2.6));
    if (p.root) {
      const lean = walking ? (fly ? 12 : 4) * this.dir : 0;
      const jx = quake ? (Math.random() - 0.5) * 2 * quake : 0;
      p.root.setAttribute('transform', [
        tr(jx, -(jumpY + (fly ? 0 : bob) + lift)),
        rot(this.swing.a + lean, dragging ? [60, 30] : m.root),
        scaleAt(this.flip * spinX * sx, sy, m.root),
      ].join(' '));
    }
    if (p.shadow) {
      const up = jumpY + Math.max(0, lift) * 2 + (dragging ? 30 : 0);
      const k = clamp(1 - up / 70, 0.35, 1);
      p.shadow.setAttribute('transform', scaleAt(k, k, [60, 113]));
    }

    p.body?.setAttribute('transform', scaleAt(1 - breath * 0.4, 1 + breath, m.body));

    const legA = walking ? -Math.max(0, Math.sin(cyc)) * 4 : dragging ? 3 + Math.sin(T * 8) : 0;
    const legB = walking ? -Math.max(0, -Math.sin(cyc)) * 4 : dragging ? 3 - Math.sin(T * 8) : 0;
    if (fly) {
      // paws dangle in the air
      const d = sleeping ? 0 : walking ? 10 : 4;
      p.legL?.setAttribute('transform', rot(d * Math.sin(T * 3), m.legL));
      p.legR?.setAttribute('transform', rot(d * Math.sin(T * 3 + 1.2), m.legR));
    } else {
      p.legL?.setAttribute('transform', tr(0, legA));
      p.legR?.setAttribute('transform', tr(0, legB));
    }

    // thruster flames: flicker, boost when moving / hovered / happy, off while napping
    for (const [part, x] of [['flameL', 40], ['flameR', 80]] as const) {
      const el = p[part];
      if (!el) continue;
      show(el, !sleeping);
      const boost = walking || this.hover || happy || dragging ? 1.45 : 1;
      const h = boost * (1 + 0.18 * Math.sin(T * 31 + x) + 0.12 * Math.random());
      el.setAttribute('transform', scaleAt(1 + 0.06 * Math.sin(T * 23 + x), h, [x, 86]));
    }
    if (p.flutter) {
      const a = sleeping ? 2 : (walking ? 14 : 7) * Math.sin(T * (walking ? 9 : 4));
      p.flutter.setAttribute('transform', rot(a, [70, 70]));
    }

    if (m.armL && m.armR) {
      let aL = 4 * Math.sin(T * 2), aR = -4 * Math.sin(T * 2);
      if (walking) { aL = 22 * Math.sin(cyc); aR = -22 * Math.sin(cyc); }
      if (this.power > 0.4) { aL = 28 + 4 * Math.sin(T * 30); aR = -28 - 4 * Math.sin(T * 30); } // fists clenched, charging
      if (dragging) { aL = 50 + 6 * Math.sin(T * 9); aR = -50 - 6 * Math.sin(T * 9); }
      if (happy) { aL = 35 + 15 * Math.sin(T * 14); aR = -35 - 15 * Math.sin(T * 14); }
      if (wave) aR = -130 + 22 * Math.sin(T * 16);
      if (sleeping) { aL = 2; aR = -2; }
      p.armL?.setAttribute('transform', rot(aL, m.armL));
      p.armR?.setAttribute('transform', rot(aR, m.armR));
    }

    if (m.tail && p.tail) {
      let a = 8 * Math.sin(T * 1.6);
      if (walking) a = 14 * Math.sin(T * 6);
      if (this.hover || happy) a = 22 * Math.sin(T * 16);
      if (sleeping) a = 3 * Math.sin(T * 0.8);
      if (dragging) a = -25 + 10 * Math.sin(T * 7);
      p.tail.setAttribute('transform', rot(a, m.tail));
    }

    if (p.head) {
      let tilt = 2.5 * Math.sin(T * 0.9);
      let dy = -bob * 0.3 - breath * 20;
      if (this.hover) tilt = 7 * this.gaze.x;
      if (sleeping) { tilt = 5; dy = 3 + breath * 30; }
      if (dragging) tilt = -this.swing.a * 0.4;
      p.head.setAttribute('transform', `${tr(0, dy)} ${rot(tilt + headShake, m.head)}`);
    }

    if (now > this.twitch.next) {
      this.twitch = { side: Math.random() < 0.5 ? -1 : 1, t0: now, next: now + 2500 + Math.random() * 5000 };
    }
    if (m.earTwitch && m.earL && m.earR && p.earL && p.earR) {
      let eL = 0, eR = 0;
      if (now - this.twitch.t0 < 180) { if (this.twitch.side < 0) eL = -14; else eR = 14; }
      if (this.hover) { eL -= 4; eR += 4; }
      if (sleeping) { eL = 10; eR = -10; }
      if (surprised) { eL = -6; eR = 6; }
      p.earL.setAttribute('transform', rot(eL, m.earL));
      p.earR.setAttribute('transform', rot(eR, m.earR));
    }

    show(p.eyes, !showHappyEyes);
    show(p.eyesHappy, showHappyEyes);
    const eyeScale = surprised ? 1.2 : 1;
    const gx = this.gaze.x * 2.6, gy = this.gaze.y * 2;
    for (const side of ['eyeL', 'eyeR'] as const) {
      p[side]?.setAttribute('transform', `${tr(gx, gy)} ${scaleAt(eyeScale, Math.max(0.08, lid) * eyeScale, m[side])}`);
    }

    if (p.backdrop) {
      const k = happy ? 1.1 : this.hover ? 1.06 : 1 + 0.025 * Math.sin(T * 1.3);
      p.backdrop.setAttribute('transform', scaleAt(k, k, [60, 58]));
    }
    if (m.style === 'power') this.applyPower(T, dt, now, sleeping);
  }

  // ---------------- style: pixel ----------------
  private applyPixel(s: {
    T: number; jumpY: number; bob: number; spinX: number; cyc: number;
    walking: boolean; dragging: boolean; sleeping: boolean; lid: number; showHappyEyes: boolean;
  }) {
    const p = this.p, m = this.m;
    const flip = this.dir * (s.spinX < 0 ? -1 : 1);
    const shakeX = s.dragging ? q(Math.sin(s.T * 9) * 6) : 0;
    // always airborne: a slow one-pixel hover, faster while flying
    const floatY = s.sleeping ? 0 : Math.sin(s.T * (s.walking ? 7 : 3)) > 0 ? PX : 0;
    p.root?.setAttribute('transform', `${tr(shakeX, -q(s.jumpY) - floatY)} ${scaleAt(flip, 1, m.root)}`);
    if (p.shadow) p.shadow.setAttribute('opacity', String(s.jumpY > 8 || s.dragging ? 0.06 : floatY ? 0.1 : 0.14));

    // synthwave ribbon waves; it fades out while napping
    const ribbonB = Math.sin(s.T * (s.walking || s.showHappyEyes ? 14 : 6)) > 0;
    show(p.trail, !s.sleeping && !ribbonB);
    show(p.trail2, !s.sleeping && ribbonB);
    const twinkle = Math.sin(s.T * 4.2) > 0;
    show(p.starsA, twinkle);
    show(p.starsB, !twinkle);

    // head bobs one pixel: breathing at rest, nodding off while asleep
    const breathe = Math.sin(s.T * (s.sleeping ? 1.4 : 2.2)) > 0.3;
    p.head?.setAttribute('transform', tr(0, breathe || s.dragging ? PX : 0));

    const up = Math.sin(s.cyc) > 0;
    p.legL?.setAttribute('transform', tr(0, s.walking && up ? -PX : s.dragging ? PX : 0));
    p.legR?.setAttribute('transform', tr(0, s.walking && !up ? -PX : s.dragging ? PX : 0));

    // tail: swap between two frames
    const speed = s.walking || this.hover || s.showHappyEyes ? 7 : s.sleeping ? 0.8 : 2.4;
    const frameB = Math.sin(s.T * speed) > 0;
    show(p.tail, !frameB);
    show(p.tail2, frameB);

    const closed = s.sleeping || s.lid < 0.5;
    show(p.eyes, !closed && !s.showHappyEyes);
    show(p.eyesClosed, closed && !s.showHappyEyes);
    show(p.eyesHappy, s.showHappyEyes);
    const gx = Math.abs(this.gaze.x) > 0.45 ? Math.sign(this.gaze.x) * PX * 0.5 : 0;
    const gy = this.gaze.y > 0.6 ? PX * 0.5 : this.gaze.y < -0.6 ? -PX * 0.5 : 0;
    p.eyes?.setAttribute('transform', tr(gx, gy));
  }

  // ---------------- style: power ----------------
  private applyPower(T: number, dt: number, now: number, sleeping: boolean) {
    const p = this.p;
    const target = sleeping ? 0 : now < this.powerHoldUntil ? 1 : this.hover ? 0.85 : 0;
    const rate = target > this.power ? 1.8 : 0.9;
    this.power += (target - this.power) * Math.min(1, dt * rate * 3);
    const pw = this.power;

    for (const el of this.powerOn) el.setAttribute('opacity', pw.toFixed(3));
    for (const el of this.powerOff) el.setAttribute('opacity', (1 - pw).toFixed(3));

    const flick = 1 + 0.05 * Math.sin(T * 23) + 0.03 * Math.sin(T * 37);
    if (p.aura) {
      p.aura.setAttribute('opacity', (pw * 0.95).toFixed(3));
      p.aura.setAttribute('transform', scaleAt(flick * (0.8 + 0.2 * pw), flick * (0.8 + 0.2 * pw), [60, 62]));
    }
    if (p.aura2) p.aura2.setAttribute('opacity', (pw * 0.75).toFixed(3));
    if (p.ring) {
      p.ring.setAttribute('opacity', (pw * 0.85).toFixed(3));
      p.ring.setAttribute('transform', `${rot(T * 40, [60, 62])} ${scaleAt(0.9 + 0.1 * pw, 0.9 + 0.1 * pw, [60, 62])}`);
    }
    if (p.aura2) p.aura2.setAttribute('transform', tr(0, 20 - ((T * 90) % 40)));
    if (p.sparks) {
      const on = pw > 0.6 && Math.random() < 0.45;
      p.sparks.setAttribute('opacity', on ? String(pw) : '0');
      if (on) p.sparks.setAttribute('transform', tr((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6));
    }
  }
}
