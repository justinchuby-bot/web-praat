import { useState, useRef } from "react";
import { runPraatScript, InterpreterResult, runJavaScript, JsRunnerResult } from "../scripting";

type ScriptLanguage = "praat" | "javascript";

interface ScriptEditorProps {
  samples?: Float32Array;
  sampleRate?: number;
}

export function ScriptEditor({ samples, sampleRate }: ScriptEditorProps) {
  const [language, setLanguage] = useState<ScriptLanguage>("praat");
  const [code, setCode] = useState(
    `# Praat Script Example\nfor i from 1 to 5\n  appendInfoLine: "Iteration ", i\nendfor\n`
  );
  const [result, setResult] = useState<InterpreterResult | null>(null);
  const [jsResult, setJsResult] = useState<JsRunnerResult | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const jsExample = `// JavaScript Example
const pitch = praat.toPitch(praat.audio, { minPitch: 75, maxPitch: 600 });
const mean = praat.getMean(pitch, 0, 0);
praat.log(\`Mean F0 = \${mean} Hz\`);
`;

  const handleLanguageChange = (lang: ScriptLanguage) => {
    setLanguage(lang);
    setResult(null);
    setJsResult(null);
    if (lang === "praat" && code === jsExample) {
      setCode(`# Praat Script Example\nfor i from 1 to 5\n  appendInfoLine: "Iteration ", i\nendfor\n`);
    } else if (lang === "javascript" && code.startsWith("# Praat")) {
      setCode(jsExample);
    }
  };

  const handleRun = () => {
    if (language === "praat") {
      const r = runPraatScript(code);
      setResult(r);
      setJsResult(null);
    } else {
      // JS mode — provide empty audio context if no audio loaded
      const context = {
        samples: samples ?? new Float32Array(0),
        sampleRate: sampleRate ?? 44100,
      };
      const r = runJavaScript(code, context);
      setJsResult(r);
      setResult(null);
    }
  };

  const lineNumbers = code.split("\n").map((_, i) => i + 1);

  const hasErrors = language === "praat"
    ? (result?.errors?.length ?? 0) > 0
    : (jsResult?.errors?.length ?? 0) > 0;

  const output = language === "praat"
    ? result?.output
    : jsResult?.output;

  const errors = language === "praat"
    ? result?.errors
    : jsResult?.errors?.map(e => ({ line: 0, message: e.message }));

  return (
    <div className="flex flex-col h-full border rounded-lg overflow-hidden bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b">
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleLanguageChange("praat")}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              language === "praat"
                ? "bg-blue-600 text-white"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            Praat Script
          </button>
          <button
            onClick={() => handleLanguageChange("javascript")}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              language === "javascript"
                ? "bg-yellow-600 text-white"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            JavaScript
          </button>
        </div>
        <button
          onClick={handleRun}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          ▶ Run
        </button>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {/* Editor */}
        <div className="flex-1 flex min-h-0 border-b">
          <div className="py-2 px-2 text-right text-xs text-gray-400 select-none font-mono leading-5 bg-gray-50 dark:bg-gray-850 overflow-hidden">
            {lineNumbers.map((n) => (
              <div key={n}>{n}</div>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="flex-1 p-2 font-mono text-sm leading-5 resize-none outline-none bg-transparent dark:text-gray-100"
            spellCheck={false}
            placeholder={language === "praat" ? "Enter Praat Script code..." : "Enter JavaScript code..."}
          />
        </div>

        {/* Output */}
        {(result || jsResult) && (
          <div className="h-48 overflow-auto border-t">
            {hasErrors ? (
              <div className="p-3 text-sm text-red-600 dark:text-red-400 font-mono">
                {errors?.map((e, i) => (
                  <div key={i}>
                    {e.line > 0 ? `Line ${e.line}: ` : ""}
                    {e.message}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 text-sm font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                {output || "(no output)"}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
