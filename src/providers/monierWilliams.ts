import {
  containsDevanagari,
  devanagariToIast,
  hkToIast,
  iastToHk,
  isHarvardKyotoInput,
} from "../services/transliteration";
import type { DictionaryProvider, DictionaryResult } from "../types";

interface CologneDictSpec {
  code: "mw" | "pw";
  label: string;
  linkLabel: string;
  searchMaskUrl: string;
  searchMaskLabel: string;
}

const COLOGNE_DICTS: CologneDictSpec[] = [
  {
    code: "mw",
    label: "Monier-Williams (1899, EN)",
    linkLabel: "↗ Vollständigen Artikel im Cologne MW öffnen",
    searchMaskUrl:
      "https://www.sanskrit-lexicon.uni-koeln.de/scans/MWScan/2020/web/webtc/indexcaller.php",
    searchMaskLabel: "↗ Suchmaske Cologne MW öffnen",
  },
  {
    code: "pw",
    label: "Böhtlingk Petersburger Wörterbuch (DE)",
    linkLabel: "↗ Vollständigen Artikel im Cologne PW öffnen",
    searchMaskUrl:
      "https://www.sanskrit-lexicon.uni-koeln.de/scans/PWScan/2020/web/webtc/indexcaller.php",
    searchMaskLabel: "↗ Suchmaske Cologne PW öffnen",
  },
];

const IAST_TO_SLP1_DIGRAPHS: [string, string][] = [
  ["kh", "K"],
  ["gh", "G"],
  ["ch", "C"],
  ["jh", "J"],
  ["ṭh", "W"],
  ["ḍh", "Q"],
  ["th", "T"],
  ["dh", "D"],
  ["ph", "P"],
  ["bh", "B"],
  ["ai", "E"],
  ["au", "O"],
];

const IAST_TO_SLP1_CHARS: Record<string, string> = {
  ā: "A",
  ī: "I",
  ū: "U",
  ṛ: "f",
  ṝ: "F",
  ḷ: "x",
  ḹ: "X",
  ṃ: "M",
  ṁ: "M",
  ḥ: "H",
  ṅ: "N",
  ñ: "Y",
  ṭ: "w",
  ḍ: "q",
  ṇ: "R",
  ś: "S",
  ṣ: "z",
};

export function iastToSlp1(iast: string): string {
  let out = iast.toLowerCase();
  for (const [src, dst] of IAST_TO_SLP1_DIGRAPHS) {
    out = out.replaceAll(src, dst);
  }
  return Array.from(out)
    .map((ch) => IAST_TO_SLP1_CHARS[ch] ?? ch)
    .join("");
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function extractCologneSummary(html: string): string | null {
  if (/<h2>\s*not found:/i.test(html)) {
    return null;
  }
  const ogMatch = html.match(
    /<meta\s+property=["']og:description["']\s+content=["']([^"']*)["']/i,
  );
  if (ogMatch?.[1]) {
    const cleaned = decodeHtmlEntities(ogMatch[1]).replace(/\s+/g, " ").trim();
    if (cleaned) return cleaned;
  }
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const target = bodyMatch ? bodyMatch[1] : html;
  const text = decodeHtmlEntities(target.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

async function fetchCologneEntry(
  spec: CologneDictSpec,
  rawQuery: string,
  slp1Key: string,
): Promise<DictionaryResult> {
  const apiUrl = `https://www.sanskrit-lexicon.uni-koeln.de/scans/csl-apidev/getword.php?dict=${spec.code}&key=${encodeURIComponent(slp1Key)}&input=slp1&output=deva`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`Cologne API status ${response.status}`);
    }
    const html = await response.text();
    const summary = extractCologneSummary(html);
    if (summary) {
      return {
        source: spec.label,
        headword: rawQuery,
        transliteration: slp1Key !== rawQuery ? `SLP1: ${slp1Key}` : undefined,
        definitions: [summary],
        externalUrl: apiUrl,
        externalLabel: spec.linkLabel,
      };
    }
    return {
      source: spec.label,
      headword: rawQuery,
      transliteration: slp1Key !== rawQuery ? `SLP1: ${slp1Key}` : undefined,
      definitions: [
        `Kein direkter Treffer für „${rawQuery}“ (${slp1Key}). In der Suchmaske weiter recherchieren.`,
      ],
      externalUrl: spec.searchMaskUrl,
      externalLabel: spec.searchMaskLabel,
    };
  } catch {
    return {
      source: spec.label,
      headword: rawQuery,
      transliteration: slp1Key !== rawQuery ? `SLP1: ${slp1Key}` : undefined,
      definitions: ["Suchmaske im Cologne Sanskrit Lexicon öffnen."],
      externalUrl: spec.searchMaskUrl,
      externalLabel: spec.searchMaskLabel,
    };
  }
}

export class MonierWilliamsProvider implements DictionaryProvider {
  id = "monier-williams";
  name = "Sanskrit-Wörterbücher (MW, PW, DCS, NWS)";
  supportedLanguages = ["sa"];

  async lookup(query: string): Promise<DictionaryResult[]> {
    const rawQuery = query.trim();
    if (!rawQuery) return [];

    let iastQuery = rawQuery.toLowerCase();
    if (containsDevanagari(rawQuery)) {
      iastQuery = await devanagariToIast(rawQuery);
    } else if (isHarvardKyotoInput(rawQuery, true)) {
      iastQuery = hkToIast(rawQuery);
    }
    const slp1Key = iastToSlp1(iastQuery);
    const hkQuery = iastToHk(iastQuery);

    const cologneResults = await Promise.all(
      COLOGNE_DICTS.map((spec) => fetchCologneEntry(spec, rawQuery, slp1Key)),
    );

    const externalPortalsResult: DictionaryResult = {
      source: "Weitere Sanskrit-Portale",
      headword: iastQuery,
      definitions: [
        "Korpusbelege und Nachträge in externen Fachportalen nachschlagen:",
      ],
      externalLinks: [
        {
          label: "↗ DCS (Digital Corpus of Sanskrit)",
          url: `https://www.sanskrit-linguistics.org/dcs/index.php?contents=abfrage&word=${encodeURIComponent(iastQuery)}&query_type=1&sort_by=alpha`,
        },
        {
          label: "↗ NWS Halle (Nachtragswörterbuch)",
          url: `https://nws.uzi.uni-halle.de/search?q=${encodeURIComponent(hkQuery)}&lang=de`,
        },
      ],
    };

    return [...cologneResults, externalPortalsResult];
  }
}
