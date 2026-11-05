import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export type PetKind = 'cat' | 'jet' | 'human';
export const PET_KINDS: PetKind[] = ['cat', 'jet', 'human'];
export type Lang = 'auto' | 'zh' | 'en';

/** A rectangle expressed as fractions (0..1) of the screen, so it survives resolution changes. */
export interface Rect01 {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AppConfig {
  version: 1;
  pet: {
    kind: PetKind;
    /** Empty string = use the localized default name for the kind. */
    name: string;
    /** 0.6 .. 1.6 */
    scale: number;
  };
  /** Where the pet is allowed to roam. Keep it away from your main work area. */
  roam: Rect01;
  lang: Lang;
}

export const ROAM_PRESETS: Record<'bottomRight' | 'bottomBand' | 'rightColumn' | 'full', Rect01> = {
  bottomRight: { x: 0.6, y: 0.55, w: 0.38, h: 0.4 },
  bottomBand: { x: 0.02, y: 0.74, w: 0.96, h: 0.24 },
  rightColumn: { x: 0.8, y: 0.06, w: 0.19, h: 0.9 },
  full: { x: 0, y: 0, w: 1, h: 1 },
};

export const DEFAULT_CONFIG: AppConfig = {
  version: 1,
  pet: { kind: 'cat', name: '', scale: 1 },
  roam: { ...ROAM_PRESETS.bottomRight },
  lang: 'auto',
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** Merge whatever is on disk with defaults and clamp everything into a valid range. */
export function normalizeConfig(raw: unknown): AppConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const pet = (r.pet ?? {}) as Record<string, unknown>;
  const roam = (r.roam ?? {}) as Record<string, unknown>;
  if (pet.kind === 'dog') pet.kind = 'jet'; // v0.1 had a dog in this slot
  const kind = PET_KINDS.includes(pet.kind as PetKind) ? (pet.kind as PetKind) : DEFAULT_CONFIG.pet.kind;
  const x = clamp(num(roam.x, DEFAULT_CONFIG.roam.x), 0, 0.95);
  const y = clamp(num(roam.y, DEFAULT_CONFIG.roam.y), 0, 0.95);
  return {
    version: 1,
    pet: {
      kind,
      name: typeof pet.name === 'string' ? pet.name.slice(0, 24) : '',
      scale: clamp(num(pet.scale, 1), 0.6, 1.6),
    },
    roam: {
      x,
      y,
      w: clamp(num(roam.w, DEFAULT_CONFIG.roam.w), 0.05, 1 - x),
      h: clamp(num(roam.h, DEFAULT_CONFIG.roam.h), 0.05, 1 - y),
    },
    lang: r.lang === 'zh' || r.lang === 'en' ? r.lang : 'auto',
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
