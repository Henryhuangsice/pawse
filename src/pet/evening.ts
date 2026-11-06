/**
 * “下班去哪儿” — after-work picks (M5).
 * Weather comes from Open-Meteo via Rust (free, no key); places are not fetched at all:
 * each idea opens a search on 高德 / 小红书 / 大麦 (China) or Google Maps / Yelp / Ticketmaster
 * (elsewhere), so it costs nothing and needs no account or location permission.
 */
import { invoke } from '@tauri-apps/api/core';
import type { AppConfig, EveningCat } from '../shared/config';
import { locale, t } from '../shared/i18n';

export interface Weather {
  place: { name: string; country: string; country_code: string; lat: number; lon: number };
  temp: number;
  feels: number;
  code: number;
  rain_chance: number;
  precipitation: number;
  wind: number;
  is_day: boolean;
}

export type Sky = 'rain' | 'snow' | 'hot' | 'cold' | 'nice' | 'unknown';

/** WMO code + feel → what matters for going out */
export function sky(w: Weather | null): Sky {
  if (!w) return 'unknown';
  if ([71, 73, 75, 77, 85, 86].includes(w.code)) return 'snow';
  if (w.code >= 51 || w.precipitation > 0.2 || w.rain_chance >= 60) return 'rain';
  if (w.feels >= 30) return 'hot';
  if (w.feels <= 8) return 'cold';
  return 'nice';
}

export function wmoText(code: number, zh: boolean): string {
  const table: [number[], string, string][] = [
    [[0], '晴', 'clear'],
    [[1, 2], '少云', 'partly cloudy'],
    [[3], '阴', 'overcast'],
    [[45, 48], '有雾', 'foggy'],
    [[51, 53, 55, 56, 57], '毛毛雨', 'drizzle'],
    [[61, 63, 65, 66, 67], '下雨', 'rain'],
    [[71, 73, 75, 77], '下雪', 'snow'],
    [[80, 81, 82], '阵雨', 'showers'],
    [[85, 86], '阵雪', 'snow showers'],
    [[95, 96, 99], '雷雨', 'thunderstorms'],
  ];
  const hit = table.find(([codes]) => codes.includes(code));
  return hit ? (zh ? hit[1] : hit[2]) : '';
}

interface Idea {
  id: string;
  cat: EveningCat;
  emoji: string;
  zh: string;
  en: string;
  /** search words for maps / notes apps; none = nothing to look up (go home) */
  q?: { zh: string; en: string };
  outdoor?: boolean;
  tickets?: boolean;
  /** extra weight in this weather */
  likes?: Sky[];
  /** never in this weather */
  avoid?: Sky[];
}

