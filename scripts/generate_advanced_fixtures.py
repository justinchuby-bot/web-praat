#!/usr/bin/env python3
"""Generate advanced test audio fixtures with hardcoded expected values (no Parselmouth needed)."""

import numpy as np
import json
import struct
import os

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), '..', 'fixtures')
os.makedirs(FIXTURES_DIR, exist_ok=True)

SR = 44100


def write_wav(filepath, samples, sample_rate=SR):
    """Write 16-bit PCM WAV file."""
    clipped = np.clip(samples, -1.0, 1.0)
    int_samples = (clipped * 32767).astype(np.int16)
    n = len(int_samples)
    data_size = n * 2
    with open(filepath, 'wb') as f:
        f.write(b'RIFF')
        f.write(struct.pack('<I', 36 + data_size))
        f.write(b'WAVE')
        f.write(b'fmt ')
        f.write(struct.pack('<IHHIIHH', 16, 1, 1, sample_rate, sample_rate * 2, 2, 16))
        f.write(b'data')
        f.write(struct.pack('<I', data_size))
        f.write(int_samples.tobytes())


def synth_vowel(f0, formants, duration, sr=SR):
    """Synthesize vowel with given F0 and formant frequencies [(freq, bw), ...]."""
    n = int(sr * duration)
    t = np.arange(n) / sr
    signal = np.zeros(n)
    num_harmonics = min(int(sr / 2 / f0), 60)
    for h in range(1, num_harmonics + 1):
        freq = h * f0
        amp = 0.0
        for fc, bw in formants:
            amp += 1.0 / (1.0 + ((freq - fc) / (bw / 2)) ** 2)
        signal += amp * np.sin(2 * np.pi * freq * t)
    signal = 0.8 * signal / np.max(np.abs(signal))
    return signal


# ─── 1. Vowel Sequence (/a/ → /i/ → /u/ → /e/ → /o/) ────────────────────────

def generate_vowel_sequence():
    """1.5s total, 5 vowels × 0.3s each."""
    # Vowel formants: (F1, F2) with standard bandwidths
    vowel_params = {
        'a': [(700, 130), (1200, 70), (2600, 160)],
        'i': [(270, 60), (2300, 90), (3000, 170)],
        'u': [(300, 60), (870, 90), (2250, 170)],
        'e': [(400, 70), (2100, 80), (2800, 160)],
        'o': [(450, 70), (800, 80), (2600, 160)],
    }
    vowel_order = ['a', 'i', 'u', 'e', 'o']
    f0 = 120.0
    seg_dur = 0.3

    segments = []
    for v in vowel_order:
        seg = synth_vowel(f0, vowel_params[v], seg_dur)
        segments.append(seg)

    signal = np.concatenate(segments)
    path = os.path.join(FIXTURES_DIR, 'vowel_sequence.wav')
    write_wav(path, signal)

    # Expected values (hardcoded from known synthesis params)
    expected = {
        "segments": [
            {"vowel": v, "start": i * seg_dur, "end": (i + 1) * seg_dur,
             "expected_f1": vowel_params[v][0][0], "expected_f2": vowel_params[v][1][0]}
            for i, v in enumerate(vowel_order)
        ],
        "f0": f0,
        "duration": 1.5
    }
    with open(os.path.join(FIXTURES_DIR, 'vowel_sequence_expected.json'), 'w') as f:
        json.dump(expected, f, indent=2)
    print("  ✓ vowel_sequence.wav")


# ─── 2. Noisy Vowel (/a/ + white noise, SNR 10dB) ────────────────────────────

