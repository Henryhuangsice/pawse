import './pet.css';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { loadConfig, onConfigChange, saveConfig, PET_KINDS, type AppConfig, type PetKind } from '../shared/config';
import { line, petName, setLang, t } from '../shared/i18n';
import { Animator, type Reaction } from './animator';
import { petSVG } from './art';
import { openRoamEditor } from './roamEditor';

const BASE = 120; // pet art size in px at scale 1
const WALK_SPEED = 62; // px/s at scale 1

type State = 'idle' | 'walk' | 'sleep' | 'drag' | 'return';
interface Box { x: number; y: number; w: number; h: number }

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

class Pet {
  cfg: AppConfig;
  anim!: Animator;
  size = BASE;
  x = 0;
  y = 0;
  state: State = 'idle';
  stateT = 0;
  stateDur = 2;
  target = { x: 0, y: 0 };
  cursor = { x: -1e4, y: -1e4 };
  prevCursor = { x: -1e4, y: -1e4 };
  hover = false;
  lastInteract = performance.now();
  clicks: number[] = [];
  strokes: number[] = [];
  strokeDir = 0;
  lastPetLine = 0;
  glanceAt = 0;
  zzzAt = 0;
  editing = false;
  menuOpen = false;
  bubbleUntil = 0;
  lastSentHit = '';
  lastHitAt = 0;

  petEl = $<HTMLDivElement>('#pet');
  artEl = $<HTMLDivElement>('#pet-art');
  bubbleEl = $<HTMLDivElement>('#bubble');
  menuEl = $<HTMLDivElement>('#menu');
  fxEl = $<HTMLDivElement>('#fx');

  constructor(cfg: AppConfig) {
    this.cfg = cfg;
    this.mountArt();
    this.applyScale();
    this.place();
    this.bindPointer();
  }

  /** Drop the pet at a random spot inside the roam area. */
  place() {
    const b = this.bounds();
    this.x = rand(b.minX, b.maxX);
    this.y = rand(b.minY, b.maxY);
  }

  // ---------- setup ----------
  get name() {
    return petName(this.cfg.pet.kind, this.cfg.pet.name);
  }

  mountArt() {
    this.artEl.innerHTML = petSVG(this.cfg.pet.kind);
    this.anim = new Animator(this.artEl.querySelector('svg')!, this.cfg.pet.kind);
  }

  applyScale() {
    this.size = BASE * this.cfg.pet.scale;
    this.petEl.style.width = this.petEl.style.height = `${this.size}px`;
  }

  roamPx(): Box {
    const r = this.cfg.roam;
    const W = window.innerWidth, H = window.innerHeight;
    return { x: r.x * W, y: r.y * H, w: r.w * W, h: r.h * H };
  }

  /** Valid top-left positions so the whole pet stays inside the roam area. */
  bounds() {
    const r = this.roamPx();
    const s = this.size;
    const minX = r.x, minY = r.y;
    const maxX = Math.max(minX, r.x + r.w - s);
    const maxY = Math.max(minY, r.y + r.h - s);
    return { minX, maxX, minY, maxY };
  }

  inBounds() {
    const b = this.bounds();
    return this.x >= b.minX - 1 && this.x <= b.maxX + 1 && this.y >= b.minY - 1 && this.y <= b.maxY + 1;
  }

  setState(s: State, dur = 0) {
    this.state = s;
    this.stateT = 0;
    this.stateDur = dur;
    this.anim.mode = s === 'return' ? 'walk' : s;
  }