export const IDEAS: Idea[] = [
  { id: 'hotpot', cat: 'eat', emoji: '🍲', zh: '吃顿热乎乎的火锅', en: 'Hot pot, something warm', q: { zh: '火锅', en: 'hot pot' }, likes: ['cold', 'rain', 'snow'], avoid: ['hot'] },
  { id: 'newspot', cat: 'eat', emoji: '🍜', zh: '试一家没去过的小馆子', en: 'Try a place you’ve never been', q: { zh: '新开 餐厅', en: 'new restaurant' } },
  { id: 'nightmarket', cat: 'eat', emoji: '🍢', zh: '逛夜市吃点小吃', en: 'Street food at a night market', q: { zh: '夜市', en: 'night market' }, outdoor: true, likes: ['nice', 'hot'], avoid: ['cold'] },
  { id: 'dessert', cat: 'eat', emoji: '🍰', zh: '吃个甜品犒劳自己', en: 'Dessert, you earned it', q: { zh: '甜品店', en: 'dessert' } },
  { id: 'bar', cat: 'drink', emoji: '🍸', zh: '找家小酒馆坐坐', en: 'A drink at a cosy bar', q: { zh: '小酒馆', en: 'cocktail bar' } },
  { id: 'cafe', cat: 'drink', emoji: '☕', zh: '找家安静的咖啡馆发会儿呆', en: 'A quiet café, phone down', q: { zh: '咖啡馆', en: 'cafe' }, likes: ['rain'] },
  { id: 'rooftop', cat: 'drink', emoji: '🌇', zh: '去露台吹吹晚风', en: 'A rooftop and the evening breeze', q: { zh: '露台 酒吧', en: 'rooftop bar' }, outdoor: true, likes: ['nice'], avoid: ['cold'] },
  { id: 'gym', cat: 'move', emoji: '🏋️', zh: '去健身房出出汗', en: 'Sweat it out at the gym', q: { zh: '健身房', en: 'gym' } },
  { id: 'climb', cat: 'move', emoji: '🧗', zh: '试试室内攀岩', en: 'Indoor bouldering', q: { zh: '攀岩馆', en: 'climbing gym' }, likes: ['rain', 'cold'] },
  { id: 'swim', cat: 'move', emoji: '🏊', zh: '游个泳，凉快一下', en: 'A swim to cool off', q: { zh: '游泳馆', en: 'swimming pool' }, likes: ['hot'] },
  { id: 'run', cat: 'move', emoji: '🏃', zh: '夜跑几公里', en: 'An easy evening run', q: { zh: '跑步 公园', en: 'running trail' }, outdoor: true, likes: ['nice'], avoid: ['hot'] },
  { id: 'live', cat: 'show', emoji: '🎸', zh: '去 Livehouse 听场现场', en: 'Live music tonight', q: { zh: 'livehouse', en: 'live music' }, tickets: true },
  { id: 'movie', cat: 'show', emoji: '🎬', zh: '看场电影', en: 'Catch a movie', q: { zh: '电影院', en: 'cinema' }, likes: ['rain', 'snow', 'cold'] },
  { id: 'standup', cat: 'show', emoji: '🎤', zh: '听场脱口秀笑一笑', en: 'Stand-up comedy', q: { zh: '脱口秀', en: 'comedy club' }, tickets: true },
  { id: 'exhibit', cat: 'show', emoji: '🖼️', zh: '看个展', en: 'See an exhibition', q: { zh: '展览', en: 'exhibition' }, likes: ['rain', 'hot'] },
  { id: 'park', cat: 'stroll', emoji: '🌳', zh: '去公园散散步', en: 'A walk in the park', q: { zh: '公园', en: 'park' }, outdoor: true, likes: ['nice'], avoid: ['hot'] },
  { id: 'river', cat: 'stroll', emoji: '🌊', zh: '去江边 / 河边走走', en: 'A walk by the water', q: { zh: '滨江 步道', en: 'waterfront walk' }, outdoor: true, likes: ['nice'], avoid: ['cold'] },
  { id: 'books', cat: 'stroll', emoji: '📚', zh: '逛逛书店', en: 'Browse a bookshop', q: { zh: '书店', en: 'bookstore' }, likes: ['rain', 'cold', 'hot'] },
  { id: 'cook', cat: 'home', emoji: '🍳', zh: '回家给自己做顿饭', en: 'Go home and cook yourself dinner' },
  { id: 'bath', cat: 'home', emoji: '🛁', zh: '早点回家，泡个澡早点睡', en: 'Home early, long bath, early night' },
  { id: 'call', cat: 'home', emoji: '📞', zh: '给家人或老朋友打个电话', en: 'Call family or an old friend' },
];

export const EVENING_CATS: EveningCat[] = ['eat', 'drink', 'move', 'show', 'stroll', 'home'];

export interface PickContext {
  sky: Sky;
  /** 0 = Sunday */
  day: number;
  hour: number;
  likes: EveningCat[];
  rand?: () => number;
}

export function score(i: Idea, c: PickContext): number {
  if (i.avoid?.includes(c.sky)) return -Infinity;
  if (i.outdoor && (c.sky === 'rain' || c.sky === 'snow')) return -Infinity;
  let s = 1;
  if (c.likes.length) s += c.likes.includes(i.cat) ? 2 : i.cat === 'home' ? 0 : -3;
  if (i.likes?.includes(c.sky)) s += 1.5;
  const weekendEve = c.day === 5 || c.day === 6;
  if (weekendEve && (i.cat === 'drink' || i.cat === 'show')) s += 1.5;
  if (!weekendEve && (i.cat === 'home' || i.cat === 'move')) s += 0.5;
  if (c.hour >= 21) s += i.cat === 'home' ? 2.5 : i.cat === 'show' ? -2 : -1;
  return s;
}

/** three ideas from different categories, best first, with a little randomness */
export function pick(c: PickContext, n = 3): Idea[] {
  const r = c.rand ?? Math.random;
  const ranked = IDEAS.map((i) => ({ i, s: score(i, c) + r() * 1.5 }))
    .filter((x) => Number.isFinite(x.s))
    .sort((a, b) => b.s - a.s);
  const out: Idea[] = [];
  for (const { i } of ranked) {
    if (out.length >= n) break;
    if (!out.some((o) => o.cat === i.cat)) out.push(i);
  }
  return out;
}

