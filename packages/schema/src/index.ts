import { z } from 'zod';

/**
 * A point-and-click game is pure data: a graph of rooms, each with tappable
 * hotspots whose actions mutate a shared state (inventory + flags). The engine
 * interprets this; the renderer draws it; the editor produces it.
 */

export const flagValueSchema = z.union([z.string(), z.number(), z.boolean()]);
export type FlagValue = z.infer<typeof flagValueSchema>;

/** Gate on the current state. A hotspot fires only when all of its conditions pass. */
export const conditionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hasItem'), item: z.string() }),
  z.object({ type: z.literal('notItem'), item: z.string() }),
  z.object({ type: z.literal('flag'), key: z.string(), equals: flagValueSchema }),
  z.object({ type: z.literal('notFlag'), key: z.string() }),
]);
export type Condition = z.infer<typeof conditionSchema>;

/** The verbs a hotspot can perform, applied in order when it fires. */
export const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('addItem'), item: z.string() }),
  z.object({ type: z.literal('removeItem'), item: z.string() }),
  z.object({ type: z.literal('setFlag'), key: z.string(), value: flagValueSchema }),
  z.object({ type: z.literal('goToRoom'), room: z.string() }),
  z.object({ type: z.literal('showMessage'), text: z.string() }),
  z.object({ type: z.literal('playSound'), src: z.string() }),
  z.object({ type: z.literal('win') }),
]);
export type Action = z.infer<typeof actionSchema>;

/** Region coordinates are normalized 0..1 so they scale across phone sizes. */
export const rectSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});
export type Rect = z.infer<typeof rectSchema>;

export const hotspotSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  shape: rectSchema,
  conditions: z.array(conditionSchema).default([]),
  actions: z.array(actionSchema).min(1),
});
export type Hotspot = z.infer<typeof hotspotSchema>;

/** `background` is either an asset URL or a solid `#rrggbb` fill (handy before art exists). */
export const roomSchema = z.object({
  id: z.string(),
  clusterId: z.string(),
  background: z.string(),
  ambientAudio: z.string().optional(),
  hotspots: z.array(hotspotSchema).default([]),
});
export type Room = z.infer<typeof roomSchema>;

export const itemSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().optional(),
});
export type Item = z.infer<typeof itemSchema>;

/**
 * A cluster = one stqry web-page item = a group of rooms sharing one embedded
 * page. Rooms within a cluster are reached by in-app routing; crossing clusters
 * goes through stqry's `linking.openInternal` using `stqryId`.
 */
export const clusterSchema = z.object({
  id: z.string(),
  stqryId: z.number().optional(),
  entryUrl: z.string().optional(),
  rooms: z.array(z.string()).min(1),
});
export type Cluster = z.infer<typeof clusterSchema>;

export const gameSchema = z.object({
  id: z.string(),
  title: z.string(),
  schemaVersion: z.literal(1),
  startRoom: z.string(),
  items: z.array(itemSchema).default([]),
  clusters: z.array(clusterSchema).min(1),
  rooms: z.array(roomSchema).min(1),
});
export type Game = z.infer<typeof gameSchema>;

/** Parse + validate untrusted game JSON (e.g. from storage or an import). */
export function parseGame(input: unknown): Game {
  return gameSchema.parse(input);
}
