#!/usr/bin/env node
/**
 * test-iast.mjs
 * Regression tests for Alexis Devanāgarī <-> IAST core (Sanskrit 1:1, Hindi schwa/Nukta,
 * morphology paradigms, and unified strict IAST anusvāra ṃ).
 * Compatible with Node 20+ by transpiling src/services/iastCore.ts in memory via typescript.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

const coreSource = fs.readFileSync(
  path.join(ROOT_DIR, "src", "services", "iastCore.ts"),
  "utf8",
);
const compiled = ts.transpileModule(coreSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

const {
  containsDevanagari,
  segmentDevanagariForRuby,
  transliterateDevanagariText,
  transliterateDevanagariToIast,
} = await import(
  `data:text/javascript;base64,${Buffer.from(compiled, "utf8").toString("base64")}`
);

const sanskritCases = [
  ["संस्कृतम्", "saṃskṛtam"],
  ["सिन्धु", "sindhu"],
  ["भारतम्", "bhāratam"],
  ["अन्वेषणम्", "anveṣaṇam"],
  ["सङ्ग्रहः", "saṅgrahaḥ"],
  ["प्रथमः", "prathamaḥ"],
  ["यवनाः", "yavanāḥ"],
  ["खरोष्ठी", "kharoṣṭhī"],
  ["२०२६", "2026"],
  ["ॐ", "oṃ"],
];

for (const [input, expected] of sanskritCases) {
  assert.equal(
    transliterateDevanagariToIast(input, "sa"),
    expected,
    `Sanskrit failed for ${input}`,
  );
}

const hindiCases = [
  ["भारत", "bhārat"],
  ["कमल", "kamal"],
  ["अपना", "apnā"],
  ["अचानक", "acānak"],
  ["करना", "karnā"],
  ["समझना", "samajhnā"],
  ["समझा", "samjhā"],
  ["असमर्थ", "asamarth"],
  ["अध्ययनों", "adhyayanoṃ"],
  ["उपयोग", "upyog"],
  ["अनपढ़", "anpaṛh"],
  ["हड़प्पा", "haṛappā"],
  ["ग़ज़ल", "ġazal"],
  ["क़ानून", "qānūn"],
  ["\u0958ानून", "qānūn"],
  ["ल\u095Cका", "laṛkā"],
  ["\u095Cका", "ṛakā"],
  ["\u0929\u0931\u0934", "ṉaṟaḻ"],
  ["ख़ुश", "ḵhuś"],
  ["फ़ौज", "fauj"],
  ["खोजें", "khojeṃ"],
  ["लड़का", "laṛkā"],
  ["लड़कों", "laṛkoṃ"],
  ["किताबें", "kitābeṃ"],
  ["किताबों", "kitāboṃ"],
  ["अध्यापक", "adhyāpak"],
  ["घर", "ghar"],
  ["घरों", "gharoṃ"],
  ["करता", "kartā"],
  ["जाते", "jāte"],
  ["आदमियों", "ādmiyoṃ"],
  ["लड़कियों", "laṛkiyoṃ"],
  ["शब्द", "śabda"],
  ["क्षेत्र", "kṣetra"],
  ["संदर्भ", "saṃdarbh"],
];

for (const [input, expected] of hindiCases) {
  assert.equal(
    transliterateDevanagariToIast(input, "hi"),
    expected,
    `Hindi failed for ${input}`,
  );
}

assert.equal(
  transliterateDevanagariText("भारत में लड़कों की किताबें।", "hi"),
  "bhārat meṃ laṛkoṃ kī kitābeṃ।",
  "Multi-word Hindi transliteration failed",
);
assert.equal(
  transliterateDevanagariText("धर्मः क्षेत्रे — Kurukṣetra", "sa"),
  "dharmaḥ kṣetre — Kurukṣetra",
  "Multi-word Sanskrit transliteration failed",
);
assert.deepEqual(
  segmentDevanagariForRuby("भारत में (India)।", "hi"),
  [
    { text: "भारत", iast: "bhārat" },
    { text: " " },
    { text: "में", iast: "meṃ" },
    { text: " (India)।" },
  ],
  "Hindi ruby segmentation failed",
);
assert.deepEqual(
  segmentDevanagariForRuby("धर्मः क्षेत्रे", "sa"),
  [
    { text: "धर्मः", iast: "dharmaḥ" },
    { text: " " },
    { text: "क्षेत्रे", iast: "kṣetre" },
  ],
  "Sanskrit ruby segmentation failed",
);
assert.equal(containsDevanagari("Steppe_MLBA"), false);
assert.equal(containsDevanagari("क़ानून"), true);

const morphSrc = fs.readFileSync(
  path.join(ROOT_DIR, "src", "services", "hindiMorphology.ts"),
  "utf8",
);
assert.equal(
  morphSrc.includes("ṁ"),
  false,
  "hindiMorphology.ts still contains non-standard ṁ; expected strict IAST ṃ",
);

console.log("=== Alexis IAST Transliteration Tests ===");
console.log(`Sanskrit assertions: ${sanskritCases.length}`);
console.log(`Hindi assertions:    ${hindiCases.length}`);
console.log("✓ All Alexis IAST, Nukta, and morphology checks passed.");
