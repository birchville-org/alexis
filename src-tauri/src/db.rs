use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorpusMeta {
    pub id: String,
    pub title: String,
    pub lang_code: String,
    pub script: String,
    pub target_lang: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VolumeData {
    pub id: String,
    pub corpus_id: String,
    pub title: String,
    pub sort_order: i32,
    pub level: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LessonData {
    pub id: String,
    pub volume_id: String,
    pub lesson_number: i32,
    pub title: String,
    pub sort_order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntryDefinition {
    pub lang: String,
    pub meaning: String,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntryData {
    pub id: String,
    pub corpus_id: String,
    pub volume_id: String,
    pub lesson_id: Option<String>,
    pub lemma_native: String,
    pub lemma_translit: String,
    pub pos: Option<String>,
    pub gender: Option<String>,
    pub grammar_metadata: Option<serde_json::Value>,
    pub definitions: Vec<EntryDefinition>,
    pub tags: Option<Vec<String>>,
    pub context_examples: Option<serde_json::Value>,
    pub dictionary_refs: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorpusBundle {
    pub corpus: CorpusMeta,
    pub volumes: Vec<VolumeData>,
    pub lessons: Vec<LessonData>,
    pub entries: Vec<EntryData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudyQueueQuery {
    pub corpus_id: String,
    pub volume_ids: Option<Vec<String>>,
    pub lesson_ids: Option<Vec<String>>,
    pub tags: Option<Vec<String>>,
    pub due_only: bool,
    pub limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudyCardItem {
    pub entry_id: String,
    pub corpus_id: String,
    pub volume_id: String,
    pub volume_title: String,
    pub lesson_id: Option<String>,
    pub lemma_native: String,
    pub lemma_translit: String,
    pub pos: Option<String>,
    pub gender: Option<String>,
    pub definitions: Vec<EntryDefinition>,
    pub tags: Vec<String>,
    pub box_number: i32,
    pub interval_days: i32,
    pub consecutive_successes: i32,
    pub next_due: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewSubmission {
    pub entry_id: String,
    pub rating: i32, // 1: Again, 2: Hard, 3: Good, 4: Easy
    pub duration_ms: Option<i64>,
    pub direction: String, // 'NATIVE_TO_MEANING', etc.
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeckStats {
    pub total_entries: i64,
    pub box_1: i64,
    pub box_2: i64,
    pub box_3: i64,
    pub box_4: i64,
    pub box_5: i64,
    pub due_today: i64,
}

pub fn init_db(db_path: &Path) -> Result<Connection> {
    if let Some(parent) = db_path.parent() {
        if !parent.exists() {
            let _ = fs::create_dir_all(parent);
        }
    }

    let conn = Connection::open(db_path)?;
    conn.busy_timeout(std::time::Duration::from_secs(5))?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;

    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS corpora (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            lang_code TEXT NOT NULL,
            script TEXT NOT NULL,
            target_lang TEXT NOT NULL,
            description TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS volumes (
            id TEXT PRIMARY KEY,
            corpus_id TEXT NOT NULL REFERENCES corpora(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            level TEXT
        );

        CREATE TABLE IF NOT EXISTS lessons (
            id TEXT PRIMARY KEY,
            volume_id TEXT NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
            lesson_number INTEGER NOT NULL,
            title TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS entries (
            id TEXT PRIMARY KEY,
            corpus_id TEXT NOT NULL REFERENCES corpora(id) ON DELETE CASCADE,
            volume_id TEXT NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
            lesson_id TEXT REFERENCES lessons(id) ON DELETE SET NULL,
            lemma_native TEXT NOT NULL,
            lemma_translit TEXT NOT NULL,
            pos TEXT,
            gender TEXT,
            grammar_metadata TEXT,
            definitions TEXT NOT NULL,
            tags TEXT,
            context_examples TEXT,
            dictionary_refs TEXT
        );

        CREATE TABLE IF NOT EXISTS study_state (
            entry_id TEXT PRIMARY KEY REFERENCES entries(id) ON DELETE CASCADE,
            box_number INTEGER NOT NULL DEFAULT 1,
            interval_days INTEGER NOT NULL DEFAULT 1,
            ease_factor REAL NOT NULL DEFAULT 2.5,
            consecutive_successes INTEGER NOT NULL DEFAULT 0,
            last_reviewed TEXT,
            next_due TEXT NOT NULL DEFAULT (datetime('now')),
            review_count INTEGER NOT NULL DEFAULT 0,
            lapse_count INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS review_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
            timestamp TEXT NOT NULL DEFAULT (datetime('now')),
            rating INTEGER NOT NULL,
            duration_ms INTEGER,
            direction TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_entries_corpus_volume ON entries(corpus_id, volume_id);
        CREATE INDEX IF NOT EXISTS idx_entries_lesson ON entries(lesson_id);
        CREATE INDEX IF NOT EXISTS idx_study_next_due ON study_state(next_due, box_number);
        ",
    )?;

    Ok(conn)
}

pub fn import_bundle(conn: &mut Connection, bundle: &CorpusBundle) -> Result<usize> {
    let tx = conn.transaction()?;

    tx.execute(
        "INSERT INTO corpora (id, title, lang_code, script, target_lang, description)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET
            title=excluded.title,
            lang_code=excluded.lang_code,
            script=excluded.script,
            target_lang=excluded.target_lang,
            description=excluded.description",
        params![
            bundle.corpus.id,
            bundle.corpus.title,
            bundle.corpus.lang_code,
            bundle.corpus.script,
            bundle.corpus.target_lang,
            bundle.corpus.description
        ],
    )?;

    for vol in &bundle.volumes {
        tx.execute(
            "INSERT INTO volumes (id, corpus_id, title, sort_order, level)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(id) DO UPDATE SET
                title=excluded.title,
                sort_order=excluded.sort_order,
                level=excluded.level",
            params![vol.id, vol.corpus_id, vol.title, vol.sort_order, vol.level],
        )?;
    }

    for les in &bundle.lessons {
        tx.execute(
            "INSERT INTO lessons (id, volume_id, lesson_number, title, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(id) DO UPDATE SET
                lesson_number=excluded.lesson_number,
                title=excluded.title,
                sort_order=excluded.sort_order",
            params![les.id, les.volume_id, les.lesson_number, les.title, les.sort_order],
        )?;
    }

    let mut inserted_count = 0;
    for entry in &bundle.entries {
        let grammar_json = entry.grammar_metadata.as_ref().map(|v| v.to_string());
        let defs_json = serde_json::to_string(&entry.definitions).unwrap_or_else(|_| "[]".to_string());
        let tags_json = entry.tags.as_ref().map(|v| serde_json::to_string(v).unwrap_or_default());
        let examples_json = entry.context_examples.as_ref().map(|v| v.to_string());
        let dict_refs_json = entry.dictionary_refs.as_ref().map(|v| v.to_string());

        tx.execute(
            "INSERT INTO entries (id, corpus_id, volume_id, lesson_id, lemma_native, lemma_translit, pos, gender, grammar_metadata, definitions, tags, context_examples, dictionary_refs)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
             ON CONFLICT(id) DO UPDATE SET
                volume_id=excluded.volume_id,
                lesson_id=excluded.lesson_id,
                lemma_native=excluded.lemma_native,
                lemma_translit=excluded.lemma_translit,
                pos=excluded.pos,
                gender=excluded.gender,
                grammar_metadata=excluded.grammar_metadata,
                definitions=excluded.definitions,
                tags=excluded.tags",
            params![
                entry.id,
                entry.corpus_id,
                entry.volume_id,
                entry.lesson_id,
                entry.lemma_native,
                entry.lemma_translit,
                entry.pos,
                entry.gender,
                grammar_json,
                defs_json,
                tags_json,
                examples_json,
                dict_refs_json
            ],
        )?;

        // Ensure study_state row exists for this entry
        tx.execute(
            "INSERT OR IGNORE INTO study_state (entry_id, box_number, interval_days, next_due)
             VALUES (?1, 1, 1, datetime('now'))",
            params![entry.id],
        )?;

        inserted_count += 1;
    }

    tx.commit()?;
    Ok(inserted_count)
}

pub fn query_study_queue(conn: &Connection, query: &StudyQueueQuery) -> Result<Vec<StudyCardItem>> {
    let mut sql = String::from(
        "SELECT e.id, e.corpus_id, e.volume_id, v.title, e.lesson_id,
                e.lemma_native, e.lemma_translit, e.pos, e.gender,
                e.definitions, e.tags,
                COALESCE(s.box_number, 1),
                COALESCE(s.interval_days, 1),
                COALESCE(s.consecutive_successes, 0),
                COALESCE(s.next_due, datetime('now'))
         FROM entries e
         JOIN volumes v ON e.volume_id = v.id
         LEFT JOIN study_state s ON e.id = s.entry_id
         WHERE e.corpus_id = ?1",
    );

    let mut param_values: Vec<rusqlite::types::Value> = vec![query.corpus_id.clone().into()];

    if let Some(vols) = &query.volume_ids {
        if !vols.is_empty() {
            let placeholders: Vec<String> = (0..vols.len())
                .map(|i| format!("?{}", param_values.len() + 1 + i))
                .collect();
            sql.push_str(&format!(" AND e.volume_id IN ({})", placeholders.join(",")));
            for vol in vols {
                param_values.push(vol.clone().into());
            }
        }
    }

    if let Some(lessons) = &query.lesson_ids {
        if !lessons.is_empty() {
            let placeholders: Vec<String> = (0..lessons.len())
                .map(|i| format!("?{}", param_values.len() + 1 + i))
                .collect();
            sql.push_str(&format!(" AND e.lesson_id IN ({})", placeholders.join(",")));
            for les in lessons {
                param_values.push(les.clone().into());
            }
        }
    }

    if query.due_only {
        sql.push_str(" AND (s.next_due IS NULL OR s.next_due <= datetime('now'))");
    }

    sql.push_str(" ORDER BY s.box_number ASC, s.next_due ASC");

    let limit = query.limit.unwrap_or(100);
    sql.push_str(&format!(" LIMIT {}", limit));

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params_from_iter(param_values), |row| {
        let defs_raw: String = row.get(9)?;
        let tags_raw: Option<String> = row.get(10)?;

        let defs: Vec<EntryDefinition> = serde_json::from_str(&defs_raw).unwrap_or_default();
        let tags: Vec<String> = tags_raw
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();

        Ok(StudyCardItem {
            entry_id: row.get(0)?,
            corpus_id: row.get(1)?,
            volume_id: row.get(2)?,
            volume_title: row.get(3)?,
            lesson_id: row.get(4)?,
            lemma_native: row.get(5)?,
            lemma_translit: row.get(6)?,
            pos: row.get(7)?,
            gender: row.get(8)?,
            definitions: defs,
            tags,
            box_number: row.get(11)?,
            interval_days: row.get(12)?,
            consecutive_successes: row.get(13)?,
            next_due: row.get(14)?,
        })
    })?;

    let mut items = Vec::new();
    for item in rows {
        items.push(item?);
    }
    Ok(items)
}

pub fn record_review(conn: &Connection, sub: &ReviewSubmission) -> Result<(i32, i32, String)> {
    // Current state
    let (cur_box, cur_interval, cur_successes): (i32, i32, i32) = conn
        .query_row(
            "SELECT box_number, interval_days, consecutive_successes FROM study_state WHERE entry_id = ?1",
            params![sub.entry_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .unwrap_or((1, 1, 0));

    // Leitner scheduling:
    // rating 1: Fail -> Box 1, interval 1 day
    // rating 2: Hard -> same box, interval 1 day
    // rating 3: Good -> box + 1 (max 5)
    // rating 4: Easy -> box + 1 (max 5), longer interval
    let (new_box, new_interval, new_successes) = match sub.rating {
        1 => (1, 1, 0),
        2 => (cur_box, 1, cur_successes),
        3 => {
            let next_box = (cur_box + 1).min(5);
            let interval = match next_box {
                1 => 1,
                2 => 3,
                3 => 7,
                4 => 14,
                5 => 30,
                _ => 30,
            };
            (next_box, interval, cur_successes + 1)
        }
        4 => {
            let next_box = (cur_box + 1).min(5);
            let interval = match next_box {
                1 => 2,
                2 => 5,
                3 => 10,
                4 => 21,
                5 => 45,
                _ => 45,
            };
            (next_box, interval, cur_successes + 2)
        }
        _ => (cur_box, cur_interval, cur_successes),
    };

    conn.execute(
        "UPDATE study_state
         SET box_number = ?1,
             interval_days = ?2,
             consecutive_successes = ?3,
             last_reviewed = datetime('now'),
             next_due = datetime('now', '+' || ?2 || ' days'),
             review_count = review_count + 1,
             lapse_count = lapse_count + (CASE WHEN ?4 = 1 THEN 1 ELSE 0 END)
         WHERE entry_id = ?5",
        params![new_box, new_interval, new_successes, sub.rating, sub.entry_id],
    )?;

    conn.execute(
        "INSERT INTO review_history (entry_id, rating, duration_ms, direction)
         VALUES (?1, ?2, ?3, ?4)",
        params![sub.entry_id, sub.rating, sub.duration_ms, sub.direction],
    )?;

    let next_due: String = conn.query_row(
        "SELECT next_due FROM study_state WHERE entry_id = ?1",
        params![sub.entry_id],
        |r| r.get(0),
    )?;

    Ok((new_box, new_interval, next_due))
}

pub fn get_deck_stats(conn: &Connection, corpus_id: Option<&str>) -> Result<DeckStats> {
    let where_clause = if let Some(cid) = corpus_id {
        format!("WHERE e.corpus_id = '{}'", cid.replace('\'', "''"))
    } else {
        String::new()
    };

    let sql = format!(
        "SELECT
            COUNT(*),
            COUNT(CASE WHEN s.box_number = 1 THEN 1 END),
            COUNT(CASE WHEN s.box_number = 2 THEN 1 END),
            COUNT(CASE WHEN s.box_number = 3 THEN 1 END),
            COUNT(CASE WHEN s.box_number = 4 THEN 1 END),
            COUNT(CASE WHEN s.box_number = 5 THEN 1 END),
            COUNT(CASE WHEN s.next_due <= datetime('now') THEN 1 END)
         FROM entries e
         LEFT JOIN study_state s ON e.id = s.entry_id
         {}",
        where_clause
    );

    conn.query_row(&sql, [], |r| {
        Ok(DeckStats {
            total_entries: r.get(0)?,
            box_1: r.get(1)?,
            box_2: r.get(2)?,
            box_3: r.get(3)?,
            box_4: r.get(4)?,
            box_5: r.get(5)?,
            due_today: r.get(6)?,
        })
    })
}
