import type { PolygonShape, Shape } from '@escape/schema';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Bounding box (normalized 0..1) of any shape — used to place sprites/labels. */
export function shapeBounds(shape: Shape): Box {
  if (shape.type === 'polygon') {
    const xs = shape.points.map((p) => p.x);
    const ys = shape.points.map((p) => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }
  return { x: shape.x, y: shape.y, w: shape.w, h: shape.h };
}

/** Convert a shape to another kind, preserving its bounding box. */
export function convertShape(shape: Shape, type: Shape['type']): Shape {
  if (shape.type === type) return shape;
  const b = shapeBounds(shape);
  if (type === 'rect') return { type: 'rect', ...b };
  if (type === 'ellipse') return { type: 'ellipse', ...b };
  return {
    type: 'polygon',
    points: [
      { x: b.x, y: b.y },
      { x: b.x + b.w, y: b.y },
      { x: b.x + b.w, y: b.y + b.h },
      { x: b.x, y: b.y + b.h },
    ],
  };
}

/** Add a vertex at the midpoint of the closing edge (last → first). */
export function addPolygonPoint(shape: PolygonShape): PolygonShape {
  const pts = shape.points;
  const a = pts[pts.length - 1]!;
  const b = pts[0]!;
  return { type: 'polygon', points: [...pts, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }] };
}

/** Remove the last vertex, keeping at least a triangle. */
export function removePolygonPoint(shape: PolygonShape): PolygonShape {
  return shape.points.length <= 3 ? shape : { type: 'polygon', points: shape.points.slice(0, -1) };
}
