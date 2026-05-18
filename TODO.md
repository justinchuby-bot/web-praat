# Web Praat — Development TODO

## 目标
1:1 还原 Praat (https://github.com/praat/praat.github.io) 的所有功能。可以改善用户体验和界面，但功能必须完整覆盖。如果发现 Praat 有的功能我们没有，自动加到 backlog。

**Working dir:** ~/clawspace/web-praat/
**Repo:** justinchuby-bot/web-praat (public)
**参考源码:** ~/clawspace/praat.github.io/


## 当前優先任務

- [ ] 导出 CSV/WAV

## Backlog（按優先級）
- [ ] 录音编辑（剪切/复制/粘贴/Undo）
- [ ] Jitter/Shimmer 嗓音质量面板
- [ ] 滤波器（低通/高通/带通）
- [ ] 实时录音模式（streaming spectrogram）
- [ ] 界面打磨：动画、快捷键、accessibility
- [ ] React 性能优化：修复 useMemo/useCallback 依赖问题（settings 对象引用、无意义 useMemo）
- [ ] 性能优化：Web Worker for heavy DSP
- [ ] 移动端适配

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
- [x] Formant tracking — Viterbi + Gaussian smoothing + median filter + configurable settings UI

## 规则

- 每次 cron 做一个任务
- 做完标 ✅ 移到已完成
- 更新"当前优先任务"为下一个
- npm test 必须通过
- Push 到 justinchuby-bot/web-praat
