import { isTauriEnvironment } from "./storage";

export type TransliterationScheme = "iast" | "hk" | "devanagari";

/**
 * Checks if the string contains Devanagari characters (\u0900-\u097F).
 */
export function containsDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

// ---------------------------------------------------------------------------
// Pure TypeScript Transliteration Engine (Browser / Fallback)
// ---------------------------------------------------------------------------

interface ScriptMapping {
  // Independent vowels
  vowels: [string, string][];
  // Dependent vowel signs (matras)
  matras: [string, string][];
  // Consonants (stem without implicit 'a')
  consonants: [string, string][];
  // Modifiers (anusvara, visarga, avagraha, etc.)
  modifiers: [string, string][];
}

const IAST_MAP: ScriptMapping = {
  vowels: [
    ["oṃ", "ॐ"],
    ["om", "ॐ"],
    ["aum", "ॐ"],
    ["ai", "ऐ"],
    ["au", "औ"],
    ["ā", "आ"],
    ["ī", "ई"],
    ["ū", "ऊ"],
    ["ṝ", "ॠ"],
    ["ḹ", "ॡ"],
    ["ṛ", "ऋ"],
    ["ḷ", "ऌ"],
    ["e", "ए"],
    ["o", "ओ"],
    ["a", "अ"],
    ["i", "इ"],
    ["u", "उ"],
  ],
  matras: [
    ["ai", "ै"],
    ["au", "ौ"],
    ["ā", "ा"],
    ["ī", "ी"],
    ["ū", "ू"],
    ["ṝ", "ॄ"],
    ["ḹ", "ॣ"],
    ["ṛ", "ृ"],
    ["ḷ", "ॢ"],
    ["e", "े"],
    ["o", "ो"],
    ["i", "ि"],
    ["u", "ु"],
  ],
  consonants: [
    ["kh", "ख"],
    ["gh", "घ"],
    ["ch", "छ"],
    ["jh", "झ"],
    ["ṭh", "ठ"],
    ["ḍh", "ढ"],
    ["th", "थ"],
    ["dh", "ध"],
    ["ph", "फ"],
    ["bh", "भ"],
    ["k", "क"],
    ["g", "ग"],
    ["ṅ", "ङ"],
    ["c", "च"],
    ["j", "ज"],
    ["ñ", "ञ"],
    ["ṭ", "ट"],
    ["ḍ", "ड"],
    ["ṇ", "ण"],
    ["t", "त"],
    ["d", "द"],
    ["n", "न"],
    ["p", "प"],
    ["b", "ब"],
    ["m", "म"],
    ["y", "य"],
    ["r", "र"],
    ["l", "ल"],
    ["v", "व"],
    ["ś", "श"],
    ["ṣ", "ष"],
    ["s", "स"],
    ["h", "ह"],
  ],
  modifiers: [
    ["ṃ", "ं"],
    ["ṁ", "ं"],
    ["ḥ", "ः"],
    ["'", "ऽ"],
    ["||", "॥"],
    ["|", "।"],
  ],
};

const HK_MAP: ScriptMapping = {
  vowels: [
    ["OM", "ॐ"],
    ["om", "ॐ"],
    ["ai", "ऐ"],
    ["au", "औ"],
    ["A", "आ"],
    ["I", "ई"],
    ["U", "ऊ"],
    ["RR", "ॠ"],
    ["lRR", "ॡ"],
    ["R", "ऋ"],
    ["lR", "ऌ"],
    ["e", "ए"],
    ["o", "ओ"],
    ["a", "अ"],
    ["i", "इ"],
    ["u", "उ"],
  ],
  matras: [
    ["ai", "ै"],
    ["au", "ौ"],
    ["A", "ा"],
    ["I", "ी"],
    ["U", "ू"],
    ["RR", "ॄ"],
    ["lRR", "ॣ"],
    ["R", "ृ"],
    ["lR", "ॢ"],
    ["e", "े"],
    ["o", "ो"],
    ["i", "ि"],
    ["u", "ु"],
  ],
  consonants: [
    ["kh", "ख"],
    ["gh", "घ"],
    ["ch", "छ"],
    ["jh", "झ"],
    ["Th", "ठ"],
    ["Dh", "ढ"],
    ["th", "थ"],
    ["dh", "ध"],
    ["ph", "फ"],
    ["bh", "भ"],
    ["k", "क"],
    ["g", "ग"],
    ["G", "ङ"],
    ["c", "च"],
    ["j", "ज"],
    ["J", "ञ"],
    ["T", "ट"],
    ["D", "ड"],
    ["N", "ण"],
    ["t", "त"],
    ["d", "द"],
    ["n", "न"],
    ["p", "प"],
    ["b", "ब"],
    ["m", "म"],
    ["y", "य"],
    ["r", "र"],
    ["l", "ल"],
    ["v", "व"],
    ["z", "श"],
    ["S", "ष"],
    ["s", "स"],
    ["h", "ह"],
  ],
  modifiers: [
    ["M", "ं"],
    ["H", "ः"],
    ["'", "ऽ"],
    ["||", "॥"],
    ["|", "।"],
  ],
};

