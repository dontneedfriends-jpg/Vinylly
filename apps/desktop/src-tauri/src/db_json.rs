use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::host_paths::{ensure_profile_dir, resolve_profile_db, resolve_profile_dir};

/// On-disk shape of the profiles index (`data/profiles.json`).
#[derive(Default, Serialize, Deserialize, Clone)]
pub struct ProfilesIndex {
    #[serde(default)]
    pub profiles: Vec<ProfileRecord>,
    /// Last activated profile id. Optional — if missing, falls back to first.
    #[serde(default)]
    pub active_id: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ProfileRecord {
    pub id: String,
    pub label: String,
    pub created_at: String,
}

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
    #[serde(default)]
    pub wantlist: Vec<Value>,
    /// Per-profile settings (Discogs token etc.) — camelCase to match the JS side.
    /// Without this field serde silently dropped the token on every db_replace,
    /// which is why saved tokens vanished on restart.
    #[serde(default, rename = "profileSettings")]
    pub profile_settings: Option<Value>,
}

/// Per-profile on-disk config (`data/profiles/<id>/config.json`).
/// Used for Discogs token, sync flag, etc.
#[derive(Default, Serialize, Deserialize, Clone)]
pub struct ProfileConfig {
    #[serde(default)]
    pub discogs_token: String,
    #[serde(default)]
    pub discogs_username: String,
    #[serde(default = "default_sync_enabled")]
    pub discogs_sync_enabled: bool,
    /// Custom collection field mapped for purchase-price sync.
    #[serde(default)]
    pub discogs_price_field_id: Option<i64>,
}

fn default_sync_enabled() -> bool {
    true
}

/// Global app state held by Tauri.
pub struct DbState {
    pub data_dir: PathBuf,
    pub profiles: Mutex<ProfilesIndex>,
}

impl DbState {
    pub fn load_or_init(data_dir: &Path) -> Result<Self, String> {
        std::fs::create_dir_all(data_dir).map_err(|e| e.to_string())?;
        let profiles_path = data_dir.join("profiles.json");
        let mut profiles: ProfilesIndex = if profiles_path.exists() {
            let raw = std::fs::read_to_string(&profiles_path).map_err(|e| e.to_string())?;
            serde_json::from_str(&raw).unwrap_or_default()
        } else {
            ProfilesIndex::default()
        };
        Self::migrate_legacy(data_dir, &mut profiles)?;
        if profiles.profiles.is_empty() {
            // Fresh install: create a default Personal profile.
            let id = gen_id();
            let dir = ensure_profile_dir(data_dir, &id).map_err(|e| e.to_string())?;
            profiles.profiles.push(ProfileRecord {
                id: id.clone(),
                label: DEFAULT_PROFILE_LABEL.to_string(),
                created_at: now_iso(),
            });
            profiles.active_id = Some(id.clone());
            // Move a legacy single-snapshot file into the new default profile, if present.
            let legacy = data_dir.join("vinylly.db.json");
            if legacy.exists() {
                let dst = dir.join("db.json");
                if !dst.exists() {
                    let _ = std::fs::rename(&legacy, &dst);
                } else {
                    let _ = std::fs::remove_file(&legacy);
                }
            }
        }
        let state = Self {
            data_dir: data_dir.to_path_buf(),
            profiles: Mutex::new(profiles),
        };
        state.persist_profiles()?;
        Ok(state)
    }

    /// On first launch with an existing `data/vinylly.db.json` but no
    /// `data/profiles.json`, migrate the legacy snapshot into a fresh
    /// "Personal" profile and rename the old file to `.migrated.bak`.
    fn migrate_legacy(data_dir: &Path, profiles: &mut ProfilesIndex) -> Result<(), String> {
        if !profiles.profiles.is_empty() {
            return Ok(());
        }
        let legacy = data_dir.join("vinylly.db.json");
        if !legacy.exists() {
            return Ok(());
        }
        let id = gen_id();
        let dir = ensure_profile_dir(data_dir, &id).map_err(|e| e.to_string())?;
        let dst = dir.join("db.json");
        if !dst.exists() {
            std::fs::rename(&legacy, &dst).map_err(|e| e.to_string())?;
        } else {
            // Shouldn't happen, but fall back to a copy.
            std::fs::copy(&legacy, &dst).map_err(|e| e.to_string())?;
            let _ = std::fs::remove_file(&legacy);
        }
        profiles.profiles.push(ProfileRecord {
            id: id.clone(),
            label: DEFAULT_PROFILE_LABEL.to_string(),
            created_at: now_iso(),
        });
        profiles.active_id = Some(id);
        // Best-effort backup of legacy file (already moved).
        Ok(())
    }

