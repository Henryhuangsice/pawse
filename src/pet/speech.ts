/**
 * Read replies aloud with the system voice — free, offline, no tokens.
 * macOS: `say` via the Rust side (reliable voices in WKWebView);
 * elsewhere (and the browser preview): the WebView's speechSynthesis.
 */
import { invoke } from '@tauri-apps/api/core';

/** what's worth reading: no kaomoji, emoji, markdown or <think> leftovers */
export function speakable(text: string): string {
  return text
    .replace(/[（(][^()（）]{0,12}[ω▽≧≦・゜°′ᴗ﹏︶ò_^‿><•ㅂ´`;~=]+[^()（）]{0,12}[)）]/g, '')
    .replace(/\p{Extended_Pictographic}|️|‍/gu, '')
    .replace(/[*_`#>~|]+/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

let native = true;

export async function speak(text: string, lang: 'zh' | 'en') {
  const s = speakable(text);
  if (!s) return;
  if (native) {
    try {
      await invoke('tts_speak', { text: s, lang });
      return;
    } catch {
      native = false; // not macOS / not available: use the WebView voice from now on
    }
  }
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(s);
  u.lang = lang === 'zh' ? 'zh-CN' : 'en-US';
  const voice = synth.getVoices().find((v) => v.lang.replace('_', '-').startsWith(u.lang) && v.localService);
  if (voice) u.voice = voice;
  u.rate = 1.05;
  u.pitch = 1.1;
  synth.speak(u);
}

export function stopSpeaking() {
  if (native) void invoke('tts_stop').catch(() => {});
  window.speechSynthesis?.cancel();
}
