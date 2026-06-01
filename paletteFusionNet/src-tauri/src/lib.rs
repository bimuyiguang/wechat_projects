use std::sync::Mutex;
use std::time::Duration;
use tauri::Manager;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[derive(serde::Serialize)]
struct RecolorResponse {
    recolor_image: String,
}

struct BackendState {
    ready: bool,
    process: Option<std::process::Child>,
}

struct AppState {
    client: reqwest::blocking::Client,
    backend: Mutex<BackendState>,
    python_port: u16,
}

enum BackendLaunch {
    Script {
        executable: String,
        script_path: std::path::PathBuf,
    },
    BundledExe {
        executable_path: std::path::PathBuf,
    },
}

#[cfg(target_os = "windows")]
fn hide_backend_window(command: &mut std::process::Command) {
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(target_os = "windows"))]
fn hide_backend_window(_: &mut std::process::Command) {}

fn get_free_port() -> u16 {
    std::net::TcpListener::bind("127.0.0.1:0")
        .and_then(|listener| listener.local_addr())
        .map(|addr| addr.port())
        .unwrap_or(51700)
}

fn ensure_service_available(state: &AppState) -> Result<(), String> {
    let mut guard = state.backend.lock().unwrap();
    if let Some(ref mut child) = guard.process {
        match child.try_wait() {
            Ok(Some(_)) => return Err("Python 后端服务已意外退出，请重启应用".into()),
            Ok(None) => {}
            Err(e) => return Err(format!("无法检查后端服务状态: {}", e)),
        }
    } else {
        return Err("Python 后端服务未启动".into());
    }
    if !guard.ready {
        return Err("Python 后端服务尚未就绪，请稍候重试".into());
    }
    Ok(())
}

// --- HTTP proxy helpers ---

fn fetch_list(state: &AppState, endpoint: &str) -> Result<Vec<String>, String> {
    let resp: serde_json::Value = state
        .client
        .get(format!("http://127.0.0.1:{}/{}", state.python_port, endpoint))
        .send()
        .map_err(|e| format!("连接 Python 服务失败: {}", e))?
        .json()
        .map_err(|e| format!("解析响应失败: {}", e))?;
    match &resp {
        serde_json::Value::Array(arr) => Ok(arr.iter().filter_map(|v| v.as_str().map(String::from)).collect()),
        _ => Err("响应格式错误".into()),
    }
}

fn fetch_image(state: &AppState, endpoint: &str) -> Result<String, String> {
    let resp: serde_json::Value = state
        .client
        .get(format!("http://127.0.0.1:{}/{}", state.python_port, endpoint))
        .send()
        .map_err(|e| format!("连接 Python 服务失败: {}", e))?
        .json()
        .map_err(|e| format!("解析响应失败: {}", e))?;
    resp.get("image").and_then(|v| v.as_str()).map(String::from).ok_or("响应格式错误".into())
}

// --- Tauri commands ---

#[tauri::command]
fn get_styles(state: tauri::State<AppState>) -> Result<Vec<String>, String> {
    ensure_service_available(&state)?;
    fetch_list(&state, "api/styles")
}

#[tauri::command]
fn get_style_image(state: tauri::State<AppState>, name: String) -> Result<String, String> {
    ensure_service_available(&state)?;
    fetch_image(&state, &format!("api/style_image/{}", urlencoding::encode(&name)))
}

#[tauri::command]
fn get_kuanshi_image(
    state: tauri::State<AppState>,
    style: String,
    fabric: String,
) -> Result<String, String> {
    ensure_service_available(&state)?;
    fetch_image(
        &state,
        &format!(
            "api/kuanshi_image/{}/{}",
            urlencoding::encode(&style),
            urlencoding::encode(&fabric)
        ),
    )
}

#[tauri::command]
fn get_fabrics(state: tauri::State<AppState>) -> Result<Vec<String>, String> {
    ensure_service_available(&state)?;
    fetch_list(&state, "api/fabrics")
}

#[tauri::command]
fn get_fabric_image(state: tauri::State<AppState>, name: String) -> Result<String, String> {
    ensure_service_available(&state)?;
    fetch_image(&state, &format!("api/fabric_image/{}", urlencoding::encode(&name)))
}