    pub fn persist_profiles(&self) -> Result<(), String> {
        let path = self.data_dir.join("profiles.json");
        let profiles = self.profiles.lock().map_err(|e| e.to_string())?.clone();
        let tmp = path.with_extension("json.tmp");
        let body = serde_json::to_string_pretty(&profiles).map_err(|e| e.to_string())?;
        std::fs::write(&tmp, body).map_err(|e| e.to_string())?;
        std::fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn active_id(&self) -> Option<String> {
        let p = self.profiles.lock().ok()?;
        p.active_id
            .clone()
            .or_else(|| p.profiles.first().map(|x| x.id.clone()))
    }
}

fn snapshot_file(state: &DbState, profile_id: &str) -> Result<PathBuf, String> {
    let dir = resolve_profile_dir(&state.data_dir, profile_id);
    if !dir.exists() {
        return Err(format!("profile not found: {profile_id}"));
    }
    Ok(resolve_profile_db(&state.data_dir, profile_id))
}

fn config_file(state: &DbState, profile_id: &str) -> Result<PathBuf, String> {
    let dir = resolve_profile_dir(&state.data_dir, profile_id);
    if !dir.exists() {
        return Err(format!("profile not found: {profile_id}"));
    }
    Ok(dir.join("config.json"))
}

fn read_snapshot(path: &Path) -> DbSnapshot {
    if !path.exists() {
        return DbSnapshot::default();
    }
    let raw = match std::fs::read_to_string(path) {
        Ok(s) => s,
        Err(_) => return DbSnapshot::default(),
    };
    serde_json::from_str(&raw).unwrap_or_default()
}

fn write_snapshot(path: &Path, snap: &DbSnapshot) -> Result<(), String> {
    let tmp = path.with_extension("json.tmp");
    let body = serde_json::to_string_pretty(snap).map_err(|e| e.to_string())?;
    std::fs::write(&tmp, body).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, path).map_err(|e| e.to_string())
}

fn read_config(path: &Path) -> ProfileConfig {
    if !path.exists() {
        return ProfileConfig::default();
    }
    let raw = match std::fs::read_to_string(path) {
        Ok(s) => s,
        Err(_) => return ProfileConfig::default(),
    };
    serde_json::from_str(&raw).unwrap_or_default()
}

fn write_config(path: &Path, cfg: &ProfileConfig) -> Result<(), String> {
    let tmp = path.with_extension("json.tmp");
    let body = serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    std::fs::write(&tmp, body).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, path).map_err(|e| e.to_string())
}

fn now_iso() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // Light ISO 8601 (UTC). Good enough for display.
    format!("epoch:{secs}")
}

const DEFAULT_PROFILE_LABEL: &str = "Personal";

// ────────────────────────────────────────────────────────────────────
// commands
// ────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn db_load(state: tauri::State<DbState>, profile_id: Option<String>) -> Result<Value, String> {
    let id = profile_id
        .or_else(|| state.active_id())
        .ok_or_else(|| "no active profile".to_string())?;
    let path = snapshot_file(&state, &id)?;
    let snap = read_snapshot(&path);
    serde_json::to_value(&snap).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_replace(
    state: tauri::State<DbState>,
    profile_id: Option<String>,
    snapshot: Value,
) -> Result<(), String> {
    let id = profile_id
        .or_else(|| state.active_id())
        .ok_or_else(|| "no active profile".to_string())?;
    let path = snapshot_file(&state, &id)?;
    let parsed: DbSnapshot = serde_json::from_value(snapshot).map_err(|e| e.to_string())?;
    write_snapshot(&path, &parsed)
}

#[tauri::command]
pub fn db_reset(state: tauri::State<DbState>, profile_id: Option<String>) -> Result<(), String> {
    let id = profile_id
        .or_else(|| state.active_id())
        .ok_or_else(|| "no active profile".to_string())?;
    let path = snapshot_file(&state, &id)?;
    write_snapshot(&path, &DbSnapshot::default())
}

