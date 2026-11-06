/**
 * Dev-only: lets the pet / settings pages run in a normal browser (http://localhost:1420)
 * without the Tauri runtime, for fast UI iteration. Mouse moves are forwarded as the
 * `cursor` event the Rust side would normally send; config lives in localStorage.
 * Never active inside the real app, and stripped from production builds.
 */
type Cb = (msg: unknown) => void;

if (import.meta.env.DEV && !('__TAURI_INTERNALS__' in window)) {
  const callbacks = new Map<number, Cb>();
  const listeners = new Map<string, number[]>();
  let nextId = 1;
  const label = location.pathname.includes('settings') ? 'settings' : 'pet';
  let lastInput = Date.now();
  for (const ev of ['mousemove', 'mousedown', 'keydown']) window.addEventListener(ev, () => (lastInput = Date.now()));

  const emit = (event: string, payload: unknown) =>
    (listeners.get(event) ?? []).forEach((id) => callbacks.get(id)?.({ event, id, payload }));

  const readCfg = () => {
    try { return JSON.parse(localStorage.getItem('pawse-config') ?? 'null'); } catch { return null; }
  };

  type Stored = { id: string; name: string; source: string; created: number; image: string };
  const pets = (): Stored[] => {
    try { return JSON.parse(localStorage.getItem('pawse-custom-pets') ?? '[]'); } catch { return []; }
  };
  const setPets = (v: Stored[]) => localStorage.setItem('pawse-custom-pets', JSON.stringify(v));
  const pickWithInput = () => new Promise<string | null>((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*' });
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.readAsDataURL(f);
    };
    input.click();
  });
  /** stands in for a cloud model: an emoji "character" on a white background */
  const mockGenerated = (prompt: string) => {
    const c = Object.assign(document.createElement('canvas'), { width: 512, height: 512 });
    const x = c.getContext('2d')!;
    x.fillStyle = '#fff';
    x.fillRect(0, 0, 512, 512);
    x.font = '300px serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(/狐|fox/i.test(prompt) ? '🦊' : /猫|cat/i.test(prompt) ? '🐱' : '🐻', 256, 270);
    return c.toDataURL('image/png');
  };

  type ChatRow = { id: number; ts: number; role: string; content: string };
  const chatLog = (): ChatRow[] => {
    try { return JSON.parse(localStorage.getItem('pawse-chat') ?? '[]'); } catch { return []; }
  };
  const chatCancelled = new Set<string>();

  const invoke = async (cmd: string, args: Record<string, any> = {}) => {
    switch (cmd) {
      case 'get_config': return readCfg();
      case 'save_config':
        try { localStorage.setItem('pawse-config', JSON.stringify(args.config)); } catch { /* ignore */ }
        emit('config-changed', args.config);
        return null;
      case 'plugin:event|listen': {
        const arr = listeners.get(args.event) ?? [];
        arr.push(args.handler);
        listeners.set(args.event, arr);
        return args.handler;
      }
      case 'plugin:event|emit':
      case 'plugin:event|emit_to':
        emit(args.event, args.payload);
        return null;
      case 'get_presence':
        // window.__shimPresence lets you fake an app in front / being away while testing
        return { idle: (Date.now() - lastInput) / 1000, front: null, ...((window as any).__shimPresence ?? {}) };
      case 'list_apps':
        return ['Calendar', 'Notes', 'Safari', 'Slack', 'WeChat', 'Visual Studio Code'].map((name) => ({
          name, path: `/Applications/${name}.app`,
        }));
      case 'launch':
        console.info('[shim] launch', args.target);
        return null;
      // ---- M3: custom pets live in localStorage here ----
      case 'list_custom_pets': return pets().map(({ image: _i, ...m }) => m);
      case 'get_custom_pet': {
        const p = pets().find((x) => x.id === args.id);
        if (!p) throw new Error('not found');
        return p;
      }
      case 'save_custom_pet': {
        const meta = { id: `p${Date.now().toString(16)}`, name: args.name, source: args.source, created: Date.now() };
        setPets([...pets(), { ...meta, image: args.image }]);
        emit('custom-pets-changed', pets().map(({ image: _i, ...m }) => m));
        return meta;
      }
      case 'rename_custom_pet':
        setPets(pets().map((p) => (p.id === args.id ? { ...p, name: args.name } : p)));
        emit('custom-pets-changed', pets().map(({ image: _i, ...m }) => m));
        return null;
      case 'delete_custom_pet':
        setPets(pets().filter((p) => p.id !== args.id));
        emit('custom-pets-changed', pets().map(({ image: _i, ...m }) => m));
        return null;
      case 'pick_image':
        // tests can preset window.__shimPickImage; otherwise use a normal file input
        return (window as any).__shimPickImage ?? pickWithInput();
      case 'export_custom_pet':
        console.info('[shim] export', args.id);
        return true;
      case 'import_pet_pack':
        return null;
      case 'api_key_status':
        return Object.fromEntries(['dashscope', 'openai', 'deepseek', 'zhipu', 'siliconflow', 'custom'].map((p) => [p, localStorage.getItem(`pawse-key-${p}`) === '1']));
      case 'set_api_key':
        // only a flag — never store a key in the browser
        localStorage.setItem(`pawse-key-${args.provider}`, args.key ? '1' : '0');
        return null;
      case 'generate_pet_image':
        await new Promise((r) => setTimeout(r, 600));
        return mockGenerated(args.req.prompt);
      // ---- M4: chat; window.__shimChat(req) can return {text, tool_calls} or throw an error code ----
      case 'chat_send': {
        const req = args.req;
        const hook = (window as any).__shimChat;
        if (hook) {
          const out = await hook(req);
          if (typeof out === 'string') throw out;
          if (out) return { cancelled: false, tool_calls: [], ...out };
        }
        const slot = ({ deepseek: 'deepseek', qwen: 'dashscope', openai: 'openai', zhipu: 'zhipu', siliconflow: 'siliconflow' } as Record<string, string>)[req.provider];
        if (slot && localStorage.getItem(`pawse-key-${slot}`) !== '1') throw 'nokey';
        const last = [...req.messages].reverse().find((m: any) => m.role === 'user')?.content ?? '';
        const text = req.stream_events === false
          ? '- 用户在做桌面宠物项目\n- 喜欢喝茶'
          : `（模拟回复）收到「${String(last).slice(0, 20)}」，我在呢～`;
        if (req.stream_events !== false) {
          for (const ch of text.match(/.{1,3}/gu) ?? []) {
            if (chatCancelled.has(req.id)) return { text: '', tool_calls: [], cancelled: true };
            await new Promise((r) => setTimeout(r, 40));
            emit('chat-delta', { id: req.id, text: ch });
          }
        }
        return { text, tool_calls: [], cancelled: false };
      }
      case 'chat_cancel': chatCancelled.add(args.id); return null;
      // no `say` in the browser: the frontend falls back to speechSynthesis
      case 'tts_speak': (window as any).__shimSpoken = args.text; throw new Error('unsupported');
      case 'tts_stop': return null;
      case 'chat_log': {
        const log = chatLog();
        const id = (log[log.length - 1]?.id ?? 0) + 1;
        log.push({ id, ts: Date.now(), role: args.role === 'assistant' ? 'assistant' : 'user', content: args.content });
        localStorage.setItem('pawse-chat', JSON.stringify(log));
        return id;
      }
      case 'chat_recent': return chatLog().slice(-args.limit);
      case 'chat_after': return chatLog().filter((m) => m.id > args.after).slice(0, args.limit);
      case 'memory_get': {
        const mem = JSON.parse(localStorage.getItem('pawse-memory') ?? '{"summary":"","upto":0}');
        return { ...mem, pending: chatLog().filter((m) => m.id > mem.upto).length };
      }
      case 'memory_set': {
        const mem = JSON.parse(localStorage.getItem('pawse-memory') ?? '{"summary":"","upto":0}');
        localStorage.setItem('pawse-memory', JSON.stringify({ summary: args.summary, upto: args.upto ?? mem.upto }));
        return null;
      }
      case 'memory_clear':
        localStorage.removeItem('pawse-chat');
        localStorage.removeItem('pawse-memory');
        emit('memory-cleared', null);
        return null;
      case 'get_autostart': return localStorage.getItem('pawse-autostart') === '1';
      case 'set_autostart':
        localStorage.setItem('pawse-autostart', args.enabled ? '1' : '0');
        return null;
      default:
        console.debug('[shim] invoke', cmd, args);
        return null;
    }
  };

  (window as any).__TAURI_INTERNALS__ = {
    invoke,
    transformCallback(cb: Cb) {
      const id = nextId++;
      callbacks.set(id, cb);
      return id;
    },
    unregisterCallback(id: number) { callbacks.delete(id); },
    metadata: { currentWindow: { label }, currentWebview: { windowLabel: label, label } },
  };
  (window as any).__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} };

  window.addEventListener('mousemove', (e) => emit('cursor', [e.clientX, e.clientY]));
  document.documentElement.style.background = 'linear-gradient(135deg,#dfe7f5,#f3efe9)';
}

export {};