/**
 * Transliterates Roman (IAST / HK) into Devanagari using phoneme parsing.
 */
function romanToDevanagari(text: string, mapping: ScriptMapping): string {
  let result = "";
  let i = 0;
  const len = text.length;

  while (i < len) {
    // 1. Modifiers
    let matchedMod = false;
    for (const [rom, dev] of mapping.modifiers) {
      if (text.startsWith(rom, i)) {
        result += dev;
        i += rom.length;
        matchedMod = true;
        break;
      }
    }
    if (matchedMod) continue;

    // 2. Consonants
    let matchedCons = false;
    for (const [rom, dev] of mapping.consonants) {
      if (text.startsWith(rom, i)) {
        i += rom.length;
        matchedCons = true;

        // Check following vowel
        let matchedVowel = false;
        // Check for 'a' (inherent vowel)
        if (text.startsWith("a", i)) {
          // If followed by 'i' (ai) or 'u' (au)
          if (text.startsWith("ai", i) || text.startsWith("au", i)) {
            for (const [vRom, vMatra] of mapping.matras) {
              if (text.startsWith(vRom, i)) {
                result += dev + vMatra;
                i += vRom.length;
                matchedVowel = true;
                break;
              }
            }
          } else {
            // plain 'a', inherent vowel -> consonant alone without virama
            result += dev;
            i += 1;
            matchedVowel = true;
          }
        } else {
          // Check for other matras
          for (const [vRom, vMatra] of mapping.matras) {
            if (text.startsWith(vRom, i)) {
              result += dev + vMatra;
              i += vRom.length;
              matchedVowel = true;
              break;
            }
          }
        }

        if (!matchedVowel) {
          // Consonant without vowel -> apply virama (्)
          result += `${dev}्`;
        }
        break;
      }
    }
    if (matchedCons) continue;

    // 3. Independent Vowels
    let matchedIndepVowel = false;
    for (const [rom, dev] of mapping.vowels) {
      if (text.startsWith(rom, i)) {
        result += dev;
        i += rom.length;
        matchedIndepVowel = true;
        break;
      }
    }
    if (matchedIndepVowel) continue;

    // 4. Any other character (space, punctuation, digits)
    result += text[i];
    i++;
  }

  return result;
}

/**
 * Transliterates Devanagari into Roman (IAST / HK).
 */
