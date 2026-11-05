/**
 * "New pet" panel (M3): make a custom pet from a photo (cut out locally) or from a text
 * description (cloud text-to-image with the user's own key, then cut out locally).
 */
import { invoke } from '@tauri-apps/api/core';
import { AI_PROVIDERS, type AppConfig, type AiProvider, type CustomPetMeta } from '../shared/config';
import { cutout, type CutoutResult } from '../shared/cutout';
import { locale, t } from '../shared/i18n';

type Tab = 'photo' | 'ai';
const STYLES = ['pixel', 'flat', 'toon3d', 'watercolor', 'chibi'] as const;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function openCreator(opts: {
  cfg: AppConfig;
  keys: Record<string, boolean>;
  onSaved: (meta: CustomPetMeta) => void;
  onNeedKey: () => void;
}) {
  let tab: Tab = 'photo';
  let source: string | null = null; // picked / generated image
  let result: CutoutResult | null = null;
  let keepBg = false;
  let busy = '';
  let error = '';
  let name = '';
  let desc = '';
  let style: (typeof STYLES)[number] = 'flat';
  let provider: AiProvider = opts.cfg.ai.provider;

  const root = document.createElement('div');
  root.className = 'modal-back';
  document.body.appendChild(root);
  const close = () => { root.remove(); window.removeEventListener('keydown', onKey); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) close(); };
  window.addEventListener('keydown', onKey);

  const render = () => {
    const hasKey = !!opts.keys[provider];
    root.innerHTML = `
      <div class="modal" role="dialog" aria-label="${t('creator.title')}">
        <header class="modal-head">
          <h2>${t('creator.title')}</h2>
          <button class="icon" data-a="close" ${busy ? 'disabled' : ''} aria-label="${t('creator.close')}">✕</button>
        </header>
        <div class="tabs">
          <button data-tab="photo" class="${tab === 'photo' ? 'on' : ''}" ${busy ? 'disabled' : ''}>📷 ${t('creator.photo')}</button>
          <button data-tab="ai" class="${tab === 'ai' ? 'on' : ''}" ${busy ? 'disabled' : ''}>✨ ${t('creator.ai')}</button>
        </div>

        ${tab === 'photo' ? `
          <p class="desc">${t('creator.photoDesc')}</p>
          <div class="row-btns">
            <button class="primary" data-a="pick" ${busy ? 'disabled' : ''}>${source ? t('creator.pickAgain') : t('creator.pick')}</button>
            <label class="check"><input type="checkbox" id="keepBg" ${keepBg ? 'checked' : ''} ${busy || !source ? 'disabled' : ''}/><span>${t('creator.keepBg')}</span></label>
          </div>` : `
          <p class="desc">${t('creator.aiDesc')}</p>
          <div class="providers">
            ${AI_PROVIDERS.map((p) => `<button data-provider="${p}" class="${p === provider ? 'on' : ''}" ${busy ? 'disabled' : ''}>
              ${t(`ai.${p}`)} <small>${opts.keys[p] ? '✓' : t('ai.noKey')}</small></button>`).join('')}
          </div>
          <textarea id="desc" rows="3" maxlength="300" placeholder="${esc(t('creator.descPh'))}" ${busy ? 'disabled' : ''}>${esc(desc)}</textarea>
          <div class="chips">${STYLES.map((s) => `<button data-style="${s}" class="${s === style ? 'on' : ''}" ${busy ? 'disabled' : ''}>${t(`style.${s}`)}</button>`).join('')}</div>
          <div class="row-btns">
            ${hasKey
              ? `<button class="primary" data-a="generate" ${busy || !desc.trim() ? 'disabled' : ''}>${source ? t('creator.regenerate') : t('creator.generate')}</button>`
              : `<button class="primary" data-a="needKey">${t('creator.addKey')}</button>`}
            <span class="hint">${t('creator.aiNote')}</span>
          </div>`}

        <div class="preview ${result ? 'has' : ''}">
          ${busy ? `<div class="busy"><span class="spinner"></span>${busy}</div>`
            : error ? `<div class="err">${esc(error)}</div>`
            : result ? `<img src="${result.png}" alt=""/>`
            : `<div class="empty">${t('creator.empty')}</div>`}
        </div>
        ${result && result.alreadyClear ? `<p class="hint">${t('creator.alreadyClear')}</p>` : ''}

        <footer class="modal-foot">
          <input id="petName" maxlength="24" placeholder="${esc(t('creator.namePh'))}" value="${esc(name)}" ${busy ? 'disabled' : ''}/>
          <button class="primary" data-a="save" ${busy || !result ? 'disabled' : ''}>${t('creator.save')}</button>
        </footer>
      </div>`;
    bind();
  };

  const process = async () => {
    if (!source) return;
    busy = t('creator.cutting');
    error = '';
    render();
    try {
      result = await cutout(source, keepBg);
    } catch (e) {
      result = null;
      error = `${t('creator.cutFail')} (${String(e).slice(0, 120)})`;
    }
    busy = '';
    render();
  };

  const bind = () => {
    const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel);
    root.onclick = (e) => { if (e.target === root && !busy) close(); };
    $('[data-a=close]')?.addEventListener('click', close);
    root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => {
      tab = b.dataset.tab as Tab;
      error = '';
      render();
    }));
    $('[data-a=pick]')?.addEventListener('click', async () => {
      try {
        const img = await invoke<string | null>('pick_image');
        if (!img) return;
        source = img;
        keepBg = false;
        await process();
      } catch (e) {
        error = String(e);
        render();
      }
    });
    $<HTMLInputElement>('#keepBg')?.addEventListener('change', (e) => {
      keepBg = (e.target as HTMLInputElement).checked;
      void process();
    });
    root.querySelectorAll<HTMLButtonElement>('[data-provider]').forEach((b) => b.addEventListener('click', () => {
      provider = b.dataset.provider as AiProvider;
      render();
    }));
    $<HTMLTextAreaElement>('#desc')?.addEventListener('input', (e) => {
      desc = (e.target as HTMLTextAreaElement).value;
      const g = $<HTMLButtonElement>('[data-a=generate]');
      if (g) g.disabled = !desc.trim();
    });
    root.querySelectorAll<HTMLButtonElement>('[data-style]').forEach((b) => b.addEventListener('click', () => {
      style = b.dataset.style as typeof style;
      render();
    }));
    $('[data-a=needKey]')?.addEventListener('click', () => { close(); opts.onNeedKey(); });
    $('[data-a=generate]')?.addEventListener('click', async () => {
      busy = t('creator.generating');
      error = '';
      render();
      try {
        const ai = opts.cfg.ai;
        const zh = locale() === 'zh';
        const prompt = `${desc.trim()}${zh ? '，' : ', '}${t(`stylePrompt.${style}`)}`;
        source = await invoke<string>('generate_pet_image', {
          req: {
            provider,
            prompt,
            model: provider === 'dashscope' ? ai.dashscope.model : ai.openai.model,
            region: ai.dashscope.region,
          },
          zh,
        });
        if (!name) name = desc.trim().slice(0, 12);
        busy = '';
        await process();
      } catch (e) {
        busy = '';
        error = `${t('creator.genFail')} ${String(e).slice(0, 200)}`;
        render();
      }
    });
    $<HTMLInputElement>('#petName')?.addEventListener('input', (e) => { name = (e.target as HTMLInputElement).value; });
    $('[data-a=save]')?.addEventListener('click', async () => {
      if (!result) return;
      busy = t('creator.saving');
      render();
      try {
        const meta = await invoke<CustomPetMeta>('save_custom_pet', {
          name: name.trim() || t('creator.defaultName'),
          image: result.png,
          source: tab === 'ai' ? 'ai' : 'photo',
        });
        close();
        opts.onSaved(meta);
      } catch (e) {
        busy = '';
        error = String(e);
        render();
      }
    });
  };

  render();
}
