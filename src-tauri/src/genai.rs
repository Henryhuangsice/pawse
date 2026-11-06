//! Text → image for custom pets (M3), with the user's own API key.
//!
//! Keys live in the OS keychain (macOS Keychain / Windows Credential Manager), never in
//! config.json, and requests are made from Rust so the key never enters the webview.
//!   - Tongyi Wanxiang (Alibaba Cloud DashScope) — mainland China
//!   - OpenAI Images — overseas

use std::time::Duration;

use serde_json::{json, Value};

use crate::custom::png_data_url;

const SERVICE: &str = "io.github.pawse.desktop";
/// key slots in the keychain; "dashscope" and "openai" keys are shared by image generation and chat
pub const PROVIDERS: [&str; 4] = ["dashscope", "openai", "deepseek", "custom"];

fn entry(provider: &str) -> Result<keyring::Entry, String> {
    if !PROVIDERS.contains(&provider) {
        return Err("unknown provider".into());
    }
    keyring::Entry::new(SERVICE, &format!("api-key:{provider}")).map_err(|e| e.to_string())
}

pub fn set_key(provider: &str, key: &str) -> Result<(), String> {
    let e = entry(provider)?;
    let key = key.trim();
    if key.is_empty() {
        return match e.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(err) => Err(err.to_string()),
        };
    }
    e.set_password(key).map_err(|e| e.to_string())
}

pub fn has_key(provider: &str) -> bool {
    entry(provider).and_then(|e| e.get_password().map_err(|e| e.to_string())).is_ok()
}

pub fn get_key(provider: &str) -> Result<String, String> {
    entry(provider)?.get_password().map_err(|_| "no API key".into())
}

#[derive(Debug, serde::Deserialize)]
pub struct GenRequest {
    pub provider: String,
    pub prompt: String,
    /// optional override, e.g. "wan2.2-t2i-plus" or "gpt-image-1.5"
    pub model: Option<String>,
    /// DashScope region: "cn" (Beijing, default) or "intl" (Singapore)
    pub region: Option<String>,
}

/// Wrap the user's description so the result is easy to cut out and works as a pet.
pub fn pet_prompt(desc: &str, zh: bool) -> String {
    let desc: String = desc.trim().chars().take(400).collect();
    if zh {
        format!("{desc}。单个角色，全身，正面或四分之三侧面，居中，完整不裁切，纯白色背景，无文字，无阴影，适合做桌面宠物的可爱贴纸风格")
    } else {
        format!("{desc}. A single character, full body, front or three-quarter view, centered, nothing cropped, plain white background, no text, no shadow, cute sticker style for a desktop pet")
    }
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder().timeout(Duration::from_secs(90)).build().map_err(|e| e.to_string())
}

fn api_error(v: &Value) -> Option<String> {
    v.get("error")
        .and_then(|e| e.get("message").or(Some(e)))
        .or_else(|| v.get("message"))
        .map(|m| m.as_str().map(str::to_string).unwrap_or_else(|| m.to_string()))
}

async fn fetch_png(c: &reqwest::Client, url: &str) -> Result<String, String> {
    let bytes = c.get(url).send().await.map_err(|e| e.to_string())?.bytes().await.map_err(|e| e.to_string())?;
    if !bytes.starts_with(b"\x89PNG") && !bytes.starts_with(&[0xff, 0xd8]) {
        return Err("provider returned an unexpected file".into());
    }
    let mime = if bytes.starts_with(b"\x89PNG") { "png" } else { "jpeg" };
    Ok(if mime == "png" {
        png_data_url(&bytes)
    } else {
        use base64::Engine;
        format!("data:image/jpeg;base64,{}", base64::engine::general_purpose::STANDARD.encode(&bytes))
    })
}

/// Returns an image data URL (PNG, or JPEG from some providers).
pub async fn generate(req: GenRequest) -> Result<String, String> {
    let key = get_key(&req.provider)?;
    let c = client()?;
    match req.provider.as_str() {
        "dashscope" => dashscope(&c, &key, &req).await,
        "openai" => openai(&c, &key, &req).await,
        _ => Err("unknown provider".into()),
    }
}

async fn dashscope(c: &reqwest::Client, key: &str, req: &GenRequest) -> Result<String, String> {
    let host = if req.region.as_deref() == Some("intl") { "dashscope-intl.aliyuncs.com" } else { "dashscope.aliyuncs.com" };
    let model = req.model.clone().filter(|m| !m.trim().is_empty()).unwrap_or_else(|| "wan2.2-t2i-flash".into());
    let created: Value = c
        .post(format!("https://{host}/api/v1/services/aigc/text2image/image-synthesis"))
        .bearer_auth(key)
        .header("X-DashScope-Async", "enable")
        .json(&json!({ "model": model, "input": { "prompt": req.prompt }, "parameters": { "size": "1024*1024", "n": 1 } }))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    let task = created
        .pointer("/output/task_id")
        .and_then(Value::as_str)
        .ok_or_else(|| api_error(&created).unwrap_or_else(|| "no task id".into()))?
        .to_string();

    // the task usually finishes in 5–20 s
    for _ in 0..60 {
        tokio_sleep(Duration::from_secs(2)).await;
        let v: Value = c
            .get(format!("https://{host}/api/v1/tasks/{task}"))
            .bearer_auth(key)
            .send()
            .await
            .map_err(|e| e.to_string())?
            .json()
            .await
            .map_err(|e| e.to_string())?;
        match v.pointer("/output/task_status").and_then(Value::as_str) {
            Some("SUCCEEDED") => {
                let url = v
                    .pointer("/output/results/0/url")
                    .and_then(Value::as_str)
                    .ok_or_else(|| v.pointer("/output/results/0/message").and_then(Value::as_str).unwrap_or("no image").to_string())?;
                return fetch_png(c, url).await;
            }
            Some("FAILED") | Some("CANCELED") | Some("UNKNOWN") => {
                return Err(v.pointer("/output/message").and_then(Value::as_str).unwrap_or("generation failed").to_string());
            }
            _ => {}
        }
    }
    Err("timed out".into())
}

async fn openai(c: &reqwest::Client, key: &str, req: &GenRequest) -> Result<String, String> {
    let model = req.model.clone().filter(|m| !m.trim().is_empty()).unwrap_or_else(|| "gpt-image-1".into());
    // gpt-image-1 can return a transparent PNG directly; other models just get the white background
    let mut body = json!({ "model": model, "prompt": req.prompt, "size": "1024x1024", "n": 1 });
    if model == "gpt-image-1" || model.starts_with("gpt-image-1.") {
        body["background"] = json!("transparent");
        body["output_format"] = json!("png");
    }
    let v: Value = c
        .post("https://api.openai.com/v1/images/generations")
        .bearer_auth(key)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    if let Some(b64) = v.pointer("/data/0/b64_json").and_then(Value::as_str) {
        use base64::Engine;
        let bytes = base64::engine::general_purpose::STANDARD.decode(b64).map_err(|e| e.to_string())?;
        return Ok(png_data_url(&bytes));
    }
    if let Some(url) = v.pointer("/data/0/url").and_then(Value::as_str) {
        return fetch_png(c, url).await;
    }
    Err(api_error(&v).unwrap_or_else(|| "generation failed".into()))
}

async fn tokio_sleep(d: Duration) {
    // tauri's async runtime is tokio, but it isn't a direct dependency here
    let _ = tauri::async_runtime::spawn_blocking(move || std::thread::sleep(d)).await;
}
