# Pawse 爪憩

> 打工人的桌面情感陪伴宠物 · An emotional-companion desktop pet for your workday

**[中文](#中文) · [English](#english)**

---

## 中文

Pawse 是一只住在你桌面角落的小宠物，可以是像素飞猫、宇航员、战士，也可以用你自己的照片做。它只在你划定的区域里活动，不挡你干活。它会陪你上下班、提醒你喝水起身，也能陪你聊天，下班时还会帮你想想今晚去哪儿。支持 macOS，Windows 版正在适配。

### 功能

**M1 · 会动、会互动、不打扰**
- 三个内置形象，用程序化动画实现呼吸、眨眼、视线跟随、走路、挤压拉伸：
  - 🌈 像素飞猫：原创。
  - 🧑‍🚀 宇航员：Pixabay 免费素材，见 [CREDITS.md](CREDITS.md)。
  - ⚡ 战士：原创。
- 🖱️ 全局鼠标穿透：只有宠物、气泡和菜单接收鼠标，其他地方的点击直接落到桌面上。
- 👀 互动：悬停时它会看向你；来回蹭它的头就是摸头；可以点它、拖它；不理它久了会打瞌睡。
- 🗺️ 活动范围：在屏幕上直接框选，也可以用预设。
- 🌏 中文 / English，默认跟随系统语言。

**M2 · 上班搭子**
- 🕘 上下班：上班打招呼、喊你吃午饭、下班道别；下班后你还在电脑前，它会提醒你早点休息。
- 💧 健康提醒：喝水、起来活动、远眺。
  - 只计算你在电脑前的时间。
  - 挑你停下来的空档再提醒。
  - 你连续不理会，它会自动降低提醒频率。
- 🤫 勿扰：开会软件在前台或全屏时不打扰。
- 🚀 快捷启动：快捷键 ⌃⌥P。
- 🙈 落脚时避开你正在用的窗口。
- 🔁 开机自启。
- 隐私：只读取键鼠空闲时长和前台应用的位置。不读窗口标题、不截屏、不记录按键。

**M3 · 我的宠物**
- 📷 用照片做宠物：在本机自动抠图，图片不上传。
- ✨ 用文字描述生成形象：调用通义万相或 OpenAI，用你自己的 Key（⚠️ 接口已留好，还没用真实 Key 测过）。
- 🎨 内置形象可以换配色、戴配饰。
- 📦 `.pawse` 角色包：可以导出、导入，分享给朋友。

**M4 · 会聊天的伙伴**
- 💬 对话框：快捷键 ⌃⌥C，回复逐字流式显示。
- 🆓 免费的模型选择：
  - 本机 [Ollama](https://ollama.com)：免费，聊天内容不出电脑。
  - 智谱 GLM-4.7-Flash、硅基流动：有免费额度，注册拿个 Key 就能用。
  - 也可以接 DeepSeek、通义千问、OpenAI 或任意兼容 OpenAI 的接口。
- 🔑 所有 API Key 都存在系统钥匙串里。
- 🔊 朗读回复用系统自带的声音，免费、不联网。语音输入用 macOS 听写，连按两下 Fn。
- ⚡ 本地指令：「打开微信」「十分钟后提醒我喝水」这类话直接在本机执行，不花 token。
- 🎭 人格卡：可以设定性格、说话风格、不要做的事。
- 🧠 记忆：只存在本机。设置里可以查看、修改、清空。
- 🤝 不讨好、不黏人：鼓励你按时下班、多联系朋友家人。主动搭话默认关闭。

**M5 · 下班去哪儿**（上半部分已完成）
- 🌆 按天气、星期几和你的偏好，推荐今晚的 3 个去处。
  - 下雨不推户外，降温推火锅；周五偏演出和小酒馆。
- 🔗 点一下就跳到搜索页：
  - 国内：高德、小红书、大麦。
  - 海外：Google Maps、Yelp、Ticketmaster。
- 🆓 天气来自 [Open-Meteo](https://open-meteo.com)，不用 Key，不读取定位。

### 开发

需要：Node 20+、Rust；macOS 上还需要 Xcode Command Line Tools。

```bash
npm install
npm run tauri dev      # 开发运行
npm run tauri build    # 打包 .app / .dmg（Windows 上是 .msi / .exe）
```

> macOS 链接时报错 `tapi error: malformed file ... MacOSX27.0.sdk`？
> 新建 `src-tauri/.cargo/config.toml`（已加入 gitignore），写入：
> ```toml
> [env]
> SDKROOT = "/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk"
> ```

`npm run dev` 会在浏览器里打开，用模拟的后端运行（`src/dev/browserShim.ts`），不需要 Rust，也不需要 API Key。

配置文件位置：`~/Library/Application Support/io.github.pawse.desktop/config.json`

### 技术栈

- **Tauri 2（Rust）**：跨平台，内存占用远小于 Electron。系统 API、网络请求和钥匙串都在 Rust 一侧处理。
- **TypeScript + Vite（无框架）**：宠物窗口每帧都要渲染，所以保持轻量。
- **透明置顶窗口**：铺满整个屏幕，默认让点击穿透。Rust 每 33ms 检查一次鼠标位置，只有鼠标落在宠物、气泡或菜单上时才接收点击。

计划见 [docs/ROADMAP.md](docs/ROADMAP.md)。

---

## English

Pawse is a little pet that lives in a corner of your desktop: a pixel flying cat, an astronaut, a fighter, or one made from your own photo. It stays inside the area you choose, so it never gets in the way of your work. It keeps you company through the workday, reminds you to drink water and stretch, chats with you, and helps you decide what to do after work. macOS works today; Windows support is in progress.

### Features

**M1 · Alive, playful, never in the way**
- Three built-in pets, animated in code (breathing, blinking, eyes that follow you, walking, squash and stretch):
  - 🌈 Pixel flying cat: original.
  - 🧑‍🚀 Astronaut: free Pixabay footage, see [CREDITS.md](CREDITS.md).
  - ⚡ Fighter: original.
- 🖱️ Click-through: only the pet, its bubbles and menus take the mouse. Every other click goes straight to your desktop.
- 👀 Interaction: hover and it looks at you; rub its head to pet it; click it or drag it around. Leave it alone long enough and it naps.
- 🗺️ Roaming area: draw it on screen, or pick a preset.
- 🌏 Chinese and English; follows your system language by default.

**M2 · Work buddy**
- 🕘 Work hours: it greets you when you start, calls you to lunch, and says goodbye at clock-out. If you're still at your desk after hours, it nudges you to rest.
- 💧 Health reminders: water, standing up, resting your eyes.
  - Only time spent at your computer counts.
  - It waits for a natural pause before reminding you.
  - If you keep ignoring reminders, they come less often.
- 🤫 Do not disturb: stays quiet while a meeting app is in front or a window is full screen.
- 🚀 Quick launcher: ⌃⌥P (Ctrl+Alt+P on Windows).
- 🙈 Avoids the window you're working in.
- 🔁 Launch at login.
- Privacy: it reads only how long the keyboard and mouse have been idle, and where the front app's window is. No window titles, screenshots or keystrokes.

**M3 · Your own pet**
- 📷 Make a pet from a photo: the background is removed on your machine, and the photo never leaves it.
- ✨ Generate a pet from a description: uses Tongyi Wanxiang or OpenAI with your own key (⚠️ the integration is in place but hasn't been tested with a real key yet).
- 🎨 Recolour the built-in pets and give them accessories.
- 📦 `.pawse` pet packs: export and import to share with friends.

**M4 · A friend to talk to**
- 💬 Chat box: open it with ⌃⌥C; replies stream in as they're written.
- 🆓 Free model options:
  - Local [Ollama](https://ollama.com): free, and the conversation stays on your computer.
  - Zhipu GLM-4.7-Flash and SiliconFlow: free tiers; sign up and paste a key.
  - DeepSeek, Qwen, OpenAI, or any OpenAI-compatible endpoint also work.
- 🔑 Every API key is kept in the system keychain.
- 🔊 Replies can be read aloud with the system voice, free and offline. To talk instead of type, use macOS Dictation (press Fn twice).
- ⚡ Local commands: things like "open Slack" or "remind me in 10 minutes to drink water" run on your computer and cost no tokens.
- 🎭 Persona card: set its personality, speaking style, and things to avoid.
- 🧠 Memory stays on your computer. You can view, edit or clear it in Settings.
- 🤝 Not clingy or flattering: it encourages you to log off on time and stay in touch with friends and family. Starting conversations on its own is off by default.

**M5 · After work** (first half done)
- 🌆 Three ideas for tonight, based on the weather, the day of the week and your preferences.
  - No outdoor ideas when it rains, hot pot when it's cold, shows and bars on a Friday.
- 🔗 One click opens a search:
  - Outside China: Google Maps, Yelp, Ticketmaster.
  - In China: Amap, Xiaohongshu, Damai.
- 🆓 Weather comes from [Open-Meteo](https://open-meteo.com). No key needed, and your location is never read.

### Development

You need Node 20+ and Rust. On macOS you also need the Xcode Command Line Tools.

```bash
npm install
npm run tauri dev      # run in development
npm run tauri build    # build .app / .dmg (.msi / .exe on Windows)
```

> Linker error `tapi error: malformed file ... MacOSX27.0.sdk` on macOS?
> Create `src-tauri/.cargo/config.toml` (it's gitignored) with:
> ```toml
> [env]
> SDKROOT = "/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk"
> ```

`npm run dev` opens the app in a browser with a mock backend (`src/dev/browserShim.ts`). It needs neither Rust nor any API key.

Config file: `~/Library/Application Support/io.github.pawse.desktop/config.json`

### Tech

- **Tauri 2 (Rust)**: cross-platform and far lighter on memory than Electron. System APIs, network requests and the keychain are all handled on the Rust side.
- **TypeScript + Vite, no framework**: the pet window renders every frame, so it's kept lean.
- **A transparent always-on-top window** covers the whole screen and lets clicks through by default. Every 33 ms, Rust checks where the mouse is and takes clicks only when it's over the pet, a bubble or a menu.

Roadmap (in Chinese): [docs/ROADMAP.md](docs/ROADMAP.md).
