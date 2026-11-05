import type { Lang, PetKind } from './config';

export type Locale = 'zh' | 'en';

const zh = {
  'kind.cat': '像素猫',
  'kind.dog': '赛博狗',
  'kind.human': '战士',
  'name.cat': '比特',
  'name.dog': '霓虹',
  'name.human': '阿燃',

  'menu.pet': '摸摸头',
  'menu.sleep': '去睡一会儿',
  'menu.wake': '叫醒它',
  'menu.switch': '换个样子',
  'menu.roam': '设置活动范围',
  'menu.settings': '设置…',
  'menu.hide': '先藏起来（托盘可唤回）',
  'menu.quit': '退出',

  'roam.hint': '按住鼠标拖动，框出宠物可以活动的区域 —— 避开你主要的工作区',
  'roam.ok': '确定',
  'roam.cancel': '取消',
  'roam.bottomRight': '右下角',
  'roam.bottomBand': '底部一条',
  'roam.rightColumn': '右侧一列',
  'roam.full': '全屏',
  'roam.tooSmall': '区域太小啦，放不下宠物',

  'settings.title': '设置',
  'settings.pet': '我的宠物',
  'settings.name': '名字',
  'settings.namePh': '默认：{name}',
  'settings.size': '大小',
  'settings.roam': '活动范围',
  'settings.roamDesc': '宠物只会在这个区域内走动，不会挡住你的主要工作区。',
  'settings.roamDraw': '在屏幕上框选…',
  'settings.general': '通用',
  'settings.lang': '语言',
  'settings.langAuto': '跟随系统',
  'settings.saved': '已保存',
  'settings.next': '下一阶段',
  'settings.nextDesc': '上下班陪伴 · 喝水/站立/休息提醒 · 快捷启动 · 自定义形象 · AI 对话 · 下班去处推荐',
} as const;

type Key = keyof typeof zh;

const en: Record<Key, string> = {
  'kind.cat': 'Pixel Cat',
  'kind.dog': 'Cyber Dog',
  'kind.human': 'Fighter',
  'name.cat': 'Bit',
  'name.dog': 'Neon',
  'name.human': 'Blaze',

  'menu.pet': 'Pat head',
  'menu.sleep': 'Take a nap',
  'menu.wake': 'Wake up',
  'menu.switch': 'Change look',
  'menu.roam': 'Set roaming area',
  'menu.settings': 'Settings…',
  'menu.hide': 'Hide (restore from tray)',
  'menu.quit': 'Quit',

  'roam.hint': 'Drag to draw where your pet may roam — keep it away from your main work area',
  'roam.ok': 'Done',
  'roam.cancel': 'Cancel',
  'roam.bottomRight': 'Bottom right',
  'roam.bottomBand': 'Bottom strip',
  'roam.rightColumn': 'Right column',
  'roam.full': 'Full screen',
  'roam.tooSmall': 'Too small for your pet',

  'settings.title': 'Settings',
  'settings.pet': 'My pet',
  'settings.name': 'Name',
  'settings.namePh': 'Default: {name}',
  'settings.size': 'Size',
  'settings.roam': 'Roaming area',
  'settings.roamDesc': 'Your pet only wanders inside this area, so it never blocks your main work.',
  'settings.roamDraw': 'Draw on screen…',
  'settings.general': 'General',
  'settings.lang': 'Language',
  'settings.langAuto': 'System',
  'settings.saved': 'Saved',
  'settings.next': 'Coming next',
  'settings.nextDesc': 'Work-hours companion · water/stand/rest reminders · quick launcher · custom looks · AI chat · after-work picks',
};

type LineCat = 'greet' | 'click' | 'annoyed' | 'petting' | 'wake' | 'sleep' | 'dropped' | 'switch' | 'power';

const LINES: Record<Locale, Record<LineCat, Partial<Record<PetKind | 'any', string[]>>>> = {
  zh: {
    greet: { any: ['我来陪你上班啦~', '今天也一起加油吧！', '嗨，{name}在这儿哦'] },
    click: {
      cat: ['喵~ (8-bit)', '喵呜？', '叮！获得 1 点好感', '呼噜呼噜…'],
      dog: ['汪！系统在线', '检测到主人 ✓', '汪汪~ 信号满格', '尾巴电机过热中！'],
      human: ['哈！', '修炼一下吗？', '摸鱼被我发现了？', '你今天也很强！'],
    },
    annoyed: { any: ['别戳啦！', '再戳要生气了 ˋ^ˊ', '晕了晕了…'] },
    petting: { any: ['好舒服~', '再摸摸~', '♥ ♥ ♥'] },
    wake: { cat: ['唔…刚梦到像素小鱼干', '啊！我没睡！'], dog: ['系统重启完成', '低功耗模式已退出'], human: ['我只是在冥想…', '啊，开会了吗？'] },
    sleep: { any: ['好困…睡一小会儿', 'Zzz…'] },
    dropped: { any: ['哇——', '轻点放嘛~', '着陆成功！'] },
    switch: { any: ['变身！', '新造型怎么样？'] },
    power: { any: ['力量全开！！', '感受到了吗，这股气！', '今天的我，状态拉满！'] },
  },
  en: {
    greet: { any: ["I'm here for your workday!", "Let's do great today!", 'Hi, {name} is here'] },
    click: {
      cat: ['Meow~ (8-bit)', 'Mrrp?', 'Ding! +1 affection', 'Purr purr…'],
      dog: ['Woof! System online', 'Owner detected ✓', 'Arf~ full signal', 'Tail motor overheating!'],
      human: ['Hah!', 'Training time?', 'Caught you slacking?', "You're unstoppable today!"],
    },
    annoyed: { any: ['Stop poking!', "I'm getting grumpy ˋ^ˊ", 'So dizzy…'] },
    petting: { any: ['That feels nice~', 'More pats~', '♥ ♥ ♥'] },
    wake: { cat: ['Mm… dreamt of pixel fish', "I wasn't asleep!"], dog: ['Reboot complete', 'Exiting low-power mode'], human: ['Just meditating…', 'Is the meeting starting?'] },
    sleep: { any: ['So sleepy… quick nap', 'Zzz…'] },
    dropped: { any: ['Whoa—', 'Gently please~', 'Touchdown!'] },
    switch: { any: ['Ta-da!', 'How do I look?'] },
    power: { any: ['FULL POWER!!', 'Feel that energy?', "I'm fully charged today!"] },
  },
};

let current: Locale = 'zh';

export function resolveLang(l: Lang): Locale {
  if (l === 'zh' || l === 'en') return l;
  return (navigator.language || 'en').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function setLang(l: Lang): Locale {
  current = resolveLang(l);
  document.documentElement.lang = current === 'zh' ? 'zh-CN' : 'en';
  return current;
}

export function locale(): Locale {
  return current;
}

function fill(s: string, vars?: Record<string, string>) {
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '') : s;
}

export function t(key: Key, vars?: Record<string, string>): string {
  const table = current === 'zh' ? zh : en;
  return fill(table[key] ?? key, vars);
}

export function petName(kind: PetKind, custom: string): string {
  return custom.trim() || t(`name.${kind}` as Key);
}

export function line(cat: LineCat, kind: PetKind, vars?: Record<string, string>): string {
  const pool = LINES[current][cat][kind] ?? LINES[current][cat].any ?? [''];
  return fill(pool[Math.floor(Math.random() * pool.length)], vars);
}
