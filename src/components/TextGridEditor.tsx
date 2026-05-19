import { useState, useCallback, useEffect } from 'react';
import type { TextGrid, TextGridTier, TimeSelection, ViewRange } from '../types';
import { timeToX, xToTime } from '../utils/view';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';

interface TextGridEditorProps {
  textGrid: TextGrid;
  viewRange: ViewRange;
  selection: TimeSelection | null;
  activeTierId: string | null;
  onActiveTierChange: (tierId: string) => void;
  onAddBoundary: (tierId: string, time: number) => void;
  onAddPoint: (tierId: string, time: number) => void;
  onMoveBoundary: (tierId: string, boundaryIndex: number, time: number) => void;
  onMovePoint: (tierId: string, pointId: string, time: number) => void;
  onEditLabel: (tierId: string, itemId: string, currentLabel: string) => void;
  onAddTier: (name: string, kind: 'interval' | 'point') => void;
  onRemoveTier: (tierId: string) => void;
  onRenameTier: (tierId: string, name: string) => void;
  onDeleteBoundary: (tierId: string, boundaryIndex: number) => void;
  onDeletePoint: (tierId: string, pointId: string) => void;
  onMoveTier?: (tierId: string, direction: 'up' | 'down') => void;
}

interface BoundaryDragState {
  tierId: string;
  boundaryIndex: number;
}

interface PointDragState {
  tierId: string;
  pointId: string;
}

interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

interface SelectedItem {
  type: 'boundary' | 'point' | 'interval';
  tierId: string;
  id: string;
  boundaryIndex?: number;
  label?: string;
}

