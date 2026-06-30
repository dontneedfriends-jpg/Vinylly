mod db_json;
mod host_fs;
mod host_net;
mod host_paths;

use std::path::PathBuf;

use tauri::Manager;

use db_json::DbState;
use host_paths::{data_paths_for, ensure_subdirs, resolve_data_dir, DataPaths};

#[tauri::command]
fn host_paths(app: tauri::AppHandle) -> DataPaths {
    data_paths_for(&app)
}

#[tauri::command]
fn host_ensure_dirs(app: tauri::AppHandle) -> Result<(), String> {
    let dir = resolve_data_dir(&app);
    ensure_subdirs(&dir)
}

#[tauri::command]
fn host_init_app(app: tauri::AppHandle) -> Result<DataPaths, String> {
    let dir = resolve_data_dir(&app);
    ensure_subdirs(&dir)?;
    Ok(data_paths_for(&app))
}

#[tauri::command]
fn host_cwd() -> String {
    std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .to_string_lossy()
        .to_string()
}

#[tauri::command]
fn host_exe_dir() -> Result<String, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    Ok(exe
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| ".".to_string()))
}

#[tauri::command]
fn host_is_portable() -> bool {
    host_paths::is_portable_mode()
}

#[tauri::command]
fn host_platform() -> &'static str {
    if cfg!(target_os = "linux") {
        "linux"
    } else if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(target_os = "android") {
        "android"
    } else if cfg!(target_os = "ios") {
        "ios"
    } else {
        "unknown"
    }
}

#[derive(serde::Serialize)]
struct AppInfo {
    name: &'static str,
    version: &'static str,
    commit: String,
    built_at: &'static str,
    target: &'static str,
    repo: String,
}

#[tauri::command]
fn app_info() -> AppInfo {
    let commit = option_env!("GIT_COMMIT").unwrap_or("").to_string();
    let short = if commit.len() >= 7 {
        &commit[..7]
    } else {
        &commit
    };
    let repo = option_env!("GIT_REPOSITORY")
        .unwrap_or("https://github.com/vinylly/vinylly")
        .to_string();
    AppInfo {
        name: env!("CARGO_PKG_NAME"),
        version: env!("CARGO_PKG_VERSION"),
        commit: short.to_string(),
        built_at: env!("BUILD_TIMESTAMP"),
        target: host_platform(),
        repo,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let dir = resolve_data_dir(app.handle());
            let _ = ensure_subdirs(&dir);
            let state = DbState::load_or_init(&dir).expect("failed to init db state");
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            host_init_app,
            host_paths,
            host_ensure_dirs,
            host_cwd,
            host_exe_dir,
            host_is_portable,
            host_platform,
            app_info,
            host_fs::fs_join,
            host_fs::fs_read_text,
            host_fs::fs_write_text,
            host_fs::fs_read_binary,
            host_fs::fs_write_binary,
            host_fs::fs_exists,
            host_fs::fs_ensure_dir,
            host_fs::fs_remove,
            host_fs::fs_list,
            host_net::net_fetch,
            host_net::net_fetch_binary,
            host_net::cover_download,
            host_net::build_auth_header,
            db_json::db_load,
            db_json::db_replace,
            db_json::db_reset,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
