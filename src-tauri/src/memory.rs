//! Chat memory (M4), in a local SQLite file `<app data>/pawse.db`:
//!   - `messages`: the conversation log; the latest few are the short-term context
//!   - `kv`: the long-term summary the pet keeps about you, and how far it has read
//!
//! Nothing here is uploaded; only what goes into a prompt reaches the chosen model.

use std::sync::Mutex;

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use tauri::{AppHandle, Manager};

const MAX_CONTENT: usize = 4000;

#[derive(Default)]
pub struct Db(Mutex<Option<Connection>>);

#[derive(Debug, Serialize, PartialEq)]
pub struct Message {
    pub id: i64,
    /// ms since epoch
    pub ts: i64,
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct MemoryState {
    pub summary: String,
    /// id of the last message folded into the summary
    pub upto: i64,
    /// messages logged after `upto`
    pub pending: i64,
}

pub fn init(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);",
    )
}

impl Db {
    fn with<T>(&self, app: &AppHandle, f: impl FnOnce(&Connection) -> rusqlite::Result<T>) -> Result<T, String> {
        let mut guard = self.0.lock().unwrap();
        if guard.is_none() {
            let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
            std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
            let conn = Connection::open(dir.join("pawse.db")).map_err(|e| e.to_string())?;
            init(&conn).map_err(|e| e.to_string())?;
            *guard = Some(conn);
        }
        f(guard.as_ref().unwrap()).map_err(|e| e.to_string())
    }

    pub fn log(&self, app: &AppHandle, role: &str, content: &str) -> Result<i64, String> {
        self.with(app, |c| log(c, role, content))
    }
    pub fn recent(&self, app: &AppHandle, limit: u32) -> Result<Vec<Message>, String> {
        self.with(app, |c| recent(c, limit))
    }
    pub fn after(&self, app: &AppHandle, after: i64, limit: u32) -> Result<Vec<Message>, String> {
        self.with(app, |c| after_id(c, after, limit))
    }
    pub fn state(&self, app: &AppHandle) -> Result<MemoryState, String> {
        self.with(app, state)
    }
    pub fn set_summary(&self, app: &AppHandle, summary: &str, upto: Option<i64>) -> Result<(), String> {
        self.with(app, |c| set_summary(c, summary, upto))
    }
    pub fn clear(&self, app: &AppHandle) -> Result<(), String> {
        self.with(app, |c| c.execute_batch("DELETE FROM messages; DELETE FROM kv;"))
    }
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub fn log(c: &Connection, role: &str, content: &str) -> rusqlite::Result<i64> {
    let role = if role == "assistant" { "assistant" } else { "user" };
    let content: String = content.chars().take(MAX_CONTENT).collect();
    c.execute("INSERT INTO messages (ts, role, content) VALUES (?1, ?2, ?3)", params![now_ms(), role, content])?;
    Ok(c.last_insert_rowid())
}

fn rows(c: &Connection, sql: &str, p: impl rusqlite::Params) -> rusqlite::Result<Vec<Message>> {
    let mut st = c.prepare(sql)?;
    let it = st.query_map(p, |r| Ok(Message { id: r.get(0)?, ts: r.get(1)?, role: r.get(2)?, content: r.get(3)? }))?;
    it.collect()
}

/// The latest `limit` messages, oldest first.
pub fn recent(c: &Connection, limit: u32) -> rusqlite::Result<Vec<Message>> {
    let mut v = rows(c, "SELECT id, ts, role, content FROM messages ORDER BY id DESC LIMIT ?1", params![limit.min(200)])?;
    v.reverse();
    Ok(v)
}

pub fn after_id(c: &Connection, after: i64, limit: u32) -> rusqlite::Result<Vec<Message>> {
    rows(c, "SELECT id, ts, role, content FROM messages WHERE id > ?1 ORDER BY id LIMIT ?2", params![after, limit.min(500)])
}

fn kv(c: &Connection, key: &str) -> rusqlite::Result<Option<String>> {
    c.query_row("SELECT value FROM kv WHERE key = ?1", params![key], |r| r.get(0)).optional()
}

pub fn state(c: &Connection) -> rusqlite::Result<MemoryState> {
    let summary = kv(c, "summary")?.unwrap_or_default();
    let upto = kv(c, "summary_upto")?.and_then(|s| s.parse().ok()).unwrap_or(0);
    let pending = c.query_row("SELECT COUNT(*) FROM messages WHERE id > ?1", params![upto], |r| r.get(0))?;
    Ok(MemoryState { summary, upto, pending })
}

pub fn set_summary(c: &Connection, summary: &str, upto: Option<i64>) -> rusqlite::Result<()> {
    let summary: String = summary.trim().chars().take(MAX_CONTENT).collect();
    c.execute("INSERT OR REPLACE INTO kv (key, value) VALUES ('summary', ?1)", params![summary])?;
    if let Some(u) = upto {
        c.execute("INSERT OR REPLACE INTO kv (key, value) VALUES ('summary_upto', ?1)", params![u.to_string()])?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn log_recent_and_summary() {
        let c = Connection::open_in_memory().unwrap();
        init(&c).unwrap();
        for i in 0..5 {
            log(&c, if i % 2 == 0 { "user" } else { "assistant" }, &format!("m{i}")).unwrap();
        }
        let r = recent(&c, 3).unwrap();
        assert_eq!(r.iter().map(|m| m.content.as_str()).collect::<Vec<_>>(), ["m2", "m3", "m4"]);
        assert_eq!(state(&c).unwrap().pending, 5);
        set_summary(&c, "  likes tea  ", Some(r[0].id)).unwrap();
        let s = state(&c).unwrap();
        assert_eq!((s.summary.as_str(), s.pending), ("likes tea", 2));
        assert_eq!(after_id(&c, s.upto, 10).unwrap().len(), 2);
        // anything that isn't "assistant" is stored as the user
        let id = log(&c, "system", "x").unwrap();
        assert_eq!(after_id(&c, id - 1, 1).unwrap()[0].role, "user");
    }
}
