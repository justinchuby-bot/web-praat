import { useState, useCallback } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { praatLanguage } from "../scripting/praatCodemirror";
import { runPraatScript, InterpreterResult, runJavaScript, JsRunnerResult } from "../scripting";

type ScriptLanguage = "praat" | "javascript";

interface Tab {
  id: string;
  name: string;
  language: ScriptLanguage;
  code: string;
}

interface ScriptEditorProps {
  samples?: Float32Array;
  sampleRate?: number;
}

const EXAMPLES: { name: string; language: ScriptLanguage; code: string }[] = [
  {
    name: "Formant Analysis (Praat)",
    language: "praat",
    code: `# Vowel Formant Analysis
appendInfoLine: "=== Vowel Formant Analysis ==="
appendInfoLine: ""

To Pitch: 0, 75, 600
meanF0 = Get mean: 0, 0, "Hertz"
appendInfoLine: "Mean F0: ", fixed$(meanF0, 1), " Hz"

To Formant (burg): 0, 5, 5500, 0.025, 50

appendInfoLine: ""
appendInfoLine: "Time (s)    F1 (Hz)    F2 (Hz)    F1/F2 ratio"
appendInfoLine: "--------    -------    -------    -----------"

for i from 1 to 5
  t = i * 0.1
  f1 = Get value at time: 1, t, "Hertz", "Linear"
  f2 = Get value at time: 2, t, "Hertz", "Linear"
  if f1 > 0 and f2 > 0
    ratio = f1 / f2
    appendInfoLine: fixed$(t, 2), "        ", fixed$(f1, 0), "       ", fixed$(f2, 0), "       ", fixed$(ratio, 3)
  endif
endfor

appendInfoLine: ""
appendInfoLine: "Done!"
`,
  },
  {
    name: "LPC Order Comparison (Praat)",
    language: "praat",
    code: `# Compare different LPC orders
# Higher order = more formants detected (risk of spurious peaks)
# Rule of thumb: order ≈ sr/1000 + 2

appendInfoLine: "=== LPC Order Comparison ==="
appendInfoLine: "Order    F1 (Hz)    F2 (Hz)    F3 (Hz)"
appendInfoLine: "-----    -------    -------    -------"

for order from 10 to 18
  To Formant (burg): 0, 5, 5500, 0.025, order
  f1 = Get value at time: 1, 0.2, "Hertz", "Linear"
  f2 = Get value at time: 2, 0.2, "Hertz", "Linear"
  f3 = Get value at time: 3, 0.2, "Hertz", "Linear"
  appendInfoLine: order, "        ", fixed$(f1, 0), "       ", fixed$(f2, 0), "       ", fixed$(f3, 0)
endfor

appendInfoLine: ""
appendInfoLine: "Tip: 10-12 for male, 13-15 general, 16-18 for female/child"
`,
  },
  {
    name: "Formant Analysis (JS)",
    language: "javascript",
    code: `// Vowel Formant Analysis (JavaScript API)
const pitch = praat.toPitch(praat.audio, { minPitch: 75, maxPitch: 600 });
const meanF0 = praat.getMean(pitch);
praat.log(\`Mean F0: \${meanF0.toFixed(1)} Hz\`);
praat.log("");

const formants = praat.toFormant(praat.audio, { maxFormant: 5500 });
praat.log("Time (s)    F1 (Hz)    F2 (Hz)");
praat.log("--------    -------    -------");

for (let i = 1; i <= 5; i++) {
  const t = i * 0.1;
  const f1 = praat.getFormantValue(formants, 1, t);
  const f2 = praat.getFormantValue(formants, 2, t);
  if (f1 > 0 && f2 > 0) {
    praat.log(\`\${t.toFixed(2)}        \${f1.toFixed(0)}       \${f2.toFixed(0)}\`);
  }
}
`,
  },
  {
    name: "Pitch Contour (JS)",
    language: "javascript",
    code: `// Extract pitch contour and compute statistics
const pitch = praat.toPitch(praat.audio, { minPitch: 75, maxPitch: 600 });
const values = praat.getPitchValues(pitch);
const voiced = values.filter(v => v > 0);

praat.log(\`Total frames: \${values.length}\`);
praat.log(\`Voiced frames: \${voiced.length} (\${(100*voiced.length/values.length).toFixed(1)}%)\`);
praat.log("");

if (voiced.length > 0) {
  const min = Math.min(...voiced);
  const max = Math.max(...voiced);
  const mean = voiced.reduce((a, b) => a + b) / voiced.length;
  const sorted = [...voiced].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  
  praat.log(\`Min F0:    \${min.toFixed(1)} Hz\`);
  praat.log(\`Max F0:    \${max.toFixed(1)} Hz\`);
  praat.log(\`Mean F0:   \${mean.toFixed(1)} Hz\`);
  praat.log(\`Median F0: \${median.toFixed(1)} Hz\`);
  praat.log(\`Range:     \${(max - min).toFixed(1)} Hz\`);
}
`,
  },
];

