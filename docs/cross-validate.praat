# Cross-validation with Praat
#
# Run this script in Praat to generate reference values for comparison
# with web-praat's output on the same audio file.
#
# Usage:
#   1. Open your audio file in Praat
#   2. Run this script (Praat > Open Praat script > Run)
#   3. Compare the CSV output with web-praat's Export Pitch/Formant CSV

form Cross-validation settings
  sentence Input_file (leave empty for selected Sound)
  real Time_step 0.01
  real Min_pitch 75
  real Max_pitch 600
  integer Max_formant_count 5
  real Max_formant_hz 5500
endform

if input_file$ <> ""
  Read from file: input_file$
endif

name$ = selected$("Sound")
duration = Get total duration

appendInfoLine: "=== web-praat Cross-Validation Report ==="
appendInfoLine: "File: ", name$
appendInfoLine: "Duration: ", fixed$(duration, 4), " s"
appendInfoLine: ""

# ─── Pitch ───────────────────────────────────────────────────────────────────────

To Pitch: time_step, min_pitch, max_pitch
appendInfoLine: "── Pitch (autocorrelation) ──"
appendInfoLine: "time,praat_f0_hz"

n_frames = Get number of frames
for i from 1 to n_frames
  t = Get time from frame number: i
  f0 = Get value at time: t, "Hertz", "Linear"
  if f0 = undefined
    appendInfoLine: fixed$(t, 4), ","
  else
    appendInfoLine: fixed$(t, 4), ",", fixed$(f0, 2)
  endif
endfor

selectObject: "Sound " + name$

# ─── Formants ────────────────────────────────────────────────────────────────────

To Formant (burg): time_step, max_formant_count, max_formant_hz, 0.025, 50
appendInfoLine: ""
appendInfoLine: "── Formants (Burg) ──"
appendInfoLine: "time,praat_f1_hz,praat_f2_hz,praat_f3_hz"

n_frames = Get number of frames
for i from 1 to n_frames
  t = Get time from frame number: i
  f1 = Get value at time: 1, t, "Hertz", "Linear"
  f2 = Get value at time: 2, t, "Hertz", "Linear"
  f3 = Get value at time: 3, t, "Hertz", "Linear"
  line$ = fixed$(t, 4)
  if f1 = undefined
    line$ = line$ + ","
  else
    line$ = line$ + "," + fixed$(f1, 2)
  endif
  if f2 = undefined
    line$ = line$ + ","
  else
    line$ = line$ + "," + fixed$(f2, 2)
  endif
  if f3 = undefined
    line$ = line$ + ","
  else
    line$ = line$ + "," + fixed$(f3, 2)
  endif
  appendInfoLine: line$
endfor

selectObject: "Sound " + name$

# ─── Intensity ───────────────────────────────────────────────────────────────────

To Intensity: min_pitch, time_step, "yes"
appendInfoLine: ""
appendInfoLine: "── Intensity ──"
appendInfoLine: "time,praat_intensity_db"

n_frames = Get number of frames
for i from 1 to n_frames
  t = Get time from frame number: i
  int = Get value at time: t, "Cubic"
  appendInfoLine: fixed$(t, 4), ",", fixed$(int, 2)
endfor

appendInfoLine: ""
appendInfoLine: "=== END ==="
appendInfoLine: "Copy the above into a text file and compare with web-praat CSV exports."
appendInfoLine: "Tolerances: Pitch ±3 Hz, Formants ±100 Hz, Intensity ±2 dB"
