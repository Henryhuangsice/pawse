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
        return { dashscope: localStorage.getItem('pawse-key-dashscope') === '1', openai: localStorage.getItem('pawse-key-openai') === '1' };
      case 'set_api_key':
        // only a flag — never store a key in the browser
        localStorage.setItem(`pawse-key-${args.provider}`, args.key ? '1' : '0');
        return null;
      case 'generate_pet_image':
        await new Promise((r) => setTimeout(r, 600));
        return mockGenerated(args.req.prompt);
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
