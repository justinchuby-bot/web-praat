import { useState, useRef } from 'react';
import { runPraatScript } from '../scripting';

interface BatchProcessProps {
  onClose: () => void;
}

interface BatchResult {
  filename: string;
  output: string;
  errors: string[];
}

const DEFAULT_SCRIPT = `# Batch script — runs once per file
# Available variables: filename$, duration
# Use appendInfoLine to output data (becomes CSV rows)

appendInfoLine: filename$

To Pitch: 0, 75, 600
meanF0 = Get mean: 0, 0, "Hertz"

To Formant (burg): 0, 5, 5500, 0.025, 50
f1 = Get value at time: 1, duration/2, "Hertz", "Linear"
f2 = Get value at time: 2, duration/2, "Hertz", "Linear"

appendInfoLine: fixed$(meanF0, 2), ",", fixed$(f1, 0), ",", fixed$(f2, 0)
`;

export function BatchProcess({ onClose }: BatchProcessProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelectFiles = () => {
    inputRef.current?.click();
  };

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList) {
      setFiles(Array.from(fileList).filter(f => f.type.startsWith('audio/')));
    }
  };

  const handleRun = async () => {
    if (files.length === 0) return;
    setRunning(true);
    setResults([]);
    setProgress(0);

    const batchResults: BatchResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(Math.round((i / files.length) * 100));

      try {
        // Decode audio
        const arrayBuffer = await file.arrayBuffer();
        const audioCtx = new OfflineAudioContext(1, 1, 44100);
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const samples = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;

        // Run script — prepend filename$ and duration variables
        const preamble = `filename$ = "${file.name}"\nduration = ${audioBuffer.duration}\n`;
        const result = runPraatScript(preamble + script, {
          samples: new Float32Array(samples),
          sampleRate,
        });

        batchResults.push({
          filename: file.name,
          output: result.output,
          errors: result.errors?.map(e => `Line ${e.line}: ${e.message}`) ?? [],
        });
      } catch (err) {
        batchResults.push({
          filename: file.name,
          output: '',
          errors: [err instanceof Error ? err.message : String(err)],
        });
      }

      // Yield to UI
      await new Promise(r => setTimeout(r, 0));
    }

    setResults(batchResults);
    setProgress(100);
    setRunning(false);
  };

  const handleExportCsv = () => {
    const lines = results
      .filter(r => r.errors.length === 0)
      .map(r => r.output.trim())
      .join('\n');
    const blob = new Blob([lines + '\n'], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'batch_results.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel modal-panel-lg" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2 style={{ margin: '0 0 12px', fontSize: '18px' }}>📂 Batch Process</h2>

        <div style={{ display: 'flex', gap: '16px', height: '450px' }}>
          {/* Left: script */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ fontSize: '12px', marginBottom: '6px', color: 'var(--text-dim)' }}>
              Script (runs once per file):
            </div>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              style={{
                flex: 1,
                fontFamily: 'monospace',
                fontSize: '12px',
                padding: '8px',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                resize: 'none',
                background: 'var(--bg-base)',
                color: 'var(--text)',
              }}
              spellCheck={false}
            />
          </div>

          {/* Right: files + results */}
          <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input
              ref={inputRef}
              type="file"
              accept="audio/*"
              multiple
              hidden
              onChange={handleFilesChange}
            />
            <button
              onClick={handleSelectFiles}
              style={{
                padding: '8px',
                fontSize: '13px',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                background: 'var(--bg-surface)',
                color: 'var(--text)',
                cursor: 'pointer',
              }}
            >
              📁 Select Audio Files ({files.length})
            </button>

            {files.length > 0 && (
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', maxHeight: '80px', overflow: 'auto' }}>
                {files.map((f, i) => <div key={i}>{f.name}</div>)}
              </div>
            )}

            <button
              onClick={handleRun}
              disabled={running || files.length === 0}
              style={{
                padding: '8px',
                fontSize: '13px',
                border: 'none',
                borderRadius: '6px',
                background: running ? 'var(--text-dim)' : 'var(--accent, #89b4fa)',
                color: '#fff',
                cursor: running ? 'default' : 'pointer',
              }}
            >
              {running ? `Processing… ${progress}%` : '▶ Run Batch'}
            </button>

            {running && (
              <div style={{ height: '3px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent, #89b4fa)', transition: 'width 0.2s' }} />
              </div>
            )}

            {results.length > 0 && (
              <>
                <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '8px' }}>
                  Results: {results.filter(r => r.errors.length === 0).length}/{results.length} succeeded
                </div>
                <div style={{ flex: 1, overflow: 'auto', fontSize: '11px', fontFamily: 'monospace', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '4px', padding: '6px' }}>
                  {results.map((r, i) => (
                    <div key={i} style={{ marginBottom: '4px', color: r.errors.length > 0 ? '#ef4444' : 'var(--text)' }}>
                      <strong>{r.filename}</strong>
                      {r.errors.length > 0
                        ? <div>{r.errors[0]}</div>
                        : <div>{r.output.trim().split('\n').slice(-1)[0]}</div>
                      }
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleExportCsv}
                  style={{
                    padding: '6px',
                    fontSize: '12px',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    background: 'var(--bg-surface)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                  }}
                >
                  📥 Export Results CSV
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
