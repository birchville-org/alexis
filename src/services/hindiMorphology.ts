export interface NounDeclensionRow {
  kasus: string;
  kasusHelp: string;
  sgNative: string;
  sgTranslit: string;
  plNative: string;
  plTranslit: string;
}

export interface HindiNounDeclension {
  declensionType: string;
  ruleExplanation: string;
  rows: NounDeclensionRow[];
  postpositionNote: string;
}

export interface HindiVerbParadigm {
  isTransitive: boolean;
  neBadge: string;
  neBadgeClass: "badge-transitive" | "badge-intransitive" | "badge-special";
  neExplanation: string;
  rootNative: string;
  rootTranslit: string;
  perfNative: string;
  perfTranslit: string;
  habitNative: string;
  habitTranslit: string;
  futNative: string;
  futTranslit: string;
  impNative: string;
  impTranslit: string;
}

/**
 * Returns a 3-case noun declension paradigm (Direktus, Obliquus, Vokativ)
 * for Hindi nouns based on gender and stem ending.
 */
export function getHindiNounDeclension(
  native: string,
  translit: string,
  genderInput?: string,
): HindiNounDeclension {
  const g = (genderInput || "m").toLowerCase();
  const isFem = g === "f" || g === "fem" || g.includes("fem");

  const cleanNative = native.trim();
  const cleanTranslit = translit.trim();

  const endsWithAaNative =
    cleanNative.endsWith("ा") || cleanNative.endsWith("आ");
  const endsWithAaTranslit =
    cleanTranslit.endsWith("ā") ||
    cleanTranslit.endsWith("aa") ||
    cleanTranslit.endsWith("a");

  const endsWithIiNative =
    cleanNative.endsWith("ी") || cleanNative.endsWith("ई");
  const endsWithIiTranslit =
    cleanTranslit.endsWith("ī") ||
    cleanTranslit.endsWith("ee") ||
    cleanTranslit.endsWith("i");

  const endsWithIyaNative = cleanNative.endsWith("िया");
  const endsWithIyaTranslit = cleanTranslit.endsWith("iyā");

  const endsWithUuNative = cleanNative.endsWith("ू") || cleanNative.endsWith("ु");
  const endsWithUuTranslit =
    cleanTranslit.endsWith("ū") ||
    cleanTranslit.endsWith("u") ||
    cleanTranslit.endsWith("oo");

  const postpositionNote =
    "Der Obliquus wird zwingend vor allen Postpositionen verwendet: को (ko), से (se), में (meṁ), पर (par), का/के/की (kā/ke/kī), ने (ne), लिए (lie).";

  // Invariable family terms on -ā that do not decline in Sg. Obl.
  const familyAaExceptions = [
    "पिता",
    "राजा",
    "चाचा",
    "दादा",
    "नाना",
    "मामा",
    "योद्धा",
    "नेता",
  ];
  const isFamilyException = familyAaExceptions.includes(cleanNative);

  if (!isFem) {
    // MASCULINE

    // 1. Marked masculine on -ā (Typ लड़का)
    if ((endsWithAaNative || endsWithAaTranslit) && !isFamilyException) {
      const stemN = endsWithAaNative ? cleanNative.slice(0, -1) : cleanNative;
      const stemT = cleanTranslit.replace(/[āa]$/, "");

      return {
        declensionType: "Maskulinum markiert auf -ā (लड़का-Typ)",
        ruleExplanation:
          "Endung -ā wechselt im Sg. Obliquus und im Pl. Direktus zu -e. Pl. Obliquus endet auf -oṁ.",
        postpositionNote,
        rows: [
          {
            kasus: "Direktus",
            kasusHelp: "Unmarkiertes Subjekt",
            sgNative: cleanNative,
            sgTranslit: cleanTranslit,
            plNative: `${stemN}े`,
            plTranslit: `${stemT}e`,
          },
          {
            kasus: "Obliquus",
            kasusHelp: "Vor Postpositionen [+ ko, se, meṁ...]",
            sgNative: `${stemN}े`,
            sgTranslit: `${stemT}e`,
            plNative: `${stemN}ों`,
            plTranslit: `${stemT}oṁ`,
          },
          {
            kasus: "Vokativ",
            kasusHelp: "Anrede",
            sgNative: `${stemN}े!`,
            sgTranslit: `${stemT}e!`,
            plNative: `${stemN}ो!`,
            plTranslit: `${stemT}o!`,
          },
        ],
      };
    }

    // 2. Marked family/invariable masculine on -ā (Typ पिता)
    if (isFamilyException) {
      const stemN = cleanNative;
      const stemT = cleanTranslit;
      return {
        declensionType: "Maskulinum Familie/Titel auf -ā (पिता/राजा-Typ)",
        ruleExplanation:
          "Familienbezeichnungen auf -ā bleiben im Sg. Obliquus und Pl. Direktus unverändert. Pl. Obliquus auf -āoṁ.",
        postpositionNote,
        rows: [
          {
            kasus: "Direktus",
            kasusHelp: "Unmarkiertes Subjekt",
            sgNative: cleanNative,
            sgTranslit: cleanTranslit,
            plNative: cleanNative,
            plTranslit: cleanTranslit,
          },
          {
            kasus: "Obliquus",
            kasusHelp: "Vor Postpositionen [+ ko, se, meṁ...]",
            sgNative: cleanNative,
            sgTranslit: cleanTranslit,
            plNative: `${stemN}ओं`,
            plTranslit: `${stemT}oṁ`,
          },
          {
            kasus: "Vokativ",
            kasusHelp: "Anrede",
            sgNative: `${cleanNative}!`,
            sgTranslit: `${cleanTranslit}!`,
            plNative: `${stemN}ओ!`,
            plTranslit: `${stemT}o!`,
          },
        ],
      };
    }

    // 3. Masculine on -ī (Typ आदमी)
    if (endsWithIiNative || endsWithIiTranslit) {
      const stemN = endsWithIiNative ? cleanNative.slice(0, -1) : cleanNative;
      const stemT = cleanTranslit.replace(/[īie]$/, "");
      return {
        declensionType: "Maskulinum unmarkiert auf -ī (आदमी-Typ)",
        ruleExplanation:
          "Bleibt im Sg. Obliquus und Pl. Direktus unverändert. Im Pl. Obliquus wird -ī verkürzt zu -iyoṁ.",
        postpositionNote,
        rows: [
          {
            kasus: "Direktus",
            kasusHelp: "Unmarkiertes Subjekt",
            sgNative: cleanNative,
            sgTranslit: cleanTranslit,
            plNative: cleanNative,
            plTranslit: cleanTranslit,
          },
          {
            kasus: "Obliquus",
            kasusHelp: "Vor Postpositionen [+ ko, se, meṁ...]",
            sgNative: cleanNative,
            sgTranslit: cleanTranslit,
            plNative: `${stemN}ियों`,
            plTranslit: `${stemT}iyoṁ`,
          },
          {
            kasus: "Vokativ",
            kasusHelp: "Anrede",
            sgNative: `${cleanNative}!`,
            sgTranslit: `${cleanTranslit}!`,
            plNative: `${stemN}ियो!`,
            plTranslit: `${stemT}iyo!`,
          },
        ],
      };
    }

    // 4. Masculine on -ū / -u (Typ चाकू)
    if (endsWithUuNative || endsWithUuTranslit) {
      const stemN = endsWithUuNative ? cleanNative.slice(0, -1) : cleanNative;
      const stemT = cleanTranslit.replace(/[ūu]$/, "");
      return {
        declensionType: "Maskulinum unmarkiert auf -ū (चाकू-Typ)",
        ruleExplanation:
          "Form bleibt im Sg. und Pl. Direktus gleich. Im Pl. Obliquus Verkürzung zu -uoṁ.",
        postpositionNote,
        rows: [
          {
            kasus: "Direktus",
            kasusHelp: "Unmarkiertes Subjekt",
            sgNative: cleanNative,
            sgTranslit: cleanTranslit,
            plNative: cleanNative,
            plTranslit: cleanTranslit,
          },
          {
            kasus: "Obliquus",
            kasusHelp: "Vor Postpositionen [+ ko, se, meṁ...]",
            sgNative: cleanNative,
            sgTranslit: cleanTranslit,
            plNative: `${stemN}ुओं`,
            plTranslit: `${stemT}uoṁ`,
          },
          {
            kasus: "Vokativ",
            kasusHelp: "Anrede",
            sgNative: `${cleanNative}!`,
            sgTranslit: `${cleanTranslit}!`,
            plNative: `${stemN}ुओ!`,
            plTranslit: `${stemT}uo!`,
          },
        ],
      };
    }

    // 5. Unmarked consonant masculine (Typ अध्यापक / घर)
    return {
      declensionType: "Maskulinum unmarkiert konsonantisch (घर/अध्यापक-Typ)",
      ruleExplanation:
        "Sg. Direktus, Sg. Obliquus und Pl. Direktus sind identisch. Pl. Obliquus endet auf -oṁ.",
      postpositionNote,
      rows: [
        {
          kasus: "Direktus",
          kasusHelp: "Unmarkiertes Subjekt",
          sgNative: cleanNative,
          sgTranslit: cleanTranslit,
          plNative: cleanNative,
          plTranslit: cleanTranslit,
        },
        {
          kasus: "Obliquus",
          kasusHelp: "Vor Postpositionen [+ ko, se, meṁ...]",
          sgNative: cleanNative,
          sgTranslit: cleanTranslit,
          plNative: `${cleanNative}ों`,
          plTranslit: `${cleanTranslit}oṁ`,
        },
        {
          kasus: "Vokativ",
          kasusHelp: "Anrede",
          sgNative: `${cleanNative}!`,
          sgTranslit: `${cleanTranslit}!`,
          plNative: `${cleanNative}ो!`,
          plTranslit: `${cleanTranslit}o!`,
        },
      ],
    };
  }

  // FEMININE

  // 1. Feminine on -iyā (Typ चिड़िया)
  if (endsWithIyaNative || endsWithIyaTranslit) {
    const stemN = cleanNative.slice(0, -1);
    const stemT = cleanTranslit.replace(/ā$/, "");
    return {
      declensionType: "Femininum auf -iyā (चिड़िया-Typ)",
      ruleExplanation:
        "Plural Direktus erhält Candrabindu (-iyā̃). Plural Obliquus auf -iyoṁ.",
      postpositionNote,
      rows: [
        {
          kasus: "Direktus",
          kasusHelp: "Unmarkiertes Subjekt",
          sgNative: cleanNative,
          sgTranslit: cleanTranslit,
          plNative: `${cleanNative}ँ`,
          plTranslit: `${cleanTranslit}̃`,
        },
        {
          kasus: "Obliquus",
          kasusHelp: "Vor Postpositionen [+ ko, se, meṁ...]",
          sgNative: cleanNative,
          sgTranslit: cleanTranslit,
          plNative: `${stemN}ों`,
          plTranslit: `${stemT}oṁ`,
        },
        {
          kasus: "Vokativ",
          kasusHelp: "Anrede",
          sgNative: `${cleanNative}!`,
          sgTranslit: `${cleanTranslit}!`,
          plNative: `${stemN}ो!`,
          plTranslit: `${stemT}o!`,
        },
      ],
    };
  }

  // 2. Feminine on -ī (Typ लड़की / अलमारी)
  if (endsWithIiNative || endsWithIiTranslit) {
    const stemN = endsWithIiNative ? cleanNative.slice(0, -1) : cleanNative;
    const stemT = cleanTranslit.replace(/[īi]$/, "");
    return {
      declensionType: "Femininum auf -ī (लड़की-Typ)",
      ruleExplanation:
        "Endung -ī verkürzt sich im Plural Direktus zu -iyā̃ und im Plural Obliquus zu -iyoṁ.",
      postpositionNote,
      rows: [
        {
          kasus: "Direktus",
          kasusHelp: "Unmarkiertes Subjekt",
          sgNative: cleanNative,
          sgTranslit: cleanTranslit,
          plNative: `${stemN}ियाँ`,
          plTranslit: `${stemT}iyā̃`,
        },
        {
          kasus: "Obliquus",
          kasusHelp: "Vor Postpositionen [+ ko, se, meṁ...]",
          sgNative: cleanNative,
          sgTranslit: cleanTranslit,
          plNative: `${stemN}ियों`,
          plTranslit: `${stemT}iyoṁ`,
        },
        {
          kasus: "Vokativ",
          kasusHelp: "Anrede",
          sgNative: `${cleanNative}!`,
          sgTranslit: `${cleanTranslit}!`,
          plNative: `${stemN}ियो!`,
          plTranslit: `${stemT}iyo!`,
        },
      ],
    };
  }

  // 3. Feminine on -ā / -u / -ū (Typ भाषा / वस्तु)
  if (
    endsWithAaNative ||
    endsWithAaTranslit ||
    endsWithUuNative ||
    endsWithUuTranslit
  ) {
    return {
      declensionType: "Femininum auf Vokal -ā/-u (भाषा/माता-Typ)",
      ruleExplanation:
        "Plural Direktus erhält -ẽ (एँ), Plural Obliquus erhält -oṁ (ओं).",
      postpositionNote,
      rows: [
        {
          kasus: "Direktus",
          kasusHelp: "Unmarkiertes Subjekt",
          sgNative: cleanNative,
          sgTranslit: cleanTranslit,
          plNative: `${cleanNative}एँ`,
          plTranslit: `${cleanTranslit}ẽ`,
        },
        {
          kasus: "Obliquus",
          kasusHelp: "Vor Postpositionen [+ ko, se, meṁ...]",
          sgNative: cleanNative,
          sgTranslit: cleanTranslit,
          plNative: `${cleanNative}ओं`,
          plTranslit: `${cleanTranslit}oṁ`,
        },
        {
          kasus: "Vokativ",
          kasusHelp: "Anrede",
          sgNative: `${cleanNative}!`,
          sgTranslit: `${cleanTranslit}!`,
          plNative: `${cleanNative}ओ!`,
          plTranslit: `${cleanTranslit}o!`,
        },
      ],
    };
  }

  // 4. Consonant feminine (Typ किताब / औरत)
  return {
    declensionType: "Femininum konsonantisch (किताब-Typ)",
    ruleExplanation:
      "Plural Direktus endet auf -eṁ (ें), Plural Obliquus auf -oṁ (ों).",
    postpositionNote,
    rows: [
      {
        kasus: "Direktus",
        kasusHelp: "Unmarkiertes Subjekt",
        sgNative: cleanNative,
        sgTranslit: cleanTranslit,
        plNative: `${cleanNative}ें`,
        plTranslit: `${cleanTranslit}eṁ`,
      },
      {
        kasus: "Obliquus",
        kasusHelp: "Vor Postpositionen [+ ko, se, meṁ...]",
        sgNative: cleanNative,
        sgTranslit: cleanTranslit,
        plNative: `${cleanNative}ों`,
        plTranslit: `${cleanTranslit}oṁ`,
      },
      {
        kasus: "Vokativ",
        kasusHelp: "Anrede",
        sgNative: `${cleanNative}!`,
        sgTranslit: `${cleanTranslit}!`,
        plNative: `${cleanNative}ो!`,
        plTranslit: `${cleanTranslit}o!`,
      },
    ],
  };
}