#[tauri::command]
pub fn db_get_profile_config(
    state: tauri::State<DbState>,
    profile_id: Option<String>,
) -> Result<Value, String> {
    let id = profile_id
        .or_else(|| state.active_id())
        .ok_or_else(|| "no active profile".to_string())?;
    let path = config_file(&state, &id)?;
    let cfg = read_config(&path);
    serde_json::to_value(&cfg).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_set_profile_config(
    state: tauri::State<DbState>,
    profile_id: Option<String>,
    partial: Value,
) -> Result<Value, String> {
    let id = profile_id
        .or_else(|| state.active_id())
        .ok_or_else(|| "no active profile".to_string())?;
    let path = config_file(&state, &id)?;
    let mut cfg = read_config(&path);
    if let Some(obj) = partial.as_object() {
        if let Some(v) = obj.get("discogs_token").and_then(|v| v.as_str()) {
            cfg.discogs_token = v.to_string();
        }
        if let Some(v) = obj.get("discogs_username").and_then(|v| v.as_str()) {
            cfg.discogs_username = v.to_string();
        }
        if let Some(v) = obj.get("discogs_sync_enabled").and_then(|v| v.as_bool()) {
            cfg.discogs_sync_enabled = v;
        }
        if let Some(v) = obj.get("discogs_price_field_id") {
            cfg.discogs_price_field_id = v.as_i64();
        }
    }
    write_config(&path, &cfg)?;
    serde_json::to_value(&cfg).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_list_profiles(state: tauri::State<DbState>) -> Result<Value, String> {
    let p = state.profiles.lock().map_err(|e| e.to_string())?;
    // Inline active-id fallback — calling state.active_id() here would
    // re-lock the same non-reentrant Mutex from this thread and deadlock.
    let active = p
        .active_id
        .clone()
        .or_else(|| p.profiles.first().map(|x| x.id.clone()));
    let payload = json!({
        "profiles": p.profiles,
        "active_id": active,
    });
    Ok(payload)
}

#[tauri::command]
pub fn db_create_profile(
    state: tauri::State<DbState>,
    label: String,
    set_active: Option<bool>,
) -> Result<Value, String> {
    let trimmed = label.trim();
    if trimmed.is_empty() {
        return Err("profile label is empty".to_string());
    }
    ensure_profile_dir(&state.data_dir, "pending").ok(); // touch dir tree
    let id = gen_id();
    ensure_profile_dir(&state.data_dir, &id).map_err(|e| e.to_string())?;
    let rec = ProfileRecord {
        id: id.clone(),
        label: trimmed.to_string(),
        created_at: now_iso(),
    };
    {
        let mut p = state.profiles.lock().map_err(|e| e.to_string())?;
        p.profiles.push(rec.clone());
        if set_active.unwrap_or(true) || p.active_id.is_none() {
            p.active_id = Some(id.clone());
        }
    }
    state.persist_profiles()?;
    let payload = json!({
        "profile": rec,
        "active_id": state.active_id(),
    });
    Ok(payload)
}

#[tauri::command]
pub fn db_rename_profile(
    state: tauri::State<DbState>,
    id: String,
    label: String,
) -> Result<Value, String> {
    let trimmed = label.trim();
    if trimmed.is_empty() {
        return Err("profile label is empty".to_string());
    }
    let mut p = state.profiles.lock().map_err(|e| e.to_string())?;
    let profile = p
        .profiles
        .iter_mut()
        .find(|x| x.id == id)
        .ok_or_else(|| format!("profile not found: {id}"))?;
    profile.label = trimmed.to_string();
    let updated = profile.clone();
    drop(p);
    state.persist_profiles()?;
    serde_json::to_value(updated).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_delete_profile(state: tauri::State<DbState>, id: String) -> Result<(), String> {
    {
        let mut p = state.profiles.lock().map_err(|e| e.to_string())?;
        if p.profiles.len() <= 1 {
            return Err("cannot delete the last profile".to_string());
        }
        p.profiles.retain(|x| x.id != id);
        if p.active_id.as_deref() == Some(id.as_str()) {
            p.active_id = p.profiles.first().map(|x| x.id.clone());
        }
    }
    // Remove profile directory
    let dir = resolve_profile_dir(&state.data_dir, &id);
    if dir.exists() {
        std::fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    state.persist_profiles()?;
    Ok(())
}

#[tauri::command]
pub fn db_set_active_profile(state: tauri::State<DbState>, id: String) -> Result<(), String> {
    {
        let mut p = state.profiles.lock().map_err(|e| e.to_string())?;
        if !p.profiles.iter().any(|x| x.id == id) {
            return Err(format!("profile not found: {id}"));
        }
        p.active_id = Some(id);
    }
    state.persist_profiles()?;
    Ok(())
}

fn gen_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let rnd = (nanos.wrapping_mul(0x9E3779B97F4A7C15) >> 16) as u64;
    format!("p_{:x}{:x}", nanos, rnd)
}
