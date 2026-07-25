use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::Manager;

#[derive(Serialize, Clone)]
pub struct DataPaths {
    pub data_dir: String,
    pub covers_dir: String,
    pub cache_dir: String,
    pub db_file: String,
    pub profiles_index: String,
    pub portable: bool,
}

pub fn is_portable_mode() -> bool {
    std::env::args().any(|a| a == "--portable") || std::env::var("VINYL_PORTABLE").is_ok()
}

pub fn resolve_data_dir(app: &tauri::AppHandle) -> PathBuf {
    if is_portable_mode() {
        let exe = std::env::current_exe().unwrap_or_else(|_| PathBuf::from("."));
        let dir = exe.parent().unwrap_or(&PathBuf::from(".")).to_path_buf();
        return dir.join("data");
    }
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
}

pub fn resolve_profile_dir(data_dir: &Path, profile_id: &str) -> PathBuf {
    data_dir.join("profiles").join(profile_id)
}

pub fn resolve_profile_db(data_dir: &Path, profile_id: &str) -> PathBuf {
    resolve_profile_dir(data_dir, profile_id).join("db.json")
}

pub fn data_paths_for(app: &tauri::AppHandle) -> DataPaths {
    let data_dir = resolve_data_dir(app);
    let covers_dir = data_dir.join("covers");
    let cache_dir = data_dir.join("cache");
    let profiles_index = data_dir.join("profiles.json");
    DataPaths {
        data_dir: data_dir.to_string_lossy().to_string(),
        covers_dir: covers_dir.to_string_lossy().to_string(),
        cache_dir: cache_dir.to_string_lossy().to_string(),
        // Legacy: single-BDB layout uses vinylly.sqlite at root. Multi-profile layout
        // uses data/profiles/<id>/db.json. Kept here for backward compatibility.
        db_file: data_dir
            .join("vinylly.sqlite")
            .to_string_lossy()
            .to_string(),
        profiles_index: profiles_index.to_string_lossy().to_string(),
        portable: is_portable_mode(),
    }
}

pub fn ensure_subdirs(data_dir: &Path) -> Result<(), String> {
    for sub in ["covers", "cache", "profiles"] {
        let p = data_dir.join(sub);
        std::fs::create_dir_all(&p)
            .map_err(|e| format!("create_dir_all({}): {}", p.display(), e))?;
    }
    Ok(())
}

pub fn ensure_profile_dir(data_dir: &Path, profile_id: &str) -> Result<PathBuf, String> {
    let dir = resolve_profile_dir(data_dir, profile_id);
    for sub in ["", "covers"] {
        let p = if sub.is_empty() {
            dir.clone()
        } else {
            dir.join(sub)
        };
        std::fs::create_dir_all(&p)
            .map_err(|e| format!("create_dir_all({}): {}", p.display(), e))?;
    }
    Ok(dir)
}
