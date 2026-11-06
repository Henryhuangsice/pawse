/**
 * Everyday commands understood on this computer, before (or without) any AI model:
 * "帮我打开微信", "十分钟后提醒我喝水", "remind me in 5 minutes to stretch", "取消提醒".
 * They cost no tokens and work offline; anything else goes to the chat model.
 */

export type Intent =
  | { type: 'open'; name: string }
  | { type: 'timer'; minutes: number; note: string }
  | { type: 'cancelTimers' };

const DIGIT: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

/** "25" / "二十五" / "十" / "一百二十" → number */
export function cnNumber(s: string): number | null {
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  let total = 0, cur = 0, seen = false;
  for (const ch of s) {
    if (ch in DIGIT) { cur = DIGIT[ch]; seen = true; }
    else if (ch === '十') { total += (cur || 1) * 10; cur = 0; seen = true; }
    else if (ch === '百') { total += (cur || 1) * 100; cur = 0; seen = true; }
    else return null;
  }
  return seen ? total + cur : null;
}

const ZH_TIME = /(\d+(?:\.\d+)?|[零〇一二两三四五六七八九十百]+|半)\s*(个)?\s*(半)?\s*(分钟|分|小时|钟头|秒钟|秒)\s*(?:以后|之后|过后|后)?/;
const ZH_WANT = /提醒|叫我|喊我|告诉我|闹钟|计时|定时/;
const ZH_FILLER = /请|麻烦|帮我|帮忙|给我|提醒我|提醒|叫我|喊我|告诉我|一下|记得|定一?个|设一?个|设置|闹钟|计时器?|定时|的时候|吧|哦|呀|啊|哈|呗|[。！!，,、\s]/g;

const EN_TIME = /\b(?:in|after|for)?\s*(\d+(?:\.\d+)?|an?|half an?|one|two|three|five|ten|fifteen|twenty|thirty)\s*(minutes?|mins?|hours?|hrs?|seconds?|secs?)\b/i;
const EN_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, five: 5, ten: 10, fifteen: 15, twenty: 20, thirty: 30 };

const clampMin = (m: number) => Math.min(720, Math.max(0.1, Math.round(m * 100) / 100));

function zhTimer(s: string): Intent | null {
  if (!ZH_WANT.test(s)) return null;
  const m = s.match(ZH_TIME);
  if (!m) return null;
  let n = m[1] === '半' ? 0.5 : cnNumber(m[1]);
  if (n === null) return null;
  if (m[3]) n += 0.5; // 一个半小时
  const unit = m[4];
  const minutes = unit.startsWith('分') ? n : unit === '小时' || unit === '钟头' ? n * 60 : n / 60;
  const note = s.replace(m[0], '').replace(ZH_FILLER, '').replace(/^(我|要|该|去)+(?=.)/, '');
  return { type: 'timer', minutes: clampMin(minutes), note };
}

function enTimer(s: string): Intent | null {
  if (!/\bremind me\b|\btimer\b|\balarm\b/i.test(s)) return null;
  const m = s.match(EN_TIME);
  if (!m) return null;
  const w = m[1].toLowerCase();
  const n = /^half/.test(w) ? 0.5 : EN_WORDS[w] ?? Number(w);
  if (!Number.isFinite(n)) return null;
  const u = m[2].toLowerCase();
  const minutes = u.startsWith('h') ? n * 60 : u.startsWith('s') ? n / 60 : n;
  const about = s.match(/\b(?:to|about|that)\s+(.+?)[.!?]*$/i);
  let note = about ? about[1].replace(EN_TIME, '').trim() : '';
  note = note.replace(/^(?:remind me\s*)/i, '').trim();
  return { type: 'timer', minutes: clampMin(minutes), note };
}

export function parseIntent(input: string): Intent | null {
  const s = input.trim();
  if (!s || s.length > 80) return null;

  if (/(取消|删掉|删除|关掉|不用).{0,6}(提醒|闹钟|计时)|^cancel\b.*\b(reminders?|timers?|alarms?)\b/i.test(s)) {
    return { type: 'cancelTimers' };
  }
  const timer = zhTimer(s) ?? enTimer(s);
  if (timer) return timer;

  const zhOpen = s.match(/^(?:请|麻烦)?(?:你)?(?:帮我|给我)?(?:打开一下|开一下|打开|启动|运行)\s*(.+?)\s*(?:吧|一下|呗|哈|好吗|可以吗)?[。！!？?]*$/);
  if (zhOpen && zhOpen[1].length <= 30) return { type: 'open', name: zhOpen[1] };
  const enOpen = s.match(/^(?:please\s+)?(?:can you\s+|could you\s+)?(?:open|launch)\s+(?:up\s+)?(.+?)(?:\s+for me)?(?:\s+please)?[.!?]*$/i);
  if (enOpen && enOpen[1].length <= 40) return { type: 'open', name: enOpen[1].replace(/^the\s+/i, '') };
  return null;
}

/** Common Chinese names → macOS app names. */
const ALIASES: Record<string, string[]> = {
  微信: ['WeChat', '微信'],
  企业微信: ['企业微信', 'WeCom', 'WeWork'],
  钉钉: ['DingTalk', '钉钉'],
  飞书: ['Lark', 'Feishu', '飞书'],
  qq: ['QQ'],
  网易云音乐: ['NeteaseMusic', '网易云音乐'],
  腾讯会议: ['TencentMeeting', '腾讯会议'],
  浏览器: ['Safari', 'Google Chrome', 'Microsoft Edge', 'Firefox'],
  谷歌浏览器: ['Google Chrome'],
  chrome: ['Google Chrome'],
  日历: ['Calendar'],
  备忘录: ['Notes'],
  提醒事项: ['Reminders'],
  访达: ['Finder'],
  终端: ['Terminal'],
  邮件: ['Mail'],
  音乐: ['Music'],
  计算器: ['Calculator'],
  系统设置: ['System Settings', 'System Preferences'],
  vscode: ['Visual Studio Code'],
  'vs code': ['Visual Studio Code'],
};

export interface Openable { name: string; target: string }

/** Match a spoken app name against the launcher list and installed apps. */
export function resolveOpen(name: string, launcher: Openable[], apps: { name: string; path: string }[]): Openable | null {
  const q = name.trim().toLowerCase().replace(/\.app$/, '');
  if (!q) return null;
  const hit = (n: string) => n.toLowerCase() === q;
  const part = (n: string) => n.toLowerCase().includes(q) || q.includes(n.toLowerCase());
  const own = launcher.find((it) => hit(it.name)) ?? launcher.find((it) => it.name.trim() && part(it.name));
  if (own) return own;
  const wanted = ALIASES[q] ?? [];
  for (const w of wanted) {
    const a = apps.find((x) => x.name.toLowerCase() === w.toLowerCase());
    if (a) return { name: a.name, target: a.path };
  }
  const app = apps.find((a) => hit(a.name)) ?? (q.length >= 3 ? apps.find((a) => part(a.name)) : undefined);
  if (app) return { name: app.name, target: app.path };
  // "baidu.com", "https://…"
  if (/^https?:\/\//.test(q)) return { name, target: name.trim() };
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(q)) return { name, target: `https://${q}` };
  return null;
}