def generate_noisy_vowel():
    """1s /a/ vowel with additive white noise at SNR=10dB."""
    f0 = 120.0
    duration = 1.0
    formants_a = [(700, 130), (1200, 70), (2600, 160)]
    signal = synth_vowel(f0, formants_a, duration)

    # Add noise at SNR=10dB
    signal_power = np.mean(signal ** 2)
    snr_linear = 10 ** (10 / 10)
    noise_power = signal_power / snr_linear
    np.random.seed(42)
    noise = np.sqrt(noise_power) * np.random.randn(len(signal))
    noisy = signal + noise
    noisy = 0.8 * noisy / np.max(np.abs(noisy))

    path = os.path.join(FIXTURES_DIR, 'noisy_vowel.wav')
    write_wav(path, noisy)

    expected = {
        "f0": f0,
        "snr_db": 10,
        "expected_hnr_db": 10,
        "hnr_tolerance_db": 3,
        "duration": duration
    }
    with open(os.path.join(FIXTURES_DIR, 'noisy_vowel_expected.json'), 'w') as f:
        json.dump(expected, f, indent=2)
    print("  ✓ noisy_vowel.wav")


# ─── 3. Pitch Contour (80Hz → 200Hz rising) ──────────────────────────────────

def generate_pitch_contour():
    """1s signal with F0 rising linearly from 80 to 200 Hz."""
    duration = 1.0
    n = int(SR * duration)
    t = np.arange(n) / SR

    # Instantaneous frequency: linear from 80 to 200
    f0_start, f0_end = 80.0, 200.0
    inst_freq = f0_start + (f0_end - f0_start) * t / duration
    # Phase integral
    phase = 2 * np.pi * np.cumsum(inst_freq) / SR
    signal = 0.8 * np.sin(phase)

    path = os.path.join(FIXTURES_DIR, 'pitch_contour.wav')
    write_wav(path, signal)

    # Expected: at time t, pitch = 80 + 120*t
    times = np.arange(0.05, 0.95, 0.01).tolist()
    expected_freqs = [f0_start + (f0_end - f0_start) * t for t in times]
    expected = {
        "f0_start": f0_start,
        "f0_end": f0_end,
        "duration": duration,
        "times": times,
        "expected_frequencies": expected_freqs
    }
    with open(os.path.join(FIXTURES_DIR, 'pitch_contour_expected.json'), 'w') as f:
        json.dump(expected, f, indent=2)
    print("  ✓ pitch_contour.wav")


# ─── 4. Speech + Silence alternating ─────────────────────────────────────────

def generate_speech_silence():
    """0.3s silence → 0.5s /a/ → 0.2s silence → 0.5s /i/ → 0.3s silence."""
    f0 = 120.0
    formants_a = [(700, 130), (1200, 70), (2600, 160)]
    formants_i = [(270, 60), (2300, 90), (3000, 170)]

    seg_silence1 = np.zeros(int(SR * 0.3))
    seg_a = synth_vowel(f0, formants_a, 0.5)
    seg_silence2 = np.zeros(int(SR * 0.2))
    seg_i = synth_vowel(f0, formants_i, 0.5)
    seg_silence3 = np.zeros(int(SR * 0.3))

    signal = np.concatenate([seg_silence1, seg_a, seg_silence2, seg_i, seg_silence3])
    path = os.path.join(FIXTURES_DIR, 'speech_silence.wav')
    write_wav(path, signal)

    expected = {
        "total_duration": 1.8,
        "segments": [
            {"type": "silence", "start": 0.0, "end": 0.3},
            {"type": "voiced", "start": 0.3, "end": 0.8, "vowel": "a", "f0": f0},
            {"type": "silence", "start": 0.8, "end": 1.0},
            {"type": "voiced", "start": 1.0, "end": 1.5, "vowel": "i", "f0": f0},
            {"type": "silence", "start": 1.5, "end": 1.8},
        ]
    }
    with open(os.path.join(FIXTURES_DIR, 'speech_silence_expected.json'), 'w') as f:
        json.dump(expected, f, indent=2)
    print("  ✓ speech_silence.wav")


# ─── 5. Jittery Voice (known jitter 2%, shimmer 5%) ──────────────────────────

