//! Read chat replies aloud with the system voice: free, offline, nothing uploaded.
//! macOS uses `say`; elsewhere the frontend falls back to the WebView's speechSynthesis.

use std::process::{Child, Command};
use std::sync::Mutex;

static CURRENT: Mutex<Option<Child>> = Mutex::new(None);
static VOICES: Mutex<Option<Vec<(String, String)>>> = Mutex::new(None);

/// Pleasant built-in voices first; novelty voices (Bells, Zarvox…) are never picked.
const PREFER_ZH: &[&str] = &["Tingting", "Meijia", "Flo (中文（中国大陆）)", "Sandy (中文（中国大陆）)", "Shelley (中文（中国大陆）)"];
const PREFER_EN: &[&str] = &["Samantha", "Flo (英语（美国）)", "Sandy (英语（美国）)", "Shelley (英语（美国）)", "Ava", "Allison"];

/// `say -v '?'` lines look like `Tingting            zh_CN    # 你好…` → (name, locale)
pub fn parse_voices(out: &str) -> Vec<(String, String)> {
    out.lines()
        .filter_map(|l| {
            let head = l.split('#').next()?.trim_end();
            let (name, locale) = head.rsplit_once(char::is_whitespace)?;
            let name = name.trim();
            (!name.is_empty() && locale.contains('_')).then(|| (name.to_string(), locale.to_string()))
        })
        .collect()
}

pub fn pick_voice(voices: &[(String, String)], lang: &str) -> Option<String> {
    let (prefer, prefix) = if lang.starts_with("zh") { (PREFER_ZH, "zh_CN") } else { (PREFER_EN, "en_") };
    prefer
        .iter()
        .find(|p| voices.iter().any(|(n, _)| n == *p))
        .map(|p| p.to_string())
        .or_else(|| voices.iter().find(|(n, l)| l.starts_with(prefix) && n.contains('(')).map(|(n, _)| n.clone()))
}

pub fn stop() {
    if let Some(mut c) = CURRENT.lock().unwrap().take() {
        let _ = c.kill();
        let _ = c.wait();
    }
}

#[cfg(target_os = "macos")]
pub fn speak(text: &str, lang: &str) -> Result<(), String> {
    stop();
    let text: String = text.chars().take(1000).collect();
    if text.trim().is_empty() {
        return Ok(());
    }
    let voice = {
        let mut cache = VOICES.lock().unwrap();
        if cache.is_none() {
            let out = Command::new("say").args(["-v", "?"]).output().map_err(|e| e.to_string())?;
            *cache = Some(parse_voices(&String::from_utf8_lossy(&out.stdout)));
        }
        pick_voice(cache.as_ref().unwrap(), lang)
    };
    let mut cmd = Command::new("say");
    if let Some(v) = voice {
        cmd.args(["-v", &v]);
    }
    // "--" so a reply starting with "-" isn't read as a flag
    let child = cmd.args(["-r", "190", "--", &text]).spawn().map_err(|e| e.to_string())?;
    *CURRENT.lock().unwrap() = Some(child);
    Ok(())
}

#[cfg(not(target_os = "macos"))]
pub fn speak(_text: &str, _lang: &str) -> Result<(), String> {
    let _ = &VOICES;
    Err("unsupported".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_and_picks_voices() {
        let out = "Bells               en_US    # Hello!\n\
                   Flo (中文（中国大陆）)      zh_CN    # 你好！\n\
                   Samantha            en_US    # Hello!\n\
                   Thomas              fr_FR    # Bonjour\n";
        let v = parse_voices(out);
        assert_eq!(v.len(), 4);
        assert_eq!(v[1], ("Flo (中文（中国大陆）)".into(), "zh_CN".into()));
        assert_eq!(pick_voice(&v, "zh").as_deref(), Some("Flo (中文（中国大陆）)"));
        assert_eq!(pick_voice(&v, "en").as_deref(), Some("Samantha"));
        // only novelty voices → let the system default speak
        assert_eq!(pick_voice(&v[..1], "en"), None);
    }
}
