pub mod db;

use db::{CorpusBundle, CorpusMeta, DeckStats, EntryPatch, ReviewSubmission, StudyCardItem, StudyQueueQuery, VolumeData};
use rusqlite::params;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Emitter, Manager, State};
use vidyut_lipi::{Lipika, Scheme};

pub struct AppState {
    pub db: Mutex<rusqlite::Connection>,
}

fn map_scheme_name(name: &str) -> Option<Scheme> {
    match name.to_lowercase().as_str() {
        "iast" => Some(Scheme::Iast),
        "devanagari" | "deva" => Some(Scheme::Devanagari),
        "hk" | "harvardkyoto" | "harvard-kyoto" => Some(Scheme::HarvardKyoto),
        "slp1" => Some(Scheme::Slp1),
        _ => None,
    }
}

#[tauri::command]
fn transliterate(text: String, from: String, to: String) -> String {
    let from_scheme = match map_scheme_name(&from) {
        Some(s) => s,
        None => return text,
    };
    let to_scheme = match map_scheme_name(&to) {
        Some(s) => s,
        None => return text,
    };

    if from_scheme == to_scheme || text.is_empty() {
        return text;
    }

    let mut lipika = Lipika::new();
    lipika.transliterate(&text, from_scheme, to_scheme)
}

