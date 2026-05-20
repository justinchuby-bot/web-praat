import { useState, useCallback } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { runPraatScript, InterpreterResult, runJavaScript, JsRunnerResult } from "../scripting";

type ScriptLanguage = "praat" | "javascript";

interface ScriptEditorProps {
  samples?: Float32Array;
  sampleRate?: number;
}

export function ScriptEditor({ samples, sampleRate }: ScriptEditorProps) {
  const [language, setLanguage] = useState<ScriptLanguage>("praat");
  const [result, setResult] = useState<InterpreterResult | null>(null);
  const [jsResult, setJsResult] = useState<JsRunnerResult | null>(null);

  const praatExample = `# Vowel Formant Analysis
# Analyze the loaded audio and report pitch + formant statistics

appendInfoLine: "=== Vowel Formant Analysis ==="
appendInfoLine: ""

# Pitch analysis
To Pitch: 0, 75, 600
meanF0 = Get mean: 0, 0, "Hertz"
appendInfoLine: "Mean F0: ", fixed$(meanF0, 1), " Hz"

# Formant analysis
To Formant (burg): 0, 5, 5500, 0.025, 50

# Sample formants at multiple time points
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
appendInfoLine: "Done! Tip: F1 correlates with vowel height, F2 with frontness."
`;

  const jsExample = `// Vowel Formant Analysis
// Analyze the loaded audio and report pitch + formant statistics

const pitch = praat.toPitch(praat.audio, { minPitch: 75, maxPitch: 600 });
const meanF0 = praat.getMean(pitch);
praat.log("=== Vowel Formant Analysis ===");
praat.log("");
praat.log(\`Mean F0: \${meanF0.toFixed(1)} Hz\`);

// Formant analysis
const formants = praat.toFormant(praat.audio, { maxFormant: 5500 });

praat.log("");
praat.log("Time (s)    F1 (Hz)    F2 (Hz)    F1/F2 ratio");
praat.log("--------    -------    -------    -----------");

// Sample formants at multiple time points
for (let i = 1; i <= 5; i++) {
  const t = i * 0.1;
  const f1 = praat.getFormantValue(formants, 1, t);
  const f2 = praat.getFormantValue(formants, 2, t);
  if (f1 > 0 && f2 > 0) {
    const ratio = (f1 / f2).toFixed(3);
    praat.log(\`\${t.toFixed(2)}        \${f1.toFixed(0)}       \${f2.toFixed(0)}       \${ratio}\`);
  }
}

praat.log("");
praat.log("Done! Tip: F1 correlates with vowel height, F2 with frontness.");
`;

  const [code, setCode] = useState(praatExample);

  const handleLanguageChange = (lang: ScriptLanguage) => {
    setLanguage(lang);
    setResult(null);
    setJsResult(null);
    if (lang === "praat" && code === jsExample) {
      setCode(praatExample);
    } else if (lang === "javascript" && code === praatExample) {
      setCode(jsExample);
    }
  };

  const noAudioLoaded = !samples || samples.length === 0;

  const handleRun = () => {
    if (language === "praat") {
      const r = runPraatScript(code, samples && sampleRate ? { samples, sampleRate } : undefined);
      setResult(r);
      setJsResult(null);
    } else {
      const context = {
        samples: samples ?? new Float32Array(0),
        sampleRate: sampleRate ?? 44100,
      };
      const r = runJavaScript(code, context);
      setJsResult(r);
      setResult(null);
    }
  };

  const onCodeChange = useCallback((val: string) => setCode(val), []);

  const hasErrors = language === "praat"
    ? (result?.errors?.length ?? 0) > 0
    : (jsResult?.errors?.length ?? 0) > 0;

  const output = language === "praat"
    ? result?.output
    : jsResult?.output;

  const errors = language === "praat"
    ? result?.errors
    : jsResult?.errors?.map(e => ({ line: 0, message: e.message }));

  const extensions = language === "javascript" ? [javascript()] : [];

  return (
    <div className="script-editor-root">
      <div className="script-editor-toolbar">
        <div className="script-editor-tabs">
          <button
            onClick={() => handleLanguageChange("praat")}
            className={`script-tab ${language === "praat" ? "active" : ""}`}
          >
            Praat Script
          </button>
          <button
            onClick={() => handleLanguageChange("javascript")}
            className={`script-tab ${language === "javascript" ? "active" : ""}`}
          >
            JavaScript
          </button>
        </div>
        <button onClick={handleRun} className="script-run-btn">
          ▶ Run
        </button>
      </div>

      {noAudioLoaded && (
        <div className="script-warning">
          ⚠️ No audio loaded — analysis commands require a sound file.
        </div>
      )}

      <div className="script-editor-body">
        <CodeMirror
          value={code}
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
