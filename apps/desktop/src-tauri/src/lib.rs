use tracing::{error, info};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tracing_subscriber::fmt()
    .with_target(true)
    .with_ansi(false)
    .json()
    .init();

  info!(target: "desktop.startup", mode = "tauri", message = "Finance-OS desktop shell starting");

  tauri::Builder::default()
    .setup(|app| {
      if let Some(window) = app.get_webview_window("main") {
        info!(
          target: "desktop.window",
          label = window.label(),
          message = "main window ready"
        );
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .unwrap_or_else(|error| {
      error!(target: "desktop.startup", error = %error, message = "desktop shell exited with error");
      panic!("failed to run finance-os desktop shell: {error}");
    });
}
