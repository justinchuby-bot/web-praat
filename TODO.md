# Web Praat — Development TODO

**Working dir:** ~/clawspace/web-praat/
**Repo:** justinchuby-bot/web-praat (public)
**参考源码:** ~/clawspace/praat.github.io/

## 基础设施

- [ ] 引入 shadcn/ui + Tailwind (按钮/slider/dropdown/dialog/tooltip)

## 当前优先任务

- [ ] WebGPU FFT 加速 (src/utils/fft-gpu.ts)
  - Compute shader 实现并行 FFT
  - 不支持 WebGPU 时 fallback 到 CPU FFT
  - 测试：结果跟 CPU 版本一致

## Backlog（按优先级）

- [ ] 键盘快捷键（空格=播放/暂停, Cmd+Z=undo, 方向键=移动选择）

- [ ] 完善 TextGrid 标注（导入/导出 .TextGrid 格式）
- [ ] Zoom & Pan 优化（鼠标滚轮、拖动、fit to window）
- [ ] Spectrogram 设置面板（FFT size、hop、colormap、dynamic range）
- [ ] Pitch 设置（min/max Hz、voicing threshold）
- [ ] Formant tracking（帧间平滑，连续轨迹）
- [ ] 导出 CSV/WAV
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

## 规则

- 每次 cron 做一个任务
- 做完标 ✅ 移到已完成
- 更新"当前优先任务"为下一个
- npm test 必须通过
- Push 到 justinchuby-bot/web-praat
