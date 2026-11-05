# Pawse 爪憩

> 打工人的桌面情感陪伴宠物 · An emotional-companion desktop pet for your workday.

Pawse 是一只住在你桌面角落的小宠物（像素飞猫 / 宇航员 / 战士）。它会自己走来走去，但只在你划定的区域里活动，不挡你干活；鼠标靠近时它会看向你，点它、摸它、拖它都有反应。后续版本会加入上下班陪伴、喝水/站立提醒、快捷启动、自定义形象、AI 对话和下班去处推荐（国内 + 海外）。

## 当前进度：M1 —— 会动、会互动、不打扰

- 三个内置形象，矢量分部件 / 视频帧图集 + **程序化动画**（呼吸、眨眼、视线跟随、走路、摇尾巴、挤压拉伸），各有一套渲染风格：
  - 🌈 **像素飞猫**（原创）：8-bit 像素画，一直悬浮飞行，身后拖着霓虹渐变尾迹和闪烁的星星；动作对齐像素网格、12 帧/秒步进
  - 🧑‍🚀 **宇航员**（Pixabay 免费素材，见 [CREDITS.md](CREDITS.md)）：绿幕视频抠像后做成帧图集；平时失重漂浮，移动时换成侧身漂移（朝向跟着方向翻转），点它常会向你挥手，鼠标靠近会朝你倾身，打盹时慢慢后仰下沉
  - ⚡ **战士**（原创形象）：更成熟的比例；悬停开始蓄力 → 金发、青色瞳孔、光盘气场、旋转六边形与速度线；点击“力量全开”
- 🖱️ **全局鼠标穿透**：只有宠物/气泡/菜单区域接收鼠标，其他地方的点击直接穿透到桌面
- 👀 悬停：看向你、脸红、跳一下；**来回在头上蹭 = 摸头**（爱心 + 呼噜）
- 👆 点击随机反应（跳、转圈、开心、挥手）；连点 5 下会生气；点醒睡觉的宠物
- ✋ 拖拽：像钟摆一样晃，落地有挤压回弹；拖出活动范围会自己走回去
- 🗺️ **活动范围**：在屏幕上直接框选，或用预设（右下角 / 底部一条 / 右侧一列 / 全屏）
- 💤 长时间没理它会打瞌睡
- ⚙️ 设置窗口（形象、名字、大小、活动范围、语言）+ 菜单栏托盘
- 🌏 中文 / English 双语，默认跟随系统

## 技术栈

| 层 | 选型 | 原因 |
|---|---|---|
| 桌面壳 | **Tauri 2**（Rust） | 跨 macOS / Windows，内存远小于 Electron，系统 API 走 Rust |
| 前端 | TypeScript + Vite（无框架） | 宠物窗口每帧渲染，保持轻量 |
| 动画 | SVG 分部件 + 程序化动画 | 不依赖序列帧美术；同一管线后续可驱动用户上传的图片 |

### 透明窗口与鼠标穿透是怎么做的

宠物住在一个覆盖整个主屏的透明无边框置顶窗口里，窗口默认 `ignore_cursor_events = true`（点击全部穿透）。Rust 后台线程每 33ms 读取一次全局鼠标坐标：

1. 把坐标转发给前端（所以即使不碰它，宠物也能看着你）；
2. 判断鼠标是否落在前端上报的“命中区域”（宠物、气泡、菜单）内，是的话才临时关闭穿透。

拖拽和框选活动范围时会加锁，整窗接收鼠标。

## 开发

需要：Node 20+、Rust（`brew install rust` 或 rustup）、macOS 上需要 Xcode Command Line Tools。

```bash
npm install
npm run tauri dev      # 开发运行
npm run tauri build    # 打包 .app / .dmg（Windows 上为 .msi / .exe）
```

> **macOS 链接报错 `tapi error: malformed file ... MacOSX27.0.sdk`？**
> 说明 Command Line Tools 默认 SDK 比自带链接器新。新建 `src-tauri/.cargo/config.toml`（已被 gitignore）：
> ```toml
> [env]
> SDKROOT = "/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk"
> ```

配置文件位置：`~/Library/Application Support/io.github.pawse.desktop/config.json`

## 目录结构

```
src/
  shared/config.ts     配置模型、默认值、持久化
  shared/i18n.ts       中英文文案与台词库
  pet/art.ts           三个内置形象（分部件 SVG / 帧图集）
public/pets/astro/     宇航员帧图集（由 scripts/make_astro_sprites.py 生成）
  pet/animator.ts      程序化动画
  pet/main.ts          宠物行为状态机、交互、气泡、菜单、命中区域
  pet/roamEditor.ts    屏幕框选活动范围
  settings/            设置窗口
src-tauri/src/lib.rs   透明窗口、鼠标穿透轮询、托盘、配置读写
docs/ROADMAP.md        分阶段计划
```

## 路线图

见 [docs/ROADMAP.md](docs/ROADMAP.md)。
