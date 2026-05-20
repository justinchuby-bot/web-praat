"""
Generate ground-truth reference data using Parselmouth (real Praat engine).
Outputs JSON files that our vitest validation suite can compare against.
"""
import json
import numpy as np
import parselmouth
from parselmouth.praat import call
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent / "reference"
OUTPUT_DIR.mkdir(exist_ok=True)

def sine_wave(freq, duration, sr, amplitude=0.8):
    t = np.arange(int(duration * sr)) / sr
    return (amplitude * np.sin(2 * np.pi * freq * t)).astype(np.float64)

def voice_like(f0, duration, sr):
    t = np.arange(int(duration * sr)) / sr
    signal = np.zeros_like(t)
    for h in range(1, 7):
        amp = 0.8 / h
        freq = f0 * h
        if freq > sr / 2:
            break
        signal += amp * np.sin(2 * np.pi * freq * t)
    return signal

def resonator(signal, freq, bw, sr):
    omega = 2 * np.pi * freq / sr
    r = np.exp(-np.pi * bw / sr)
    a1 = -2 * r * np.cos(omega)
    a2 = r * r
    output = np.zeros_like(signal)
    y1 = y2 = 0
    for i in range(len(signal)):
        y = signal[i] - a1 * y1 - a2 * y2
        output[i] = y
        y2 = y1
        y1 = y
    return output

def formant_signal(f0, formants, duration, sr):
    n = int(duration * sr)
    period = int(sr / f0)
    impulse = np.zeros(n)
    impulse[::period] = 1.0
    signal = impulse
    for freq in formants:
        signal = resonator(signal, freq, 80, sr)
    mx = np.max(np.abs(signal))
    if mx > 0:
        signal /= mx
    return signal

def analyze_pitch(signal, sr, min_pitch=75, max_pitch=600):
    snd = parselmouth.Sound(signal, sampling_frequency=sr)
    pitch = call(snd, "To Pitch", 0.01, min_pitch, max_pitch)
    n_frames = call(pitch, "Get number of frames")
    results = []
    for i in range(1, n_frames + 1):
        t = call(pitch, "Get time from frame number", i)
        f0 = call(pitch, "Get value at time", t, "Hertz", "Linear")
        results.append({"time": round(t, 6), "f0": None if f0 == 0 or np.isnan(f0) else round(f0, 2)})
    return results

def analyze_formants(signal, sr, max_formant=5500, n_formants=5):
    snd = parselmouth.Sound(signal, sampling_frequency=sr)
    formant = call(snd, "To Formant (burg)", 0.01, n_formants, max_formant, 0.025, 50)
    n_frames = call(formant, "Get number of frames")
    results = []
    for i in range(1, n_frames + 1):
        t = call(formant, "Get time from frame number", i)
        f1 = call(formant, "Get value at time", 1, t, "Hertz", "Linear")
        f2 = call(formant, "Get value at time", 2, t, "Hertz", "Linear")
        f3 = call(formant, "Get value at time", 3, t, "Hertz", "Linear")
        results.append({
            "time": round(t, 6),
            "f1": None if np.isnan(f1) else round(f1, 2),
            "f2": None if np.isnan(f2) else round(f2, 2),
            "f3": None if np.isnan(f3) else round(f3, 2),
        })
    return results

def analyze_intensity(signal, sr, min_pitch=75):
    snd = parselmouth.Sound(signal, sampling_frequency=sr)
    intensity = call(snd, "To Intensity", min_pitch, 0.01, "yes")
    n_frames = call(intensity, "Get number of frames")
    results = []
    for i in range(1, n_frames + 1):
        t = call(intensity, "Get time from frame number", i)
        val = call(intensity, "Get value at time", t, "Cubic")
        results.append({"time": round(t, 6), "intensity_db": round(val, 2) if not np.isnan(val) else None})
    return results

# ─── Generate test cases ──────────────────────────────────────────────────────────

SR = 16000
test_cases = {}

# Pitch tests
print("Generating pitch references...")
for freq in [80, 100, 120, 150, 200, 250, 300]:
    signal = voice_like(freq, 0.5, SR)
    pitch_data = analyze_pitch(signal, SR)
    voiced = [f["f0"] for f in pitch_data if f["f0"] is not None]
    mean_f0 = np.mean(voiced) if voiced else None
    test_cases[f"pitch_{freq}hz"] = {
        "signal": "voice_like",
        "params": {"f0": freq, "duration": 0.5, "sr": SR},
        "praat_mean_f0": round(mean_f0, 2) if mean_f0 else None,
        "praat_n_voiced": len(voiced),
        "frames": pitch_data,
    }
    print(f"  {freq} Hz: Praat mean F0 = {mean_f0:.2f} Hz ({len(voiced)} voiced frames)")

# Formant tests
print("\nGenerating formant references...")
vowels = {
    "a": {"f0": 120, "formants": [700, 1200, 2500]},
    "i": {"f0": 120, "formants": [270, 2300, 3000]},
    "u": {"f0": 120, "formants": [300, 870, 2250]},
    "e": {"f0": 120, "formants": [400, 2000, 2600]},
    "o": {"f0": 120, "formants": [500, 900, 2500]},
}
for vowel, params in vowels.items():
    signal = formant_signal(params["f0"], params["formants"], 0.3, SR)
    formant_data = analyze_formants(signal, SR)
    f1_vals = [f["f1"] for f in formant_data if f["f1"] is not None]
    f2_vals = [f["f2"] for f in formant_data if f["f2"] is not None]
    median_f1 = float(np.median(f1_vals)) if f1_vals else None
    median_f2 = float(np.median(f2_vals)) if f2_vals else None
    test_cases[f"formant_{vowel}"] = {
        "signal": "formant_signal",
        "params": params,
        "praat_median_f1": round(median_f1, 2) if median_f1 else None,
        "praat_median_f2": round(median_f2, 2) if median_f2 else None,
        "target_f1": params["formants"][0],
        "target_f2": params["formants"][1],
        "frames": formant_data,
    }
    print(f"  /{vowel}/: Praat F1={median_f1:.0f} (target {params['formants'][0]}), F2={median_f2:.0f} (target {params['formants'][1]})")

# Intensity tests
print("\nGenerating intensity references...")
for amp in [0.1, 0.2, 0.4, 0.8]:
    signal = sine_wave(200, 0.3, SR, amplitude=amp)
    int_data = analyze_intensity(signal, SR)
    vals = [f["intensity_db"] for f in int_data if f["intensity_db"] is not None]
    mean_int = np.mean(vals) if vals else None
    test_cases[f"intensity_amp{amp}"] = {
        "signal": "sine_wave",
        "params": {"freq": 200, "duration": 0.3, "sr": SR, "amplitude": amp},
        "praat_mean_intensity": round(mean_int, 2) if mean_int else None,
        "frames": int_data,
    }
    print(f"  amp={amp}: Praat mean intensity = {mean_int:.2f} dB")

# Write output
output_file = OUTPUT_DIR / "praat-reference.json"
with open(output_file, "w") as f:
    json.dump(test_cases, f, indent=2)

print(f"\n✅ Reference data written to {output_file}")
print(f"   {len(test_cases)} test cases")
