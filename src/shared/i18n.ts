import type { Lang, PetKind } from './config';

export type Locale = 'zh' | 'en';

const zh = {
  'kind.cat': '像素飞猫',
  'kind.astro': '宇航员',
  'kind.human': '战士',
  'name.cat': '彗星',
  'name.astro': '小舟',
  'name.human': '阿燃',

  'menu.pet': '摸摸头',
  'menu.sleep': '去睡一会儿',
  'menu.wake': '叫醒它',
  'menu.switch': '换个样子',
  'menu.roam': '设置活动范围',
  'menu.settings': '设置…',
  'menu.hide': '先藏起来（托盘可唤回）',
  'menu.quit': '退出',
  'menu.launcher': '快捷启动',
  'menu.launcherEmpty': '还没有添加，去设置里加几个吧',
  'menu.launcherEdit': '编辑快捷启动…',
  'menu.dnd': '勿扰 1 小时',
  'menu.dndOff': '结束勿扰（{time} 结束）',

  'ask.water': '喝了 ✓',
  'ask.stand': '站起来了 ✓',
  'ask.eyes': '看了 ✓',
  'ask.snooze': '{min} 分钟后',
  'launch.fail': '没打开 {name}…检查一下设置里的地址？',

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
  'settings.autostart': '开机时自动启动',
  'settings.avoid': '尽量不挡住当前正在用的窗口',
  'settings.work': '上下班',
  'settings.workDesc': '上班时陪你、提醒你；下班后只道别，不再打扰。',
  'settings.workOn': '按工作时间陪伴（关闭后提醒全天有效）',
  'settings.days': '工作日',
  'settings.hours': '上班时间',
  'settings.lunch': '午休',
  'settings.to': '至',
  'settings.reminders': '健康提醒',
  'settings.remindersDesc': '只计算你坐在电脑前的时间；离开超过设定时长视为已起身，计时自动重置。',
  'settings.water': '💧 喝水',
  'settings.stand': '🧍 起来活动',
  'settings.eyes': '👀 远眺放松（20-20-20）',
  'settings.every': '每 {n} 分钟',
  'settings.away': '键鼠空闲多久算离开',
  'settings.snooze': '“稍后”推迟',
  'settings.min': '分钟',
  'settings.dnd': '勿扰',
  'settings.dndMeetings': '开会时安静（Zoom、腾讯会议、Teams 等在前台）',
  'settings.dndFullscreen': '全屏时安静（演示、看视频、游戏）',
  'settings.launcher': '快捷启动',
  'settings.launcherDesc': '右键宠物或按 {key} 打开。可以填应用名、网址或应用路径。',
  'settings.launcherName': '名称',
  'settings.launcherTarget': '应用名 / 网址',
  'settings.launcherAdd': '+ 添加',
  'settings.launcherRemove': '删除',
  'settings.next': '下一阶段',
  'settings.nextDesc': '自定义形象 · AI 对话 · 下班去处推荐',
  'day.0': '日', 'day.1': '一', 'day.2': '二', 'day.3': '三', 'day.4': '四', 'day.5': '五', 'day.6': '六',
} as const;

type Key = keyof typeof zh;

const en: Record<Key, string> = {
  'kind.cat': 'Pixel Comet',
  'kind.astro': 'Astronaut',
  'kind.human': 'Fighter',
  'name.cat': 'Comet',
  'name.astro': 'Orbit',
  'name.human': 'Blaze',

  'menu.pet': 'Pat head',
  'menu.sleep': 'Take a nap',
  'menu.wake': 'Wake up',
  'menu.switch': 'Change look',
  'menu.roam': 'Set roaming area',
  'menu.settings': 'Settings…',
  'menu.hide': 'Hide (restore from tray)',
  'menu.quit': 'Quit',
  'menu.launcher': 'Quick launch',
  'menu.launcherEmpty': 'Nothing yet — add some in Settings',
  'menu.launcherEdit': 'Edit quick launch…',
  'menu.dnd': 'Do not disturb for 1 hour',
  'menu.dndOff': 'End do-not-disturb (until {time})',

  'ask.water': 'Done ✓',
  'ask.stand': "I'm up ✓",
  'ask.eyes': 'Done ✓',
  'ask.snooze': 'In {min} min',
  'launch.fail': "Couldn't open {name}… check its target in Settings?",

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
  'settings.autostart': 'Launch at login',
  'settings.avoid': "Try not to cover the window you're using",
  'settings.work': 'Work hours',
  'settings.workDesc': 'Keeps you company and reminds you during work; after hours it just says goodbye.',
  'settings.workOn': 'Follow work hours (off = reminders all day)',
  'settings.days': 'Work days',
  'settings.hours': 'Hours',
  'settings.lunch': 'Lunch',
  'settings.to': 'to',
  'settings.reminders': 'Wellbeing reminders',
  'settings.remindersDesc': 'Only time at your computer counts. Step away longer than the limit below and the timers reset.',
  'settings.water': '💧 Drink water',
  'settings.stand': '🧍 Get up and move',
  'settings.eyes': '👀 Eye break (20-20-20)',
  'settings.every': 'every {n} min',
  'settings.away': 'Idle this long = away',
  'settings.snooze': '“Later” snoozes for',
  'settings.min': 'min',
  'settings.dnd': 'Do not disturb',
  'settings.dndMeetings': 'Quiet during meetings (Zoom, Teams, VooV… in front)',
  'settings.dndFullscreen': 'Quiet while full screen (slides, video, games)',
  'settings.launcher': 'Quick launch',
  'settings.launcherDesc': 'Right-click your pet or press {key}. Use an app name, a URL or an app path.',
  'settings.launcherName': 'Name',
  'settings.launcherTarget': 'App name / URL',
  'settings.launcherAdd': '+ Add',
  'settings.launcherRemove': 'Remove',
  'settings.next': 'Coming next',
  'settings.nextDesc': 'Custom looks · AI chat · after-work picks',
  'day.0': 'Su', 'day.1': 'Mo', 'day.2': 'Tu', 'day.3': 'We', 'day.4': 'Th', 'day.5': 'Fr', 'day.6': 'Sa',
};

