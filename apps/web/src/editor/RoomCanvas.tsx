import { useRef } from 'react';
import type { EllipseShape, Point, RectShape, Room, Shape } from '@escape/schema';
import { assetUrl, isImageBackground } from '../assets.js';
import type { Box } from '../shapes.js';

interface RoomCanvasProps {
  room: Room;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Live shape updates while dragging/resizing/reshaping a hotspot. */
  onChangeShape: (hotspotId: string, shape: Shape) => void;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

type Drag =
  | {
      kind: 'move' | 'resize';
      id: string;
      sx: number;
      sy: number;
      box: Box;
      type: 'rect' | 'ellipse';
    }
  | { kind: 'poly-move'; id: string; sx: number; sy: number; points: Point[] }
  | { kind: 'poly-vertex'; id: string; index: number; sx: number; sy: number; points: Point[] };

/**
 * DOM overlay editor for one room. Box shapes (rect/ellipse) are draggable
 * divs with a resize corner; polygons are an SVG outline with draggable
 * vertex handles. Coordinates are normalized 0..1 of the canvas box.
 */
export function RoomCanvas({ room, selectedId, onSelect, onChangeShape }: RoomCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  const start = (e: React.PointerEvent, d: Drag, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(id);
    drag.current = d;
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const beginBox = (
    e: React.PointerEvent,
    kind: 'move' | 'resize',
    id: string,
    shape: RectShape | EllipseShape,
  ) => {
    start(e, { kind, id, sx: e.clientX, sy: e.clientY, box: shape, type: shape.type }, id);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const canvas = canvasRef.current;
    if (!d || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dx = (e.clientX - d.sx) / rect.width;
    const dy = (e.clientY - d.sy) / rect.height;

    switch (d.kind) {
      case 'move':
        onChangeShape(d.id, {
          type: d.type,
          w: d.box.w,
          h: d.box.h,
          x: clamp01(Math.min(d.box.x + dx, 1 - d.box.w)),
          y: clamp01(Math.min(d.box.y + dy, 1 - d.box.h)),
        });
        break;
      case 'resize':
        onChangeShape(d.id, {
          type: d.type,
          x: d.box.x,
          y: d.box.y,
          w: clamp01(Math.max(0.03, Math.min(d.box.w + dx, 1 - d.box.x))),
          h: clamp01(Math.max(0.03, Math.min(d.box.h + dy, 1 - d.box.y))),
        });
        break;
      case 'poly-move':
        onChangeShape(d.id, {
          type: 'polygon',
          points: d.points.map((p) => ({ x: clamp01(p.x + dx), y: clamp01(p.y + dy) })),
        });
        break;
      case 'poly-vertex':
        onChangeShape(d.id, {
          type: 'polygon',
          points: d.points.map((p, i) =>
            i === d.index ? { x: clamp01(p.x + dx), y: clamp01(p.y + dy) } : p,
          ),
        });
        break;
    }
  };

  const endDrag = (e: React.PointerEvent) => {
    if (drag.current) (e.target as Element).releasePointerCapture?.(e.pointerId);
    drag.current = null;
  };

  const bgStyle = isImageBackground(room.background)
    ? { backgroundImage: `url(${assetUrl(room.background)})` }
    : { backgroundColor: room.background };

  const selected = room.hotspots.find((h) => h.id === selectedId) ?? null;

  return (
    <div
      ref={canvasRef}
      className="ed-canvas"
      style={bgStyle}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerDown={() => onSelect(null)}
    >
      {/* Box shapes: rect + ellipse */}
      {room.hotspots.map((h) => {
        if (h.shape.type === 'polygon') return null;
        const s = h.shape;
        const isSel = h.id === selectedId;
        return (
          <div
            key={h.id}
            className={`ed-hotspot${isSel ? ' selected' : ''}${s.type === 'ellipse' ? ' ellipse' : ''}`}
            style={{
              left: `${s.x * 100}%`,
              top: `${s.y * 100}%`,
              width: `${s.w * 100}%`,
              height: `${s.h * 100}%`,
            }}
            onPointerDown={(e) => beginBox(e, 'move', h.id, s)}
          >
            {h.sprite && <img className="ed-hotspot-img" src={assetUrl(h.sprite)} alt="" />}
            <span className="ed-hotspot-label">{h.label ?? h.id}</span>
            <span className="ed-handle" onPointerDown={(e) => beginBox(e, 'resize', h.id, s)} />
          </div>
        );
      })}

      {/* Polygon outlines */}
      <svg className="ed-poly-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
        {room.hotspots.map((h) => {
          if (h.shape.type !== 'polygon') return null;
          const pts = h.shape.points;
          return (
            <polygon
              key={h.id}
              className={`ed-poly${h.id === selectedId ? ' selected' : ''}`}
              points={pts.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')}
              vectorEffect="non-scaling-stroke"
              onPointerDown={(e) =>
                start(
                  e,
                  { kind: 'poly-move', id: h.id, sx: e.clientX, sy: e.clientY, points: pts },
                  h.id,
                )
              }
            />
          );
        })}
      </svg>

      {/* Vertex handles for the selected polygon */}
      {selected?.shape.type === 'polygon' &&
        selected.shape.points.map((p, i) => (
          <span
            key={i}
            className="ed-vertex"
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
            onPointerDown={(e) =>
              start(
                e,
                {
                  kind: 'poly-vertex',
                  id: selected.id,
                  index: i,
                  sx: e.clientX,
                  sy: e.clientY,
                  points: (selected.shape as { points: Point[] }).points,
                },
                selected.id,
              )
            }
          />
        ))}
    </div>
  );
}
