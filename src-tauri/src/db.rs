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
    pub entry_count: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LessonData {
    pub id: String,
    pub volume_id: String,
    pub lesson_number: i32,
    pub title: String,
    pub sort_order: i32,
    pub entry_count: Option<i64>,
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
    #[serde(default)]
    pub shuffle: Option<bool>,
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
    #[serde(default)]
    pub grammar_metadata: Option<serde_json::Value>,
    pub definitions: Vec<EntryDefinition>,
    pub tags: Vec<String>,
    pub box_number: i32,
    pub interval_days: i32,
    pub consecutive_successes: i32,
    pub next_due: String,
    #[serde(default)]
    pub user_note: Option<String>,
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
            lapse_count INTEGER NOT NULL DEFAULT 0,
            user_note TEXT
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

    // Non-destructive migration for existing databases created before user_note
    let _ = conn.execute("ALTER TABLE study_state ADD COLUMN user_note TEXT", []);

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

#[derive(Debug, Serialize, Deserialize)]
pub struct EntryPatch {
    pub id: String,
    pub lemma_native: String,
    pub lemma_translit: String,
    pub pos: Option<String>,
    pub gender: Option<String>,
    #[serde(default)]
    pub definitions: Option<Vec<EntryDefinition>>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
}

pub fn update_entries(conn: &mut Connection, patches: &[EntryPatch]) -> Result<usize> {
    let tx = conn.transaction()?;
    let mut updated = 0;
    for p in patches {
        updated += tx.execute(
            "UPDATE entries SET lemma_native = ?2, lemma_translit = ?3, pos = ?4, gender = ?5 WHERE id = ?1",
            params![p.id, p.lemma_native, p.lemma_translit, p.pos, p.gender],
        )?;
        if let Some(defs) = &p.definitions {
            let defs_json = serde_json::to_string(defs).unwrap_or_else(|_| "[]".to_string());
            tx.execute(
                "UPDATE entries SET definitions = ?2 WHERE id = ?1",
                params![p.id, defs_json],
            )?;
        }
        if let Some(tags) = &p.tags {
            let tags_json = serde_json::to_string(tags).unwrap_or_else(|_| "[]".to_string());
            tx.execute(
                "UPDATE entries SET tags = ?2 WHERE id = ?1",
                params![p.id, tags_json],
            )?;
        }
    }
    tx.commit()?;
    Ok(updated)
}

pub fn save_user_note(conn: &Connection, entry_id: &str, note: Option<&str>) -> Result<()> {
    let cleaned = note.map(str::trim).filter(|s| !s.is_empty());
    conn.execute(
        "INSERT INTO study_state (entry_id, box_number, interval_days, next_due, user_note)
         VALUES (?1, 1, 1, datetime('now'), ?2)
         ON CONFLICT(entry_id) DO UPDATE SET user_note = excluded.user_note",
        params![entry_id, cleaned],
    )?;
    Ok(())
}

pub fn export_study_state(conn: &Connection) -> Result<serde_json::Map<String, serde_json::Value>> {
    let mut stmt = conn.prepare(
        "SELECT entry_id, box_number, interval_days, consecutive_successes, next_due, user_note, review_count
         FROM study_state
         WHERE review_count > 0 OR (user_note IS NOT NULL AND trim(user_note) != '')",
    )?;
    let rows = stmt.query_map([], |row| {
        let entry_id: String = row.get(0)?;
        let box_num: i32 = row.get(1)?;
        let interval: i32 = row.get(2)?;
        let successes: i32 = row.get(3)?;
        let next_due: String = row.get(4)?;
        let user_note: Option<String> = row.get(5)?;
        let review_count: i32 = row.get(6)?;
        Ok((
            entry_id,
            box_num,
            interval,
            successes,
            next_due,
            user_note,
            review_count,
        ))
    })?;

    let mut map = serde_json::Map::new();
    for item in rows {
        let (entry_id, box_num, interval, successes, next_due, user_note, review_count) = item?;
        let mut obj = serde_json::Map::new();
        obj.insert("box".to_string(), serde_json::json!(box_num));
        obj.insert("interval".to_string(), serde_json::json!(interval));
        obj.insert("successes".to_string(), serde_json::json!(successes));
        obj.insert("nextDue".to_string(), serde_json::json!(next_due));
        obj.insert("reviewCount".to_string(), serde_json::json!(review_count));
        if let Some(n) = user_note.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()) {
            obj.insert("userNote".to_string(), serde_json::json!(n));
        }
        map.insert(entry_id, serde_json::Value::Object(obj));
    }
    Ok(map)
}

