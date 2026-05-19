#!/usr/bin/env python3
"""Generate test audio fixtures and Parselmouth reference data."""

import numpy as np
import parselmouth
import json
import struct
import os
import math

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), '..', 'fixtures')
os.makedirs(FIXTURES_DIR, exist_ok=True)


def write_wav(filepath, samples, sample_rate=44100):
    """Write 16-bit PCM WAV file."""
    n = len(samples)
    # Clip and convert to int16
    clipped = np.clip(samples, -1.0, 1.0)
    int_samples = (clipped * 32767).astype(np.int16)
    
    with open(filepath, 'wb') as f:
        # RIFF header
        data_size = n * 2
        f.write(b'RIFF')
        f.write(struct.pack('<I', 36 + data_size))
        f.write(b'WAVE')
        # fmt chunk
        f.write(b'fmt ')
        f.write(struct.pack('<IHHIIHH', 16, 1, 1, sample_rate, sample_rate * 2, 2, 16))
        # data chunk
        f.write(b'data')
        f.write(struct.pack('<I', data_size))
        f.write(int_samples.tobytes())


def generate_sine_440hz():
    """Pure 440Hz sine wave, 1 second, 44100Hz."""
    sr = 44100
    t = np.arange(sr) / sr
    samples = 0.8 * np.sin(2 * np.pi * 440 * t)
    path = os.path.join(FIXTURES_DIR, 'sine_440hz.wav')
    write_wav(path, samples, sr)
    return path


def generate_vowel_a():
    """Synthesize /a/ vowel with F0=120Hz, F1=700Hz, F2=1200Hz."""
    sr = 44100
    duration = 1.0
    n = int(sr * duration)
    t = np.arange(n) / sr
    
    # Generate glottal pulse train at F0=120Hz
    f0 = 120.0
    # Simple approach: sum harmonics with formant envelope
    signal = np.zeros(n)
    num_harmonics = int(sr / 2 / f0)
    
    # Formant frequencies and bandwidths
    formants = [(700, 130), (1200, 70), (2600, 160), (3300, 250), (3750, 300)]
    
    for h in range(1, min(num_harmonics, 60) + 1):
        freq = h * f0
        # Apply formant filter (sum of resonances)
        amp = 0.0
        for fc, bw in formants:
            # Simple resonance gain
            amp += 1.0 / (1.0 + ((freq - fc) / (bw / 2)) ** 2)
        signal += amp * np.sin(2 * np.pi * freq * t)
    
    # Normalize
    signal = 0.8 * signal / np.max(np.abs(signal))
    path = os.path.join(FIXTURES_DIR, 'vowel_a.wav')
    write_wav(path, signal, sr)
    return path


def generate_sweep():
    """Frequency sweep from 100Hz to 1000Hz, 2 seconds."""
    sr = 44100
    duration = 2.0
    n = int(sr * duration)
    t = np.arange(n) / sr
    
    # Linear frequency sweep
    f0, f1 = 100.0, 1000.0
    phase = 2 * np.pi * (f0 * t + (f1 - f0) / (2 * duration) * t ** 2)
    samples = 0.8 * np.sin(phase)
    path = os.path.join(FIXTURES_DIR, 'sweep.wav')
    write_wav(path, samples, sr)
    return path


def nan_to_null(obj):
    """Convert NaN/inf to None for JSON serialization."""
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    if isinstance(obj, list):
        return [nan_to_null(x) for x in obj]
    if isinstance(obj, dict):
        return {k: nan_to_null(v) for k, v in obj.items()}
    return obj


def extract_reference(wav_path, basename):
    """Extract pitch, formant, intensity, HNR reference data using Parselmouth."""
    snd = parselmouth.Sound(wav_path)
    
    # Pitch
    pitch = snd.to_pitch(time_step=0.01, pitch_floor=75.0, pitch_ceiling=600.0)
    pitch_data = {
        "times": pitch.xs().tolist(),
        "frequencies": [pitch.get_value_at_time(t) for t in pitch.xs()]
    }
    with open(os.path.join(FIXTURES_DIR, f'{basename}_pitch.json'), 'w') as f:
        json.dump(nan_to_null(pitch_data), f)
    
    # Formants
    formant = snd.to_formant_burg(time_step=0.01, max_number_of_formants=5.0, maximum_formant=5500.0)
    formant_data = {
        "times": formant.xs().tolist(),
        "f1": [formant.get_value_at_time(1, t) for t in formant.xs()],
        "f2": [formant.get_value_at_time(2, t) for t in formant.xs()],
        "f3": [formant.get_value_at_time(3, t) for t in formant.xs()]
    }
    with open(os.path.join(FIXTURES_DIR, f'{basename}_formants.json'), 'w') as f:
        json.dump(nan_to_null(formant_data), f)
    
    # Intensity
    intensity = snd.to_intensity(minimum_pitch=75.0, time_step=0.01)
    intensity_data = {
        "times": intensity.xs().tolist(),
        "values": intensity.values[0].tolist()
    }
    with open(os.path.join(FIXTURES_DIR, f'{basename}_intensity.json'), 'w') as f:
        json.dump(nan_to_null(intensity_data), f)
    
    # HNR (Harmonicity)
    harmonicity = snd.to_harmonicity(time_step=0.01)
    hnr_data = {
        "times": harmonicity.xs().tolist(),
        "values": harmonicity.values[0].tolist()
    }
    with open(os.path.join(FIXTURES_DIR, f'{basename}_hnr.json'), 'w') as f:
        json.dump(nan_to_null(hnr_data), f)
    
    print(f"  ✓ {basename}: pitch({len(pitch_data['times'])}), formants({len(formant_data['times'])}), "
          f"intensity({len(intensity_data['times'])}), hnr({len(hnr_data['times'])})")


if __name__ == '__main__':
    print("Generating test audio fixtures...")
    
    sine_path = generate_sine_440hz()
    print(f"  ✓ sine_440hz.wav")
    
    vowel_path = generate_vowel_a()
    print(f"  ✓ vowel_a.wav")
    
    sweep_path = generate_sweep()
    print(f"  ✓ sweep.wav")
    
    print("\nExtracting Parselmouth reference data...")
    extract_reference(sine_path, 'sine_440hz')
    extract_reference(vowel_path, 'vowel_a')
    extract_reference(sweep_path, 'sweep')
    
    print("\nDone! All fixtures generated.")
