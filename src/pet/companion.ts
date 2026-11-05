import { REMINDER_KINDS, toMin, type AppConfig, type ReminderKind, type WorkConfig } from '../shared/config';

/**
 * The "work buddy" brain (M2). Pure logic, no DOM: fed a presence sample every few seconds,
 * it decides when to greet, remind, cheer or stay quiet, and emits events the pet acts on.
 *
 * Design rules (the product promise is "useful, never annoying"):
 *  - Reminder timers count *time at the desk*, not wall-clock time. Leaving keyboard + mouse
 *    alone for `awayMin` means you got up, so the sitting / screen timers reset.
 *  - Never interrupt meetings or full-screen work, or during manual do-not-disturb.
 *  - Prefer natural breakpoints: right after you switch apps or pause typing.
 *  - Snooze is one click; ignoring a reminder repeatedly makes it back off.
 */

export interface Presence {
  /** seconds since the last keyboard / mouse input */
  idle: number;
  front: { app: string; bounds: { x: number; y: number; w: number; h: number } } | null;
}

export type Phase = 'off' | 'before' | 'work' | 'lunch' | 'after' | 'free';
export type Quiet = 'manual' | 'meeting' | 'fullscreen' | null;
export type Response = 'done' | 'snooze' | 'ignore';

export type CompanionEvent =
  | { type: 'phase'; phase: Phase; from: Phase | null }
  | { type: 'remind'; kind: ReminderKind }
  | { type: 'cheer' }
  | { type: 'overtime'; hours: number }
  | { type: 'welcomeBack'; awayMin: number };

/** Front-most apps that mean "I'm in a call". Browser-based meetings can't be told apart without reading titles. */
const MEETING_APPS = [
  'zoom.us', 'zoom', 'microsoft teams', 'teams', 'webex', 'cisco webex meetings', 'facetime',
  '腾讯会议', 'tencentmeeting', 'voov meeting', 'voovmeeting', '飞书会议', 'lark meetings', 'around', 'skype',
];

export function isMeetingApp(app: string) {
  const a = app.trim().toLowerCase();
  return MEETING_APPS.includes(a);
}

export function workPhase(w: WorkConfig, d: Date): Phase {
  if (!w.enabled) return 'free';
  if (!w.days.includes(d.getDay())) return 'off';
  const m = d.getHours() * 60 + d.getMinutes();
  const start = toMin(w.start), end = toMin(w.end);
  const ls = toMin(w.lunchStart), le = toMin(w.lunchEnd);
  if (m < start) return 'before';
  if (m >= end) return 'after';
  if (ls < le && m >= ls && m < le) return 'lunch';
  return 'work';
}

const BREAK_AFTER_SWITCH = 15_000; // ms after an app switch counts as a breakpoint
const SHORT_PAUSE = 4; // s of no input counts as a breakpoint
const OVERDUE_FORCE = 5 * 60; // s past due → deliver even without a breakpoint
const OVERTIME_EVERY = 60 * 60; // s at the desk after hours between "go home" nudges

export class Companion {
  phase: Phase | null = null;
  /** seconds at the desk since each reminder was last satisfied */
  readonly sat: Record<ReminderKind, number> = { water: 0, stand: 0, eyes: 0 };
  pending: ReminderKind | null = null;
  quiet: Quiet = null;
  away = false;

  private snoozeUntil: Record<ReminderKind, number> = { water: 0, stand: 0, eyes: 0 };
  private ignores: Record<ReminderKind, number> = { water: 0, stand: 0, eyes: 0 };
  private awaySince = 0;
  private lastApp = '';
  private lastSwitchAt = -Infinity;
  private cheerIn = 0;
  private overtime = 0;

  constructor(
    private cfg: () => AppConfig,
    private emit: (e: CompanionEvent) => void,
    private screen: () => { w: number; h: number } = () => ({ w: window.innerWidth, h: window.innerHeight }),
  ) {
    this.cheerIn = this.nextCheer();
  }

