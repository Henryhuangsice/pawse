import './settings.css';
import { invoke } from '@tauri-apps/api/core';
import { emitTo } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  loadConfig, onConfigChange, saveConfig, LAUNCHER_KEY, PET_KINDS, REMINDER_KINDS, ROAM_PRESETS,
  type AppConfig, type Lang, type PetKind, type Rect01,
} from '../shared/config';
import { setLang, t } from '../shared/i18n';
import { Animator } from '../pet/animator';
import { petSVG } from '../pet/art';

let cfg: AppConfig;
let previews: Animator[] = [];
let saveTimer = 0;
let autostart = false;
let apps: { name: string; path: string }[] = [];

const DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0];
const check = (id: string, on: boolean, label: string) =>
  `<label class="check"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}/><span>${label}</span></label>`;
const minutes = (id: string, v: number, min: number, max: number) =>
  `<input type="number" class="num" id="${id}" value="${v}" min="${min}" max="${max}" step="1"/>`;

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

    ${workSection()}
    ${remindersSection()}
    ${launcherSection()}

    <section>
      <h2>${t('settings.general')}</h2>
      ${check('autostart', autostart, t('settings.autostart'))}
      ${check('avoid', cfg.avoidActiveWindow, t('settings.avoid'))}
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

  previews = [...app.querySelectorAll<SVGSVGElement>('.kind-art > svg')].map(
    (svg, i) => new Animator(svg, PET_KINDS[i]),
  );
  bind();
}

function workSection() {
  const w = cfg.work;
  return `
    <section>
      <h2>${t('settings.work')}</h2>
      <p class="desc">${t('settings.workDesc')}</p>
      ${check('workOn', w.enabled, t('settings.workOn'))}
      <fieldset ${w.enabled ? '' : 'disabled'}>
        <div class="row"><span>${t('settings.days')}</span>
          <div class="days">${DAYS_ORDER.map((d) =>
            `<button data-day="${d}" class="${w.days.includes(d) ? 'on' : ''}">${t(`day.${d}` as 'day.0')}</button>`).join('')}</div>
        </div>
        <div class="row"><span>${t('settings.hours')}</span>
          <input type="time" id="start" value="${w.start}"/> ${t('settings.to')} <input type="time" id="end" value="${w.end}"/></div>
        <div class="row"><span>${t('settings.lunch')}</span>
          <input type="time" id="lunchStart" value="${w.lunchStart}"/> ${t('settings.to')} <input type="time" id="lunchEnd" value="${w.lunchEnd}"/></div>
      </fieldset>
    </section>`;
}

function remindersSection() {
  const r = cfg.reminders;
  return `
    <section>
      <h2>${t('settings.reminders')}</h2>
      <p class="desc">${t('settings.remindersDesc')}</p>
      ${REMINDER_KINDS.map((k) => `
        <div class="row reminder">
          ${check(`r-${k}`, r[k].enabled, t(`settings.${k}`))}
          <span class="every">${t('settings.every', { n: minutes(`every-${k}`, r[k].every, 5, 240) })}</span>
        </div>`).join('')}
      <div class="row wide"><span>${t('settings.away')}</span>${minutes('awayMin', r.awayMin, 1, 60)} ${t('settings.min')}</div>
      <div class="row wide"><span>${t('settings.snooze')}</span>${minutes('snoozeMin', r.snoozeMin, 1, 60)} ${t('settings.min')}</div>
      <h3>${t('settings.dnd')}</h3>
      ${check('dndMeetings', cfg.dnd.meetings, t('settings.dndMeetings'))}
      ${check('dndFullscreen', cfg.dnd.fullscreen, t('settings.dndFullscreen'))}
    </section>`;
}

