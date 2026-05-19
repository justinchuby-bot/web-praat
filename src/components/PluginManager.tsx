import { useState } from 'react';
import { getPlugins, getPlugin, runPlugin, loadUserPlugin, PluginManifest } from '../plugins';

interface PluginManagerProps {
  onClose: () => void;
  samples?: Float32Array;
  sampleRate?: number;
}

export function PluginManager({ onClose, samples, sampleRate }: PluginManagerProps) {
  const [plugins] = useState(getPlugins);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [params, setParams] = useState<Record<string, number>>({});
  const [output, setOutput] = useState<string>('');
  const [errors, setErrors] = useState<string[]>([]);

  const selected = selectedId ? getPlugin(selectedId) : null;

  function handleSelect(plugin: PluginManifest) {
    setSelectedId(plugin.id);
    setOutput('');
    setErrors([]);
    // Initialize params with defaults
    const defaults: Record<string, number> = {};
    plugin.parameters.forEach(p => { defaults[p.name] = p.default; });
    setParams(defaults);
  }

  function handleRun() {
    if (!selected) return;
    const audio = samples && sampleRate ? { samples, sampleRate } : undefined;
    const result = runPlugin(selected, params, audio);
    setOutput(result.output);
    setErrors(result.errors || []);
  }

  function handleLoadFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.praat,.txt';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const plugin = loadUserPlugin(file.name, text);
      if (plugin) {
        handleSelect(plugin);
      } else {
        setErrors(['Failed to parse plugin. Make sure it has a "# Plugin: Name" header.']);
      }
    };
    input.click();
  }

  const categoryIcons: Record<string, string> = {
    formant: '🔴',
    pitch: '🔵',
    voice: '🟢',
    rhythm: '🟡',
    other: '⚪',
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content plugin-manager" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%' }}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 style={{ margin: '0 0 16px', fontSize: '18px' }}>🧩 Plugins</h2>

        <div style={{ display: 'flex', gap: '16px', height: '500px' }}>
          {/* Plugin list */}
          <div style={{ width: '220px', overflowY: 'auto', borderRight: '1px solid var(--border)', paddingRight: '12px' }}>
            <button
              onClick={handleLoadFile}
              style={{ width: '100%', marginBottom: '12px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text)' }}
            >
              📂 Load .praat plugin
            </button>

            {plugins.map(p => (
              <div
                key={p.id}
                onClick={() => handleSelect(p)}
                style={{
                  padding: '8px 10px',
                  marginBottom: '4px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: selectedId === p.id ? 'var(--accent-muted, rgba(137,180,250,0.15))' : 'transparent',
                  border: selectedId === p.id ? '1px solid var(--accent, #89b4fa)' : '1px solid transparent',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 500 }}>
                  {categoryIcons[p.category]} {p.name}
                </div>
                <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '2px' }}>{p.description.slice(0, 60)}</div>
              </div>
            ))}
          </div>

          {/* Plugin detail + runner */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {selected ? (
              <>
                <div style={{ marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px' }}>{selected.name} <span style={{ fontSize: '12px', opacity: 0.5 }}>v{selected.version}</span></h3>
                  <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>{selected.description}</div>
                  <div style={{ fontSize: '11px', opacity: 0.5, marginTop: '2px' }}>by {selected.author}</div>
                </div>

                {/* Parameters */}
                {selected.parameters.length > 0 && (
                  <div style={{ marginBottom: '12px', padding: '10px', background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>Parameters</div>
                    {selected.parameters.map(p => (
                      <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <label style={{ fontSize: '12px', width: '160px', flexShrink: 0 }}>{p.label}</label>
                        <input
                          type="number"
                          value={params[p.name] ?? p.default}
                          min={p.min}
                          max={p.max}
                          step={p.step}
                          onChange={e => setParams(prev => ({ ...prev, [p.name]: parseFloat(e.target.value) || 0 }))}
                          style={{ width: '80px', padding: '3px 6px', fontSize: '12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '3px', color: 'var(--text)' }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleRun}
                  style={{ alignSelf: 'flex-start', padding: '6px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', background: '#89b4fa', color: '#1e1e2e', border: 'none', borderRadius: '4px' }}
                >
                  ▶ Run
                </button>

                {/* Output */}
                {(output || errors.length > 0) && (
                  <pre style={{ marginTop: '12px', flex: 1, overflow: 'auto', padding: '10px', fontSize: '11px', fontFamily: 'monospace', background: 'var(--bg)', borderRadius: '6px', border: '1px solid var(--border)', whiteSpace: 'pre-wrap' }}>
                    {errors.length > 0 && <span style={{ color: '#f38ba8' }}>{errors.join('\n')}{'\n'}</span>}
                    {output}
                  </pre>
                )}
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5, fontSize: '14px' }}>
                ← Select a plugin to run
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
