#!/usr/bin/env python3
"""Generiert Offline-Sanskrit-Audios (.m4a) für den Payer-Korpus via ai4bharat/indic-parler-tts."""

from __future__ import annotations

import json
from pathlib import Path
import subprocess
import sys
import time
import warnings

import numpy as np
from parler_tts import ParlerTTSForConditionalGeneration
import scipy.io.wavfile as wavfile
import torch
from transformers import AutoTokenizer

ROOT = Path(__file__).resolve().parent.parent
CORPUS_PATH = ROOT / "data" / "corpora" / "payer_sanskrit.json"
AUDIO_DIR = ROOT / "public" / "audio" / "sa"
MANIFEST_PATH = ROOT / "src" / "data" / "sanskritAudioIds.json"

MODEL_ID = "ai4bharat/indic-parler-tts"
DESCRIPTION = (
    "Aryan speaks Sanskrit clearly at a slightly slow pace with a neutral tone. "
    "The recording is of very high quality, with Aryan's voice sounding clear and very close up, "
    "with no background noise."
)


def pick_device() -> str:
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


def trim_and_encode_m4a(raw_wav: np.ndarray, sr: int, out_m4a: Path) -> float:
    arr = np.atleast_1d(np.asarray(raw_wav, dtype=np.float32).squeeze()).reshape(-1)
    if arr.size < int(0.05 * sr):
        return 0.0

    tmp_wav = out_m4a.with_suffix(".tmp.wav")
    tmp_trim = out_m4a.with_suffix(".trim.wav")
    try:
        peak = float(np.max(np.abs(arr))) if arr.size > 0 else 0.0
        if peak > 0:
            arr = arr / peak * 0.92
        pcm = (arr * 32767.0).astype(np.int16)
        wavfile.write(tmp_wav, sr, pcm)

        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-loglevel",
                "error",
                "-i",
                str(tmp_wav),
                "-af",
                "silenceremove=start_periods=1:start_threshold=-45dB:stop_periods=-1:stop_duration=0.18:stop_threshold=-45dB",
                "-ar",
                "24000",
                "-ac",
                "1",
                str(tmp_trim),
            ],
            check=True,
        )

        trim_sr, trim_data = wavfile.read(tmp_trim)
        duration_s = len(trim_data) / float(trim_sr) if trim_sr > 0 else 0.0
        if duration_s < 0.18:
            # Falls Stille-Filter fast alles weggeschnitten hat, ungetrimmtes Audio verwenden
            src_for_encode = tmp_wav
            duration_s = len(pcm) / float(sr)
        else:
            src_for_encode = tmp_trim

        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-loglevel",
                "error",
                "-i",
                str(src_for_encode),
                "-c:a",
                "aac",
                "-b:a",
                "32k",
                "-ar",
                "24000",
                "-ac",
                "1",
                "-movflags",
                "+faststart",
                str(out_m4a),
            ],
            check=True,
        )
        return duration_s
    finally:
        tmp_wav.unlink(missing_ok=True)
        tmp_trim.unlink(missing_ok=True)


