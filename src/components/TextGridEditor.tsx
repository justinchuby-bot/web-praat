import { useMemo } from 'react';
import type { TextGrid, TextGridTier, TimeSelection, ViewRange } from '../types';
import { timeToX, xToTime } from '../utils/view';

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
}

interface BoundaryDragState {
  tierId: string;
  boundaryIndex: number;
}

interface PointDragState {
  tierId: string;
  pointId: string;
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
}: TextGridEditorProps) {
  const tierHeight = 54;
  const visibleTierData = useMemo(() => textGrid.tiers, [textGrid.tiers]);

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
    const rect = event.currentTarget.getBoundingClientRect();
    const time = xToTime(event.clientX - rect.left, rect.width, viewRange);
    const payload = JSON.parse(event.dataTransfer.getData('text/plain')) as
      | ({ type: 'boundary' } & BoundaryDragState)
      | ({ type: 'point' } & PointDragState);
    if (payload.type === 'boundary') {
      onMoveBoundary(payload.tierId, payload.boundaryIndex, time);
    } else {
      onMovePoint(payload.tierId, payload.pointId, time);
    }
    onActiveTierChange(tier.id);
  };

  return (
    <section className="textgrid-editor">
      {visibleTierData.map((tier) => (
        <div
          key={tier.id}
          className={`textgrid-tier ${activeTierId === tier.id ? 'is-active' : ''}`}
          style={{ height: tierHeight }}
        >
          <div className="textgrid-tier-label">{tier.name}</div>
          <div
            className="textgrid-track"
            onClick={(event) => handleTrackClick(tier, event)}
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
                return (
                  <div
                    key={interval.id}
                    className="textgrid-interval"
                    style={{ left: `${left}%`, width: `${Math.max(0, right - left)}%` }}
                    onDoubleClick={() => onEditLabel(tier.id, interval.id, interval.label)}
                  >
                    <span>{interval.label || ' '}</span>
                    {index > 0 && (
                      <div
                        className="textgrid-boundary"
                        draggable
                        onDragStart={(event) =>
                          handleBoundaryDragStart(event, { tierId: tier.id, boundaryIndex: index })
                        }
                      />
                    )}
                  </div>
                );
              })}
            {tier.kind === 'point' &&
              tier.points.map((point) => (
                <div
                  key={point.id}
                  className="textgrid-point"
                  style={{ left: `${timeToX(point.time, 100, viewRange)}%` }}
                  draggable
                  onDragStart={(event) => handlePointDragStart(event, { tierId: tier.id, pointId: point.id })}
                  onDoubleClick={() => onEditLabel(tier.id, point.id, point.label)}
                >
                  <span className="textgrid-point-mark" />
                  <span className="textgrid-point-label">{point.label}</span>
                </div>
              ))}
          </div>
        </div>
      ))}
    </section>
  );
}
