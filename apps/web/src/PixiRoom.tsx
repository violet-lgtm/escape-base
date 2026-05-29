import { useEffect, useRef } from 'react';
import {
  Application,
  Container,
  Ellipse,
  Graphics,
  Polygon,
  Rectangle,
  Sprite,
  Text,
  Texture,
} from 'pixi.js';
import { OutlineFilter } from 'pixi-filters';
import type { Hotspot, Room } from '@escape/schema';
import { assetUrl, isImageBackground } from './assets.js';
import { shapeBounds } from './shapes.js';

interface PixiRoomProps {
  room: Room;
  /** Whether a hotspot's conditions currently pass (drives visibility). */
  isActive: (hotspot: Hotspot) => boolean;
  onHotspot: (hotspot: Hotspot) => void;
  /** Changes whenever game state changes, so active hotspots re-render. */
  revision: string;
}

function toColor(background: string): number {
  return background.startsWith('#') ? Number.parseInt(background.slice(1), 16) : 0x101014;
}

/**
 * Load any image URL — http(s), an SVG, or an uploaded `data:` URI — into a
 * texture via a real <img>, sidestepping the asset loader's extension sniffing
 * (which doesn't recognize data URIs).
 */
async function loadTexture(url: string): Promise<Texture> {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  await image.decode();
  return Texture.from(image);
}

/**
 * Imperative Pixi v8 renderer for a single room. Hotspots use normalized 0..1
 * coordinates so they scale to any phone size; the layer is re-laid-out on
 * resize and whenever game state changes.
 */