function launcherSection() {
  return `
    <section>
      <h2>${t('settings.launcher')}</h2>
      <p class="desc">${t('settings.launcherDesc', { key: `<kbd>${LAUNCHER_KEY}</kbd>` })}</p>
      <datalist id="apps">${apps.map((a) => `<option value="${escapeAttr(a.name)}"></option>`).join('')}</datalist>
      <div class="launch-list">
        ${cfg.launcher.map((it, i) => `
          <div class="launch-row" data-i="${i}">
            <input class="l-name" maxlength="24" value="${escapeAttr(it.name)}" placeholder="${t('settings.launcherName')}"/>
            <input class="l-target" list="apps" value="${escapeAttr(it.target)}" placeholder="${t('settings.launcherTarget')}"/>
            <button class="l-del" title="${t('settings.launcherRemove')}">✕</button>
          </div>`).join('')}
      </div>
      ${cfg.launcher.length < 12 ? `<button id="l-add">${t('settings.launcherAdd')}</button>` : ''}
    </section>`;
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

  const $in = (id: string) => app.querySelector<HTMLInputElement>(`#${id}`)!;
  const onChange = (id: string, fn: (el: HTMLInputElement) => void) => $in(id).addEventListener('change', () => fn($in(id)));

  // work hours
  onChange('workOn', (el) => update({ work: { ...cfg.work, enabled: el.checked } }, true));
  app.querySelectorAll<HTMLButtonElement>('[data-day]').forEach((b) => b.addEventListener('click', () => {
    const d = Number(b.dataset.day);
    const days = cfg.work.days.includes(d) ? cfg.work.days.filter((x) => x !== d) : [...cfg.work.days, d];
    update({ work: { ...cfg.work, days } }, true);
  }));
  for (const id of ['start', 'end', 'lunchStart', 'lunchEnd'] as const) {
    onChange(id, (el) => el.value && update({ work: { ...cfg.work, [id]: el.value } }));
  }

  // reminders
  for (const k of REMINDER_KINDS) {
    onChange(`r-${k}`, (el) => update({ reminders: { ...cfg.reminders, [k]: { ...cfg.reminders[k], enabled: el.checked } } }));
    onChange(`every-${k}`, (el) => update({ reminders: { ...cfg.reminders, [k]: { ...cfg.reminders[k], every: clampNum(el, 5, 240) } } }));
  }
  onChange('awayMin', (el) => update({ reminders: { ...cfg.reminders, awayMin: clampNum(el, 1, 60) } }));
  onChange('snoozeMin', (el) => update({ reminders: { ...cfg.reminders, snoozeMin: clampNum(el, 1, 60) } }));
  onChange('dndMeetings', (el) => update({ dnd: { ...cfg.dnd, meetings: el.checked } }));
  onChange('dndFullscreen', (el) => update({ dnd: { ...cfg.dnd, fullscreen: el.checked } }));

  // launcher
  app.querySelectorAll<HTMLDivElement>('.launch-row').forEach((row) => {
    const i = Number(row.dataset.i);
    const edit = (patch: Partial<AppConfig['launcher'][number]>) =>
      update({ launcher: cfg.launcher.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
    const name = row.querySelector<HTMLInputElement>('.l-name')!;
    const target = row.querySelector<HTMLInputElement>('.l-target')!;
    name.addEventListener('input', () => edit({ name: name.value }));
    target.addEventListener('input', () => {
      // picking an installed app fills in the name too
      const hit = apps.find((a) => a.name === target.value);
      if (hit && !name.value.trim()) { name.value = hit.name; edit({ name: hit.name, target: target.value }); }
      else edit({ target: target.value });
    });
    row.querySelector('.l-del')!.addEventListener('click', () =>
      update({ launcher: cfg.launcher.filter((_, j) => j !== i) }, true));
  });
  app.querySelector('#l-add')?.addEventListener('click', () => {
    update({ launcher: [...cfg.launcher, { name: '', target: '' }] }, true);
    app.querySelector<HTMLInputElement>('.launch-row:last-child .l-target')?.focus();
  });

  // general
  onChange('autostart', async (el) => {
    try {
      await invoke('set_autostart', { enabled: el.checked });
      autostart = el.checked;
      flashSaved();
    } catch {
      el.checked = autostart;
    }
  });
  onChange('avoid', (el) => update({ avoidActiveWindow: el.checked }));
}

const clampNum = (el: HTMLInputElement, lo: number, hi: number) => {
  const v = Math.round(Math.min(hi, Math.max(lo, Number(el.value) || lo)));
  el.value = String(v);
  return v;
};

function flashSaved() {
  const s = document.querySelector('#saved');
  s?.classList.add('show');
  setTimeout(() => s?.classList.remove('show'), 1200);
}

function update(patch: Partial<AppConfig>, rerender = false) {
  cfg = { ...cfg, ...patch };
  if (rerender) render();
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(async () => {
    // half-filled launcher rows stay on screen but aren't saved until they have a target
    await saveConfig(cfg);
    flashSaved();
  }, 180);
}

const sameRect = (a: Rect01, b: Rect01) =>
  ['x', 'y', 'w', 'h'].every((k) => Math.abs(a[k as keyof Rect01] - b[k as keyof Rect01]) < 0.005);
const escapeAttr = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

async function boot() {
  cfg = await loadConfig();
  [autostart, apps] = await Promise.all([
    invoke<boolean>('get_autostart').catch(() => false),
    invoke<{ name: string; path: string }[]>('list_apps').catch(() => []),
  ]);
  render();
  await onConfigChange((c) => {
    // only re-render for changes made elsewhere (e.g. the on-screen roam editor)
    const focusedInput = document.activeElement instanceof HTMLInputElement;
    const roamChanged = !sameRect(c.roam, cfg.roam);
    // the saved config drops launcher rows without a target; keep the drafts being typed here
    const drafts = cfg.launcher.some((it) => !it.target.trim());
    cfg = drafts ? { ...c, launcher: cfg.launcher } : c;
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