/** one short reason why, in the user's language */
export function reason(i: Idea, c: PickContext, zh: boolean): string {
  const L = (a: string, b: string) => (zh ? a : b);
  if (c.hour >= 21 && i.cat === 'home') return L('有点晚了，早点休息', 'It’s late — rest up');
  if ((c.sky === 'rain' || c.sky === 'snow') && !i.outdoor && i.cat !== 'home') return L('外面天气不好，室内刚好', 'Bad weather out — this is indoors');
  if (c.sky === 'cold' && i.likes?.includes('cold')) return L('降温了，来点暖和的', 'It’s cold — warm up');
  if (c.sky === 'hot' && i.likes?.includes('hot')) return L('这么热，找个凉快的地方', 'Too hot — somewhere cool');
  if (c.sky === 'nice' && i.outdoor) return L('天气不错，别浪费了', 'Lovely weather — use it');
  if ((c.day === 5 || c.day === 6) && (i.cat === 'drink' || i.cat === 'show')) return L('周末前夜，放松一下', 'The weekend’s here — unwind');
  if (i.id === 'call') return L('好久没聊了吧', 'It’s been a while, hasn’t it');
  if (i.cat === 'home') return L('今天辛苦了，对自己好一点', 'Long day — be kind to yourself');
  if (i.cat === 'move') return L('动一动，脑子会清爽很多', 'Moving clears the head');
  return L('换换心情', 'A change of scene');
}

export type Market = 'cn' | 'intl';

export function market(cfg: AppConfig['evening'], w: Weather | null): Market {
  if (cfg.market !== 'auto') return cfg.market;
  if (w?.place.country_code) return w.place.country_code === 'CN' ? 'cn' : 'intl';
  return locale() === 'zh' ? 'cn' : 'intl';
}

export interface Link { label: string; url: string }

