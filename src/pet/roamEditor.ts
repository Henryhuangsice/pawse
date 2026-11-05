import { ROAM_PRESETS, type Rect01 } from '../shared/config';
import { t } from '../shared/i18n';

const MIN_PX = 150;

/**
 * Full-screen overlay that lets the user draw the rectangle the pet may roam in.
 * While open, the whole window captures the mouse (see set_interactive_lock).
 */
export function openRoamEditor(current: Rect01, minPet: number, done: (r: Rect01 | null) => void) {
  const W = () => window.innerWidth;
  const H = () => window.innerHeight;
  const min = Math.max(MIN_PX, minPet + 20);
  let rect = { x: current.x * W(), y: current.y * H(), w: current.w * W(), h: current.h * H() };

  const root = document.createElement('div');
  root.className = 'roam-editor';
  root.innerHTML = `
    <div class="roam-rect"><span class="roam-size"></span></div>
    <div class="roam-toolbar">
      <div class="roam-hint">${t('roam.hint')}</div>
      <div class="roam-actions">
        <button data-preset="bottomRight">${t('roam.bottomRight')}</button>
        <button data-preset="bottomBand">${t('roam.bottomBand')}</button>
        <button data-preset="rightColumn">${t('roam.rightColumn')}</button>
        <button data-preset="full">${t('roam.full')}</button>
        <span class="sep"></span>
        <button data-act="cancel">${t('roam.cancel')}</button>
        <button data-act="ok" class="primary">${t('roam.ok')}</button>
      </div>
    </div>`;
  document.body.appendChild(root);

  const rectEl = root.querySelector<HTMLDivElement>('.roam-rect')!;
  const sizeEl = root.querySelector<HTMLSpanElement>('.roam-size')!;
  const toolbar = root.querySelector<HTMLDivElement>('.roam-toolbar')!;
  const okBtn = root.querySelector<HTMLButtonElement>('[data-act="ok"]')!;

  const render = () => {
    Object.assign(rectEl.style, {
      left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px`,
    });
    const small = rect.w < min || rect.h < min;
    rectEl.classList.toggle('invalid', small);
    okBtn.disabled = small;
    sizeEl.textContent = small ? t('roam.tooSmall') : `${Math.round(rect.w)} × ${Math.round(rect.h)}`;
  };
  render();

  let start: { x: number; y: number } | null = null;
  const onDown = (e: PointerEvent) => {
    if (toolbar.contains(e.target as Node)) return;
    start = { x: e.clientX, y: e.clientY };
    rect = { x: e.clientX, y: e.clientY, w: 0, h: 0 };
    root.setPointerCapture(e.pointerId);
    render();
  };
  const onMove = (e: PointerEvent) => {
    if (!start) return;
    rect = {
      x: Math.min(start.x, e.clientX),
      y: Math.min(start.y, e.clientY),
      w: Math.abs(e.clientX - start.x),
      h: Math.abs(e.clientY - start.y),
    };
    render();
  };
  const onUp = () => (start = null);

  const close = (result: Rect01 | null) => {
    window.removeEventListener('keydown', onKey);
    root.remove();
    done(result);
  };
  const commit = () => {
    if (rect.w < min || rect.h < min) return;
    close({ x: rect.x / W(), y: rect.y / H(), w: rect.w / W(), h: rect.h / H() });
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close(null);
    if (e.key === 'Enter') commit();
  };

  root.addEventListener('pointerdown', onDown);
  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerup', onUp);
  window.addEventListener('keydown', onKey);
  toolbar.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    const preset = b.dataset.preset as keyof typeof ROAM_PRESETS | undefined;
    if (preset) {
      const r = ROAM_PRESETS[preset];
      rect = { x: r.x * W(), y: r.y * H(), w: r.w * W(), h: r.h * H() };
      render();
    }
    if (b.dataset.act === 'cancel') close(null);
    if (b.dataset.act === 'ok') commit();
  });
}
