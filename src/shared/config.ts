import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export type PetKind = 'cat' | 'astro' | 'human';
export const PET_KINDS: PetKind[] = ['cat', 'astro', 'human'];
export type Lang = 'auto' | 'zh' | 'en';
export type Accessory = 'none' | 'crown' | 'shades' | 'bow' | 'headphones';
export const ACCESSORIES: Accessory[] = ['none', 'crown', 'shades', 'bow', 'headphones'];
export type AiProvider = 'dashscope' | 'openai';
export const AI_PROVIDERS: AiProvider[] = ['dashscope', 'openai'];

/** chat models (M4); all speak the OpenAI-compatible chat API */
export type ChatProvider = 'ollama' | 'zhipu' | 'siliconflow' | 'deepseek' | 'qwen' | 'openai' | 'custom';
export const CHAT_PROVIDERS: ChatProvider[] = ['ollama', 'zhipu', 'siliconflow', 'deepseek', 'qwen', 'openai', 'custom'];
/** providers with a free tier (labelled in Settings) */
export const CHAT_FREE: ChatProvider[] = ['ollama', 'zhipu', 'siliconflow'];
export const CHAT_DEFAULT_MODEL: Record<ChatProvider, string> = {
  ollama: 'qwen2.5:3b',
  zhipu: 'glm-4.7-flash',
  siliconflow: 'Qwen/Qwen2.5-7B-Instruct',
  deepseek: 'deepseek-chat',
  qwen: 'qwen-plus',
  openai: 'gpt-4.1-mini',
  custom: '',
};
/** keychain slot per provider (null = needs no key); Qwen shares the DashScope key */
export const CHAT_KEY_SLOT: Record<ChatProvider, string | null> = {
  ollama: null,
  zhipu: 'zhipu',
  siliconflow: 'siliconflow',
  deepseek: 'deepseek',
  qwen: 'dashscope',
  openai: 'openai',
  custom: 'custom',
};
export const OLLAMA_URL = 'http://localhost:11434/v1';
/** Global shortcut that opens the chat box (registered in src-tauri/src/lib.rs). */
export const CHAT_KEY = navigator.platform.startsWith('Mac') ? '⌃⌥C' : 'Ctrl+Alt+C';

/** A pet made by the user (stored by the Rust side under app data, not in this config). */
export interface CustomPetMeta {
  id: string;
  name: string;
  source: 'photo' | 'ai' | 'pack';
  created: number;
}

