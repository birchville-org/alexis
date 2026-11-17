import { iastToSlp1 } from "../providers/monierWilliams";
import type { StudyCardItem } from "../types";
import { devanagariToIastSync } from "./transliteration";

export type AuditIssueType =
  | "not_found"
  | "pos_mismatch"
  | "gender_missing"
  | "translit_mismatch";

export interface AuditFinding {
  entryId: string;
  lemmaNative: string;
  lemmaTranslit: string;
  currentPos?: string | null;
  currentGender?: string | null;
  issueType: AuditIssueType;
  message: string;
  suggestedTranslit?: string;
  suggestedPos?: string;
  suggestedGender?: string;
  lookupUrl: string;
  lookupLabel: string;
}

export interface AuditOptions {
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

const WIKTIONARY_POS_MAP: Record<string, string> = {
  noun: "noun",
  verb: "verb",
  adjective: "adj",
  adverb: "adv",
  pronoun: "pron",
  postposition: "postp",
  conjunction: "conj",
  particle: "part",
  interjection: "interj",
  numeral: "num",
};

const POS_CANON_MAP: Record<string, string> = {
  subst: "noun",
  konj: "conj",
  ptk: "part",
};

function canonicalPos(pos?: string | null): string {
  const lower = (pos ?? "").toLowerCase().trim();
  return POS_CANON_MAP[lower] ?? lower;
}

function normalizeLookupHeadword(raw: string): string {
  return raw
    .replace(/\s*\([^)]*\)/g, "")
    .split(/[\/,;]/)[0]
    .replace(/[।|?!.,]+$/g, "")
    .trim();
}

function isSimpleSingleWord(text: string): boolean {
  const t = text.trim();
  return Boolean(t) && !/[\s\/,;()\-]/.test(t);
}

const HINDI_REQUIRED_MARKERS: Array<[RegExp, RegExp, string]> = [
  [/[ाआ]/, /ā/i, "Langes ā (ा/आ)"],
  [/[ीई]/, /ī/i, "Langes ī (ी/ई)"],
  [/[ूऊ]/, /ū/i, "Langes ū (ू/ऊ)"],
  [/क़/, /q/i, "Nukta q (क़)"],
  [/ग़/, /ġ/i, "Nukta ġ (ग़)"],
  [/ज़/, /z/i, "Nukta z (ज़)"],
  [/फ़/, /f/i, "Nukta f (फ़)"],
];

function stripHindiFinalSchwa(iast: string): string {
  return iast.replace(/([bcdfghjklmnpqrstvwxyzṅñṭḍṇśṣġ])a(?=\s|$)/giu, "$1");
}

async function auditHindiEntry(
  entry: StudyCardItem,
  signal?: AbortSignal,
): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];
  const headword = normalizeLookupHeadword(entry.lemma_native);
  if (!headword) return findings;

  const mcgregorUrl = `https://dsal.uchicago.edu/cgi-bin/app/mcgregor_query.py?qs=${encodeURIComponent(headword)}&searchhws=yes`;

  const rawTranslit = entry.lemma_translit?.trim() ?? "";
  if (!rawTranslit) {
    const derivedIast = stripHindiFinalSchwa(
      devanagariToIastSync(entry.lemma_native.trim()),
    );
    findings.push({
      entryId: entry.entry_id,
      lemmaNative: entry.lemma_native,
      lemmaTranslit: entry.lemma_translit,
      currentPos: entry.pos,
      currentGender: entry.gender,
      issueType: "translit_mismatch",
      message: `Umschrift fehlt (Vorschlag: „${derivedIast}“).`,
      suggestedTranslit: derivedIast,
      lookupUrl: mcgregorUrl,
      lookupLabel: "↗ McGregor (DSAL)",
    });
  } else {
    const missingMarkers = HINDI_REQUIRED_MARKERS.filter(
      ([devaRe, iastRe]) =>
        devaRe.test(entry.lemma_native) && !iastRe.test(rawTranslit),
    ).map(([, , label]) => label);

    if (missingMarkers.length > 0) {
      findings.push({
        entryId: entry.entry_id,
        lemmaNative: entry.lemma_native,
        lemmaTranslit: entry.lemma_translit,
        currentPos: entry.pos,
        currentGender: entry.gender,
        issueType: "translit_mismatch",
        message: `Umschrift „${rawTranslit}“ fehlt: ${missingMarkers.join(", ")}.`,
        lookupUrl: mcgregorUrl,
        lookupLabel: "↗ McGregor (DSAL)",
      });
    }
  }

  try {
    const res = await fetch(
      `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(headword)}`,
      { signal },
    );
    if (!res.ok) {
      findings.push({
        entryId: entry.entry_id,
        lemmaNative: entry.lemma_native,
        lemmaTranslit: entry.lemma_translit,
        currentPos: entry.pos,
        currentGender: entry.gender,
        issueType: "not_found",
        message: `„${headword}“ nicht in Wiktionary (hi) gefunden.`,
        lookupUrl: mcgregorUrl,
        lookupLabel: "↗ McGregor (DSAL)",
      });
      return findings;
    }

    const data = (await res.json()) as Record<
      string,
      Array<{ partOfSpeech?: string }>
    >;
    const hiEntries = data.hi ?? [];
    if (hiEntries.length === 0) {
      findings.push({
        entryId: entry.entry_id,
        lemmaNative: entry.lemma_native,
        lemmaTranslit: entry.lemma_translit,
        currentPos: entry.pos,
        currentGender: entry.gender,
        issueType: "not_found",
        message: `Kein Hindi-Abschnitt für „${headword}“ auf Wiktionary.`,
        lookupUrl: mcgregorUrl,
        lookupLabel: "↗ McGregor (DSAL)",
      });
      return findings;
    }

    const wikiPosList = hiEntries
      .map((e) => WIKTIONARY_POS_MAP[(e.partOfSpeech ?? "").toLowerCase()])
      .filter((v): v is string => Boolean(v));
    const currentPos = canonicalPos(entry.pos);

    if (
      wikiPosList.length > 0 &&
      currentPos &&
      !wikiPosList.includes(currentPos)
    ) {
      findings.push({
        entryId: entry.entry_id,
        lemmaNative: entry.lemma_native,
        lemmaTranslit: entry.lemma_translit,
        currentPos: entry.pos,
        currentGender: entry.gender,
        issueType: "pos_mismatch",
        message: `Wortart „${entry.pos}“ weicht von Wiktionary (${wikiPosList.join(", ")}) ab.`,
        suggestedPos: wikiPosList[0],
        lookupUrl: `https://en.wiktionary.org/wiki/${encodeURIComponent(headword)}#Hindi`,
        lookupLabel: "↗ Wiktionary",
      });
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
  }

  return findings;
}