  /** Effective interval in seconds, stretched after repeatedly ignored reminders. */
  interval(k: ReminderKind) {
    const backoff = 1 + 0.5 * Math.min(2, this.ignores[k]);
    return this.cfg().reminders[k].every * 60 * backoff;
  }

  quietReason(p: Presence, now: number): Quiet {
    const c = this.cfg();
    if (c.dnd.until > now) return 'manual';
    if (p.front && c.dnd.meetings && isMeetingApp(p.front.app)) return 'meeting';
    if (p.front && c.dnd.fullscreen) {
      const s = this.screen(), b = p.front.bounds;
      if (b.x <= 0 && b.y <= 0 && b.w >= s.w - 1 && b.h >= s.h - 1) return 'fullscreen';
    }
    return null;
  }

  tick(p: Presence, now: number, dt: number) {
    const c = this.cfg();
    const phase = workPhase(c.work, new Date(now));
    if (phase !== this.phase) {
      const from = this.phase;
      this.phase = phase;
      this.overtime = 0;
      this.emit({ type: 'phase', phase, from });
    }

    if (p.front && p.front.app !== this.lastApp) {
      if (this.lastApp) this.lastSwitchAt = now;
      this.lastApp = p.front.app;
    }

    // ---- at the desk / away ----
    const awayAfter = c.reminders.awayMin * 60;
    if (p.idle >= awayAfter) {
      if (!this.away) {
        this.away = true;
        this.awaySince = now - p.idle * 1000;
        // got up: that counts as standing and resting your eyes
        this.sat.stand = 0;
        this.sat.eyes = 0;
      }
      return;
    }
    if (this.away) {
      this.away = false;
      const mins = Math.round((now - this.awaySince) / 60_000);
      if (phase === 'work' || phase === 'free') this.emit({ type: 'welcomeBack', awayMin: mins });
    }

    const working = phase === 'work' || phase === 'free';
    this.quiet = this.quietReason(p, now);

    if (phase === 'after') {
      this.overtime += dt;
      if (this.overtime >= OVERTIME_EVERY && !this.quiet) {
        this.emit({ type: 'overtime', hours: Math.round(this.overtime / 3600) });
        this.overtime = 0;
      }
    }
    if (!working) return;

    for (const k of REMINDER_KINDS) if (c.reminders[k].enabled && k !== this.pending) this.sat[k] += dt;

    if (this.pending || this.quiet) return;

    // ---- reminders: standing up beats eye rest beats water when several are due ----
    const due = (['stand', 'eyes', 'water'] as ReminderKind[]).find(
      (k) => c.reminders[k].enabled && this.sat[k] >= this.interval(k) && now >= this.snoozeUntil[k],
    );
    if (due) {
      const breakpoint = now - this.lastSwitchAt < BREAK_AFTER_SWITCH || p.idle >= SHORT_PAUSE;
      if (breakpoint || this.sat[due] >= this.interval(due) + OVERDUE_FORCE) {
        this.pending = due;
        this.emit({ type: 'remind', kind: due });
      }
      return;
    }

    // ---- occasional encouragement ----
    this.cheerIn -= dt;
    if (this.cheerIn <= 0 && phase === 'work') {
      this.cheerIn = this.nextCheer();
      this.emit({ type: 'cheer' });
    }
  }

  respond(k: ReminderKind, r: Response, now: number) {
    if (this.pending === k) this.pending = null;
    if (r === 'snooze') {
      this.snoozeUntil[k] = now + this.cfg().reminders.snoozeMin * 60_000;
      return;
    }
    this.sat[k] = 0;
    if (r === 'done') {
      this.ignores[k] = 0;
      if (k === 'stand') this.sat.eyes = 0; // a stretch break rests the eyes too
    } else {
      this.ignores[k]++;
    }
  }

  private nextCheer() {
    return (80 + Math.random() * 60) * 60; // every ~80–140 min at the desk
  }
}
