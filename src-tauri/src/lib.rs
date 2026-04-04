use tauri::Manager;

#[tauri::command]
fn expand_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("widget").ok_or("window not found")?;
    let _ = window.set_size(tauri::LogicalSize::new(1100.0, 680.0));
    let _ = window.set_always_on_top(false);
    let _ = window.center();
    Ok(())
}

#[tauri::command]
fn collapse_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("widget").ok_or("window not found")?;
    let _ = window.set_size(tauri::LogicalSize::new(480.0, 320.0));
    let _ = window.set_always_on_top(false);
    Ok(())
}

#[tauri::command]
fn toggle_always_on_top(app: tauri::AppHandle, pinned: bool) -> Result<(), String> {
    let window = app.get_webview_window("widget").ok_or("window not found")?;
    let _ = window.set_always_on_top(pinned);
    Ok(())
}

#[tauri::command]
fn start_dragging(app: tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("widget").ok_or("window not found")?;
    let _ = window.start_dragging();
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            expand_window,
            collapse_window,
            toggle_always_on_top,
            start_dragging
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
