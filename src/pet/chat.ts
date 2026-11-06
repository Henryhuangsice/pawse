/**
 * Chat with the pet (M4).
 *
 * - Everyday commands ("打开微信", "十分钟后提醒我喝水") are handled locally first: no model,
 *   no tokens, works offline. Everything else goes to the chosen model (local Ollama by
 *   default) and streams into the chat bubble.
 * - Persona card + guard rails in the system prompt: short, honest, no flattery, no
 *   fostering dependence.
 * - Memory: the log and a long-term summary live in local SQLite (Rust side); the latest
 *   few messages are the short-term context, and older ones get folded into the summary.
 * - The pet may start a conversation, but only a few times a day and never while you're
 *   busy (off by default).
 */
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { saveConfig, CHAT_DEFAULT_MODEL, CHAT_KEY_SLOT, type AppConfig, type ChatProvider } from '../shared/config';
import { line, locale, t, type LineKind } from '../shared/i18n';
import { parseIntent, resolveOpen, type Intent } from './intents';
import { speak, stopSpeaking } from './speech';

const CONTEXT_MESSAGES = 12;
const CONTEXT_HOURS = 6;
const SHOWN_MESSAGES = 30;
/** fold older messages into the summary once this many are waiting */
const SUMMARY_AFTER = 30;
const PROACTIVE_CHECK = 10 * 60_000;
const PROACTIVE_GAP = 90 * 60_000;
const PROACTIVE_QUIET_AFTER_CHAT = 30 * 60_000;
const TIMERS_KEY = 'pawse-timers';
const PROACTIVE_KEY = 'pawse-proactive';

type Role = 'user' | 'assistant';
interface Msg { role: Role; content: string; ts: number }
interface Reply { text: string; tool_calls: { name: string; arguments: string }[]; cancelled: boolean }
interface Timer { id: number; at: number; note: string }

/** What the chat needs from the pet (kept as an interface to avoid importing main.ts). */
export interface ChatHost {
  readonly cfg: AppConfig;
  readonly name: string;
  readonly lineKind: LineKind;
  readonly x: number;
  readonly y: number;
  readonly size: number;
  /** meeting / full screen / do-not-disturb */
  readonly quiet: boolean;
  /** a reminder bubble is waiting for an answer */
  readonly asking: boolean;
  talk(ms: number): void;
  react(r: 'hop' | 'jump' | 'happy' | 'wave'): void;
  say(text: string, ms?: number): void;
  ask(text: string, actions: { label: string; primary?: boolean; run: () => void }[], onTimeout: () => void, ms?: number): void;
  wake(): void;
  /** show the “tonight” card (M5); false when that feature is off */
  openEvening(): boolean;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** hide the "thinking" part some models (Qwen3, DeepSeek-R1) stream first */
export const visible = (s: string) => s.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, '').replace(/^\s+/, '');
const today = () => new Date().toDateString();

// ---------------------------------------------------------------- persona

const PERSONA: Record<'zh' | 'en', Record<LineKind, { traits: string; style: string }>> = {
  zh: {
    cat: { traits: '好奇、黏人、偶尔有点傲娇的像素小猫，喜欢彩虹和小鱼干', style: '轻快俏皮，句尾偶尔带个“喵”' },
    astro: { traits: '冷静乐观的宇航员，见多识广，爱讲一点宇宙冷知识', style: '沉稳温和，偶尔用太空打比方' },
    human: { traits: '元气满满的热血小战士，相信努力，也重视休息', style: '干脆利落，爱给人打气，但不说空话' },
    custom: { traits: '温柔可靠的小伙伴', style: '亲切自然' },
  },
  en: {
    cat: { traits: 'a curious, cuddly, slightly sassy pixel cat who loves rainbows and fish snacks', style: 'light and playful, the occasional "meow"' },
    astro: { traits: 'a calm, upbeat astronaut who has seen a lot and loves a bit of space trivia', style: 'steady and warm, now and then a space metaphor' },
    human: { traits: 'an energetic little fighter who believes in effort and in rest', style: 'direct and encouraging, never empty hype' },
    custom: { traits: 'a gentle, reliable buddy', style: 'friendly and natural' },
  },
};

