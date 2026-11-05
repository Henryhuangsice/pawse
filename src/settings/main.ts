import './settings.css';
import { emitTo } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  loadConfig, onConfigChange, saveConfig, PET_KINDS, ROAM_PRESETS,
  type AppConfig, type Lang, type PetKind, type Rect01,
} from '../shared/config';
import { setLang, t } from '../shared/i18n';
import { Animator } from '../pet/animator';
import { petSVG } from '../pet/art';

let cfg: AppConfig;
let previews: Animator[] = [];
let saveTimer = 0;

const app = document.querySelector<HTMLElement>('#app')!;

function render() {
  setLang(cfg.lang);
  document.title = `Pawse · ${t('settings.title')}`;
  const r = cfg.roam;
  app.innerHTML = `
    <header><h1>Pawse <span>爪憩</span></h1><span class="saved" id="saved">${t('settings.saved')} ✓</span></header>

    <section>
      <h2>${t('settings.pet')}</h2>
      <div class="kinds">
        ${PET_KINDS.map((k) => `
          <button class="kind ${k === cfg.pet.kind ? 'on' : ''}" data-kind="${k}">
            <div class="kind-art">${petSVG(k)}</div>
            <span>${t(`kind.${k}`)}</span>
          </button>`).join('')}
      </div>
      <label class="row">
        <span>${t('settings.name')}</span>
        <input id="name" maxlength="24" value="${escapeAttr(cfg.pet.name)}" placeholder="${escapeAttr(t('settings.namePh', { name: t(`name.${cfg.pet.kind}`) }))}" />
      </label>
      <label class="row">
        <span>${t('settings.size')}</span>
        <input id="scale" type="range" min="0.6" max="1.6" step="0.05" value="${cfg.pet.scale}" />
        <output id="scaleOut">${Math.round(cfg.pet.scale * 100)}%</output>
      </label>
    </section>

    <section>
      <h2>${t('settings.roam')}</h2>
      <p class="desc">${t('settings.roamDesc')}</p>
      <div class="roam">
        <div class="screen" style="aspect-ratio:${screen.width}/${screen.height}">
          <div class="screen-rect" style="left:${r.x * 100}%;top:${r.y * 100}%;width:${r.w * 100}%;height:${r.h * 100}%"></div>
        </div>
        <div class="roam-buttons">
          ${(Object.keys(ROAM_PRESETS) as (keyof typeof ROAM_PRESETS)[]).map(
            (k) => `<button data-preset="${k}" class="${sameRect(r, ROAM_PRESETS[k]) ? 'on' : ''}">${t(`roam.${k}`)}</button>`,
          ).join('')}
          <button id="draw" class="primary">${t('settings.roamDraw')}</button>
        </div>
      </div>
    </section>

    <section>
      <h2>${t('settings.general')}</h2>
      <label class="row">
        <span>${t('settings.lang')}</span>
        <select id="lang">
          <option value="auto" ${cfg.lang === 'auto' ? 'selected' : ''}>${t('settings.langAuto')}</option>
          <option value="zh" ${cfg.lang === 'zh' ? 'selected' : ''}>简体中文</option>
          <option value="en" ${cfg.lang === 'en' ? 'selected' : ''}>English</option>
        </select>
      </label>
    </section>

    <section class="next">
      <h2>${t('settings.next')}</h2>
      <p class="desc">${t('settings.nextDesc')}</p>
    </section>`;

  previews = [...app.querySelectorAll<SVGSVGElement>('.kind-art svg')].map(
    (svg, i) => new Animator(svg, PET_KINDS[i]),
  );
  bind();
}

function bind() {
  app.querySelectorAll<HTMLButtonElement>('.kind').forEach((b) =>
    b.addEventListener('click', () => update({ pet: { ...cfg.pet, kind: b.dataset.kind as PetKind } }, true)),
  );
  app.querySelector<HTMLInputElement>('#name')!.addEventListener('input', (e) =>
    update({ pet: { ...cfg.pet, name: (e.target as HTMLInputElement).value } }),
  );
  const scale = app.querySelector<HTMLInputElement>('#scale')!;
  scale.addEventListener('input', () => {
    app.querySelector('#scaleOut')!.textContent = `${Math.round(Number(scale.value) * 100)}%`;
    update({ pet: { ...cfg.pet, scale: Number(scale.value) } });
  });
  app.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((b) =>
    b.addEventListener('click', () =>
      update({ roam: { ...ROAM_PRESETS[b.dataset.preset as keyof typeof ROAM_PRESETS] } }, true),
    ),
  );
  app.querySelector('#draw')!.addEventListener('click', () => void emitTo('pet', 'edit-roam'));
  app.querySelector<HTMLSelectElement>('#lang')!.addEventListener('change', (e) =>
    update({ lang: (e.target as HTMLSelectElement).value as Lang }, true),
  );
}

function update(patch: Partial<AppConfig>, rerender = false) {
  cfg = { ...cfg, ...patch };
  if (rerender) render();
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(async () => {
    await saveConfig(cfg);
    const s = document.querySelector('#saved');
    s?.classList.add('show');
    setTimeout(() => s?.classList.remove('show'), 1200);
  }, 180);
}

const sameRect = (a: Rect01, b: Rect01) =>
  ['x', 'y', 'w', 'h'].every((k) => Math.abs(a[k as keyof Rect01] - b[k as keyof Rect01]) < 0.005);
const escapeAttr = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

async function boot() {
  cfg = await loadConfig();
  render();
  await onConfigChange((c) => {
    // only re-render for changes made elsewhere (e.g. the on-screen roam editor)
    const focusedInput = document.activeElement instanceof HTMLInputElement;
    const roamChanged = !sameRect(c.roam, cfg.roam);
    cfg = c;
    if (roamChanged || !focusedInput) render();
  });
  const loop = (now: number) => {
    previews.forEach((a) => a.update(1 / 60, now));
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') void getCurrentWindow().close();
  });
}

void boot();
