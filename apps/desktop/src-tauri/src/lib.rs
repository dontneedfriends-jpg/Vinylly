use std::path::PathBuf;

use serde::Serialize;
use tauri::Manager;

#[derive(Serialize)]
struct DataPaths {
    data_dir: String,
    covers_dir: String,
    cache_dir: String,
    db_file: String,
    portable: bool,
}

fn is_portable_mode() -> bool {
    std::env::args().any(|a| a == "--portable")
        || std::env::var("VINYL_PORTABLE").is_ok()
}

fn resolve_data_dir(app: &tauri::AppHandle) -> PathBuf {
    if is_portable_mode() {
        let exe = std::env::current_exe().unwrap_or_else(|_| PathBuf::from("."));
        let dir = exe.parent().unwrap_or(&PathBuf::from(".")).to_path_buf();
        return dir.join("data");
    }
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
}

#[tauri::command]
fn data_paths(app: tauri::AppHandle) -> DataPaths {
    let data_dir = resolve_data_dir(&app);
    let covers_dir = data_dir.join("covers");
    let cache_dir = data_dir.join("cache");
    let db_file = data_dir.join("vinylly.sqlite");
    DataPaths {
        data_dir: data_dir.to_string_lossy().to_string(),
        covers_dir: covers_dir.to_string_lossy().to_string(),
        cache_dir: cache_dir.to_string_lossy().to_string(),
        db_file: db_file.to_string_lossy().to_string(),
        portable: is_portable_mode(),
    }
}

#[tauri::command]
fn ensure_dirs(app: tauri::AppHandle) -> Result<(), String> {
    let data_dir = resolve_data_dir(&app);
    for sub in ["covers", "cache"] {
        let p = data_dir.join(sub);
        std::fs::create_dir_all(&p).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = resolve_data_dir(&app.handle());
            for sub in ["covers", "cache"] {
                let _ = std::fs::create_dir_all(data_dir.join(sub));
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![data_paths, ensure_dirs])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
