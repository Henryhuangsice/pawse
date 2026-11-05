//! Pawse — native shell.
//!
//! The pet lives in one transparent, borderless, always-on-top window that covers the
//! primary monitor. By default the whole window ignores the mouse (clicks fall through to
//! whatever is underneath). A background thread polls the global cursor ~30×/s, forwards it
//! to the webview (so the pet can look at you even when you're not touching it), and turns
//! mouse capture back on only while the cursor is over one of the "hit regions" the frontend
//! reports (the pet, its speech bubble, its menu).

use std::{fs, path::PathBuf, sync::Mutex, thread, time::Duration};

use serde::Deserialize;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, EventTarget, Manager, WebviewUrl, WebviewWindowBuilder, Wry,
};

const PET: &str = "pet";
const SETTINGS: &str = "settings";
const TRAY: &str = "main";

#[derive(Clone, Copy, Debug, Deserialize)]
struct Rect {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}

impl Rect {
    fn contains(&self, px: f64, py: f64) -> bool {
        px >= self.x && px <= self.x + self.w && py >= self.y && py <= self.y + self.h
    }
}

#[derive(Default)]
struct HitState {
    rects: Vec<Rect>,
    /// When true the whole window captures the mouse (dragging, roam editor).
    lock: bool,
}

#[derive(Default)]
struct AppState {
    hit: Mutex<HitState>,
}

// ---------------- commands ----------------

#[tauri::command]
fn set_hit_regions(state: tauri::State<AppState>, rects: Vec<Rect>) {
    state.hit.lock().unwrap().rects = rects;
}

#[tauri::command]
fn set_interactive_lock(app: AppHandle, state: tauri::State<AppState>, lock: bool) {
    state.hit.lock().unwrap().lock = lock;
    if lock {
        if let Some(w) = app.get_webview_window(PET) {
            let _ = w.set_ignore_cursor_events(false);
        }
    }
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|d| d.join("config.json"))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_config(app: AppHandle) -> serde_json::Value {
    config_path(&app)
        .ok()
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or(serde_json::Value::Null)
}

#[tauri::command]
fn save_config(app: AppHandle, config: serde_json::Value) -> Result<(), String> {
    let path = config_path(&app)?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let text = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(&path, text).map_err(|e| e.to_string())?;
    app.emit("config-changed", &config).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_settings(app: AppHandle) -> Result<(), String> {
    show_settings(&app).map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_pet(app: AppHandle, visible: Option<bool>) -> Result<(), String> {
    set_pet_visible(&app, visible).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_locale(app: AppHandle, lang: String) -> Result<(), String> {
    let menu = tray_menu(&app, &lang).map_err(|e| e.to_string())?;
    if let Some(tray) = app.tray_by_id(TRAY) {
        tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

// ---------------- helpers ----------------

fn show_settings(app: &AppHandle) -> tauri::Result<()> {
    if let Some(w) = app.get_webview_window(SETTINGS) {
        w.show()?;
        w.unminimize()?;
        return w.set_focus();
    }
    let w = WebviewWindowBuilder::new(app, SETTINGS, WebviewUrl::App("settings.html".into()))
        .title("Pawse")
        .inner_size(600.0, 720.0)
        .min_inner_size(420.0, 480.0)
        .center()
        .build()?;
    w.set_focus()
}

fn set_pet_visible(app: &AppHandle, visible: Option<bool>) -> tauri::Result<()> {
    if let Some(w) = app.get_webview_window(PET) {
        let show = visible.unwrap_or(!w.is_visible()?);
        if show {
            w.show()?;
        } else {
            w.hide()?;
        }
    }
    Ok(())
}

fn tray_menu(app: &AppHandle, lang: &str) -> tauri::Result<Menu<Wry>> {
    let zh = lang.starts_with("zh");
    let l = |a: &'static str, b: &'static str| if zh { a } else { b };
    Menu::with_items(
        app,
        &[
            &MenuItem::with_id(app, "toggle", l("显示 / 隐藏宠物", "Show / Hide pet"), true, None::<&str>)?,
            &MenuItem::with_id(app, "roam", l("设置活动范围…", "Set roaming area…"), true, None::<&str>)?,
            &MenuItem::with_id(app, "settings", l("设置…", "Settings…"), true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "quit", l("退出 Pawse", "Quit Pawse"), true, None::<&str>)?,
        ],
    )
}

/// Size the overlay to cover the primary monitor.
fn fit_to_monitor(win: &tauri::WebviewWindow) -> tauri::Result<()> {
    if let Some(m) = win.primary_monitor()? {
        win.set_position(*m.position())?;
        win.set_size(*m.size())?;
    }
    Ok(())
}

/// Poll the global cursor, forward it to the pet webview, and toggle click-through.
fn spawn_cursor_loop(app: AppHandle) {
    thread::spawn(move || {
        let mut last_ignore: Option<bool> = None;
        let mut last_pos = (f64::NAN, f64::NAN);
        loop {
            thread::sleep(Duration::from_millis(33));
            let Some(win) = app.get_webview_window(PET) else { continue };
            if !win.is_visible().unwrap_or(false) {
                continue;
            }
            let (Ok(cursor), Ok(origin), Ok(scale)) =
                (win.cursor_position(), win.inner_position(), win.scale_factor())
            else {
                continue;
            };
            // physical desktop coords -> logical coords inside the overlay
            let lx = (cursor.x - origin.x as f64) / scale;
            let ly = (cursor.y - origin.y as f64) / scale;

            if (lx - last_pos.0).abs() > 0.5 || (ly - last_pos.1).abs() > 0.5 {
                last_pos = (lx, ly);
                let _ = app.emit_to(EventTarget::webview_window(PET), "cursor", (lx, ly));
            }

            let interactive = {
                let state = app.state::<AppState>();
                let hit = state.hit.lock().unwrap();
                hit.lock || hit.rects.iter().any(|r| r.contains(lx, ly))
            };
            let ignore = !interactive;
            if last_ignore != Some(ignore) && win.set_ignore_cursor_events(ignore).is_ok() {
                last_ignore = Some(ignore);
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            set_hit_regions,
            set_interactive_lock,
            get_config,
            save_config,
            open_settings,
            toggle_pet,
            set_locale,
            quit_app
        ])
        .setup(|app| {
            // A pet is not a "real" app window: no Dock icon, lives in the menu bar tray.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let handle = app.handle().clone();
            let win = app.get_webview_window(PET).expect("pet window missing");
            fit_to_monitor(&win)?;
            let _ = win.set_visible_on_all_workspaces(true);
            win.set_ignore_cursor_events(true)?;
            win.show()?;

            let menu = tray_menu(&handle, "zh")?;
            let mut tray = TrayIconBuilder::with_id(TRAY)
                .tooltip("Pawse")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "toggle" => {
                        let _ = set_pet_visible(app, None);
                    }
                    "roam" => {
                        let _ = set_pet_visible(app, Some(true));
                        let _ = app.emit_to(EventTarget::webview_window(PET), "edit-roam", ());
                    }
                    "settings" => {
                        let _ = show_settings(app);
                    }
                    "quit" => app.exit(0),
                    _ => {}
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;

            spawn_cursor_loop(handle);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Pawse");
}
