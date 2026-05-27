import { useEffect, useRef } from 'react';
import {
  Application,
  Assets,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  type Texture,
} from 'pixi.js';
import { OutlineFilter } from 'pixi-filters';
import type { Hotspot, Room } from '@escape/schema';
import { assetUrl, isImageBackground } from './assets.js';

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

      // Load the room background art (if any) and cover-fit it behind the
      // hotspots. Solid `#rrggbb` backgrounds already show via the app's
      // clear color, so there is nothing to load for those.
      let bg: Sprite | null = null;
      const fitBackground = () => {
        if (!bg) return;
        const { width, height } = instance.screen;
        const tw = bg.texture.width;
        const th = bg.texture.height;
        if (!tw || !th) return;
        const scale = Math.max(width / tw, height / th);
        bg.scale.set(scale);
        bg.position.set((width - tw * scale) / 2, (height - th * scale) / 2);
      };
      if (isImageBackground(room.background)) {
        void Assets.load<Texture>(assetUrl(room.background))
          .then((texture) => {
            if (destroyed || !app) return;
            bg = new Sprite(texture);
            instance.stage.addChildAt(bg, 0);
            fitBackground();
          })
          .catch(() => {
            // Leave the solid clear color as a graceful fallback.
          });
      }

      // Preload object sprites so layout can place them synchronously.
      const spriteTextures = new Map<string, Texture>();
      await Promise.all(
        [...new Set(room.hotspots.filter((h) => h.sprite).map((h) => assetUrl(h.sprite!)))].map(
          async (url) => {
            try {
              spriteTextures.set(url, await Assets.load<Texture>(url));
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
        const { width, height } = instance.screen;
        for (const hotspot of room.hotspots) {
          if (!isActiveRef.current(hotspot)) continue;
          const x = hotspot.shape.x * width;
          const y = hotspot.shape.y * height;
          const w = hotspot.shape.w * width;
          const h = hotspot.shape.h * height;

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

          // No sprite: invisible but clickable region with a box outline on hover.
          const node = new Container();
          node.eventMode = 'static';
          node.cursor = 'pointer';
          node.hitArea = new Rectangle(x, y, w, h);

          const highlight = new Graphics();
          highlight
            .roundRect(x, y, w, h, 10)
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