pub fn import_study_state(
    conn: &mut Connection,
    states: &serde_json::Map<String, serde_json::Value>,
) -> Result<usize> {
    let tx = conn.transaction()?;
    let mut count = 0;

    for (entry_id, val) in states {
        let exists: bool = tx.query_row(
            "SELECT EXISTS(SELECT 1 FROM entries WHERE id = ?1)",
            params![entry_id],
            |r| r.get(0),
        )?;
        if !exists {
            continue;
        }

        let box_num = val
            .get("box")
            .and_then(|v| v.as_i64())
            .unwrap_or(1)
            .clamp(1, 5) as i32;
        let interval = val
            .get("interval")
            .and_then(|v| v.as_i64())
            .unwrap_or(1)
            .max(1) as i32;
        let successes = val
            .get("successes")
            .and_then(|v| v.as_i64())
            .unwrap_or(0)
            .max(0) as i32;
        let incoming_reviews = val
            .get("reviewCount")
            .and_then(|v| v.as_i64())
            .unwrap_or(1)
            .max(1) as i32;
        let next_due = val
            .get("nextDue")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .unwrap_or("1970-01-01T00:00:00Z");
        let user_note = val
            .get("userNote")
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty());

        tx.execute(
            "INSERT INTO study_state (entry_id, box_number, interval_days, consecutive_successes, next_due, review_count, user_note)
             VALUES (?1, ?2, ?3, ?4, COALESCE(datetime(?5), datetime('now')), ?6, ?7)
             ON CONFLICT(entry_id) DO UPDATE SET
                box_number = excluded.box_number,
                interval_days = excluded.interval_days,
                consecutive_successes = excluded.consecutive_successes,
                next_due = excluded.next_due,
                review_count = MAX(study_state.review_count, excluded.review_count),
                user_note = COALESCE(excluded.user_note, study_state.user_note)",
            params![entry_id, box_num, interval, successes, next_due, incoming_reviews, user_note],
        )?;
        count += 1;
    }

    tx.commit()?;
    Ok(count)
}

