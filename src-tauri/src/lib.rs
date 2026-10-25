pub mod db;

use db::{CorpusBundle, CorpusMeta, DeckStats, ReviewSubmission, StudyCardItem, StudyQueueQuery, VolumeData};
use rusqlite::params;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Manager, State};
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
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
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            transliterate,
            import_corpus_bundle,
            get_study_queue,
            record_review,
            get_deck_stats,
            list_corpora,
            list_volumes
        ])
        .run(tauri::generate_context!())
        .expect("error while running Alexis tauri application");
}
