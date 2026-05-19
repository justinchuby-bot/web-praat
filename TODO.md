# Web Praat — Development TODO

## 目标
1:1 还原 Praat (https://github.com/praat/praat.github.io) 的所有功能。可以改善用户体验和界面，但功能必须完整覆盖。如果发现 Praat 有的功能我们没有，自动加到 backlog。

**Working dir:** ~/clawspace/web-praat/
**Repo:** justinchuby-bot/web-praat (public)
**参考源码:** ~/clawspace/praat.github.io/


## 当前優先任務

- [ ] React 性能优化：修复 useMemo/useCallback 依赖问题（settings 对象引用、无意义 useMemo）

## Backlog（按優先級）
- [ ] 性能优化：Web Worker for heavy DSP
- [ ] 移动端适配


## 缺失的 Praat 功能（需要新增）

### 高优先
- [ ] Manipulation（pitch/duration 编辑 + 重合成）
- [ ] Long-Term Average Spectrum (LTAS)
- [ ] Harmonicity (HNR) 显示
- [ ] PointProcess（声门脉冲标记）
- [ ] Sound enhance（降噪、预加重、去静音）

### 中优先
- [ ] Cochleagram（听觉频谱图）
- [ ] Excitation pattern
- [ ] VocalTract 模型（声道面积函数→频谱）
- [ ] Spectrum 编辑（频域滤波、手动修改）
- [ ] FormantGrid 编辑（手动画 formant 轨迹）
- [ ] PitchTier 编辑（手动调 pitch 曲线）
- [ ] DurationTier（时长修改）
- [ ] AmplitudeTier（振幅包络）
- [ ] Sound → PointProcess（自动检测声门脉冲）
- [ ] Pitch → PitchTier → Sound（pitch 合成）

### 低优先
- [ ] SpeechSynthesizer（TTS）
- [ ] ExperimentMFC（感知实验）
- [ ] SpellingChecker
- [ ] Distributions & Transition（统计）
- [ ] Polygon / Photo / Movie 支持
- [ ] Praat Script 脚本引擎

## 已完成 ✅

- [x] 基础框架 (React + TypeScript + Vite)
- [x] 波形图 (Waveform)
- [x] 语谱图 (Spectrogram, STFT)
- [x] Pitch/F0 overlay (autocorrelation)
- [x] Formant overlay (Burg LPC)
- [x] Intensity curve (RMS)
- [x] 录音 + 文件加载
- [x] 播放/暂停 + 实时光标
- [x] 深色主题 UI
- [x] 7 个单元测试通过
- [x] WebGPU FFT 加速 (src/utils/fft-gpu.ts) — compute shader + CPU fallback + 4 tests
- [x] 引入 shadcn/ui + Tailwind (按钮/slider/dropdown/dialog/tooltip)
- [x] 键盘快捷键（空格=播放/暂停, Cmd/Ctrl+Z=undo, 方向键=移动选择, zoom, select all）
- [x] 完善 TextGrid 标注（导入/导出 .TextGrid + tier管理 + 删除boundary/point）
- [x] Spectrogram 设置面板（FFT size、hop、window function、colormap、dynamic range、max view freq、pre-emphasis）— shadcn Dialog UI
- [x] Pitch 設置 — 完整 Viterbi path-finding（min/max Hz、voicing threshold、silence threshold、octave cost、octave-jump cost、voiced/unvoiced cost、max candidates）
- [x] Zoom & Pan 優化（滾輪zoom、trackpad橫滑pan、pinch-to-zoom、雙擊zoom in、拖動pan）
- [x] 导出 CSV/WAV（Pitch/Formant/Intensity/HNR CSV + Selection WAV + Full WAV export）
- [x] Formant tracking — Viterbi + Gaussian smoothing + median filter + configurable settings UI
- [x] 录音编辑（剪切/复制/粘贴/Undo）— AudioEditorHistory + ReplaceRangeCommand + keyboard shortcuts + toolbar buttons
- [x] Jitter/Shimmer 嗓音质量面板 — VoiceQualityPanel + pulse detection + all metrics
- [x] 滤波器（低通/高通/带通）— biquad filter + FilterPanel UI + apply/reset
- [x] 实时录音模式（streaming spectrogram）— StreamingRecorder + useStreamingRecording hook + live analysis every 250ms
- [x] 界面打磨：动画、快捷键、accessibility — button transitions, focus-visible, ARIA labels, keyboard shortcuts dialog (?)

## 规则

- 每次 cron 做一个任务
- 做完标 ✅ 移到已完成
- 更新"当前优先任务"为下一个
- npm test 必须通过
- Push 到 justinchuby-bot/web-praat
