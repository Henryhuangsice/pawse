//! AI chat (M4): one OpenAI-compatible streaming client for every provider.
//!
//! Local Ollama (free, nothing leaves the machine) and the cloud services all speak the
//! `/chat/completions` protocol, so a provider is just a base URL plus a keychain slot.
//! Tokens are streamed to the webview as `chat-delta` events, and tool calls (open an app,
//! set a timer) come back to the frontend, which runs them itself.

use std::{collections::HashSet, sync::Mutex, time::Duration};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};

use crate::genai;

static CANCELLED: Mutex<Option<HashSet<String>>> = Mutex::new(None);

pub fn cancel(id: &str) {
    CANCELLED.lock().unwrap().get_or_insert_with(HashSet::new).insert(id.to_string());
}

fn is_cancelled(id: &str) -> bool {
    CANCELLED.lock().unwrap().as_mut().is_some_and(|s| s.contains(id))
}

fn clear_cancelled(id: &str) {
    if let Some(s) = CANCELLED.lock().unwrap().as_mut() {
        s.remove(id);
    }
}

#[derive(Debug, Deserialize)]
pub struct ChatRequest {
    /// chosen by the frontend; tags the `chat-delta` events and allows cancelling
    pub id: String,
    /// "ollama" | "deepseek" | "qwen" | "openai" | "custom"
    pub provider: String,
    pub model: String,
    /// Ollama / custom endpoint, e.g. "http://localhost:11434/v1"
    #[serde(default)]
    pub base_url: Option<String>,
    /// Qwen (DashScope) region: "cn" | "intl"
    #[serde(default)]
    pub region: Option<String>,
    /// [{role, content}], system prompt first
    pub messages: Vec<Value>,
    /// offer the open_app / set_timer tools
    #[serde(default)]
    pub tools: bool,
    #[serde(default)]
    pub max_tokens: Option<u32>,
    /// false = no `chat-delta` events (background calls such as memory summaries)
    #[serde(default = "yes")]
    pub stream_events: bool,
}

fn yes() -> bool {
    true
}

#[derive(Debug, Default, Serialize, PartialEq)]
pub struct ToolCall {
    pub name: String,
    /// JSON text as produced by the model
    pub arguments: String,
}

#[derive(Debug, Default, Serialize)]
pub struct ChatReply {
    pub text: String,
    pub tool_calls: Vec<ToolCall>,
    pub cancelled: bool,
}

/// Base URL and keychain slot for a provider. Errors are short codes the UI translates.
fn endpoint(req: &ChatRequest) -> Result<(String, Option<&'static str>), String> {
    let custom_url = || {
        let u = req.base_url.as_deref().unwrap_or("").trim().trim_end_matches('/').to_string();
        if u.starts_with("http://") || u.starts_with("https://") { Ok(u) } else { Err("badurl".to_string()) }
    };
    Ok(match req.provider.as_str() {
        "ollama" => (
            if req.base_url.as_deref().is_some_and(|u| !u.trim().is_empty()) { custom_url()? } else { "http://localhost:11434/v1".into() },
            None,
        ),
        "deepseek" => ("https://api.deepseek.com/v1".into(), Some("deepseek")),
        "qwen" => (
            if req.region.as_deref() == Some("intl") {
                "https://dashscope-intl.aliyuncs.com/compatible-mode/v1".into()
            } else {
                "https://dashscope.aliyuncs.com/compatible-mode/v1".into()
            },
            Some("dashscope"),
        ),
        "openai" => ("https://api.openai.com/v1".into(), Some("openai")),
        "custom" => (custom_url()?, Some("custom")),
        _ => return Err("unknown provider".into()),
    })
}

fn tools_schema() -> Value {
    json!([
        {
            "type": "function",
            "function": {
                "name": "open_app",
                "description": "Open an app or website on the user's computer, e.g. WeChat, Slack, a URL.",
                "parameters": {
                    "type": "object",
                    "properties": { "name": { "type": "string", "description": "app name or URL" } },
                    "required": ["name"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "set_timer",
                "description": "Remind the user after some minutes.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "minutes": { "type": "number", "description": "1 to 720" },
                        "note": { "type": "string", "description": "what to remind about, short" }
                    },
                    "required": ["minutes"]
                }
            }
        }
    ])
}

fn api_error(v: &Value) -> Option<String> {
    v.get("error")
        .and_then(|e| e.get("message").or(Some(e)))
        .or_else(|| v.get("message"))
        .map(|m| m.as_str().map(str::to_string).unwrap_or_else(|| m.to_string()))
}

#[derive(Default)]
struct Acc {
    reply: ChatReply,
    calls: Vec<(String, String)>,
}

impl Acc {
    fn add_calls(&mut self, arr: &[Value]) {
        for (n, call) in arr.iter().enumerate() {
            let i = call.get("index").and_then(Value::as_u64).map(|i| i as usize).unwrap_or(n);
            while self.calls.len() <= i {
                self.calls.push(Default::default());
            }
            if let Some(name) = call.pointer("/function/name").and_then(Value::as_str) {
                self.calls[i].0.push_str(name);
            }
            match call.pointer("/function/arguments") {
                Some(Value::String(a)) => self.calls[i].1.push_str(a),
                Some(v @ Value::Object(_)) => self.calls[i].1.push_str(&v.to_string()),
                _ => {}
            }
        }
    }