def write_manifest(entries: list[dict]) -> None:
    available = sorted(
        e["id"]
        for e in entries
        if (AUDIO_DIR / f"{e['id']}.m4a").is_file()
        and (AUDIO_DIR / f"{e['id']}.m4a").stat().st_size > 500
    )
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(
        json.dumps(available, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Manifest geschrieben: {len(available)}/{len(entries)} IDs -> {MANIFEST_PATH}")


def main() -> int:
    warnings.filterwarnings("ignore", category=FutureWarning)
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    corpus = json.loads(CORPUS_PATH.read_text(encoding="utf-8"))
    entries = corpus["entries"]

    pending = [
        e
        for e in entries
        if not (AUDIO_DIR / f"{e['id']}.m4a").is_file()
        or (AUDIO_DIR / f"{e['id']}.m4a").stat().st_size <= 500
    ]
    print(f"Payer-Korpus: {len(entries)} Einträge, ausstehend: {len(pending)}")

    if not pending:
        write_manifest(entries)
        return 0

    device = pick_device()
    print(f"Lade {MODEL_ID} auf Device: {device}...")
    model = ParlerTTSForConditionalGeneration.from_pretrained(MODEL_ID).to(device)
    model.eval()
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    desc_tokenizer = AutoTokenizer.from_pretrained(
        model.config.text_encoder._name_or_path
    )
    desc_inputs = desc_tokenizer(DESCRIPTION, return_tensors="pt")
    desc_ids = desc_inputs["input_ids"].to(device)
    desc_mask = desc_inputs["attention_mask"].to(device)
    sr = int(model.config.sampling_rate)

    t_start = time.monotonic()
    outliers = 0

    for idx, entry in enumerate(pending, start=1):
        entry_id = entry["id"]
        deva = entry["lemma_native"].strip()
        out_m4a = AUDIO_DIR / f"{entry_id}.m4a"
        tmp_best = out_m4a.with_suffix(".best.m4a")
        max_allowed = max(2.8, 0.32 * len(deva) + 1.2)

        prompt_inputs = tokenizer(deva, return_tensors="pt")
        p_ids = prompt_inputs["input_ids"]
        p_mask = prompt_inputs["attention_mask"]

        best_dur = None
        for attempt in range(3):
            torch.manual_seed(1000 + idx * 10 + attempt)
            try:
                with torch.no_grad():
                    gen = model.generate(
                        input_ids=desc_ids,
                        attention_mask=desc_mask,
                        prompt_input_ids=p_ids.to(device),
                        prompt_attention_mask=p_mask.to(device),
                    )
            except Exception as exc:
                if device != "cpu":
                    print(f"MPS-Fallback auf CPU bei {entry_id}: {exc}")
                    device = "cpu"
                    model = model.to("cpu")
                    desc_ids = desc_ids.to("cpu")
                    desc_mask = desc_mask.to("cpu")
                    with torch.no_grad():
                        gen = model.generate(
                            input_ids=desc_ids,
                            attention_mask=desc_mask,
                            prompt_input_ids=p_ids.to("cpu"),
                            prompt_attention_mask=p_mask.to("cpu"),
                        )
                else:
                    raise

            waveform = gen.cpu().numpy().squeeze()
            cand_m4a = out_m4a.with_suffix(f".cand{attempt}.m4a")
            dur = trim_and_encode_m4a(waveform, sr, cand_m4a)

            if 0.22 <= dur <= max_allowed:
                if tmp_best.exists():
                    tmp_best.unlink()
                cand_m4a.replace(out_m4a)
                best_dur = dur
                break

            # Sonst bestes Zwischenergebnis nahe vernünftiger Länge merken
            if cand_m4a.exists() and (
                best_dur is None or (dur >= 0.22 and (best_dur < 0.22 or dur < best_dur))
            ):
                cand_m4a.replace(tmp_best)
                best_dur = dur
            else:
                cand_m4a.unlink(missing_ok=True)
        else:
            outliers += 1
            if tmp_best.exists():
                tmp_best.replace(out_m4a)

        if best_dur is None:
            best_dur = 0.0

        if idx % 25 == 0 or idx == len(pending):
            elapsed = time.monotonic() - t_start
            per_item = elapsed / idx
            eta_min = (len(pending) - idx) * per_item / 60.0
            print(
                f"[{idx}/{len(pending)}] {entry_id} ({deva}, {best_dur:.2f}s) · "
                f"{per_item:.2f}s/Wort · ETA {eta_min:.1f} Min · Ausreißer: {outliers}",
                flush=True,
            )
            write_manifest(entries)

    write_manifest(entries)
    print(f"Fertig in {(time.monotonic() - t_start)/60.0:.1f} Min (Ausreißer: {outliers}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