#[tauri::command]
fn get_landscapes(state: tauri::State<AppState>) -> Result<Vec<String>, String> {
    ensure_service_available(&state)?;
    fetch_list(&state, "api/landscapes")
}

#[tauri::command]
fn get_landscape_image(state: tauri::State<AppState>, name: String) -> Result<String, String> {
    ensure_service_available(&state)?;
    fetch_image(&state, &format!("api/landscape_image/{}", urlencoding::encode(&name)))
}

#[tauri::command]
fn extract_landscape_palette(state: tauri::State<AppState>, landscape_name: String) -> Result<Vec<Vec<u8>>, String> {
    ensure_service_available(&state)?;
    let resp: serde_json::Value = state
        .client
        .post(format!("http://127.0.0.1:{}/api/extract_landscape_palette", state.python_port))
        .json(&serde_json::json!({ "landscape_name": landscape_name }))
        .send()
        .map_err(|e| format!("提取调色板失败: {}", e))?
        .json()
        .map_err(|e| format!("解析响应失败: {}", e))?;
    let palette_arr = resp.get("palette").and_then(|v| v.as_array())
        .ok_or_else(|| format!("响应格式错误, 实际响应: {}", resp))?;
    palette_arr.iter().map(|c| {
        fn val_to_u8(v: Option<&serde_json::Value>, label: &str) -> Result<u8, String> {
            let v = v.ok_or_else(|| format!("{}缺少", label))?;
            v.as_u64()
                .or_else(|| v.as_f64().map(|f| f as u64))
                .ok_or_else(|| format!("{}数值错误: {}", label, v))?
                .try_into()
                .map_err(|e: std::num::TryFromIntError| format!("{}: {}", label, e))
        }
        Ok(vec![
            val_to_u8(c.get(0), "R")?,
            val_to_u8(c.get(1), "G")?,
            val_to_u8(c.get(2), "B")?,
        ])
    }).collect()
}

#[tauri::command]
fn recolor(
    state: tauri::State<AppState>,
    style_name: String,
    fabric_name: String,
    palette_rgb: Vec<Vec<u8>>,
) -> Result<RecolorResponse, String> {
    ensure_service_available(&state)?;
    let resp: serde_json::Value = state
        .client
        .post(format!("http://127.0.0.1:{}/api/recolor", state.python_port))
        .json(&serde_json::json!({
            "style_name": style_name,
            "fabric_name": fabric_name,
            "palette_rgb": palette_rgb,
        }))
        .send()
        .map_err(|e| format!("推理请求失败: {}", e))?
        .json()
        .map_err(|e| format!("解析响应失败: {}", e))?;
    Ok(RecolorResponse {
        recolor_image: resp.get("recolor_image")
            .and_then(|v| v.as_str())
            .map(String::from)
            .ok_or("响应格式错误: 缺少重着色结果")?,
    })
}

#[tauri::command]
fn save_result(
    app_handle: tauri::AppHandle,
    image_base64: String,
    style_name: String,
    fabric_name: String,
    palette_label: String,
) -> Result<Vec<String>, String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&image_base64)
        .map_err(|e| format!("解码失败: {}", e))?;

    let result_dir = app_handle
        .path()
        .download_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("./"))
        .join("PaletteFusionNet_Results");
    std::fs::create_dir_all(&result_dir).map_err(|e| format!("创建目录失败: {}", e))?;

    let style_stem = std::path::Path::new(&style_name).file_stem().and_then(|s| s.to_str()).unwrap_or("style");
    let fabric_stem = std::path::Path::new(&fabric_name).file_stem().and_then(|s| s.to_str()).unwrap_or("fabric");
    let label: String = palette_label
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '_' })
        .collect::<String>()
        .trim_matches('_')
        .to_string();
    let label = if label.is_empty() { "palette" } else { &label };

    let base_name = format!("{}_{}_{}", fabric_stem, style_stem, label);
    let path = (0..)
        .map(|i| {
            if i == 0 {
                result_dir.join(format!("{}.png", base_name))
            } else {
                result_dir.join(format!("{}_{}.png", base_name, i))
            }
        })
        .find(|p| !p.exists())
        .unwrap_or_else(|| result_dir.join(format!("{}.png", base_name)));
    std::fs::write(&path, bytes).map_err(|e| format!("写入结果失败: {}", e))?;

    Ok(vec![path.to_string_lossy().to_string()])
}

