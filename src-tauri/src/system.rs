//! What the user is doing right now, without reading anything private:
//! seconds since the last keyboard/mouse input, and which app owns the frontmost window
//! (name + bounds only — no window titles, no screen capture permission needed).
//! Used for idle-aware reminders, do-not-disturb and steering the pet away from your work.

use serde::Serialize;

#[derive(Clone, Copy, Debug, Serialize)]
pub struct Bounds {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

#[derive(Clone, Debug, Serialize)]
pub struct FrontWindow {
    pub app: String,
    /// Global logical coordinates (points), origin = top-left of the primary display.
    pub bounds: Bounds,
}

#[derive(Clone, Debug, Serialize)]
pub struct AppEntry {
    pub name: String,
    pub path: String,
}

// ---------------------------------------------------------------- macOS

#[cfg(target_os = "macos")]
mod imp {
    use super::*;
    use core_foundation::{
        base::{CFType, TCFType},
        dictionary::{CFDictionary, CFDictionaryRef},
        number::CFNumber,
        string::CFString,
    };
    use core_graphics::window::{
        copy_window_info, kCGNullWindowID, kCGWindowListExcludeDesktopElements, kCGWindowListOptionOnScreenOnly,
    };

    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGEventSourceSecondsSinceLastEventType(state: i32, event_type: u32) -> f64;
    }
    const COMBINED_SESSION_STATE: i32 = 0;
    const ANY_INPUT_EVENT: u32 = !0;

    pub fn idle_seconds() -> f64 {
        unsafe { CGEventSourceSecondsSinceLastEventType(COMBINED_SESSION_STATE, ANY_INPUT_EVENT) }
    }

    fn num(d: &CFDictionary<CFString, CFType>, key: &str) -> Option<f64> {
        d.find(CFString::new(key)).and_then(|v| v.downcast::<CFNumber>()).and_then(|n| n.to_f64())
    }

    /// The topmost normal (layer 0) window that isn't ours.
    pub fn front_window() -> Option<FrontWindow> {
        let me = std::process::id() as f64;
        let list = copy_window_info(
            kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements,
            kCGNullWindowID,
        )?;
        for item in list.iter() {
            let d: CFDictionary<CFString, CFType> =
                unsafe { CFDictionary::wrap_under_get_rule(*item as CFDictionaryRef) };
            if num(&d, "kCGWindowLayer") != Some(0.0) || num(&d, "kCGWindowOwnerPID") == Some(me) {
                continue;
            }
            let app = d
                .find(CFString::new("kCGWindowOwnerName"))
                .and_then(|v| v.downcast::<CFString>())
                .map(|s| s.to_string())
                .unwrap_or_default();
            let b = d
                .find(CFString::new("kCGWindowBounds"))
                .and_then(|v| v.downcast::<CFDictionary>())
                .map(|raw| unsafe {
                    CFDictionary::<CFString, CFType>::wrap_under_get_rule(raw.as_concrete_TypeRef())
                })?;
            let bounds = Bounds {
                x: num(&b, "X")?,
                y: num(&b, "Y")?,
                w: num(&b, "Width")?,
                h: num(&b, "Height")?,
            };
            // skip slivers, transparent helpers and parked off-screen windows (e.g. Chrome's hidden strip)
            let alpha = num(&d, "kCGWindowAlpha").unwrap_or(1.0);
            if bounds.w < 80.0 || bounds.h < 80.0 || alpha <= 0.01 || bounds.y + bounds.h <= 0.0 {
                continue;
            }
            return Some(FrontWindow { app, bounds });
        }
        None
    }

    pub fn list_apps() -> Vec<AppEntry> {
        let mut dirs = vec![
            "/Applications".to_string(),
            "/Applications/Utilities".to_string(),
            "/System/Applications".to_string(),
            "/System/Applications/Utilities".to_string(),
        ];
        if let Ok(home) = std::env::var("HOME") {
            dirs.push(format!("{home}/Applications"));
        }
        let mut out: Vec<AppEntry> = dirs
            .iter()
            .filter_map(|d| std::fs::read_dir(d).ok())
            .flatten()
            .flatten()
            .filter_map(|e| {
                let p = e.path();
                if p.extension()? != "app" {
                    return None;
                }
                Some(AppEntry {
                    name: p.file_stem()?.to_string_lossy().into_owned(),
                    path: p.to_string_lossy().into_owned(),
                })
            })
            .collect();
        out.sort_by_key(|a| a.name.to_lowercase());
        out.dedup_by(|a, b| a.name == b.name);
        out
    }

    pub fn launch(target: &str) -> std::io::Result<()> {
        let mut cmd = std::process::Command::new("open");
        // URLs, app bundles and file paths open directly; anything else is treated as an app name
        if target.contains("://") || target.starts_with('/') {
            cmd.arg(target);
        } else {
            cmd.args(["-a", target]);
        }
        cmd.spawn().map(|_| ())
    }
}

// ---------------------------------------------------------------- other platforms (Windows support lands in M5)

#[cfg(not(target_os = "macos"))]
mod imp {
    use super::*;

    pub fn idle_seconds() -> f64 {
        0.0
    }

    pub fn front_window() -> Option<FrontWindow> {
        None
    }

    pub fn list_apps() -> Vec<AppEntry> {
        Vec::new()
    }

    pub fn launch(target: &str) -> std::io::Result<()> {
        #[cfg(target_os = "windows")]
        let mut cmd = std::process::Command::new("explorer");
        #[cfg(not(target_os = "windows"))]
        let mut cmd = std::process::Command::new("xdg-open");
        cmd.arg(target).spawn().map(|_| ())
    }
}

pub use imp::{front_window, idle_seconds, launch, list_apps};

#[cfg(all(test, target_os = "macos"))]
mod tests {
    #[test]
    fn reads_presence() {
        let idle = super::idle_seconds();
        assert!(idle >= 0.0, "idle {idle}");
        println!("idle={idle:.1}s front={:?}", super::front_window());
        assert!(super::list_apps().iter().any(|a| a.name == "Safari" || a.name == "Finder" || a.name == "Calculator"));
    }
}
