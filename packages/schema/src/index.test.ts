import { describe, expect, it } from 'vitest';
import { parseGame, type Game } from './index.js';

const valid: Game = {
  id: 'demo',
  title: 'Demo',
  schemaVersion: 1,
  startRoom: 'lobby',
  items: [{ id: 'key', name: 'Rusty Key' }],
  clusters: [{ id: 'hub', stqryId: 1, rooms: ['lobby'] }],
  rooms: [
    {
      id: 'lobby',
      clusterId: 'hub',
      background: '#222',
      hotspots: [
        {
          id: 'door',
          shape: { type: 'rect', x: 0.1, y: 0.1, w: 0.2, h: 0.4 },
          conditions: [{ type: 'hasItem', item: 'key' }],
          actions: [{ type: 'win' }],
        },
      ],
    },
  ],
};

describe('gameSchema', () => {
  it('accepts a well-formed game', () => {
    expect(() => parseGame(valid)).not.toThrow();
  });

  it('applies defaults for omitted optional arrays', () => {
    const game = parseGame({ ...valid, items: undefined });
    expect(game.items).toEqual([]);
  });

  it('accepts ellipse and polygon hotspot shapes', () => {
    const g = structuredClone(valid);
    g.rooms[0]!.hotspots[0]!.shape = { type: 'ellipse', x: 0.1, y: 0.1, w: 0.3, h: 0.3 };
    expect(() => parseGame(g)).not.toThrow();
    g.rooms[0]!.hotspots[0]!.shape = {
      type: 'polygon',
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.4, y: 0.2 },
        { x: 0.2, y: 0.5 },
      ],
    };
    expect(() => parseGame(g)).not.toThrow();
  });

  it('rejects a polygon with fewer than three points', () => {
    const bad = structuredClone(valid);
    bad.rooms[0]!.hotspots[0]!.shape = {
      type: 'polygon',
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.4, y: 0.2 },
      ],
    };
    expect(() => parseGame(bad)).toThrow();
  });

  it('rejects out-of-range hotspot coordinates', () => {
    const bad = structuredClone(valid);
    bad.rooms[0]!.hotspots[0]!.shape = { type: 'rect', x: 1.5, y: 0.1, w: 0.2, h: 0.4 };
    expect(() => parseGame(bad)).toThrow();
  });

  it('rejects a hotspot with no actions', () => {
    const bad = structuredClone(valid);
    bad.rooms[0]!.hotspots[0]!.actions = [];
    expect(() => parseGame(bad)).toThrow();
  });
});