let tabCounter = 1;
function createTab(language: ScriptLanguage = "praat", code = "", name?: string): Tab {
  return {
    id: `tab-${Date.now()}-${tabCounter++}`,
    name: name || `Script ${tabCounter - 1}`,
    language,
    code,
  };
}

export function ScriptEditor({ samples, sampleRate }: ScriptEditorProps) {
  const [tabs, setTabs] = useState<Tab[]>([
    createTab("praat", EXAMPLES[0].code, "Formant Analysis"),
  ]);
  const [activeTabId, setActiveTabId] = useState(tabs[0].id);
  const [result, setResult] = useState<InterpreterResult | null>(null);
  const [jsResult, setJsResult] = useState<JsRunnerResult | null>(null);
  const [showExamples, setShowExamples] = useState(false);

  const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0];

  const updateTab = useCallback((id: string, patch: Partial<Tab>) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  }, []);

  const addTab = useCallback((language: ScriptLanguage = "praat", code = "", name?: string) => {
    const tab = createTab(language, code, name);
    setTabs(prev => [...prev, tab]);
    setActiveTabId(tab.id);
    setResult(null);
    setJsResult(null);
  }, []);

  const closeTab = useCallback((id: string) => {
    setTabs(prev => {
      const next = prev.filter(t => t.id !== id);
      if (next.length === 0) {
        const fresh = createTab();
        next.push(fresh);
      }
      if (activeTabId === id) {
        setActiveTabId(next[next.length - 1].id);
      }
      return next;
    });
    setResult(null);
    setJsResult(null);
  }, [activeTabId]);

  const noAudioLoaded = !samples || samples.length === 0;

  const handleRun = () => {
    if (activeTab.language === "praat") {
      const r = runPraatScript(activeTab.code, samples && sampleRate ? { samples, sampleRate } : undefined);
      setResult(r);
      setJsResult(null);
    } else {
      const context = { samples: samples ?? new Float32Array(0), sampleRate: sampleRate ?? 44100 };
      const r = runJavaScript(activeTab.code, context);
      setJsResult(r);
      setResult(null);
    }
  };

  const onCodeChange = useCallback((val: string) => {
    updateTab(activeTabId, { code: val });
  }, [activeTabId, updateTab]);

  const hasErrors = activeTab.language === "praat"
    ? (result?.errors?.length ?? 0) > 0
    : (jsResult?.errors?.length ?? 0) > 0;

  const output = activeTab.language === "praat" ? result?.output : jsResult?.output;
  const errors = activeTab.language === "praat"
    ? result?.errors
    : jsResult?.errors?.map(e => ({ line: 0, message: e.message }));

  const extensions = activeTab.language === "javascript" ? [javascript()] : [praatLanguage];

  return (
    <div className="script-editor-root">
      {/* Tab bar */}
      <div className="script-tab-bar">
        <div className="script-tabs-scroll">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`script-file-tab ${tab.id === activeTabId ? "active" : ""}`}
              onClick={() => { setActiveTabId(tab.id); setResult(null); setJsResult(null); }}
            >
              <span className="script-file-tab-lang">{tab.language === "praat" ? "P" : "JS"}</span>
              <span className="script-file-tab-name">{tab.name}</span>
              {tabs.length > 1 && (
                <button
                  className="script-file-tab-close"
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button className="script-tab-add" onClick={() => addTab()}>+</button>
        </div>
        <div className="script-tab-actions">
          <select
            value={activeTab.language}
            onChange={(e) => updateTab(activeTabId, { language: e.target.value as ScriptLanguage })}
            className="script-lang-select"
          >
            <option value="praat">Praat</option>
            <option value="javascript">JavaScript</option>
          </select>
          <button className="script-examples-btn" onClick={() => setShowExamples(!showExamples)}>
            📄 Examples
          </button>
          <button onClick={handleRun} className="script-run-btn">▶ Run</button>
        </div>
      </div>

      {/* Examples dropdown */}
      {showExamples && (
        <div className="script-examples-dropdown">
          {EXAMPLES.map((ex, i) => (
            <button
              key={i}
              className="script-example-item"
              onClick={() => {
                addTab(ex.language, ex.code, ex.name);
                setShowExamples(false);
              }}
            >
              <span className="script-example-lang">{ex.language === "praat" ? "P" : "JS"}</span>
              {ex.name}
            </button>
          ))}
        </div>
      )}

      {noAudioLoaded && (
        <div className="script-warning">
          ⚠️ No audio loaded — analysis commands require a sound file.
        </div>
      )}

      <div className="script-editor-body">
        <CodeMirror
          key={activeTabId}
          value={activeTab.code}
          onChange={onCodeChange}
          extensions={extensions}
          theme={oneDark}
          height="100%"
          style={{ flex: 1, minHeight: 0, overflow: 'auto' }}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLineGutter: true,
            tabSize: 2,
          }}
        />
      </div>

      {(result || jsResult) && (
        <div className="script-output">
          {hasErrors ? (
            <div className="script-errors">
              {errors?.map((e, i) => (
                <div key={i}>
                  {e.line > 0 ? `Line ${e.line}: ` : ""}
                  {e.message}
                </div>
              ))}
            </div>
          ) : (
            <div className="script-output-text">
              {output || "(no output)"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
