import { useRef } from 'react';
import type { Rect, Room } from '@escape/schema';
import { assetUrl, isImageBackground } from '../assets.js';

interface RoomCanvasProps {
  room: Room;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Live shape updates while dragging/resizing a hotspot. */
  onChangeShape: (hotspotId: string, shape: Rect) => void;
}

type DragMode = 'move' | 'resize';

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * DOM overlay editor for one room: the background plus absolutely-positioned
 * hotspot boxes the creator can drag to move and resize from the corner.
 * Coordinates are normalized 0..1 of the canvas box, matching how the player
 * maps hotspots onto the viewport.
 */
export function RoomCanvas({ room, selectedId, onSelect, onChangeShape }: RoomCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    mode: DragMode;
    hotspotId: string;
    startX: number;
    startY: number;
    start: Rect;
  } | null>(null);

  const beginDrag = (e: React.PointerEvent, mode: DragMode, hotspotId: string, start: Rect) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(hotspotId);
    drag.current = { mode, hotspotId, startX: e.clientX, startY: e.clientY, start };
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const canvas = canvasRef.current;
    if (!d || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dx = (e.clientX - d.startX) / rect.width;
    const dy = (e.clientY - d.startY) / rect.height;

    if (d.mode === 'move') {
      onChangeShape(d.hotspotId, {
        ...d.start,
        x: clamp01(Math.min(d.start.x + dx, 1 - d.start.w)),
        y: clamp01(Math.min(d.start.y + dy, 1 - d.start.h)),
      });
    } else {
      onChangeShape(d.hotspotId, {
        ...d.start,
        w: clamp01(Math.max(0.03, Math.min(d.start.w + dx, 1 - d.start.x))),
        h: clamp01(Math.max(0.03, Math.min(d.start.h + dy, 1 - d.start.y))),
      });
    }
  };

  const endDrag = (e: React.PointerEvent) => {
    if (drag.current) (e.target as Element).releasePointerCapture?.(e.pointerId);
    drag.current = null;
  };

  const bgStyle = isImageBackground(room.background)
    ? { backgroundImage: `url(${assetUrl(room.background)})` }
    : { backgroundColor: room.background };

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
      {room.hotspots.map((h) => {
        const selected = h.id === selectedId;
        return (
          <div
            key={h.id}
            className={`ed-hotspot${selected ? ' selected' : ''}`}
            style={{
              left: `${h.shape.x * 100}%`,
              top: `${h.shape.y * 100}%`,
              width: `${h.shape.w * 100}%`,
              height: `${h.shape.h * 100}%`,
            }}
            onPointerDown={(e) => beginDrag(e, 'move', h.id, h.shape)}
          >
            {h.sprite && <img className="ed-hotspot-img" src={assetUrl(h.sprite)} alt="" />}
            <span className="ed-hotspot-label">{h.label ?? h.id}</span>
            <span
              className="ed-handle"
              onPointerDown={(e) => beginDrag(e, 'resize', h.id, h.shape)}
            />
          </div>
        );
      })}
    </div>
  );
}