#[tauri::command]
fn import_corpus_bundle(state: State<AppState>, bundle: CorpusBundle) -> Result<usize, String> {
    let mut conn = state.db.lock().map_err(|e| e.to_string())?;
    db::import_bundle(&mut conn, &bundle).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_corpus_entries(state: State<AppState>, patches: Vec<EntryPatch>) -> Result<usize, String> {
    let mut conn = state.db.lock().map_err(|e| e.to_string())?;
    db::update_entries(&mut conn, &patches).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_user_note(state: State<AppState>, entry_id: String, note: Option<String>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::save_user_note(&conn, &entry_id, note.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
fn export_study_state(state: State<AppState>) -> Result<serde_json::Map<String, serde_json::Value>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::export_study_state(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_study_queue(state: State<AppState>, query: StudyQueueQuery) -> Result<Vec<StudyCardItem>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::query_study_queue(&conn, &query).map_err(|e| e.to_string())
}

#[tauri::command]
fn record_review(state: State<AppState>, review: ReviewSubmission) -> Result<(i32, i32, String), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::record_review(&conn, &review).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_deck_stats(state: State<AppState>, corpus_id: Option<String>) -> Result<DeckStats, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::get_deck_stats(&conn, corpus_id.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_corpora(state: State<AppState>) -> Result<Vec<CorpusMeta>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, title, lang_code, script, target_lang, description FROM corpora ORDER BY title ASC")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(CorpusMeta {
                id: row.get(0)?,
                title: row.get(1)?,
                lang_code: row.get(2)?,
                script: row.get(3)?,
                target_lang: row.get(4)?,
                description: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for r in rows {
        result.push(r.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[tauri::command]
fn list_volumes(state: State<AppState>, corpus_id: String) -> Result<Vec<VolumeData>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT v.id, v.corpus_id, v.title, v.sort_order, v.level, COUNT(e.id) AS entry_count
             FROM volumes v
             LEFT JOIN entries e ON v.id = e.volume_id
             WHERE v.corpus_id = ?1
             GROUP BY v.id
             ORDER BY v.sort_order ASC, v.title ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![corpus_id], |row| {
            Ok(VolumeData {
                id: row.get(0)?,
                corpus_id: row.get(1)?,
                title: row.get(2)?,
                sort_order: row.get(3)?,
                level: row.get(4)?,
                entry_count: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for r in rows {
        result.push(r.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[tauri::command]
fn list_lessons(
    state: State<AppState>,
    corpus_id: String,
    volume_id: Option<String>,
) -> Result<Vec<db::LessonData>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let (sql, params_vec): (String, Vec<rusqlite::types::Value>) = match volume_id {
        Some(v) => (
            "SELECT l.id, l.volume_id, l.lesson_number, l.title, l.sort_order, COUNT(e.id) AS entry_count
             FROM lessons l
             JOIN volumes vol ON l.volume_id = vol.id
             LEFT JOIN entries e ON l.id = e.lesson_id
             WHERE vol.corpus_id = ?1 AND l.volume_id = ?2
             GROUP BY l.id
             ORDER BY l.sort_order ASC, l.lesson_number ASC"
                .to_string(),
            vec![corpus_id.into(), v.into()],
        ),
        None => (
            "SELECT l.id, l.volume_id, l.lesson_number, l.title, l.sort_order, COUNT(e.id) AS entry_count
             FROM lessons l
             JOIN volumes vol ON l.volume_id = vol.id
             LEFT JOIN entries e ON l.id = e.lesson_id
             WHERE vol.corpus_id = ?1
             GROUP BY l.id
             ORDER BY l.sort_order ASC, l.lesson_number ASC"
                .to_string(),
            vec![corpus_id.into()],
        ),
    };

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(rusqlite::params_from_iter(params_vec), |row| {
            Ok(db::LessonData {
                id: row.get(0)?,
                volume_id: row.get(1)?,
                lesson_number: row.get(2)?,
                title: row.get(3)?,
                sort_order: row.get(4)?,
                entry_count: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for r in rows {
        result.push(r.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| PathBuf::from(".alexis"));
            let db_path = app_data_dir.join("alexis.db");
            let conn = db::init_db(&db_path).expect("Failed to initialize Alexis SQLite database");
            app.manage(AppState {
                db: Mutex::new(conn),
            });

            // Native Menu Bar (File, Edit, View, Window, Help)
            let file_menu = Submenu::with_items(
                app,
                "File",
                true,
                &[
                    &MenuItem::with_id(app, "import_tsv", "TSV-Wortliste importieren...", true, Some("CmdOrCtrl+O"))?,
                    &MenuItem::with_id(app, "export_tsv", "Auswahl als TSV exportieren...", true, Some("CmdOrCtrl+E"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "backup_json", "Lernstand-Backup sichern (.json)...", true, Some("CmdOrCtrl+S"))?,
                ],
            )?;
            let edit_menu = Submenu::with_items(
                app,
                "Edit",
                true,
                &[
                    &PredefinedMenuItem::undo(app, None)?,
                    &PredefinedMenuItem::redo(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::cut(app, None)?,
                    &PredefinedMenuItem::copy(app, None)?,
                    &PredefinedMenuItem::paste(app, None)?,
                    &PredefinedMenuItem::select_all(app, None)?,
                ],
            )?;
            let view_menu = Submenu::with_items(
                app,
                "View",
                true,
                &[
                    &MenuItem::with_id(app, "tab_trainer", "Trainer", true, Some("CmdOrCtrl+1"))?,
                    &MenuItem::with_id(app, "tab_explorer", "Vokabelliste", true, Some("CmdOrCtrl+2"))?,
                    &MenuItem::with_id(app, "tab_corpora", "Korpora & Gliederung", true, Some("CmdOrCtrl+3"))?,
                    &MenuItem::with_id(app, "tab_dictionary", "Wörterbuch", true, Some("CmdOrCtrl+4"))?,
                    &MenuItem::with_id(app, "tab_stats", "Statistik", true, Some("CmdOrCtrl+5"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "toggle_theme", "Dark / Light Mode umschalten", true, Some("CmdOrCtrl+Shift+D"))?,
                    &MenuItem::with_id(app, "toggle_direction", "Lernrichtung umkehren", true, Some("CmdOrCtrl+Shift+R"))?,
                    &MenuItem::with_id(app, "toggle_shuffle", "Zufall / Shuffle umschalten", true, Some("CmdOrCtrl+Shift+S"))?,
                ],
            )?;
            let window_menu = Submenu::with_items(
                app,
                "Window",
                true,
                &[
                    &PredefinedMenuItem::minimize(app, None)?,
                    &PredefinedMenuItem::maximize(app, None)?,
                    &PredefinedMenuItem::close_window(app, None)?,
                ],
            )?;
            let help_menu = Submenu::with_items(
                app,
                "Help",
                true,
                &[
                    &MenuItem::with_id(app, "open_help_manual", "Benutzerhandbuch", true, Some("CmdOrCtrl+/"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "open_help_updates", "Updates & Release Notes", true, None::<String>)?,
                    &MenuItem::with_id(app, "check_updates_help", "Check for Updates...", true, None::<String>)?,
                ],
            )?;

            #[cfg(target_os = "macos")]
            let app_menu = {
                let about_metadata = tauri::menu::AboutMetadata {
                    name: Some("Alexis".to_string()),
                    version: Some(app.package_info().version.to_string()),
                    ..Default::default()
                };
                Submenu::with_items(
                    app,
                    "Alexis",
                    true,
                    &[
                        &PredefinedMenuItem::about(app, None, Some(about_metadata))?,
                        &PredefinedMenuItem::separator(app)?,
                        &MenuItem::with_id(app, "check_updates", "Check for Updates...", true, None::<String>)?,
                        &PredefinedMenuItem::separator(app)?,
                        &PredefinedMenuItem::services(app, None)?,
                        &PredefinedMenuItem::separator(app)?,
                        &PredefinedMenuItem::hide(app, None)?,
                        &PredefinedMenuItem::hide_others(app, None)?,
                        &PredefinedMenuItem::show_all(app, None)?,
                        &PredefinedMenuItem::separator(app)?,
                        &PredefinedMenuItem::quit(app, None)?,
                    ],
                )?
            };

            let mut menu_items: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> = Vec::new();
            #[cfg(target_os = "macos")]
            menu_items.push(&app_menu);
            menu_items.push(&file_menu);
            menu_items.push(&edit_menu);
            menu_items.push(&view_menu);
            menu_items.push(&window_menu);
            menu_items.push(&help_menu);

            let menu = Menu::with_items(app, &menu_items)?;
            app.set_menu(menu)?;

            app.on_menu_event(|app_handle, event| {
                let id = event.id().0.as_str();
                let mapped = match id {
                    "check_updates_help" => "check_updates",
                    other => other,
                };
                let _ = app_handle.emit("menu-event", mapped);
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            transliterate,
            import_corpus_bundle,
            update_corpus_entries,
            save_user_note,
            export_study_state,
            get_study_queue,
            record_review,
            get_deck_stats,
            list_corpora,
            list_volumes,
            list_lessons
        ])
        .run(tauri::generate_context!())
        .expect("error while running Alexis tauri application");
}
