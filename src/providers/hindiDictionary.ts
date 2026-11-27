import {
  containsDevanagari,
  devanagariHindiToIastSync,
  hkToDevanagari,
  hkToIast,
  iastToDevanagari,
  isHarvardKyotoInput,
} from "../services/transliteration";
import type {
  DictionaryLink,
  DictionaryProvider,
  DictionaryResult,
} from "../types";

interface WiktionaryDefinitionItem {
  definition?: string;
  examples?: string[];
}

interface WiktionaryEntry {
  partOfSpeech?: string;
  language?: string;
  definitions?: WiktionaryDefinitionItem[];
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function resolveDevanagariQuery(raw: string): Promise<string> {
  const clean = raw.trim();
  if (!clean || containsDevanagari(clean)) {
    return clean;
  }
  const deva = isHarvardKyotoInput(clean, false)
    ? await hkToDevanagari(clean)
    : await iastToDevanagari(clean.toLowerCase());
  // Hindi schwa-deletion: strip trailing virama at word boundaries
  return deva.replace(/\u094d(?=\s|$)/gu, "");
}

async function resolveIastQuery(raw: string): Promise<string> {
  const clean = raw.trim();
  if (!clean) return clean;
  if (containsDevanagari(clean)) {
    return devanagariHindiToIastSync(clean);
  }
  return isHarvardKyotoInput(clean, false)
    ? hkToIast(clean)
    : clean.toLowerCase();
}

function buildExternalLinks(
  devaQuery: string,
  iastQuery: string,
  rawQuery: string,
): DictionaryLink[] {
  const dsalDeva = devaQuery || rawQuery;
  const plattsTerm = iastQuery || rawQuery;
  return [
    {
      label: "↗ McGregor (Oxford Hindi-English, DSAL)",
      url: `https://dsal.uchicago.edu/cgi-bin/app/mcgregor_query.py?qs=${encodeURIComponent(dsalDeva)}&matchtype=default`,
    },
    {
      label: "↗ Platts (Classical Hindi & Urdu, DSAL)",
      url: `https://dsal.uchicago.edu/cgi-bin/app/platts_query.py?qs=${encodeURIComponent(plattsTerm)}&matchtype=default`,
    },
    {
      label: "↗ Wiktionary (Hindi)",
      url: `https://en.wiktionary.org/wiki/${encodeURIComponent(dsalDeva)}#Hindi`,
    },
  ];
}

export class HindiDictionaryProvider implements DictionaryProvider {
  id = "hindi-wiktionary-dsal";
  name = "Hindi-Wörterbuch (Wiktionary & DSAL McGregor / Platts)";
  supportedLanguages = ["hi"];

  async lookup(query: string): Promise<DictionaryResult[]> {
    const rawQuery = query.trim();
    if (!rawQuery) return [];

    const devaQuery = await resolveDevanagariQuery(rawQuery);
    const iastQuery = await resolveIastQuery(rawQuery);
    const externalLinks = buildExternalLinks(devaQuery, iastQuery, rawQuery);
    const translitLabel =
      devaQuery && devaQuery !== rawQuery ? rawQuery : undefined;

    try {
      const apiUrl = `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(devaQuery)}`;
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`Wiktionary API status ${response.status}`);
      }

      const data = (await response.json()) as Record<string, WiktionaryEntry[]>;
      const hiEntries = data.hi ?? [];
      const definitions: string[] = [];

      for (const entry of hiEntries) {
        const pos = entry.partOfSpeech ? `[${entry.partOfSpeech}] ` : "";
        for (const item of entry.definitions ?? []) {
          const text = stripHtml(item.definition ?? "");
          if (text) {
            definitions.push(`${pos}${text}`);
          }
          if (definitions.length >= 8) break;
        }
        if (definitions.length >= 8) break;
      }

      if (definitions.length > 0) {
        return [
          {
            source: "Wiktionary (hi) + DSAL",
            headword: devaQuery,
            transliteration: translitLabel,
            definitions,
            externalLinks,
          },
        ];
      }

      return [
        {
          source: "DSAL (McGregor / Platts)",
          headword: devaQuery,
          transliteration: translitLabel,
          definitions: [
            `Kein direkter Hindi-Eintrag in Wiktionary für „${devaQuery}“ gefunden. Nutze die Direktlinks zu McGregor und Platts (DSAL).`,
          ],
          externalLinks,
        },
      ];
    } catch {
      return [
        {
          source: "DSAL (McGregor / Platts)",
          headword: devaQuery,
          transliteration: translitLabel,
          definitions: [
            "Online-Suche direkt über die akademischen Wörterbücher der University of Chicago (DSAL) verfügbar.",
          ],
          externalLinks,
        },
      ];
    }
  }
}