export function links(i: Idea, city: string, m: Market): Link[] {
  if (!i.q) return [];
  const e = encodeURIComponent;
  const where = city.trim();
  if (m === 'cn') {
    const q = i.q.zh;
    const out: Link[] = [
      { label: '高德', url: `https://uri.amap.com/search?keyword=${e(q)}${where ? `&city=${e(where)}` : ''}&view=map&src=pawse&callnative=0` },
      { label: '小红书', url: `https://www.xiaohongshu.com/search_result?keyword=${e(`${where} ${q}`.trim())}` },
    ];
    if (i.tickets) out.push({ label: '大麦', url: `https://search.damai.cn/search.html?keyword=${e(q)}` });
    return out;
  }
  const q = i.q.en;
  const out: Link[] = [
    { label: 'Google Maps', url: `https://www.google.com/maps/search/?api=1&query=${e(where ? `${q} in ${where}` : `${q} near me`)}` },
  ];
  if (i.cat === 'eat' || i.cat === 'drink') out.push({ label: 'Yelp', url: `https://www.yelp.com/search?find_desc=${e(q)}${where ? `&find_loc=${e(where)}` : ''}` });
  if (i.tickets) out.push({ label: 'Ticketmaster', url: `https://www.ticketmaster.com/search?q=${e(`${q} ${where}`.trim())}` });
  return out;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export interface EveningHost {
  readonly cfg: AppConfig;
  readonly x: number;
  readonly y: number;
  readonly size: number;
  react(r: 'hop' | 'jump' | 'happy' | 'wave'): void;
  say(text: string, ms?: number): void;
}

/** the “tonight” card next to the pet */
export class Evening {
  el: HTMLDivElement;
  open = false;
  private weather: Weather | null = null;
  private weatherErr = '';
  private shown: Idea[] = [];
  private seen = new Set<string>();

  constructor(private host: EveningHost) {
    this.el = document.createElement('div');
    this.el.className = 'chat evening hidden';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (e) => void this.onClick(e));
    this.el.addEventListener('keydown', (e) => e.key === 'Escape' && this.close());
  }

  private ctx(): PickContext {
    const d = new Date();
    return { sky: sky(this.weather), day: d.getDay(), hour: d.getHours(), likes: this.host.cfg.evening.likes };
  }

  async show() {
    this.open = true;
    this.seen.clear();
    this.el.classList.remove('hidden');
    this.shuffle(false);
    this.render();
    this.position();
    const city = this.host.cfg.evening.city;
    if (city) {
      try {
        this.weather = await invoke<Weather>('weather_now', { city, lang: locale() });
        this.weatherErr = '';
      } catch (e) {
        this.weather = null;
        this.weatherErr = String(e);
      }
      // the weather can change what fits (rain → no park), so pick again once it's in
      if (this.open) {
        this.seen.clear();
        this.shuffle(false);
        this.render();
      }
    }
  }

  close() {
    this.open = false;
    this.el.classList.add('hidden');
  }

  /** new picks, avoiding what was just shown when possible */
  private shuffle(fresh = true) {
    const c = this.ctx();
    if (fresh) this.shown.forEach((i) => this.seen.add(i.id));
    const all = pick({ ...c }, IDEAS.length);
    const unseen = all.filter((i) => !this.seen.has(i.id));
    const pool = unseen.length >= 3 ? unseen : all;
    const out: Idea[] = [];
    for (const i of pool) {
      if (out.length >= 3) break;
      if (!out.some((o) => o.cat === i.cat)) out.push(i);
    }
    for (const i of pool) if (out.length < 3 && !out.includes(i)) out.push(i);
    this.shown = out;
    if (unseen.length < 3) this.seen.clear();
  }

  private weatherLine(): string {
    const zh = locale() === 'zh';
    const city = this.host.cfg.evening.city;
    if (!city) return `<button class="msg-link" data-a="settings">${t('evening.setCity')}</button>`;
    if (this.weatherErr) return esc(this.weatherErr === 'notfound' ? t('evening.cityNotFound', { city }) : t('evening.noWeather'));
    const w = this.weather;
    if (!w) return esc(t('evening.loading'));
    const rain = w.rain_chance >= 40 ? zh ? ` · 降雨概率 ${w.rain_chance}%` : ` · ${w.rain_chance}% rain` : '';
    return esc(`${w.place.name} · ${Math.round(w.temp)}°C ${wmoText(w.code, zh)}${rain}`);
  }

  render() {
    const zh = locale() === 'zh';
    const c = this.ctx();
    const m = market(this.host.cfg.evening, this.weather);
    const city = this.weather?.place.name ?? this.host.cfg.evening.city;
    this.el.innerHTML = `
      <div class="chat-head"><span class="chat-name">${esc(t('evening.title'))}</span><button class="chat-x" data-a="close" aria-label="${t('chat.close')}">✕</button></div>
      <div class="eve-weather">${this.weatherLine()}</div>
      <div class="eve-list">${this.shown.map((i) => `
        <div class="eve-item">
          <div class="eve-emoji">${i.emoji}</div>
          <div class="eve-body">
            <div class="eve-title">${esc(zh ? i.zh : i.en)}</div>
            <div class="eve-why">${esc(reason(i, c, zh))}</div>
            <div class="eve-links">${links(i, city, m).map((l) => `<button data-url="${esc(l.url)}">${esc(l.label)}</button>`).join('')
              || `<button data-home="${i.id}">${esc(t('evening.ok'))}</button>`}</div>
          </div>
        </div>`).join('')}
      </div>
      <div class="eve-foot">
        <button data-a="more">🔄 ${t('evening.more')}</button>
        <button data-a="settings">⚙︎ ${t('evening.prefs')}</button>
      </div>`;
  }

  private async onClick(e: MouseEvent) {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!b) return;
    if (b.dataset.url) {
      await invoke('launch', { target: b.dataset.url }).catch((err) => this.host.say(String(err)));
      this.host.react('happy');
      return;
    }
    if (b.dataset.home) {
      this.close();
      this.host.react('wave');
      this.host.say(t('evening.goodnight'), 4000);
      return;
    }
    switch (b.dataset.a) {
      case 'close': this.close(); break;
      case 'more': this.shuffle(); this.render(); this.host.react('hop'); break;
      case 'settings': void invoke('open_settings'); break;
    }
  }

  position() {
    if (!this.open) return;
    const { x, y, size: s } = this.host;
    const w = this.el.offsetWidth, h = this.el.offsetHeight;
    let left = x + s * 0.92;
    if (left + w > window.innerWidth - 8) left = x + s * 0.08 - w;
    const top = Math.min(Math.max(y + s - h, 8), window.innerHeight - h - 8);
    left = Math.min(Math.max(left, 8), window.innerWidth - w - 8);
    this.el.style.transform = `translate(${left.toFixed(0)}px, ${top.toFixed(0)}px)`;
  }
}
