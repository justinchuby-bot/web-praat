import { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';

export interface ListingData {
  title: string;
  headers: string[];
  rows: string[][];
}

interface ListingPanelProps {
  data: ListingData | null;
  onClose: () => void;
}

export function ListingPanel({ data, onClose }: ListingPanelProps) {
  const [copied, setCopied] = useState(false);

  if (!data) return null;

  const copyToClipboard = () => {
    const tsv = [data.headers.join('\t'), ...data.rows.map(r => r.join('\t'))].join('\n');
    navigator.clipboard.writeText(tsv).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="listing-panel">
      <div className="listing-panel-header">
        <span className="listing-panel-title">{data.title}</span>
        <span className="listing-panel-count">{data.rows.length} frames</span>
        <button className="listing-panel-btn" onClick={copyToClipboard} title="Copy as TSV">
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button className="listing-panel-btn listing-panel-close" onClick={onClose} title="Close">
          <X size={14} />
        </button>
      </div>
      <div className="listing-panel-table-wrap">
        <table className="listing-panel-table">
          <thead>
            <tr>
              {data.headers.map((h, i) => <th key={i}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => <td key={j}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
