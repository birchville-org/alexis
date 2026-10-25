import type { DictionaryProvider, DictionaryResult } from "../types";

export class MonierWilliamsProvider implements DictionaryProvider {
  id = "monier-williams";
  name = "Monier-Williams Sanskrit-English Dictionary (1899)";
  supportedLanguages = ["sa"];

  /**
   * Search headword in Cologne Digital Sanskrit Dictionaries
   */
  async lookup(query: string): Promise<DictionaryResult[]> {
    const cleanQuery = query.trim().toLowerCase();
    const externalUrl = `https://www.sanskrit-lexicon.uni-koeln.de/scans/csl-apidev/servepdf.php?dict=mw&key=${encodeURIComponent(cleanQuery)}`;

    try {
      // Cologne API endpoint for MW
      const apiUrl = `https://www.sanskrit-lexicon.uni-koeln.de/scans/csldev/csldoc/sample/getword.php?dict=mw&key=${encodeURIComponent(cleanQuery)}&input=slp1&output=deva`;
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`Cologne API status ${response.status}`);
      }

      const raw = await response.text();
      return [
        {
          source: "Monier-Williams (1899)",
          headword: query,
          definitions: [raw.replace(/<[^>]+>/g, " ").trim()],
          externalUrl,
        },
      ];
    } catch {
      // Fallback: direct portal link
      return [
        {
          source: "Monier-Williams (1899)",
          headword: query,
          definitions: ["Online search available at Cologne Sanskrit Lexicon"],
          externalUrl,
        },
      ];
    }
  }
}