/** A rectangle expressed as fractions (0..1) of the screen, so it survives resolution changes. */
export interface Rect01 {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Global shortcut that opens the launcher (registered in src-tauri/src/lib.rs). */
export const LAUNCHER_KEY = navigator.platform.startsWith('Mac') ? '⌃⌥P' : 'Ctrl+Alt+P';

export type ReminderKind = 'water' | 'stand' | 'eyes';
export const REMINDER_KINDS: ReminderKind[] = ['water', 'stand', 'eyes'];

export interface LauncherItem {
  name: string;
  /** URL (https://…), app name ("WeChat"), or absolute path (/Applications/Foo.app). */
  target: string;
}

export interface WorkConfig {
  enabled: boolean;
  /** 0 = Sunday … 6 = Saturday */
  days: number[];
  start: string; // "HH:MM"
  end: string;
  lunchStart: string;
  lunchEnd: string;
}

export interface ReminderConfig {
  enabled: boolean;
  /** minutes of active (non-idle) work between reminders */
  every: number;
}

export interface AppConfig {
  version: 1;
  pet: {
    kind: PetKind;
    /** Empty string = use the localized default name for the kind. */
    name: string;
    /** 0.6 .. 1.6 */
    scale: number;
    /** id of a custom pet; empty = use the built-in `kind` */
    custom: string;
    /** colour shift for built-in pets, degrees 0..359 */
    hue: number;
    accessory: Accessory;
  };
  /** Where the pet is allowed to roam. Keep it away from your main work area. */
  roam: Rect01;
  lang: Lang;
  work: WorkConfig;
  reminders: Record<ReminderKind, ReminderConfig> & {
    /** keyboard + mouse idle this long = you left your desk; sitting / screen timers reset */
    awayMin: number;
    snoozeMin: number;
  };
  dnd: {
    /** stay quiet while a video-meeting app is in front */
    meetings: boolean;
    /** stay quiet while the front window is full-screen (slides, video, games) */
    fullscreen: boolean;
    /** epoch ms; manual "do not disturb" until then */
    until: number;
  };
  launcher: LauncherItem[];
  /** the pet prefers spots that don't cover the window you're working in */
  avoidActiveWindow: boolean;
  /** text-to-image for custom pets; API keys live in the OS keychain, not here */
  ai: {
    provider: AiProvider;
    dashscope: { region: 'cn' | 'intl'; model: string };
    openai: { model: string };
  };
  /** AI chat (M4); keys live in the keychain, the conversation in local SQLite */
  chat: {
    enabled: boolean;
    provider: ChatProvider;
    /** per provider; empty = CHAT_DEFAULT_MODEL */
    models: Record<ChatProvider, string>;
    ollamaUrl: string;
    customUrl: string;
    qwenRegion: 'cn' | 'intl';
    /** empty fields = the pet's built-in personality */
    persona: { traits: string; style: string; taboo: string };
    /** remember what you talk about (a summary kept on this computer) */
    memory: boolean;
    /** let the pet start a conversation now and then: at most this many times a day (0 = never) */
    proactivePerDay: number;
    /** read replies aloud with the system voice (free, offline) */
    speak: boolean;
  };
}

export const ROAM_PRESETS: Record<'bottomRight' | 'bottomBand' | 'rightColumn' | 'full', Rect01> = {
  bottomRight: { x: 0.6, y: 0.55, w: 0.38, h: 0.4 },
  bottomBand: { x: 0.02, y: 0.74, w: 0.96, h: 0.24 },
  rightColumn: { x: 0.8, y: 0.06, w: 0.19, h: 0.9 },
  full: { x: 0, y: 0, w: 1, h: 1 },
};

export const DEFAULT_CONFIG: AppConfig = {
  version: 1,
  pet: { kind: 'cat', name: '', scale: 1, custom: '', hue: 0, accessory: 'none' },
  roam: { ...ROAM_PRESETS.bottomRight },
  lang: 'auto',
  work: { enabled: true, days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00', lunchStart: '12:00', lunchEnd: '13:30' },
  reminders: {
    water: { enabled: true, every: 45 },
    stand: { enabled: true, every: 60 },
    eyes: { enabled: true, every: 20 },
    awayMin: 5,
    snoozeMin: 10,
  },
  dnd: { meetings: true, fullscreen: true, until: 0 },
  launcher: [
    { name: 'ChatGPT', target: 'https://chatgpt.com' },
    { name: 'DeepSeek', target: 'https://chat.deepseek.com' },
  ],
  avoidActiveWindow: true,
  ai: { provider: 'dashscope', dashscope: { region: 'cn', model: '' }, openai: { model: '' } },
  chat: {
    enabled: true,
    provider: 'ollama',
    models: { ollama: '', zhipu: '', siliconflow: '', deepseek: '', qwen: '', openai: '', custom: '' },
    ollamaUrl: OLLAMA_URL,
    customUrl: '',
    qwenRegion: 'cn',
    persona: { traits: '', style: '', taboo: '' },
    memory: true,
    proactivePerDay: 0,
    speak: false,
  },
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
const obj = (v: unknown) => (v && typeof v === 'object' ? v : {}) as Record<string, any>;
const hhmm = (v: unknown, fallback: string) =>
  typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : fallback;

/** "HH:MM" → minutes since midnight */
export const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

/** Merge whatever is on disk with defaults and clamp everything into a valid range. */
export function normalizeConfig(raw: unknown): AppConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const pet = (r.pet ?? {}) as Record<string, unknown>;
  const roam = (r.roam ?? {}) as Record<string, unknown>;
  if (pet.kind === 'dog' || pet.kind === 'jet') pet.kind = 'astro'; // earlier versions had a dog, then a jet cat, in this slot
  const kind = PET_KINDS.includes(pet.kind as PetKind) ? (pet.kind as PetKind) : DEFAULT_CONFIG.pet.kind;
  const x = clamp(num(roam.x, DEFAULT_CONFIG.roam.x), 0, 0.95);
  const y = clamp(num(roam.y, DEFAULT_CONFIG.roam.y), 0, 0.95);
  return {
    version: 1,
    pet: {
      kind,
      name: typeof pet.name === 'string' ? pet.name.slice(0, 24) : '',
      scale: clamp(num(pet.scale, 1), 0.6, 1.6),
      custom: typeof pet.custom === 'string' && /^[a-z0-9-]{1,40}$/.test(pet.custom) ? pet.custom : '',
      hue: Math.round(((num(pet.hue, 0) % 360) + 360) % 360),
      accessory: ACCESSORIES.includes(pet.accessory as Accessory) ? (pet.accessory as Accessory) : 'none',
    },
    roam: {
      x,
      y,
      w: clamp(num(roam.w, DEFAULT_CONFIG.roam.w), 0.05, 1 - x),
      h: clamp(num(roam.h, DEFAULT_CONFIG.roam.h), 0.05, 1 - y),
    },
    lang: r.lang === 'zh' || r.lang === 'en' ? r.lang : 'auto',
    work: normalizeWork(obj(r.work)),
    reminders: normalizeReminders(obj(r.reminders)),
    dnd: {
      meetings: bool(obj(r.dnd).meetings, true),
      fullscreen: bool(obj(r.dnd).fullscreen, true),
      until: Math.max(0, num(obj(r.dnd).until, 0)),
    },
    launcher: Array.isArray(r.launcher)
      ? r.launcher
          .filter((i: any) => i && typeof i.name === 'string' && typeof i.target === 'string' && i.target.trim())
          .slice(0, 12)
          .map((i: any) => ({ name: i.name.slice(0, 24), target: i.target.trim().slice(0, 500) }))
      : structuredClone(DEFAULT_CONFIG.launcher),
    avoidActiveWindow: bool(r.avoidActiveWindow, true),
    ai: {
      provider: AI_PROVIDERS.includes(obj(r.ai).provider) ? obj(r.ai).provider : 'dashscope',
      dashscope: {
        region: obj(obj(r.ai).dashscope).region === 'intl' ? 'intl' : 'cn',
        model: modelName(obj(obj(r.ai).dashscope).model),
      },
      openai: { model: modelName(obj(obj(r.ai).openai).model) },
    },
    chat: normalizeChat(obj(r.chat)),
  };
}

const modelName = (v: unknown) => (typeof v === 'string' && /^[\w.:/-]{0,80}$/.test(v.trim()) ? v.trim() : '');
const httpUrl = (v: unknown, fallback: string) =>
  typeof v === 'string' && /^https?:\/\/[^\s]{1,300}$/.test(v.trim()) ? v.trim().replace(/\/+$/, '') : fallback;
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

function normalizeChat(c: Record<string, any>): AppConfig['chat'] {
  const models = obj(c.models);
  const persona = obj(c.persona);
  return {
    enabled: bool(c.enabled, true),
    provider: CHAT_PROVIDERS.includes(c.provider) ? c.provider : 'ollama',
    models: Object.fromEntries(CHAT_PROVIDERS.map((p) => [p, modelName(models[p])])) as Record<ChatProvider, string>,
    ollamaUrl: httpUrl(c.ollamaUrl, OLLAMA_URL),
    customUrl: httpUrl(c.customUrl, ''),
    qwenRegion: c.qwenRegion === 'intl' ? 'intl' : 'cn',
    persona: { traits: text(persona.traits, 200), style: text(persona.style, 200), taboo: text(persona.taboo, 200) },
    memory: bool(c.memory, true),
    proactivePerDay: Math.round(clamp(num(c.proactivePerDay, 0), 0, 6)),
    speak: bool(c.speak, false),
  };
}

function normalizeWork(w: Record<string, any>): WorkConfig {
  const d = DEFAULT_CONFIG.work;
  const days = Array.isArray(w.days)
    ? [...new Set(w.days.filter((x: unknown) => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 6))].sort()
    : d.days;
  return {
    enabled: bool(w.enabled, d.enabled),
    days: days as number[],
    start: hhmm(w.start, d.start),
    end: hhmm(w.end, d.end),
    lunchStart: hhmm(w.lunchStart, d.lunchStart),
    lunchEnd: hhmm(w.lunchEnd, d.lunchEnd),
  };
}

function normalizeReminders(r: Record<string, any>): AppConfig['reminders'] {
  const d = DEFAULT_CONFIG.reminders;
  const one = (k: ReminderKind): ReminderConfig => ({
    enabled: bool(obj(r[k]).enabled, d[k].enabled),
    every: Math.round(clamp(num(obj(r[k]).every, d[k].every), 5, 240)),
  });
  return {
    water: one('water'),
    stand: one('stand'),
    eyes: one('eyes'),
    awayMin: Math.round(clamp(num(r.awayMin, d.awayMin), 1, 60)),
    snoozeMin: Math.round(clamp(num(r.snoozeMin, d.snoozeMin), 1, 60)),
  };
}

export async function loadConfig(): Promise<AppConfig> {
  try {
    return normalizeConfig(await invoke('get_config'));
  } catch (e) {
    console.warn('loadConfig failed, using defaults', e);
    return structuredClone(DEFAULT_CONFIG);
  }
}

/** Persists the config; the Rust side then broadcasts `config-changed` to every window. */
export async function saveConfig(cfg: AppConfig): Promise<void> {
  await invoke('save_config', { config: normalizeConfig(cfg) });
}

export function onConfigChange(cb: (cfg: AppConfig) => void): Promise<UnlistenFn> {
  return listen<unknown>('config-changed', (e) => cb(normalizeConfig(e.payload)));
}
