import { useState, useRef } from "react";
import { runPraatScript, InterpreterResult } from "../scripting";

export function ScriptEditor() {
  const [code, setCode] = useState(
    `# Praat Script Example\nfor i from 1 to 5\n  appendInfoLine: "Iteration ", i\nendfor\n`
  );
  const [result, setResult] = useState<InterpreterResult | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleRun = () => {
    const r = runPraatScript(code);
    setResult(r);
  };

  const lineNumbers = code.split("\n").map((_, i) => i + 1);

  return (
    <div className="flex flex-col h-full border rounded-lg overflow-hidden bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Praat Script
        </span>
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
            placeholder="Enter Praat Script code..."
          />
        </div>

        {/* Output */}
        {result && (
          <div className="h-48 overflow-auto border-t">
            {result.errors.length > 0 ? (
              <div className="p-3 text-sm text-red-600 dark:text-red-400 font-mono">
                {result.errors.map((e, i) => (
                  <div key={i}>
                    {e.line > 0 ? `Line ${e.line}: ` : ""}
                    {e.message}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 text-sm font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                {result.output || "(no output)"}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