pub fn export_all_bundles(conn: &Connection) -> Result<Vec<CorpusBundle>> {
    let mut corpora_stmt = conn.prepare(
        "SELECT id, title, lang_code, script, target_lang, description
         FROM corpora
         ORDER BY rowid",
    )?;
    let corpora = corpora_stmt
        .query_map([], |row| {
            Ok(CorpusMeta {
                id: row.get(0)?,
                title: row.get(1)?,
                lang_code: row.get(2)?,
                script: row.get(3)?,
                target_lang: row.get(4)?,
                description: row.get(5)?,
            })
        })?
        .collect::<Result<Vec<_>>>()?;

    let mut bundles = Vec::with_capacity(corpora.len());
    for corpus in corpora {
        let mut vol_stmt = conn.prepare(
            "SELECT id, corpus_id, title, sort_order, level
             FROM volumes
             WHERE corpus_id = ?1
             ORDER BY sort_order, rowid",
        )?;
        let volumes = vol_stmt
            .query_map(params![&corpus.id], |row| {
                Ok(VolumeData {
                    id: row.get(0)?,
                    corpus_id: row.get(1)?,
                    title: row.get(2)?,
                    sort_order: row.get(3)?,
                    level: row.get(4)?,
                    entry_count: None,
                })
            })?
            .collect::<Result<Vec<_>>>()?;

        let mut les_stmt = conn.prepare(
            "SELECT l.id, l.volume_id, l.lesson_number, l.title, l.sort_order
             FROM lessons l
             INNER JOIN volumes v ON v.id = l.volume_id
             WHERE v.corpus_id = ?1
             ORDER BY l.sort_order, l.lesson_number, l.rowid",
        )?;
        let lessons = les_stmt
            .query_map(params![&corpus.id], |row| {
                Ok(LessonData {
                    id: row.get(0)?,
                    volume_id: row.get(1)?,
                    lesson_number: row.get(2)?,
                    title: row.get(3)?,
                    sort_order: row.get(4)?,
                    entry_count: None,
                })
            })?
            .collect::<Result<Vec<_>>>()?;

        let mut entry_stmt = conn.prepare(
            "SELECT id, corpus_id, volume_id, lesson_id, lemma_native, lemma_translit, pos, gender, grammar_metadata, definitions, tags, context_examples, dictionary_refs
             FROM entries
             WHERE corpus_id = ?1
             ORDER BY rowid",
        )?;
        let entries = entry_stmt
            .query_map(params![&corpus.id], |row| {
                let grammar_raw: Option<String> = row.get(8)?;
                let defs_raw: String = row.get(9)?;
                let tags_raw: Option<String> = row.get(10)?;
                let examples_raw: Option<String> = row.get(11)?;
                let dict_refs_raw: Option<String> = row.get(12)?;

                Ok(EntryData {
                    id: row.get(0)?,
                    corpus_id: row.get(1)?,
                    volume_id: row.get(2)?,
                    lesson_id: row.get(3)?,
                    lemma_native: row.get(4)?,
                    lemma_translit: row.get(5)?,
                    pos: row.get(6)?,
                    gender: row.get(7)?,
                    grammar_metadata: grammar_raw
                        .and_then(|s| serde_json::from_str(&s).ok()),
                    definitions: serde_json::from_str(&defs_raw).unwrap_or_default(),
                    tags: tags_raw.and_then(|s| serde_json::from_str(&s).ok()),
                    context_examples: examples_raw
                        .and_then(|s| serde_json::from_str(&s).ok()),
                    dictionary_refs: dict_refs_raw
                        .and_then(|s| serde_json::from_str(&s).ok()),
                })
            })?
            .collect::<Result<Vec<_>>>()?;

        bundles.push(CorpusBundle {
            corpus,
            volumes,
            lessons,
            entries,
        });
    }

    Ok(bundles)
}

