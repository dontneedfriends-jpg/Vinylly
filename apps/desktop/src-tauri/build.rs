fn main() {
    let commit = std::env::var("GIT_COMMIT").unwrap_or_default();
    let repo = std::env::var("GIT_REPOSITORY").unwrap_or_default();
    let built_at = std::env::var("BUILD_TIMESTAMP").unwrap_or_else(|_| chrono_like_timestamp());
    println!("cargo:rustc-env=GIT_COMMIT={commit}");
    println!("cargo:rustc-env=GIT_REPOSITORY={repo}");
    println!("cargo:rustc-env=BUILD_TIMESTAMP={built_at}");
    tauri_build::build()
}

fn chrono_like_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{secs}")
}