def generate_jittery_voice():
    """440Hz with 2% jitter and 5% shimmer, 1 second."""
    f0 = 440.0
    duration = 1.0
    np.random.seed(123)

    # Generate cycle-by-cycle with perturbation
    samples = []
    nominal_period = 1.0 / f0
    num_cycles = int(duration * f0)
    periods = []
    amplitudes = []

    for i in range(num_cycles):
        # Jitter: ±2% random perturbation to period
        jitter_factor = 1.0 + 0.02 * (2 * np.random.random() - 1)
        period = nominal_period * jitter_factor
        periods.append(period)

        # Shimmer: ±5% random perturbation to amplitude
        shimmer_factor = 1.0 + 0.05 * (2 * np.random.random() - 1)
        amplitudes.append(0.8 * shimmer_factor)

        # One cycle of sine
        n_samples = int(period * SR)
        t = np.arange(n_samples) / SR
        cycle = amplitudes[-1] * np.sin(2 * np.pi * t / period)
        samples.append(cycle)

    signal = np.concatenate(samples)
    path = os.path.join(FIXTURES_DIR, 'jittery_voice.wav')
    write_wav(path, signal)

    # Calculate actual jitter and shimmer from what we synthesized
    periods = np.array(periods)
    amplitudes = np.array(amplitudes)
    # Local jitter = mean |T_i - T_{i+1}| / mean(T)
    period_diffs = np.abs(np.diff(periods))
    actual_jitter = np.mean(period_diffs) / np.mean(periods) * 100
    # Local shimmer = mean |A_i - A_{i+1}| / mean(A)
    amp_diffs = np.abs(np.diff(amplitudes))
    actual_shimmer = np.mean(amp_diffs) / np.mean(amplitudes) * 100

    expected = {
        "f0": f0,
        "nominal_jitter_percent": 2.0,
        "nominal_shimmer_percent": 5.0,
        "actual_jitter_percent": round(actual_jitter, 4),
        "actual_shimmer_percent": round(actual_shimmer, 4),
        "jitter_tolerance_percent": 0.5,
        "shimmer_tolerance_percent": 1.0,
        "duration": len(signal) / SR
    }
    with open(os.path.join(FIXTURES_DIR, 'jittery_voice_expected.json'), 'w') as f:
        json.dump(expected, f, indent=2)
    print(f"  ✓ jittery_voice.wav (jitter={actual_jitter:.3f}%, shimmer={actual_shimmer:.3f}%)")


# ─── 6. Vowel Bandwidth (narrow vs wide formants) ────────────────────────────

def generate_vowel_bandwidth():
    """Two-part signal: narrow bandwidth /a/ (0.5s) then wide bandwidth /a/ (0.5s)."""
    f0 = 120.0
    # Narrow formants (sharp resonances)
    formants_narrow = [(700, 50), (1200, 40), (2600, 80)]
    # Wide formants (broad resonances)
    formants_wide = [(700, 250), (1200, 200), (2600, 300)]

    seg_narrow = synth_vowel(f0, formants_narrow, 0.5)
    seg_wide = synth_vowel(f0, formants_wide, 0.5)
    signal = np.concatenate([seg_narrow, seg_wide])

    path = os.path.join(FIXTURES_DIR, 'vowel_bandwidth.wav')
    write_wav(path, signal)

    expected = {
        "f0": f0,
        "duration": 1.0,
        "segments": [
            {"start": 0.0, "end": 0.5, "type": "narrow",
             "formants": [{"freq": 700, "bw": 50}, {"freq": 1200, "bw": 40}, {"freq": 2600, "bw": 80}]},
            {"start": 0.5, "end": 1.0, "type": "wide",
             "formants": [{"freq": 700, "bw": 250}, {"freq": 1200, "bw": 200}, {"freq": 2600, "bw": 300}]},
        ]
    }
    with open(os.path.join(FIXTURES_DIR, 'vowel_bandwidth_expected.json'), 'w') as f:
        json.dump(expected, f, indent=2)
    print("  ✓ vowel_bandwidth.wav")


if __name__ == '__main__':
    print("Generating advanced test fixtures...")
    generate_vowel_sequence()
    generate_noisy_vowel()
    generate_pitch_contour()
    generate_speech_silence()
    generate_jittery_voice()
    generate_vowel_bandwidth()
    print("\nDone!")