/**
 * Irregular Hindi verbs repository
 */
const IRREGULAR_VERBS: Record<string, Partial<HindiVerbParadigm>> = {
  होना: {
    isTransitive: false,
    neBadge: "[-ne] Intransitiv",
    neBadgeClass: "badge-intransitive",
    neExplanation:
      "Kein ne im Perfekt. Das Verb richtet sich in Person/Numerus immer nach dem Subjekt.",
    rootNative: "हो",
    rootTranslit: "ho",
    perfNative: "हुआ / हुई (Pl. हुए / हुईं)",
    perfTranslit: "huā / huī (Pl. hue / huīṁ)",
    habitNative: "होता/होती है (Pl. होते/होती हैं)",
    habitTranslit: "hotā/hotī hai (Pl. hote/hotī haiṁ)",
    futNative: "होगा / होगी (Pl. होंगे / होंगी)",
    futTranslit: "hogā / hogī (Pl. hoṅge / hoṅgī)",
    impNative: "तू हो · तुम हो · आप होइए",
    impTranslit: "tū ho · tum ho · āp hoie",
  },
  जाना: {
    isTransitive: false,
    neBadge: "[-ne] Intransitiv",
    neBadgeClass: "badge-intransitive",
    neExplanation:
      "Bewegungsverb, niemals ne im Perfekt. Stark unregelmäßiger Perfektstamm gaya-.",
    rootNative: "जा",
    rootTranslit: "jā",
    perfNative: "गया / गई (Pl. गए / गईं)",
    perfTranslit: "gayā / gaī (Pl. gae / gaīṁ)",
    habitNative: "जाता/जाती है (Pl. जाते/जाती हैं)",
    habitTranslit: "jātā/jātī hai (Pl. jāte/jātī haiṁ)",
    futNative: "जाएगा / जाएगी (Pl. जाएंगे / जाएंगी)",
    futTranslit: "jāegā / jāegī (Pl. jāeṅge / jāeṅgī)",
    impNative: "तू जा · तुम जाओ · आप जाइए",
    impTranslit: "tū jā · tum jāo · āp jāie",
  },
  करना: {
    isTransitive: true,
    neBadge: "[+ne] Transitiv",
    neBadgeClass: "badge-transitive",
    neExplanation:
      "Zwingend mit ne im Perfekt: Subjekt steht mit ne, Verb richtet sich nach dem direkten Objekt (oder maskulin Sg. neutral).",
    rootNative: "कर",
    rootTranslit: "kar",
    perfNative: "किया / की (Pl. किए / कीं)",
    perfTranslit: "kiyā / kī (Pl. kie / kīṁ)",
    habitNative: "करता/करती है (Pl. करते/करती हैं)",
    habitTranslit: "kartā/kartī hai (Pl. karte/kartī haiṁ)",
    futNative: "करेगा / करेगी (Pl. करेंगे / करेंगी)",
    futTranslit: "karegā / karegī (Pl. kareṅge / kareṅgī)",
    impNative: "तू कर · तुम करो · आप कीजिए",
    impTranslit: "tū kar · tum karo · āp kījie",
  },
  लेना: {
    isTransitive: true,
    neBadge: "[+ne] Transitiv",
    neBadgeClass: "badge-transitive",
    neExplanation:
      "Subjekt im Perfekt zwingend mit ne. Unregelmäßiger Imperativ für आप: लीजिए (lījie).",
    rootNative: "ले",
    rootTranslit: "le",
    perfNative: "लिया / ली (Pl. लिए / लीं)",
    perfTranslit: "liyā / lī (Pl. lie / līṁ)",
    habitNative: "लेता/लेती है (Pl. लेते/लेती हैं)",
    habitTranslit: "letā/letī hai (Pl. lete/letī haiṁ)",
    futNative: "लेगा / लेगी (Pl. लेंगे / लेंगी)",
    futTranslit: "legā / legī (Pl. leṅge / leṅgī)",
    impNative: "तू ले · तुम लो · आप लीजिए",
    impTranslit: "tū le · tum lo · āp lījie",
  },
  देना: {
    isTransitive: true,
    neBadge: "[+ne] Transitiv",
    neBadgeClass: "badge-transitive",
    neExplanation:
      "Subjekt im Perfekt zwingend mit ne. Unregelmäßiger Imperativ für आप: दीजिए (dījie).",
    rootNative: "दे",
    rootTranslit: "de",
    perfNative: "दिया / दी (Pl. दिए / दीं)",
    perfTranslit: "diyā / dī (Pl. die / dīṁ)",
    habitNative: "देता/देती है (Pl. देते/देती हैं)",
    habitTranslit: "detā/detī hai (Pl. dete/detī haiṁ)",
    futNative: "देगा / देगी (Pl. देंगे / देंगी)",
    futTranslit: "degā / degī (Pl. deṅge / deṅgī)",
    impNative: "तू दे · तुम दो · आप दीजिए",
    impTranslit: "tū de · tum do · āp dījie",
  },
  पीना: {
    isTransitive: true,
    neBadge: "[+ne] Transitiv",
    neBadgeClass: "badge-transitive",
    neExplanation:
      "Subjekt im Perfekt mit ne. Vokalverkürzung im Perfekt und Imperativ: पिया (piyā), पीजिए (pījie).",
    rootNative: "पी",
    rootTranslit: "pī",
    perfNative: "पिया / पी (Pl. पिए / पीं)",
    perfTranslit: "piyā / pī (Pl. pie / pīṁ)",
    habitNative: "पीता/पीती है (Pl. पीते/पीती हैं)",
    habitTranslit: "pītā/pītī hai (Pl. pīte/pītī haiṁ)",
    futNative: "पिएगा / पिएगी (Pl. पिएंगे / पिएंगी)",
    futTranslit: "piegā / piegī (Pl. pieṅge / pieṅgī)",
    impNative: "तू पी · तुम पियो · आप पीजिए",
    impTranslit: "tū pī · tum piyo · āp pījie",
  },
  बोलना: {
    isTransitive: false,
    neBadge: "[-ne] Intransitiv bezügl. ne",
    neBadgeClass: "badge-special",
    neExplanation:
      "Wichtigste Ausnahme: Obwohl sprechen oft transitiv erscheint, nimmt बोलना im Perfekt NIEMALS ne! (वह बोला / vah bolā, nicht *usne bolā).",
    rootNative: "बोल",
    rootTranslit: "bol",
    perfNative: "बोला / बोली (Pl. बोले / बोलीं)",
    perfTranslit: "bolā / bolī (Pl. bole / bolīṁ)",
    habitNative: "बोलता/बोलती है (Pl. बोलते/बोलती हैं)",
    habitTranslit: "boltā/boltī hai (Pl. bolte/boltī haiṁ)",
    futNative: "बोलेगा / बोलेगी (Pl. बोलेंगे / बोलेंगी)",
    futTranslit: "bolegā / bolegī (Pl. boleṅge / boleṅgī)",
    impNative: "तू बोल · तुम बोलो · आप बोलिए",
    impTranslit: "tū bol · tum bolo · āp bolie",
  },
  लाना: {
    isTransitive: false,
    neBadge: "[-ne] Intransitiv bezügl. ne",
    neBadgeClass: "badge-special",
    neExplanation:
      "Historisch aus le-ānā (nehmen und kommen) verschmolzen; konstruiert im Perfekt NIEMALS mit ne! (वह लाया / vah lāyā).",
    rootNative: "ला",
    rootTranslit: "lā",
    perfNative: "लाया / लाई (Pl. लाए / लाईं)",
    perfTranslit: "lāyā / lāī (Pl. lāe / lāīṁ)",
    habitNative: "लाता/लाती है (Pl. लाते/लाती हैं)",
    habitTranslit: "lātā/lātī hai (Pl. lāte/lātī haiṁ)",
    futNative: "लाएगा / लाएगी (Pl. लाएंगे / लाएंगी)",
    futTranslit: "lāegā / lāegī (Pl. lāeṅge / lāeṅgī)",
    impNative: "तू ला · तुम लाओ · आप लाइए",
    impTranslit: "tū lā · tum lāo · āp lāie",
  },
  खाना: {
    isTransitive: true,
    neBadge: "[+ne] Transitiv",
    neBadgeClass: "badge-transitive",
    neExplanation: "Subjekt im Perfekt zwingend mit ne (usne khānā khāyā).",
    rootNative: "खा",
    rootTranslit: "khā",
    perfNative: "खाया / खाई (Pl. खाए / खाईं)",
    perfTranslit: "khāyā / khāī (Pl. khāe / khāīṁ)",
    habitNative: "खाता/खाती है (Pl. खाते/खाती हैं)",
    habitTranslit: "khātā/khātī hai (Pl. khāte/khātī haiṁ)",
    futNative: "खाएगा / खाएगी (Pl. खाएंगे / खाएगीं)",
    futTranslit: "khāegā / khāegī (Pl. khāeṅge / khāeṅgī)",
    impNative: "तू खा · तुम खाओ · आप खाइए",
    impTranslit: "tū khā · tum khāo · āp khāie",
  },
};

