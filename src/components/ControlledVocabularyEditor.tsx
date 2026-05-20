import { useState, useCallback, useRef } from 'react';
import {
  type ControlledVocabulary,
  type TierVocabularyBinding,
  type VocabularyEntry,
  createVocabulary,
  parseWordList,
  serializeWordList,
  getSuggestions,
  validateTierLabels,
} from '../textgrid/vocabulary';
import type { TextGrid, TextGridTier } from '../types';
import { createId } from '../utils/id';

interface ControlledVocabularyEditorProps {
  textGrid: TextGrid;
  vocabularies: ControlledVocabulary[];
  bindings: TierVocabularyBinding[];
  onVocabulariesChange: (vocabs: ControlledVocabulary[]) => void;
  onBindingsChange: (bindings: TierVocabularyBinding[]) => void;
}

export function ControlledVocabularyEditor({
  textGrid,
  vocabularies,
  bindings,
  onVocabulariesChange,
  onBindingsChange,
}: ControlledVocabularyEditorProps) {
  const [selectedVocabId, setSelectedVocabId] = useState<string | null>(
    vocabularies[0]?.id ?? null
  );
  const [editingEntry, setEditingEntry] = useState<string>('');
  const [editingDesc, setEditingDesc] = useState<string>('');
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedVocab = vocabularies.find((v) => v.id === selectedVocabId) ?? null;

  const handleAddVocabulary = useCallback(() => {
    const name = `Vocabulary ${vocabularies.length + 1}`;
    const id = createId('vocab');
    const newVocab = createVocabulary(id, name);
    onVocabulariesChange([...vocabularies, newVocab]);
    setSelectedVocabId(id);
  }, [vocabularies, onVocabulariesChange]);

  const handleDeleteVocabulary = useCallback(() => {
    if (!selectedVocabId) return;
    onVocabulariesChange(vocabularies.filter((v) => v.id !== selectedVocabId));
    onBindingsChange(bindings.filter((b) => b.vocabularyId !== selectedVocabId));
    setSelectedVocabId(vocabularies.find((v) => v.id !== selectedVocabId)?.id ?? null);
  }, [selectedVocabId, vocabularies, bindings, onVocabulariesChange, onBindingsChange]);

  const handleRenameVocabulary = useCallback(
    (name: string) => {
      if (!selectedVocabId) return;
      onVocabulariesChange(
        vocabularies.map((v) => (v.id === selectedVocabId ? { ...v, name } : v))
      );
    },
    [selectedVocabId, vocabularies, onVocabulariesChange]
  );

  const handleAddEntry = useCallback(() => {
    if (!selectedVocab || editingEntry.trim() === '') return;
    const entry: VocabularyEntry = {
      value: editingEntry.trim(),
      description: editingDesc.trim() || undefined,
    };
    if (selectedVocab.entries.some((e) => e.value === entry.value)) return;
    onVocabulariesChange(
      vocabularies.map((v) =>
        v.id === selectedVocab.id ? { ...v, entries: [...v.entries, entry] } : v
      )
    );
    setEditingEntry('');
    setEditingDesc('');
  }, [selectedVocab, editingEntry, editingDesc, vocabularies, onVocabulariesChange]);

  const handleRemoveEntry = useCallback(
    (value: string) => {
      if (!selectedVocab) return;
      onVocabulariesChange(
        vocabularies.map((v) =>
          v.id === selectedVocab.id
            ? { ...v, entries: v.entries.filter((e) => e.value !== value) }
            : v
        )
      );
    },
    [selectedVocab, vocabularies, onVocabulariesChange]
  );

  const handleImport = useCallback(() => {
    if (!selectedVocab || importText.trim() === '') return;
    const newEntries = parseWordList(importText);
    const existing = new Set(selectedVocab.entries.map((e) => e.value));
    const merged = [
      ...selectedVocab.entries,
      ...newEntries.filter((e) => !existing.has(e.value)),
    ];
    onVocabulariesChange(
      vocabularies.map((v) =>
        v.id === selectedVocab.id ? { ...v, entries: merged } : v
      )
    );
    setImportText('');
    setShowImport(false);
  }, [selectedVocab, importText, vocabularies, onVocabulariesChange]);

  const handleFileImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !selectedVocab) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        const newEntries = parseWordList(text);
        const existing = new Set(selectedVocab.entries.map((e) => e.value));
        const merged = [
          ...selectedVocab.entries,
          ...newEntries.filter((e) => !existing.has(e.value)),
        ];
        onVocabulariesChange(
          vocabularies.map((v) =>
            v.id === selectedVocab.id ? { ...v, entries: merged } : v
          )
        );
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [selectedVocab, vocabularies, onVocabulariesChange]
  );

  const handleExport = useCallback(() => {
    if (!selectedVocab) return;
    const text = serializeWordList(selectedVocab.entries);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedVocab.name}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedVocab]);

  const handleBindTier = useCallback(
    (tierId: string, vocabularyId: string | null, strict: boolean) => {
      const filtered = bindings.filter((b) => b.tierId !== tierId);
      if (vocabularyId) {
        filtered.push({ tierId, vocabularyId, strict });
      }
      onBindingsChange(filtered);
    },
    [bindings, onBindingsChange]
  );

  const getValidationErrors = useCallback(
    (tier: TextGridTier): number[] => {
      const binding = bindings.find((b) => b.tierId === tier.id);
      if (!binding) return [];
      const vocab = vocabularies.find((v) => v.id === binding.vocabularyId);
      if (!vocab) return [];
      const labels =
        tier.kind === 'interval'
          ? tier.intervals.map((i) => i.label)
          : tier.points.map((p) => p.label);
      return validateTierLabels(labels, vocab, binding.strict);
    },
    [bindings, vocabularies]
  );

  return (
    <div className="flex flex-col gap-3 p-3 text-sm">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold text-zinc-200">Controlled Vocabularies</h3>
        <button
          onClick={handleAddVocabulary}
          className="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-500"
        >
          + New
        </button>
      </div>

      {vocabularies.length === 0 ? (
        <p className="text-xs text-zinc-500">No vocabularies defined. Create one to constrain tier annotations.</p>
      ) : (
        <>
          {/* Vocabulary selector */}
          <select
            value={selectedVocabId ?? ''}
            onChange={(e) => setSelectedVocabId(e.target.value || null)}
            className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200"
          >
            {vocabularies.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.entries.length} entries)
              </option>
            ))}
          </select>

          {selectedVocab && (
            <>
              {/* Rename + delete */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={selectedVocab.name}
                  onChange={(e) => handleRenameVocabulary(e.target.value)}
                  className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200"
                />
                <button
                  onClick={handleDeleteVocabulary}
                  className="rounded bg-red-700 px-2 py-0.5 text-xs text-white hover:bg-red-600"
                >
                  Delete
                </button>
                <button
                  onClick={handleExport}
                  className="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-200 hover:bg-zinc-600"
                >
                  Export
                </button>
              </div>

              {/* Add entry */}
              <div className="flex gap-1">
                <input
                  type="text"
                  value={editingEntry}
                  onChange={(e) => setEditingEntry(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddEntry()}
                  placeholder="Entry value"
                  className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200"
                />
                <input
                  type="text"
                  value={editingDesc}
                  onChange={(e) => setEditingDesc(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddEntry()}
                  placeholder="Description (opt)"
                  className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200"
                />
                <button
                  onClick={handleAddEntry}
                  className="rounded bg-green-700 px-2 py-0.5 text-xs text-white hover:bg-green-600"
                >
                  Add
                </button>
              </div>

              {/* Import */}
              <div className="flex gap-1">
                <button
                  onClick={() => setShowImport(!showImport)}
                  className="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-200 hover:bg-zinc-600"
                >
                  {showImport ? 'Cancel' : 'Import Text'}
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-200 hover:bg-zinc-600"
                >
                  Import File
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.csv,.tsv"
                  onChange={handleFileImport}
                  className="hidden"
                />
              </div>
              {showImport && (
                <div className="flex flex-col gap-1">
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="One entry per line (tab-separated description optional)"
                    className="h-20 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200"
                  />
                  <button
                    onClick={handleImport}
                    className="self-start rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-500"
                  >
                    Import
                  </button>
                </div>
              )}

              {/* Entry list */}
              <div className="max-h-32 overflow-y-auto rounded border border-zinc-700 bg-zinc-900">
                {selectedVocab.entries.length === 0 ? (
                  <p className="p-2 text-xs text-zinc-500">No entries yet.</p>
                ) : (
                  selectedVocab.entries.map((entry) => (
                    <div
                      key={entry.value}
                      className="flex items-center justify-between border-b border-zinc-800 px-2 py-1 last:border-0"
                    >
                      <span className="text-xs text-zinc-200">
                        {entry.value}
                        {entry.description && (
                          <span className="ml-2 text-zinc-500">— {entry.description}</span>
                        )}
                      </span>
                      <button
                        onClick={() => handleRemoveEntry(entry.value)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Tier bindings */}
              <div className="mt-2">
                <h4 className="mb-1 text-xs font-semibold text-zinc-300">Tier Bindings</h4>
                {textGrid.tiers.map((tier) => {
                  const binding = bindings.find((b) => b.tierId === tier.id);
                  const errors = getValidationErrors(tier);
                  return (
                    <div
                      key={tier.id}
                      className="mb-1 flex items-center gap-2 rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
                    >
                      <span className="text-xs text-zinc-300">{tier.name}</span>
                      <select
                        value={binding?.vocabularyId ?? ''}
                        onChange={(e) =>
                          handleBindTier(
                            tier.id,
                            e.target.value || null,
                            binding?.strict ?? false
                          )
                        }
                        className="flex-1 rounded border border-zinc-600 bg-zinc-700 px-1 py-0.5 text-xs text-zinc-200"
                      >
                        <option value="">None</option>
                        {vocabularies.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                      {binding && (
                        <label className="flex items-center gap-1 text-xs text-zinc-400">
                          <input
                            type="checkbox"
                            checked={binding.strict}
                            onChange={(e) =>
                              handleBindTier(tier.id, binding.vocabularyId, e.target.checked)
                            }
                            className="h-3 w-3"
                          />
                          Strict
                        </label>
                      )}
                      {errors.length > 0 && (
                        <span className="text-xs text-amber-400">
                          {errors.length} invalid
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Autocomplete dropdown for tier label editing with vocabulary constraints.
 */
interface VocabularyAutocompleteProps {
  input: string;
  vocabulary: ControlledVocabulary;
  onSelect: (value: string) => void;
  visible: boolean;
}

export function VocabularyAutocomplete({
  input,
  vocabulary,
  onSelect,
  visible,
}: VocabularyAutocompleteProps) {
  const suggestions = getSuggestions(input, vocabulary);

  if (!visible || suggestions.length === 0) return null;

  return (
    <div className="absolute z-50 mt-1 max-h-32 overflow-y-auto rounded border border-zinc-600 bg-zinc-800 shadow-lg">
      {suggestions.map((entry) => (
        <button
          key={entry.value}
          onClick={() => onSelect(entry.value)}
          className="block w-full px-3 py-1 text-left text-xs text-zinc-200 hover:bg-zinc-700"
        >
          {entry.value}
          {entry.description && (
            <span className="ml-2 text-zinc-500">{entry.description}</span>
          )}
        </button>
      ))}
    </div>
  );
}
