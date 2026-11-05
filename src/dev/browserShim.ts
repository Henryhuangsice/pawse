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
