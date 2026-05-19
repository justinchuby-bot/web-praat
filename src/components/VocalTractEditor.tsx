import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  computeTransferFunction,
  getVowelTract,
  findFormants,
  type FrequencyResponse,
} from '../audio/vocaltract';

interface VocalTractEditorProps {
  /** Initial number of sections */
  numSections?: number;
  /** Tract length in cm */
  tractLength?: number;
  /** Callback when areas change */
  onAreasChange?: (areas: number[]) => void;
}

export function VocalTractEditor({
  numSections = 17,
  tractLength = 17.5,
  onAreasChange,
}: VocalTractEditorProps) {
  const [areas, setAreas] = useState<number[]>(() => Array.from(getVowelTract('ə', numSections)));
  const [selectedVowel, setSelectedVowel] = useState('ə');
  const tractCanvasRef = useRef<HTMLCanvasElement>(null);
  const spectrumCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef(false);

  const response: FrequencyResponse = useMemo(
    () => computeTransferFunction({ areas, tractLength }, 512),
    [areas, tractLength]
  );

  const formants = useMemo(() => findFormants(response), [response]);

  // Draw tract shape
  useEffect(() => {
    const canvas = tractCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const maxArea = 20;
    const barWidth = w / areas.length;

    // Draw tract outline (symmetric around midline)
    ctx.fillStyle = '#fecaca';
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2;

    ctx.beginPath();
    const midY = h / 2;
    for (let i = 0; i < areas.length; i++) {
      const x = i * barWidth;
      const halfHeight = (areas[i] / maxArea) * (h / 2) * 0.9;
      if (i === 0) {
        ctx.moveTo(x, midY - halfHeight);
      } else {
        ctx.lineTo(x, midY - halfHeight);
      }
    }
    // Bottom half (reversed)
    for (let i = areas.length - 1; i >= 0; i--) {
      const x = i * barWidth;
      const halfHeight = (areas[i] / maxArea) * (h / 2) * 0.9;
      ctx.lineTo(x, midY + halfHeight);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#666';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Glottis', 4, h - 4);
    ctx.textAlign = 'right';
    ctx.fillText('Lips', w - 4, h - 4);
  }, [areas]);

  // Draw frequency response
  useEffect(() => {
    const canvas = spectrumCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const { frequencies, magnitudes } = response;

    // Find range for scaling
    let minMag = Infinity, maxMag = -Infinity;
    for (let i = 0; i < magnitudes.length; i++) {
      if (magnitudes[i] < minMag) minMag = magnitudes[i];
      if (magnitudes[i] > maxMag) maxMag = magnitudes[i];
    }
    const range = maxMag - minMag || 1;

    // Grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;
    for (let f = 1000; f < 10000; f += 1000) {
      const x = (f / (frequencies[frequencies.length - 1] || 22050)) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Spectrum line
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < magnitudes.length; i++) {
      const x = (i / magnitudes.length) * w;
      const y = h - ((magnitudes[i] - minMag) / range) * h * 0.9 - h * 0.05;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Mark formants
    ctx.fillStyle = '#dc2626';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    const maxFreq = frequencies[frequencies.length - 1] || 22050;
    formants.forEach((f, idx) => {
      const x = (f / maxFreq) * w;
      ctx.beginPath();
      ctx.arc(x, 10, 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillText(`F${idx + 1}`, x, 24);
    });
  }, [response, formants]);

  const handleTractMouseDown = useCallback(() => {
    isDragging.current = true;
  }, []);

  const handleTractMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleTractMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDragging.current) return;
      const canvas = tractCanvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const sectionIdx = Math.floor((x / rect.width) * areas.length);

      if (sectionIdx < 0 || sectionIdx >= areas.length) return;

      // Map y to area: center = max area, top/bottom edges = min area
      const midY = rect.height / 2;
      const dist = Math.abs(y - midY);
      const normalizedDist = dist / (rect.height / 2);
      const newArea = Math.max(0.3, Math.min(20, (1 - normalizedDist) * 20));

      const newAreas = [...areas];
      newAreas[sectionIdx] = newArea;
      setAreas(newAreas);
      onAreasChange?.(newAreas);
    },
    [areas, onAreasChange]
  );

  const handleVowelSelect = useCallback(
    (vowel: string) => {
      setSelectedVowel(vowel);
      const newAreas = Array.from(getVowelTract(vowel, numSections));
      setAreas(newAreas);
      onAreasChange?.(newAreas);
    },
    [numSections, onAreasChange]
  );

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Vowel presets:</span>
        {['a', 'i', 'u', 'e', 'o', 'ə'].map((v) => (
          <button
            key={v}
            onClick={() => handleVowelSelect(v)}
            className={`px-2 py-1 text-sm rounded ${
              selectedVowel === v
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            /{v}/
          </button>
        ))}
      </div>

      <div className="border rounded p-2">
        <div className="text-xs text-gray-500 mb-1">
          Vocal Tract Shape (drag to edit)
        </div>
        <canvas
          ref={tractCanvasRef}
          width={600}
          height={150}
          className="w-full cursor-crosshair"
          onMouseDown={handleTractMouseDown}
          onMouseUp={handleTractMouseUp}
          onMouseMove={handleTractMouseMove}
          onMouseLeave={handleTractMouseUp}
        />
      </div>

      <div className="border rounded p-2">
        <div className="text-xs text-gray-500 mb-1">
          Frequency Response
          {formants.length > 0 && (
            <span className="ml-2 text-red-600">
              Formants: {formants.map((f, i) => `F${i + 1}=${Math.round(f)}Hz`).join(', ')}
            </span>
          )}
        </div>
        <canvas
          ref={spectrumCanvasRef}
          width={600}
          height={120}
          className="w-full"
        />
      </div>
    </div>
  );
}
