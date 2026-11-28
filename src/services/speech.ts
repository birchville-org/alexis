/**
 * Native Speech Synthesis & Offline Audio Service for Alexis
 * Plays curated offline Sanskrit audio clips (AI4Bharat Indic Parler-TTS)
 * when available and falls back to the W3C Web Speech API.
 */

import sanskritAudioIds from "../data/sanskritAudioIds.json";

const SANSKRIT_AUDIO_IDS = new Set<string>(sanskritAudioIds);

export interface SpeechOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
  entryId?: string;
}

class SpeechService {
  private isSupported: boolean;
  private voices: SpeechSynthesisVoice[] = [];
  private voicesLoaded = false;
  private currentAudio: HTMLAudioElement | null = null;

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
   * Speaks the provided text using curated offline audio (if available)
   * or falls back to the Web Speech API.
   * Cancels any active audio or utterance before starting.
   */
  public speak(
    text: string,
    langCode = "hi-IN",
    options: SpeechOptions = {},
  ): boolean {
    const cleaned = text.trim();
    if (!cleaned) return false;

    this.stop();

    const cleanLang = langCode.toLowerCase().trim();
    if (
      cleanLang.startsWith("sa") &&
      options.entryId &&
      SANSKRIT_AUDIO_IDS.has(options.entryId) &&
      typeof Audio !== "undefined"
    ) {
      const base = import.meta.env.BASE_URL || "/";
      const normalizedBase = base.endsWith("/") ? base : `${base}/`;
      const url = `${normalizedBase}audio/sa/${encodeURIComponent(options.entryId)}.m4a`;
      const audio = new Audio(url);
      this.currentAudio = audio;

      let fallbackTriggered = false;
      const triggerFallback = () => {
        if (fallbackTriggered || this.currentAudio !== audio) return;
        fallbackTriggered = true;
        this.currentAudio = null;
        this.speakWithWebSpeech(cleaned, langCode, options);
      };

      audio.onended = () => {
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
      };
      audio.onerror = triggerFallback;

      try {
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => triggerFallback());
        }
        return true;
      } catch {
        triggerFallback();
        return this.isSupported;
      }
    }

    return this.speakWithWebSpeech(cleaned, langCode, options);
  }

  private speakWithWebSpeech(
    text: string,
    langCode = "hi-IN",
    options: SpeechOptions = {},
  ): boolean {
    if (!this.isSupported || !text) return false;

    try {
      const utterance = new SpeechSynthesisUtterance(text);

      // Select voice if available and align utterance.lang with voice.lang
      // so WebKit/Safari does not discard fallback voices (e.g. hi-IN for sa).
      const voice = this.getBestVoice(langCode);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang =
          langCode === "hi" || langCode === "sa"
            ? "hi-IN"
            : langCode === "de"
              ? "de-DE"
              : langCode;
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
   * Stops any currently playing audio clip or speech synthesis.
   */
  public stop() {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {
        // ignore media reset errors
      }
      this.currentAudio = null;
    }
    if (this.isSupported) {
      window.speechSynthesis.cancel();
    }
  }
}

export const speechService = new SpeechService();