    fn finish(mut self) -> ChatReply {
        self.reply.tool_calls = self
            .calls
            .into_iter()
            .filter(|(n, _)| !n.is_empty())
            .map(|(name, arguments)| ToolCall { name, arguments })
            .collect();
        self.reply
    }
}

/// POST a chat completion and stream it. `on_delta` gets each text piece.
pub async fn stream_chat(
    c: &reqwest::Client,
    url: &str,
    key: Option<&str>,
    body: &Value,
    mut on_delta: impl FnMut(&str),
    cancelled: impl Fn() -> bool,
) -> Result<ChatReply, String> {
    let mut rb = c.post(url).json(body).header("Accept", "text/event-stream");
    if let Some(k) = key {
        rb = rb.bearer_auth(k);
    }
    let mut resp = rb.send().await.map_err(|e| {
        if e.is_connect() || e.is_timeout() { format!("unreachable: {e}") } else { e.to_string() }
    })?;
    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        let msg = serde_json::from_str::<Value>(&text)
            .ok()
            .and_then(|v| api_error(&v))
            .unwrap_or_else(|| text.chars().take(200).collect());
        let code = if status.as_u16() == 401 || status.as_u16() == 403 { "auth" } else { "http" };
        return Err(format!("{code} {}: {msg}", status.as_u16()));
    }

    let mut acc = Acc::default();
    let is_json = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|t| t.starts_with("application/json"));
    if is_json {
        // a server that ignored `stream: true`
        let v: Value = resp.json().await.map_err(|e| e.to_string())?;
        if let Some(e) = v.get("error").and(api_error(&v)) {
            return Err(format!("http 200: {e}"));
        }
        if let Some(t) = v.pointer("/choices/0/message/content").and_then(Value::as_str) {
            acc.reply.text.push_str(t);
            on_delta(t);
        }
        if let Some(arr) = v.pointer("/choices/0/message/tool_calls").and_then(Value::as_array) {
            acc.add_calls(arr);
        }
        return Ok(acc.finish());
    }

    let mut buf: Vec<u8> = Vec::new();
    'read: while let Some(chunk) = resp.chunk().await.map_err(|e| e.to_string())? {
        if cancelled() {
            acc.reply.cancelled = true;
            break;
        }
        buf.extend_from_slice(&chunk);
        // split on '\n' at the byte level so multi-byte characters never get cut
        while let Some(pos) = buf.iter().position(|&b| b == b'\n') {
            let raw: Vec<u8> = buf.drain(..=pos).collect();
            let line = String::from_utf8_lossy(&raw);
            let Some(data) = line.trim().strip_prefix("data:") else { continue };
            let data = data.trim();
            if data == "[DONE]" {
                break 'read;
            }
            let Ok(v) = serde_json::from_str::<Value>(data) else { continue };
            if v.get("error").is_some() {
                return Err(format!("http 200: {}", api_error(&v).unwrap_or_default()));
            }
            let Some(delta) = v.pointer("/choices/0/delta") else { continue };
            if let Some(t) = delta.get("content").and_then(Value::as_str) {
                if !t.is_empty() {
                    acc.reply.text.push_str(t);
                    on_delta(t);
                }
            }
            if let Some(arr) = delta.get("tool_calls").and_then(Value::as_array) {
                acc.add_calls(arr);
            }
        }
    }
    Ok(acc.finish())
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(180))
        .build()
        .map_err(|e| e.to_string())
}