  // ---------- behaviour ----------
  update(dt: number, now: number) {
    this.stateT += dt;
    this.updateHover(now);

    switch (this.state) {
      case 'idle':
        if (!this.hover && !this.menuOpen && this.stateT > this.stateDur && !this.anim.isReacting) this.decide(now);
        break;
      case 'walk':
      case 'return': {
        if (this.hover && this.state === 'walk') { this.anim.mode = 'idle'; break; }
        this.anim.mode = 'walk';
        const speed = WALK_SPEED * this.cfg.pet.scale * (this.state === 'return' ? 1.8 : 1);
        const dx = this.target.x - this.x, dy = this.target.y - this.y;
        const d = Math.hypot(dx, dy);
        if (d < 2) { this.setState('idle', rand(2, 6)); break; }
        const step = Math.min(d, speed * dt);
        this.x += (dx / d) * step;
        this.y += (dy / d) * step;
        if (Math.abs(dx) > 1) this.anim.dir = dx > 0 ? 1 : -1;
        break;
      }
      case 'sleep':
        if (now > this.zzzAt) { this.spawnFx('z', 'Z'); this.zzzAt = now + 1500; }
        if (this.stateT > this.stateDur) this.setState('idle', rand(2, 4));
        break;
      case 'drag':
        break;
    }

    // keep inside if the roam area or screen changed under us
    if (this.state !== 'drag' && this.state !== 'return' && !this.inBounds()) this.walkBack();
    this.updateGaze(now);
  }

  decide(now: number) {
    const idleFor = now - this.lastInteract;
    const r = Math.random();
    if (idleFor > 120_000 && r < 0.2) {
      this.setState('sleep', rand(25, 70));
      if (Math.random() < 0.4) this.say(line('sleep', this.cfg.pet.kind));
      return;
    }
    if (r < 0.6) {
      const b = this.bounds();
      this.target = { x: rand(b.minX, b.maxX), y: rand(b.minY, b.maxY) };
      this.setState('walk');
      return;
    }
    if (r < 0.7) this.anim.react('hop');
    this.setState('idle', rand(2, 5));
  }

  walkBack() {
    const b = this.bounds();
    this.target = { x: clamp(this.x, b.minX, b.maxX), y: clamp(this.y, b.minY, b.maxY) };
    this.setState('return');
  }

  hitBox(): Box {
    const s = this.size;
    return { x: this.x + s * 0.12, y: this.y + s * 0.06, w: s * 0.76, h: s * 0.94 };
  }

  updateHover(now: number) {
    const c = this.cursor;
    const b = this.hitBox();
    const inside = c.x >= b.x && c.x <= b.x + b.w && c.y >= b.y && c.y <= b.y + b.h;
    if (inside !== this.hover) {
      this.hover = inside;
      this.anim.hover = inside && this.state !== 'sleep';
      if (inside && this.state !== 'sleep' && this.state !== 'drag' && Math.random() < 0.35) this.anim.react('hop');
      if (inside) this.lastInteract = now;
    }

    // petting: rub back and forth over the head
    if (inside && this.state !== 'drag' && c.y < b.y + b.h * 0.55) {
      const dx = c.x - this.prevCursor.x;
      if (Math.abs(dx) > 2.5) {
        const d = Math.sign(dx);
        if (d !== this.strokeDir) { this.strokes.push(now); this.strokeDir = d; }
      }
      this.strokes = this.strokes.filter((ts) => now - ts < 1300);
      if (this.strokes.length >= 5) {
        this.strokes = [];
        this.onPetted(now);
      }
    }
    this.prevCursor = { ...c };
  }

  updateGaze(now: number) {
    const s = this.size;
    const cx = this.x + s / 2, cy = this.y + s * 0.42;
    const dx = this.cursor.x - cx, dy = this.cursor.y - cy;
    const dist = Math.hypot(dx, dy);
    if (this.hover || dist < 380) {
      this.anim.lookAt(dx / Math.max(80, dist), dy / Math.max(80, dist));
    } else if (this.anim.mode === 'walk') {
      this.anim.lookAt(this.anim.dir * 0.6, 0.1);
    } else if (now > this.glanceAt) {
      this.anim.lookAt(rand(-0.8, 0.8), rand(-0.5, 0.4));
      this.glanceAt = now + rand(1500, 4000);
    }
  }

