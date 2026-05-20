# Web-Praat TODO

## Critical Bugs
- [x] #1 analyzeInWorker .catch() missing — unhandled rejection
- [x] #2 handleImportTextGrid no try/catch — crash on invalid file
- [x] #3 loadAudioFile leaks AudioContext (~6 limit)
- [x] #4 Settings useEffect re-analysis — verified: debounce is at SettingsPanel level (400ms), useEffect only fires after debounced onChange propagates. OK.
- [x] #5 Loop playback race condition — already guarded by audioCtxRef.current === ctx check + handlePause nulls ref

## Medium (Code Quality)
- [ ] #6 Experiment config typed as `any` (low priority, works)
- [ ] #7 TextGridEditor `as any` casts (low priority)
- [x] #8 pitchAtCursor/formantsAtCursor O(n) every render → useMemo
- [x] #9 Noise worker — one-shot, self-terminates, acceptable
- [x] #10 downloadTextFile csvEscape on filename — fixed
- [ ] #11 App.tsx God component — future refactor
- [x] #12 Clipboard writeText no .catch() — fixed

## Minor (Polish)
- [x] #13 Modals: role="dialog", aria-modal, aria-label on close + spectrogram canvas
- [ ] #14 paletteCommands useMemo extra dep (cosmetic)
- [x] #15 AudioRecorder stop() doesn't close AudioContext — fixed
- [ ] #16 Export naming inconsistency (cosmetic, future)

## Deferred
- [ ] Forced alignment (no external API; revisit when WASM solution exists)
