# Web Praat — Development TODO

## 目标
1:1 还原 Praat (https://github.com/praat/praat.github.io) 的所有功能。可以改善用户体验和界面，但功能必须完整覆盖。如果发现 Praat 有的功能我们没有，自动加到 backlog。

**Working dir:** ~/clawspace/web-praat/
**Repo:** justinchuby-bot/web-praat (public)
**参考源码:** ~/clawspace/praat.github.io/

## 当前状态

- **198 tests**, 70+ 源文件, 9000+ 行 TypeScript
- **React 19 + TypeScript 6 + Vite 8 + vitest 4.1**
- Coverage: 84% statements, 93% audio module
- Build: 446KB / 139KB gzip

## 当前优先任务

- [ ] **自动 IPA 标注** — 根据 F1/F2 值自动在语谱图/波形图上标注国际音标元音符号
- [ ] **MenuBar hover 切换** — 打开菜单后 hover 其他菜单项立即切换；实现 Amazon triangle trick（防止斜向移动误触发切换）
- [ ] **布局修复**：波形/语谱图区域默认应占主视图 60-70% 高度；下方面板（Spectrum Slice/Voice Quality/HNR/Rhythm）默认折叠或 tab 切换，不同时全部展开挤占空间
- [ ] Wire BottomSheet + useIsMobile to App.tsx（移动端显示 BottomSheet 替代 Sidebar）
- [ ] JS API 补全（intensity, spectrogram, textGrid, mfcc, resample, getMin/getMax, fft/ifft）
- [ ] Shiki 语法高亮（Praat Script TextMate grammar）
- [ ] MCP Server 层（暴露语音分析给 AI agent）

## Backlog（按优先级）

### 高优先
- [ ] JS API: `praat.intensity()`, `praat.spectrogram()`, `praat.textGrid.*`
- [ ] JS API: `praat.mfcc()`, `praat.resample()`, `praat.getMin/getMax()`
- [ ] JS API: `praat.fft()` / `praat.ifft()` — 直接频域访问
- [ ] MCP Server — 把 audio analysis 暴露为 MCP tools
- [ ] 参考 wavesurfer.js 改进波形交互（region selection、minimap）
- [ ] Excitation pattern
- [ ] SpeechSynthesizer（TTS）

### 中优先（借鉴 Tony + ELAN）
- [ ] Pitch sonification（听 pitch track，验证准确性）
- [ ] Note transcription（pitch → 音符/半音）
- [ ] Hierarchical tiers（tier parent-child 关系）
- [ ] ELAN (.eaf) 导入导出
- [ ] Video sync（标注跟视频对齐）
- [ ] Controlled vocabulary（标注预定义词表）

### 低优先
- [ ] SpellingChecker
- [ ] Distributions & Transition（统计）
- [ ] Polygon / Photo / Movie 支持

## 已完成 ✅

- [x] 基础框架 (React 19 + TypeScript 6 + Vite 8)
- [x] 波形图 (Waveform)
- [x] 语谱图 (Spectrogram, STFT)
- [x] Pitch/F0 overlay (autocorrelation + Viterbi)
- [x] Formant overlay (Burg LPC) + Formant tracking (Viterbi + smoothing)
- [x] Intensity curve (RMS)
- [x] 录音 + 文件加载
- [x] 播放/暂停 + 实时光标
- [x] 深色主题 UI (Audacity/Logic Pro style)
- [x] WebGPU FFT 加速 + CPU fallback
- [x] shadcn/ui + Tailwind
- [x] 键盘快捷键
- [x] TextGrid 标注（导入/导出 .TextGrid + tier管理）
- [x] Spectrogram/Pitch/Formant 设置面板
- [x] Zoom & Pan（滚轮/trackpad/pinch/拖动）
- [x] 导出 CSV/WAV
- [x] 录音编辑（剪切/复制/粘贴/Undo/Redo）
- [x] Jitter/Shimmer 嗓音质量面板
- [x] 滤波器（低通/高通/带通/notch + Butterworth 高阶）
- [x] 实时录音模式（streaming spectrogram）
- [x] **录音卡顿修复** — Web Worker 移 DSP 出 main thread
- [x] **UI 重新设计** — Lucide icons + MenuBar + Toolbar + StatusBar + 深色专业风格
- [x] **Manipulation** — TD-PSOLA pitch/duration 编辑 + 重合成
- [x] **LTAS** — Long-Term Average Spectrum
- [x] **Harmonicity (HNR)** — autocorrelation method
- [x] **PointProcess** — 声门脉冲检测
- [x] **Sound enhance** — 降噪 (spectral subtraction) + 预加重 + 去静音
- [x] **Cochleagram** — 听觉频谱图 (Bark/ERB scale, gammatone filter bank)
- [x] **VocalTract** — Kelly-Lochbaum 声道面积模型 + 交互式编辑器 + 元音预设
- [x] **Spectrum Editor** — 频域编辑 + 手绘 gain 曲线 + 预设滤波 + IFFT
- [x] **Tier Editors** — PitchTier + FormantGrid + DurationTier + AmplitudeTier (共享 TierEditorBase)
- [x] **ExperimentMFC** — 感知实验设计器 + 运行器 + CSV 导出
- [x] **Praat Script 引擎** — lexer + parser + interpreter (for/while/if/procedure)
- [x] **JavaScript Scripting** — `praat.*` API + 沙箱 + 语言切换 tab
- [x] **移动端适配** — 响应式布局 + 触摸手势 + BottomSheet
- [x] **React 性能优化** — React.memo on heavy components + ref patterns
- [x] **全功能集成到 UI** — Tools 菜单入口（所有 9 个新组件）
- [x] **Deps 全线升级** — React 19, TS 6, Vite 8, vitest 4.1
- [x] **Code cleanup** — 删除 6 unused 文件 (-602 行) + dead code
- [x] **AudioWorkletNode migration** — streamingRecorder.ts: ScriptProcessorNode → AudioWorkletNode (no more Chrome deprecation warning)
- [x] **Formant 显示修复** — 曲线加粗 (2.5px) + 圆点标记 + 确认跟语谱图 maxDisplayFreq 匹配

## 规则

- 每次 cron 做一个任务
- 做完标 ✅ 移到已完成
- 更新"当前优先任务"为下一个
- npm test 必须通过
- npx tsc --noEmit 必须 0 errors
- npm run build 必须通过
- Push 到 justinchuby-bot/web-praat