type LineCat =
  | 'greet' | 'click' | 'annoyed' | 'petting' | 'wake' | 'sleep' | 'dropped' | 'switch' | 'power'
  // M2 work buddy
  | 'clockIn' | 'monday' | 'friday' | 'early' | 'lunch' | 'afternoon' | 'clockOut' | 'relax' | 'stillHere'
  | 'overtime' | 'weekend' | 'cheer' | 'back'
  | 'remind.water' | 'remind.stand' | 'remind.eyes' | 'thanks' | 'snoozed' | 'dndOn';

const LINES: Record<Locale, Record<LineCat, Partial<Record<PetKind | 'any', string[]>>>> = {
  zh: {
    greet: { any: ['我来陪你上班啦~', '今天也一起加油吧！', '嗨，{name}在这儿哦'] },
    click: {
      cat: ['喵~ 起飞！', '喵呜？', '叮！获得 1 点好感', '彩虹尾巴充能中~'],
      astro: ['地球你好！', '这里是{name}，信号良好', '失重状态，工作也飘了', '要不要一起漫步太空？'],
      human: ['哈！', '修炼一下吗？', '摸鱼被我发现了？', '你今天也很强！'],
    },
    annoyed: { any: ['别戳啦！', '再戳要生气了 ˋ^ˊ', '晕了晕了…'] },
    petting: { any: ['好舒服~', '再摸摸~', '♥ ♥ ♥'] },
    wake: { cat: ['唔…刚飞过一片星云', '啊！我没睡！'], astro: ['休眠舱解除，恢复通讯', '刚绕地球飘了一圈'], human: ['我只是在冥想…', '啊，开会了吗？'] },
    sleep: { any: ['好困…睡一小会儿', 'Zzz…'] },
    dropped: { any: ['哇——', '轻点放嘛~', '着陆成功！'] },
    switch: { any: ['变身！', '新造型怎么样？'] },
    power: { any: ['力量全开！！', '感受到了吗，这股气！', '今天的我，状态拉满！'] },

    clockIn: { any: ['上班打卡！今天也一起加油', '早上好~ 先喝口水再开工吧', '新的一天，{name}已就位！'] },
    monday: { any: ['周一啦，慢慢进入状态就好', '周一综合征？我陪你一起扛'] },
    friday: { any: ['周五啦！再坚持一下就周末了', '今天是周五，摸鱼…啊不，冲刺！'] },
    early: { any: ['这么早就来啦？辛苦了', '还没到上班时间呢，先吃个早饭？'] },
    lunch: { any: ['午饭时间到！去吃点好的', '午休啦，离开屏幕歇一会儿吧', '吃饭不积极，思想有问题~'] },
    afternoon: { any: ['下午场开始！', '吃饱了吗？下午也一起加油', '午后容易犯困，起来走两步？'] },
    clockOut: { any: ['下班时间到！今天辛苦啦 👋', '收工收工~ 明天见！', '到点啦，剩下的明天再说吧'] },
    relax: { any: ['下班去散散步吧，吹吹晚风', '今晚做点让自己开心的事？', '去运动一下，出出汗就不累了', '约朋友吃顿好的吧', '早点回家，泡个热水澡'] },
    stillHere: { any: ['已经下班了哦，还在忙吗？', '下班时间到了，别忘了休息'] },
    overtime: { any: ['已经加班 {h} 小时啦，早点回去吧', '还在忙呀…身体最重要哦'] },
    weekend: { any: ['周末还在电脑前？记得休息', '今天是休息日哦，别太累啦'] },
    cheer: { any: ['你已经很努力了！', '专注的样子很帅哦', '一步一步来，没问题的', '累了就看看我~', '今天的进度不错嘛', '有我在，放心冲！'] },
    back: { any: ['欢迎回来！刚好休息了 {m} 分钟', '回来啦~ 休息得怎么样？'] },
    'remind.water': { any: ['该喝水啦 💧 来一大口', '喝口水吧，我帮你看着屏幕', '补充水分时间到！'] },
    'remind.stand': { any: ['坐了好久啦，起来伸个懒腰吧 🧍', '站起来活动一下？走两步也好', '腰：救救我。起来动动吧！'] },
    'remind.eyes': { any: ['看看 6 米外的地方，20 秒就好 👀', '眼睛休息一下，看看窗外吧', '眨眨眼，看看远处~'] },
    thanks: { any: ['真棒！', '好习惯 +1 ✨', '做得好~', '收到！'] },
    snoozed: { any: ['好，等会儿再叫你', '那我 {m} 分钟后再提醒'] },
    dndOn: { any: ['好，我安静待着 🤫', '收到，不打扰你'] },
  },
  en: {
    greet: { any: ["I'm here for your workday!", "Let's do great today!", 'Hi, {name} is here'] },
    click: {
      cat: ['Meow~ liftoff!', 'Mrrp?', 'Ding! +1 affection', 'Charging rainbow tail~'],
      astro: ['Hello, Earth!', '{name} here, signal is strong', 'Zero-g… my focus is floating', 'Spacewalk with me?'],
      human: ['Hah!', 'Training time?', 'Caught you slacking?', "You're unstoppable today!"],
    },
    annoyed: { any: ['Stop poking!', "I'm getting grumpy ˋ^ˊ", 'So dizzy…'] },
    petting: { any: ['That feels nice~', 'More pats~', '♥ ♥ ♥'] },
    wake: { cat: ['Mm… flew through a nebula', "I wasn't asleep!"], astro: ['Leaving hypersleep, comms back online', 'Just drifted round the Earth'], human: ['Just meditating…', 'Is the meeting starting?'] },
    sleep: { any: ['So sleepy… quick nap', 'Zzz…'] },
    dropped: { any: ['Whoa—', 'Gently please~', 'Touchdown!'] },
    switch: { any: ['Ta-da!', 'How do I look?'] },
    power: { any: ['FULL POWER!!', 'Feel that energy?', "I'm fully charged today!"] },

    clockIn: { any: ["Clocked in! Let's have a good one", 'Morning~ water first, then work', '{name} reporting for duty!'] },
    monday: { any: ["It's Monday — ease into it", "Monday blues? I've got you"] },
    friday: { any: ["Friday! The weekend's almost here", 'Friday push — you got this'] },
    early: { any: ["You're early! Have you had breakfast?", 'Work starts later — grab a coffee first?'] },
    lunch: { any: ['Lunch time! Go eat something good', 'Lunch break — step away from the screen', 'Food first, emails later~'] },
    afternoon: { any: ['Afternoon session, go!', "Fed and ready? Let's go", 'Sleepy afternoon? Take a short walk'] },
    clockOut: { any: ["That's a wrap! Great work today 👋", 'Clocking out~ see you tomorrow!', 'Time to go — the rest can wait'] },
    relax: { any: ['Take an evening walk tonight?', 'Do something just for you tonight', 'A quick workout clears the head', 'Grab dinner with a friend', 'Head home early, have a long shower'] },
    stillHere: { any: ["Work's over — still at it?", "It's past your hours, don't forget to rest"] },
    overtime: { any: ["That's {h} hour(s) of overtime — head home soon", 'Still going… your health matters more'] },
    weekend: { any: ["At the computer on a day off? Don't overdo it", "It's your day off — go easy"] },
    cheer: { any: ["You're doing great!", 'Look at you, so focused', 'One step at a time — you got this', 'Tired? Look at me for a sec~', 'Nice progress today', "I'm right here, keep going!"] },
    back: { any: ['Welcome back! That was a {m}-minute break', 'Back already~ feel refreshed?'] },
    'remind.water': { any: ['Water time 💧 take a big sip', "Have a drink, I'll watch the screen", 'Hydration check!'] },
    'remind.stand': { any: ["You've been sitting a while — stretch it out 🧍", 'Stand up and walk a little?', 'Your back says: please move!'] },
    'remind.eyes': { any: ['Look at something 6 m away for 20 s 👀', 'Rest your eyes — look out the window', 'Blink, and look far away~'] },
    thanks: { any: ['Awesome!', 'Good habit +1 ✨', 'Nice~', 'Got it!'] },
    snoozed: { any: ["OK, I'll ask again later", "I'll remind you in {m} min"] },
    dndOn: { any: ["OK, I'll stay quiet 🤫", "Got it, I won't disturb you"] },
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
