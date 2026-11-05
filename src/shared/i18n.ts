import type { Lang, PetKind } from './config';

export type Locale = 'zh' | 'en';

const zh = {
  'kind.cat': '猫咪',
  'kind.dog': '小狗',
  'kind.human': '小人',
  'name.cat': '年糕',
  'name.dog': '豆包',
  'name.human': '小打工',

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
  'kind.cat': 'Cat',
  'kind.dog': 'Dog',
  'kind.human': 'Buddy',
  'name.cat': 'Mochi',
  'name.dog': 'Biscuit',
  'name.human': 'Sam',

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

type LineCat = 'greet' | 'click' | 'annoyed' | 'petting' | 'wake' | 'sleep' | 'dropped' | 'switch';

const LINES: Record<Locale, Record<LineCat, Partial<Record<PetKind | 'any', string[]>>>> = {
  zh: {
    greet: { any: ['我来陪你上班啦~', '今天也一起加油吧！', '嗨，{name}在这儿哦'] },
    click: {
      cat: ['喵~', '喵呜？', '干嘛戳我~', '呼噜呼噜…'],
      dog: ['汪！', '汪汪~', '要一起玩吗？', '尾巴停不下来！'],
      human: ['嘿！', '在呢在呢~', '摸鱼被我发现了？', '你今天也很棒！'],
    },
    annoyed: { any: ['别戳啦！', '再戳要生气了 ˋ^ˊ', '晕了晕了…'] },
    petting: { any: ['好舒服~', '再摸摸~', '♥ ♥ ♥'] },
    wake: { cat: ['唔…刚梦到小鱼干', '啊！我没睡！'], dog: ['汪？到点吃饭了吗', '我醒啦！'], human: ['我只是闭目养神…', '啊，开会了吗？'] },
    sleep: { any: ['好困…睡一小会儿', 'Zzz…'] },
    dropped: { any: ['哇——', '轻点放嘛~', '着陆成功！'] },
    switch: { any: ['变身！', '新造型怎么样？'] },
  },
  en: {
    greet: { any: ["I'm here for your workday!", "Let's do great today!", 'Hi, {name} is here'] },
    click: {
      cat: ['Meow~', 'Mrrp?', 'Why poke me~', 'Purr purr…'],
      dog: ['Woof!', 'Arf arf~', 'Wanna play?', "Can't stop wagging!"],
      human: ['Hey!', "I'm here~", 'Caught you slacking?', "You're doing great!"],
    },
    annoyed: { any: ['Stop poking!', "I'm getting grumpy ˋ^ˊ", 'So dizzy…'] },
    petting: { any: ['That feels nice~', 'More pats~', '♥ ♥ ♥'] },
    wake: { cat: ['Mm… dreamt of fish', "I wasn't asleep!"], dog: ['Is it dinner time?', "I'm up!"], human: ['Just resting my eyes…', 'Is the meeting starting?'] },
    sleep: { any: ['So sleepy… quick nap', 'Zzz…'] },
    dropped: { any: ['Whoa—', 'Gently please~', 'Touchdown!'] },
    switch: { any: ['Ta-da!', 'How do I look?'] },
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
