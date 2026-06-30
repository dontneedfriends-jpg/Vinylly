use base64::Engine;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue, AUTHORIZATION, USER_AGENT};
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Default)]
pub struct FetchInit {
    pub method: Option<String>,
    pub headers: Option<Vec<(String, String)>>,
    pub body: Option<String>,
}

fn build_headers(init: &FetchInit) -> HeaderMap {
    let mut map = HeaderMap::new();
    if let Some(hs) = &init.headers {
        for (k, v) in hs {
            if let (Ok(name), Ok(value)) = (
                HeaderName::from_bytes(k.as_bytes()),
                HeaderValue::from_str(v),
            ) {
                map.insert(name, value);
            }
        }
    }
    if init.body.is_some() && !map.contains_key(reqwest::header::CONTENT_TYPE) {
        if let Ok(v) = HeaderValue::from_str("application/json") {
            map.insert(reqwest::header::CONTENT_TYPE, v);
        }
    }
    if !map.contains_key(USER_AGENT) {
        if let Ok(v) = HeaderValue::from_str("Vinylly/0.1 (Tauri)") {
            map.insert(USER_AGENT, v);
        }
    }
    map
}

fn build_request(client: &reqwest::Client, url: &str, init: &FetchInit) -> reqwest::RequestBuilder {
    let method = init.method.as_deref().unwrap_or("GET").to_uppercase();
    let mut rb = client.request(
        reqwest::Method::from_bytes(method.as_bytes()).unwrap_or(reqwest::Method::GET),
        url,
    );
    rb = rb.headers(build_headers(init));
    if let Some(b) = &init.body {
        rb = rb.body(b.clone());
    }
    rb
}

#[derive(Serialize)]
pub struct FetchResponse {
    pub status: u16,
    pub ok: bool,
    pub headers: Vec<(String, String)>,
    pub text: String,
    pub bytes_b64: Option<String>,
}

#[tauri::command]
pub async fn net_fetch(url: String, init: Option<FetchInit>) -> Result<FetchResponse, String> {
    let init = init.unwrap_or_default();
    let client = reqwest::Client::builder()
        .user_agent("Vinylly/0.1 (Tauri)")
        .build()
        .map_err(|e| e.to_string())?;
    let resp = build_request(&client, &url, &init)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let status = resp.status().as_u16();
    let ok = resp.status().is_success();
    let headers: Vec<(String, String)> = resp
        .headers()
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
        .collect();
    if ok {
        let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
        let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
        Ok(FetchResponse {
            status,
            ok,
            headers,
            text: String::from_utf8_lossy(&bytes).to_string(),
            bytes_b64: Some(b64),
        })
    } else {
        Ok(FetchResponse {
            status,
            ok,
            headers,
            text: String::new(),
            bytes_b64: None,
        })
    }
}

#[tauri::command]
pub async fn net_fetch_binary(url: String, init: Option<FetchInit>) -> Result<Vec<u8>, String> {
    let init = init.unwrap_or_default();
    let client = reqwest::Client::builder()
        .user_agent("Vinylly/0.1 (Tauri)")
        .build()
        .map_err(|e| e.to_string())?;
    let resp = build_request(&client, &url, &init)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("fetch failed: {} {}", resp.status(), url));
    }
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    Ok(bytes.to_vec())
}

#[tauri::command]
pub async fn cover_download(url: String, dest: String) -> Result<String, String> {
    if let Some(parent) = std::path::PathBuf::from(&dest).parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| e.to_string())?;
    }
    let client = reqwest::Client::builder()
        .user_agent("Vinylly/0.1 (Tauri)")
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("cover download failed: {} {}", resp.status(), url));
    }
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    tokio::fs::write(&dest, &bytes)
        .await
        .map_err(|e| e.to_string())?;
    Ok(dest)
}

#[tauri::command]
pub fn build_auth_header(token: &str) -> Result<String, String> {
    Ok(format!("{} {}", AUTHORIZATION, token))
}