export function TextGridEditor({
  textGrid,
  viewRange,
  selection,
  activeTierId,
  onActiveTierChange,
  onAddBoundary,
  onAddPoint,
  onMoveBoundary,
  onMovePoint,
  onEditLabel,
  onAddTier,
  onRemoveTier,
  onRenameTier,
  onDeleteBoundary,
  onDeletePoint,
  onMoveTier,
}: TextGridEditorProps) {
  const tierHeight = 54;
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [hoveredBoundary, setHoveredBoundary] = useState<string | null>(null);
  const [hoveredInterval, setHoveredInterval] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);
  const [tierMenuOpen, setTierMenuOpen] = useState<string | null>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selectedItem) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (selectedItem.type === 'boundary' && selectedItem.boundaryIndex !== undefined) {
          onDeleteBoundary(selectedItem.tierId, selectedItem.boundaryIndex);
        } else if (selectedItem.type === 'point') {
          onDeletePoint(selectedItem.tierId, selectedItem.id);
        }
        setSelectedItem(null);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedItem.type === 'interval' || selectedItem.type === 'point') {
          onEditLabel(selectedItem.tierId, selectedItem.id, selectedItem.label || '');
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [selectedItem, onDeleteBoundary, onDeletePoint, onEditLabel]);

  const handleTrackClick = (tier: TextGridTier, event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const time = xToTime(event.clientX - rect.left, rect.width, viewRange);
    onActiveTierChange(tier.id);
    if (tier.kind === 'interval') {
      onAddBoundary(tier.id, time);
    } else {
      onAddPoint(tier.id, time);
    }
  };

  const handleTrackContextMenu = (tier: TextGridTier, event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const time = xToTime(event.clientX - rect.left, rect.width, viewRange);
    const items: ContextMenuItem[] = [];
    if (tier.kind === 'interval') {
      items.push({ label: 'Add Boundary Here', action: () => onAddBoundary(tier.id, time) });
    } else {
      items.push({ label: 'Add Point Here', action: () => onAddPoint(tier.id, time) });
    }
    items.push({
      label: 'Add Tier',
      action: () => {
        const name = prompt('Tier name:', `Tier ${textGrid.tiers.length + 1}`);
        if (!name) return;
        const kind = prompt('Type: interval or point', 'interval');
        if (kind !== 'interval' && kind !== 'point') return;
        onAddTier(name, kind);
      },
    });
    setContextMenu({ x: event.clientX, y: event.clientY, items });
  };

  const handleBoundaryContextMenu = (
    event: React.MouseEvent,
    tier: TextGridTier,
    boundaryIndex: number
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = (event.currentTarget.parentElement!.parentElement as HTMLElement).getBoundingClientRect();
    const time = xToTime(event.clientX - rect.left, rect.width, viewRange);
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      items: [
        { label: 'Delete Boundary', action: () => onDeleteBoundary(tier.id, boundaryIndex), danger: true },
        { label: 'Split Here', action: () => onAddBoundary(tier.id, time) },
      ],
    });
  };

  const handleIntervalContextMenu = (
    event: React.MouseEvent,
    tier: TextGridTier,
    intervalId: string,
    label: string
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = (event.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    const time = xToTime(event.clientX - rect.left, rect.width, viewRange);
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      items: [
        { label: 'Edit Label', action: () => onEditLabel(tier.id, intervalId, label) },
        { label: 'Split Here', action: () => onAddBoundary(tier.id, time) },
      ],
    });
  };

  const handlePointContextMenu = (
    event: React.MouseEvent,
    tier: TextGridTier,
    pointId: string,
    label: string
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      items: [
        { label: 'Edit Label', action: () => onEditLabel(tier.id, pointId, label) },
        { label: 'Delete Point', action: () => onDeletePoint(tier.id, pointId), danger: true },
      ],
    });
  };

  const handleBoundaryDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    state: BoundaryDragState
  ) => {
    event.dataTransfer.setData('text/plain', JSON.stringify({ type: 'boundary', ...state }));
  };

  const handlePointDragStart = (event: React.DragEvent<HTMLDivElement>, state: PointDragState) => {
    event.dataTransfer.setData('text/plain', JSON.stringify({ type: 'point', ...state }));
  };

  const handleDrop = (tier: TextGridTier, event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const data = event.dataTransfer.getData('text/plain');
    if (!data) return;
    let payload: { type: string; tierId?: string; boundaryIndex?: number; pointId?: string };
    try {
      payload = JSON.parse(data);
    } catch {
      return; // Not a valid JSON drop (e.g. file drop)
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const time = xToTime(event.clientX - rect.left, rect.width, viewRange);
    if (payload.type === 'boundary') {
      onMoveBoundary((payload as any).tierId, (payload as any).boundaryIndex, time);
    } else {
      onMovePoint((payload as any).tierId, (payload as any).pointId, time);
    }
    onActiveTierChange(tier.id);
  };

  const handleAddTier = (kind: 'interval' | 'point') => {
    const name = prompt('Tier name:', `Tier ${textGrid.tiers.length + 1}`);
    if (!name) return;
    onAddTier(name, kind);
  };

  const handleTierMenu = useCallback((tierId: string) => {
    setTierMenuOpen((prev) => (prev === tierId ? null : tierId));
  }, []);

  return (
    <section className="textgrid-editor" onClick={() => { setSelectedItem(null); setTierMenuOpen(null); }}>
      {textGrid.tiers.map((tier, tierIndex) => (
        <div
          key={tier.id}
          className={`textgrid-tier ${activeTierId === tier.id ? 'is-active' : ''}`}
          style={{ height: tierHeight }}
        >
          <div className="textgrid-tier-label">
            <span
              onDoubleClick={() => {
                const name = prompt('Rename tier:', tier.name);
                if (name) onRenameTier(tier.id, name);
              }}
            >
              {tier.name}
            </span>
            <button
              className="textgrid-tier-menu-btn"
              title="Tier options"
              onClick={(e) => { e.stopPropagation(); handleTierMenu(tier.id); }}
            >
              ⋮
            </button>
            {tierMenuOpen === tier.id && (
              <div className="tier-dropdown" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => { const n = prompt('Rename:', tier.name); if (n) onRenameTier(tier.id, n); setTierMenuOpen(null); }}>Rename</button>
                {onMoveTier && tierIndex > 0 && (
                  <button onClick={() => { onMoveTier(tier.id, 'up'); setTierMenuOpen(null); }}>Move Up</button>
                )}
                {onMoveTier && tierIndex < textGrid.tiers.length - 1 && (
                  <button onClick={() => { onMoveTier(tier.id, 'down'); setTierMenuOpen(null); }}>Move Down</button>
                )}
                <button className="is-danger" onClick={() => { onRemoveTier(tier.id); setTierMenuOpen(null); }}>Delete</button>
              </div>
            )}
          </div>
          <div
            className="textgrid-track"
            onClick={(event) => handleTrackClick(tier, event)}
            onContextMenu={(event) => handleTrackContextMenu(tier, event)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDrop(tier, event)}
          >
            {selection && (
              <div
                className="textgrid-selection"
                style={{
                  left: `${timeToX(selection.start, 100, viewRange)}%`,
                  width: `${timeToX(selection.end, 100, viewRange) - timeToX(selection.start, 100, viewRange)}%`,
                }}
              />
            )}
            {tier.kind === 'interval' &&
              tier.intervals.map((interval, index) => {
                const left = timeToX(interval.start, 100, viewRange);
                const right = timeToX(interval.end, 100, viewRange);
                const isHovered = hoveredInterval === interval.id;
                const isSelected = selectedItem?.id === interval.id;
                return (
                  <div
                    key={interval.id}
                    className={`textgrid-interval ${isHovered ? 'is-hovered' : ''} ${isSelected ? 'is-selected' : ''}`}
                    style={{ left: `${left}%`, width: `${Math.max(0, right - left)}%` }}
                    onDoubleClick={(e) => { e.stopPropagation(); onEditLabel(tier.id, interval.id, interval.label); }}
                    onClick={(e) => { e.stopPropagation(); setSelectedItem({ type: 'interval', tierId: tier.id, id: interval.id, label: interval.label }); onActiveTierChange(tier.id); }}
                    onContextMenu={(e) => handleIntervalContextMenu(e, tier, interval.id, interval.label)}
                    onMouseEnter={() => setHoveredInterval(interval.id)}
                    onMouseLeave={() => setHoveredInterval(null)}
                    title="Double-click to edit"
                  >
                    <span>{interval.label || ' '}</span>
                    {index > 0 && (
                      <div
                        className={`textgrid-boundary ${hoveredBoundary === `${tier.id}-${index}` ? 'is-hovered' : ''} ${selectedItem?.type === 'boundary' && selectedItem?.boundaryIndex === index && selectedItem?.tierId === tier.id ? 'is-selected' : ''}`}
                        draggable
                        onDragStart={(event) => handleBoundaryDragStart(event, { tierId: tier.id, boundaryIndex: index })}
                        onClick={(e) => { e.stopPropagation(); setSelectedItem({ type: 'boundary', tierId: tier.id, id: `${tier.id}-${index}`, boundaryIndex: index }); }}
                        onContextMenu={(e) => handleBoundaryContextMenu(e, tier, index)}
                        onMouseEnter={() => setHoveredBoundary(`${tier.id}-${index}`)}
                        onMouseLeave={() => setHoveredBoundary(null)}
                        title="Drag to move"
                      />
                    )}
                  </div>
                );
              })}
            {tier.kind === 'point' &&
              tier.points.map((point) => {
                const isHovered = hoveredPoint === point.id;
                const isSelected = selectedItem?.id === point.id;
                return (
                  <div
                    key={point.id}
                    className={`textgrid-point ${isHovered ? 'is-hovered' : ''} ${isSelected ? 'is-selected' : ''}`}
                    style={{ left: `${timeToX(point.time, 100, viewRange)}%` }}
                    draggable
                    onDragStart={(event) => handlePointDragStart(event, { tierId: tier.id, pointId: point.id })}
                    onDoubleClick={(e) => { e.stopPropagation(); onEditLabel(tier.id, point.id, point.label); }}
                    onClick={(e) => { e.stopPropagation(); setSelectedItem({ type: 'point', tierId: tier.id, id: point.id, label: point.label }); onActiveTierChange(tier.id); }}
                    onContextMenu={(e) => handlePointContextMenu(e, tier, point.id, point.label)}
                    onMouseEnter={() => setHoveredPoint(point.id)}
                    onMouseLeave={() => setHoveredPoint(null)}
                    title="Double-click to edit · Drag to move"
                  >
                    <span className="textgrid-point-mark" />
                    <span className="textgrid-point-label">{point.label}</span>
                  </div>
                );
              })}
          </div>
        </div>
      ))}
      <div className="textgrid-add-tier-row">
        <button className="textgrid-add-tier" onClick={() => handleAddTier('interval')} title="Add interval tier">+ Interval Tier</button>
        <button className="textgrid-add-tier" onClick={() => handleAddTier('point')} title="Add point tier">+ Point Tier</button>
      </div>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
    </section>
  );
}