pub fn query_study_queue(conn: &Connection, query: &StudyQueueQuery) -> Result<Vec<StudyCardItem>> {
    let mut sql = String::from(
        "SELECT e.id, e.corpus_id, e.volume_id, v.title, e.lesson_id,
                e.lemma_native, e.lemma_translit, e.pos, e.gender,
                e.definitions, e.tags,
                COALESCE(s.box_number, 1),
                COALESCE(s.interval_days, 1),
                COALESCE(s.consecutive_successes, 0),
                COALESCE(s.next_due, datetime('now')),
                s.user_note
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

    if query.shuffle.unwrap_or(false) {
        sql.push_str(" GROUP BY e.lemma_native ORDER BY RANDOM()");
    } else {
        sql.push_str(" GROUP BY e.lemma_native ORDER BY s.box_number ASC, s.next_due ASC");
    }

    if let Some(limit) = query.limit {
        if limit > 0 {
            sql.push_str(&format!(" LIMIT {}", limit));
        }
    }

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
            grammar_metadata: None,
            definitions: defs,
            tags,
            box_number: row.get(11)?,
            interval_days: row.get(12)?,
            consecutive_successes: row.get(13)?,
            next_due: row.get(14)?,
            user_note: row.get(15)?,
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn temp_db_path(name: &str) -> PathBuf {
        let mut p = std::env::temp_dir();
        p.push(format!("alexis_test_{name}_{}.db", std::process::id()));
        let _ = fs::remove_file(&p);
        p
    }

    #[test]
    fn update_entries_and_notes_roundtrip() {
        let db_path = temp_db_path("entries_notes");
        let mut conn = init_db(&db_path).expect("init_db");

        let bundle = CorpusBundle {
            corpus: CorpusMeta {
                id: "test-corpus".to_string(),
                title: "Test".to_string(),
                lang_code: "hi".to_string(),
                script: "Deva".to_string(),
                target_lang: "de".to_string(),
                description: None,
            },
            volumes: vec![VolumeData {
                id: "v1".to_string(),
                corpus_id: "test-corpus".to_string(),
                title: "Band 1".to_string(),
                sort_order: 1,
                level: Some("A1".to_string()),
                entry_count: None,
            }],
            lessons: vec![LessonData {
                id: "v1_l01".to_string(),
                volume_id: "v1".to_string(),
                lesson_number: 1,
                title: "Lektion 1".to_string(),
                sort_order: 1,
                entry_count: None,
            }],
            entries: vec![EntryData {
                id: "e1".to_string(),
                corpus_id: "test-corpus".to_string(),
                volume_id: "v1".to_string(),
                lesson_id: Some("v1_l01".to_string()),
                lemma_native: "दस".to_string(),
                lemma_translit: "das".to_string(),
                pos: Some("num".to_string()),
                gender: None,
                grammar_metadata: None,
                definitions: vec![EntryDefinition {
                    lang: "de".to_string(),
                    meaning: "zeihn".to_string(),
                    notes: None,
                }],
                tags: Some(vec!["zahlen".to_string(), "a1".to_string()]),
                context_examples: None,
                dictionary_refs: None,
            }],
        };

        let imported = import_bundle(&mut conn, &bundle).expect("import_bundle");
        assert_eq!(imported, 1);

        save_user_note(&conn, "e1", Some("  Grundzahl 10  ")).expect("save_user_note");

        // Patch definitions from "zeihn" to "zehn" while omitting tags (preserving existing tags)
        let updated = update_entries(
            &mut conn,
            &[EntryPatch {
                id: "e1".to_string(),
                lemma_native: "दस".to_string(),
                lemma_translit: "das".to_string(),
                pos: Some("num".to_string()),
                gender: None,
                definitions: Some(vec![EntryDefinition {
                    lang: "de".to_string(),
                    meaning: "zehn".to_string(),
                    notes: Some("Kardinalzahl".to_string()),
                }]),
                tags: None,
            }],
        )
        .expect("update_entries");
        assert_eq!(updated, 1);

        let queue = query_study_queue(
            &conn,
            &StudyQueueQuery {
                corpus_id: "test-corpus".to_string(),
                volume_ids: None,
                lesson_ids: None,
                tags: None,
                due_only: false,
                limit: None,
                shuffle: Some(false),
            },
        )
        .expect("query_study_queue");

        assert_eq!(queue.len(), 1);
        assert_eq!(queue[0].definitions[0].meaning, "zehn");
        assert_eq!(queue[0].definitions[0].notes.as_deref(), Some("Kardinalzahl"));
        assert_eq!(queue[0].tags, vec!["zahlen", "a1"]);
        assert_eq!(queue[0].user_note.as_deref(), Some("Grundzahl 10"));

        let exported = export_study_state(&conn).expect("export_study_state");
        assert!(exported.contains_key("e1"));

        let db_path_2 = temp_db_path("entries_notes_restore");
        let mut conn2 = init_db(&db_path_2).expect("init_db 2");
        import_bundle(&mut conn2, &bundle).expect("import_bundle 2");
        let restored = import_study_state(&mut conn2, &exported).expect("import_study_state");
        assert_eq!(restored, 1);

        let queue2 = query_study_queue(
            &conn2,
            &StudyQueueQuery {
                corpus_id: "test-corpus".to_string(),
                volume_ids: None,
                lesson_ids: None,
                tags: None,
                due_only: false,
                limit: None,
                shuffle: Some(false),
            },
        )
        .expect("query_study_queue 2");
        assert_eq!(queue2[0].user_note.as_deref(), Some("Grundzahl 10"));

        // Export bundles parity check
        let exported_bundles = export_all_bundles(&conn).expect("export_all_bundles");
        assert_eq!(exported_bundles.len(), 1);
        assert_eq!(exported_bundles[0].corpus.id, "test-corpus");
        assert_eq!(exported_bundles[0].entries.len(), 1);
        assert_eq!(exported_bundles[0].entries[0].definitions[0].meaning, "zehn");

        let _ = fs::remove_file(&db_path);
        let _ = fs::remove_file(&db_path_2);
    }

    #[test]
    fn rating_one_and_iso_next_due_roundtrip() {
        let db_path = temp_db_path("rating_one_iso");
        let mut conn = init_db(&db_path).expect("init_db");

        let bundle = CorpusBundle {
            corpus: CorpusMeta {
                id: "test-corpus".to_string(),
                title: "Test".to_string(),
                lang_code: "hi".to_string(),
                script: "Devanagari".to_string(),
                target_lang: "de".to_string(),
                description: None,
            },
            volumes: vec![VolumeData {
                id: "v1".to_string(),
                corpus_id: "test-corpus".to_string(),
                title: "Vol 1".to_string(),
                sort_order: 1,
                level: None,
                entry_count: None,
            }],
            lessons: vec![LessonData {
                id: "l1".to_string(),
                volume_id: "v1".to_string(),
                lesson_number: 1,
                title: "Lektion 1".to_string(),
                sort_order: 1,
                entry_count: None,
            }],
            entries: vec![EntryData {
                id: "e1".to_string(),
                corpus_id: "test-corpus".to_string(),
                volume_id: "v1".to_string(),
                lesson_id: Some("l1".to_string()),
                lemma_native: "एक".to_string(),
                lemma_translit: "ek".to_string(),
                pos: Some("num".to_string()),
                gender: None,
                grammar_metadata: None,
                definitions: vec![EntryDefinition {
                    lang: "de".to_string(),
                    meaning: "eins".to_string(),
                    notes: None,
                }],
                tags: None,
                context_examples: None,
                dictionary_refs: None,
            }],
        };

        import_bundle(&mut conn, &bundle).expect("import_bundle");

        // Rating 1 keeps card in Box 1 with 0 consecutive successes, increments review_count to 1
        let (new_box, new_interval, _) = record_review(
            &conn,
            &ReviewSubmission {
                entry_id: "e1".to_string(),
                rating: 1,
                duration_ms: Some(1200),
                direction: "native_to_target".to_string(),
            },
        )
        .expect("record_review");
        assert_eq!(new_box, 1);
        assert_eq!(new_interval, 1);

        let exported = export_study_state(&conn).expect("export_study_state");
        assert!(exported.contains_key("e1"));
        assert_eq!(
            exported["e1"].get("reviewCount").and_then(|v| v.as_i64()),
            Some(1)
        );

        let db_path_2 = temp_db_path("rating_one_iso_restore");
        let mut conn2 = init_db(&db_path_2).expect("init_db 2");
        import_bundle(&mut conn2, &bundle).expect("import_bundle 2");

        let mut states = serde_json::Map::new();
        states.insert(
            "e1".to_string(),
            serde_json::json!({
                "box": 1,
                "interval": 1,
                "successes": 0,
                "nextDue": "2026-11-26T14:30:00.000Z"
            }),
        );
        let restored = import_study_state(&mut conn2, &states).expect("import_study_state");
        assert_eq!(restored, 1);

        let (stored_due, stored_reviews): (String, i32) = conn2
            .query_row(
                "SELECT next_due, review_count FROM study_state WHERE entry_id = 'e1'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .expect("query restored study_state");
        assert_eq!(stored_due, "2026-11-26 14:30:00");
        assert_eq!(stored_reviews, 1);

        let reexported = export_study_state(&conn2).expect("reexport");
        assert!(reexported.contains_key("e1"));

        let _ = fs::remove_file(&db_path);
        let _ = fs::remove_file(&db_path_2);
    }
}
