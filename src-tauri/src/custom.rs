//! Custom pets (M3): a cut-out PNG plus a little metadata, stored under
//! `<app data>/pets/<id>/{pet.json,image.png}`, and the `.pawse` character pack format
//! used to share them (one JSON file with the image inlined as a data URL).

use std::{fs, path::PathBuf, time::SystemTime};

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

const MAX_IMAGE: usize = 8 * 1024 * 1024;
const MAX_PICK: u64 = 25 * 1024 * 1024;
pub const PACK_FORMAT: &str = "pawse-pet";

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CustomPetMeta {
    pub id: String,
    pub name: String,
    /// "photo" | "ai" | "pack"
    pub source: String,
    /// ms since epoch
    pub created: u64,
}

#[derive(Serialize)]
pub struct CustomPet {
    #[serde(flatten)]
    pub meta: CustomPetMeta,
    /// data:image/png;base64,…
    pub image: String,
}

#[derive(Serialize, Deserialize)]
struct Pack {
    format: String,
    version: u32,
    name: String,
    image: String,
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

fn pets_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map(|d| d.join("pets")).map_err(|e| e.to_string())
}

/// Ids are generated here, but they also arrive from the frontend: only allow [a-z0-9-].
fn pet_dir(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    if id.is_empty() || id.len() > 40 || !id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') {
        return Err("invalid pet id".into());
    }
    Ok(pets_dir(app)?.join(id))
}

fn new_id() -> String {
    // time + a few bits of the nanos counter: unique enough for a local collection
    let n = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    format!("p{:x}", n)
}

pub fn png_from_data_url(url: &str) -> Result<Vec<u8>, String> {
    let b64 = url.strip_prefix("data:image/png;base64,").ok_or("expected a PNG data URL")?;
    let bytes = B64.decode(b64.trim()).map_err(|e| e.to_string())?;
    if bytes.len() > MAX_IMAGE {
        return Err("image too large".into());
    }
    if !bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        return Err("not a PNG".into());
    }
    Ok(bytes)
}

pub fn png_data_url(bytes: &[u8]) -> String {
    format!("data:image/png;base64,{}", B64.encode(bytes))
}

fn clean_name(name: &str) -> String {
    let n: String = name.trim().chars().filter(|c| !c.is_control()).take(24).collect();
    if n.is_empty() { "Pet".into() } else { n }
}

pub fn list(app: &AppHandle) -> Vec<CustomPetMeta> {
    let Ok(dir) = pets_dir(app) else { return Vec::new() };
    let mut out: Vec<CustomPetMeta> = fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|e| fs::read_to_string(e.path().join("pet.json")).ok())
        .filter_map(|s| serde_json::from_str(&s).ok())
        .collect();
    out.sort_by_key(|m| m.created);
    out
}

pub fn get(app: &AppHandle, id: &str) -> Result<CustomPet, String> {
    let dir = pet_dir(app, id)?;
    let meta: CustomPetMeta = serde_json::from_str(&fs::read_to_string(dir.join("pet.json")).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    let image = png_data_url(&fs::read(dir.join("image.png")).map_err(|e| e.to_string())?);
    Ok(CustomPet { meta, image })
}

pub fn save(app: &AppHandle, name: &str, image: &str, source: &str) -> Result<CustomPetMeta, String> {
    let png = png_from_data_url(image)?;
    let meta = CustomPetMeta {
        id: new_id(),
        name: clean_name(name),
        source: if ["photo", "ai", "pack"].contains(&source) { source.into() } else { "photo".into() },
        created: now_ms(),
    };
    let dir = pet_dir(app, &meta.id)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    fs::write(dir.join("image.png"), png).map_err(|e| e.to_string())?;
    fs::write(dir.join("pet.json"), serde_json::to_string_pretty(&meta).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    Ok(meta)
}

pub fn rename(app: &AppHandle, id: &str, name: &str) -> Result<CustomPetMeta, String> {
    let dir = pet_dir(app, id)?;
    let mut meta: CustomPetMeta =
        serde_json::from_str(&fs::read_to_string(dir.join("pet.json")).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
    meta.name = clean_name(name);
    fs::write(dir.join("pet.json"), serde_json::to_string_pretty(&meta).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    Ok(meta)
}

pub fn delete(app: &AppHandle, id: &str) -> Result<(), String> {
    let dir = pet_dir(app, id)?;
    if dir.exists() {
        fs::remove_dir_all(dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn pack_json(app: &AppHandle, id: &str) -> Result<(String, String), String> {
    let pet = get(app, id)?;
    let pack = Pack { format: PACK_FORMAT.into(), version: 1, name: pet.meta.name.clone(), image: pet.image };
    Ok((pet.meta.name, serde_json::to_string(&pack).map_err(|e| e.to_string())?))
}

pub fn import_pack(app: &AppHandle, text: &str) -> Result<CustomPetMeta, String> {
    let pack: Pack = serde_json::from_str(text).map_err(|_| "not a Pawse pet file".to_string())?;
    if pack.format != PACK_FORMAT || pack.version != 1 {
        return Err("unsupported pet file".into());
    }
    save(app, &pack.name, &pack.image, "pack")
}

/// Read a user-picked image file as a data URL (any browser-decodable format).
pub fn read_image_file(path: &std::path::Path) -> Result<String, String> {
    let len = fs::metadata(path).map_err(|e| e.to_string())?.len();
    if len > MAX_PICK {
        return Err("image too large".into());
    }
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "heic" | "heif" => "image/heic",
        "bmp" => "image/bmp",
        _ => return Err("unsupported image type".into()),
    };
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    Ok(format!("data:{mime};base64,{}", B64.encode(bytes)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_non_png_and_bad_ids() {
        assert!(png_from_data_url("data:image/png;base64,aGVsbG8=").is_err());
        assert!(png_from_data_url("data:image/jpeg;base64,aGVsbG8=").is_err());
        let png = png_data_url(b"\x89PNG\r\n\x1a\nrest");
        assert!(png_from_data_url(&png).is_ok());
        assert_eq!(clean_name("  "), "Pet");
        assert_eq!(clean_name("小\u{0007}舟"), "小舟");
    }
}