  // ---------- interactions ----------
  bindPointer() {
    let down: { x: number; y: number; px: number; py: number; moved: boolean; lx: number; lt: number } | null = null;

    this.petEl.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || this.editing) return;
      this.closeMenu();
      down = { x: e.clientX, y: e.clientY, px: this.x, py: this.y, moved: false, lx: e.clientX, lt: performance.now() };
      this.petEl.setPointerCapture(e.pointerId);
    });

    this.petEl.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (!down.moved && Math.hypot(dx, dy) > 4) {
        down.moved = true;
        this.setState('drag');
        void invoke('set_interactive_lock', { lock: true });
      }
      if (down.moved) {
        const now = performance.now();
        const vt = Math.max(1, now - down.lt);
        this.anim.dragVelocity(((e.clientX - down.lx) / vt) * 1000);
        down.lx = e.clientX;
        down.lt = now;
        this.x = clamp(down.px + dx, -this.size * 0.3, window.innerWidth - this.size * 0.7);
        this.y = clamp(down.py + dy, -this.size * 0.3, window.innerHeight - this.size * 0.7);
      }
    });

    const finish = (e: PointerEvent) => {
      if (!down) return;
      const wasDrag = down.moved;
      down = null;
      if (this.petEl.hasPointerCapture(e.pointerId)) this.petEl.releasePointerCapture(e.pointerId);
      if (wasDrag) {
        void invoke('set_interactive_lock', { lock: false });
        this.anim.react('land');
        this.lastInteract = performance.now();
        if (Math.random() < 0.35) this.say(line('dropped', this.cfg.pet.kind));
        if (!this.inBounds()) this.walkBack();
        else this.setState('idle', rand(2, 4));
      } else if (e.type === 'pointerup') {
        this.onClick(performance.now());
      }
    };
    this.petEl.addEventListener('pointerup', finish);
    this.petEl.addEventListener('pointercancel', finish);

    this.petEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.openMenu();
    });
  }

  onClick(now: number) {
    this.lastInteract = now;
    const kind = this.cfg.pet.kind;
    if (this.state === 'sleep') {
      this.setState('idle', 3);
      this.anim.react('startle');
      this.say(line('wake', kind));
      return;
    }
    this.clicks = this.clicks.filter((ts) => now - ts < 2000);
    this.clicks.push(now);
    if (this.clicks.length >= 5) {
      this.clicks = [];
      this.anim.react('shake');
      this.say(line('annoyed', kind));
      return;
    }
    if (this.state === 'walk') this.setState('idle', 3);
    const options: Reaction[] = ['jump', 'spin', 'happy', 'happy'];
    if (kind === 'human') options.push('powerup', 'powerup', 'wave');
    if (kind === 'dog') options.push('glitch');
    const r = pick(options);
    this.anim.react(r, now);
    if (r === 'happy') this.burstHearts(3);
    if (r === 'powerup') this.say(line('power', kind));
    else if (Math.random() < 0.65) this.say(line('click', kind));
  }

  onPetted(now: number) {
    this.lastInteract = now;
    if (this.state === 'sleep') this.setState('idle', 3);
    this.anim.happy(1800, now);
    this.burstHearts(2);
    if (now - this.lastPetLine > 4000) {
      this.say(line('petting', this.cfg.pet.kind));
      this.lastPetLine = now;
    }
  }

  // ---------- bubble / fx ----------
  say(text: string, ms = 3200) {
    this.bubbleEl.textContent = text;
    this.bubbleEl.classList.remove('hidden');
    this.bubbleUntil = performance.now() + ms;
    this.anim.talk(Math.min(1200, 120 * text.length));
  }

  spawnFx(cls: string, text: string, dx = 0) {
    const el = document.createElement('div');
    el.className = `fx fx-${cls}`;
    el.textContent = text;
    el.style.left = `${this.x + this.size * 0.62 + dx}px`;
    el.style.top = `${this.y + this.size * 0.12}px`;
    el.style.fontSize = `${14 * this.cfg.pet.scale + 4}px`;
    this.fxEl.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }

  burstHearts(n: number) {
    for (let i = 0; i < n; i++) setTimeout(() => this.spawnFx('heart', '♥', rand(-30, 10)), i * 140);
  }

  // ---------- menu ----------
  openMenu() {
    const kind = this.cfg.pet.kind;
    const sleeping = this.state === 'sleep';
    this.menuEl.innerHTML = `
      <div class="menu-title">${escapeHtml(this.name)}</div>
      <button data-a="pet">🤚 ${t('menu.pet')}</button>
      <button data-a="${sleeping ? 'wake' : 'sleep'}">${sleeping ? '☀️ ' + t('menu.wake') : '💤 ' + t('menu.sleep')}</button>
      <div class="menu-label">${t('menu.switch')}</div>
      <div class="menu-kinds">${PET_KINDS.map(
        (k) => `<button data-kind="${k}" class="${k === kind ? 'on' : ''}">${{ cat: '👾', dog: '🤖', human: '⚡' }[k]} ${t(`kind.${k}`)}</button>`,
      ).join('')}</div>
      <hr/>
      <button data-a="roam">🗺️ ${t('menu.roam')}</button>
      <button data-a="settings">⚙️ ${t('menu.settings')}</button>
      <button data-a="hide">🙈 ${t('menu.hide')}</button>
      <button data-a="quit" class="danger">⏻ ${t('menu.quit')}</button>`;
    this.menuEl.classList.remove('hidden');
    this.menuOpen = true;
    this.positionMenu();
    if (this.state === 'walk') this.setState('idle', 3);
    void getCurrentWindow().setFocus();
  }

  positionMenu() {
    // offset* ignores the pop-in scale animation (getBoundingClientRect would report ~70%)
    const m = { width: this.menuEl.offsetWidth, height: this.menuEl.offsetHeight };
    const s = this.size;
    let left = this.x + s * 0.9;
    if (left + m.width > window.innerWidth - 8) left = this.x + s * 0.1 - m.width;
    const top = clamp(this.y + s * 0.1, 8, window.innerHeight - m.height - 8);
    this.menuEl.style.left = `${clamp(left, 8, window.innerWidth - m.width - 8)}px`;
    this.menuEl.style.top = `${top}px`;
  }

  closeMenu() {
    if (!this.menuOpen) return;
    this.menuOpen = false;
    this.menuEl.classList.add('hidden');
  }

  async onMenu(target: HTMLElement) {
    const btn = target.closest('button');
    if (!btn) return;
    const kind = btn.dataset.kind as PetKind | undefined;
    const a = btn.dataset.a;
    this.closeMenu();
    const now = performance.now();
    if (kind && kind !== this.cfg.pet.kind) {
      await saveConfig({ ...this.cfg, pet: { ...this.cfg.pet, kind } });
      return;
    }
    switch (a) {
      case 'pet': this.onPetted(now); break;
      case 'sleep': this.setState('sleep', rand(40, 90)); this.say(line('sleep', this.cfg.pet.kind)); break;
      case 'wake': this.onClick(now); break;
      case 'roam': this.editRoam(); break;
      case 'settings': await invoke('open_settings'); break;
      case 'hide': await invoke('toggle_pet', { visible: false }); break;
      case 'quit': await invoke('quit_app'); break;
    }
  }

  // ---------- roam editing ----------
  editRoam() {
    if (this.editing) return;
    this.editing = true;
    this.closeMenu();
    void invoke('set_interactive_lock', { lock: true });
    void getCurrentWindow().setFocus();
    openRoamEditor(this.cfg.roam, this.size, async (r) => {
      this.editing = false;
      await invoke('set_interactive_lock', { lock: false });
      if (r) await saveConfig({ ...this.cfg, roam: r });
      this.flashRoam();
    });
  }

  flashRoam() {
    const r = this.roamPx();
    const el = document.createElement('div');
    el.className = 'roam-flash';
    Object.assign(el.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }

  // ---------- config ----------
  applyConfig(next: AppConfig) {
    const prev = this.cfg;
    this.cfg = next;
    setLang(next.lang);
    if (prev.lang !== next.lang) void invoke('set_locale', { lang: setLang(next.lang) });
    if (prev.pet.kind !== next.pet.kind) {
      this.mountArt();
      this.anim.react('spin');
      this.say(line('switch', next.pet.kind));
    }
    if (prev.pet.scale !== next.pet.scale) this.applyScale();
    if (JSON.stringify(prev.roam) !== JSON.stringify(next.roam) && !this.inBounds()) this.walkBack();
  }

  // ---------- render ----------
  render(now: number) {
    this.petEl.style.transform = `translate(${this.x.toFixed(1)}px, ${this.y.toFixed(1)}px)`;
    this.petEl.classList.toggle('dragging', this.state === 'drag');

    if (!this.bubbleEl.classList.contains('hidden')) {
      if (now > this.bubbleUntil) this.bubbleEl.classList.add('hidden');
      else {
        const bw = this.bubbleEl.offsetWidth, bh = this.bubbleEl.offsetHeight;
        const left = clamp(this.x + this.size / 2 - bw / 2, 6, window.innerWidth - bw - 6);
        const top = Math.max(6, this.y - bh + this.size * 0.02);
        this.bubbleEl.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px)`;
        this.bubbleEl.style.setProperty('--tail-x', `${clamp(this.x + this.size / 2 - left, 14, bw - 14)}px`);
      }
    }
    this.syncHitRegions(now);
  }

  /** Tell Rust which rectangles should receive the mouse; everything else clicks through to the desktop. */
  syncHitRegions(now: number) {
    if (now - this.lastHitAt < 40) return;
    const rects: Box[] = [this.hitBox()];
    if (!this.bubbleEl.classList.contains('hidden')) rects.push(toBox(this.bubbleEl.getBoundingClientRect()));
    if (this.menuOpen) rects.push(toBox(this.menuEl.getBoundingClientRect()));
    const key = rects.map((r) => `${r.x | 0},${r.y | 0},${r.w | 0},${r.h | 0}`).join(';');
    if (key === this.lastSentHit) return;
    this.lastSentHit = key;
    this.lastHitAt = now;
    void invoke('set_hit_regions', { rects: rects.map((r) => pad(r, 4)) });
  }
}

const toBox = (r: DOMRect): Box => ({ x: r.left, y: r.top, w: r.width, h: r.height });
const pad = (r: Box, p: number): Box => ({ x: r.x - p, y: r.y - p, w: r.w + 2 * p, h: r.h + 2 * p });
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

async function boot() {
  const cfg = await loadConfig();
  const lang = setLang(cfg.lang);
  void invoke('set_locale', { lang });

  const pet = new Pet(cfg);
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  pet.menuEl.addEventListener('click', (e) => void pet.onMenu(e.target as HTMLElement));
  window.addEventListener('blur', () => pet.closeMenu());
  window.addEventListener('keydown', (e) => e.key === 'Escape' && pet.closeMenu());
  // The overlay is created small and then stretched to the monitor by Rust, so re-place on
  // early resizes; later resizes (monitor change) make the pet walk back into its area.
  const bootAt = performance.now();
  window.addEventListener('resize', () => {
    if (performance.now() - bootAt < 4000) pet.place();
    else if (!pet.inBounds()) pet.walkBack();
  });

  await listen<[number, number]>('cursor', (e) => {
    pet.cursor = { x: e.payload[0], y: e.payload[1] };
  });
  await listen('edit-roam', () => pet.editRoam());
  await onConfigChange((c) => pet.applyConfig(c));

  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    pet.update(dt, now);
    pet.anim.update(dt, now);
    pet.render(now);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  pet.anim.react('jump');
  setTimeout(() => pet.say(line('greet', pet.cfg.pet.kind, { name: pet.name })), 500);
}

void boot();
