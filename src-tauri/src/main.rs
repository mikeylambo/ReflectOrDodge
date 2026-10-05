// Desktop wrapper (GDD: Platforms — Steam via Tauri). The game is the same web
// build; this only hosts it in a native window.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running REFLECT / DODGE");
}