function devanagariToRoman(text: string, mapping: ScriptMapping): string {
  // Invert mappings
  const devToCons: Record<string, string> = {};
  for (const [rom, dev] of mapping.consonants) {
    devToCons[dev] = rom;
  }

  const devToMatra: Record<string, string> = {};
  for (const [rom, dev] of mapping.matras) {
    devToMatra[dev] = rom;
  }

  const devToVowel: Record<string, string> = {};
  for (const [rom, dev] of mapping.vowels) {
    devToVowel[dev] = rom;
  }

  const devToMod: Record<string, string> = {};
  for (const [rom, dev] of mapping.modifiers) {
    devToMod[dev] = rom;
  }

  let result = "";
  const chars = Array.from(text);
  const len = chars.length;
  let i = 0;

  while (i < len) {
    const ch = chars[i];

    // Modifiers
    if (devToMod[ch]) {
      result += devToMod[ch];
      i++;
      continue;
    }

    // Independent Vowels
    if (devToVowel[ch]) {
      result += devToVowel[ch];
      i++;
      continue;
    }

    // Consonants
    if (devToCons[ch]) {
      const romCons = devToCons[ch];
      const nextCh = i + 1 < len ? chars[i + 1] : "";

      if (nextCh === "्") {
        // Virama: half consonant without 'a'
        result += romCons;
        i += 2; // skip consonant and virama
      } else if (devToMatra[nextCh]) {
        // Followed by matra
        result += romCons + devToMatra[nextCh];
        i += 2; // skip consonant and matra
      } else {
        // Inherent 'a'
        result += `${romCons}a`;
        i++;
      }
      continue;
    }

    // Direct pass-through
    result += ch;
    i++;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Unified Public API with Tauri Acceleration & Web Fallback
// ---------------------------------------------------------------------------

/**
 * Synchronous in-memory conversions for fast Vue computed filters
 */
export function hkToDevanagariSync(text: string): string {
  if (!text) return "";
  return romanToDevanagari(text, HK_MAP);
}

export function devanagariToHkSync(text: string): string {
  if (!text) return "";
  return devanagariToRoman(text, HK_MAP);
}

export function iastToDevanagariSync(text: string): string {
  if (!text) return "";
  return romanToDevanagari(text, IAST_MAP);
}

export function devanagariToIastSync(text: string): string {
  if (!text) return "";
  return devanagariToRoman(text, IAST_MAP);
}

/**
 * Converts IAST to Devanagari.
 */
export async function iastToDevanagari(text: string): Promise<string> {
  if (!text) return "";
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<string>("transliterate", {
        text,
        from: "iast",
        to: "devanagari",
      });
    } catch {
      // fallback to JS
    }
  }
  return romanToDevanagari(text, IAST_MAP);
}

/**
 * Converts Devanagari to IAST.
 */
export async function devanagariToIast(text: string): Promise<string> {
  if (!text) return "";
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<string>("transliterate", {
        text,
        from: "devanagari",
        to: "iast",
      });
    } catch {
      // fallback to JS
    }
  }
  return devanagariToRoman(text, IAST_MAP);
}

/**
 * Converts Harvard-Kyoto (HK) to Devanagari.
 */
export async function hkToDevanagari(text: string): Promise<string> {
  if (!text) return "";
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<string>("transliterate", {
        text,
        from: "hk",
        to: "devanagari",
      });
    } catch {
      // fallback to JS
    }
  }
  return romanToDevanagari(text, HK_MAP);
}

/**
 * Converts Devanagari to Harvard-Kyoto (HK).
 */
export async function devanagariToHk(text: string): Promise<string> {
  if (!text) return "";
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<string>("transliterate", {
        text,
        from: "devanagari",
        to: "hk",
      });
    } catch {
      // fallback to JS
    }
  }
  return devanagariToRoman(text, HK_MAP);
}

/**
 * Converts IAST directly to Harvard-Kyoto (HK).
 */
export function iastToHk(text: string): string {
  const deva = romanToDevanagari(text, IAST_MAP);
  return devanagariToRoman(deva, HK_MAP);
}

/**
 * Converts Harvard-Kyoto (HK) directly to IAST.
 */
export function hkToIast(text: string): string {
  const deva = romanToDevanagari(text, HK_MAP);
  return devanagariToRoman(deva, IAST_MAP);
}

/**
 * Smart bidirectional toggle (IAST <-> Devanagari or HK <-> Devanagari).
 */
export async function toggleTransliteration(
  text: string,
  scheme: "iast" | "hk" = "iast",
): Promise<string> {
  if (!text) return "";
  if (containsDevanagari(text)) {
    return scheme === "hk"
      ? await devanagariToHk(text)
      : await devanagariToIast(text);
  }
  return scheme === "hk"
    ? await hkToDevanagari(text)
    : await iastToDevanagari(text);
}
