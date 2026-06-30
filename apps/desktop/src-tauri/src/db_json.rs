use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Default, Serialize, Deserialize, Clone)]
pub struct DbSnapshot {
    #[serde(default)]
    pub collection: Option<Value>,
    #[serde(default)]
    pub items: Vec<Value>,
    #[serde(default)]
    pub releases: Vec<Value>,
    #[serde(default)]
    pub tracks: Vec<Value>,
}

pub struct DbState {
    pub file: PathBuf,
    pub snapshot: Mutex<DbSnapshot>,
}

impl DbState {
    pub fn load_or_init(data_dir: &Path) -> Result<Self, String> {
        std::fs::create_dir_all(data_dir).map_err(|e| e.to_string())?;
        let file = data_dir.join("vinylly.db.json");
        let snapshot = if file.exists() {
            let raw = std::fs::read_to_string(&file).map_err(|e| e.to_string())?;
            serde_json::from_str(&raw).unwrap_or_default()
        } else {
            DbSnapshot::default()
        };
        Ok(Self {
            file,
            snapshot: Mutex::new(snapshot),
        })
    }

    pub fn persist(&self) -> Result<(), String> {
        let snap = self.snapshot.lock().map_err(|e| e.to_string())?.clone();
        let tmp = self.file.with_extension("json.tmp");
        let body = serde_json::to_string_pretty(&snap).map_err(|e| e.to_string())?;
        std::fs::write(&tmp, body).map_err(|e| e.to_string())?;
        std::fs::rename(&tmp, &self.file).map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[tauri::command]
pub fn db_load(state: tauri::State<DbState>) -> Result<Value, String> {
    let snap = state.snapshot.lock().map_err(|e| e.to_string())?;
    serde_json::to_value(&*snap).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_replace(state: tauri::State<DbState>, snapshot: Value) -> Result<(), String> {
    let parsed: DbSnapshot = serde_json::from_value(snapshot).map_err(|e| e.to_string())?;
    {
        let mut s = state.snapshot.lock().map_err(|e| e.to_string())?;
        *s = parsed;
    }
    state.persist()
}

#[tauri::command]
pub fn db_reset(state: tauri::State<DbState>) -> Result<(), String> {
    {
        let mut s = state.snapshot.lock().map_err(|e| e.to_string())?;
        *s = DbSnapshot::default();
    }
    state.persist()
}