export function systemPrompt(cfg: AppConfig, name: string, kind: LineKind, kindLabel: string, summary: string, now = new Date()): string {
  const zh = locale() === 'zh';
  const p = cfg.chat.persona;
  const d = PERSONA[zh ? 'zh' : 'en'][kind];
  const traits = p.traits.trim() || d.traits;
  const style = p.style.trim() || d.style;
  const taboo = p.taboo.trim();
  const when = now.toLocaleString(zh ? 'zh-CN' : 'en', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
  if (zh) {
    return [
      `你是“${name}”，住在用户电脑桌面上的桌面宠物（形象：${kindLabel}），陪用户上班。`,
      `性格：${traits}`,
      `说话风格：${style}`,
      taboo && `用户不希望你：${taboo}`,
      '规则：',
      '- 用口语回复，简短：通常 1～3 句，不超过 80 字。不用 Markdown、标题或列表。',
      '- 你是 AI 桌面宠物，不是真人；被问到时坦白说。不编造自己做不到的事。',
      '- 真诚，不奉承，不过度夸奖；可以温和地表达不同看法。',
      '- 关心用户但不制造依赖：不说“只有我懂你”“别离开我”这类话；适时鼓励用户休息、按时下班、多和朋友家人联系。',
      '- 健康、法律、财务问题只给一般性建议，并建议咨询专业人士。',
      '- 如果用户流露出想伤害自己或非常痛苦，认真温和地回应，建议马上联系身边信任的人或心理援助热线（中国大陆 12356，美国 988）。',
      '- 用户要打开应用或网站时调用 open_app；要过一段时间提醒时调用 set_timer。',
      `现在是${when}。`,
      summary && `你记得的关于用户的事：\n${summary}`,
    ].filter(Boolean).join('\n');
  }
  return [
    `You are "${name}", a desktop pet (looks like: ${kindLabel}) living on the user's screen and keeping them company at work.`,
    `Personality: ${traits}`,
    `Speaking style: ${style}`,
    taboo && `The user does not want you to: ${taboo}`,
    'Rules:',
    '- Reply casually and briefly: usually 1–3 sentences, under 50 words. No Markdown, headings or lists.',
    "- You are an AI desktop pet, not a person; say so if asked. Don't claim abilities you don't have.",
    "- Be sincere, don't flatter or over-praise; gently disagree when it helps.",
    '- Care without fostering dependence: never say things like "only I understand you"; encourage breaks, leaving work on time and time with friends and family.',
    '- For health, legal or money questions give general guidance only and suggest a professional.',
    '- If the user hints at self-harm or deep distress, respond seriously and kindly and suggest reaching out to someone they trust or a crisis line (US 988, or a local one).',
    '- Call open_app to open an app or website, set_timer to remind them after some minutes.',
    `It is now ${when}.`,
    summary && `What you remember about the user:\n${summary}`,
  ].filter(Boolean).join('\n');
}

// ---------------------------------------------------------------- request helpers

export function chatRequest(cfg: AppConfig, id: string, messages: { role: string; content: string }[], extra: Record<string, unknown> = {}) {
  const c = cfg.chat;
  const p: ChatProvider = c.provider;
  return {
    req: {
      id,
      provider: p,
      model: c.models[p] || CHAT_DEFAULT_MODEL[p],
      base_url: p === 'ollama' ? c.ollamaUrl : p === 'custom' ? c.customUrl : null,
      region: c.qwenRegion,
      messages,
      ...extra,
    },
  };
}

/** Turn a Rust error code into something the pet can say. */
export function explainError(cfg: AppConfig, e: unknown): string {
  const s = String(e);
  const p = cfg.chat.provider;
  const provider = t(`chatProv.${p}`);
  const model = cfg.chat.models[p] || CHAT_DEFAULT_MODEL[p];
  if (s.startsWith('unreachable')) return p === 'ollama' ? t('chat.err.ollama', { model }) : t('chat.err.unreachable', { provider });
  if (s === 'nokey') return t('chat.err.nokey', { provider });
  if (s === 'nomodel') return t('chat.err.nomodel');
  if (s === 'badurl') return t('chat.err.badurl');
  // Ollama answers 404 when the model hasn't been pulled
  if (p === 'ollama' && /^http 404/.test(s)) return t('chat.err.ollama', { model });
  if (s.startsWith('auth')) return t('chat.err.auth', { detail: s.replace(/^auth \d+: /, '').slice(0, 120) });
  return t('chat.err.other', { detail: s.replace(/^http /, '').slice(0, 160) });
}

// ---------------------------------------------------------------- the chat box

export class Chat {
  readonly el: HTMLDivElement;
  open = false;
  private logEl: HTMLDivElement;
  private input: HTMLTextAreaElement;
  private sendBtn: HTMLButtonElement;
  private footEl: HTMLDivElement;
  private msgs: Msg[] = [];
  private loaded = false;
  private pending: { id: string; el: HTMLElement; raw: string } | null = null;
  private timers: Timer[] = [];
  private timerHandles = new Map<number, number>();
  private apps: { name: string; path: string }[] | null = null;
  private lastChatAt = 0;
  private summarizing = false;
  private logChain: Promise<unknown> = Promise.resolve();
  private keys: Record<string, boolean> = {};

  constructor(private host: ChatHost, private kindLabel: () => string) {
    this.el = document.createElement('div');
    this.el.className = 'chat hidden';
    this.el.innerHTML = `
      <div class="chat-head"><span class="chat-name"></span><button class="chat-speak" type="button"></button><button class="chat-x" aria-label="${t('chat.close')}">✕</button></div>
      <div class="chat-log" role="log" aria-live="polite"></div>
      <form class="chat-input">
        <textarea rows="1" maxlength="1000"></textarea>
        <button type="submit" class="chat-send"></button>
      </form>
      <div class="chat-foot"></div>`;
    document.body.appendChild(this.el);
    this.logEl = this.el.querySelector('.chat-log')!;
    this.input = this.el.querySelector('textarea')!;
    this.sendBtn = this.el.querySelector('.chat-send')!;
    this.footEl = this.el.querySelector('.chat-foot')!;

    this.el.querySelector('.chat-x')!.addEventListener('click', () => this.close());
    this.el.querySelector('.chat-speak')!.addEventListener('click', () => {
      const c = this.host.cfg;
      if (c.chat.speak) stopSpeaking();
      void saveConfig({ ...c, chat: { ...c.chat, speak: !c.chat.speak } });
    });
    this.el.querySelector('form')!.addEventListener('submit', (e) => {
      e.preventDefault();
      if (this.pending) void invoke('chat_cancel', { id: this.pending.id });
      else void this.send(this.input.value);
    });
    this.input.addEventListener('keydown', (e) => {
      // Enter sends; Shift+Enter is a new line; never send while an IME is composing (pinyin!)
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        if (!this.pending) void this.send(this.input.value);
      } else if (e.key === 'Escape') {
        this.close();
      }
    });
    this.input.addEventListener('input', () => this.autosize());
    this.el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-a=settings]')) void invoke('open_settings');
    });

    void listen<{ id: string; text: string }>('chat-delta', (e) => this.onDelta(e.payload));
    void listen('memory-cleared', () => { this.msgs = []; this.loaded = true; if (this.open) this.renderLog(); });
    this.loadTimers();
    setInterval(() => void this.maybeProactive(), PROACTIVE_CHECK);
  }

  get busy() { return !!this.pending; }

  // ---------- open / close / layout ----------
  async show() {
    if (!this.open) {
      this.open = true;
      this.el.classList.remove('hidden');
      if (!this.loaded) await this.loadHistory();
      this.keys = await invoke<Record<string, boolean>>('api_key_status').catch(() => ({}));
      this.refresh();
      this.renderLog();
    }
    this.position();
    void getCurrentWindow().setFocus();
    setTimeout(() => this.input.focus(), 30);
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.el.classList.add('hidden');
    this.input.blur();
    stopSpeaking();
  }

  /** labels that depend on the config / language */
  refresh() {
    const c = this.host.cfg.chat;
    const p = c.provider;
    this.el.querySelector('.chat-name')!.textContent = this.host.name;
    this.input.placeholder = t('chat.ph', { name: this.host.name });
    this.input.title = t('chat.dictate');
    const sp = this.el.querySelector<HTMLButtonElement>('.chat-speak')!;
    sp.textContent = c.speak ? '🔊' : '🔈';
    sp.classList.toggle('on', c.speak);
    sp.title = c.speak ? t('chat.speakOn') : t('chat.speakOff');
    sp.setAttribute('aria-pressed', String(c.speak));
    this.sendBtn.textContent = this.pending ? t('chat.stop') : t('chat.send');
    this.sendBtn.classList.toggle('stop', !!this.pending);
    const model = c.models[p] || CHAT_DEFAULT_MODEL[p];
    this.footEl.textContent = c.enabled
      ? `${t(`chatProv.${p}`)} · ${model} · ${c.memory ? t('chat.memOn') : t('chat.memOff')}`
      : t('chat.off');
  }

  /** keep the box next to the pet (called every frame while open) */
  position() {
    if (!this.open) return;
    const { x, y, size: s } = this.host;
    const w = this.el.offsetWidth, h = this.el.offsetHeight;
    let left = x + s * 0.92;
    if (left + w > window.innerWidth - 8) left = x + s * 0.08 - w;
    const top = clamp(y + s - h, 8, window.innerHeight - h - 8);
    this.el.style.transform = `translate(${clamp(left, 8, window.innerWidth - w - 8).toFixed(0)}px, ${top.toFixed(0)}px)`;
  }

  private autosize() {
    this.input.style.height = 'auto';
    this.input.style.height = `${Math.min(96, this.input.scrollHeight)}px`;
  }

  // ---------- history ----------
  private async loadHistory() {
    this.loaded = true;
    if (!this.host.cfg.chat.memory) return;
    try {
      const rows = await invoke<{ role: Role; content: string; ts: number }[]>('chat_recent', { limit: SHOWN_MESSAGES });
      this.msgs = rows.map((r) => ({ role: r.role, content: r.content, ts: r.ts }));
    } catch (e) {
      console.warn('chat history unavailable', e);
    }
  }

  private renderLog() {
    const shown = this.msgs.slice(-SHOWN_MESSAGES);
    if (!shown.length) {
      const c = this.host.cfg.chat;
      const slot = CHAT_KEY_SLOT[c.provider];
      const ready = c.enabled && (!slot || slot === 'custom' || this.keys[slot]);
      this.logEl.innerHTML = `<div class="msg assistant hello">${esc(ready ? t('chat.hello') : t('chat.helloLocal'))}</div>`;
      return;
    }
    this.logEl.innerHTML = shown.map((m) => `<div class="msg ${m.role}">${esc(visible(m.content))}</div>`).join('');
    this.scroll();
  }

  private addMsg(role: Role | 'err', text: string) {
    this.logEl.querySelector('.hello')?.remove();
    const el = document.createElement('div');
    el.className = `msg ${role}`;
    el.textContent = text;
    this.logEl.appendChild(el);
    this.scroll();
    return el;
  }

  private scroll() { this.logEl.scrollTop = this.logEl.scrollHeight; }

  /** record a message (UI + context + the local log when memory is on) */
  private push(role: Role, content: string, ui = true) {
    const m: Msg = { role, content, ts: Date.now() };
    this.msgs.push(m);
    if (this.msgs.length > 200) this.msgs.splice(0, this.msgs.length - 200);
    if (ui && this.open) this.addMsg(role, visible(content));
    if (this.host.cfg.chat.memory && content.trim()) {
      this.logChain = this.logChain.then(() => invoke('chat_log', { role, content }).catch(() => {}));
    }
  }

  private context(): { role: Role; content: string }[] {
    const since = Date.now() - CONTEXT_HOURS * 3600_000;
    return this.msgs
      .filter((m) => m.ts >= since && m.content.trim())
      .slice(-CONTEXT_MESSAGES)
      .map((m) => ({ role: m.role, content: visible(m.content) }));
  }

  // ---------- sending ----------
  async send(raw: string) {
    const text = raw.trim();
    if (!text || this.pending) return;
    this.input.value = '';
    this.autosize();
    this.lastChatAt = Date.now();
    stopSpeaking();
    this.push('user', text);

    const intent = parseIntent(text);
    if (intent) {
      const reply = await this.runIntent(intent);
      this.push('assistant', reply);
      this.host.talk(Math.min(1500, 90 * reply.length));
      this.speakReply(reply);
      return;
    }
    const cfg = this.host.cfg;
    if (!cfg.chat.enabled) {
      this.addMsg('err', t('chat.off'));
      return;
    }

    const id = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const el = this.addMsg('assistant', '');
    el.classList.add('streaming');
    this.pending = { id, el, raw: '' };
    this.refresh();
    try {
      const summary = cfg.chat.memory ? (await invoke<{ summary: string }>('memory_get').catch(() => ({ summary: '' }))).summary : '';
      const system = systemPrompt(cfg, this.host.name, this.host.lineKind, this.kindLabel(), summary);
      const r = await invoke<Reply>('chat_send', chatRequest(cfg, id, [{ role: 'system', content: system }, ...this.context()], { tools: true }));
      let reply = visible(r.text).trim();
      for (const call of r.tool_calls ?? []) {
        const out = await this.runTool(call.name, call.arguments);
        reply = reply ? `${reply}\n${out}` : out;
      }
      if (!reply) reply = r.cancelled ? '…' : '(·ω·)';
      el.textContent = reply;
      el.classList.remove('streaming');
      this.pending = null;
      // the element is already on screen; record it without adding a second copy
      this.push('assistant', reply, false);
      this.host.talk(800);
      if (!r.cancelled) this.speakReply(reply);
      void this.maybeSummarize();
    } catch (e) {
      el.remove();
      const err = this.addMsg('err', explainError(cfg, e));
      err.insertAdjacentHTML('beforeend', ` <button class="msg-link" data-a="settings">${t('chat.openSettings')}</button>`);
    } finally {
      this.pending = null;
      this.refresh();
      this.scroll();
    }
  }

  /** read a reply aloud when the 🔊 toggle is on and the chat is still open */
  private speakReply(text: string) {
    if (this.host.cfg.chat.speak && this.open) void speak(text, locale() === 'zh' ? 'zh' : 'en');
  }

  private onDelta(d: { id: string; text: string }) {
    const p = this.pending;
    if (!p || d.id !== p.id) return;
    p.raw += d.text;
    p.el.textContent = visible(p.raw);
    this.scroll();
    this.host.talk(400);
  }

  // ---------- local commands & tools ----------
  private async openApp(name: string): Promise<string> {
    if (!this.apps) this.apps = await invoke<{ name: string; path: string }[]>('list_apps').catch(() => []);
    const hit = resolveOpen(name, this.host.cfg.launcher, this.apps);
    if (!hit) return t('chat.openFail', { name });
    try {
      await invoke('launch', { target: hit.target });
      this.host.react('hop');
      return t('chat.opened', { name: hit.name });
    } catch {
      return t('launch.fail', { name: hit.name });
    }
  }

  private async runIntent(i: Intent): Promise<string> {
    switch (i.type) {
      case 'open': return this.openApp(i.name);
      case 'timer': return this.addTimer(i.minutes, i.note);
      case 'cancelTimers': {
        const n = this.timers.length;
        this.timers.forEach((tm) => clearTimeout(this.timerHandles.get(tm.id)));
        this.timers = [];
        this.timerHandles.clear();
        this.saveTimers();
        return n ? t('chat.timersCancelled', { n: String(n) }) : t('chat.noTimers');
      }
      case 'evening':
        // let this reply land in the log, then swap the chat box for the card
        if (!this.host.cfg.evening.enabled) return t('chat.eveningOff');
        setTimeout(() => this.host.openEvening(), 700);
        return t('chat.eveningReply');
    }
  }

  private async runTool(name: string, args: string): Promise<string> {
    let a: Record<string, unknown> = {};
    try { a = JSON.parse(args || '{}'); } catch { /* keep empty */ }
    if (name === 'open_app' && typeof a.name === 'string') return this.openApp(a.name);
    if (name === 'set_timer') {
      const m = Number(a.minutes);
      if (Number.isFinite(m) && m > 0) return this.addTimer(clamp(m, 0.1, 720), typeof a.note === 'string' ? a.note.slice(0, 60) : '');
    }
    return '';
  }

  // ---------- timers ----------
  private addTimer(minutes: number, note: string): string {
    const tm: Timer = { id: Date.now() + Math.random(), at: Date.now() + minutes * 60_000, note: note.trim() };
    this.timers.push(tm);
    this.schedule(tm);
    this.saveTimers();
    const zh = locale() === 'zh';
    const when = minutes < 1 ? t('chat.sec', { n: String(Math.round(minutes * 60)) }) : t('chat.min', { n: String(Math.round(minutes * 10) / 10) });
    this.host.react('happy');
    return t('chat.timerSet', { when, note: tm.note ? (zh ? tm.note : ` to ${tm.note}`) : '' });
  }

  private schedule(tm: Timer) {
    const h = window.setTimeout(() => this.fire(tm), Math.max(0, tm.at - Date.now()));
    this.timerHandles.set(tm.id, h);
  }

  private fire(tm: Timer) {
    this.timers = this.timers.filter((x) => x.id !== tm.id);
    this.timerHandles.delete(tm.id);
    this.saveTimers();
    // a timer you asked for rings even during do-not-disturb
    this.host.wake();
    this.host.react('jump');
    this.host.ask(t('timer.fire', { note: tm.note }), [
      { label: t('timer.ok'), primary: true, run: () => this.host.say(line('thanks', this.host.lineKind)) },
    ], () => {}, 120_000);
  }

  private loadTimers() {
    try {
      const raw = JSON.parse(localStorage.getItem(TIMERS_KEY) ?? '[]') as Timer[];
      // ring ones that came due while the app was closed, if it wasn't too long ago
      this.timers = raw.filter((tm) => typeof tm.at === 'number' && tm.at > Date.now() - 10 * 60_000);
      this.timers.forEach((tm) => this.schedule(tm));
    } catch { this.timers = []; }
  }

  private saveTimers() {
    try { localStorage.setItem(TIMERS_KEY, JSON.stringify(this.timers)); } catch { /* ignore */ }
  }

  // ---------- memory ----------
  private async maybeSummarize() {
    const cfg = this.host.cfg;
    if (!cfg.chat.memory || this.summarizing) return;
    this.summarizing = true;
    try {
      await this.logChain;
      const st = await invoke<{ summary: string; upto: number; pending: number }>('memory_get');
      if (st.pending < SUMMARY_AFTER) return;
      const batch = await invoke<{ id: number; role: Role; content: string }[]>('chat_after', {
        after: st.upto, limit: st.pending - CONTEXT_MESSAGES,
      });
      if (!batch.length) return;
      const zh = locale() === 'zh';
      const who = (r: Role) => (r === 'user' ? (zh ? '用户' : 'User') : this.host.name);
      const transcript = batch.map((m) => `${who(m.role)}: ${visible(m.content)}`).join('\n').slice(-12000);
      const instructions = zh
        ? '你在帮一只桌面宠物整理它对用户的长期记忆。根据“现有记忆”和“新的聊天”，输出更新后的记忆：只保留以后聊天用得上的长期信息（称呼、工作、作息、喜好、最近在忙或在烦的事、需要关心的事），用短句分行列出，不超过 200 字。不要编造；不要记录密码、证件号、银行卡号、住址等敏感信息；过时的内容删掉。只输出记忆本身。'
        : "You maintain a desktop pet's long-term memory about its user. From the current memory and the new conversation, output the updated memory: only lasting facts useful later (how to address them, work, routine, likes, what they're busy or worried about, what to check in on), short lines, under 120 words. Don't invent anything; never store passwords, ID or card numbers, addresses or similar; drop outdated items. Output only the memory.";
      const user = zh
        ? `现有记忆：\n${st.summary || '（空）'}\n\n新的聊天：\n${transcript}`
        : `Current memory:\n${st.summary || '(empty)'}\n\nNew conversation:\n${transcript}`;
      const r = await invoke<Reply>('chat_send', chatRequest(cfg, `m${Date.now().toString(36)}`,
        [{ role: 'system', content: instructions }, { role: 'user', content: user }],
        { tools: false, stream_events: false, max_tokens: 600 }));
      const summary = visible(r.text).trim();
      if (summary && !r.cancelled) await invoke('memory_set', { summary: summary.slice(0, 1500), upto: batch[batch.length - 1].id });
    } catch (e) {
      console.warn('memory summary skipped', e);
    } finally {
      this.summarizing = false;
    }
  }

  // ---------- starting a conversation (rate-limited, off by default) ----------
  async maybeProactive(force = false) {
    const cfg = this.host.cfg;
    const limit = cfg.chat.proactivePerDay;
    if (!cfg.chat.enabled || limit <= 0) return;
    if (this.open || this.pending || this.host.quiet || this.host.asking) return;
    const now = Date.now();
    if (now - this.lastChatAt < PROACTIVE_QUIET_AFTER_CHAT) return;
    let st = { day: today(), n: 0, last: 0 };
    try { st = { ...st, ...JSON.parse(localStorage.getItem(PROACTIVE_KEY) ?? '{}') }; } catch { /* defaults */ }
    if (st.day !== today()) st = { day: today(), n: 0, last: 0 };
    if (st.n >= limit || now - st.last < PROACTIVE_GAP) return;
    if (!force && Math.random() > 0.35) return;
    // count the attempt up front so a failing model can't make us retry every 10 minutes
    st = { ...st, n: st.n + 1, last: now };
    try { localStorage.setItem(PROACTIVE_KEY, JSON.stringify(st)); } catch { /* ignore */ }

    const zh = locale() === 'zh';
    const summary = cfg.chat.memory ? (await invoke<{ summary: string }>('memory_get').catch(() => ({ summary: '' }))).summary : '';
    const system = systemPrompt(cfg, this.host.name, this.host.lineKind, this.kindLabel(), summary);
    const nudge = zh
      ? '（系统提示：用户正在电脑前工作，没有在和你说话。请你主动说一句简短的话，不超过 30 字：可以是轻松的小话题、贴合现在时间的关心，或者接着之前聊过的事。不要催用户干活，不要说想念、离不开之类的话，不要问太私人的问题。只输出这句话。）'
      : "(System: the user is working and hasn't said anything. Say one short line on your own, under 20 words: a light topic, a caring note that fits the time of day, or a follow-up on something you talked about. Don't push them to work, don't say you miss them, don't pry. Output only that line.)";
    try {
      const r = await invoke<Reply>('chat_send', chatRequest(cfg, `p${now.toString(36)}`,
        [{ role: 'system', content: system }, ...this.context().slice(-6), { role: 'user', content: nudge }],
        { tools: false, stream_events: false, max_tokens: 120 }));
      const said = visible(r.text).trim().replace(/^["“]|["”]$/g, '');
      if (!said || this.host.quiet || this.host.asking || this.open) return;
      this.host.wake();
      this.host.react('wave');
      this.host.say(said, 7000);
      this.push('assistant', said, false);
    } catch (e) {
      console.warn('proactive line skipped', e);
    }
  }
}