export function PixiRoom({ room, isActive, onHotspot, revision }: PixiRoomProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<() => void>(() => {});
  const onHotspotRef = useRef(onHotspot);
  const isActiveRef = useRef(isActive);
  onHotspotRef.current = onHotspot;
  isActiveRef.current = isActive;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let app: Application | null = null;
    let destroyed = false;

    void (async () => {
      const instance = new Application();
      await instance.init({
        resizeTo: host,
        antialias: true,
        background: toColor(room.background),
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
      if (destroyed) {
        instance.destroy(true);
        return;
      }
      app = instance;
      host.appendChild(instance.canvas);

      const layer = new Container();
      instance.stage.addChild(layer);

      // Hotspots are authored in the background image's coordinate space. The
      // image is cover-fit to the viewport, and hotspots map through the SAME
      // transform, so they stay locked to the art on any screen aspect. For
      // solid `#rrggbb` rooms with no image, image space == the viewport.
      let bg: Sprite | null = null;
      let bgSize: { w: number; h: number } | null = null;

      const imageRect = () => {
        const { width, height } = instance.screen;
        if (!bgSize) return { offX: 0, offY: 0, dispW: width, dispH: height };
        const scale = Math.max(width / bgSize.w, height / bgSize.h);
        const dispW = bgSize.w * scale;
        const dispH = bgSize.h * scale;
        return { offX: (width - dispW) / 2, offY: (height - dispH) / 2, dispW, dispH };
      };

      const fitBackground = () => {
        if (!bg) return;
        const { offX, offY, dispW, dispH } = imageRect();
        bg.width = dispW;
        bg.height = dispH;
        bg.position.set(offX, offY);
      };

      // Load the background first so its size is known before hotspot layout.
      if (isImageBackground(room.background)) {
        try {
          const texture = await loadTexture(assetUrl(room.background));
          if (!destroyed) {
            bg = new Sprite(texture);
            bgSize = { w: texture.width, h: texture.height };
            instance.stage.addChildAt(bg, 0);
            fitBackground();
          }
        } catch {
          // Leave the solid clear color as a graceful fallback.
        }
      }
      if (destroyed) return;

      // Preload object sprites so layout can place them synchronously.
      const spriteTextures = new Map<string, Texture>();
      await Promise.all(
        [...new Set(room.hotspots.filter((h) => h.sprite).map((h) => assetUrl(h.sprite!)))].map(
          async (url) => {
            try {
              spriteTextures.set(url, await loadTexture(url));
            } catch {
              // Missing art falls back to an invisible region below.
            }
          },
        ),
      );
      if (destroyed) return;

      const makeLabel = (text: string, x: number, y: number): Text => {
        const label = new Text({
          text,
          style: {
            fill: 0xffffff,
            fontSize: 15,
            fontFamily: 'system-ui, sans-serif',
            stroke: { color: 0x000000, width: 4 },
          },
        });
        label.eventMode = 'none';
        label.visible = false;
        label.position.set(x, y);
        return label;
      };

      const layout = () => {
        layer.removeChildren();
        const { offX, offY, dispW, dispH } = imageRect();
        const projX = (nx: number) => offX + nx * dispW;
        const projY = (ny: number) => offY + ny * dispH;
        for (const hotspot of room.hotspots) {
          if (!isActiveRef.current(hotspot)) continue;
          const b = shapeBounds(hotspot.shape);
          const x = projX(b.x);
          const y = projY(b.y);
          const w = b.w * dispW;
          const h = b.h * dispH;

          const texture = hotspot.sprite ? spriteTextures.get(assetUrl(hotspot.sprite)) : undefined;

          if (texture) {
            // Custom object: a real sprite, clickable by its bounds, that
            // outlines its own silhouette on hover (and disappears when its
            // conditions stop passing, since inactive hotspots are skipped).
            const sprite = new Sprite(texture);
            sprite.anchor.set(0.5);
            const scale = Math.min(w / texture.width, h / texture.height);
            sprite.scale.set(scale || 1);
            sprite.position.set(x + w / 2, y + h / 2);
            sprite.eventMode = 'static';
            sprite.cursor = 'pointer';

            const outline = new OutlineFilter({ thickness: 4, color: 0xffe6a6, quality: 0.2 });
            const label = hotspot.label ? makeLabel(hotspot.label, x, Math.max(2, y - 22)) : null;

            sprite.on('pointerover', () => {
              sprite.filters = [outline];
              if (label) label.visible = true;
            });
            sprite.on('pointerout', () => {
              sprite.filters = [];
              if (label) label.visible = false;
            });
            sprite.on('pointertap', () => onHotspotRef.current(hotspot));

            layer.addChild(sprite);
            if (label) layer.addChild(label);
            continue;
          }

          // No sprite: invisible but clickable region. The hit area and hover
          // outline follow the hotspot's actual shape (box, ellipse, polygon).
          const node = new Container();
          node.eventMode = 'static';
          node.cursor = 'pointer';

          const highlight = new Graphics();
          const shape = hotspot.shape;
          if (shape.type === 'ellipse') {
            const cx = x + w / 2;
            const cy = y + h / 2;
            node.hitArea = new Ellipse(cx, cy, w / 2, h / 2);
            highlight.ellipse(cx, cy, w / 2, h / 2);
          } else if (shape.type === 'polygon') {
            const flat = shape.points.flatMap((p) => [projX(p.x), projY(p.y)]);
            node.hitArea = new Polygon(flat);
            highlight.poly(flat);
          } else {
            node.hitArea = new Rectangle(x, y, w, h);
            highlight.roundRect(x, y, w, h, 10);
          }
          highlight
            .fill({ color: 0xffffff, alpha: 0.08 })
            .stroke({ color: 0xffe6a6, width: 3, alpha: 0.95 });
          highlight.eventMode = 'none';
          highlight.visible = false;
          node.addChild(highlight);

          const label = hotspot.label ? makeLabel(hotspot.label, x + 6, Math.max(2, y - 22)) : null;
          if (label) node.addChild(label);

          const setHover = (on: boolean) => {
            highlight.visible = on;
            if (label) label.visible = on;
          };
          node.on('pointerover', () => setHover(true));
          node.on('pointerout', () => setHover(false));
          node.on('pointertap', () => onHotspotRef.current(hotspot));

          layer.addChild(node);
        }
      };

      layoutRef.current = layout;
      layout();
      instance.renderer.on('resize', () => {
        fitBackground();
        layout();
      });
    })();

    return () => {
      destroyed = true;
      layoutRef.current = () => {};
      if (app) app.destroy(true, { children: true });
    };
  }, [room]);

  // Re-lay-out active hotspots when game state changes (e.g. a door unlocks).
  useEffect(() => {
    layoutRef.current();
  }, [revision]);

  return <div ref={hostRef} className="pixi-host" />;
}
