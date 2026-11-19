import argparse
import json
import os
import subprocess
from pathlib import Path

os.environ.setdefault("OMP_NUM_THREADS", "2")

import numpy as np
import onnxruntime as runtime
import soundfile as sound
from kokoro_onnx import Kokoro

runtime.disable_telemetry_events()

parser = argparse.ArgumentParser()
parser.add_argument("--model-dir", required=True)
parser.add_argument("--lines", required=True)
parser.add_argument("--output", required=True)
options = parser.parse_args()
model_dir = Path(options.model_dir)
output_dir = Path(options.output)
output_dir.mkdir(parents=True, exist_ok=True)
session_options = runtime.SessionOptions()
session_options.intra_op_num_threads = 2
session_options.inter_op_num_threads = 1
session = runtime.InferenceSession(str(model_dir / "kokoro-v1.0.int8.onnx"), sess_options=session_options, providers=["CPUExecutionProvider"])
voice = Kokoro.from_session(session, str(model_dir / "voices-v1.0.bin"))
lines = json.loads(Path(options.lines).read_text(encoding="utf-8"))
report = []
for name, line in lines.items():
    if not name.isalpha() or not name.isascii():
        raise ValueError("Invalid clip name")
    phrases = [phrase.strip() for phrase in line["ancient"].split(".") if phrase.strip()]
    parts = [np.zeros(4800, dtype=np.float32)]
    for phrase in phrases:
        phonemes = voice.tokenizer.phonemize(phrase + ".", lang="grc")
        if not phonemes or any("\u4e00" <= letter <= "\u9fff" for letter in phrase):
            raise ValueError("Ancient Greek input required")
        samples, rate = voice.create(phonemes, voice="bm_george", speed=0.84, is_phonemes=True)
        if rate != 24000 or len(samples) < 4800 or np.max(np.abs(samples)) < 0.01:
            raise ValueError("Silent or invalid synthesis")
        parts.extend([samples, np.zeros(10080, dtype=np.float32)])
    audio = np.concatenate(parts)
    raw = model_dir / f"{name}-dry.wav"
    sound.write(str(raw), audio, 24000, subtype="PCM_16")
    output = model_dir / f"grc-{name}-rendering.mp3"
    filters = "asetrate=20400,aresample=32000,highpass=f=55,lowpass=f=3600,equalizer=f=160:t=q:w=0.8:g=3,acompressor=threshold=0.17:ratio=2:attack=12:release=200,loudnorm=I=-18:TP=-2.5:LRA=8"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-map_metadata", "-1", "-af", filters, "-ar", "32000", "-ac", "2", "-c:a", "libmp3lame", "-b:a", "128k", str(output)], check=True)
    decoded = subprocess.run(["ffmpeg", "-v", "error", "-i", str(output), "-f", "f32le", "-ac", "1", "-ar", "32000", "pipe:1"], capture_output=True, check=True)
    waveform = np.frombuffer(decoded.stdout, dtype=np.float32)
    duration = len(waveform) / 32000
    peak = float(np.max(np.abs(waveform)))
    rms = float(np.sqrt(np.mean(waveform * waveform)))
    if not 1 < duration < 35 or not 0.01 < peak < 0.95 or rms < 0.005:
        raise ValueError("Rendered voice failed audio validation")
    final = output_dir / f"grc-{name}.mp3"
    output.replace(final)
    report.append({"file": final.name, "language": "grc", "voice": "bm_george", "duration": round(duration, 3), "peak": round(peak, 5), "rms": round(rms, 5)})
    print(f"Prepared {final.name}: {duration:.2f}s, peak {peak:.3f}", flush=True)
(model_dir / "render-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
