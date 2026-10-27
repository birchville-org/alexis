/**
 * Native Speech Synthesis Service for Alexis (Web Speech API)
 * Zero-dependency, offline-first audio pronunciation for Hindi and Sanskrit.
 */

export interface SpeechOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
}

class SpeechService {
  private isSupported: boolean;
  private voices: SpeechSynthesisVoice[] = [];
  private voicesLoaded = false;

  constructor() {
    this.isSupported =
      typeof window !== "undefined" && "speechSynthesis" in window;
    if (this.isSupported) {
      this.initVoices();
    }
  }

  private initVoices() {
    if (!this.isSupported) return;

    const load = () => {
      this.voices = window.speechSynthesis.getVoices();
      if (this.voices.length > 0) {
        this.voicesLoaded = true;
      }
    };

    load();
    if (typeof window.speechSynthesis.onvoiceschanged !== "undefined") {
      window.speechSynthesis.onvoiceschanged = load;
    }
  }

  /**
   * Checks whether speech synthesis is supported in the current environment.
   */
  public hasSupport(): boolean {
    return this.isSupported;
  }

  /**
   * Finds the best voice for a given language code (e.g. 'hi', 'sa', 'de').
   */
  public getBestVoice(langCode: string): SpeechSynthesisVoice | null {
    if (!this.isSupported) return null;
    if (!this.voicesLoaded) {
      this.voices = window.speechSynthesis.getVoices();
    }

    const cleanLang = langCode.toLowerCase().trim();

    // 1. Exact match (e.g. 'hi-IN')
    if (cleanLang === "hi" || cleanLang.startsWith("hi")) {
      const hiVoice =
        this.voices.find(
          (v) =>
            v.lang.toLowerCase().startsWith("hi") ||
            v.lang.toLowerCase().replace("_", "-").includes("hi-in"),
        ) || null;
      if (hiVoice) return hiVoice;
    }

    // 2. Sanskrit: Look for sa-IN, fallback to hi-IN
    if (cleanLang === "sa" || cleanLang.startsWith("sa")) {
      const saVoice = this.voices.find((v) =>
        v.lang.toLowerCase().startsWith("sa"),
      );
      if (saVoice) return saVoice;
      const hiFallback = this.voices.find((v) =>
        v.lang.toLowerCase().startsWith("hi"),
      );
      if (hiFallback) return hiFallback;
    }

    // 3. German
    if (cleanLang === "de" || cleanLang.startsWith("de")) {
      const deVoice = this.voices.find((v) =>
        v.lang.toLowerCase().startsWith("de"),
      );
      if (deVoice) return deVoice;
    }

    // Fallback: match by lang prefix
    return (
      this.voices.find((v) => v.lang.toLowerCase().startsWith(cleanLang)) ||
      null
    );
  }

  /**
   * Speaks the provided text using the Web Speech API.
   * Cancels any active utterance before starting.
   */
  public speak(
    text: string,
    langCode = "hi-IN",
    options: SpeechOptions = {},
  ): boolean {
    if (!this.isSupported || !text.trim()) return false;

    try {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text.trim());

      // Target language
      const targetLang =
        langCode === "hi"
          ? "hi-IN"
          : langCode === "sa"
            ? "sa-IN"
            : langCode === "de"
              ? "de-DE"
              : langCode;
      utterance.lang = targetLang;

      // Select voice if available
      const voice = this.getBestVoice(langCode);
      if (voice) {
        utterance.voice = voice;
      }

      // Slightly relaxed rate (0.88) provides clearer phonetic articulation
      // for language learners studying aspiration and retroflex consonants.
      utterance.rate = options.rate ?? 0.88;
      utterance.pitch = options.pitch ?? 1.0;
      utterance.volume = options.volume ?? 1.0;

      window.speechSynthesis.speak(utterance);
      return true;
    } catch (err) {
      console.warn("Speech synthesis error:", err);
      return false;
    }
  }

  /**
   * Stops any currently playing speech.
   */
  public stop() {
    if (this.isSupported) {
      window.speechSynthesis.cancel();
    }
  }
}

export const speechService = new SpeechService();