#[tauri::command]
fn check_service(state: tauri::State<AppState>) -> Result<bool, String> {
    let ready = match state
        .client
        .get(format!("http://127.0.0.1:{}/api/health", state.python_port))
        .timeout(Duration::from_secs(2))
        .send()
    {
        Ok(resp) if resp.status().is_success() => true,
        _ => false,
    };
    state.backend.lock().unwrap().ready = ready;
    Ok(ready)
}

fn find_python_exe() -> String {
    if let Ok(v) = std::env::var("PYTHON_EXEC") {
        return v;
    }
    ["python", "py"]
        .iter()
        .find(|cmd| std::process::Command::new(cmd).arg("--version").output().is_ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "python".to_string())
}

fn resolve_dev_python_script_path() -> std::path::PathBuf {
    std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("python-service")
        .join("server.py")
}

fn resolve_backend_launch(app: &tauri::App) -> Result<BackendLaunch, String> {
    let dev_script = resolve_dev_python_script_path();
    if cfg!(debug_assertions) && dev_script.exists() {
        return Ok(BackendLaunch::Script {
            executable: find_python_exe(),
            script_path: dev_script,
        });
    }

    let resource_dir = app.path().resource_dir().map_err(|e| format!("无法获取资源目录: {}", e))?;
    let exe_dir = std::env::current_exe().ok().and_then(|p| p.parent().map(|d| d.to_path_buf())).unwrap_or_default();

    let candidates = [
        resource_dir.join("python-service").join("dist").join("server_backend").join("server_backend.exe"),
        resource_dir.join("_up_").join("python-service").join("dist").join("server_backend").join("server_backend.exe"),
        exe_dir.join("python-service").join("dist").join("server_backend").join("server_backend.exe"),
        exe_dir.join("_up_").join("python-service").join("dist").join("server_backend").join("server_backend.exe"),
    ];

    for path in &candidates {
        if path.exists() {
            return Ok(BackendLaunch::BundledExe { executable_path: path.clone() });
        }
    }

    Err(format!(
        "未找到已打包的后端程序，请先运行 build_backend.ps1。\n已检查:\n{}",
        candidates.iter().map(|p| format!("  - {}", p.display())).collect::<Vec<_>>().join("\n")
    ))
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let port = get_free_port();
            let backend = match resolve_backend_launch(app) {
                Ok(b) => b,
                Err(e) => {
                    eprintln!("[ERROR] {}", e);
                    let window = app.get_webview_window("main").unwrap();
                    let _ = window.eval(&format!("alert('{}')", e.replace('\'', "\\'").replace('\n', "\\n")));
                    return Ok(());
                }
            };

            let mut command = match backend {
                BackendLaunch::Script { executable, script_path } => {
                    let mut cmd = std::process::Command::new(executable);
                    cmd.arg(script_path);
                    cmd
                }
                BackendLaunch::BundledExe { executable_path } => {
                    std::process::Command::new(executable_path)
                }
            };
            hide_backend_window(&mut command);

            let child = command
                .arg(port.to_string())
                .env("PYTHONIOENCODING", "utf-8")
                .env("PYTHONUTF8", "1")
                .spawn()
                .map_err(|e| format!("无法启动后端服务: {}", e))?;

            let client = reqwest::blocking::Client::builder()
                .timeout(Duration::from_secs(120))
                .build()
                .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

            app.manage(AppState {
                client,
                backend: Mutex::new(BackendState {
                    ready: false,
                    process: Some(child),
                }),
                python_port: port,
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(state) = window.try_state::<AppState>() {
                    if let Ok(mut guard) = state.backend.lock() {
                        if let Some(ref mut child) = guard.process {
                            let _ = child.kill();
                            let _ = child.wait();
                        }
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_styles, get_style_image, get_kuanshi_image,
            get_fabrics, get_fabric_image,
            get_landscapes, get_landscape_image, extract_landscape_palette,
            recolor, save_result, check_service,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