pub async fn send(app: &AppHandle, req: ChatRequest) -> Result<ChatReply, String> {
    if req.model.trim().is_empty() {
        return Err("nomodel".into());
    }
    let (base, slot) = endpoint(&req)?;
    let key = match slot {
        Some(s) => match genai::get_key(s) {
            Ok(k) => Some(k),
            // a custom endpoint may not need a key (LM Studio, a LAN server…)
            Err(_) if req.provider == "custom" => None,
            Err(_) => return Err("nokey".into()),
        },
        None => None,
    };
    let url = format!("{base}/chat/completions");
    let mut body = json!({
        "model": req.model.trim(),
        "messages": req.messages,
        "stream": true,
        "temperature": 0.8,
        "max_tokens": req.max_tokens.unwrap_or(400).clamp(16, 2000),
    });
    if req.provider == "openai" {
        // newer OpenAI models want max_completion_tokens; reasoning models (o*, gpt-5*) also
        // reject a custom temperature and spend part of the budget thinking
        let m = req.model.trim();
        let reasoning = m.starts_with("gpt-5") || (m.starts_with('o') && m.chars().nth(1).is_some_and(|c| c.is_ascii_digit()));
        let o = body.as_object_mut().unwrap();
        let budget = o.remove("max_tokens").unwrap_or(json!(400));
        o.insert("max_completion_tokens".into(), if reasoning { json!(2000) } else { budget });
        if reasoning {
            o.remove("temperature");
        }
    }
    if req.tools {
        body["tools"] = tools_schema();
    }
    let c = client()?;
    let id = req.id.clone();
    clear_cancelled(&id);
    let emit = |t: &str| {
        if req.stream_events {
            let _ = app.emit("chat-delta", json!({ "id": id, "text": t }));
        }
    };
    let mut r = stream_chat(&c, &url, key.as_deref(), &body, emit, || is_cancelled(&id)).await;
    // some models (many small Ollama ones) reject `tools`: try once more without them
    if req.tools && matches!(&r, Err(e) if e.starts_with("http 400")) {
        body.as_object_mut().unwrap().remove("tools");
        let emit = |t: &str| {
            if req.stream_events {
                let _ = app.emit("chat-delta", json!({ "id": id, "text": t }));
            }
        };
        r = stream_chat(&c, &url, key.as_deref(), &body, emit, || is_cancelled(&id)).await;
    }
    clear_cancelled(&id);
    r
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};

    /// A one-shot HTTP server that answers with `body` split into small chunks.
    fn serve(content_type: &'static str, body: String) -> String {
        let l = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = l.local_addr().unwrap();
        std::thread::spawn(move || {
            let (mut s, _) = l.accept().unwrap();
            let mut req = [0u8; 8192];
            let _ = s.read(&mut req);
            let head = format!("HTTP/1.1 200 OK\r\nContent-Type: {content_type}\r\nConnection: close\r\n\r\n");
            s.write_all(head.as_bytes()).unwrap();
            // 7-byte pieces cut through multi-byte characters and JSON on purpose
            for piece in body.as_bytes().chunks(7) {
                s.write_all(piece).unwrap();
                s.flush().unwrap();
            }
        });
        format!("http://{addr}/v1/chat/completions")
    }

    fn run(url: &str) -> (ChatReply, Vec<String>) {
        let mut seen = Vec::new();
        let c = reqwest::Client::new();
        let r = tauri::async_runtime::block_on(stream_chat(&c, url, None, &json!({}), |t| seen.push(t.to_string()), || false))
            .unwrap();
        (r, seen)
    }

    #[test]
    fn streams_text_and_tool_calls() {
        let sse = [
            r#"data: {"choices":[{"delta":{"role":"assistant","content":""}}]}"#,
            r#"data: {"choices":[{"delta":{"content":"好呀，"}}]}"#,
            r#"data: {"choices":[{"delta":{"content":"我在呢～"}}]}"#,
            r#"data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","type":"function","function":{"name":"set_timer","arguments":""}}]}}]}"#,
            r#"data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"minutes\":"}}]}}]}"#,
            r#"data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"10}"}}]}}]}"#,
            "data: [DONE]",
        ]
        .map(|l| format!("{l}\n\n"))
        .concat();
        let (r, seen) = run(&serve("text/event-stream", sse));
        assert_eq!(r.text, "好呀，我在呢～");
        assert_eq!(seen, vec!["好呀，", "我在呢～"]);
        assert_eq!(r.tool_calls, vec![ToolCall { name: "set_timer".into(), arguments: r#"{"minutes":10}"#.into() }]);
    }

    #[test]
    fn accepts_non_streaming_json() {
        let body = r#"{"choices":[{"message":{"role":"assistant","content":"hi there"}}]}"#.to_string();
        let (r, _) = run(&serve("application/json", body));
        assert_eq!(r.text, "hi there");
    }

    #[test]
    fn endpoints() {
        let req = |provider: &str, base_url: Option<&str>, region: Option<&str>| ChatRequest {
            id: "x".into(),
            provider: provider.into(),
            model: "m".into(),
            base_url: base_url.map(str::to_string),
            region: region.map(str::to_string),
            messages: vec![],
            tools: false,
            max_tokens: None,
            stream_events: true,
        };
        assert_eq!(endpoint(&req("ollama", None, None)).unwrap(), ("http://localhost:11434/v1".into(), None));
        assert_eq!(endpoint(&req("ollama", Some("http://10.0.0.2:11434/v1/"), None)).unwrap().0, "http://10.0.0.2:11434/v1");
        assert_eq!(endpoint(&req("qwen", None, Some("intl"))).unwrap().1, Some("dashscope"));
        assert!(endpoint(&req("qwen", None, Some("intl"))).unwrap().0.contains("dashscope-intl"));
        assert_eq!(endpoint(&req("deepseek", None, None)).unwrap().1, Some("deepseek"));
        assert_eq!(endpoint(&req("custom", Some("ftp://x"), None)).unwrap_err(), "badurl");
        assert!(endpoint(&req("nope", None, None)).is_err());
    }

    #[test]
    fn unreachable_is_reported() {
        let c = reqwest::Client::new();
        let e = tauri::async_runtime::block_on(stream_chat(&c, "http://127.0.0.1:9/v1/chat/completions", None, &json!({}), |_| {}, || false))
            .unwrap_err();
        assert!(e.starts_with("unreachable"), "{e}");
    }
}
