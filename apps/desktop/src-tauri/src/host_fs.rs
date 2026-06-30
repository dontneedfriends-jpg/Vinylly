use std::path::PathBuf;

use serde::Serialize;

#[derive(Serialize)]
pub struct FsEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
}

fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

#[tauri::command]
pub fn fs_join(parts: Vec<String>) -> String {
    let mut buf = PathBuf::new();
    for p in parts {
        if p.is_empty() {
            continue;
        }
        buf.push(p);
    }
    buf.to_string_lossy().to_string()
}

#[tauri::command]
pub async fn fs_read_text(path: String) -> Result<String, String> {
    tokio::fs::read_to_string(&path).await.map_err(err)
}

#[tauri::command]
pub async fn fs_write_text(path: String, contents: String) -> Result<(), String> {
    if let Some(parent) = PathBuf::from(&path).parent() {
        tokio::fs::create_dir_all(parent).await.map_err(err)?;
    }
    tokio::fs::write(&path, contents).await.map_err(err)
}

#[tauri::command]
pub async fn fs_read_binary(path: String) -> Result<Vec<u8>, String> {
    tokio::fs::read(&path).await.map_err(err)
}

#[tauri::command]
pub async fn fs_write_binary(path: String, data: Vec<u8>) -> Result<(), String> {
    if let Some(parent) = PathBuf::from(&path).parent() {
        tokio::fs::create_dir_all(parent).await.map_err(err)?;
    }
    tokio::fs::write(&path, &data).await.map_err(err)
}

#[tauri::command]
pub async fn fs_exists(path: String) -> Result<bool, String> {
    Ok(tokio::fs::try_exists(&path).await.unwrap_or(false))
}

#[tauri::command]
pub async fn fs_ensure_dir(path: String) -> Result<(), String> {
    tokio::fs::create_dir_all(&path).await.map_err(err)
}

#[tauri::command]
pub async fn fs_remove(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Ok(());
    }
    let meta = tokio::fs::metadata(&p).await.map_err(err)?;
    if meta.is_dir() {
        tokio::fs::remove_dir_all(&p).await.map_err(err)
    } else {
        tokio::fs::remove_file(&p).await.map_err(err)
    }
}

#[tauri::command]
pub async fn fs_list(dir: String) -> Result<Vec<FsEntry>, String> {
    let mut entries: Vec<FsEntry> = Vec::new();
    let mut rd = tokio::fs::read_dir(&dir).await.map_err(err)?;
    while let Some(e) = rd.next_entry().await.map_err(err)? {
        let meta = e.metadata().await.map_err(err)?;
        entries.push(FsEntry {
            name: e.file_name().to_string_lossy().to_string(),
            path: e.path().to_string_lossy().to_string(),
            is_dir: meta.is_dir(),
            size: meta.len(),
        });
    }
    Ok(entries)
}