const INTRANSITIVE_SET = new Set([
  "आना",
  "जाना",
  "बैठना",
  "सोना",
  "हँसना",
  "रोना",
  "चलना",
  "दौड़ना",
  "गिरना",
  "रहना",
  "उठना",
  "डरना",
  "बोलना",
  "लाना",
  "भूलना",
]);

/**
 * Returns a complete Hindi verb paradigm with Ergative (ne) rule,
 * root, past participle, habitual, future, and imperative forms.
 */
export function getHindiVerbParadigm(
  native: string,
  translit: string,
): HindiVerbParadigm {
  const cleanNative = native.trim();
  const cleanTranslit = translit.trim();

  if (IRREGULAR_VERBS[cleanNative]) {
    const item = IRREGULAR_VERBS[cleanNative];
    return {
      isTransitive: item.isTransitive ?? true,
      neBadge: item.neBadge ?? "[+ne] Transitiv",
      neBadgeClass: item.neBadgeClass ?? "badge-transitive",
      neExplanation: item.neExplanation ?? "",
      rootNative: item.rootNative ?? cleanNative.slice(0, -2),
      rootTranslit: item.rootTranslit ?? cleanTranslit.replace(/nā$/, ""),
      perfNative: item.perfNative ?? "",
      perfTranslit: item.perfTranslit ?? "",
      habitNative: item.habitNative ?? "",
      habitTranslit: item.habitTranslit ?? "",
      futNative: item.futNative ?? "",
      futTranslit: item.futTranslit ?? "",
      impNative: item.impNative ?? "",
      impTranslit: item.impTranslit ?? "",
    };
  }

  // Regular verb formation
  const rootN = cleanNative.endsWith("ना")
    ? cleanNative.slice(0, -2)
    : cleanNative;
  const rootT = cleanTranslit.endsWith("nā")
    ? cleanTranslit.slice(0, -2)
    : cleanTranslit.replace(/na$/, "");

  const vowelEnding = /[ाोूेीैौआओऊई]$/.test(rootN);

  let perfM = "";
  let perfF = "";
  let perfMPl = "";
  let perfFPl = "";
  let perfTM = "";
  let perfTF = "";
  let perfTMPl = "";
  let perfTFPl = "";

  if (vowelEnding) {
    perfM = `${rootN}या`;
    perfF = `${rootN}ई`;
    perfMPl = `${rootN}ए`;
    perfFPl = `${rootN}ईं`;
    perfTM = `${rootT}yā`;
    perfTF = `${rootT}ī`;
    perfTMPl = `${rootT}e`;
    perfTFPl = `${rootT}īṁ`;
  } else {
    perfM = `${rootN}ा`;
    perfF = `${rootN}ी`;
    perfMPl = `${rootN}े`;
    perfFPl = `${rootN}ीं`;
    perfTM = `${rootT}ā`;
    perfTF = `${rootT}ī`;
    perfTMPl = `${rootT}e`;
    perfTFPl = `${rootT}īṁ`;
  }

  const isIntr = INTRANSITIVE_SET.has(cleanNative);
  const isTr = !isIntr;

  const neBadge = isTr ? "[+ne] Transitiv" : "[-ne] Intransitiv";
  const neBadgeClass = isTr ? "badge-transitive" : "badge-intransitive";
  const neExplanation = isTr
    ? "Subjekt steht im Perfekt mit der Postposition ने (ne). Das Verb kongruiert mit dem Objekt."
    : "Kein ने (ne) im Perfekt. Das Verb kongruiert stets mit dem handelnden Subjekt.";

  return {
    isTransitive: isTr,
    neBadge,
    neBadgeClass,
    neExplanation,
    rootNative: rootN,
    rootTranslit: rootT,
    perfNative: `${perfM} / ${perfF} (Pl. ${perfMPl} / ${perfFPl})`,
    perfTranslit: `${perfTM} / ${perfTF} (Pl. ${perfTMPl} / ${perfTFPl})`,
    habitNative: `${rootN}ता/${rootN}ती है (Pl. ${rootN}ते/${rootN}ती हैं)`,
    habitTranslit: `${rootT}tā/${rootT}tī hai (Pl. ${rootT}te/${rootT}tī haiṁ)`,
    futNative: vowelEnding
      ? `${rootN}एगा / ${rootN}एगी (Pl. ${rootN}एंगे / ${rootN}ेंगी)`
      : `${rootN}ेगा / ${rootN}एगी (Pl. ${rootN}ेंगे / ${rootN}ेंगी)`,
    futTranslit: vowelEnding
      ? `${rootT}aegā / ${rootT}aegī (Pl. ${rootT}aeṅge / ${rootT}aeṅgī)`
      : `${rootT}egā / ${rootT}egī (Pl. ${rootT}eṅge / ${rootT}eṅgī)`,
    impNative: vowelEnding
      ? `तू ${rootN} · तुम ${rootN}ओ · आप ${rootN}इए`
      : `तू ${rootN} · तुम ${rootN}ो · आप ${rootN}िए`,
    impTranslit: `tū ${rootT} · tum ${rootT}o · āp ${rootT}ie`,
  };
}