async function auditSanskritEntry(
  entry: StudyCardItem,
  signal?: AbortSignal,
): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];
  const headword = normalizeLookupHeadword(entry.lemma_native);
  if (!headword) return findings;

  const derivedIast = devanagariToIastSync(headword);
  const cleanTranslit = normalizeLookupHeadword(entry.lemma_translit);
  const dcsUrl = `https://www.sanskrit-linguistics.org/dcs/index.php?contents=abfrage&word=${encodeURIComponent(cleanTranslit || derivedIast)}&query_type=1&sort_by=alpha`;

  if (
    isSimpleSingleWord(headword) &&
    (!cleanTranslit || cleanTranslit.toLowerCase() !== derivedIast)
  ) {
    findings.push({
      entryId: entry.entry_id,
      lemmaNative: entry.lemma_native,
      lemmaTranslit: entry.lemma_translit,
      currentPos: entry.pos,
      currentGender: entry.gender,
      issueType: "translit_mismatch",
      message: cleanTranslit
        ? `Umschrift „${entry.lemma_translit}“ weicht von „${derivedIast}“ ab.`
        : `Umschrift fehlt (Vorschlag: „${derivedIast}“).`,
      suggestedTranslit: derivedIast,
      lookupUrl: dcsUrl,
      lookupLabel: "↗ DCS",
    });
  }

  const slp1Key = iastToSlp1((cleanTranslit || derivedIast).toLowerCase());
  if (!slp1Key) return findings;

  try {
    const apiUrl = `https://www.sanskrit-lexicon.uni-koeln.de/scans/csl-apidev/getword.php?dict=mw&key=${encodeURIComponent(slp1Key)}&input=slp1&output=deva`;
    const res = await fetch(apiUrl, { signal });
    if (!res.ok) return findings;
    const html = await res.text();
    if (/<h2>\s*not found:/i.test(html)) {
      findings.push({
        entryId: entry.entry_id,
        lemmaNative: entry.lemma_native,
        lemmaTranslit: entry.lemma_translit,
        currentPos: entry.pos,
        currentGender: entry.gender,
        issueType: "not_found",
        message: `„${cleanTranslit || headword}“ (SLP1: ${slp1Key}) nicht direkt in Monier-Williams gefunden.`,
        lookupUrl: dcsUrl,
        lookupLabel: "↗ DCS",
      });
      return findings;
    }

    const ogMatch = html.match(
      /<meta\s+property=["']og:description["']\s+content=["']([^"']*)["']/i,
    );
    const summary = ogMatch?.[1] ?? "";
    if (canonicalPos(entry.pos) === "noun" && !entry.gender?.trim()) {
      const genderMatch = summary.match(/\b([mfn])\.\s/);
      if (genderMatch?.[1]) {
        findings.push({
          entryId: entry.entry_id,
          lemmaNative: entry.lemma_native,
          lemmaTranslit: entry.lemma_translit,
          currentPos: entry.pos,
          currentGender: entry.gender,
          issueType: "gender_missing",
          message: `Genus fehlt; Monier-Williams nennt „${genderMatch[1]}.“.`,
          suggestedGender: genderMatch[1],
          lookupUrl: apiUrl,
          lookupLabel: "↗ Cologne MW",
        });
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
  }

  return findings;
}

export async function auditEntriesOnline(
  entries: StudyCardItem[],
  isHindi: boolean,
  options: AuditOptions = {},
): Promise<AuditFinding[]> {
  const { signal, onProgress } = options;
  const total = entries.length;
  const allFindings: AuditFinding[] = [];
  let done = 0;
  const concurrency = 4;

  for (let i = 0; i < entries.length; i += concurrency) {
    if (signal?.aborted) break;
    const batch = entries.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((entry) =>
        isHindi
          ? auditHindiEntry(entry, signal)
          : auditSanskritEntry(entry, signal),
      ),
    );
    for (const items of batchResults) {
      allFindings.push(...items);
    }
    done += batch.length;
    onProgress?.(done, total);
  }

  return allFindings;
}
