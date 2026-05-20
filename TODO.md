# Web Praat — Development TODO

## 目标
1:1 还原 Praat (https://github.com/praat/praat.github.io) 的所有功能。可以改善用户体验和界面，但功能必须完整覆盖。如果发现 Praat 有的功能我们没有，自动加到 backlog。

**Working dir:** ~/clawspace/web-praat/
**Repo:** justinchuby-bot/web-praat (public)
**参考源码:** ~/clawspace/praat.github.io/

## 当前状态

- **458 tests**, 70+ 源文件, 10000+ 行 TypeScript
- **React 19 + TypeScript 6 + Vite 8 + vitest 4.1**
- Coverage: 84% statements, 93% audio module
- Build: 467KB / 145KB gzip
- **Praat Script interpreter: 998 lines** — 连接真实音频分析引擎（LPC formant + autocorrelation pitch）
- **Plugin 系统** — 加载 .praat 文件作为 plugin，内置 Vowel Space + Jitter/Shimmer

## 当前优先任务

- [ ] **Pulses (PointProcess)** — 声门脉冲检测 + 可视化 overlay + Pulses 菜单（Show pulses, Voice report, Jitter/Shimmer from pulses）
- [ ] **Praat Editor 菜单补全** — Query 菜单（Get cursor, Get spectral power, Pitch/Formant listing）、Pulses 菜单、Select 菜单（Move cursor to zero crossing）
- [ ] **SpellingChecker** — WordList-based 拼写检查

## Backlog（按优先级）

### 高优先
- [ ] JS API: `praat.intensity()`, `praat.spectrogram()`, `praat.textGrid.*`
- [ ] JS API: `praat.mfcc()`, `praat.resample()`, `praat.getMin/getMax()`
- [ ] JS API: `praat.fft()` / `praat.ifft()` — 直接频域访问
- [ ] MCP Server — 把 audio analysis 暴露为 MCP tools
- [x] **波形交互改进** — region selection (draggable edges + move)、minimap (viewport nav)、drag选区
- [ ] Excitation pattern
- [ ] SpeechSynthesizer（TTS）

### 中优先（借鉴 Tony + ELAN）
- [x] Hierarchical tiers（tier parent-child 关系）
- [x] ELAN (.eaf) 导入导出
- [x] Video sync（标注跟视频对齐）
- [x] Controlled vocabulary（标注预定义词表）

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
- [x] **BottomSheet wiring** — useIsMobile hides Sidebar+RightSidebar on mobile, shows BottomSheet FAB with overlay toggles + settings
- [x] **React 性能优化** — React.memo on heavy components + ref patterns
- [x] **全功能集成到 UI** — Tools 菜单入口（所有 9 个新组件）
- [x] **Deps 全线升级** — React 19, TS 6, Vite 8, vitest 4.1
- [x] **Code cleanup** — 删除 6 unused 文件 (-602 行) + dead code
- [x] **AudioWorkletNode migration** — streamingRecorder.ts: ScriptProcessorNode → AudioWorkletNode (no more Chrome deprecation warning)
- [x] **自动 IPA 标注** — F1/F2 Bark-scale 分类 + 20 参考元音 + View toggle
- [x] **Formant 显示修复** — 曲线加粗 (2.5px) + 圆点标记 + 确认跟语谱图 maxDisplayFreq 匹配
- [x] **MenuBar hover 切换** — Radix Menubar 原生支持 hover 切换 + pointer grace area (triangle trick)
- [x] **布局修复** — 波形/語谱图区域 flex:7 (~65% 高度) + TextGrid flex:3 (可滚动) + RightSidebar 默认折叠 tab 切换
- [x] **JS API 补全** — spectrogram, mfcc, fft/ifft, textGrid.* (+ existing intensity, resample, getMin/getMax)
- [x] **Shiki 语法高亮** — TextMate grammar for Praat Script + Shiki overlay in ScriptEditor (JS uses built-in)
- [x] **MCP Server** — 9 tools (pitch, formants, intensity, harmonicity, voice quality, spectrum, vowels, praat script, JS script) via @modelcontextprotocol/sdk + stdio transport
- [x] **WebGPU FFT 接入** — fft-adapter.ts 统一接口; analysis worker 自动探测 WebGPU 并切换 GPU FFT; CPU fallback 透明; 5 新测试
- [x] **波形交互改进** — region selection (draggable edges + move)、minimap (viewport nav)、drag选区
- [x] **Excitation pattern** — Spectrum → Bark-band power → auditory masking convolution → phon; RightSidebar tab + loudness (sones)
- [x] **Pitch sonification** — sine/hum/pulse 三模式 + WAV 导出 + 7 tests (355 total)
- [x] **Note transcription** — Hz→MIDI, note names, cents deviation, pitch track → note events + export TXT + UI panel (375 tests)
- [x] **Hierarchical tiers** — parentId on tiers, hierarchy.ts (validate, tree, cycle detection), TextGridEditor indentation + Set Parent UI, 23 tests (398 total)
- [x] **ELAN (.eaf) 导入导出** — parseElan (XML→TextGrid) + serializeElan (TextGrid→XML) + parent tier mapping + 15 tests (413 total)
- [x] **Video sync** — VideoSync component in RightSidebar; load video, extract audio, bidirectional time sync (muted video + main audio); 6 tests (419 total)
- [x] **Controlled vocabulary** — vocabulary.ts (create/parse/serialize/validate/autocomplete) + ControlledVocabularyEditor UI (manage, import/export, tier bindings, strict mode) + RightSidebar 'Vocab' tab; 16 new tests (435 total)
- [x] **Spectrum Slice dB 修复** — FFT magnitude 用 dB 刻度; LPC envelope 不再双重 log; 两曲线共享 scale
- [x] **波形图点击更新 spectrum slice** — 不再只有语谱图能触发
- [x] **空格键播放修复** — 修 stale closure bug，现在从光标位置播放
- [x] **侧边栏可折叠** — ‹/› 按钮收起/展开，动画过渡
- [x] **主题一致性** — 所有 modal/dialog/command palette 用统一 CSS vars，切主题不会出现白块
- [x] **Plugin 系统** — 加载 .praat 脚本作为 plugin; 内置 Vowel Space + Jitter/Shimmer; Tools > 🧩 Plugins
- [x] **Praat Script interpreter 大升级** — 386→998行; include/dot-local vars/向量数组/Table操作/selectObject/nocheck/字符串插值/线性回归
- [x] **FastTrack include registry + Table ops** — registerInclude/registerIncludes, command-call assignment parsing (var = Get...), Append row/Set numeric/Set string/Get string/Get column index/Sort rows/Get min-max/Get stdev/Create Table with column names
- [x] **Interpreter 连接真实引擎** — To Formant/To Pitch/Get value at time/Get mean 调用真实 LPC + autocorrelation 分析
- [x] **FastTrack 端到端跑通** — polynomial fitting (Fit polynomial/Get fitting error) + select Type Name fix + Remove column + Extract rows where + full fitting loop
- [x] **Spectrum Slice UX** — formant peak markers (F1/F2/F3) + dB axis labels + hover cursor readout

## 规则

- 每次 cron 做一个任务
- 做完标 ✅ 移到已完成
- 更新"当前优先任务"为下一个
- npm test 必须通过
- npx tsc --noEmit 必须 0 errors
- npm run build 必须通过
- Push 到 justinchuby-bot/web-praat
